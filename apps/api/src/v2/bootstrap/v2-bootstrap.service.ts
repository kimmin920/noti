import { Injectable } from '@nestjs/common';
import { MessageChannel, TemplateStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { DashboardService } from '../../dashboard/dashboard.service';
import { SessionUser } from '../../common/session-request.interface';
import { V2KakaoTemplateCatalogService } from '../shared/v2-kakao-template-catalog.service';
import { V2ReadinessService } from '../shared/v2-readiness.service';
import { canUsePartnerGroupTemplates } from '../v2-auth.utils';

@Injectable()
export class V2BootstrapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboardService: DashboardService,
    private readonly readinessService: V2ReadinessService,
    private readonly kakaoTemplateCatalogService: V2KakaoTemplateCatalogService
  ) {}

  async getBootstrap(sessionUser: SessionUser) {
    const includePartnerGroupTemplates = canUsePartnerGroupTemplates(sessionUser);
    const [overview, readiness, smsTemplateCount, smsPublishedTemplateCount, kakaoCatalog, enabledEventRuleCount] =
      await Promise.all([
        this.dashboardService.getOverview(sessionUser),
        this.readinessService.getReadinessForUser(sessionUser.userId),
        this.prisma.template.count({
          where: {
            ownerUserId: sessionUser.userId,
            channel: MessageChannel.SMS
          }
        }),
        this.prisma.template.count({
          where: {
            ownerUserId: sessionUser.userId,
            channel: MessageChannel.SMS,
            status: TemplateStatus.PUBLISHED
          }
        }),
        this.kakaoTemplateCatalogService.getTemplateCatalogForUser(sessionUser.userId, {
          includeDefaultGroup: includePartnerGroupTemplates,
          groupScope: sessionUser.accessOrigin === 'PUBL' ? 'PUBL' : null
        }),
        this.prisma.eventRule.count({
          where: {
            ownerUserId: sessionUser.userId,
            enabled: true
          }
        })
      ]);

    return {
      currentUser: overview.currentUser,
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
