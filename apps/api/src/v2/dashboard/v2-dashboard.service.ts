import { Injectable } from '@nestjs/common';
import { MessageRequestStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { DashboardService } from '../../dashboard/dashboard.service';
import { SessionUser } from '../../common/session-request.interface';
import { NhnService } from '../../nhn/nhn.service';
import { SmsQuotaService } from '../../sms-quota/sms-quota.service';
import { V2KakaoTemplateCatalogService } from '../shared/v2-kakao-template-catalog.service';
import { V2ReadinessService } from '../shared/v2-readiness.service';
import { findUserSmsTemplateCategory } from '../shared/v2-sms-template.utils';
import { canUsePartnerGroupTemplates } from '../v2-auth.utils';

@Injectable()
export class V2DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboardService: DashboardService,
    private readonly nhnService: NhnService,
    private readonly smsQuotaService: SmsQuotaService,
    private readonly readinessService: V2ReadinessService,
    private readonly kakaoTemplateCatalogService: V2KakaoTemplateCatalogService
  ) {}

  async getDashboard(sessionUser: SessionUser) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const includePartnerGroupTemplates = canUsePartnerGroupTemplates(sessionUser);
    const todayWindow = this.currentDayWindow();

    const [
      overview,
      readiness,
      publishedSmsTemplateCount,
      kakaoCatalog,
      activeEventRuleCount,
      recentFailedRequestCount
    ] = await Promise.all([
      this.dashboardService.getOverview(sessionUser),
      this.readinessService.getReadinessForUser(sessionUser.userId),
      this.getPublishedSmsTemplateCount(sessionUser.userId),
      this.kakaoTemplateCatalogService.getTemplateCatalogForUser(sessionUser.userId, {
        includeDefaultGroup: includePartnerGroupTemplates,
        groupScope: sessionUser.accessOrigin === 'PUBL' ? 'PUBL' : null
      }),
      this.prisma.eventRule.count({
        where: {
          ownerUserId: sessionUser.userId,
          enabled: true
        }
      }),
      this.prisma.messageRequest.count({
        where: {
          ownerUserId: sessionUser.userId,
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
    ]);

    const lifetimeStart = new Date(overview.currentUser.serviceCreatedAt);
    const [smsUsageStats, kakaoSentCount, kakaoDaySentCount, brandDaySentCount] =
      await Promise.all([
        this.smsQuotaService.getUsageStatsForUser(sessionUser.userId, new Date()),
        this.nhnService.fetchAlimtalkCountByRequestDateRange(lifetimeStart, todayWindow.end).catch(() => 0),
        this.nhnService.fetchAlimtalkCountByRequestDateRange(todayWindow.start, todayWindow.end).catch(() => 0),
        this.nhnService.fetchBrandMessageCountByRequestDateRange(todayWindow.start, todayWindow.end).catch(() => 0)
      ]);

    const smsSentCount = smsUsageStats.lifetimeUsed;
    const smsMonthSentCount = smsUsageStats.monthlyUsed;
    const smsDaySentCount = smsUsageStats.dailyUsed;
    const todaySent = smsDaySentCount + kakaoDaySentCount + brandDaySentCount;
    const dailyMax = overview.sendQuota.dailyMax;
    const remaining = Math.max(dailyMax - todaySent, 0);

    return {
      currentUser: overview.currentUser,
      balance: overview.balance,
      sendQuota: {
        todaySent,
        dailyMax,
        remaining
      },
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
        smsMonthlyLimit: smsUsageStats.monthlyLimit,
        kakaoDaySentCount,
        brandDaySentCount
      }
    };
  }

  private async getPublishedSmsTemplateCount(ownerUserId: string) {
    const category = await this.nhnService
      .fetchSmsTemplateCategories()
      .then((items) => findUserSmsTemplateCategory(items, ownerUserId))
      .catch(() => null);

    if (!category) {
      return 0;
    }

    const templates = await this.nhnService
      .fetchSmsTemplates({
        categoryId: category.categoryId,
        useYn: 'Y',
        pageNum: 1,
        pageSize: 1000
      })
      .then((response) => response.templates)
      .catch(() => []);

    return templates.filter((item) => item.useYn === 'Y').length;
  }

  private currentDayWindow() {
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

    return { start, end };
  }

}
