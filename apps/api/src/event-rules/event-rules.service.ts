import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { extractRequiredVariables } from '@publ/shared';
import { SenderNumberStatus, TemplateStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { UpsertEventRuleDto } from './event-rules.dto';

@Injectable()
export class EventRulesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    return this.prisma.eventRule.findMany({
      where: { tenantId },
      include: {
        smsTemplate: true,
        alimtalkTemplate: {
          include: {
            template: true
          }
        },
        smsSenderNumber: true,
        alimtalkSenderProfile: true
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async detail(tenantId: string, eventRuleId: string) {
    const row = await this.prisma.eventRule.findFirst({
      where: { id: eventRuleId, tenantId },
      include: {
        smsTemplate: true,
        alimtalkTemplate: {
          include: {
            template: true
          }
        },
        smsSenderNumber: true,
        alimtalkSenderProfile: true
      }
    });

    if (!row) {
      throw new NotFoundException('Event rule not found');
    }

    return row;
  }

  async create(tenantId: string, userId: string, dto: UpsertEventRuleDto) {
    const normalized = await this.validateUpsertInput(tenantId, dto);
    const existing = await this.prisma.eventRule.findUnique({
      where: {
        tenantId_eventKey: {
          tenantId,
          eventKey: normalized.eventKey
        }
      }
    });

    if (existing) {
      throw new ConflictException('같은 eventKey를 가진 이벤트 규칙이 이미 존재합니다.');
    }

    return this.prisma.eventRule.create({
      data: {
        tenantId,
        eventKey: normalized.eventKey,
        ...this.buildMutationData(normalized, userId)
      }
    });
  }

  async updateById(tenantId: string, userId: string, eventRuleId: string, dto: UpsertEventRuleDto) {
    const existingRule = await this.prisma.eventRule.findFirst({
      where: {
        id: eventRuleId,
        tenantId
      }
    });

    if (!existingRule) {
      throw new NotFoundException('Event rule not found');
    }

    const normalized = await this.validateUpsertInput(tenantId, dto);
    const conflictingRule = await this.prisma.eventRule.findUnique({
      where: {
        tenantId_eventKey: {
          tenantId,
          eventKey: normalized.eventKey
        }
      }
    });

    if (conflictingRule && conflictingRule.id !== existingRule.id) {
      throw new ConflictException('같은 eventKey를 가진 이벤트 규칙이 이미 존재합니다.');
    }

    return this.prisma.eventRule.update({
      where: { id: existingRule.id },
      data: {
        eventKey: normalized.eventKey,
        ...this.buildMutationData(normalized, userId)
      }
    });
  }

  async upsert(tenantId: string, userId: string, dto: UpsertEventRuleDto) {
    const normalized = await this.validateUpsertInput(tenantId, dto);

    return this.prisma.eventRule.upsert({
      where: {
        tenantId_eventKey: {
          tenantId,
          eventKey: normalized.eventKey
        }
      },
      update: {
        ...this.buildMutationData(normalized, userId)
      },
      create: {
        tenantId,
        eventKey: normalized.eventKey,
        ...this.buildMutationData(normalized, userId)
      }
    });
  }

  private async validateUpsertInput(tenantId: string, dto: UpsertEventRuleDto) {
    const normalized = this.normalizeUpsertDto(dto);
    const bindings = await this.loadBindings(tenantId, normalized);

    if (normalized.messagePurpose !== 'NORMAL') {
      throw new ConflictException('MVP supports NORMAL messagePurpose only');
    }

    this.validateChannelConfiguration(normalized, bindings);

    return normalized;
  }

  private buildMutationData(normalized: ReturnType<EventRulesService['normalizeUpsertDto']>, userId: string) {
    return {
      displayName: normalized.displayName,
      enabled: normalized.enabled,
      channelStrategy: normalized.channelStrategy,
      messagePurpose: normalized.messagePurpose,
      requiredVariables: normalized.requiredVariables,
      smsTemplateId: normalized.smsTemplateId,
      smsSenderNumberId: normalized.smsSenderNumberId,
      alimtalkTemplateId: normalized.alimtalkTemplateId,
      alimtalkSenderProfileId: normalized.alimtalkSenderProfileId,
      updatedBy: userId
    };
  }

  private normalizeUpsertDto(dto: UpsertEventRuleDto) {
    return {
      eventKey: dto.eventKey.trim(),
      displayName: dto.displayName.trim(),
      enabled: dto.enabled,
      channelStrategy: dto.channelStrategy,
      messagePurpose: dto.messagePurpose,
      requiredVariables: dto.requiredVariables.map((value) => value.trim()).filter(Boolean),
      smsTemplateId: this.normalizeOptionalId(dto.smsTemplateId),
      smsSenderNumberId: this.normalizeOptionalId(dto.smsSenderNumberId),
      alimtalkTemplateId: this.normalizeOptionalId(dto.alimtalkTemplateId),
      alimtalkSenderProfileId: this.normalizeOptionalId(dto.alimtalkSenderProfileId)
    };
  }

  private normalizeOptionalId(value?: string): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private async loadBindings(
    tenantId: string,
    dto: ReturnType<EventRulesService['normalizeUpsertDto']>
  ) {
    const [smsTemplate, smsSenderNumber, alimtalkProviderTemplate, alimtalkSenderProfile] = await Promise.all([
      dto.smsTemplateId
        ? this.prisma.template.findFirst({
            where: {
              id: dto.smsTemplateId,
              tenantId,
              channel: 'SMS'
            }
          })
        : Promise.resolve(null),
      dto.smsSenderNumberId
        ? this.prisma.senderNumber.findFirst({
            where: {
              id: dto.smsSenderNumberId,
              tenantId
            }
          })
        : Promise.resolve(null),
      dto.alimtalkTemplateId
        ? this.prisma.providerTemplate.findFirst({
            where: {
              id: dto.alimtalkTemplateId,
              tenantId,
              channel: 'ALIMTALK'
            },
            include: {
              template: true
            }
          })
        : Promise.resolve(null),
      dto.alimtalkSenderProfileId
        ? this.prisma.senderProfile.findFirst({
            where: {
              id: dto.alimtalkSenderProfileId,
              tenantId
            }
          })
        : Promise.resolve(null)
    ]);

    return {
      smsTemplate,
      smsSenderNumber,
      alimtalkProviderTemplate,
      alimtalkSenderProfile
    };
  }

  private validateChannelConfiguration(
    dto: ReturnType<EventRulesService['normalizeUpsertDto']>,
    bindings: Awaited<ReturnType<EventRulesService['loadBindings']>>
  ) {
    const hasSmsConfig = Boolean(dto.smsTemplateId && dto.smsSenderNumberId);
    const hasPartialSmsConfig = Boolean(dto.smsTemplateId || dto.smsSenderNumberId) && !hasSmsConfig;
    const hasAlimtalkConfig = Boolean(dto.alimtalkTemplateId && dto.alimtalkSenderProfileId);
    const hasPartialAlimtalkConfig = Boolean(dto.alimtalkTemplateId || dto.alimtalkSenderProfileId) && !hasAlimtalkConfig;
    const ruleVariables = this.normalizeVariables(dto.requiredVariables);

    if (hasPartialSmsConfig) {
      throw new ConflictException('SMS 규칙은 SMS 템플릿과 발신번호를 함께 선택해야 합니다.');
    }

    if (hasPartialAlimtalkConfig) {
      throw new ConflictException('알림톡 규칙은 알림톡 템플릿과 카카오 채널을 함께 선택해야 합니다.');
    }

    if (dto.smsTemplateId && !bindings.smsTemplate) {
      throw new ConflictException('선택한 SMS 템플릿을 찾을 수 없습니다.');
    }

    if (dto.smsSenderNumberId && !bindings.smsSenderNumber) {
      throw new ConflictException('선택한 SMS 발신번호를 찾을 수 없습니다.');
    }

    if (dto.alimtalkTemplateId && !bindings.alimtalkProviderTemplate) {
      throw new ConflictException('선택한 알림톡 템플릿을 찾을 수 없습니다.');
    }

    if (dto.alimtalkSenderProfileId && !bindings.alimtalkSenderProfile) {
      throw new ConflictException('선택한 카카오 채널을 찾을 수 없습니다.');
    }

    if (dto.channelStrategy === 'SMS_ONLY' && !hasSmsConfig) {
      throw new ConflictException('SMS_ONLY 규칙은 SMS 템플릿과 발신번호가 필요합니다.');
    }

    if (dto.channelStrategy === 'ALIMTALK_ONLY' && !hasAlimtalkConfig) {
      throw new ConflictException('ALIMTALK_ONLY 규칙은 승인된 알림톡 템플릿과 카카오 채널이 필요합니다.');
    }

    if (dto.channelStrategy === 'ALIMTALK_THEN_SMS' && !hasSmsConfig && !hasAlimtalkConfig) {
      throw new ConflictException('ALIMTALK_THEN_SMS 규칙은 알림톡 또는 SMS 중 최소 한 채널은 준비되어 있어야 합니다.');
    }

    if (bindings.smsTemplate && bindings.smsTemplate.status !== TemplateStatus.PUBLISHED) {
      throw new ConflictException('이벤트 규칙에는 게시된 SMS 템플릿만 연결할 수 있습니다.');
    }

    if (bindings.smsSenderNumber && bindings.smsSenderNumber.status !== SenderNumberStatus.APPROVED) {
      throw new ConflictException('이벤트 규칙에는 승인된 SMS 발신번호만 연결할 수 있습니다.');
    }

    if (bindings.alimtalkProviderTemplate && bindings.alimtalkProviderTemplate.providerStatus !== 'APR') {
      throw new ConflictException('ALIMTALK 템플릿은 APR 상태여야 이벤트 규칙에 연결할 수 있습니다.');
    }

    if (bindings.smsTemplate) {
      this.assertVariableMatch('SMS 템플릿', ruleVariables, extractRequiredVariables(bindings.smsTemplate.body));
    }

    if (bindings.alimtalkProviderTemplate?.template) {
      this.assertVariableMatch(
        '알림톡 템플릿',
        ruleVariables,
        extractRequiredVariables(bindings.alimtalkProviderTemplate.template.body)
      );
    }

    if (bindings.smsTemplate && bindings.alimtalkProviderTemplate?.template) {
      this.assertTemplatePairMatch(
        'SMS 템플릿',
        extractRequiredVariables(bindings.smsTemplate.body),
        '알림톡 템플릿',
        extractRequiredVariables(bindings.alimtalkProviderTemplate.template.body)
      );
    }
  }

  private normalizeVariables(values: string[]): string[] {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
  }

  private assertVariableMatch(label: string, ruleVariables: string[], templateVariables: string[]) {
    const normalizedTemplateVariables = this.normalizeVariables(templateVariables);
    if (!this.areSameVariables(ruleVariables, normalizedTemplateVariables)) {
      throw new ConflictException(
        `${label} 변수와 이벤트 규칙 필수 변수가 다릅니다. 템플릿 변수: ${normalizedTemplateVariables.join(', ') || '-'} / 규칙 변수: ${ruleVariables.join(', ') || '-'}`
      );
    }
  }

  private assertTemplatePairMatch(
    leftLabel: string,
    leftVariables: string[],
    rightLabel: string,
    rightVariables: string[]
  ) {
    const normalizedLeft = this.normalizeVariables(leftVariables);
    const normalizedRight = this.normalizeVariables(rightVariables);

    if (!this.areSameVariables(normalizedLeft, normalizedRight)) {
      throw new ConflictException(
        `${leftLabel} 변수와 ${rightLabel} 변수가 다릅니다. ${leftLabel}: ${normalizedLeft.join(', ') || '-'} / ${rightLabel}: ${normalizedRight.join(', ') || '-'}`
      );
    }
  }

  private areSameVariables(left: string[], right: string[]) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }
}
