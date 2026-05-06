import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { extractRequiredVariables } from '@publ/shared';
import {
  AlimtalkTemplateBindingMode,
  MessageChannel,
  ProviderTemplateStatus,
  SenderProfileStatus,
  TemplateStatus
} from '@prisma/client';
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
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
        select: {
          id: true,
          plusFriendId: true,
          senderKey: true,
          status: true,
          isDefault: true,
          updatedAt: true
        }
      })
    ]);
    const publEventDefinitions = items.length > 0
      ? await this.prisma.publEventDefinition.findMany({
          where: {
            eventKey: {
              in: [...new Set(items.map((item) => item.eventKey))]
            }
          }
        })
      : [];
    const publEventByKey = new Map(publEventDefinitions.map((item) => [item.eventKey, item]));

    return {
      readiness,
      counts: {
        totalCount: items.length,
        enabledCount: items.filter((item) => item.enabled).length
      },
      items: items.map((item) => this.serializeEventRule(item, publEventByKey.get(item.eventKey) ?? null)),
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
    const publEvent = await this.findPublEventDefinition(detail.eventKey);

    return {
      item: this.serializeEventRule(detail, publEvent)
    };
  }

  async updateById(userId: string, eventRuleId: string, dto: UpsertEventRuleDto) {
    const updated = await this.eventRulesService.updateByIdForUser(userId, eventRuleId, dto);
    const detail = await this.eventRulesService.detailForUser(userId, updated.id);
    const publEvent = await this.findPublEventDefinition(detail.eventKey);

    return {
      item: this.serializeEventRule(detail, publEvent)
    };
  }

  async upsertPublKakaoBinding(sessionUser: SessionUser, dto: UpsertV2PublEventKakaoBindingDto) {
    const userId = sessionUser.userId;
    const eventKey = dto.eventKey.trim();
    const providerTemplateId = dto.providerTemplateId?.trim() || null;
    const kakaoTemplateCatalogId = dto.kakaoTemplateCatalogId?.trim() || null;
    const templateBindingMode: 'DEFAULT' | 'CUSTOM' = dto.templateBindingMode === 'DEFAULT' ? 'DEFAULT' : 'CUSTOM';
    const senderProfileId = dto.senderProfileId.trim();

    if (!eventKey || !senderProfileId) {
      throw new BadRequestException('이벤트 키와 카카오 채널은 비어 있을 수 없습니다.');
    }

    if (templateBindingMode === 'CUSTOM' && !providerTemplateId && !kakaoTemplateCatalogId) {
      throw new BadRequestException('연결할 알림톡 템플릿을 선택해 주세요.');
    }

    if (providerTemplateId && kakaoTemplateCatalogId) {
      throw new BadRequestException('알림톡 템플릿은 하나만 선택할 수 있습니다.');
    }

    if (templateBindingMode === 'DEFAULT' && (providerTemplateId || kakaoTemplateCatalogId)) {
      throw new BadRequestException('기본 템플릿 사용 시 셀러별 템플릿을 함께 선택할 수 없습니다.');
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
          ownerUserId: userId,
          status: SenderProfileStatus.ACTIVE
        }
      })
    ]);

    if (!publEvent) {
      throw new NotFoundException('Publ 이벤트를 찾을 수 없습니다.');
    }

    if (!senderProfile) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'KAKAO_SENDER_PROFILE_REQUIRED',
        message: '활성 카카오 채널이 있어야 이벤트 자동화를 활성화할 수 있습니다.'
      });
    }

    const defaultTemplate = this.getDefaultTemplateSnapshot(publEvent);
    const providerTemplate = templateBindingMode === 'CUSTOM'
      ? providerTemplateId
        ? await this.findLocalKakaoProviderTemplate(userId, providerTemplateId)
        : await this.syncCatalogKakaoProviderTemplate(sessionUser, kakaoTemplateCatalogId!)
      : null;

    if (templateBindingMode === 'CUSTOM' && !providerTemplate?.template) {
      throw new NotFoundException('연결할 알림톡 템플릿을 찾을 수 없습니다.');
    }

    if (!defaultTemplate) {
      throw new ConflictException({
        statusCode: 409,
        code: 'PUBL_EVENT_DEFAULT_TEMPLATE_NOT_APPROVED',
        message: '승인된 기본 템플릿이 있어야 이벤트 자동화를 활성화할 수 있습니다.'
      });
    }

    const templateVariables =
      templateBindingMode === 'DEFAULT'
        ? extractRequiredVariables(defaultTemplate!.body)
        : extractRequiredVariables(providerTemplate!.template.body);
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
      enabled: true,
      channelStrategy,
      messagePurpose: 'NORMAL',
      requiredVariables: templateVariables,
      smsTemplateId: existingRule?.smsTemplateId ?? undefined,
      smsSenderNumberId: existingRule?.smsSenderNumberId ?? undefined,
      alimtalkTemplateId:
        templateBindingMode === 'DEFAULT' ? undefined : providerTemplate!.id,
      alimtalkTemplateBindingMode: templateBindingMode,
      alimtalkSenderProfileId: senderProfile.id
    });
    const detail = await this.eventRulesService.detailForUser(userId, upserted.id);
    const updatedPublEvent = await this.findPublEventDefinition(detail.eventKey);

    return {
      item: this.serializeEventRule(detail, updatedPublEvent)
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

  private findPublEventDefinition(eventKey: string) {
    return this.prisma.publEventDefinition.findFirst({
      where: {
        eventKey
      }
    });
  }

  private getDefaultTemplateSnapshot(event: Awaited<ReturnType<V2EventsService['findPublEventDefinition']>> | null) {
    const templateCode = event?.defaultTemplateCode?.trim() || event?.defaultKakaoTemplateCode?.trim() || null;
    const body = event?.defaultTemplateBody?.trim() || null;

    if (!event || !templateCode || !body || event.defaultTemplateStatus !== 'APR') {
      return null;
    }

    return {
      name: event.defaultTemplateName?.trim() || templateCode || '기본 템플릿',
      templateCode,
      kakaoTemplateCode: event.defaultKakaoTemplateCode?.trim() || null,
      providerStatus: event.defaultTemplateStatus,
      body
    };
  }

  private serializeEventRule(
    rule: Awaited<ReturnType<EventRulesService['detail']>>,
    publEvent: Awaited<ReturnType<V2EventsService['findPublEventDefinition']>> | null
  ) {
    const alimtalkTemplateBindingMode =
      rule.alimtalkTemplateBindingMode ?? AlimtalkTemplateBindingMode.CUSTOM;
    const defaultTemplate = this.getDefaultTemplateSnapshot(publEvent);
    const kakao =
      rule.alimtalkTemplate && rule.alimtalkSenderProfile
        ? {
            templateBindingMode: AlimtalkTemplateBindingMode.CUSTOM,
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
        : alimtalkTemplateBindingMode === AlimtalkTemplateBindingMode.DEFAULT && rule.alimtalkSenderProfile && defaultTemplate
          ? {
              templateBindingMode: AlimtalkTemplateBindingMode.DEFAULT,
              providerTemplateId: null,
              templateId: null,
              templateName: defaultTemplate.name,
              templateCode: defaultTemplate.templateCode,
              kakaoTemplateCode: defaultTemplate.kakaoTemplateCode,
              providerStatus: defaultTemplate.providerStatus,
              senderProfileId: rule.alimtalkSenderProfile.id,
              plusFriendId: rule.alimtalkSenderProfile.plusFriendId,
              senderKey: rule.alimtalkSenderProfile.senderKey
            }
          : null;

    return {
      id: rule.id,
      eventKey: rule.eventKey,
      displayName: rule.displayName,
      enabled: rule.enabled,
      channelStrategy: rule.channelStrategy,
      alimtalkTemplateBindingMode,
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
      kakao
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
