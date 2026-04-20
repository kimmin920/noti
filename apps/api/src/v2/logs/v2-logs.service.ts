import { BadRequestException, Injectable } from '@nestjs/common';
import { MessageChannel, MessageRequestStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { MessageRequestsService } from '../../message-requests/message-requests.service';
import { ProviderResultsService } from '../../provider-results/provider-results.service';

@Injectable()
export class V2LogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messageRequestsService: MessageRequestsService,
    private readonly providerResultsService: ProviderResultsService
  ) {}

  async list(
    ownerUserId: string,
    filters?: {
      status?: string;
      eventKey?: string;
      channel?: string;
      limit?: string;
    }
  ) {
    const status = normalizeStatus(filters?.status);
    const channel = normalizeChannel(filters?.channel);
    const limit = normalizeLimit(filters?.limit);
    const eventKey = filters?.eventKey ?? null;
    const includeSms = !channel || channel === MessageChannel.SMS;
    const includeKakao = !channel || channel === 'KAKAO';
    const includeBulkSms = includeSms && matchesBulkEventKey(eventKey, 'sms');
    const includeBulkAlimtalk = includeKakao && matchesBulkEventKey(eventKey, 'kakao');
    const includeBulkBrand = includeKakao && matchesBulkEventKey(eventKey, 'brand');
    const messageWhere = {
      ownerUserId,
      ...(eventKey ? { eventKey } : {}),
      ...(channel
        ? channel === 'KAKAO'
          ? {
              resolvedChannel: {
                in: [MessageChannel.ALIMTALK, MessageChannel.BRAND_MESSAGE]
              }
            }
          : { resolvedChannel: channel }
        : {})
    };

    const [
      messageItems,
      messageCount,
      bulkSmsCount,
      bulkAlimtalkCount,
      bulkBrandCount,
      bulkSmsItems,
      bulkAlimtalkItems,
      bulkBrandItems
    ] = await Promise.all([
      this.prisma.messageRequest.findMany({
        where: messageWhere,
        orderBy: { createdAt: 'desc' },
        take: limit
      }),
      this.prisma.messageRequest.count({ where: messageWhere }),
      includeBulkSms
        ? this.prisma.bulkSmsCampaign.count({
            where: {
              ownerUserId
            }
          })
        : Promise.resolve(0),
      includeBulkAlimtalk
        ? this.prisma.bulkAlimtalkCampaign.count({
            where: {
              ownerUserId
            }
          })
        : Promise.resolve(0),
      includeBulkBrand
        ? this.prisma.bulkBrandMessageCampaign.count({
            where: {
              ownerUserId
            }
          })
        : Promise.resolve(0),
      includeBulkSms
        ? this.prisma.bulkSmsCampaign.findMany({
            where: {
              ownerUserId
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
              id: true,
              title: true,
              status: true,
              scheduledAt: true,
              nhnRequestId: true,
              totalRecipientCount: true,
              skippedNoPhoneCount: true,
              duplicatePhoneCount: true,
              providerResponse: true,
              createdAt: true,
              updatedAt: true,
              recipients: {
                select: {
                  id: true,
                  recipientPhone: true,
                  recipientSeq: true,
                  status: true
                }
              }
            }
          })
        : Promise.resolve([]),
      includeBulkAlimtalk
        ? this.prisma.bulkAlimtalkCampaign.findMany({
            where: {
              ownerUserId
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
              id: true,
              title: true,
              status: true,
              scheduledAt: true,
              nhnRequestId: true,
              totalRecipientCount: true,
              skippedNoPhoneCount: true,
              duplicatePhoneCount: true,
              providerResponse: true,
              createdAt: true,
              updatedAt: true,
              recipients: {
                select: {
                  id: true,
                  recipientPhone: true,
                  recipientSeq: true,
                  status: true
                }
              }
            }
          })
        : Promise.resolve([]),
      includeBulkBrand
        ? this.prisma.bulkBrandMessageCampaign.findMany({
            where: {
              ownerUserId
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
              id: true,
              title: true,
              status: true,
              scheduledAt: true,
              nhnRequestId: true,
              totalRecipientCount: true,
              skippedNoPhoneCount: true,
              duplicatePhoneCount: true,
              providerResponse: true,
              messageType: true,
              createdAt: true,
              updatedAt: true,
              recipients: {
                select: {
                  id: true,
                  recipientPhone: true,
                  recipientSeq: true,
                  status: true
                }
              }
            }
          })
        : Promise.resolve([])
    ]);

    const [resolvedMessageItems, resolvedBulkSmsItems, resolvedBulkAlimtalkItems, resolvedBulkBrandItems] =
      await Promise.all([
        this.providerResultsService.resolveMessageRequests(messageItems),
        Promise.all(bulkSmsItems.map((item) => this.providerResultsService.resolveSmsCampaign(item))),
        Promise.all(bulkAlimtalkItems.map((item) => this.providerResultsService.resolveAlimtalkCampaign(item))),
        Promise.all(bulkBrandItems.map((item) => this.providerResultsService.resolveBrandMessageCampaign(item)))
      ]);

    const mergedItems = [
      ...messageItems.map((item, index) => serializeMessageLogItem(item, resolvedMessageItems[index])),
      ...bulkSmsItems.map((item, index) => serializeBulkLogItem('sms', item, resolvedBulkSmsItems[index])),
      ...bulkAlimtalkItems.map((item, index) => serializeBulkLogItem('kakao', item, resolvedBulkAlimtalkItems[index])),
      ...bulkBrandItems.map((item, index) => serializeBulkLogItem('brand', item, resolvedBulkBrandItems[index]))
    ]
      .filter((item) => !status || item.status === status)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

    const visibleItems = mergedItems.slice(0, limit);
    const statusCounts = Object.fromEntries(
      mergedItems.reduce((map, item) => {
        map.set(item.status, (map.get(item.status) ?? 0) + 1);
        return map;
      }, new Map<string, number>())
    );
    const totalCount = status ? mergedItems.length : messageCount + bulkSmsCount + bulkAlimtalkCount + bulkBrandCount;

    return {
      filters: {
        status: status ?? null,
        eventKey,
        channel: channel ? (channel === 'KAKAO' ? 'kakao' : toV2Channel(channel)) : null,
        limit
      },
      summary: {
        totalCount,
        statusCounts
      },
      items: visibleItems
    };
  }

  async getDetail(ownerUserId: string, requestId: string) {
    const request = await this.messageRequestsService.getByIdForUser(ownerUserId, requestId);
    const [senderNumber, senderProfile, template, providerTemplate] = await Promise.all([
      request.resolvedSenderNumberId
        ? this.prisma.senderNumber.findFirst({
            where: {
              id: request.resolvedSenderNumberId,
              ownerUserId
            }
          })
        : null,
      request.resolvedSenderProfileId
        ? this.prisma.senderProfile.findFirst({
            where: {
              id: request.resolvedSenderProfileId,
              ownerUserId
            }
          })
        : null,
      request.resolvedTemplateId
        ? this.prisma.template.findFirst({
            where: {
              id: request.resolvedTemplateId,
              ownerUserId
            }
          })
        : null,
      request.resolvedProviderTemplateId
        ? this.prisma.providerTemplate.findFirst({
            where: {
              id: request.resolvedProviderTemplateId,
              ownerUserId
            }
          })
        : null
    ]);
    const brandMessage = extractBrandMessage(request.metadataJson);
    const resolved = await this.providerResultsService.resolveMessageRequest({
      status: request.status,
      nhnMessageId: request.nhnMessageId,
      resolvedChannel: request.resolvedChannel,
      metadataJson: request.metadataJson,
      scheduledAt: request.scheduledAt,
      lastErrorCode: request.lastErrorCode,
      lastErrorMessage: request.lastErrorMessage,
      updatedAt: request.updatedAt
    });

    return {
      id: request.id,
      eventKey: request.eventKey,
      channel: request.resolvedChannel ? toV2Channel(request.resolvedChannel) : null,
      providerChannel: request.resolvedChannel ?? null,
      messageType: extractMessageType(request.resolvedChannel, request.metadataJson),
      status: resolved.status,
      recipientPhone: request.recipientPhone,
      recipientUserId: request.recipientUserId,
      variablesJson: request.variablesJson,
      metadataJson: request.metadataJson,
      brandMessage,
      manualBody: request.manualBody,
      scheduledAt: request.scheduledAt,
      resolvedSenderNumberId: request.resolvedSenderNumberId,
      resolvedSenderProfileId: request.resolvedSenderProfileId,
      resolvedTemplateId: request.resolvedTemplateId,
      resolvedProviderTemplateId: request.resolvedProviderTemplateId,
      resolvedSenderNumber: senderNumber
        ? {
            id: senderNumber.id,
            phoneNumber: senderNumber.phoneNumber
          }
        : null,
      resolvedSenderProfile: senderProfile
        ? {
            id: senderProfile.id,
            plusFriendId: senderProfile.plusFriendId,
            senderKey: senderProfile.senderKey
          }
        : null,
      resolvedTemplate: template
        ? {
            id: template.id,
            name: template.name
          }
        : null,
      resolvedProviderTemplate: providerTemplate
        ? {
            id: providerTemplate.id,
            templateCode: providerTemplate.templateCode,
            kakaoTemplateCode: providerTemplate.kakaoTemplateCode
          }
        : null,
      lastErrorCode: resolved.lastErrorCode,
      lastErrorMessage: resolved.lastErrorMessage,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      attempts: request.attempts.map((attempt) => ({
        id: attempt.id,
        attemptNumber: attempt.attemptNumber,
        errorCode: attempt.errorCode,
        errorMessage: attempt.errorMessage,
        createdAt: attempt.createdAt
      })),
      deliveryResults: resolved.deliveryResults.map((result, index) => ({
        id: `direct-${index + 1}`,
        providerStatus: result.providerStatus,
        providerCode: result.providerCode,
        providerMessage: result.providerMessage,
        createdAt: result.createdAt
      }))
    };
  }
}

