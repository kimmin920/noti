import { Injectable } from '@nestjs/common';
import { MessageChannel, MessageRequestStatus, TemplateStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { DashboardService } from '../../dashboard/dashboard.service';
import { SessionUser } from '../../common/session-request.interface';
import { V2KakaoTemplateCatalogService } from '../shared/v2-kakao-template-catalog.service';
import { V2ReadinessService } from '../shared/v2-readiness.service';
import { canUsePartnerGroupTemplates } from '../v2-auth.utils';

@Injectable()
export class V2DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboardService: DashboardService,
    private readonly readinessService: V2ReadinessService,
    private readonly kakaoTemplateCatalogService: V2KakaoTemplateCatalogService
  ) {}

  async getDashboard(sessionUser: SessionUser) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const includePartnerGroupTemplates = canUsePartnerGroupTemplates(sessionUser);
    const todayFilter = this.currentDayScheduleFilter();
    const currentMonthFilter = this.currentMonthScheduleFilter();

    const [
      overview,
      readiness,
      publishedSmsTemplateCount,
      kakaoCatalog,
      activeEventRuleCount,
      recentFailedRequestCount,
      directSmsRequestCount,
      directKakaoRequestCount,
      bulkSmsRecipientCount,
      bulkKakaoRecipientCount,
      monthlyDirectSmsRequestCount,
      monthlyBulkSmsRecipientCount,
      dailyDirectKakaoRequestCount,
      dailyBulkKakaoRecipientCount
    ] = await Promise.all([
      this.dashboardService.getOverview(sessionUser),
      this.readinessService.getReadiness(sessionUser.tenantId, sessionUser.userId),
      this.prisma.template.count({
        where: {
          tenantId: sessionUser.tenantId,
          ownerAdminUserId: sessionUser.userId,
          channel: MessageChannel.SMS,
          status: TemplateStatus.PUBLISHED
        }
      }),
      this.kakaoTemplateCatalogService.getTemplateCatalog(sessionUser.tenantId, {
        includeDefaultGroup: includePartnerGroupTemplates,
        groupScope: sessionUser.partnerScope ?? null,
        ownerAdminUserId: sessionUser.userId
      }),
      this.prisma.eventRule.count({
        where: {
          tenantId: sessionUser.tenantId,
          ownerAdminUserId: sessionUser.userId,
          enabled: true
        }
      }),
      this.prisma.messageRequest.count({
        where: {
          tenantId: sessionUser.tenantId,
          ownerAdminUserId: sessionUser.userId,
          status: {
            in: [
              MessageRequestStatus.DELIVERY_FAILED,
              MessageRequestStatus.SEND_FAILED,
              MessageRequestStatus.DEAD
            ]
          },
          createdAt: {
            gte: sevenDaysAgo
          }
        }
      }),
      this.prisma.messageRequest.count({
        where: {
          tenantId: sessionUser.tenantId,
          ownerAdminUserId: sessionUser.userId,
          resolvedChannel: MessageChannel.SMS,
          status: {
            not: MessageRequestStatus.CANCELED
          }
        }
      }),
      this.prisma.messageRequest.count({
        where: {
          tenantId: sessionUser.tenantId,
          ownerAdminUserId: sessionUser.userId,
          resolvedChannel: MessageChannel.ALIMTALK,
          status: {
            not: MessageRequestStatus.CANCELED
          }
        }
      }),
      this.prisma.bulkSmsRecipient.count({
        where: {
          campaign: {
            tenantId: sessionUser.tenantId,
            ownerAdminUserId: sessionUser.userId
          }
        }
      }),
      this.prisma.bulkAlimtalkRecipient.count({
        where: {
          campaign: {
            tenantId: sessionUser.tenantId,
            ownerAdminUserId: sessionUser.userId
          }
        }
      }),
      this.prisma.messageRequest.count({
        where: {
          tenantId: sessionUser.tenantId,
          ownerAdminUserId: sessionUser.userId,
          resolvedChannel: MessageChannel.SMS,
          status: {
            not: MessageRequestStatus.CANCELED
          },
          ...currentMonthFilter
        }
      }),
      this.prisma.bulkSmsRecipient.count({
        where: {
          campaign: {
            tenantId: sessionUser.tenantId,
            ownerAdminUserId: sessionUser.userId,
            ...currentMonthFilter
          }
        }
      }),
      this.prisma.messageRequest.count({
        where: {
          tenantId: sessionUser.tenantId,
          ownerAdminUserId: sessionUser.userId,
          resolvedChannel: MessageChannel.ALIMTALK,
          status: {
            not: MessageRequestStatus.CANCELED
          },
          ...todayFilter
        }
      }),
      this.prisma.bulkAlimtalkRecipient.count({
        where: {
          campaign: {
            tenantId: sessionUser.tenantId,
            ownerAdminUserId: sessionUser.userId,
            ...todayFilter
          }
        }
      })
    ]);

    const smsSentCount = directSmsRequestCount + bulkSmsRecipientCount;
    const kakaoSentCount = directKakaoRequestCount + bulkKakaoRecipientCount;
    const smsMonthSentCount = monthlyDirectSmsRequestCount + monthlyBulkSmsRecipientCount;
    const kakaoDaySentCount = dailyDirectKakaoRequestCount + dailyBulkKakaoRecipientCount;

    return {
      account: overview.account,
      balance: overview.balance,
      sendQuota: overview.sendQuota,
      quotaSnapshotAt: new Date().toISOString(),
      notices: overview.notices,
      readiness,
      stats: {
        senderNumberCount: readiness.sms.totalCount,
        senderProfileCount: readiness.kakao.totalCount,
        publishedSmsTemplateCount,
        approvedKakaoTemplateCount: kakaoCatalog.summary.approvedCount,
        activeEventRuleCount,
        recentFailedRequestCount,
        smsSentCount,
        kakaoSentCount,
        smsMonthSentCount,
        kakaoDaySentCount
      }
    };
  }

  private currentDayScheduleFilter() {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(new Date());
    const year = Number(parts.find((part) => part.type === 'year')?.value ?? '1970');
    const month = Number(parts.find((part) => part.type === 'month')?.value ?? '01');
    const day = Number(parts.find((part) => part.type === 'day')?.value ?? '01');
    const start = new Date(Date.UTC(year, month - 1, day, -9, 0, 0, 0));
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    return {
      OR: [
        {
          scheduledAt: {
            gte: start,
            lt: end
          }
        },
        {
          scheduledAt: null,
          createdAt: {
            gte: start,
            lt: end
          }
        }
      ]
    };
  }

  private currentMonthScheduleFilter() {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit'
    });
    const parts = formatter.formatToParts(new Date());
    const year = Number(parts.find((part) => part.type === 'year')?.value ?? '1970');
    const month = Number(parts.find((part) => part.type === 'month')?.value ?? '01');
    const start = new Date(Date.UTC(year, month - 1, 1, -9, 0, 0, 0));
    const end = month === 12
      ? new Date(Date.UTC(year + 1, 0, 1, -9, 0, 0, 0))
      : new Date(Date.UTC(year, month, 1, -9, 0, 0, 0));

    return {
      OR: [
        {
          scheduledAt: {
            gte: start,
            lt: end
          }
        },
        {
          scheduledAt: null,
          createdAt: {
            gte: start,
            lt: end
          }
        }
      ]
    };
  }
}
