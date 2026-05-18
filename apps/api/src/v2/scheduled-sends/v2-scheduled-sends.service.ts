import { Injectable } from '@nestjs/common';
import { BulkSmsCampaignStatus, MessageChannel, MessageRequestStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

const SEOUL_TIME_ZONE = 'Asia/Seoul';
const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

type ScheduledSendChannel = 'sms' | 'alimtalk' | 'brand' | null;

@Injectable()
export class V2ScheduledSendsService {
  constructor(private readonly prisma: PrismaService) {}

  async listUpcoming(ownerUserId: string, filters?: { limit?: string }) {
    const now = new Date();
    const limit = normalizeLimit(filters?.limit);
    const todayWindow = currentSeoulDayWindow(now);
    const windowStart = maxDate(todayWindow.start, now);
    const upcomingScheduledAtWhere = {
      gte: now
    };
    const todayScheduledAtWhere = {
      gte: windowStart,
      lt: todayWindow.end
    };

    const [
      todayMessageCount,
      todayBulkSmsCount,
      todayBulkAlimtalkCount,
      todayBulkBrandCount,
      messageCount,
      bulkSmsCount,
      bulkAlimtalkCount,
      bulkBrandCount,
      messageItems,
      bulkSmsItems,
      bulkAlimtalkItems,
      bulkBrandItems
    ] = await Promise.all([
      this.prisma.messageRequest.count({
        where: {
          ownerUserId,
          scheduledAt: todayScheduledAtWhere,
          status: {
            in: [MessageRequestStatus.ACCEPTED, MessageRequestStatus.PROCESSING]
          }
        }
      }),
      this.prisma.bulkSmsCampaign.count({
        where: {
          ownerUserId,
          scheduledAt: todayScheduledAtWhere,
          status: BulkSmsCampaignStatus.PROCESSING
        }
      }),
      this.prisma.bulkAlimtalkCampaign.count({
        where: {
          ownerUserId,
          scheduledAt: todayScheduledAtWhere,
          status: BulkSmsCampaignStatus.PROCESSING
        }
      }),
      this.prisma.bulkBrandMessageCampaign.count({
        where: {
          ownerUserId,
          scheduledAt: todayScheduledAtWhere,
          status: BulkSmsCampaignStatus.PROCESSING
        }
      }),
      this.prisma.messageRequest.count({
        where: {
          ownerUserId,
          scheduledAt: upcomingScheduledAtWhere,
          status: {
            in: [MessageRequestStatus.ACCEPTED, MessageRequestStatus.PROCESSING]
          }
        }
      }),
      this.prisma.bulkSmsCampaign.count({
        where: {
          ownerUserId,
          scheduledAt: upcomingScheduledAtWhere,
          status: BulkSmsCampaignStatus.PROCESSING
        }
      }),
      this.prisma.bulkAlimtalkCampaign.count({
        where: {
          ownerUserId,
          scheduledAt: upcomingScheduledAtWhere,
          status: BulkSmsCampaignStatus.PROCESSING
        }
      }),
      this.prisma.bulkBrandMessageCampaign.count({
        where: {
          ownerUserId,
          scheduledAt: upcomingScheduledAtWhere,
          status: BulkSmsCampaignStatus.PROCESSING
        }
      }),
      this.prisma.messageRequest.findMany({
        where: {
          ownerUserId,
          scheduledAt: upcomingScheduledAtWhere,
          status: {
            in: [MessageRequestStatus.ACCEPTED, MessageRequestStatus.PROCESSING]
          }
        },
        orderBy: { scheduledAt: 'asc' },
        take: limit,
        select: {
          id: true,
          eventKey: true,
          resolvedChannel: true,
          status: true,
          recipientPhone: true,
          scheduledAt: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      this.prisma.bulkSmsCampaign.findMany({
        where: {
          ownerUserId,
          scheduledAt: upcomingScheduledAtWhere,
          status: BulkSmsCampaignStatus.PROCESSING
        },
        orderBy: { scheduledAt: 'asc' },
        take: limit,
        select: {
          id: true,
          title: true,
          scheduledAt: true,
          status: true,
          totalRecipientCount: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      this.prisma.bulkAlimtalkCampaign.findMany({
        where: {
          ownerUserId,
          scheduledAt: upcomingScheduledAtWhere,
          status: BulkSmsCampaignStatus.PROCESSING
        },
        orderBy: { scheduledAt: 'asc' },
        take: limit,
        select: {
          id: true,
          title: true,
          scheduledAt: true,
          status: true,
          totalRecipientCount: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      this.prisma.bulkBrandMessageCampaign.findMany({
        where: {
          ownerUserId,
          scheduledAt: upcomingScheduledAtWhere,
          status: BulkSmsCampaignStatus.PROCESSING
        },
        orderBy: { scheduledAt: 'asc' },
        take: limit,
        select: {
          id: true,
          title: true,
          scheduledAt: true,
          status: true,
          totalRecipientCount: true,
          createdAt: true,
          updatedAt: true
        }
      })
    ]);

    const items = [
      ...messageItems.map((item) => ({
        id: item.id,
        kind: 'message' as const,
        mode: isManualMessageEventKey(item.eventKey) ? ('MANUAL' as const) : ('AUTO' as const),
        channel: toScheduledChannel(item.resolvedChannel),
        title: messageTitle(item.eventKey, item.resolvedChannel),
        recipientLabel: item.recipientPhone,
        recipientCount: 1,
        status: item.status,
        scheduledAt: requireScheduledAt(item.scheduledAt),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      })),
      ...bulkSmsItems.map((item) => serializeCampaign('sms', item)),
      ...bulkAlimtalkItems.map((item) => serializeCampaign('alimtalk', item)),
      ...bulkBrandItems.map((item) => serializeCampaign('brand', item))
    ]
      .sort((left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime())
      .slice(0, limit);

    const campaignCount = bulkSmsCount + bulkAlimtalkCount + bulkBrandCount;
    const todayCount = todayMessageCount + todayBulkSmsCount + todayBulkAlimtalkCount + todayBulkBrandCount;

    return {
      window: {
        timeZone: SEOUL_TIME_ZONE,
        start: todayWindow.start,
        end: todayWindow.end,
        generatedAt: now
      },
      summary: {
        totalCount: messageCount + campaignCount,
        todayCount,
        messageCount,
        campaignCount
      },
      items
    };
  }
}

function currentSeoulDayWindow(now: Date) {
  const seoulNowMs = now.getTime() + SEOUL_OFFSET_MS;
  const startMs = Math.floor(seoulNowMs / DAY_MS) * DAY_MS - SEOUL_OFFSET_MS;

  return {
    start: new Date(startMs),
    end: new Date(startMs + DAY_MS)
  };
}

function maxDate(left: Date, right: Date) {
  return left.getTime() > right.getTime() ? left : right;
}

function requireScheduledAt(value: Date | null) {
  if (!value) {
    throw new Error('scheduledAt is required for scheduled send items');
  }

  return value;
}

function normalizeLimit(value?: string) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return Math.min(Math.max(parsed, 1), 1000);
}

function toScheduledChannel(channel: MessageChannel | null): ScheduledSendChannel {
  if (channel === MessageChannel.SMS) {
    return 'sms';
  }

  if (channel === MessageChannel.ALIMTALK) {
    return 'alimtalk';
  }

  if (channel === MessageChannel.BRAND_MESSAGE) {
    return 'brand';
  }

  return null;
}

function isManualMessageEventKey(eventKey: string) {
  return (
    eventKey === 'MANUAL_SMS_SEND' ||
    eventKey === 'MANUAL_ALIMTALK_SEND' ||
    eventKey === 'MANUAL_BRAND_MESSAGE_SEND'
  );
}

function messageTitle(eventKey: string, channel: MessageChannel | null) {
  if (eventKey === 'MANUAL_SMS_SEND' || channel === MessageChannel.SMS) {
    return 'SMS 단건 발송';
  }

  if (eventKey === 'MANUAL_BRAND_MESSAGE_SEND' || channel === MessageChannel.BRAND_MESSAGE) {
    return '브랜드 메시지';
  }

  if (eventKey === 'MANUAL_ALIMTALK_SEND' || channel === MessageChannel.ALIMTALK) {
    return '알림톡 단건 발송';
  }

  return '자동화 발송';
}

function serializeCampaign(
  channel: Exclude<ScheduledSendChannel, null>,
  item: {
    id: string;
    title: string;
    scheduledAt: Date | null;
    status: BulkSmsCampaignStatus;
    totalRecipientCount: number;
    createdAt: Date;
    updatedAt: Date;
  }
) {
  return {
    id: item.id,
    kind: 'campaign' as const,
    mode: 'BULK' as const,
    channel,
    title: item.title,
    recipientLabel: null,
    recipientCount: item.totalRecipientCount,
    status: item.status,
    scheduledAt: requireScheduledAt(item.scheduledAt),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}
