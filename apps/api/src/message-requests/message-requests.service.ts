import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from '@nestjs/common';
import path from 'path';
import {
  ChannelStrategy,
  MessageChannel,
  MessageAttempt,
  MessageRequest,
  ProviderTemplateStatus,
  TemplateStatus,
  SenderNumberStatus
} from '@prisma/client';
import {
  buildDomesticMmsTitle,
  classifyDomesticSmsBody,
  formatSmsBody,
  missingRequiredVariables,
  MMS_ATTACHMENT_MAX_COUNT,
  MMS_ATTACHMENT_MAX_FILE_SIZE_BYTES,
  MMS_ATTACHMENT_TOTAL_SIZE_BYTES_FOR_THREE,
  sanitizeAdvertisingServiceName
} from '@publ/shared';
import { PrismaService } from '../database/prisma.service';
import { QueueService } from '../queue/queue.service';
import { SmsQuotaService } from '../sms-quota/sms-quota.service';
import {
  CreateManualAlimtalkRequestDto,
  CreateManualBrandMessageRequestDto,
  CreateManualSmsRequestDto,
  CreateMessageRequestDto
} from './message-requests.dto';

interface ResolutionResult {
  channel: MessageChannel;
  senderNumberId?: string;
  senderProfileId?: string;
  templateId?: string;
  providerTemplateId?: string;
}

interface UploadedManualSmsAttachment {
  path: string;
  originalname: string;
  mimetype?: string;
  size: number;
}

interface StoredManualSmsAttachment {
  filePath: string;
  originalName: string;
  mimeType: string | null;
  size: number;
}

type MessageRequestWithHistory = MessageRequest & {
  attempts: MessageAttempt[];
};

