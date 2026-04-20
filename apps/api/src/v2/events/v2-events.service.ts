import { Injectable } from '@nestjs/common';
import { MessageChannel, ProviderTemplateStatus, TemplateStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { UpsertEventRuleDto } from '../../event-rules/event-rules.dto';
import { EventRulesService } from '../../event-rules/event-rules.service';
import { V2ReadinessService } from '../shared/v2-readiness.service';

@Injectable()
export class V2EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly readinessService: V2ReadinessService,
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
              name: true
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
            providerStatus: rule.alimtalkTemplate.providerStatus,
            senderProfileId: rule.alimtalkSenderProfile.id,
            plusFriendId: rule.alimtalkSenderProfile.plusFriendId,
            senderKey: rule.alimtalkSenderProfile.senderKey
          }
        : null
    };
  }
}
