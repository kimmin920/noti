import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from '@nestjs/common';
import {
  ChannelStrategy,
  MessageChannel,
  MessageRequest,
  ProviderTemplateStatus,
  TemplateStatus,
  SenderNumberStatus
} from '@prisma/client';
import { missingRequiredVariables } from '@publ/shared';
import { PrismaService } from '../database/prisma.service';
import { QueueService } from '../queue/queue.service';
import { CreateManualAlimtalkRequestDto, CreateManualSmsRequestDto, CreateMessageRequestDto } from './message-requests.dto';

interface ResolutionResult {
  channel: MessageChannel;
  senderNumberId?: string;
  senderProfileId?: string;
  templateId?: string;
  providerTemplateId?: string;
}

@Injectable()
export class MessageRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService
  ) {}

  async create(dto: CreateMessageRequestDto, idempotencyKey: string): Promise<{ request: MessageRequest; idempotent: boolean }> {
    const existing = await this.prisma.messageRequest.findUnique({
      where: {
        tenantId_idempotencyKey: {
          tenantId: dto.tenantId,
          idempotencyKey
        }
      }
    });

    if (existing) {
      return { request: existing, idempotent: true };
    }

    const rule = await this.prisma.eventRule.findUnique({
      where: {
        tenantId_eventKey: {
          tenantId: dto.tenantId,
          eventKey: dto.eventKey
        }
      },
      include: {
        smsTemplate: true,
        smsSenderNumber: true,
        alimtalkTemplate: {
          include: {
            template: true
          }
        },
        alimtalkSenderProfile: true
      }
    });

    if (!rule || !rule.enabled) {
      throw new NotFoundException('Event rule not found or disabled');
    }

    const requiredVariables = (rule.requiredVariables as string[]) ?? [];
    const missing = missingRequiredVariables(requiredVariables, dto.variables);
    if (missing.length > 0) {
      throw new UnprocessableEntityException({
        code: 'MISSING_REQUIRED_VARIABLES',
        missing
      });
    }

    const resolution = this.resolveChannel(rule.channelStrategy, rule);

    const request = await this.prisma.messageRequest.create({
      data: {
        tenantId: dto.tenantId,
        eventKey: dto.eventKey,
        idempotencyKey,
        recipientPhone: dto.recipient.phone,
        recipientUserId: dto.recipient.userId,
        variablesJson: dto.variables,
        metadataJson: dto.metadata,
        status: 'ACCEPTED',
        resolvedChannel: resolution.channel,
        resolvedSenderNumberId: resolution.senderNumberId,
        resolvedSenderProfileId: resolution.senderProfileId,
        resolvedTemplateId: resolution.templateId,
        resolvedProviderTemplateId: resolution.providerTemplateId
      }
    });

    await this.queueService.enqueueSendMessage(request.id);

    return { request, idempotent: false };
  }

  async createManualSms(tenantId: string, userId: string, dto: CreateManualSmsRequestDto): Promise<MessageRequest> {
    const senderNumber = await this.prisma.senderNumber.findFirst({
      where: {
        id: dto.senderNumberId,
        tenantId,
        status: 'APPROVED'
      }
    });

    if (!senderNumber) {
      throw new ConflictException('Approved sender number is required for direct SMS sending');
    }

    const request = await this.prisma.messageRequest.create({
      data: {
        tenantId,
        eventKey: 'MANUAL_SMS_SEND',
        idempotencyKey: `manual_sms_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        recipientPhone: dto.recipientPhone,
        recipientUserId: null,
        variablesJson: {},
        metadataJson: {
          initiatedBy: userId,
          mode: 'MANUAL_SMS'
        },
        manualBody: dto.body,
        status: 'ACCEPTED',
        resolvedChannel: MessageChannel.SMS,
        resolvedSenderNumberId: senderNumber.id
      } as any
    });

    await this.queueService.enqueueSendMessage(request.id);

    return request;
  }

  async createManualAlimtalk(
    tenantId: string,
    userId: string,
    dto: CreateManualAlimtalkRequestDto
  ): Promise<MessageRequest> {
    const senderProfile = await this.prisma.senderProfile.findFirst({
      where: {
        id: dto.senderProfileId,
        tenantId
      }
    });

    if (!senderProfile) {
      throw new ConflictException('Registered sender profile is required for direct AlimTalk sending');
    }

    let resolvedTemplateId: string | null = null;
    let resolvedProviderTemplateId: string | null = null;
    let manualBody: string | null = null;
    let requiredVariables: string[] = [];
    let metadataJson: Record<string, unknown> = {
      initiatedBy: userId,
      mode: 'MANUAL_ALIMTALK'
    };

    if (dto.providerTemplateId) {
      const providerTemplate = await this.prisma.providerTemplate.findFirst({
        where: {
          id: dto.providerTemplateId,
          tenantId,
          channel: 'ALIMTALK'
        },
        include: {
          template: true
        }
      });

      if (!providerTemplate || providerTemplate.providerStatus !== 'APR') {
        throw new ConflictException('APR-approved AlimTalk template is required for direct AlimTalk sending');
      }

      resolvedTemplateId = providerTemplate.template.id;
      resolvedProviderTemplateId = providerTemplate.id;
      requiredVariables = (providerTemplate.template.requiredVariables as string[]) ?? [];
      metadataJson = {
        ...metadataJson,
        templateSource: 'LOCAL'
      };
    } else if (dto.templateSource === 'GROUP' && dto.templateCode && dto.templateBody) {
      manualBody = dto.templateBody;
      requiredVariables = this.extractTemplateVariables(dto.templateBody);
      metadataJson = {
        ...metadataJson,
        templateSource: 'GROUP',
        manualAlimtalkTemplate: {
          source: 'GROUP',
          templateCode: dto.templateCode,
          templateName: dto.templateName ?? dto.templateCode,
          templateBody: dto.templateBody,
          providerStatus: 'APR',
          requiredVariables
        }
      };
    } else {
      throw new ConflictException('A local APR providerTemplateId or approved group templateCode is required');
    }

    const missing = missingRequiredVariables(requiredVariables, dto.variables);

    if (missing.length > 0) {
      throw new UnprocessableEntityException({
        code: 'MISSING_REQUIRED_VARIABLES',
        missing
      });
    }

    const request = await this.prisma.messageRequest.create({
      data: {
        tenantId,
        eventKey: 'MANUAL_ALIMTALK_SEND',
        idempotencyKey: `manual_alimtalk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        recipientPhone: dto.recipientPhone,
        recipientUserId: null,
        variablesJson: dto.variables,
        metadataJson,
        manualBody,
        status: 'ACCEPTED',
        resolvedChannel: MessageChannel.ALIMTALK,
        resolvedSenderProfileId: senderProfile.id,
        resolvedTemplateId,
        resolvedProviderTemplateId
      } as any
    });

    await this.queueService.enqueueSendMessage(request.id);

    return request;
  }

  async getById(requestId: string): Promise<MessageRequest> {
    const request = await this.prisma.messageRequest.findUnique({
      where: { id: requestId },
      include: {
        attempts: {
          orderBy: { attemptNumber: 'desc' }
        },
        deliveryResults: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!request) {
      throw new NotFoundException('Message request not found');
    }

    return request;
  }

  async getByIdForTenant(tenantId: string, requestId: string): Promise<MessageRequest> {
    const request = await this.prisma.messageRequest.findFirst({
      where: {
        id: requestId,
        tenantId
      },
      include: {
        attempts: {
          orderBy: { attemptNumber: 'desc' }
        },
        deliveryResults: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!request) {
      throw new NotFoundException('Message request not found');
    }

    return request;
  }

  async listByTenant(tenantId: string, filters?: { status?: string; eventKey?: string }) {
    return this.prisma.messageRequest.findMany({
      where: {
        tenantId,
        ...(filters?.status ? { status: filters.status as never } : {}),
        ...(filters?.eventKey ? { eventKey: filters.eventKey } : {})
      },
      include: {
        deliveryResults: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    });
  }

  private resolveChannel(
    strategy: ChannelStrategy,
    rule: {
      smsTemplate: { id: string; status: TemplateStatus } | null;
      smsSenderNumber: { id: string; status: SenderNumberStatus } | null;
      alimtalkTemplate:
        | {
            id: string;
            providerStatus: ProviderTemplateStatus;
            template: { id: string };
          }
        | null;
      alimtalkSenderProfile: { id: string } | null;
    }
  ): ResolutionResult {
    const hasApprovedAlimtalk =
      rule.alimtalkTemplate?.providerStatus === 'APR' && rule.alimtalkSenderProfile !== null;
    const hasSms =
      rule.smsTemplate?.status === 'PUBLISHED' &&
      rule.smsSenderNumber?.status === 'APPROVED';

    if (strategy === 'SMS_ONLY') {
      if (!hasSms || !rule.smsTemplate || !rule.smsSenderNumber) {
        throw new ConflictException('SMS rule is not publish-ready');
      }

      return {
        channel: MessageChannel.SMS,
        senderNumberId: rule.smsSenderNumber.id,
        templateId: rule.smsTemplate.id
      };
    }

    if (strategy === 'ALIMTALK_ONLY') {
      if (!hasApprovedAlimtalk || !rule.alimtalkTemplate || !rule.alimtalkSenderProfile) {
        throw new ConflictException({
          code: 'ALIMTALK_TEMPLATE_NOT_APPROVED',
          message: 'ALIMTALK_ONLY requires APR-approved provider template'
        });
      }

      return {
        channel: MessageChannel.ALIMTALK,
        senderProfileId: rule.alimtalkSenderProfile.id,
        templateId: rule.alimtalkTemplate.template.id,
        providerTemplateId: rule.alimtalkTemplate.id
      };
    }

    if (hasApprovedAlimtalk && rule.alimtalkTemplate && rule.alimtalkSenderProfile) {
      return {
        channel: MessageChannel.ALIMTALK,
        senderProfileId: rule.alimtalkSenderProfile.id,
        templateId: rule.alimtalkTemplate.template.id,
        providerTemplateId: rule.alimtalkTemplate.id
      };
    }

    if (!hasSms || !rule.smsTemplate || !rule.smsSenderNumber) {
      throw new ConflictException('ALIMTALK fallback to SMS failed because SMS is not ready');
    }

    return {
      channel: MessageChannel.SMS,
      senderNumberId: rule.smsSenderNumber.id,
      templateId: rule.smsTemplate.id
    };
  }

  private extractTemplateVariables(body: string): string[] {
    const matches = [
      ...Array.from(body.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)),
      ...Array.from(body.matchAll(/#\{\s*([^}]+?)\s*\}/g))
    ]
      .map((match) => match[1]?.trim())
      .filter(Boolean) as string[];

    return [...new Set(matches)];
  }
}