@Injectable()
export class MessageRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly smsQuotaService: SmsQuotaService
  ) {}

  async create(dto: CreateMessageRequestDto, idempotencyKey: string): Promise<{ request: MessageRequest; idempotent: boolean }> {
    const scheduledAt = normalizeScheduledAt(dto.scheduledAt);
    const ownerUserId = dto.ownerUserId;
    const existing = await this.prisma.messageRequest.findUnique({
      where: {
        ownerUserId_idempotencyKey: {
          ownerUserId,
          idempotencyKey
        }
      }
    });

    if (existing) {
      return { request: existing, idempotent: true };
    }

    const rule = await this.prisma.eventRule.findFirst({
      where: {
        ownerUserId,
        eventKey: dto.eventKey
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

    const request = await this.prisma.$transaction(async (tx) => {
      const quotaAccountId =
        resolution.channel === MessageChannel.SMS && resolution.senderNumberId
          ? await this.smsQuotaService.resolveQuotaUserId(tx, rule.ownerUserId)
          : null;

      if (resolution.channel === MessageChannel.SMS && resolution.senderNumberId) {
        await this.smsQuotaService.assertCanReserveUsage(tx, rule.ownerUserId, 1, scheduledAt ?? new Date());
      }

      const created = await tx.messageRequest.create({
        data: {
          ownerUserId: rule.ownerUserId,
          eventKey: dto.eventKey,
          idempotencyKey,
          recipientPhone: dto.recipient.phone,
          recipientUserId: dto.recipient.userId,
          variablesJson: dto.variables,
          metadataJson: dto.metadata,
          scheduledAt,
          status: 'ACCEPTED',
          resolvedChannel: resolution.channel,
          resolvedSenderNumberId: resolution.senderNumberId,
          resolvedSenderProfileId: resolution.senderProfileId,
          resolvedTemplateId: resolution.templateId,
          resolvedProviderTemplateId: resolution.providerTemplateId
        }
      });

      if (resolution.channel === MessageChannel.SMS && resolution.senderNumberId) {
        await this.smsQuotaService.reserveUsage(tx, {
          ownerUserId: quotaAccountId!,
          senderNumberId: resolution.senderNumberId,
          messageRequestId: created.id,
          quantity: 1,
          usageAt: scheduledAt ?? new Date()
        });
      }

      return created;
    });

    await this.queueService.enqueueSendMessage(request.id);

    return { request, idempotent: false };
  }

  async createManualSmsForUser(
    userId: string,
    dto: CreateManualSmsRequestDto,
    uploadedAttachments: UploadedManualSmsAttachment[] = []
  ): Promise<MessageRequest> {
    return this.createManualSms(userId, dto, uploadedAttachments);
  }

  async createManualSms(
    userId: string,
    dto: CreateManualSmsRequestDto,
    uploadedAttachments: UploadedManualSmsAttachment[] = []
  ): Promise<MessageRequest> {
    const scheduledAt = normalizeScheduledAt(dto.scheduledAt);
    const senderNumber = await this.prisma.senderNumber.findFirst({
      where: {
        id: dto.senderNumberId,
        ownerUserId: userId,
        status: 'APPROVED'
      }
    });

    if (!senderNumber) {
      throw new ConflictException('Approved sender number is required for direct SMS sending');
    }

    const rawBody = dto.body.trim();
    if (!rawBody) {
      throw new ConflictException('발송 본문을 입력하세요.');
    }

    const advertisingServiceName = sanitizeAdvertisingServiceName(dto.advertisingServiceName);
    const manualBody = formatSmsBody(rawBody, {
      isAdvertisement: dto.isAdvertisement,
      advertisingServiceName
    });
    const attachments = this.normalizeManualSmsAttachments(uploadedAttachments);
    const smsMessageType = classifyDomesticSmsBody(manualBody, {
      hasAttachments: attachments.length > 0
    });

    if (smsMessageType === 'OVER_LIMIT') {
      throw new ConflictException(
        attachments.length > 0
          ? '이미지를 첨부한 MMS 본문은 2,000byte 이하로 입력하세요.'
          : '본문이 SMS/LMS 표준 규격 2,000byte를 초과했습니다.'
      );
    }

    const metadataJson: Record<string, unknown> = {
      mode: 'MANUAL_SMS',
      smsMessageType
    };

    if (attachments.length > 0) {
      metadataJson.smsAttachments = attachments;
      metadataJson.mmsTitle = buildDomesticMmsTitle(manualBody, dto.mmsTitle);
    }

    if (dto.isAdvertisement) {
      metadataJson.smsAdvertisement = {
        enabled: true,
        advertisingServiceName: advertisingServiceName || null
      };
    }

    const usageAt = scheduledAt ?? new Date();
    const request = await this.prisma.$transaction(async (tx) => {
      await this.smsQuotaService.assertCanReserveUsage(tx, userId, 1, usageAt);
      const created = await tx.messageRequest.create({
        data: {
          ownerUserId: userId,
          eventKey: 'MANUAL_SMS_SEND',
          idempotencyKey: `manual_sms_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
          recipientPhone: dto.recipientPhone,
          recipientUserId: null,
          variablesJson: {},
          metadataJson,
          manualBody,
          scheduledAt,
          status: 'ACCEPTED',
          resolvedChannel: MessageChannel.SMS,
          resolvedSenderNumberId: senderNumber.id
        } as any
      });

      await this.smsQuotaService.reserveUsage(tx, {
        ownerUserId: userId,
        senderNumberId: senderNumber.id,
        messageRequestId: created.id,
        quantity: 1,
        usageAt
      });

      return created;
    });

    await this.queueService.enqueueSendMessage(request.id);

    return request;
  }

  async createManualAlimtalkForUser(
    userId: string,
    dto: CreateManualAlimtalkRequestDto
  ): Promise<MessageRequest> {
    return this.createManualAlimtalk(userId, dto);
  }

  async createManualAlimtalk(
    userId: string,
    dto: CreateManualAlimtalkRequestDto
  ): Promise<MessageRequest> {
    const scheduledAt = normalizeScheduledAt(dto.scheduledAt);
    const senderProfile = await this.prisma.senderProfile.findFirst({
      where: {
        id: dto.senderProfileId,
        ownerUserId: userId
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
      mode: 'MANUAL_ALIMTALK'
    };

    if (dto.providerTemplateId) {
      const providerTemplate = await this.prisma.providerTemplate.findFirst({
        where: {
          id: dto.providerTemplateId,
          ownerUserId: userId,
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
    } else if ((dto.templateSource === 'GROUP' || dto.templateSource === 'NHN') && dto.templateCode && dto.templateBody) {
      manualBody = dto.templateBody;
      requiredVariables = this.extractTemplateVariables(dto.templateBody);
      metadataJson = {
        ...metadataJson,
        templateSource: dto.templateSource,
        manualAlimtalkTemplate: {
          source: dto.templateSource,
          templateCode: dto.templateCode,
          templateName: dto.templateName ?? dto.templateCode,
          templateBody: dto.templateBody,
          providerStatus: 'APR',
          requiredVariables
        }
      };
    } else {
      throw new ConflictException('A local APR providerTemplateId or approved NHN templateCode is required');
    }

    const missing = missingRequiredVariables(requiredVariables, dto.variables);

    if (missing.length > 0) {
      throw new UnprocessableEntityException({
        code: 'MISSING_REQUIRED_VARIABLES',
        missing
      });
    }

    if (dto.useSmsFailover) {
      if (!dto.fallbackSenderNumberId) {
        throw new ConflictException('Approved sender number is required for SMS failover');
      }

      const fallbackSenderNumber = await this.prisma.senderNumber.findFirst({
        where: {
          id: dto.fallbackSenderNumberId,
          ownerUserId: userId,
          status: 'APPROVED'
        }
      });

      if (!fallbackSenderNumber) {
        throw new ConflictException('Approved sender number is required for SMS failover');
      }

      metadataJson = {
        ...metadataJson,
        smsFailover: {
          enabled: true,
          senderNumberId: fallbackSenderNumber.id,
          senderNo: fallbackSenderNumber.phoneNumber
        }
      };
    }

    const request = await this.prisma.messageRequest.create({
      data: {
        ownerUserId: userId,
        eventKey: 'MANUAL_ALIMTALK_SEND',
        idempotencyKey: `manual_alimtalk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        recipientPhone: dto.recipientPhone,
        recipientUserId: null,
        variablesJson: dto.variables,
        metadataJson,
        manualBody,
        scheduledAt,
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

  async createManualBrandMessageForUser(
    userId: string,
    dto: CreateManualBrandMessageRequestDto
  ): Promise<MessageRequest> {
    return this.createManualBrandMessage(userId, dto);
  }

  async createManualBrandMessage(
    userId: string,
    dto: CreateManualBrandMessageRequestDto
  ): Promise<MessageRequest> {
    const scheduledAt = normalizeScheduledAt(dto.scheduledAt);

    if (dto.targeting !== 'I') {
      throw new ConflictException('현재는 채널 친구(I 타겟팅) 브랜드 메시지만 지원합니다.');
    }

    const senderProfile = await this.prisma.senderProfile.findFirst({
      where: {
        id: dto.senderProfileId,
        ownerUserId: userId,
        status: 'ACTIVE'
      }
    });

    if (!senderProfile) {
      throw new ConflictException('Active sender profile is required for brand message sending');
    }
    const variables = dto.variables ?? {};
    let manualBody: string | null = null;
    let metadataJson: Record<string, unknown>;

    if (dto.mode === 'TEMPLATE') {
      const templateCode = dto.templateCode?.trim();
      if (!templateCode) {
        throw new ConflictException('브랜드 템플릿 발송에는 templateCode가 필요합니다.');
      }

      const templateBody = dto.templateBody?.trim() || null;
      const requiredVariables = Array.isArray(dto.requiredVariables)
        ? dto.requiredVariables.map((item) => String(item).trim()).filter(Boolean)
        : templateBody
          ? this.extractTemplateVariables(templateBody)
          : [];
      const missing = missingRequiredVariables(requiredVariables, variables);

      if (missing.length > 0) {
        throw new UnprocessableEntityException({
          code: 'MISSING_REQUIRED_VARIABLES',
          missing
        });
      }

      manualBody = templateBody;
      metadataJson = {
        mode: 'MANUAL_BRAND_MESSAGE',
        brandMessage: {
          mode: dto.mode,
          targeting: dto.targeting,
          messageType: dto.messageType ?? null,
          pushAlarm: dto.pushAlarm !== false,
          adult: Boolean(dto.adult),
          statsId: dto.statsEventKey?.trim() || null,
          statsEventKey: dto.statsEventKey?.trim() || null,
          resellerCode: dto.resellerCode?.trim() || null,
          templateCode,
          templateName: dto.templateName?.trim() || templateCode,
          templateBody,
          requiredVariables
        }
      };
    } else {
      const messageType = dto.messageType;
      if (!messageType || !['TEXT', 'IMAGE', 'WIDE'].includes(messageType)) {
        throw new ConflictException('자유형 브랜드 메시지 타입을 선택해 주세요.');
      }

      manualBody = dto.content?.trim() || null;
      if (!manualBody) {
        throw new ConflictException('브랜드 메시지 본문을 입력하세요.');
      }

      if (messageType === 'IMAGE' && manualBody.length > 400) {
        throw new ConflictException('이미지 브랜드 메시지 본문은 400자 이하로 입력하세요.');
      }

      if (messageType === 'WIDE' && manualBody.length > 76) {
        throw new ConflictException('와이드 브랜드 메시지 본문은 76자 이하로 입력하세요.');
      }

      const buttons =
        dto.buttons
          ?.map((button) => ({
            type: button.type,
            name: button.name.trim(),
            linkMo: button.linkMo?.trim() || null,
            linkPc: button.linkPc?.trim() || null,
            schemeIos: button.schemeIos?.trim() || null,
            schemeAndroid: button.schemeAndroid?.trim() || null
          }))
          .filter((button) => button.name) ?? [];

      const buttonLimit = messageType === 'WIDE' ? 2 : 5;
      if (buttons.length > buttonLimit) {
        throw new ConflictException(
          messageType === 'WIDE'
            ? '와이드 브랜드 메시지 버튼은 최대 2개까지 추가할 수 있습니다.'
            : '브랜드 메시지 버튼은 최대 5개까지 추가할 수 있습니다.'
        );
      }

      const normalizedImageLink = dto.image?.imageLink?.trim() || null;
      if (normalizedImageLink && !/^https?:\/\//i.test(normalizedImageLink)) {
        throw new ConflictException('이미지 링크는 http:// 또는 https:// 를 포함해야 합니다.');
      }

      const image =
        dto.image && (dto.image.imageUrl?.trim() || dto.image.imageLink?.trim() || dto.image.assetId?.trim())
          ? {
              assetId: dto.image.assetId?.trim() || null,
              imageUrl: dto.image.imageUrl?.trim() || null,
              imageLink: normalizedImageLink
            }
          : null;

      if (messageType !== 'TEXT') {
        if (!image?.imageUrl) {
          throw new ConflictException('이미지형 브랜드 메시지는 이미지 URL이 필요합니다.');
        }
      }

      if (messageType === 'TEXT' && image?.assetId && !image.imageUrl) {
        throw new ConflictException('이미지 자산 선택 기능은 다음 단계에서 지원합니다.');
      }

      metadataJson = {
        mode: 'MANUAL_BRAND_MESSAGE',
        brandMessage: {
          mode: dto.mode,
          targeting: dto.targeting,
          messageType,
          pushAlarm: dto.pushAlarm !== false,
          adult: Boolean(dto.adult),
          statsId: dto.statsEventKey?.trim() || null,
          statsEventKey: dto.statsEventKey?.trim() || null,
          resellerCode: dto.resellerCode?.trim() || null,
          buttons,
          image
        }
      };
    }

    const request = await this.prisma.messageRequest.create({
      data: {
        ownerUserId: userId,
        eventKey: 'MANUAL_BRAND_MESSAGE_SEND',
        idempotencyKey: `manual_brand_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        recipientPhone: dto.recipientPhone.trim(),
        recipientUserId: null,
        variablesJson: variables,
        metadataJson,
        manualBody,
        scheduledAt,
        status: 'ACCEPTED',
        resolvedChannel: MessageChannel.BRAND_MESSAGE,
        resolvedSenderProfileId: senderProfile.id
      } as any
    });

    await this.queueService.enqueueSendMessage(request.id);

    return request;
  }

  async getById(requestId: string): Promise<MessageRequestWithHistory> {
    const request = await this.prisma.messageRequest.findUnique({
      where: { id: requestId },
      include: {
        attempts: {
          orderBy: { attemptNumber: 'desc' }
        }
      }
    });

    if (!request) {
      throw new NotFoundException('Message request not found');
    }

    return request;
  }

  async getByIdForOwner(
    ownerUserId: string,
    requestId: string
  ): Promise<MessageRequestWithHistory> {
    const request = await this.prisma.messageRequest.findFirst({
      where: {
        id: requestId,
        ownerUserId
      },
      include: {
        attempts: {
          orderBy: { attemptNumber: 'desc' }
        }
      }
    });

    if (!request) {
      throw new NotFoundException('Message request not found');
    }

    return request;
  }

  async getByIdForUser(ownerUserId: string, requestId: string): Promise<MessageRequestWithHistory> {
    const request = await this.prisma.messageRequest.findFirst({
      where: {
        id: requestId,
        ownerUserId
      },
      include: {
        attempts: {
          orderBy: { attemptNumber: 'desc' }
        }
      }
    });

    if (!request) {
      throw new NotFoundException('Message request not found');
    }

    return request;
  }

  async listByOwner(
    ownerUserId: string,
    filters?: { status?: string; eventKey?: string }
  ) {
    return this.prisma.messageRequest.findMany({
      where: {
        ownerUserId,
        ...(filters?.status ? { status: filters.status as never } : {}),
        ...(filters?.eventKey ? { eventKey: filters.eventKey } : {})
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

  private normalizeManualSmsAttachments(files: UploadedManualSmsAttachment[]): StoredManualSmsAttachment[] {
    if (files.length === 0) {
      return [];
    }

    if (files.length > MMS_ATTACHMENT_MAX_COUNT) {
      throw new ConflictException(`이미지는 최대 ${MMS_ATTACHMENT_MAX_COUNT}개까지 첨부할 수 있습니다.`);
    }

    const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
    if (files.length === MMS_ATTACHMENT_MAX_COUNT && totalSize > MMS_ATTACHMENT_TOTAL_SIZE_BYTES_FOR_THREE) {
      throw new ConflictException('이미지가 3개일 때 총 용량은 800KB 이하여야 합니다.');
    }

    return files.map((file) => {
      const extension = path.extname(file.originalname || '').toLowerCase();
      if (!['.jpg', '.jpeg'].includes(extension)) {
        throw new ConflictException('MMS 이미지는 .jpg 또는 .jpeg 파일만 첨부할 수 있습니다.');
      }

      if ((file.size || 0) > MMS_ATTACHMENT_MAX_FILE_SIZE_BYTES) {
        throw new ConflictException('MMS 이미지는 파일당 300KB 이하여야 합니다.');
      }

      return {
        filePath: path.resolve(file.path),
        originalName: file.originalname,
        mimeType: file.mimetype || null,
        size: file.size || 0
      };
    });
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

  async listForUser(ownerUserId: string, filters?: { status?: string; eventKey?: string }) {
    return this.prisma.messageRequest.findMany({
      where: {
        ownerUserId,
        ...(filters?.status ? { status: filters.status as never } : {}),
        ...(filters?.eventKey ? { eventKey: filters.eventKey } : {})
      },
      include: {
        attempts: {
          orderBy: { attemptNumber: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    });
  }
}

function normalizeScheduledAt(value?: string): Date | null {
  if (!value) {
    return null;
  }

  const scheduledAt = new Date(value);
  if (Number.isNaN(scheduledAt.getTime())) {
    throw new BadRequestException('scheduledAt must be a valid ISO 8601 datetime');
  }

  if (scheduledAt.getTime() <= Date.now()) {
    throw new BadRequestException('scheduledAt must be in the future');
  }

  return scheduledAt;
}
