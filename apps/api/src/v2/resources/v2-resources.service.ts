import { Injectable } from '@nestjs/common';
import { MessageChannel } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { V2KakaoTemplateCatalogService } from '../shared/v2-kakao-template-catalog.service';
import { V2ReadinessService } from '../shared/v2-readiness.service';

@Injectable()
export class V2ResourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly readinessService: V2ReadinessService,
    private readonly kakaoTemplateCatalogService: V2KakaoTemplateCatalogService
  ) {}

  async getSummary(tenantId: string) {
    return this.readinessService.getReadiness(tenantId);
  }

  async getSmsResources(tenantId: string) {
    const [summary, items] = await Promise.all([
      this.readinessService.getReadiness(tenantId),
      this.prisma.senderNumber.findMany({
        where: { tenantId },
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        select: {
          id: true,
          phoneNumber: true,
          type: true,
          status: true,
          reviewMemo: true,
          approvedAt: true,
          createdAt: true,
          updatedAt: true
        }
      })
    ]);

    return {
      status: summary.resourceState.sms,
      summary: summary.sms,
      items
    };
  }

  async getKakaoResources(tenantId: string) {
    const [summary, catalog, items] = await Promise.all([
      this.readinessService.getReadiness(tenantId),
      this.kakaoTemplateCatalogService.getTemplateCatalog(tenantId),
      this.prisma.senderProfile.findMany({
        where: { tenantId },
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        select: {
          id: true,
          plusFriendId: true,
          senderKey: true,
          senderProfileType: true,
          status: true,
          createdAt: true,
          updatedAt: true
        }
      })
    ]);

    return {
      status: summary.resourceState.kakao,
      summary: {
        ...summary.kakao,
        approvedTemplateCount: catalog.summary.approvedCount
      },
      items
    };
  }
}