function serializeMessageLogItem(
  item: {
    id: string;
    eventKey: string;
    resolvedChannel: MessageChannel | null;
    metadataJson: unknown;
    status: string;
    recipientPhone: string;
    scheduledAt: Date | null;
    lastErrorCode: string | null;
    lastErrorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  resolved: {
    status: string;
    lastErrorCode: string | null;
    lastErrorMessage: string | null;
    latestDeliveryResult: {
      providerStatus: string;
      providerCode: string | null;
      providerMessage: string | null;
      createdAt: string;
    } | null;
  }
) {
  return {
    id: item.id,
    kind: 'message' as const,
    mode: 'MANUAL' as const,
    eventKey: item.eventKey,
    channel: item.resolvedChannel ? toV2Channel(item.resolvedChannel) : null,
    campaignChannel: null,
    providerChannel: item.resolvedChannel ?? null,
    title: null,
    messageType: extractMessageType(item.resolvedChannel, item.metadataJson),
    status: resolved.status ?? item.status,
    recipientPhone: item.recipientPhone,
    recipientCount: 1,
    scheduledAt: item.scheduledAt,
    lastErrorCode: resolved.lastErrorCode ?? item.lastErrorCode,
    lastErrorMessage: resolved.lastErrorMessage ?? item.lastErrorMessage,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    latestDeliveryResult: resolved.latestDeliveryResult ?? null
  };
}

function serializeBulkLogItem(
  campaignChannel: 'sms' | 'kakao' | 'brand',
  item: {
    id: string;
    title: string;
    scheduledAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    totalRecipientCount: number;
    messageType?: string;
  },
  resolved: {
    status: string;
    recipients: Map<
      string,
      {
        providerResultCode: string | null;
        providerResultMessage: string | null;
        providerStatus: string | null;
        resolvedAt: string | null;
      }
    >;
  }
) {
  const latestFailure = Array.from(resolved.recipients.values()).find(
    (recipient) => recipient.providerResultCode || recipient.providerResultMessage || recipient.providerStatus
  );
  const providerChannel =
    campaignChannel === 'sms'
      ? MessageChannel.SMS
      : campaignChannel === 'brand'
        ? MessageChannel.BRAND_MESSAGE
        : MessageChannel.ALIMTALK;

  return {
    id: item.id,
    kind: 'campaign' as const,
    mode: 'BULK' as const,
    eventKey:
      campaignChannel === 'sms'
        ? 'BULK_SMS_SEND'
        : campaignChannel === 'brand'
          ? 'BULK_BRAND_MESSAGE_SEND'
          : 'BULK_ALIMTALK_SEND',
    channel: campaignChannel === 'sms' ? ('sms' as const) : ('kakao' as const),
    campaignChannel,
    providerChannel,
    title: item.title,
    messageType: campaignChannel === 'brand' ? item.messageType ?? null : null,
    status: resolved.status,
    recipientPhone: null,
    recipientCount: item.totalRecipientCount,
    scheduledAt: item.scheduledAt,
    lastErrorCode: latestFailure?.providerResultCode ?? null,
    lastErrorMessage: latestFailure?.providerResultMessage ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    latestDeliveryResult: latestFailure
      ? {
          providerStatus: latestFailure.providerStatus ?? 'UNKNOWN',
          providerCode: latestFailure.providerResultCode,
          providerMessage: latestFailure.providerResultMessage,
          createdAt: latestFailure.resolvedAt ?? item.updatedAt.toISOString()
        }
      : null
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function extractBrandMessage(metadataJson: unknown) {
  return asRecord(asRecord(metadataJson)?.brandMessage);
}

function extractMessageType(channel: MessageChannel | null | undefined, metadataJson: unknown) {
  if (channel === MessageChannel.BRAND_MESSAGE) {
    const brandMessage = extractBrandMessage(metadataJson);
    return typeof brandMessage?.messageType === 'string' ? brandMessage.messageType : null;
  }

  if (channel === MessageChannel.SMS) {
    const metadata = asRecord(metadataJson);
    return typeof metadata?.smsMessageType === 'string' ? metadata.smsMessageType : null;
  }

  return null;
}

function normalizeStatus(value?: string) {
  if (!value) {
    return undefined;
  }

  const allowedStatuses = new Set<string>([
    ...Object.values(MessageRequestStatus),
    'WAITING',
    'IN_PROGRESS',
    'LOOKUP_FAILED',
    'PARTIAL_FAILED',
    'FAILED'
  ]);

  if (allowedStatuses.has(value)) {
    return value;
  }

  throw new BadRequestException(
    `status must be one of: ${[...allowedStatuses].join(', ')}`
  );
}

function normalizeChannel(value?: string) {
  if (!value) {
    return undefined;
  }

  if (value === 'sms') {
    return MessageChannel.SMS;
  }

  if (value === 'kakao') {
    return 'KAKAO' as const;
  }

  if ((Object.values(MessageChannel) as string[]).includes(value)) {
    return value as MessageChannel;
  }

  throw new BadRequestException('channel must be one of: sms, kakao, SMS, ALIMTALK, BRAND_MESSAGE');
}

function matchesBulkEventKey(eventKey: string | null, channel: 'sms' | 'kakao' | 'brand') {
  if (!eventKey) {
    return true;
  }

  if (channel === 'sms') {
    return eventKey === 'BULK_SMS_SEND';
  }

  if (channel === 'brand') {
    return eventKey === 'BULK_BRAND_MESSAGE_SEND';
  }

  return eventKey === 'BULK_ALIMTALK_SEND';
}

function normalizeLimit(value?: string) {
  if (!value) {
    return 100;
  }

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    throw new BadRequestException('limit must be an integer between 1 and 200');
  }

  return limit;
}

function toV2Channel(channel: MessageChannel) {
  return channel === MessageChannel.SMS ? 'sms' : 'kakao';
}
