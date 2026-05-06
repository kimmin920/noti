import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { extractRequiredVariables } from '@publ/shared';
import { MessageChannel, ProviderTemplateStatus, TemplateStatus } from '@prisma/client';
import { SessionUser } from '../../common/session-request.interface';
import { PrismaService } from '../../database/prisma.service';
import { UpsertEventRuleDto } from '../../event-rules/event-rules.dto';
import { EventRulesService } from '../../event-rules/event-rules.service';
import {
  V2KakaoTemplateCatalogItem,
  V2KakaoTemplateCatalogService
} from '../shared/v2-kakao-template-catalog.service';
import { V2ReadinessService } from '../shared/v2-readiness.service';
import { canUsePartnerGroupTemplates } from '../v2-auth.utils';
import { UpsertV2PublEventKakaoBindingDto } from './v2-events.dto';

@Injectable()
export class V2EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly readinessService: V2ReadinessService,
    private readonly kakaoTemplateCatalogService: V2KakaoTemplateCatalogService,
    private readonly eventRulesService: EventRulesService
  ) {}

  async list(ownerUserId: string) {
    const [readiness, items, smsTemplates, smsSenderNumbers, kakaoTemplates, kakaoSenderProfiles] = await Promise.all([
      this.readinessService.getReadinessForUser(ownerUserId),
      this.eventRulesService.listForUser(ownerUserId),
      this.prisma.template.findMany({
        where: {
          ownerUserId: ownerUserId,
          channel: MessageChannel.SMS,
          status: TemplateStatus.PUBLISHED
        },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          updatedAt: true
        }
      }),
      this.prisma.senderNumber.findMany({
        where: {
          ownerUserId: ownerUserId,
          status: 'APPROVED'
        },
        orderBy: [{ approvedAt: 'desc' }, { updatedAt: 'desc' }],
        select: {
          id: true,
          phoneNumber: true,
          approvedAt: true,
          updatedAt: true
        }
      }),
      this.prisma.providerTemplate.findMany({
        where: {
          ownerUserId: ownerUserId,
          channel: MessageChannel.ALIMTALK,
          providerStatus: ProviderTemplateStatus.APR
        },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          providerStatus: true,
          templateCode: true,
          kakaoTemplateCode: true,
          updatedAt: true,
          template: {
            select: {
              id: true,
              name: true,
              requiredVariables: true
            }
          }
        }
      }),
      this.prisma.senderProfile.findMany({
        where: {
          ownerUserId: ownerUserId
        },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          plusFriendId: true,
          senderKey: true,
          status: true,
          updatedAt: true
        }
      })
    ]);

    return {
      readiness,
      counts: {
        totalCount: items.length,
        enabledCount: items.filter((item) => item.enabled).length
      },
      items: items.map((item) => this.serializeEventRule(item)),
      options: {
        channelStrategies: ['SMS_ONLY', 'ALIMTALK_ONLY', 'ALIMTALK_THEN_SMS'],
        messagePurposes: ['NORMAL'],
        smsTemplates,
        smsSenderNumbers,
        kakaoTemplates: kakaoTemplates.map((item) => ({
          id: item.id,
          templateId: item.template.id,
          name: item.template.name,
          templateCode: item.templateCode,
          kakaoTemplateCode: item.kakaoTemplateCode,
          providerStatus: item.providerStatus,
          requiredVariables: normalizeRequiredVariables(item.template.requiredVariables),
          updatedAt: item.updatedAt
        })),
        kakaoSenderProfiles
      }
    };
  }

  async create(userId: string, dto: UpsertEventRuleDto) {
    const created = await this.eventRulesService.createForUser(userId, dto);
    const detail = await this.eventRulesService.detailForUser(userId, created.id);

    return {
      item: this.serializeEventRule(detail)
    };
  }

  async updateById(userId: string, eventRuleId: string, dto: UpsertEventRuleDto) {
    const updated = await this.eventRulesService.updateByIdForUser(userId, eventRuleId, dto);
    const detail = await this.eventRulesService.detailForUser(userId, updated.id);

    return {
      item: this.serializeEventRule(detail)
    };
  }

  async upsertPublKakaoBinding(sessionUser: SessionUser, dto: UpsertV2PublEventKakaoBindingDto) {
    const userId = sessionUser.userId;
    const eventKey = dto.eventKey.trim();
    const providerTemplateId = dto.providerTemplateId?.trim() || null;
    const kakaoTemplateCatalogId = dto.kakaoTemplateCatalogId?.trim() || null;
    const senderProfileId = dto.senderProfileId.trim();

    if (!eventKey || !senderProfileId) {
      throw new BadRequestException('이벤트 키와 카카오 채널은 비어 있을 수 없습니다.');
    }

    if (!providerTemplateId && !kakaoTemplateCatalogId) {
      throw new BadRequestException('연결할 알림톡 템플릿을 선택해 주세요.');
    }

    if (providerTemplateId && kakaoTemplateCatalogId) {
      throw new BadRequestException('알림톡 템플릿은 하나만 선택할 수 있습니다.');
    }

    const [publEvent, existingRule, senderProfile] = await Promise.all([
      this.prisma.publEventDefinition.findFirst({
        where: {
          eventKey
        },
        include: {
          props: {
            orderBy: [{ sortOrder: 'asc' }, { rawPath: 'asc' }]
          }
        }
      }),
      this.prisma.eventRule.findFirst({
        where: {
          ownerUserId: userId,
          eventKey
        }
      }),
      this.prisma.senderProfile.findFirst({
        where: {
          id: senderProfileId,
          ownerUserId: userId
        }
      })
    ]);

    if (!publEvent) {
      throw new NotFoundException('Publ 이벤트를 찾을 수 없습니다.');
    }

    if (!senderProfile) {
      throw new NotFoundException('연결할 카카오 채널을 찾을 수 없습니다.');
    }

    const providerTemplate = providerTemplateId
      ? await this.findLocalKakaoProviderTemplate(userId, providerTemplateId)
      : await this.syncCatalogKakaoProviderTemplate(sessionUser, kakaoTemplateCatalogId!);

    if (!providerTemplate?.template) {
      throw new NotFoundException('연결할 알림톡 템플릿을 찾을 수 없습니다.');
    }

    const templateVariables = extractRequiredVariables(providerTemplate.template.body);
    const availableVariables = this.collectPublEventVariables(publEvent.props);
    const missingVariables = templateVariables.filter((value) => !availableVariables.has(value.trim()));

    if (missingVariables.length > 0) {
      throw new ConflictException(
        `이 템플릿은 현재 Publ 이벤트에 없는 변수를 사용합니다: ${missingVariables.join(', ')}`
      );
    }

    const hasSmsFallback = Boolean(existingRule?.smsTemplateId && existingRule?.smsSenderNumberId);
    const channelStrategy = hasSmsFallback ? 'ALIMTALK_THEN_SMS' : 'ALIMTALK_ONLY';

    const upserted = await this.eventRulesService.upsertForUser(userId, {
      eventKey,
      displayName: existingRule?.displayName || publEvent.displayName,
      enabled: existingRule?.enabled ?? publEvent.serviceStatus === 'ACTIVE',
      channelStrategy,
      messagePurpose: 'NORMAL',
      requiredVariables: templateVariables,
      smsTemplateId: existingRule?.smsTemplateId ?? undefined,
      smsSenderNumberId: existingRule?.smsSenderNumberId ?? undefined,
      alimtalkTemplateId: providerTemplate.id,
      alimtalkSenderProfileId: senderProfile.id
    });
    const detail = await this.eventRulesService.detailForUser(userId, upserted.id);

    return {
      item: this.serializeEventRule(detail)
    };
  }

  private findLocalKakaoProviderTemplate(ownerUserId: string, providerTemplateId: string) {
    return this.prisma.providerTemplate.findFirst({
      where: {
        id: providerTemplateId,
        ownerUserId,
        channel: MessageChannel.ALIMTALK
      },
      include: {
        template: true
      }
    });
  }

  private async syncCatalogKakaoProviderTemplate(sessionUser: SessionUser, catalogId: string) {
    const catalog = await this.kakaoTemplateCatalogService.getTemplateCatalogForUser(sessionUser.userId, {
      includeDefaultGroup: canUsePartnerGroupTemplates(sessionUser),
      groupScope: sessionUser.accessOrigin === 'PUBL' ? 'PUBL' : null
    });
    const catalogItem = catalog.items.find((item) => item.id === catalogId) ?? null;

    if (!catalogItem) {
      throw new NotFoundException('템플릿관리에서 선택한 알림톡 템플릿을 찾을 수 없습니다.');
    }

    if (catalogItem.providerStatus !== 'APR') {
      throw new ConflictException('승인된 알림톡 템플릿만 이벤트에 연결할 수 있습니다.');
    }

    return this.upsertCatalogProviderTemplate(sessionUser.userId, catalogItem);
  }

  private upsertCatalogProviderTemplate(ownerUserId: string, catalogItem: V2KakaoTemplateCatalogItem) {
    const templateCode = catalogItem.templateCode?.trim() || catalogItem.kakaoTemplateCode?.trim() || null;
    const templateName = catalogItem.templateName.trim() || templateCode || '알림톡 템플릿';
    const templateBody = catalogItem.templateBody.trim();
    const requiredVariables = extractRequiredVariables(templateBody);

    if (!templateCode) {
      throw new BadRequestException('템플릿 코드가 없는 알림톡 템플릿은 이벤트에 연결할 수 없습니다.');
    }

    if (!templateBody) {
      throw new BadRequestException('본문이 없는 알림톡 템플릿은 이벤트에 연결할 수 없습니다.');
    }

    return this.prisma.$transaction(async (tx) => {
      const existingProviderTemplate = await tx.providerTemplate.findFirst({
        where: {
          ownerUserId,
          channel: MessageChannel.ALIMTALK,
          nhnTemplateId: catalogItem.id
        },
        include: {
          template: true
        }
      });

      if (existingProviderTemplate) {
        await tx.template.update({
          where: {
            id: existingProviderTemplate.templateId
          },
          data: {
            name: templateName,
            body: templateBody,
            syntax: 'KAKAO_HASH',
            requiredVariables,
            status: TemplateStatus.PUBLISHED
          }
        });

        return tx.providerTemplate.update({
          where: {
            id: existingProviderTemplate.id
          },
          data: {
            providerStatus: ProviderTemplateStatus.APR,
            nhnTemplateId: catalogItem.id,
            templateCode,
            kakaoTemplateCode: catalogItem.kakaoTemplateCode?.trim() || null,
            lastSyncedAt: new Date()
          },
          include: {
            template: true
          }
        });
      }

      const createdTemplate = await tx.template.create({
        data: {
          ownerUserId,
          channel: MessageChannel.ALIMTALK,
          name: templateName,
          body: templateBody,
          syntax: 'KAKAO_HASH',
          requiredVariables,
          status: TemplateStatus.PUBLISHED
        }
      });

      await tx.templateVersion.create({
        data: {
          templateId: createdTemplate.id,
          version: 1,
          bodySnapshot: createdTemplate.body,
          requiredVariablesSnapshot: requiredVariables,
          createdBy: ownerUserId
        }
      });

      return tx.providerTemplate.create({
        data: {
          ownerUserId,
          channel: MessageChannel.ALIMTALK,
          templateId: createdTemplate.id,
          providerStatus: ProviderTemplateStatus.APR,
          nhnTemplateId: catalogItem.id,
          templateCode,
          kakaoTemplateCode: catalogItem.kakaoTemplateCode?.trim() || null,
          lastSyncedAt: new Date()
        },
        include: {
          template: true
        }
      });
    });
  }

  private serializeEventRule(rule: Awaited<ReturnType<EventRulesService['detail']>>) {
    return {
      id: rule.id,
      eventKey: rule.eventKey,
      displayName: rule.displayName,
      enabled: rule.enabled,
      channelStrategy: rule.channelStrategy,
      messagePurpose: rule.messagePurpose,
      requiredVariables: rule.requiredVariables,
      updatedBy: rule.updatedBy,
      updatedAt: rule.updatedAt,
      sms: rule.smsTemplate && rule.smsSenderNumber
        ? {
            templateId: rule.smsTemplate.id,
            templateName: rule.smsTemplate.name,
            senderNumberId: rule.smsSenderNumber.id,
            senderNumber: rule.smsSenderNumber.phoneNumber
          }
        : null,
      kakao: rule.alimtalkTemplate && rule.alimtalkSenderProfile
        ? {
            providerTemplateId: rule.alimtalkTemplate.id,
            templateId: rule.alimtalkTemplate.template.id,
            templateName: rule.alimtalkTemplate.template.name,
            templateCode: rule.alimtalkTemplate.templateCode,
            kakaoTemplateCode: rule.alimtalkTemplate.kakaoTemplateCode,
            providerStatus: rule.alimtalkTemplate.providerStatus,
            senderProfileId: rule.alimtalkSenderProfile.id,
            plusFriendId: rule.alimtalkSenderProfile.plusFriendId,
            senderKey: rule.alimtalkSenderProfile.senderKey
          }
        : null
    };
  }

  private collectPublEventVariables(
    props: Array<{
      alias: string;
      label: string;
      enabled: boolean;
    }>
  ) {
    const variables = new Set<string>();

    for (const prop of props) {
      if (!prop.enabled) {
        continue;
      }

      const candidates = [
        prop.alias,
        this.labelToVariable(prop.label)
      ];

      for (const candidate of candidates) {
        const normalized = candidate?.trim();
        if (normalized) {
          variables.add(normalized);
        }
      }
    }

    return variables;
  }

  private labelToVariable(value: string | null | undefined) {
    return String(value || '')
      .replace(/\s+/g, '')
      .trim();
  }
}

function normalizeRequiredVariables(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}
