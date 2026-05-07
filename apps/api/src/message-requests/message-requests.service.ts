import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from '@nestjs/common';
import path from 'path';
import {
  AlimtalkTemplateBindingMode,
  ChannelStrategy,
  MessageChannel,
  MessageAttempt,
  MessageRequest,
  ProviderTemplateStatus,
  SenderProfileStatus,
  TemplateStatus,
  SenderNumberStatus
} from '@prisma/client';
import {
  buildDomesticMmsTitle,
  classifyDomesticSmsBody,
  extractRequiredVariables,
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
  CreatePublEventRequestDto,
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
  retryOfRequest?: MessageRequest | null;
  retryRequests?: MessageRequest[];
};

type PublEventPropDefinitionShape = {
  rawPath: string;
  alias: string;
  label: string;
  fallback: string | null;
  parserPipeline: unknown;
  enabled: boolean;
};

type DefaultPublEventShape = {
  eventKey: string;
  defaultTemplateName: string | null;
  defaultTemplateCode: string | null;
  defaultKakaoTemplateCode: string | null;
  defaultTemplateStatus: string | null;
  defaultTemplateBody: string | null;
};

const RETRYABLE_MESSAGE_STATUSES = new Set(['SEND_FAILED', 'DELIVERY_FAILED', 'DEAD']);

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

    const defaultPublEvent =
      rule.alimtalkTemplateBindingMode === AlimtalkTemplateBindingMode.DEFAULT
        ? await this.prisma.publEventDefinition.findFirst({
            where: {
              eventKey: dto.eventKey
            }
          })
        : null;
    const requiredVariables = this.resolveRequiredVariables(rule, defaultPublEvent);
    const missing = missingRequiredVariables(requiredVariables, dto.variables);
    if (missing.length > 0) {
      throw new UnprocessableEntityException({
        code: 'MISSING_REQUIRED_VARIABLES',
        missing
      });
    }

    const resolution = await this.resolveChannel(rule.channelStrategy, rule, defaultPublEvent);

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

  async createFromPublEvent(
    dto: CreatePublEventRequestDto,
    idempotencyKey: string
  ): Promise<{ request: MessageRequest; idempotent: boolean }> {
    const partnerKey = (dto.partnerKey?.trim() || 'PUBL').toUpperCase();
    if (partnerKey !== 'PUBL') {
      throw new BadRequestException('partnerKey must be PUBL');
    }

    const providerUserId = dto.providerUserId.trim();
    const owner = await this.prisma.adminUser.findUnique({
      where: { providerUserId },
      select: {
        id: true,
        accessOrigin: true
      }
    });

    if (!owner || owner.accessOrigin !== 'PUBL') {
      throw new NotFoundException('Publ account not found');
    }

    const eventKey = dto.eventKey.trim();
    const eventDefinition = await this.prisma.publEventDefinition.findFirst({
      where: { eventKey },
      include: {
        props: {
          orderBy: [{ sortOrder: 'asc' }, { rawPath: 'asc' }]
        }
      }
    });

    if (!eventDefinition) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'PUBL_EVENT_NOT_FOUND',
        message: 'Publ 이벤트를 찾을 수 없습니다.',
        eventKey
      });
    }

    if (eventDefinition.serviceStatus !== 'ACTIVE') {
      throw new ConflictException({
        statusCode: 409,
        code: 'PUBL_EVENT_INACTIVE',
        message: '비활성화된 Publ 이벤트라 발송 요청을 접수할 수 없습니다.',
        eventKey,
        serviceStatus: eventDefinition.serviceStatus
      });
    }

    const variables = this.buildPublEventVariables(dto.props, eventDefinition.props);
    const recipientPhone = this.normalizePublVariableValue(variables.targetPhoneNumber)?.toString().trim();

    if (!recipientPhone) {
      throw new UnprocessableEntityException({
        code: 'MISSING_RECIPIENT_PHONE',
        missing: ['targetPhoneNumber']
      });
    }

    return this.createAcceptedPublEventRequest(
      {
        ownerUserId: owner.id,
        eventKey,
        eventDefinition,
        recipient: {
          phone: recipientPhone,
          userId: this.normalizePublVariableValue(variables.targetId)?.toString()
        },
        variables,
        metadata: {
          partnerKey,
          providerUserId,
          ...this.toPrimitiveRecord(dto.metadata ?? {})
        },
        scheduledAt: dto.scheduledAt
      },
      idempotencyKey
    );
  }

  async retryForUser(ownerUserId: string, requestId: string): Promise<MessageRequest> {
    const requested = await this.prisma.messageRequest.findFirst({
      where: {
        id: requestId,
        ownerUserId
      },
      include: {
        retryRequests: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!requested) {
      throw new NotFoundException('Message request not found');
    }

    if (!RETRYABLE_MESSAGE_STATUSES.has(requested.status)) {
      throw new ConflictException('실패로 종료된 발송 요청만 재발송할 수 있습니다.');
    }

    if (requested.resolvedChannel !== MessageChannel.ALIMTALK) {
      throw new ConflictException('현재는 알림톡 실패 로그만 재발송할 수 있습니다.');
    }

    const rootRequestId = requested.retryOfRequestId ?? requested.id;
    const rootRequest =
      rootRequestId === requested.id
        ? requested
        : await this.prisma.messageRequest.findFirst({
            where: {
              id: rootRequestId,
              ownerUserId
            },
            include: {
              retryRequests: {
                orderBy: { createdAt: 'desc' },
                take: 1
              }
            }
          });

    if (!rootRequest) {
      throw new NotFoundException('Original message request not found');
    }

    const latestRetry = rootRequest.retryRequests?.[0] ?? null;
    if (latestRetry && !RETRYABLE_MESSAGE_STATUSES.has(latestRetry.status)) {
      throw new ConflictException('이미 재발송된 요청입니다.');
    }

    const variables = this.toPrimitiveRecord((requested.variablesJson ?? {}) as Record<string, unknown>);
    const baseMetadata =
      requested.metadataJson && typeof requested.metadataJson === 'object' && !Array.isArray(requested.metadataJson)
        ? (requested.metadataJson as Record<string, unknown>)
        : {};
    const metadata = {
      ...baseMetadata,
      retryOfRequestId: rootRequestId,
      retryRequestedAt: new Date().toISOString()
    };
    const idempotencyKey = this.buildRetryIdempotencyKey(rootRequestId);
    const eventDefinition = await this.prisma.publEventDefinition.findFirst({
      where: { eventKey: requested.eventKey },
      include: {
        props: {
          orderBy: [{ sortOrder: 'asc' }, { rawPath: 'asc' }]
        }
      }
    });

    if (eventDefinition) {
      if (eventDefinition.serviceStatus !== 'ACTIVE') {
        throw new ConflictException({
          code: 'PUBL_EVENT_INACTIVE',
          message: '비활성화된 Publ 이벤트라 재발송할 수 없습니다.',
          eventKey: requested.eventKey,
          serviceStatus: eventDefinition.serviceStatus
        });
      }

      const result = await this.createAcceptedPublEventRequest(
        {
          ownerUserId,
          eventKey: requested.eventKey,
          eventDefinition,
          recipient: {
            phone: requested.recipientPhone,
            userId: requested.recipientUserId ?? undefined
          },
          variables,
          metadata,
          retryOfRequestId: rootRequestId
        },
        idempotencyKey
      );

      return result.request;
    }

    const request = await this.prisma.messageRequest.create({
      data: {
        ownerUserId,
        eventKey: requested.eventKey,
        idempotencyKey,
        recipientPhone: requested.recipientPhone,
        recipientUserId: requested.recipientUserId,
        variablesJson: variables,
        metadataJson: metadata as never,
        manualBody: requested.manualBody,
        scheduledAt: null,
        status: 'ACCEPTED',
        resolvedChannel: requested.resolvedChannel,
        resolvedSenderProfileId: requested.resolvedSenderProfileId,
        resolvedTemplateId: requested.resolvedTemplateId,
        resolvedProviderTemplateId: requested.resolvedProviderTemplateId,
        retryOfRequestId: rootRequestId
      }
    });

    await this.queueService.enqueueSendMessage(request.id);

    return request;
  }

  private async createAcceptedPublEventRequest(
    input: {
      ownerUserId: string;
      eventKey: string;
      eventDefinition: DefaultPublEventShape;
      recipient: {
        phone: string;
        userId?: string;
      };
      variables: Record<string, string | number>;
      metadata: Record<string, unknown>;
      scheduledAt?: string;
      retryOfRequestId?: string;
    },
    idempotencyKey: string
  ): Promise<{ request: MessageRequest; idempotent: boolean }> {
    const scheduledAt = normalizeScheduledAt(input.scheduledAt);
    const existing = await this.prisma.messageRequest.findUnique({
      where: {
        ownerUserId_idempotencyKey: {
          ownerUserId: input.ownerUserId,
          idempotencyKey
        }
      }
    });

    if (existing) {
      return { request: existing, idempotent: true };
    }

    const rule = await this.prisma.eventRule.findFirst({
      where: {
        ownerUserId: input.ownerUserId,
        eventKey: input.eventKey
      },
      include: {
        alimtalkTemplate: {
          include: {
            template: true
          }
        },
        alimtalkSenderProfile: true
      }
    });
    const activeSenderProfile = await this.resolvePublAlimtalkSenderProfile(input.ownerUserId, rule?.alimtalkSenderProfile ?? null);
    const alimtalkTemplateBindingMode = rule?.alimtalkTemplateBindingMode ?? AlimtalkTemplateBindingMode.CUSTOM;
    let providerTemplate: {
      id: string;
      providerStatus: ProviderTemplateStatus;
      template: {
        id: string;
        body: string;
        requiredVariables: unknown;
      };
    } | null = null;
    let failure: { code: string; message: string } | null = null;

    try {
      providerTemplate =
        alimtalkTemplateBindingMode === AlimtalkTemplateBindingMode.CUSTOM && rule?.alimtalkTemplate
          ? rule.alimtalkTemplate
          : await this.upsertDefaultAlimtalkProviderTemplate(input.ownerUserId, input.eventDefinition);
    } catch (error) {
      failure = this.mapPublDefaultTemplateFailure(error);
      if (!failure) {
        throw error;
      }
    }

    const requiredVariables = providerTemplate ? getTemplateRequiredVariables(providerTemplate.template) : [];
    const missing = providerTemplate ? missingRequiredVariables(requiredVariables, input.variables) : [];

    if (missing.length > 0) {
      throw new UnprocessableEntityException({
        code: 'MISSING_REQUIRED_VARIABLES',
        missing
      });
    }

    failure =
      failure ??
      (providerTemplate?.providerStatus !== ProviderTemplateStatus.APR
        ? {
            code: 'ALIMTALK_TEMPLATE_NOT_APPROVED',
            message: '승인된 알림톡 템플릿이 아니라 발송할 수 없습니다.'
          }
        : !activeSenderProfile
          ? {
              code: 'KAKAO_SENDER_PROFILE_REQUIRED',
              message: '카카오 채널이 연결되지 않아 발송하지 못했습니다.'
            }
          : null);

    const request = await this.prisma.messageRequest.create({
      data: {
        ownerUserId: input.ownerUserId,
        eventKey: input.eventKey,
        idempotencyKey,
        recipientPhone: input.recipient.phone,
        recipientUserId: input.recipient.userId,
        variablesJson: input.variables,
        metadataJson: input.metadata as never,
        scheduledAt,
        status: failure ? 'SEND_FAILED' : 'ACCEPTED',
        resolvedChannel: MessageChannel.ALIMTALK,
        resolvedSenderProfileId: activeSenderProfile?.id ?? null,
        resolvedTemplateId: providerTemplate?.template.id ?? null,
        resolvedProviderTemplateId: providerTemplate?.id ?? null,
        lastErrorCode: failure?.code ?? null,
        lastErrorMessage: failure?.message ?? null,
        retryOfRequestId: input.retryOfRequestId ?? null
      }
    });

    if (!failure) {
      await this.queueService.enqueueSendMessage(request.id);
    }

    return { request, idempotent: false };
  }

  private mapPublDefaultTemplateFailure(error: unknown) {
    if (!(error instanceof ConflictException)) {
      return null;
    }

    const response = error.getResponse();
    if (!response || typeof response !== 'object') {
      return null;
    }

    const code = String((response as { code?: unknown }).code ?? '');
    if (code !== 'PUBL_EVENT_DEFAULT_TEMPLATE_REQUIRED' && code !== 'PUBL_EVENT_DEFAULT_TEMPLATE_NOT_APPROVED') {
      return null;
    }

    const message = (response as { message?: unknown }).message;
    return {
      code,
      message: typeof message === 'string' ? message : '기본 템플릿 설정 때문에 발송하지 못했습니다.'
    };
  }

  private async resolvePublAlimtalkSenderProfile(
    ownerUserId: string,
    preferredSenderProfile: { id: string; status: SenderProfileStatus } | null
  ) {
    if (preferredSenderProfile?.status === SenderProfileStatus.ACTIVE) {
      return preferredSenderProfile;
    }

    return this.prisma.senderProfile.findFirst({
      where: {
        ownerUserId,
        status: SenderProfileStatus.ACTIVE
      },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
    });
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
        },
        retryOfRequest: true,
        retryRequests: {
          orderBy: { createdAt: 'desc' },
          take: 5
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

  private resolveRequiredVariables(
    rule: {
      requiredVariables: unknown;
      alimtalkTemplateBindingMode: AlimtalkTemplateBindingMode;
    },
    defaultPublEvent: DefaultPublEventShape | null
  ) {
    if (rule.alimtalkTemplateBindingMode === AlimtalkTemplateBindingMode.DEFAULT) {
      return extractRequiredVariables(this.getDefaultTemplateSnapshot(defaultPublEvent).body);
    }

    return (rule.requiredVariables as string[]) ?? [];
  }

  private getDefaultTemplateSnapshot(event: DefaultPublEventShape | null) {
    if (!event) {
      throw new ConflictException({
        code: 'PUBL_EVENT_DEFAULT_TEMPLATE_REQUIRED',
        message: '기본 템플릿이 없는 이벤트는 발송할 수 없습니다.'
      });
    }

    const templateCode = event.defaultTemplateCode?.trim() || event.defaultKakaoTemplateCode?.trim();
    const body = event.defaultTemplateBody?.trim();

    if (!templateCode || !body) {
      throw new ConflictException({
        code: 'PUBL_EVENT_DEFAULT_TEMPLATE_REQUIRED',
        message: '기본 템플릿이 없는 이벤트는 발송할 수 없습니다.'
      });
    }

    if (event.defaultTemplateStatus !== 'APR') {
      throw new ConflictException({
        code: 'PUBL_EVENT_DEFAULT_TEMPLATE_NOT_APPROVED',
        message: '승인된 기본 템플릿이 있어야 발송할 수 있습니다.'
      });
    }

    return {
      name: event.defaultTemplateName?.trim() || templateCode,
      templateCode,
      kakaoTemplateCode: event.defaultKakaoTemplateCode?.trim() || null,
      body
    };
  }

  private upsertDefaultAlimtalkProviderTemplate(ownerUserId: string, event: DefaultPublEventShape | null) {
    const snapshot = this.getDefaultTemplateSnapshot(event);
    const requiredVariables = extractRequiredVariables(snapshot.body);
    const nhnTemplateId = `publ-default:${event!.eventKey}:${snapshot.templateCode}`;

    return this.prisma.$transaction(async (tx) => {
      const existingProviderTemplate = await tx.providerTemplate.findFirst({
        where: {
          ownerUserId,
          channel: MessageChannel.ALIMTALK,
          nhnTemplateId
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
            name: snapshot.name,
            body: snapshot.body,
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
            templateCode: snapshot.templateCode,
            kakaoTemplateCode: snapshot.kakaoTemplateCode,
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
          name: snapshot.name,
          body: snapshot.body,
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
          nhnTemplateId,
          templateCode: snapshot.templateCode,
          kakaoTemplateCode: snapshot.kakaoTemplateCode,
          lastSyncedAt: new Date()
        },
        include: {
          template: true
        }
      });
    });
  }

  private async resolveChannel(
    strategy: ChannelStrategy,
    rule: {
      ownerUserId: string;
      smsTemplate: { id: string; status: TemplateStatus } | null;
      smsSenderNumber: { id: string; status: SenderNumberStatus } | null;
      alimtalkTemplateBindingMode: AlimtalkTemplateBindingMode;
      alimtalkTemplate:
        | {
            id: string;
            providerStatus: ProviderTemplateStatus;
            template: { id: string };
          }
        | null;
      alimtalkSenderProfile: { id: string; status: SenderProfileStatus } | null;
    },
    defaultPublEvent: DefaultPublEventShape | null
  ): Promise<ResolutionResult> {
    if (
      rule.alimtalkTemplateBindingMode === AlimtalkTemplateBindingMode.DEFAULT &&
      rule.alimtalkSenderProfile?.status !== SenderProfileStatus.ACTIVE
    ) {
      throw new ConflictException({
        code: 'KAKAO_SENDER_PROFILE_REQUIRED',
        message: '활성 카카오 채널이 있어야 기본 템플릿으로 발송할 수 있습니다.'
      });
    }

    const defaultAlimtalkTemplate =
      rule.alimtalkTemplateBindingMode === AlimtalkTemplateBindingMode.DEFAULT
        ? await this.upsertDefaultAlimtalkProviderTemplate(rule.ownerUserId, defaultPublEvent)
        : null;
    const alimtalkTemplate = defaultAlimtalkTemplate ?? rule.alimtalkTemplate;
    const hasApprovedAlimtalk =
      alimtalkTemplate?.providerStatus === 'APR' &&
      rule.alimtalkSenderProfile?.status === SenderProfileStatus.ACTIVE;
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
      if (!hasApprovedAlimtalk || !alimtalkTemplate || !rule.alimtalkSenderProfile) {
        throw new ConflictException({
          code: 'ALIMTALK_TEMPLATE_NOT_APPROVED',
          message: 'ALIMTALK_ONLY requires APR-approved provider template'
        });
      }

      return {
        channel: MessageChannel.ALIMTALK,
        senderProfileId: rule.alimtalkSenderProfile.id,
        templateId: alimtalkTemplate.template.id,
        providerTemplateId: alimtalkTemplate.id
      };
    }

    if (hasApprovedAlimtalk && alimtalkTemplate && rule.alimtalkSenderProfile) {
      return {
        channel: MessageChannel.ALIMTALK,
        senderProfileId: rule.alimtalkSenderProfile.id,
        templateId: alimtalkTemplate.template.id,
        providerTemplateId: alimtalkTemplate.id
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

  private buildPublEventVariables(
    props: Record<string, unknown>,
    definitions: PublEventPropDefinitionShape[]
  ): Record<string, string | number> {
    const variables = this.toPrimitiveRecord(props);

    for (const prop of definitions) {
      if (!prop.enabled) {
        continue;
      }

      const rawValue = this.readPublPath(props, prop.rawPath);
      const sourceValue = this.isMissingPublParserValue(rawValue) ? prop.fallback : rawValue;
      const parsedValue = this.applyPublParserPipeline(sourceValue, prop.parserPipeline, props);
      const value = this.normalizePublVariableValue(
        this.isMissingPublParserValue(parsedValue) ? prop.fallback : parsedValue
      );
      if (value === undefined) {
        continue;
      }

      this.assignPublVariable(variables, prop.alias, value);
      this.assignPublVariable(variables, this.labelToPublVariable(prop.label), value);
    }

    return variables;
  }

  private applyPublParserPipeline(value: unknown, parserPipeline: unknown, root: Record<string, unknown>): unknown {
    if (!Array.isArray(parserPipeline) || parserPipeline.length === 0) {
      return value;
    }

    return parserPipeline.reduce((current, step) => {
      if (!step || typeof step !== 'object' || Array.isArray(step)) {
        return current;
      }

      return this.applyPublParserStep(current, step as Record<string, unknown>, root);
    }, value);
  }

  private applyPublParserStep(value: unknown, step: Record<string, unknown>, root: Record<string, unknown>): unknown {
    switch (step.type) {
      case 'none':
        return value;
      case 'fallback':
        return this.isMissingPublParserValue(value) ? step.value ?? step.fallback ?? step.defaultValue : value;
      case 'firstItem':
        return Array.isArray(value) ? value[0] : value;
      case 'mapTemplate':
        return this.applyPublMapTemplate(value, typeof step.template === 'string' ? step.template : '', root);
      case 'join':
        return Array.isArray(value)
          ? value
              .map((item) => this.normalizePublVariableValue(item))
              .filter((item): item is string | number => item !== undefined)
              .map(String)
              .join(typeof step.separator === 'string' ? step.separator : '')
          : value;
      case 'dateFormat':
        return this.formatPublDate(value, step);
      case 'currencyFormat':
        return this.formatPublCurrency(value, step, root);
      case 'phoneFormat':
        return this.formatPublPhone(value);
      case 'truncate':
        return this.truncatePublValue(value, step);
      case 'replace':
        return this.replacePublValue(value, step);
      default:
        return value;
    }
  }

  private applyPublMapTemplate(value: unknown, template: string, root: Record<string, unknown>): unknown {
    if (!template) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.renderPublParserTemplate(template, item, root));
    }

    return this.renderPublParserTemplate(template, value, root);
  }

  private renderPublParserTemplate(template: string, local: unknown, root: Record<string, unknown>): string {
    return template.replace(/\{\{\s*([^}]+?)\s*\}\}|#\{\s*([^}]+?)\s*\}/g, (_, mustacheKey: string | undefined, hashKey: string | undefined) => {
      const key = (mustacheKey ?? hashKey ?? '').trim();
      const localValue =
        local && typeof local === 'object' && !Array.isArray(local)
          ? this.readPublPath(local as Record<string, unknown>, key)
          : undefined;
      const rootValue = localValue === undefined ? this.readPublPath(root, key) : localValue;
      const normalized = this.normalizePublVariableValue(rootValue);
      return normalized === undefined ? '' : String(normalized);
    });
  }

  private formatPublDate(value: unknown, step: Record<string, unknown>): unknown {
    const source = this.normalizePublVariableValue(value);
    if (source === undefined) {
      return value;
    }

    const date = new Date(source);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    const timeZone = typeof step.timezone === 'string' ? step.timezone : 'Asia/Seoul';
    const format = typeof step.format === 'string' ? step.format : 'yyyy년 M월 d일 HH:mm';
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    });
    const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
    const values: Record<string, string> = {
      yyyy: parts.year,
      MM: parts.month,
      M: String(Number(parts.month)),
      dd: parts.day,
      d: String(Number(parts.day)),
      HH: parts.hour,
      mm: parts.minute
    };

    return format.replace(/yyyy|MM|dd|HH|mm|M|d/g, (token) => values[token] ?? token);
  }

  private formatPublCurrency(value: unknown, step: Record<string, unknown>, root: Record<string, unknown>): unknown {
    const source = this.normalizePublVariableValue(value);
    if (source === undefined) {
      return value;
    }

    const amount = typeof source === 'number' ? source : Number(String(source).replace(/,/g, ''));
    if (!Number.isFinite(amount)) {
      return value;
    }

    const locale = typeof step.locale === 'string' ? step.locale : 'ko-KR';
    const currency =
      typeof step.currency === 'string'
        ? step.currency
        : typeof step.currencyPath === 'string'
          ? this.normalizePublVariableValue(this.readPublPath(root, step.currencyPath))?.toString()
          : undefined;

    if (!currency) {
      return new Intl.NumberFormat(locale).format(amount);
    }

    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency
      }).format(amount);
    } catch {
      return `${new Intl.NumberFormat(locale).format(amount)} ${currency}`;
    }
  }

  private formatPublPhone(value: unknown): unknown {
    const source = this.normalizePublVariableValue(value);
    if (source === undefined) {
      return value;
    }

    const digits = String(source).replace(/\D/g, '');
    if (/^010\d{8}$/.test(digits)) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    }

    if (/^02\d{7,8}$/.test(digits)) {
      return digits.length === 9
        ? `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`
        : `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    }

    if (/^0\d{9,10}$/.test(digits)) {
      return digits.length === 10
        ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
        : `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    }

    return source;
  }

  private truncatePublValue(value: unknown, step: Record<string, unknown>): unknown {
    const source = this.normalizePublVariableValue(value);
    const maxLength = Number(step.maxLength ?? step.length);

    if (source === undefined || !Number.isInteger(maxLength) || maxLength < 0) {
      return value;
    }

    return String(source).slice(0, maxLength);
  }

  private replacePublValue(value: unknown, step: Record<string, unknown>): unknown {
    const source = this.normalizePublVariableValue(value);
    const from = typeof step.from === 'string' ? step.from : null;
    const to = typeof step.to === 'string' ? step.to : '';

    if (source === undefined || !from) {
      return value;
    }

    return String(source).split(from).join(to);
  }

  private assignPublVariable(target: Record<string, string | number>, key: string | null | undefined, value: string | number) {
    const normalizedKey = key?.trim();
    if (normalizedKey) {
      target[normalizedKey] = value;
    }
  }

  private toPrimitiveRecord(source: Record<string, unknown>): Record<string, string | number> {
    const result: Record<string, string | number> = {};

    for (const [key, value] of Object.entries(source)) {
      const normalized = this.normalizePublVariableValue(value);
      if (normalized !== undefined) {
        result[key] = normalized;
      }
    }

    return result;
  }

  private buildRetryIdempotencyKey(requestId: string) {
    return `retry_${requestId}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private normalizePublVariableValue(value: unknown): string | number | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'boolean') {
      return String(value);
    }

    return undefined;
  }

  private isMissingPublParserValue(value: unknown): boolean {
    return value === undefined || value === null || value === '';
  }

  private readPublPath(source: Record<string, unknown>, rawPath: string): unknown {
    const parts = rawPath.split('.').map((part) => part.trim()).filter(Boolean);
    let current: unknown = source;

    for (const part of parts) {
      if (!current || typeof current !== 'object' || Array.isArray(current)) {
        return undefined;
      }

      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  private labelToPublVariable(label: string) {
    return label.replace(/\s+/g, '').trim();
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

function getTemplateRequiredVariables(template: { body: string; requiredVariables?: unknown }) {
  const storedVariables = Array.isArray(template.requiredVariables)
    ? template.requiredVariables.map((item) => String(item || '').trim()).filter(Boolean)
    : [];

  return storedVariables.length > 0 ? storedVariables : extractRequiredVariables(template.body);
}
