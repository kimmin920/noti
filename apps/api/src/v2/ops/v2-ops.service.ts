import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccessOrigin, UserRole } from '@prisma/client';
import { HealthService } from '../../health/health.service';
import { EnvService } from '../../common/env';
import { PrismaService } from '../../database/prisma.service';
import { DashboardService } from '../../dashboard/dashboard.service';
import { NhnService } from '../../nhn/nhn.service';
import { SenderNumbersService } from '../../sender-numbers/sender-numbers.service';
import { SmsQuotaService } from '../../sms-quota/sms-quota.service';
import { CreateDashboardNoticeDto, UpdateDashboardNoticeDto } from '../../dashboard/dashboard.dto';
import { SessionUser } from '../../common/session-request.interface';

type SendActivityRangeKey = '1d' | '7d' | '30d' | 'all' | 'custom';

type SendActivityUser = {
  adminUserId: string;
  userId: string;
  userLabel: string;
  loginId: string | null;
  email: string | null;
  role: UserRole | null;
  smsMessageCount: number;
  kakaoMessageCount: number;
  smsSenderNumbers: Map<
    string,
    {
      senderNumberId: string | null;
      label: string;
      count: number;
      manualCount: number;
      bulkCount: number;
      lastSentAtMs: number | null;
    }
  >;
  kakaoChannels: Map<
    string,
    {
      senderProfileId: string | null;
      label: string;
      senderKey: string | null;
      count: number;
      manualCount: number;
      bulkCount: number;
      lastSentAtMs: number | null;
    }
  >;
  recentActivities: Array<{
    id: string;
    channel: 'sms' | 'kakao';
    mode: 'MANUAL' | 'BULK';
    resourceLabel: string;
    count: number;
    createdAt: string;
  }>;
  lastSentAtMs: number | null;
};

@Injectable()
export class V2OpsService {
  constructor(
    private readonly healthService: HealthService,
    private readonly senderNumbersService: SenderNumbersService,
    private readonly prisma: PrismaService,
    private readonly nhnService: NhnService,
    private readonly env: EnvService,
    private readonly dashboardService: DashboardService,
    private readonly smsQuotaService: SmsQuotaService
  ) {}

  async getHealth() {
    return this.healthService.getOperationsHealth();
  }

  async getSenderNumberApplications() {
    const [applications, providerNumbers] = await Promise.all([
      this.senderNumbersService.listAllForOperator(),
      this.senderNumbersService.listRegisteredFromNhnForOperator()
    ]);

    const providerMap = new Map(
      providerNumbers.map((item) => [item.sendNo, item])
    );

    const items = applications.map((item) => {
      const provider = providerMap.get(item.phoneNumber) ?? null;

      return {
        id: item.id,
        userId: item.user.id,
        userLabel: item.user.name,
        phoneNumber: item.phoneNumber,
        type: item.type,
        status: item.status,
        reviewMemo: item.reviewMemo,
        approvedAt: item.approvedAt,
        reviewedBy: item.reviewedBy,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        attachments: {
          telecom: Boolean(item.telecomCertificatePath),
          consent: Boolean(item.consentDocumentPath),
          personalInfoConsent: Boolean(item.personalInfoConsentPath),
          idCardCopy: Boolean(item.idCardCopyPath),
          businessRegistration: Boolean(item.thirdPartyBusinessRegistrationPath),
          relationshipProof: Boolean(item.relationshipProofPath),
          additional: Boolean(item.additionalDocumentPath),
          employment: Boolean(item.employmentCertificatePath)
        },
        providerStatus: provider
          ? {
              registered: true,
              approved: provider.useYn === 'Y' && provider.blockYn === 'N',
              blocked: provider.blockYn === 'Y',
              blockReason: provider.blockReason,
              createdAt: provider.createDate,
              updatedAt: provider.updateDate
            }
          : {
              registered: false,
              approved: false,
              blocked: false,
              blockReason: null,
              createdAt: null,
              updatedAt: null
            }
      };
    });

    return {
      summary: {
        totalCount: items.length,
        submittedCount: items.filter((item) => item.status === 'SUBMITTED').length,
        supplementRequestedCount: items.filter((item) => item.status === 'SUPPLEMENT_REQUESTED').length,
        approvedCount: items.filter((item) => item.status === 'APPROVED').length,
        rejectedCount: items.filter((item) => item.status === 'REJECTED').length,
        providerApprovedCount: items.filter((item) => item.providerStatus.approved).length,
        providerBlockedCount: items.filter((item) => item.providerStatus.blocked).length
      },
      items
    };
  }

  async approveSenderNumberApplication(senderNumberId: string, reviewerId: string, memo?: string) {
    return this.senderNumbersService.approveForOperator(senderNumberId, reviewerId, memo);
  }

  async requestSenderNumberSupplement(senderNumberId: string, reviewerId: string, memo?: string) {
    return this.senderNumbersService.requestSupplementForOperator(senderNumberId, reviewerId, memo);
  }

