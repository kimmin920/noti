import { Injectable } from '@nestjs/common';
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
    return this.readinessService.getReadinessForUser(sessionUser.userId);
  }

  async getSmsResources(sessionUser: SessionUser) {
    const [summary, items] = await Promise.all([
      this.readinessService.getReadinessForUser(sessionUser.userId),
      this.senderNumbersService.list(sessionUser.userId)
    ]);

    return {
      status: summary.resourceState.sms,
      summary: summary.sms,
      items
    };
  }

  async getSenderNumberApplication(sessionUser: SessionUser, senderNumberId: string) {
    return this.senderNumbersService.getApplicationForUser(sessionUser.userId, senderNumberId);
  }

  async getKakaoResources(sessionUser: SessionUser) {
    const includePartnerGroupTemplates = canUsePartnerGroupTemplates(sessionUser);
    const [summary, catalog, localSenders] = await Promise.all([
      this.readinessService.getReadinessForUser(sessionUser.userId),
      this.kakaoTemplateCatalogService.getTemplateCatalogForUser(sessionUser.userId, {
        includeDefaultGroup: includePartnerGroupTemplates,
        groupScope: sessionUser.accessOrigin === 'PUBL' ? 'PUBL' : null
      }),
      this.senderProfilesService.list(sessionUser.userId, {})
    ]);

    return {
      status: summary.resourceState.kakao,
      summary: {
        ...summary.kakao,
        approvedTemplateCount: catalog.summary.approvedCount
      },
      items: localSenders.senders.map((sender) => ({
        id: sender.localSenderProfileId,
        plusFriendId: sender.plusFriendId,
        senderKey: sender.senderKey,
        senderProfileType: sender.senderProfileType,
        status: sender.localStatus,
        createdAt: sender.createdAt ?? sender.createDate ?? null,
        updatedAt: sender.updatedAt ?? sender.createDate ?? null
      }))
    };
  }

  async getKakaoConnectBootstrap(sessionUser: SessionUser) {
    const [summary, categories, localSenders] = await Promise.all([
      this.readinessService.getReadinessForUser(sessionUser.userId),
      this.senderProfilesService.listCategories(),
      this.senderProfilesService.list(sessionUser.userId, {})
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
      existingChannels: localSenders.senders.map((sender) => ({
        id: sender.localSenderProfileId,
        plusFriendId: sender.plusFriendId,
        senderKey: sender.senderKey,
        senderProfileType: sender.senderProfileType,
        status: sender.localStatus,
        createdAt: sender.createdAt ?? sender.createDate ?? null,
        updatedAt: sender.updatedAt ?? sender.createDate ?? null
      }))
    };
  }

  async requestKakaoConnect(sessionUser: SessionUser, dto: CreateSenderProfileApplicationDto) {
    const result = await this.senderProfilesService.apply(sessionUser.userId, dto);

    return {
      requestAccepted: true,
      plusFriendId: dto.plusFriendId.trim(),
      phoneNo: dto.phoneNo.trim(),
      categoryCode: dto.categoryCode.trim(),
      message: result.header?.resultMessage || '인증 토큰을 요청했습니다.'
    };
  }

  async verifyKakaoConnect(sessionUser: SessionUser, dto: VerifySenderProfileTokenDto) {
    const result = await this.senderProfilesService.verifyToken(sessionUser.userId, dto);

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
