import { Injectable } from '@nestjs/common';
import { MessageChannel, MessageRequestStatus, TemplateStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { DashboardService } from '../../dashboard/dashboard.service';
import { SessionUser } from '../../common/session-request.interface';
import { V2KakaoTemplateCatalogService } from '../shared/v2-kakao-template-catalog.service';
import { V2ReadinessService } from '../shared/v2-readiness.service';

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

    const [
      overview,
      readiness,
      publishedSmsTemplateCount,
      kakaoCatalog,
      activeEventRuleCount,
      recentFailedRequestCount
    ] = await Promise.all([
      this.dashboardService.getOverview(sessionUser),
      this.readinessService.getReadiness(sessionUser.tenantId),
      this.prisma.template.count({
        where: {
          tenantId: sessionUser.tenantId,
          channel: MessageChannel.SMS,
          status: TemplateStatus.PUBLISHED
        }
      }),
      this.kakaoTemplateCatalogService.getTemplateCatalog(sessionUser.tenantId),
      this.prisma.eventRule.count({
        where: {
          tenantId: sessionUser.tenantId,
          enabled: true
        }
      }),
      this.prisma.messageRequest.count({
        where: {
          tenantId: sessionUser.tenantId,
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
      })
    ]);

    return {
      account: overview.account,
      balance: overview.balance,
      sendQuota: overview.sendQuota,
      notices: overview.notices,
      readiness,
      stats: {
        senderNumberCount: readiness.sms.totalCount,
        senderProfileCount: readiness.kakao.totalCount,
        publishedSmsTemplateCount,
        approvedKakaoTemplateCount: kakaoCatalog.summary.approvedCount,
        activeEventRuleCount,
        recentFailedRequestCount
      }
    };
  }
}
