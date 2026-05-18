import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DashboardService } from '../../dashboard/dashboard.service';
import { NhnService } from '../../nhn/nhn.service';
import { SessionUser } from '../../common/session-request.interface';
import { V2KakaoTemplateCatalogService } from '../shared/v2-kakao-template-catalog.service';
import { V2ReadinessService } from '../shared/v2-readiness.service';
import { findUserSmsTemplateCategory } from '../shared/v2-sms-template.utils';
import { canUsePartnerGroupTemplates } from '../v2-auth.utils';

@Injectable()
export class V2BootstrapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboardService: DashboardService,
    private readonly readinessService: V2ReadinessService,
    private readonly kakaoTemplateCatalogService: V2KakaoTemplateCatalogService,
    private readonly nhnService: NhnService
  ) {}

  async getBootstrap(sessionUser: SessionUser) {
    const includePartnerGroupTemplates = canUsePartnerGroupTemplates(sessionUser);
    const [overview, readiness, smsTemplateSummary, kakaoCatalog, enabledEventRuleCount] =
      await Promise.all([
        this.dashboardService.getOverview(sessionUser),
        this.readinessService.getReadinessForUser(sessionUser.userId),
        this.getSmsTemplateSummary(sessionUser.userId),
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
        smsTemplateCount: smsTemplateSummary.totalCount,
        smsPublishedTemplateCount: smsTemplateSummary.publishedCount,
        kakaoTemplateCount: kakaoCatalog.summary.totalCount,
        kakaoApprovedTemplateCount: kakaoCatalog.summary.approvedCount,
        enabledEventRuleCount,
        noticeCount: overview.notices.length
      }
    };
  }

  private async getSmsTemplateSummary(ownerUserId: string) {
    const category = await this.nhnService
      .fetchSmsTemplateCategories()
      .then((items) => findUserSmsTemplateCategory(items, ownerUserId))
      .catch(() => null);

    if (!category) {
      return {
        totalCount: 0,
        publishedCount: 0
      };
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

    return {
      totalCount: templates.length,
      publishedCount: templates.filter((item) => item.useYn === 'Y').length
    };
  }

}
