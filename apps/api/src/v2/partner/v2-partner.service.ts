import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ManagedUserStatus, UserRole } from '@prisma/client';
import { SessionUser } from '../../common/session-request.interface';
import { PrismaService } from '../../database/prisma.service';
import { V2KakaoTemplateCatalogService } from '../shared/v2-kakao-template-catalog.service';

@Injectable()
export class V2PartnerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kakaoTemplateCatalogService: V2KakaoTemplateCatalogService
  ) {}

  async getOverview(sessionUser: SessionUser) {
    if (sessionUser.accessOrigin !== 'PUBL') {
      return {
        summary: {
          clientCount: 0,
          userAccountCount: 0,
          smsReadyClientCount: 0,
          kakaoReadyClientCount: 0,
          managedUserCount: 0,
        },
        clients: [],
        userAccounts: [],
      };
    }

    const users = await this.prisma.adminUser.findMany({
      where: {
        accessOrigin: 'PUBL',
        role: UserRole.USER,
      },
      select: {
        id: true,
        loginId: true,
        email: true,
        accessOrigin: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    const clientItems = await Promise.all(
      users.map(async (user) => {
        const [
          approvedSenderNumberCount,
          activeSenderProfileCount,
          managedUserCount,
        ] = await Promise.all([
          this.prisma.senderNumber.count({
            where: {
              ownerUserId: user.id,
              status: 'APPROVED',
            },
          }),
          this.prisma.senderProfile.count({
            where: {
              ownerUserId: user.id,
              status: 'ACTIVE',
            },
          }),
          this.prisma.managedUser.count({
            where: {
              ownerUserId: user.id,
              status: {
                not: ManagedUserStatus.BLOCKED,
              },
            },
          }),
        ]);

        return {
          id: user.id,
          name: this.buildUserLabel(user),
          status: 'ACTIVE',
          accessOrigin: user.accessOrigin,
          userAccountCount: 1,
          approvedSenderNumberCount,
          activeSenderProfileCount,
          managedUserCount,
          primaryAdmin: {
            id: user.id,
            loginId: user.loginId,
            email: user.email,
          },
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        };
      }),
    );

    const userAccounts = clientItems
      .map((client) => ({
        id: client.id,
        clientId: client.id,
        clientName: client.name,
        loginId: client.primaryAdmin.loginId,
        email: client.primaryAdmin.email,
        accessOrigin: client.accessOrigin,
        approvedSenderNumberCount: client.approvedSenderNumberCount,
        activeSenderProfileCount: client.activeSenderProfileCount,
        managedUserCount: client.managedUserCount,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
      }))
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());

    return {
      summary: {
        clientCount: clientItems.length,
        userAccountCount: userAccounts.length,
        smsReadyClientCount: clientItems.filter((item) => item.approvedSenderNumberCount > 0).length,
        kakaoReadyClientCount: clientItems.filter((item) => item.activeSenderProfileCount > 0).length,
        managedUserCount: clientItems.reduce((sum, item) => sum + item.managedUserCount, 0),
      },
      clients: clientItems,
      userAccounts,
    };
  }

  async getClientDetail(sessionUser: SessionUser, clientId: string) {
    if (sessionUser.accessOrigin !== 'PUBL') {
      throw new ForbiddenException('PUBL 유입 계정만 접근할 수 있습니다.');
    }

    const clientUser = await this.prisma.adminUser.findFirst({
      where: {
        id: clientId,
        accessOrigin: 'PUBL',
        role: UserRole.USER,
      },
      select: {
        id: true,
        loginId: true,
        email: true,
        accessOrigin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!clientUser) {
      throw new NotFoundException('협업 이용처를 찾을 수 없습니다.');
    }

    const [senderNumbers, senderProfiles, summaryCounts, kakaoCatalog] = await Promise.all([
      this.prisma.senderNumber.findMany({
        where: { ownerUserId: clientUser.id },
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        select: {
          id: true,
          phoneNumber: true,
          type: true,
          status: true,
          reviewMemo: true,
          approvedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.senderProfile.findMany({
        where: { ownerUserId: clientUser.id },
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        select: {
          id: true,
          plusFriendId: true,
          senderKey: true,
          senderProfileType: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.collectClientSummaryCounts(clientUser.id),
      this.kakaoTemplateCatalogService.getTemplateCatalogForUser(clientUser.id, {
        includeDefaultGroup: false,
        groupScope: null,
      }),
    ]);

    return {
      client: {
        id: clientUser.id,
        name: this.buildUserLabel(clientUser),
        status: 'ACTIVE',
        accessOrigin: clientUser.accessOrigin,
        createdAt: clientUser.createdAt,
        updatedAt: clientUser.updatedAt,
      },
      summary: {
        userAccountCount: 1,
        approvedSenderNumberCount: senderNumbers.filter((item) => item.status === 'APPROVED').length,
        activeSenderProfileCount: senderProfiles.filter((item) => item.status === 'ACTIVE').length,
        managedUserCount: summaryCounts.managedUserCount,
        smsTemplateCount: summaryCounts.templateCount,
        enabledEventRuleCount: summaryCounts.enabledEventRuleCount,
        approvedKakaoTemplateCount: kakaoCatalog.summary.approvedCount,
        recentManualRequestCount: summaryCounts.recentManualRequestCount,
        recentBulkCampaignCount: summaryCounts.recentBulkCampaignCount,
      },
      userAccounts: [
        {
          id: clientUser.id,
          loginId: clientUser.loginId,
          email: clientUser.email,
          accessOrigin: clientUser.accessOrigin,
          createdAt: clientUser.createdAt,
          updatedAt: clientUser.updatedAt,
        },
      ],
      senderNumbers,
      senderProfiles,
    };
  }

  private async collectClientSummaryCounts(ownerUserId: string) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      managedUserCount,
      templateCount,
      enabledEventRuleCount,
      recentManualRequestCount,
      recentBulkSmsCount,
      recentBulkAlimtalkCount,
    ] = await Promise.all([
      this.prisma.managedUser.count({
        where: {
          ownerUserId,
          status: {
            not: ManagedUserStatus.BLOCKED,
          },
        },
      }),
      this.prisma.template.count({
        where: { ownerUserId },
      }),
      this.prisma.eventRule.count({
        where: {
          ownerUserId,
          enabled: true,
        },
      }),
      this.prisma.messageRequest.count({
        where: {
          ownerUserId,
          createdAt: {
            gte: sevenDaysAgo,
          },
        },
      }),
      this.prisma.bulkSmsCampaign.count({
        where: {
          ownerUserId,
          createdAt: {
            gte: sevenDaysAgo,
          },
        },
      }),
      this.prisma.bulkAlimtalkCampaign.count({
        where: {
          ownerUserId,
          createdAt: {
            gte: sevenDaysAgo,
          },
        },
      }),
    ]);

    return {
      managedUserCount,
      templateCount,
      enabledEventRuleCount,
      recentManualRequestCount,
      recentBulkCampaignCount: recentBulkSmsCount + recentBulkAlimtalkCount,
    };
  }

  private buildUserLabel(user: {
    email: string | null;
    loginId: string | null;
    id: string;
  }) {
    return user.email?.trim() || user.loginId?.trim() || user.id;
  }
}