  async rejectSenderNumberApplication(senderNumberId: string, reviewerId: string, memo?: string) {
    return this.senderNumbersService.rejectForOperator(senderNumberId, reviewerId, memo);
  }

  async getSenderNumberAttachment(senderNumberId: string, kind: 'telecom' | 'consent' | 'personalInfoConsent' | 'idCardCopy' | 'businessRegistration' | 'relationshipProof' | 'additional' | 'employment') {
    return this.senderNumbersService.getAttachmentForOperator(senderNumberId, kind);
  }

  async getKakaoTemplateApplications() {
    const configuredGroupKey = this.env.nhnDefaultSenderGroupKey.trim() || null;
    const senderProfiles = await this.prisma.senderProfile.findMany({
      select: {
        id: true,
        ownerUserId: true,
        plusFriendId: true,
        senderKey: true,
        senderProfileType: true,
        status: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: [{ updatedAt: 'desc' }]
    });
    const owners = await this.loadOwnerDirectory(senderProfiles.map((profile) => profile.ownerUserId));

    const [defaultGroup, defaultGroupTemplates, senderProfileBuckets] = await Promise.all([
      this.fetchDefaultGroup(configuredGroupKey),
      this.fetchTemplates(configuredGroupKey),
      Promise.all(
        senderProfiles.map(async (profile) => ({
          profile,
          templates: await this.fetchTemplates(profile.senderKey)
        }))
      )
    ]);

    const items = [
      ...defaultGroupTemplates.map((template) =>
        this.serializeKakaoTemplateItem({
          source: 'GROUP',
          userId: null,
          userLabel: '공용',
          ownerLabel: defaultGroup?.groupName || '기본 그룹',
          ownerKey: configuredGroupKey,
          template
        })
      ),
      ...senderProfileBuckets.flatMap(({ profile, templates }) =>
        templates.map((template) =>
          this.serializeKakaoTemplateItem({
            source: 'SENDER_PROFILE',
            userId: profile.ownerUserId,
            userLabel: this.buildOwnerLabel(owners.get(profile.ownerUserId)),
            ownerLabel: profile.plusFriendId,
            ownerKey: profile.senderKey,
            template
          })
        )
      )
    ].sort(compareKakaoTemplateCreatedAtDesc);

    const approvedCount = items.filter((item) => item.providerStatus === 'APR').length;
    const rejectedCount = items.filter((item) => item.providerStatus === 'REJ').length;
    const defaultGroupCount = items.filter((item) => item.source === 'GROUP').length;
    const connectedChannelCount = items.length - defaultGroupCount;

    return {
      summary: {
        totalCount: items.length,
        approvedCount,
        pendingCount: items.length - approvedCount - rejectedCount,
        rejectedCount,
        defaultGroupCount,
        connectedChannelCount
      },
      items
    };
  }

  async getKakaoTemplateApplicationDetail(params: {
    senderKey: string;
    templateCode: string;
    userId?: string | null;
    source?: 'GROUP' | 'SENDER_PROFILE' | 'DEFAULT_GROUP';
  }) {
    const senderKey = params.senderKey.trim();
    const templateCode = params.templateCode.trim();

    if (!senderKey || !templateCode) {
      throw new BadRequestException('senderKey와 templateCode는 비어 있을 수 없습니다.');
    }

    const configuredGroupKey = this.env.nhnDefaultSenderGroupKey.trim() || null;
    const requestedSource = params.source === 'DEFAULT_GROUP' ? 'GROUP' : params.source;
    const source = requestedSource || (configuredGroupKey && senderKey === configuredGroupKey ? 'GROUP' : 'SENDER_PROFILE');

    const [detail, senderProfile, defaultGroup] = await Promise.all([
      this.nhnService.fetchTemplateDetailForSenderOrGroup(senderKey, templateCode),
      source === 'SENDER_PROFILE'
        ? this.prisma.senderProfile.findFirst({
            where: {
              senderKey,
              ...(params.userId ? { ownerUserId: params.userId } : {})
            },
            select: {
              id: true,
              ownerUserId: true,
              plusFriendId: true,
              senderKey: true
            }
          })
        : Promise.resolve(null),
      source === 'GROUP' ? this.fetchDefaultGroup(configuredGroupKey) : Promise.resolve(null)
    ]);
    const senderProfileOwner = senderProfile ? await this.loadOwnerDirectory([senderProfile.ownerUserId]) : new Map();

    if (!detail) {
      throw new NotFoundException('알림톡 템플릿 상세를 불러올 수 없습니다.');
    }

    const providerStatus = normalizeKakaoTemplateStatus(detail.status);
    const comments = uniqueTemplateComments(detail.comments);
    const rejectedReason = providerStatus === 'REJ' ? detail.rejectedReason ?? comments[0] ?? null : null;
    const displayComments = uniqueTemplateComments([rejectedReason, ...comments]);

    return {
      template: {
        source,
        userId: senderProfile?.ownerUserId ?? null,
        userLabel: senderProfile ? this.buildOwnerLabel(senderProfileOwner.get(senderProfile.ownerUserId)) : '공용',
        ownerLabel: source === 'GROUP' ? defaultGroup?.groupName || '기본 그룹' : senderProfile?.plusFriendId || '연결 채널',
        plusFriendId: detail.plusFriendId,
        senderKey: detail.senderKey,
        plusFriendType: detail.plusFriendType,
        providerStatus,
        providerStatusRaw: detail.status,
        providerStatusName: detail.statusName,
        templateCode: detail.templateCode,
        kakaoTemplateCode: detail.kakaoTemplateCode,
        name: detail.templateName || templateCode,
        body: detail.templateContent || '',
        requiredVariables: extractTemplateVariables(detail.templateContent || ''),
        messageType: detail.templateMessageType,
        emphasizeType: detail.templateEmphasizeType,
        extra: detail.templateExtra,
        title: detail.templateTitle,
        subtitle: detail.templateSubtitle,
        imageName: detail.templateImageName,
        imageUrl: detail.templateImageUrl,
        securityFlag: detail.securityFlag,
        categoryCode: detail.categoryCode,
        createdAt: detail.createDate,
        updatedAt: detail.updateDate,
        buttons: detail.buttons,
        quickReplies: detail.quickReplies,
        comment: displayComments.join('\n\n') || null,
        comments,
        rejectedReason
      }
    };
  }

  async getAdminUsers() {
    const items = await this.prisma.adminUser.findMany({
      select: {
        id: true,
        providerUserId: true,
        loginProvider: true,
        loginId: true,
        email: true,
        role: true,
        accessOrigin: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: [{ createdAt: 'desc' }]
    });

    const partnerAdminCount = items.filter((item) => item.role === 'PARTNER_ADMIN').length;
    const superAdminCount = items.filter((item) => item.role === 'SUPER_ADMIN').length;
    const userCount = items.filter((item) => item.role === 'USER').length;
    const publOriginCount = items.filter((item) => item.accessOrigin === 'PUBL').length;
    const directOriginCount = items.filter((item) => item.accessOrigin === 'DIRECT').length;

    return {
      summary: {
        totalCount: items.length,
        userCount,
        partnerAdminCount,
        superAdminCount,
        publOriginCount,
        directOriginCount
      },
      items: items.map((item) => ({
        id: item.id,
        providerUserId: item.providerUserId,
        loginId: item.loginId,
        email: item.email,
        loginProvider: item.loginProvider,
        role: item.role,
        accessOrigin: item.accessOrigin,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }))
    };
  }

  async updateAdminUserRole(adminUserId: string, role: 'USER' | 'PARTNER_ADMIN') {
    const user = await this.prisma.adminUser.findUnique({
      where: { id: adminUserId },
      select: {
        id: true,
        role: true
      }
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('운영자 권한은 환경설정으로만 관리할 수 있습니다.');
    }

    const updated = await this.prisma.adminUser.update({
      where: { id: adminUserId },
      data: { role }
    });

    return {
      id: updated.id,
      role: updated.role
    };
  }

  async updateAdminUserAccessOrigin(adminUserId: string, accessOrigin: AccessOrigin) {
    const user = await this.prisma.adminUser.findUnique({
      where: { id: adminUserId },
      select: {
        id: true,
        role: true
      }
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('운영자 권한은 환경설정으로만 관리할 수 있습니다.');
    }

    const updated = await this.prisma.adminUser.update({
      where: { id: adminUserId },
      data: { accessOrigin }
    });

    return {
      id: updated.id,
      accessOrigin: updated.accessOrigin
    };
  }

  async getManagedUsers() {
    const items = await this.prisma.managedUser.findMany({
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
    });
    const owners = await this.loadOwnerDirectory(items.map((item) => item.ownerUserId));

    const activeCount = items.filter((item) => item.status === 'ACTIVE').length;
    const inactiveCount = items.filter((item) => item.status === 'INACTIVE').length;
    const dormantCount = items.filter((item) => item.status === 'DORMANT').length;
    const blockedCount = items.filter((item) => item.status === 'BLOCKED').length;

    return {
      summary: {
        totalCount: items.length,
        activeCount,
        inactiveCount,
        dormantCount,
        blockedCount,
        userCount: new Set(items.map((item) => item.ownerUserId)).size,
        sourceCount: new Set(items.map((item) => item.source)).size
      },
      items: items.map((item) => ({
        id: item.id,
        userId: item.ownerUserId,
        userLabel: this.buildOwnerLabel(owners.get(item.ownerUserId)),
        userStatus: 'ACTIVE',
        source: item.source,
        externalId: item.externalId,
        name: item.name,
        email: item.email,
        phone: item.phone,
        status: item.status,
        userType: item.userType,
        segment: item.segment,
        gradeOrLevel: item.gradeOrLevel,
        marketingConsent: item.marketingConsent,
        registeredAt: item.registeredAt,
        lastLoginAt: item.lastLoginAt,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }))
    };
  }

  async getNotices() {
    const items = await this.dashboardService.listInternalNotices();

    return {
      summary: {
        totalCount: items.length,
        pinnedCount: items.filter((item: { isPinned: boolean }) => item.isPinned).length
      },
      items
    };
  }

  async createNotice(dto: CreateDashboardNoticeDto, sessionUser: SessionUser) {
    return this.dashboardService.createNotice(dto, sessionUser);
  }

  async updateNotice(noticeId: string, dto: UpdateDashboardNoticeDto) {
    return this.dashboardService.updateNotice(noticeId, dto);
  }

  async archiveNotice(noticeId: string) {
    return this.dashboardService.archiveNotice(noticeId);
  }

  async getSmsQuotas() {
    return this.smsQuotaService.listUserSmsQuotas(new Date());
  }

  async updateUserSmsQuota(userId: string, monthlySmsLimit: number) {
    return this.smsQuotaService.updateUserMonthlySmsLimit(userId, monthlySmsLimit);
  }

  async getSendActivity(params?: {
    range?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const resolvedRange = resolveSendActivityRange(params);
    const activity = await this.buildSendActivity(resolvedRange.since, resolvedRange.until);

    const senderNumberIds = new Set<string>();
    const senderProfileIds = new Set<string>();

    for (const item of activity.items) {
      for (const entry of item.smsSenderNumbers) {
        if (entry.senderNumberId) {
          senderNumberIds.add(entry.senderNumberId);
        }
      }

      for (const entry of item.kakaoChannels) {
        if (entry.senderProfileId) {
          senderProfileIds.add(entry.senderProfileId);
        }
      }
    }

    return {
      range: {
        key: resolvedRange.key,
        label: resolvedRange.label,
        since: resolvedRange.since?.toISOString() ?? null,
        startDate: resolvedRange.startDate,
        endDate: resolvedRange.endDate
      },
      summary: {
        userCount: activity.items.length,
        activeUserCount: activity.items.filter((item) => item.smsMessageCount > 0 || item.kakaoMessageCount > 0).length,
        smsMessageCount: activity.items.reduce((sum, item) => sum + item.smsMessageCount, 0),
        kakaoMessageCount: activity.items.reduce((sum, item) => sum + item.kakaoMessageCount, 0),
        senderNumberCount: senderNumberIds.size,
        channelCount: senderProfileIds.size
      },
      items: activity.items.map((item) => ({
        adminUserId: item.adminUserId,
        userId: item.userId,
        userLabel: item.userLabel,
        loginId: item.loginId,
        email: item.email,
        role: item.role,
        smsMessageCount: item.smsMessageCount,
        smsSenderNumberCount: item.smsSenderNumbers.length,
        kakaoMessageCount: item.kakaoMessageCount,
        kakaoChannelCount: item.kakaoChannels.length,
        lastSentAt: item.lastSentAt
      }))
    };
  }

  async getSendActivityDetail(
    adminUserId: string,
    params?: {
      range?: string;
      startDate?: string;
      endDate?: string;
    }
  ) {
    const resolvedRange = resolveSendActivityRange(params);
    const activity = await this.buildSendActivity(resolvedRange.since, resolvedRange.until, adminUserId);

    if (!activity.items.length) {
      throw new NotFoundException('발송 이력을 확인할 수 있는 운영 계정을 찾지 못했습니다.');
    }

    const item = activity.items[0];

    return {
      range: {
        key: resolvedRange.key,
        label: resolvedRange.label,
        since: resolvedRange.since?.toISOString() ?? null,
        startDate: resolvedRange.startDate,
        endDate: resolvedRange.endDate
      },
      user: {
        adminUserId: item.adminUserId,
        userId: item.userId,
        userLabel: item.userLabel,
        loginId: item.loginId,
        email: item.email,
        role: item.role
      },
      summary: {
        smsMessageCount: item.smsMessageCount,
        smsSenderNumberCount: item.smsSenderNumbers.length,
        kakaoMessageCount: item.kakaoMessageCount,
        kakaoChannelCount: item.kakaoChannels.length,
        lastSentAt: item.lastSentAt
      },
      smsSenderNumbers: item.smsSenderNumbers,
      kakaoChannels: item.kakaoChannels,
      recentActivities: item.recentActivities
    };
  }

  private async fetchTemplates(senderKey: string | null) {
    if (!senderKey) {
      return [];
    }

    try {
      const response = await this.nhnService.fetchTemplatesForSenderOrGroup(senderKey, {
        pageNum: 1,
        pageSize: 100
      });
      return response.templates;
    } catch {
      return [];
    }
  }

  private async fetchDefaultGroup(groupSenderKey: string | null) {
    if (!groupSenderKey) {
      return null;
    }

    try {
      return await this.nhnService.fetchSenderGroup(groupSenderKey);
    } catch {
      return null;
    }
  }

  private async buildSendActivity(since: Date | null, until: Date | null, adminUserId?: string | null) {
    const [adminUsers, manualRequests, bulkSmsCampaigns, bulkAlimtalkCampaigns] = await Promise.all([
      this.prisma.adminUser.findMany({
        where: adminUserId
          ? { id: adminUserId }
          : {
              role: {
                not: UserRole.SUPER_ADMIN
              }
            },
        select: {
          id: true,
          loginId: true,
          email: true,
          providerUserId: true,
          role: true
        }
      }),
      this.prisma.messageRequest.findMany({
        where: {
          ...buildCreatedAtFilter(since, until),
          eventKey: {
            in: ['MANUAL_SMS_SEND', 'MANUAL_ALIMTALK_SEND', 'MANUAL_BRAND_MESSAGE_SEND']
          }
        },
        select: {
          id: true,
          ownerUserId: true,
          eventKey: true,
          metadataJson: true,
          createdAt: true,
          resolvedChannel: true,
          resolvedSenderNumberId: true,
          resolvedSenderProfileId: true,
          resolvedSenderNumber: {
            select: {
              id: true,
              phoneNumber: true
            }
          },
          resolvedSenderProfile: {
            select: {
              id: true,
              plusFriendId: true,
              senderKey: true
            }
          }
        }
      }),
      this.prisma.bulkSmsCampaign.findMany({
        where: {
          ...buildCreatedAtFilter(since, until),
          ...(adminUserId ? { ownerUserId: adminUserId } : {})
        },
        select: {
          id: true,
          createdAt: true,
          ownerUserId: true,
          requestedBy: true,
          totalRecipientCount: true,
          skippedNoPhoneCount: true,
          duplicatePhoneCount: true,
          senderNumberId: true,
          senderNumber: {
            select: {
              id: true,
              phoneNumber: true
            }
          }
        }
      }),
      this.prisma.bulkAlimtalkCampaign.findMany({
        where: {
          ...buildCreatedAtFilter(since, until),
          ...(adminUserId ? { ownerUserId: adminUserId } : {})
        },
        select: {
          id: true,
          createdAt: true,
          ownerUserId: true,
          requestedBy: true,
          totalRecipientCount: true,
          skippedNoPhoneCount: true,
          duplicatePhoneCount: true,
          senderProfileId: true,
          senderProfile: {
            select: {
              id: true,
              plusFriendId: true,
              senderKey: true
            }
          }
        }
      })
    ]);

    const userDirectory = new Map(adminUsers.map((item) => [item.id, item]));
    const userMap = new Map<string, SendActivityUser>();

    const ensureUser = (params: {
      adminUserId: string;
      userId: string;
      loginId: string | null;
      email: string | null;
      role: UserRole | null;
    }) => {
      const existing = userMap.get(params.adminUserId);
      if (existing) {
        return existing;
      }

      const next: SendActivityUser = {
        adminUserId: params.adminUserId,
        userId: params.userId,
        userLabel: params.email?.trim() || params.loginId?.trim() || params.userId,
        loginId: params.loginId,
        email: params.email,
        role: params.role,
        smsMessageCount: 0,
        kakaoMessageCount: 0,
        smsSenderNumbers: new Map(),
        kakaoChannels: new Map(),
        recentActivities: [],
        lastSentAtMs: null
      };

      userMap.set(params.adminUserId, next);
      return next;
    };

    for (const adminUser of adminUsers) {
      ensureUser({
        adminUserId: adminUser.id,
        userId: adminUser.id,
        loginId: adminUser.loginId,
        email: adminUser.email,
        role: adminUser.role
      });
    }

    const ensureUnknownUser = (initiatorId: string) =>
      ensureUser({
        adminUserId: initiatorId,
        userId: initiatedByDirectory(initiatorId, userDirectory).id,
        loginId: initiatedByDirectory(initiatorId, userDirectory).loginId,
        email: initiatedByDirectory(initiatorId, userDirectory).email,
        role: initiatedByDirectory(initiatorId, userDirectory).role
      });

    const touchLastSentAt = (user: SendActivityUser, sentAtMs: number) => {
      if (!user.lastSentAtMs || sentAtMs > user.lastSentAtMs) {
        user.lastSentAtMs = sentAtMs;
      }
    };

    const pushRecentActivity = (
      user: SendActivityUser,
      activity: SendActivityUser['recentActivities'][number]
    ) => {
      user.recentActivities.push(activity);
    };

    const accumulateSmsSenderNumber = (
      user: SendActivityUser,
      senderNumberId: string | null,
      label: string,
      count: number,
      mode: 'manual' | 'bulk',
      sentAtMs: number
    ) => {
      const key = senderNumberId || `phone:${label}`;
      const existing = user.smsSenderNumbers.get(key) || {
        senderNumberId,
        label,
        count: 0,
        manualCount: 0,
        bulkCount: 0,
        lastSentAtMs: null as number | null
      };

      existing.count += count;
      if (mode === 'manual') {
        existing.manualCount += count;
      } else {
        existing.bulkCount += count;
      }

      if (!existing.lastSentAtMs || sentAtMs > existing.lastSentAtMs) {
        existing.lastSentAtMs = sentAtMs;
      }

      user.smsSenderNumbers.set(key, existing);
    };

    const accumulateKakaoChannel = (
      user: SendActivityUser,
      senderProfileId: string | null,
      label: string,
      senderKey: string | null,
      count: number,
      mode: 'manual' | 'bulk',
      sentAtMs: number
    ) => {
      const key = senderProfileId || senderKey || `channel:${label}`;
      const existing = user.kakaoChannels.get(key) || {
        senderProfileId,
        label,
        senderKey,
        count: 0,
        manualCount: 0,
        bulkCount: 0,
        lastSentAtMs: null as number | null
      };

      existing.count += count;
      if (mode === 'manual') {
        existing.manualCount += count;
      } else {
        existing.bulkCount += count;
      }

      if (!existing.lastSentAtMs || sentAtMs > existing.lastSentAtMs) {
        existing.lastSentAtMs = sentAtMs;
      }

      user.kakaoChannels.set(key, existing);
    };

    for (const request of manualRequests) {
      const initiatedBy = request.ownerUserId || extractInitiatedBy(request.metadataJson);

      if (!initiatedBy) {
        continue;
      }

      if (adminUserId && initiatedBy !== adminUserId) {
        continue;
      }

      const user = userMap.get(initiatedBy) || ensureUnknownUser(initiatedBy);
      const sentAtMs = request.createdAt.getTime();

      if (request.resolvedChannel === 'SMS') {
        user.smsMessageCount += 1;
        accumulateSmsSenderNumber(
          user,
          request.resolvedSenderNumberId,
          request.resolvedSenderNumber?.phoneNumber || '확인되지 않은 발신번호',
          1,
          'manual',
          sentAtMs
        );
        pushRecentActivity(user, {
          id: request.id,
          channel: 'sms',
          mode: 'MANUAL',
          resourceLabel: request.resolvedSenderNumber?.phoneNumber || '확인되지 않은 발신번호',
          count: 1,
          createdAt: request.createdAt.toISOString()
        });
      } else if (request.resolvedChannel === 'ALIMTALK' || request.resolvedChannel === 'BRAND_MESSAGE') {
        const channelLabel = request.resolvedSenderProfile?.plusFriendId || request.resolvedSenderProfile?.senderKey || '확인되지 않은 채널';
        user.kakaoMessageCount += 1;
        accumulateKakaoChannel(
          user,
          request.resolvedSenderProfileId,
          channelLabel,
          request.resolvedSenderProfile?.senderKey || null,
          1,
          'manual',
          sentAtMs
        );
        pushRecentActivity(user, {
          id: request.id,
          channel: 'kakao',
          mode: 'MANUAL',
          resourceLabel: channelLabel,
          count: 1,
          createdAt: request.createdAt.toISOString()
        });
      }

      touchLastSentAt(user, sentAtMs);
    }

    for (const campaign of bulkSmsCampaigns) {
      const campaignOwnerId = campaign.ownerUserId || campaign.requestedBy;
      if (!campaignOwnerId) {
        continue;
      }

      const eligibleCount = resolveCampaignMessageCount(
        campaign.totalRecipientCount,
        campaign.skippedNoPhoneCount,
        campaign.duplicatePhoneCount
      );

      if (eligibleCount <= 0) {
        continue;
      }

      const user = userMap.get(campaignOwnerId) || ensureUnknownUser(campaignOwnerId);
      const sentAtMs = campaign.createdAt.getTime();

      user.smsMessageCount += eligibleCount;
      accumulateSmsSenderNumber(
        user,
        campaign.senderNumberId,
        campaign.senderNumber.phoneNumber,
        eligibleCount,
        'bulk',
        sentAtMs
      );
      pushRecentActivity(user, {
        id: campaign.id,
        channel: 'sms',
        mode: 'BULK',
        resourceLabel: campaign.senderNumber.phoneNumber,
        count: eligibleCount,
        createdAt: campaign.createdAt.toISOString()
      });
      touchLastSentAt(user, sentAtMs);
    }

    for (const campaign of bulkAlimtalkCampaigns) {
      const campaignOwnerId = campaign.ownerUserId || campaign.requestedBy;
      if (!campaignOwnerId) {
        continue;
      }

      const eligibleCount = resolveCampaignMessageCount(
        campaign.totalRecipientCount,
        campaign.skippedNoPhoneCount,
        campaign.duplicatePhoneCount
      );

      if (eligibleCount <= 0) {
        continue;
      }

      const user = userMap.get(campaignOwnerId) || ensureUnknownUser(campaignOwnerId);
      const sentAtMs = campaign.createdAt.getTime();
      const channelLabel = campaign.senderProfile.plusFriendId || campaign.senderProfile.senderKey;

      user.kakaoMessageCount += eligibleCount;
      accumulateKakaoChannel(
        user,
        campaign.senderProfileId,
        channelLabel,
        campaign.senderProfile.senderKey,
        eligibleCount,
        'bulk',
        sentAtMs
      );
      pushRecentActivity(user, {
        id: campaign.id,
        channel: 'kakao',
        mode: 'BULK',
        resourceLabel: channelLabel,
        count: eligibleCount,
        createdAt: campaign.createdAt.toISOString()
      });
      touchLastSentAt(user, sentAtMs);
    }

    return {
      items: [...userMap.values()]
        .map((item) => ({
          ...item,
          smsSenderNumbers: [...item.smsSenderNumbers.values()]
            .map((entry) => ({
              ...entry,
              lastSentAt: entry.lastSentAtMs ? new Date(entry.lastSentAtMs).toISOString() : null
            }))
            .sort(compareBreakdownEntries),
          kakaoChannels: [...item.kakaoChannels.values()]
            .map((entry) => ({
              ...entry,
              lastSentAt: entry.lastSentAtMs ? new Date(entry.lastSentAtMs).toISOString() : null
            }))
            .sort(compareBreakdownEntries),
          recentActivities: item.recentActivities
            .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
            .slice(0, 10),
          lastSentAt: item.lastSentAtMs ? new Date(item.lastSentAtMs).toISOString() : null
        }))
        .sort(compareSendActivityUsers)
    };
  }

  private serializeKakaoTemplateItem(params: {
    source: 'GROUP' | 'SENDER_PROFILE';
    userId: string | null;
    userLabel: string;
    ownerLabel: string | null;
    ownerKey: string | null;
    template: Awaited<ReturnType<NhnService['fetchTemplateDetailForSenderOrGroup']>>;
  }) {
    const templateCode =
      params.template?.templateCode ||
      params.template?.kakaoTemplateCode ||
      `${params.source.toLowerCase()}_${params.ownerKey || 'default'}_template`;

    return {
      id: `ops-kakao:${params.source}:${params.userId || 'shared'}:${params.ownerKey || 'none'}:${templateCode}`,
      source: params.source,
      userId: params.userId,
      userLabel: params.userLabel,
      ownerLabel: params.ownerLabel || (params.source === 'GROUP' ? '기본 그룹' : '연결 채널'),
      ownerKey: params.ownerKey,
      plusFriendId: params.template?.plusFriendId || null,
      senderKey: params.template?.senderKey || params.ownerKey,
      providerStatus: normalizeKakaoTemplateStatus(params.template?.status),
      providerStatusRaw: params.template?.status || null,
      providerStatusName: params.template?.statusName || null,
      templateCode: params.template?.templateCode || null,
      kakaoTemplateCode: params.template?.kakaoTemplateCode || null,
      messageType: params.template?.templateMessageType || null,
      name:
        params.template?.templateName ||
        params.template?.templateCode ||
        params.template?.kakaoTemplateCode ||
        '이름 없는 템플릿',
      body: params.template?.templateContent || '',
      createdAt: params.template?.createDate || null,
      updatedAt: params.template?.updateDate || null
    };
  }

  private async loadOwnerDirectory(ownerUserIds: string[]) {
    const uniqueOwnerUserIds = [...new Set(ownerUserIds.filter(Boolean))];
    if (uniqueOwnerUserIds.length === 0) {
      return new Map<string, {
        id: string;
        loginId: string | null;
        email: string | null;
        providerUserId: string;
        role: UserRole;
      }>();
    }

    const owners = await this.prisma.adminUser.findMany({
      where: {
        id: {
          in: uniqueOwnerUserIds
        }
      },
      select: {
        id: true,
        loginId: true,
        email: true,
        providerUserId: true,
        role: true
      }
    });

    return new Map(owners.map((owner) => [owner.id, owner]));
  }

  private buildOwnerLabel(
    owner:
      | {
          id: string;
          loginId: string | null;
          email: string | null;
          providerUserId?: string | null;
        }
      | undefined
  ) {
    if (!owner) {
      return '알 수 없는 계정';
    }

    return owner.email?.trim() || owner.loginId?.trim() || owner.providerUserId?.trim() || owner.id;
  }
}

function initiatedByDirectory(
  ownerUserId: string,
  directory: Map<string, { id: string; loginId: string | null; email: string | null; role: UserRole }>
) {
  return directory.get(ownerUserId) || {
    id: ownerUserId,
    loginId: null,
    email: null,
    role: null as UserRole | null
  };
}

function extractInitiatedBy(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>).initiatedBy;
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function resolveCampaignMessageCount(totalRecipientCount: number, skippedNoPhoneCount: number, duplicatePhoneCount: number) {
  return Math.max(0, totalRecipientCount - skippedNoPhoneCount - duplicatePhoneCount);
}

function compareBreakdownEntries(
  left: { count: number; lastSentAt: string | null; label: string },
  right: { count: number; lastSentAt: string | null; label: string }
) {
  if (right.count !== left.count) {
    return right.count - left.count;
  }

  const leftSentAt = new Date(left.lastSentAt || 0).getTime();
  const rightSentAt = new Date(right.lastSentAt || 0).getTime();
  if (rightSentAt !== leftSentAt) {
    return rightSentAt - leftSentAt;
  }

  return left.label.localeCompare(right.label, 'ko');
}

function compareSendActivityUsers(
  left: {
    smsMessageCount: number;
    kakaoMessageCount: number;
    lastSentAt: string | null;
    loginId: string | null;
    email: string | null;
    userLabel: string;
  },
  right: {
    smsMessageCount: number;
    kakaoMessageCount: number;
    lastSentAt: string | null;
    loginId: string | null;
    email: string | null;
    userLabel: string;
  }
) {
  const leftTotal = left.smsMessageCount + left.kakaoMessageCount;
  const rightTotal = right.smsMessageCount + right.kakaoMessageCount;

  if (rightTotal !== leftTotal) {
    return rightTotal - leftTotal;
  }

  const leftSentAt = new Date(left.lastSentAt || 0).getTime();
  const rightSentAt = new Date(right.lastSentAt || 0).getTime();
  if (rightSentAt !== leftSentAt) {
    return rightSentAt - leftSentAt;
  }

  const leftLabel = left.loginId || left.email || '';
  const rightLabel = right.loginId || right.email || '';
  if (leftLabel !== rightLabel) {
    return leftLabel.localeCompare(rightLabel, 'ko');
  }

  return left.userLabel.localeCompare(right.userLabel, 'ko');
}

function resolveSendActivityRange(params?: {
  range?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}): {
  key: SendActivityRangeKey;
  label: string;
  since: Date | null;
  until: Date | null;
  startDate: string | null;
  endDate: string | null;
} {
  const now = new Date();
  const startDate = normalizeDateInput(params?.startDate);
  const endDate = normalizeDateInput(params?.endDate);

  if (startDate || endDate) {
    if (!startDate || !endDate) {
      throw new BadRequestException('시작일과 종료일을 모두 입력하세요.');
    }

    if (startDate > endDate) {
      throw new BadRequestException('시작일은 종료일보다 늦을 수 없습니다.');
    }

    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);

    return {
      key: 'custom',
      label: `${formatDateLabel(startDate)} ~ ${formatDateLabel(endDate)}`,
      since: start,
      until: new Date(end.getTime() + 24 * 60 * 60 * 1000),
      startDate,
      endDate
    };
  }

  const normalized = String(params?.range || '30d').toLowerCase();

  if (normalized === '1d') {
    return {
      key: '1d',
      label: '오늘',
      since: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      until: null,
      startDate: null,
      endDate: null
    };
  }

  if (normalized === '7d') {
    return {
      key: '7d',
      label: '최근 7일',
      since: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      until: null,
      startDate: null,
      endDate: null
    };
  }

  if (normalized === 'all') {
    return {
      key: 'all',
      label: '전체',
      since: null,
      until: null,
      startDate: null,
      endDate: null
    };
  }

  return {
    key: '30d',
    label: '최근 30일',
    since: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    until: null,
    startDate: null,
    endDate: null
  };
}

function normalizeDateInput(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new BadRequestException('날짜 형식이 올바르지 않습니다.');
  }

  return trimmed;
}

function formatDateLabel(value: string) {
  const [year, month, day] = value.split('-');
  return `${year}.${month}.${day}`;
}

function buildCreatedAtFilter(since: Date | null, until: Date | null) {
  if (!since && !until) {
    return {};
  }

  return {
    createdAt: {
      ...(since ? { gte: since } : {}),
      ...(until ? { lt: until } : {})
    }
  };
}

function normalizeKakaoTemplateStatus(status: string | null | undefined) {
  const normalized = String(status || '').toUpperCase();

  if (normalized === 'APR' || normalized === 'TSC03') {
    return 'APR';
  }

  if (normalized === 'REJ' || normalized === 'TSC04') {
    return 'REJ';
  }

  return 'REQ';
}

function extractTemplateVariables(body: string) {
  return [...new Set((body.match(/#\{([^}]+)\}/g) || []).map((token) => token.slice(2, -1).trim()).filter(Boolean))];
}

function uniqueTemplateComments(comments: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const uniqueComments: string[] = [];

  for (const comment of comments) {
    const message = comment?.trim();

    if (!message) {
      continue;
    }

    const key = message.replace(/\s+/g, ' ');

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueComments.push(message);
  }

  return uniqueComments;
}

function compareKakaoTemplateCreatedAtDesc(
  left: { createdAt: string | null; updatedAt: string | null; name: string },
  right: { createdAt: string | null; updatedAt: string | null; name: string }
) {
  const leftValue = new Date(left.createdAt || left.updatedAt || 0).getTime();
  const rightValue = new Date(right.createdAt || right.updatedAt || 0).getTime();

  if (rightValue !== leftValue) {
    return rightValue - leftValue;
  }

  return left.name.localeCompare(right.name, 'ko');
}
