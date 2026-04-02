import { BadRequestException, Injectable } from '@nestjs/common';
import { MessageChannel, MessageRequestStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { MessageRequestsService } from '../../message-requests/message-requests.service';

@Injectable()
export class V2LogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messageRequestsService: MessageRequestsService
  ) {}

  async list(
    tenantId: string,
    ownerAdminUserId: string,
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
    const where = {
      tenantId,
      ownerAdminUserId,
      ...(status ? { status } : {}),
      ...(filters?.eventKey ? { eventKey: filters.eventKey } : {}),
      ...(channel ? { resolvedChannel: channel } : {})
    };

    const [items, totalCount, groupedStatuses] = await Promise.all([
      this.prisma.messageRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          deliveryResults: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      }),
      this.prisma.messageRequest.count({ where }),
      this.prisma.messageRequest.groupBy({
        by: ['status'],
        where,
        _count: {
          status: true
        }
      })
    ]);

    return {
      filters: {
        status: status ?? null,
        eventKey: filters?.eventKey ?? null,
        channel: channel ? toV2Channel(channel) : null,
        limit
      },
      summary: {
        totalCount,
        statusCounts: Object.fromEntries(groupedStatuses.map((item) => [item.status, item._count.status]))
      },
      items: items.map((item) => ({
        id: item.id,
        eventKey: item.eventKey,
        channel: item.resolvedChannel ? toV2Channel(item.resolvedChannel) : null,
        status: item.status,
        recipientPhone: item.recipientPhone,
        scheduledAt: item.scheduledAt,
        lastErrorCode: item.lastErrorCode,
        lastErrorMessage: item.lastErrorMessage,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        latestDeliveryResult: item.deliveryResults[0] ?? null
      }))
    };
  }

  async getDetail(tenantId: string, ownerAdminUserId: string, requestId: string) {
    const request = await this.messageRequestsService.getByIdForTenant(tenantId, requestId, ownerAdminUserId);

    return {
      id: request.id,
      eventKey: request.eventKey,
      channel: request.resolvedChannel ? toV2Channel(request.resolvedChannel) : null,
      status: request.status,
      recipientPhone: request.recipientPhone,
      recipientUserId: request.recipientUserId,
      variablesJson: request.variablesJson,
      metadataJson: request.metadataJson,
      manualBody: request.manualBody,
      scheduledAt: request.scheduledAt,
      resolvedSenderNumberId: request.resolvedSenderNumberId,
      resolvedSenderProfileId: request.resolvedSenderProfileId,
      resolvedTemplateId: request.resolvedTemplateId,
      resolvedProviderTemplateId: request.resolvedProviderTemplateId,
      lastErrorCode: request.lastErrorCode,
      lastErrorMessage: request.lastErrorMessage,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      attempts: request.attempts,
      deliveryResults: request.deliveryResults
    };
  }
}

function normalizeStatus(value?: string) {
  if (!value) {
    return undefined;
  }

  if ((Object.values(MessageRequestStatus) as string[]).includes(value)) {
    return value as MessageRequestStatus;
  }

  throw new BadRequestException(`status must be one of: ${Object.values(MessageRequestStatus).join(', ')}`);
}

function normalizeChannel(value?: string) {
  if (!value) {
    return undefined;
  }

  if (value === 'sms') {
    return MessageChannel.SMS;
  }

  if (value === 'kakao') {
    return MessageChannel.ALIMTALK;
  }

  if ((Object.values(MessageChannel) as string[]).includes(value)) {
    return value as MessageChannel;
  }

  throw new BadRequestException('channel must be one of: sms, kakao, SMS, ALIMTALK');
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
  return channel === MessageChannel.ALIMTALK ? 'kakao' : 'sms';
}
