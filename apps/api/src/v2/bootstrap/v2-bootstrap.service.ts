import { Injectable } from '@nestjs/common';
import { MessageChannel, TemplateStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { DashboardService } from '../../dashboard/dashboard.service';
import { SessionUser } from '../../common/session-request.interface';
import { V2KakaoTemplateCatalogService } from '../shared/v2-kakao-template-catalog.service';
import { V2ReadinessService } from '../shared/v2-readiness.service';

@Injectable()
export class V2BootstrapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboardService: DashboardService,
    private readonly readinessService: V2ReadinessService,
    private readonly kakaoTemplateCatalogService: V2KakaoTemplateCatalogService
  ) {}

  async getBootstrap(sessionUser: SessionUser) {
    const [overview, readiness, smsTemplateCount, smsPublishedTemplateCount, kakaoCatalog, enabledEventRuleCount] =
      await Promise.all([
        this.dashboardService.getOverview(sessionUser),
        this.readinessService.getReadiness(sessionUser.tenantId),
        this.prisma.template.count({
          where: {
            tenantId: sessionUser.tenantId,
            channel: MessageChannel.SMS
          }
        }),
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
        })
      ]);

    return {
      account: overview.account,
      readiness,
      counts: {
        smsTemplateCount,
        smsPublishedTemplateCount,
        kakaoTemplateCount: kakaoCatalog.summary.totalCount,
        kakaoApprovedTemplateCount: kakaoCatalog.summary.approvedCount,
        enabledEventRuleCount,
        noticeCount: overview.notices.length
      }
    };
  }
}
