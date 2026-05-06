import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { extractRequiredVariables } from '@publ/shared';
import { AlimtalkTemplateBindingMode, SenderNumberStatus, SenderProfileStatus, TemplateStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { UpsertEventRuleDto } from './event-rules.dto';

@Injectable()
export class EventRulesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(ownerUserId: string) {
    return this.prisma.eventRule.findMany({
      where: { ownerUserId: ownerUserId },
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

  async list(ownerUserId: string) {
    return this.listForUser(ownerUserId);
  }

  async detailForUser(ownerUserId: string, eventRuleId: string) {
    const row = await this.prisma.eventRule.findFirst({
      where: { id: eventRuleId, ownerUserId: ownerUserId },
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

  async detail(ownerUserId: string, eventRuleId: string) {
    return this.detailForUser(ownerUserId, eventRuleId);
  }

  async createForUser(userId: string, dto: UpsertEventRuleDto) {
    const normalized = await this.validateUpsertInputForUser(userId, dto);
    const existing = await this.prisma.eventRule.findFirst({
      where: {
        ownerUserId: userId,
        eventKey: normalized.eventKey
      }
    });

    if (existing) {
      throw new ConflictException('같은 eventKey를 가진 이벤트 규칙이 이미 존재합니다.');
    }

    return this.prisma.eventRule.create({
      data: {
        ownerUserId: userId,
        eventKey: normalized.eventKey,
        ...this.buildMutationData(normalized, userId)
      }
    });
  }

  async create(ownerUserId: string, userId: string, dto: UpsertEventRuleDto) {
    const normalized = await this.validateUpsertInputForUser(ownerUserId, dto);
    const existing = await this.prisma.eventRule.findFirst({
      where: {
        ownerUserId: ownerUserId,
        eventKey: normalized.eventKey
      }
    });

    if (existing) {
      throw new ConflictException('같은 eventKey를 가진 이벤트 규칙이 이미 존재합니다.');
    }

    return this.prisma.eventRule.create({
      data: {
        ownerUserId: ownerUserId,
        eventKey: normalized.eventKey,
        ...this.buildMutationData(normalized, userId)
      }
    });
  }

  async updateByIdForUser(userId: string, eventRuleId: string, dto: UpsertEventRuleDto) {
    const existingRule = await this.prisma.eventRule.findFirst({
      where: {
        id: eventRuleId,
        ownerUserId: userId
      }
    });

    if (!existingRule) {
      throw new NotFoundException('Event rule not found');
    }

    const normalized = await this.validateUpsertInputForUser(userId, dto);
    const conflictingRule = await this.prisma.eventRule.findFirst({
      where: {
        ownerUserId: userId,
        eventKey: normalized.eventKey
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

  async updateById(ownerUserId: string, userId: string, eventRuleId: string, dto: UpsertEventRuleDto) {
    const existingRule = await this.prisma.eventRule.findFirst({
      where: {
        id: eventRuleId,
        ownerUserId: ownerUserId
      }
    });

    if (!existingRule) {
      throw new NotFoundException('Event rule not found');
    }

    const normalized = await this.validateUpsertInputForUser(ownerUserId, dto);
    const conflictingRule = await this.prisma.eventRule.findFirst({
      where: {
        ownerUserId: ownerUserId,
        eventKey: normalized.eventKey
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

  async upsert(ownerUserId: string, userId: string, dto: UpsertEventRuleDto) {
    const normalized = await this.validateUpsertInputForUser(ownerUserId, dto);
    const existing = await this.prisma.eventRule.findFirst({
      where: {
        ownerUserId: ownerUserId,
        eventKey: normalized.eventKey
      }
    });

    if (existing) {
      if (existing.ownerUserId !== ownerUserId) {
        throw new ConflictException('같은 eventKey를 가진 이벤트 규칙이 이미 존재합니다.');
      }

      return this.prisma.eventRule.update({
        where: { id: existing.id },
        data: {
          ...this.buildMutationData(normalized, userId)
        }
      });
    }

    return this.prisma.eventRule.create({
      data: {
        ownerUserId: ownerUserId,
        eventKey: normalized.eventKey,
        ...this.buildMutationData(normalized, userId)
      }
    });
  }

  async upsertForUser(userId: string, dto: UpsertEventRuleDto) {
    const normalized = await this.validateUpsertInputForUser(userId, dto);
    const existing = await this.prisma.eventRule.findFirst({
      where: {
        ownerUserId: userId,
        eventKey: normalized.eventKey
      }
    });

    if (existing) {
      return this.prisma.eventRule.update({
        where: { id: existing.id },
        data: {
          ...this.buildMutationData(normalized, userId)
        }
      });
    }

    return this.prisma.eventRule.create({
      data: {
        ownerUserId: userId,
        eventKey: normalized.eventKey,
        ...this.buildMutationData(normalized, userId)
      }
    });
  }

  private async validateUpsertInputForUser(ownerUserId: string, dto: UpsertEventRuleDto) {
    const normalized = this.normalizeUpsertDto(dto);
    const bindings = await this.loadBindingsForUser(ownerUserId, normalized);

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
      alimtalkTemplateBindingMode: normalized.alimtalkTemplateBindingMode,
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
      alimtalkTemplateBindingMode: this.normalizeAlimtalkTemplateBindingMode(dto.alimtalkTemplateBindingMode),
      alimtalkSenderProfileId: this.normalizeOptionalId(dto.alimtalkSenderProfileId)
    };
  }

  private normalizeAlimtalkTemplateBindingMode(value?: 'DEFAULT' | 'CUSTOM'): AlimtalkTemplateBindingMode {
    return value === 'DEFAULT' ? AlimtalkTemplateBindingMode.DEFAULT : AlimtalkTemplateBindingMode.CUSTOM;
  }

  private normalizeOptionalId(value?: string): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private async loadBindingsForUser(ownerUserId: string, dto: ReturnType<EventRulesService['normalizeUpsertDto']>) {
    const [smsTemplate, smsSenderNumber, alimtalkProviderTemplate, alimtalkSenderProfile, publEventDefinition] = await Promise.all([
      dto.smsTemplateId
        ? this.prisma.template.findFirst({
            where: {
              id: dto.smsTemplateId,
              ownerUserId: ownerUserId,
              channel: 'SMS'
            }
          })
        : Promise.resolve(null),
      dto.smsSenderNumberId
        ? this.prisma.senderNumber.findFirst({
            where: {
              id: dto.smsSenderNumberId,
              ownerUserId: ownerUserId
            }
          })
        : Promise.resolve(null),
      dto.alimtalkTemplateId
        ? this.prisma.providerTemplate.findFirst({
            where: {
              id: dto.alimtalkTemplateId,
              ownerUserId: ownerUserId,
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
              ownerUserId: ownerUserId
            }
          })
        : Promise.resolve(null),
      dto.alimtalkTemplateBindingMode === AlimtalkTemplateBindingMode.DEFAULT
        ? this.prisma.publEventDefinition.findFirst({
            where: {
              eventKey: dto.eventKey
            }
          })
        : Promise.resolve(null)
    ]);

    return {
      smsTemplate,
      smsSenderNumber,
      alimtalkProviderTemplate,
      alimtalkSenderProfile,
      publEventDefinition
    };
  }

  private validateDefaultAlimtalkTemplate(
    ruleVariables: string[],
    publEventDefinition: Awaited<ReturnType<EventRulesService['loadBindingsForUser']>>['publEventDefinition']
  ) {
    if (!publEventDefinition) {
      throw new ConflictException('기본 템플릿을 사용할 Publ 이벤트를 찾을 수 없습니다.');
    }

    const templateCode =
      publEventDefinition.defaultTemplateCode?.trim() || publEventDefinition.defaultKakaoTemplateCode?.trim();
    const templateBody = publEventDefinition.defaultTemplateBody?.trim();

    if (!templateCode || !templateBody) {
      throw new ConflictException('기본 템플릿이 없는 이벤트는 활성화할 수 없습니다.');
    }

    if (publEventDefinition.defaultTemplateStatus !== 'APR') {
      throw new ConflictException('승인된 기본 템플릿이 있어야 이벤트 자동화를 활성화할 수 있습니다.');
    }

    this.assertVariableMatch('기본 알림톡 템플릿', ruleVariables, extractRequiredVariables(templateBody));
  }

  private validateChannelConfiguration(
    dto: ReturnType<EventRulesService['normalizeUpsertDto']>,
    bindings: Awaited<ReturnType<EventRulesService['loadBindingsForUser']>>
  ) {
    const hasSmsConfig = Boolean(dto.smsTemplateId && dto.smsSenderNumberId);
    const hasPartialSmsConfig = Boolean(dto.smsTemplateId || dto.smsSenderNumberId) && !hasSmsConfig;
    const usesDefaultAlimtalk = dto.alimtalkTemplateBindingMode === AlimtalkTemplateBindingMode.DEFAULT;
    const hasCustomAlimtalkConfig = Boolean(dto.alimtalkTemplateId && dto.alimtalkSenderProfileId);
    const hasDefaultAlimtalkConfig = usesDefaultAlimtalk && Boolean(dto.alimtalkSenderProfileId);
    const hasAlimtalkConfig = usesDefaultAlimtalk ? hasDefaultAlimtalkConfig : hasCustomAlimtalkConfig;
    const hasPartialAlimtalkConfig = usesDefaultAlimtalk
      ? Boolean(dto.alimtalkTemplateId || dto.alimtalkSenderProfileId) && !hasDefaultAlimtalkConfig
      : Boolean(dto.alimtalkTemplateId || dto.alimtalkSenderProfileId) && !hasCustomAlimtalkConfig;
    const ruleVariables = this.normalizeVariables(dto.requiredVariables);

    if (hasPartialSmsConfig) {
      throw new ConflictException('SMS 규칙은 SMS 템플릿과 발신번호를 함께 선택해야 합니다.');
    }

    if (usesDefaultAlimtalk && dto.alimtalkTemplateId) {
      throw new ConflictException('기본 템플릿 사용 규칙은 셀러별 알림톡 템플릿을 함께 선택할 수 없습니다.');
    }

    if (hasPartialAlimtalkConfig) {
      throw new ConflictException(
        usesDefaultAlimtalk
          ? '기본 템플릿 사용 규칙은 카카오 채널이 필요합니다.'
          : '알림톡 규칙은 알림톡 템플릿과 카카오 채널을 함께 선택해야 합니다.'
      );
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

    if (bindings.alimtalkSenderProfile && bindings.alimtalkSenderProfile.status !== SenderProfileStatus.ACTIVE) {
      throw new ConflictException('활성 카카오 채널만 이벤트 자동화에 연결할 수 있습니다.');
    }

    if (usesDefaultAlimtalk) {
      this.validateDefaultAlimtalkTemplate(ruleVariables, bindings.publEventDefinition);
    }

    if (dto.channelStrategy === 'SMS_ONLY' && !hasSmsConfig) {
      throw new ConflictException('SMS_ONLY 규칙은 SMS 템플릿과 발신번호가 필요합니다.');
    }

    if (dto.channelStrategy === 'ALIMTALK_ONLY' && !hasAlimtalkConfig) {
      throw new ConflictException('ALIMTALK_ONLY 규칙은 알림톡 템플릿과 카카오 채널이 필요합니다.');
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

    const defaultTemplateBody = usesDefaultAlimtalk ? bindings.publEventDefinition?.defaultTemplateBody?.trim() : null;
    const alimtalkVariables = bindings.alimtalkProviderTemplate?.template
      ? extractRequiredVariables(bindings.alimtalkProviderTemplate.template.body)
      : defaultTemplateBody
        ? extractRequiredVariables(defaultTemplateBody)
        : null;

    if (bindings.smsTemplate && alimtalkVariables) {
      this.assertTemplatePairMatch(
        'SMS 템플릿',
        extractRequiredVariables(bindings.smsTemplate.body),
        '알림톡 템플릿',
        alimtalkVariables
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
