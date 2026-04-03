import { Injectable } from '@nestjs/common';
import { MessageChannel } from '@prisma/client';
import { SessionUser } from '../../common/session-request.interface';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateSenderProfileApplicationDto,
  VerifySenderProfileTokenDto
} from '../../sender-profiles/sender-profiles.dto';
import { SenderProfilesService } from '../../sender-profiles/sender-profiles.service';
import { SenderNumbersService } from '../../sender-numbers/sender-numbers.service';
import { NhnAlimtalkSenderCategory } from '../../nhn/nhn.service';
import { V2KakaoTemplateCatalogService } from '../shared/v2-kakao-template-catalog.service';
import { V2ReadinessService } from '../shared/v2-readiness.service';
import { canUsePartnerGroupTemplates } from '../v2-auth.utils';

export type KakaoConnectCategoryNode = {
  code: string;
  label: string;
  depth: number | null;
  children: KakaoConnectCategoryNode[];
};

@Injectable()
export class V2ResourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly readinessService: V2ReadinessService,
    private readonly kakaoTemplateCatalogService: V2KakaoTemplateCatalogService,
    private readonly senderProfilesService: SenderProfilesService,
    private readonly senderNumbersService: SenderNumbersService
  ) {}

  private mapKakaoConnectCategories(
    categories: NhnAlimtalkSenderCategory[],
    parentCode = ''
  ): KakaoConnectCategoryNode[] {
    return categories.flatMap((category) => {
      if (!category.code || !category.name) {
        return this.mapKakaoConnectCategories(category.subCategories ?? [], parentCode);
      }

      const fullCode = `${parentCode}${category.code}`;
      const childNodes = this.mapKakaoConnectCategories(category.subCategories ?? [], fullCode);

      return [
        {
          code: fullCode,
          label: category.name,
          depth: category.depth ?? null,
          children: childNodes
        }
      ];
    });
  }

  async getSummary(sessionUser: SessionUser) {
    return this.readinessService.getReadiness(sessionUser.tenantId, sessionUser.userId);
  }

  async getSmsResources(sessionUser: SessionUser) {
    const [summary, items] = await Promise.all([
      this.readinessService.getReadiness(sessionUser.tenantId, sessionUser.userId),
      this.prisma.senderNumber.findMany({
        where: {
          tenantId: sessionUser.tenantId,
          ownerAdminUserId: sessionUser.userId
        },
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

  async getSenderNumberApplication(sessionUser: SessionUser, senderNumberId: string) {
    return this.senderNumbersService.getApplicationForOwner(sessionUser.tenantId, sessionUser.userId, senderNumberId);
  }

  async getKakaoResources(sessionUser: SessionUser) {
    const includePartnerGroupTemplates = canUsePartnerGroupTemplates(sessionUser);
    const [summary, catalog, items] = await Promise.all([
      this.readinessService.getReadiness(sessionUser.tenantId, sessionUser.userId),
      this.kakaoTemplateCatalogService.getTemplateCatalog(sessionUser.tenantId, {
        includeDefaultGroup: includePartnerGroupTemplates,
        groupScope: sessionUser.partnerScope ?? null,
        ownerAdminUserId: sessionUser.userId
      }),
      this.prisma.senderProfile.findMany({
        where: {
          tenantId: sessionUser.tenantId,
          ownerAdminUserId: sessionUser.userId
        },
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

  async getKakaoConnectBootstrap(sessionUser: SessionUser) {
    const [summary, categories, existingChannels] = await Promise.all([
      this.readinessService.getReadiness(sessionUser.tenantId, sessionUser.userId),
      this.senderProfilesService.listCategories(),
      this.prisma.senderProfile.findMany({
        where: {
          tenantId: sessionUser.tenantId,
          ownerAdminUserId: sessionUser.userId
        },
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
      readiness: {
        status: summary.resourceState.kakao,
        totalCount: summary.kakao.totalCount,
        activeCount: summary.kakao.activeCount,
        blockedCount: summary.kakao.blockedCount,
        dormantCount: summary.kakao.dormantCount,
        unknownCount: summary.kakao.unknownCount
      },
      categories: this.mapKakaoConnectCategories(categories),
      existingChannels
    };
  }

  async requestKakaoConnect(sessionUser: SessionUser, dto: CreateSenderProfileApplicationDto) {
    const result = await this.senderProfilesService.apply(sessionUser.tenantId, dto);

    return {
      requestAccepted: true,
      plusFriendId: dto.plusFriendId.trim(),
      phoneNo: dto.phoneNo.trim(),
      categoryCode: dto.categoryCode.trim(),
      message: result.header?.resultMessage || '인증 토큰을 요청했습니다.'
    };
  }

  async verifyKakaoConnect(sessionUser: SessionUser, dto: VerifySenderProfileTokenDto) {
    const result = await this.senderProfilesService.verifyToken(sessionUser.tenantId, sessionUser.userId, dto);

    return {
      verified: Boolean(result.sender),
      message: result.header?.resultMessage || (result.sender ? '채널 연결을 완료했습니다.' : '채널 인증을 확인했습니다.'),
      sender: result.sender
        ? {
            id: result.sender.localSenderProfileId,
            plusFriendId: result.sender.plusFriendId,
            senderKey: result.sender.senderKey,
            senderProfileType: result.sender.senderProfileType,
            status: result.sender.localStatus,
            createdAt: result.sender.createDate,
            updatedAt: result.sender.createDate
          }
        : null
    };
  }
}
