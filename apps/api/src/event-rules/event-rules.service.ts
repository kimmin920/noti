import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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
        alimtalkTemplate: true,
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
        alimtalkTemplate: true,
        smsSenderNumber: true,
        alimtalkSenderProfile: true
      }
    });

    if (!row) {
      throw new NotFoundException('Event rule not found');
    }

    return row;
  }

  async upsert(tenantId: string, userId: string, dto: UpsertEventRuleDto) {
    if (dto.messagePurpose !== 'NORMAL') {
      throw new ConflictException('MVP supports NORMAL messagePurpose only');
    }

    if (dto.channelStrategy !== 'SMS_ONLY' && dto.alimtalkTemplateId) {
      const providerTemplate = await this.prisma.providerTemplate.findFirst({
        where: {
          id: dto.alimtalkTemplateId,
          tenantId
        }
      });

      if (!providerTemplate || providerTemplate.providerStatus !== 'APR') {
        throw new ConflictException('ALIMTALK template must be APR to bind event rule');
      }
    }

    return this.prisma.eventRule.upsert({
      where: {
        tenantId_eventKey: {
          tenantId,
          eventKey: dto.eventKey
        }
      },
      update: {
        displayName: dto.displayName,
        enabled: dto.enabled,
        channelStrategy: dto.channelStrategy,
        messagePurpose: dto.messagePurpose,
        requiredVariables: dto.requiredVariables,
        smsTemplateId: dto.smsTemplateId,
        smsSenderNumberId: dto.smsSenderNumberId,
        alimtalkTemplateId: dto.alimtalkTemplateId,
        alimtalkSenderProfileId: dto.alimtalkSenderProfileId,
        updatedBy: userId
      },
      create: {
        tenantId,
        eventKey: dto.eventKey,
        displayName: dto.displayName,
        enabled: dto.enabled,
        channelStrategy: dto.channelStrategy,
        messagePurpose: dto.messagePurpose,
        requiredVariables: dto.requiredVariables,
        smsTemplateId: dto.smsTemplateId,
        smsSenderNumberId: dto.smsSenderNumberId,
        alimtalkTemplateId: dto.alimtalkTemplateId,
        alimtalkSenderProfileId: dto.alimtalkSenderProfileId,
        updatedBy: userId
      }
    });
  }
}
