import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ManagedUserStatus, Prisma, TemplateStatus } from '@prisma/client';
import { SessionUser } from '../../common/session-request.interface';
import { CreateBulkAlimtalkCampaignDto } from '../../bulk-alimtalk/bulk-alimtalk.dto';
import { BulkAlimtalkService } from '../../bulk-alimtalk/bulk-alimtalk.service';
import { CreateBulkBrandMessageCampaignDto } from '../../bulk-brand-message/bulk-brand-message.dto';
import { BulkBrandMessageService } from '../../bulk-brand-message/bulk-brand-message.service';
import { CreateBulkSmsCampaignDto } from '../../bulk-sms/bulk-sms.dto';
import { BulkSmsService } from '../../bulk-sms/bulk-sms.service';
import { PrismaService } from '../../database/prisma.service';
import { NhnBrandTemplate, NhnService } from '../../nhn/nhn.service';
import { ProviderResultsService } from '../../provider-results/provider-results.service';
import { buildUserFieldDefinitions, normalizeManagedUserPhone, USER_SYSTEM_FIELDS } from '../../users/users.mapping';
import { V2KakaoTemplateCatalogService } from '../shared/v2-kakao-template-catalog.service';
import { V2ReadinessService } from '../shared/v2-readiness.service';
import { canUsePartnerGroupTemplates } from '../v2-auth.utils';

type CampaignChannel = 'sms' | 'kakao' | 'brand';
type RecipientStatusFilter = 'all' | ManagedUserStatus;

type SmsCampaignListItem = Prisma.BulkSmsCampaignGetPayload<{
  select: {
    id: true;
    title: true;
    status: true;
    scheduledAt: true;
    nhnRequestId: true;
    totalRecipientCount: true;
    skippedNoPhoneCount: true;
    duplicatePhoneCount: true;
    createdAt: true;
    updatedAt: true;
    senderNumber: {
      select: {
        id: true;
        phoneNumber: true;
        status: true;
      };
    };
    template: {
      select: {
        id: true;
        name: true;
        status: true;
      };
    };
    recipients: {
      select: {
        id: true;
        recipientPhone: true;
        recipientSeq: true;
        status: true;
      };
    };
  };
}>;

type KakaoCampaignListItem = Prisma.BulkAlimtalkCampaignGetPayload<{
  select: {
    id: true;
    title: true;
    status: true;
    scheduledAt: true;
    nhnRequestId: true;
    totalRecipientCount: true;
    skippedNoPhoneCount: true;
    duplicatePhoneCount: true;
    createdAt: true;
    updatedAt: true;
    templateSource: true;
    templateName: true;
    templateCode: true;
    senderProfile: {
      select: {
        id: true;
        plusFriendId: true;
        status: true;
      };
    };
    providerTemplate: {
      select: {
        id: true;
        providerStatus: true;
        template: {
          select: {
            id: true;
            name: true;
          };
        };
      };
    };
    recipients: {
      select: {
        id: true;
        recipientPhone: true;
        recipientSeq: true;
        status: true;
      };
    };
  };
}>;

type BrandCampaignListItem = Prisma.BulkBrandMessageCampaignGetPayload<{
  select: {
    id: true;
    title: true;
    status: true;
    scheduledAt: true;
    nhnRequestId: true;
    totalRecipientCount: true;
    skippedNoPhoneCount: true;
    duplicatePhoneCount: true;
    createdAt: true;
    updatedAt: true;
    messageType: true;
    mode: true;
    templateName: true;
    templateCode: true;
    senderProfile: {
      select: {
        id: true;
        plusFriendId: true;
        status: true;
      };
    };
    recipients: {
      select: {
        id: true;
        recipientPhone: true;
        recipientSeq: true;
        templateParameters: true;
        status: true;
      };
    };
  };
}>;

type SmsCampaignDetail = Awaited<ReturnType<BulkSmsService['getCampaignById']>>['campaign'];
type KakaoCampaignDetail = Awaited<ReturnType<BulkAlimtalkService['getCampaignById']>>['campaign'];
type BrandCampaignDetail = Awaited<ReturnType<BulkBrandMessageService['getCampaignById']>>['campaign'];

@Injectable()
export class V2CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly readinessService: V2ReadinessService,
    private readonly bulkSmsService: BulkSmsService,
    private readonly bulkAlimtalkService: BulkAlimtalkService,
    private readonly bulkBrandMessageService: BulkBrandMessageService,
    private readonly kakaoTemplateCatalogService: V2KakaoTemplateCatalogService,
    private readonly providerResultsService: ProviderResultsService,
    private readonly nhnService: NhnService
  ) {}

  async getSmsBootstrap(ownerUserId: string) {
    const [readiness, senderNumbers, templates, customFields, totalUsers, activeUsers, contactableUsers] =
      await Promise.all([
        this.readinessService.getReadinessForUser(ownerUserId),
        this.prisma.senderNumber.findMany({
          where: {
            ownerUserId,
            status: 'APPROVED'
          },
          orderBy: [{ approvedAt: 'desc' }, { createdAt: 'desc' }],
          select: {
            id: true,
            phoneNumber: true,
            type: true,
            approvedAt: true,
            updatedAt: true
          }
        }),
        this.prisma.template.findMany({
          where: {
            ownerUserId,
            channel: 'SMS',
            status: TemplateStatus.PUBLISHED
          },
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
          select: {
            id: true,
            name: true,
            body: true,
            requiredVariables: true,
            updatedAt: true
          }
        }),
        this.prisma.managedUserField.findMany({
          where: { ownerUserId },
          orderBy: [{ createdAt: 'asc' }, { label: 'asc' }],
          select: {
            key: true,
            label: true,
            dataType: true
          }
        }),
        this.prisma.managedUser.count({
          where: { ownerUserId }
        }),
        this.prisma.managedUser.count({
          where: {
            ownerUserId,
            status: ManagedUserStatus.ACTIVE
          }
        }),
        this.prisma.managedUser.count({
          where: {
            ownerUserId,
            phone: {
              not: null
            }
          }
        })
      ]);

    const status = readiness.resourceState.sms;
    const blockers =
      status === 'active'
        ? []
        : [
            {
              code: 'sms-resource-required',
              message: '발신번호 등록이 필요합니다.',
              cta: '발신 자원 관리'
            }
          ];

    return {
      readiness: {
        ready: status === 'active' && senderNumbers.length > 0,
        status,
        blockers
      },
      senderNumbers,
      templates: templates.map((template) => ({
        ...template,
        requiredVariables: isJsonArray(template.requiredVariables) ? template.requiredVariables : []
      })),
      recipientFields: buildUserFieldDefinitions(customFields),
      recipientSummary: {
        totalCount: totalUsers,
        activeCount: activeUsers,
        contactableCount: contactableUsers,
        customFieldCount: customFields.length
      },
      limits: {
        maxUserCount: 1000
      }
    };
  }

  async getKakaoBootstrap(sessionUser: SessionUser) {
    const includePartnerGroupTemplates = canUsePartnerGroupTemplates(sessionUser);
    const [readiness, catalog, customFields, totalUsers, activeUsers, contactableUsers] = await Promise.all([
      this.readinessService.getReadinessForUser(sessionUser.userId),
      this.kakaoTemplateCatalogService.getTemplateCatalogForUser(sessionUser.userId, {
        activeOnly: true,
        includeDefaultGroup: includePartnerGroupTemplates,
        groupScope: sessionUser.accessOrigin === 'PUBL' ? 'PUBL' : null
      }),
      this.prisma.managedUserField.findMany({
        where: { ownerUserId: sessionUser.userId },
        orderBy: [{ createdAt: 'asc' }, { label: 'asc' }],
        select: {
          key: true,
          label: true,
          dataType: true
        }
      }),
      this.prisma.managedUser.count({
        where: { ownerUserId: sessionUser.userId }
      }),
      this.prisma.managedUser.count({
        where: {
          ownerUserId: sessionUser.userId,
          status: ManagedUserStatus.ACTIVE
        }
      }),
      this.prisma.managedUser.count({
        where: {
          ownerUserId: sessionUser.userId,
          phone: {
            not: null
          }
        }
      })
    ]);

    const status = readiness.resourceState.kakao;
    const blockers =
      status === 'active'
        ? []
        : [
            {
              code: 'kakao-resource-required',
              message: '카카오 채널 연결이 필요합니다.',
              cta: '발신 자원 관리'
            }
          ];

    return {
      readiness: {
        ready: status === 'active' && catalog.senderProfiles.length > 0,
        status,
        blockers
      },
      senderProfiles: catalog.senderProfiles.map((item) => ({
        id: item.id,
        plusFriendId: item.plusFriendId,
        senderKey: item.senderKey,
        senderProfileType: item.senderProfileType,
        isDefault: item.isDefault,
        updatedAt: item.updatedAt
      })),
      templates: catalog.items
        .filter((item) => item.providerStatus === 'APR')
        .map((item) => ({
          id: item.id,
          source: item.source,
          ownerKey: item.ownerKey,
          ownerLabel: item.ownerLabel,
          providerStatus: item.providerStatus,
          providerStatusRaw: item.providerStatusRaw,
          providerStatusName: item.providerStatusName,
          templateCode: item.templateCode,
          kakaoTemplateCode: item.kakaoTemplateCode,
          updatedAt: item.updatedAt,
          template: {
            name: item.templateName,
            body: item.templateBody,
            requiredVariables: item.requiredVariables,
            messageType: item.templateMessageType
          }
        })),
      recipientFields: buildUserFieldDefinitions(customFields),
      recipientSummary: {
        totalCount: totalUsers,
        activeCount: activeUsers,
        contactableCount: contactableUsers,
        customFieldCount: customFields.length
      },
      limits: {
        maxUserCount: 1000
      }
    };
  }

  async getBrandBootstrap(sessionUser: SessionUser) {
    const [readiness, senderProfiles, customFields, totalUsers, activeUsers, contactableUsers] = await Promise.all([
      this.readinessService.getReadinessForUser(sessionUser.userId),
      this.prisma.senderProfile.findMany({
        where: {
          ownerUserId: sessionUser.userId,
          status: 'ACTIVE'
        },
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
        select: {
          id: true,
          plusFriendId: true,
          senderKey: true,
          senderProfileType: true,
          status: true,
          isDefault: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      this.prisma.managedUserField.findMany({
        where: { ownerUserId: sessionUser.userId },
        orderBy: [{ createdAt: 'asc' }, { label: 'asc' }],
        select: {
          key: true,
          label: true,
          dataType: true
        }
      }),
      this.prisma.managedUser.count({
        where: { ownerUserId: sessionUser.userId }
      }),
      this.prisma.managedUser.count({
        where: {
          ownerUserId: sessionUser.userId,
          status: ManagedUserStatus.ACTIVE
        }
      }),
      this.prisma.managedUser.count({
        where: {
          ownerUserId: sessionUser.userId,
          phone: {
            not: null
          }
        }
      })
    ]);
    const templateBuckets = await Promise.all(
      senderProfiles.map(async (profile) => {
        try {
          const response = await this.nhnService.fetchBrandTemplatesForSender(profile.senderKey, {
            pageNum: 1,
            pageSize: 100
          });

          return {
            profile,
            templates: response.templates
          };
        } catch {
          return {
            profile,
            templates: [] as NhnBrandTemplate[]
          };
        }
      })
    );

    const status = readiness.resourceState.kakao;
    const blockers =
      status === 'active'
        ? []
        : [
            {
              code: 'kakao-resource-required',
              message: '브랜드 메시지를 보내려면 카카오 채널 연결이 필요합니다.',
              cta: '발신 자원 관리'
            }
          ];

    return {
      readiness: {
        ready: status === 'active' && senderProfiles.length > 0,
        status,
        blockers
      },
      senderProfiles,
      templates: summarizeBrandCampaignTemplates(templateBuckets),
      recipientFields: buildUserFieldDefinitions(customFields),
      recipientSummary: {
        totalCount: totalUsers,
        activeCount: activeUsers,
        contactableCount: contactableUsers,
        customFieldCount: customFields.length
      },
      supportedMessageTypes: ['TEXT', 'IMAGE', 'WIDE'],
      constraints: buildBrandCampaignConstraints(),
      limits: {
        maxUserCount: 1000
      }
    };
  }

  async searchRecipients(
    ownerUserId: string,
    options: {
      query?: string;
      status?: string;
      limit?: string;
      offset?: string;
    }
  ) {
    const query = normalizeSearchQuery(options.query);
    const status = normalizeRecipientStatus(options.status);
    const limit = normalizeSearchLimit(options.limit);
    const offset = normalizeSearchOffset(options.offset);
    const where = buildRecipientSearchWhere(ownerUserId, query, status);

    const [totalCount, filteredCount, filteredContactableCount, users] = await Promise.all([
      this.prisma.managedUser.count({
        where: { ownerUserId }
      }),
      this.prisma.managedUser.count({
        where
      }),
      this.prisma.managedUser.count({
        where: {
          ...where,
          phone: {
            not: null
          }
        }
      }),
      this.prisma.managedUser.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          externalId: true,
          status: true,
          source: true,
          userType: true,
          segment: true,
          gradeOrLevel: true,
          marketingConsent: true,
          customAttributes: true,
          updatedAt: true,
          createdAt: true
        }
      })
    ]);

    return {
      filters: {
        query,
        status,
        limit,
        offset
      },
      summary: {
        totalCount,
        filteredCount,
        contactableCount: filteredContactableCount
      },
      page: {
        limit,
        offset,
        hasNext: offset + users.length < filteredCount,
        nextOffset: offset + users.length < filteredCount ? offset + limit : null,
        prevOffset: offset > 0 ? Math.max(0, offset - limit) : null
      },
      items: users.map((user) => {
        const normalizedPhone = normalizeManagedUserPhone(user.phone);
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: normalizedPhone ?? null,
          externalId: user.externalId,
          status: user.status,
          source: user.source,
          userType: user.userType,
          segment: user.segment,
          gradeOrLevel: user.gradeOrLevel,
          marketingConsent: user.marketingConsent,
          hasPhone: Boolean(normalizedPhone),
          customAttributes: isJsonRecord(user.customAttributes) ? user.customAttributes : {},
          updatedAt: user.updatedAt,
          createdAt: user.createdAt
        };
      })
    };
  }

  async listCampaigns(ownerUserId: string, channelInput?: string, limitInput?: string) {
    const channel = normalizeChannel(channelInput);
    const limit = normalizeLimit(limitInput);

    const [readiness, smsCount, kakaoCount, brandCount, smsItems, kakaoItems, brandItems] = await Promise.all([
      this.readinessService.getReadinessForUser(ownerUserId),
      this.prisma.bulkSmsCampaign.count({
        where: { ownerUserId }
      }),
      this.prisma.bulkAlimtalkCampaign.count({
        where: { ownerUserId }
      }),
      this.prisma.bulkBrandMessageCampaign.count({
        where: { ownerUserId }
      }),
      channel === 'kakao'
        ? Promise.resolve([] as SmsCampaignListItem[])
        : this.prisma.bulkSmsCampaign.findMany({
            where: { ownerUserId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
              id: true,
              title: true,
              status: true,
              scheduledAt: true,
              nhnRequestId: true,
              totalRecipientCount: true,
              skippedNoPhoneCount: true,
              duplicatePhoneCount: true,
              createdAt: true,
              updatedAt: true,
              senderNumber: {
                select: {
                  id: true,
                  phoneNumber: true,
                  status: true
                }
              },
              template: {
                select: {
                  id: true,
                  name: true,
                  status: true
                }
              },
              recipients: {
                select: {
                  id: true,
                  recipientPhone: true,
                  recipientSeq: true,
                  templateParameters: true,
                  status: true
                }
              }
            }
          }),
      channel === 'sms' || channel === 'brand'
        ? Promise.resolve([] as KakaoCampaignListItem[])
        : this.prisma.bulkAlimtalkCampaign.findMany({
            where: { ownerUserId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
              id: true,
              title: true,
              status: true,
              scheduledAt: true,
              nhnRequestId: true,
              totalRecipientCount: true,
              skippedNoPhoneCount: true,
              duplicatePhoneCount: true,
              createdAt: true,
              updatedAt: true,
              templateSource: true,
              templateName: true,
              templateCode: true,
              senderProfile: {
                select: {
                  id: true,
                  plusFriendId: true,
                  status: true
                }
              },
              providerTemplate: {
                select: {
                  id: true,
                  providerStatus: true,
                  template: {
                    select: {
                      id: true,
                      name: true
                    }
                  }
                }
              },
              recipients: {
                select: {
                  id: true,
                  recipientPhone: true,
                  recipientSeq: true,
                  templateParameters: true,
                  status: true
                }
              }
            }
          }),
      channel === 'sms' || channel === 'kakao'
        ? Promise.resolve([] as BrandCampaignListItem[])
        : this.prisma.bulkBrandMessageCampaign.findMany({
            where: { ownerUserId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
              id: true,
              title: true,
              status: true,
              scheduledAt: true,
              nhnRequestId: true,
              totalRecipientCount: true,
              skippedNoPhoneCount: true,
              duplicatePhoneCount: true,
              createdAt: true,
              updatedAt: true,
              mode: true,
              messageType: true,
              templateName: true,
              templateCode: true,
              senderProfile: {
                select: {
                  id: true,
                  plusFriendId: true,
                  status: true
                }
              },
              recipients: {
                select: {
                  id: true,
                  recipientPhone: true,
                  recipientSeq: true,
                  templateParameters: true,
                  status: true
                }
              }
            }
          })
    ]);

    const [resolvedSmsItems, resolvedKakaoItems, resolvedBrandItems] = await Promise.all([
      Promise.all(smsItems.map((item) => this.providerResultsService.resolveSmsCampaign(item))),
      Promise.all(kakaoItems.map((item) => this.providerResultsService.resolveAlimtalkCampaign(item))),
      Promise.all(brandItems.map((item) => this.providerResultsService.resolveBrandMessageCampaign(item)))
    ]);

    const items = [
      ...smsItems.map((item, index) => this.serializeSmsCampaignListItem(item, resolvedSmsItems[index])),
      ...kakaoItems.map((item, index) => this.serializeKakaoCampaignListItem(item, resolvedKakaoItems[index])),
      ...brandItems.map((item, index) => this.serializeBrandCampaignListItem(item, resolvedBrandItems[index]))
    ]
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, limit);

    return {
      readiness,
      filter: {
        channel: channel ?? 'all',
        limit
      },
      counts: {
        totalCount: smsCount + kakaoCount + brandCount,
        smsCount,
        kakaoCount,
        brandCount
      },
      items
    };
  }

  async createSmsCampaign(
    userId: string,
    dto: CreateBulkSmsCampaignDto
  ) {
    const { campaign } = await this.bulkSmsService.createQueuedCampaignForUser(userId, dto);

    return {
      campaignId: campaign.id,
      channel: 'sms' as const,
      status: campaign.status,
      queued: true,
      scheduledAt: campaign.scheduledAt,
      createdAt: campaign.createdAt
    };
  }

  async createKakaoCampaign(
    userId: string,
    dto: CreateBulkAlimtalkCampaignDto
  ) {
    const { campaign } = await this.bulkAlimtalkService.createQueuedCampaignForUser(userId, dto);

    return {
      campaignId: campaign.id,
      channel: 'kakao' as const,
      status: campaign.status,
      queued: true,
      scheduledAt: campaign.scheduledAt,
      createdAt: campaign.createdAt
    };
  }

  async createBrandCampaign(
    userId: string,
    dto: CreateBulkBrandMessageCampaignDto
  ) {
    const { campaign } = await this.bulkBrandMessageService.createQueuedCampaignForUser(userId, dto);

    return {
      campaignId: campaign.id,
      channel: 'brand' as const,
      status: campaign.status,
      queued: true,
      scheduledAt: campaign.scheduledAt,
      createdAt: campaign.createdAt
    };
  }

  async getCampaignById(
    ownerUserId: string,
    campaignId: string,
    channelInput?: string
  ) {
    const channel = normalizeChannel(channelInput);

    if (channel === 'sms') {
      const campaign = await this.tryGetSmsCampaignById(ownerUserId, campaignId);
      if (!campaign) {
        throw new NotFoundException('Campaign not found');
      }

      const resolved = await this.providerResultsService.resolveSmsCampaign(campaign);

      return {
        channel,
        campaign: this.serializeSmsCampaignDetail(campaign, resolved)
      };
    }

    if (channel === 'kakao') {
      const campaign = await this.tryGetKakaoCampaignById(ownerUserId, campaignId);
      if (!campaign) {
        throw new NotFoundException('Campaign not found');
      }

      const resolved = await this.providerResultsService.resolveAlimtalkCampaign(campaign);

      return {
        channel,
        campaign: this.serializeKakaoCampaignDetail(campaign, resolved)
      };
    }

    if (channel === 'brand') {
      const campaign = await this.tryGetBrandCampaignById(ownerUserId, campaignId);
      if (!campaign) {
        throw new NotFoundException('Campaign not found');
      }

      const resolved = await this.providerResultsService.resolveBrandMessageCampaign(campaign);

      return {
        channel,
        campaign: this.serializeBrandCampaignDetail(campaign, resolved)
      };
    }

    const [smsCampaign, kakaoCampaign, brandCampaign] = await Promise.all([
      this.tryGetSmsCampaignById(ownerUserId, campaignId),
      this.tryGetKakaoCampaignById(ownerUserId, campaignId),
      this.tryGetBrandCampaignById(ownerUserId, campaignId)
    ]);

    if (smsCampaign) {
      const resolved = await this.providerResultsService.resolveSmsCampaign(smsCampaign);
      return {
        channel: 'sms' as const,
        campaign: this.serializeSmsCampaignDetail(smsCampaign, resolved)
      };
    }

    if (kakaoCampaign) {
      const resolved = await this.providerResultsService.resolveAlimtalkCampaign(kakaoCampaign);
      return {
        channel: 'kakao' as const,
        campaign: this.serializeKakaoCampaignDetail(kakaoCampaign, resolved)
      };
    }

    if (brandCampaign) {
      const resolved = await this.providerResultsService.resolveBrandMessageCampaign(brandCampaign);
      return {
        channel: 'brand' as const,
        campaign: this.serializeBrandCampaignDetail(brandCampaign, resolved)
      };
    }

    throw new NotFoundException('Campaign not found');
  }

  private async tryGetSmsCampaignById(ownerUserId: string, campaignId: string) {
    try {
      return (await this.bulkSmsService.getCampaignByIdForUser(ownerUserId, campaignId)).campaign;
    } catch (error) {
      if (error instanceof ConflictException) {
        return null;
      }

      throw error;
    }
  }

  private async tryGetKakaoCampaignById(ownerUserId: string, campaignId: string) {
    try {
      return (await this.bulkAlimtalkService.getCampaignByIdForUser(ownerUserId, campaignId)).campaign;
    } catch (error) {
      if (error instanceof ConflictException) {
        return null;
      }

      throw error;
    }
  }

  private async tryGetBrandCampaignById(ownerUserId: string, campaignId: string) {
    try {
      return (await this.bulkBrandMessageService.getCampaignByIdForUser(ownerUserId, campaignId)).campaign;
    } catch (error) {
      if (error instanceof ConflictException) {
        return null;
      }

      throw error;
    }
  }

  private serializeSmsCampaignListItem(campaign: SmsCampaignListItem, resolved: Awaited<ReturnType<ProviderResultsService['resolveSmsCampaign']>>) {
    return {
      id: campaign.id,
      channel: 'sms' as const,
      title: campaign.title,
      status: resolved.status,
      scheduledAt: campaign.scheduledAt,
      nhnRequestId: campaign.nhnRequestId,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      recipientStats: resolved.recipientStats,
      sender: {
        id: campaign.senderNumber.id,
        label: campaign.senderNumber.phoneNumber,
        status: campaign.senderNumber.status
      },
      template: campaign.template
        ? {
            id: campaign.template.id,
            name: campaign.template.name,
            status: campaign.template.status
          }
        : null
    };
  }

  private serializeKakaoCampaignListItem(
    campaign: KakaoCampaignListItem,
    resolved: Awaited<ReturnType<ProviderResultsService['resolveAlimtalkCampaign']>>
  ) {
    return {
      id: campaign.id,
      channel: 'kakao' as const,
      title: campaign.title,
      status: resolved.status,
      scheduledAt: campaign.scheduledAt,
      nhnRequestId: campaign.nhnRequestId,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      recipientStats: resolved.recipientStats,
      sender: {
        id: campaign.senderProfile.id,
        label: campaign.senderProfile.plusFriendId,
        status: campaign.senderProfile.status
      },
      template: {
        source: campaign.templateSource,
        name: campaign.providerTemplate?.template.name || campaign.templateName,
        code: campaign.templateCode,
        providerTemplateId: campaign.providerTemplate?.id ?? null,
        providerStatus: campaign.providerTemplate?.providerStatus ?? null
      }
    };
  }

  private serializeBrandCampaignListItem(
    campaign: BrandCampaignListItem,
    resolved: Awaited<ReturnType<ProviderResultsService['resolveBrandMessageCampaign']>>
  ) {
    return {
      id: campaign.id,
      channel: 'brand' as const,
      title: campaign.title,
      status: resolved.status,
      scheduledAt: campaign.scheduledAt,
      nhnRequestId: campaign.nhnRequestId,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      recipientStats: resolved.recipientStats,
      sender: {
        id: campaign.senderProfile.id,
        label: campaign.senderProfile.plusFriendId,
        status: campaign.senderProfile.status
      },
      template: {
        source: campaign.mode,
        name: campaign.templateName || `${campaign.messageType} 브랜드 메시지`,
        code: campaign.templateCode,
        providerTemplateId: null,
        providerStatus: null,
        messageType: campaign.messageType
      }
    };
  }

  private serializeSmsCampaignDetail(
    campaign: SmsCampaignDetail,
    resolved: Awaited<ReturnType<ProviderResultsService['resolveSmsCampaign']>>
  ) {
    return {
      id: campaign.id,
      channel: 'sms' as const,
      title: campaign.title,
      status: resolved.status,
      scheduledAt: campaign.scheduledAt,
      nhnRequestId: campaign.nhnRequestId,
      body: campaign.body,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      recipientStats: resolved.recipientStats,
      sender: {
        id: campaign.senderNumber.id,
        label: campaign.senderNumber.phoneNumber,
        status: campaign.senderNumber.status,
        type: campaign.senderNumber.type
      },
      template: campaign.template
        ? {
            id: campaign.template.id,
            name: campaign.template.name,
            status: campaign.template.status
          }
        : null,
      recipients: campaign.recipients.map((recipient) => ({
        id: recipient.id,
        managedUserId: recipient.managedUserId,
        recipientPhone: recipient.recipientPhone,
        recipientName: recipient.recipientName,
        recipientSeq: recipient.recipientSeq,
        recipientGroupingKey: recipient.recipientGroupingKey,
        status: resolved.recipients.get(recipient.id)?.status ?? recipient.status,
        providerResultCode: resolved.recipients.get(recipient.id)?.providerResultCode ?? null,
        providerResultMessage: resolved.recipients.get(recipient.id)?.providerResultMessage ?? null,
        templateParameters: recipient.templateParameters,
        createdAt: recipient.createdAt,
        updatedAt: resolved.recipients.get(recipient.id)?.resolvedAt ?? recipient.updatedAt
      }))
    };
  }

  private serializeKakaoCampaignDetail(
    campaign: KakaoCampaignDetail,
    resolved: Awaited<ReturnType<ProviderResultsService['resolveAlimtalkCampaign']>>
  ) {
    return {
      id: campaign.id,
      channel: 'kakao' as const,
      title: campaign.title,
      status: resolved.status,
      scheduledAt: campaign.scheduledAt,
      nhnRequestId: campaign.nhnRequestId,
      body: campaign.body,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      recipientStats: resolved.recipientStats,
      sender: {
        id: campaign.senderProfile.id,
        label: campaign.senderProfile.plusFriendId,
        status: campaign.senderProfile.status,
        senderKey: campaign.senderProfile.senderKey
      },
      template: {
        source: campaign.templateSource,
        name: campaign.providerTemplate?.template.name || campaign.templateName,
        code: campaign.templateCode,
        providerTemplateId: campaign.providerTemplate?.id ?? null,
        providerStatus: campaign.providerTemplate?.providerStatus ?? null,
        templateId: campaign.providerTemplate?.template.id ?? null
      },
      recipients: campaign.recipients.map((recipient) => ({
        id: recipient.id,
        managedUserId: recipient.managedUserId,
        recipientPhone: recipient.recipientPhone,
        recipientName: recipient.recipientName,
        recipientSeq: recipient.recipientSeq,
        recipientGroupingKey: recipient.recipientGroupingKey,
        status: resolved.recipients.get(recipient.id)?.status ?? recipient.status,
        providerResultCode: resolved.recipients.get(recipient.id)?.providerResultCode ?? null,
        providerResultMessage: resolved.recipients.get(recipient.id)?.providerResultMessage ?? null,
        templateParameters: recipient.templateParameters,
        createdAt: recipient.createdAt,
        updatedAt: resolved.recipients.get(recipient.id)?.resolvedAt ?? recipient.updatedAt
      }))
    };
  }

  private serializeBrandCampaignDetail(
    campaign: BrandCampaignDetail,
    resolved: Awaited<ReturnType<ProviderResultsService['resolveBrandMessageCampaign']>>
  ) {
    return {
      id: campaign.id,
      channel: 'brand' as const,
      title: campaign.title,
      status: resolved.status,
      scheduledAt: campaign.scheduledAt,
      nhnRequestId: campaign.nhnRequestId,
      body: campaign.body,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      recipientStats: resolved.recipientStats,
      sender: {
        id: campaign.senderProfile.id,
        label: campaign.senderProfile.plusFriendId,
        status: campaign.senderProfile.status,
        senderKey: campaign.senderProfile.senderKey
      },
      template: {
        source: campaign.mode,
        name: campaign.templateName || `${campaign.messageType} 브랜드 메시지`,
        code: campaign.templateCode,
        providerTemplateId: null,
        providerStatus: null,
        messageType: campaign.messageType,
        pushAlarm: campaign.pushAlarm,
        adult: campaign.adult,
        statsEventKey: campaign.statsEventKey,
        resellerCode: campaign.resellerCode,
        imageUrl: campaign.imageUrl,
        imageLink: campaign.imageLink,
        buttons: campaign.buttonsJson
      },
      recipients: campaign.recipients.map((recipient) => ({
        id: recipient.id,
        managedUserId: recipient.managedUserId,
        recipientPhone: recipient.recipientPhone,
        recipientName: recipient.recipientName,
        recipientSeq: recipient.recipientSeq,
        recipientGroupingKey: recipient.recipientGroupingKey,
        status: resolved.recipients.get(recipient.id)?.status ?? recipient.status,
        providerResultCode: resolved.recipients.get(recipient.id)?.providerResultCode ?? null,
        providerResultMessage: resolved.recipients.get(recipient.id)?.providerResultMessage ?? null,
        templateParameters: recipient.templateParameters,
        createdAt: recipient.createdAt,
        updatedAt: resolved.recipients.get(recipient.id)?.resolvedAt ?? recipient.updatedAt
      }))
    };
  }

}

function normalizeChannel(value?: string): CampaignChannel | undefined {
  if (!value) {
    return undefined;
  }

  if (value === 'sms' || value === 'kakao' || value === 'brand') {
    return value;
  }

  throw new BadRequestException('channel must be one of: sms, kakao, brand');
}

function buildBrandCampaignConstraints() {
  return {
    nightSendRestricted: true,
    nightSendWindow: {
      start: '20:50',
      end: '08:00'
    },
    supportedFeatures: {
      pushAlarm: true,
      statsEventKey: false,
      resellerCode: false,
      adult: true,
      schedule: true,
      buttons: true,
      preview: true,
      coupon: false,
      template: true,
      mnTargeting: false,
      massUpload: false,
      unsubscribePerRecipient: false,
      resendPerRecipient: false
    }
  };
}

function summarizeBrandCampaignTemplates(
  buckets: Array<{
    profile: {
      id: string;
      plusFriendId: string;
      senderKey: string;
      senderProfileType: string | null;
      status: string;
    };
    templates: NhnBrandTemplate[];
  }>
) {
  return buckets
    .flatMap((bucket) =>
      bucket.templates.map((template) => ({
        id: `${bucket.profile.id}:${template.templateCode ?? template.templateName ?? template.createDate ?? 'brand-template'}`,
        senderProfileId: bucket.profile.id,
        senderKey: bucket.profile.senderKey,
        plusFriendId: bucket.profile.plusFriendId,
        senderProfileType: bucket.profile.senderProfileType,
        senderProfileStatus: bucket.profile.status,
        ownerLabel: bucket.profile.plusFriendId,
        providerStatus: normalizeBrandTemplateStatus(template.status, template.statusName),
        providerStatusRaw: template.status,
        providerStatusName: template.statusName,
        templateCode: template.templateCode,
        templateName: template.templateName || '이름 없는 브랜드 템플릿',
        requiredVariables: extractBrandTemplateVariables(template),
        chatBubbleType: template.chatBubbleType,
        content: template.content,
        header: template.header,
        additionalContent: template.additionalContent,
        createdAt: template.createDate,
        updatedAt: template.updateDate
      }))
    )
    .sort((left, right) => String(right.updatedAt || right.createdAt || '').localeCompare(String(left.updatedAt || left.createdAt || '')));
}

function normalizeBrandTemplateStatus(status: string | null | undefined, statusName?: string | null) {
  if (!status && !statusName) {
    return 'UNKNOWN';
  }

  const normalized = String(status || '').trim().toUpperCase();
  const normalizedName = String(statusName || '').trim().toUpperCase();
  if (
    normalized === 'A' ||
    normalized.includes('APR') ||
    normalized.includes('APPROVED') ||
    normalized === 'USE' ||
    normalized.includes('USABLE') ||
    normalized.includes('AVAILABLE') ||
    normalized.includes('ACTIVE') ||
    normalizedName.includes('사용 가능'.toUpperCase()) ||
    normalizedName.includes('사용가능'.toUpperCase()) ||
    normalizedName.includes('AVAILABLE') ||
    normalizedName.includes('ACTIVE')
  ) {
    return 'APR';
  }
  if (
    normalized.includes('REQ') ||
    normalized.includes('WAIT') ||
    normalized.includes('PENDING') ||
    normalizedName.includes('검토'.toUpperCase()) ||
    normalizedName.includes('대기'.toUpperCase()) ||
    normalizedName.includes('PENDING')
  ) {
    return 'REQ';
  }
  if (
    normalized.includes('REJ') ||
    normalized.includes('DENY') ||
    normalized.includes('FAIL') ||
    normalizedName.includes('반려'.toUpperCase()) ||
    normalizedName.includes('거부'.toUpperCase()) ||
    normalizedName.includes('실패'.toUpperCase())
  ) {
    return 'REJ';
  }
  return normalized;
}

function extractBrandTemplateVariables(template: NhnBrandTemplate) {
  const matches = new Set<string>();
  collectBrandTemplateVariableTokens(template, matches);
  return Array.from(matches);
}

function collectBrandTemplateVariableTokens(value: unknown, matches: Set<string>) {
  if (typeof value === 'string') {
    for (const match of value.matchAll(/#\{([^}]+)\}/g)) {
      const token = match[1]?.trim();
      if (token) {
        matches.add(token);
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectBrandTemplateVariableTokens(item, matches);
    }
    return;
  }

  if (value && typeof value === 'object') {
    for (const nestedValue of Object.values(value as Record<string, unknown>)) {
      collectBrandTemplateVariableTokens(nestedValue, matches);
    }
  }
}

function normalizeRecipientStatus(value?: string): RecipientStatusFilter {
  if (!value || value === 'all') {
    return 'all';
  }

  if (
    value === ManagedUserStatus.ACTIVE ||
    value === ManagedUserStatus.INACTIVE ||
    value === ManagedUserStatus.DORMANT ||
    value === ManagedUserStatus.BLOCKED
  ) {
    return value;
  }

  throw new BadRequestException('status must be one of: all, ACTIVE, INACTIVE, DORMANT, BLOCKED');
}

function normalizeLimit(value?: string) {
  if (!value) {
    return 20;
  }

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new BadRequestException('limit must be an integer between 1 and 50');
  }

  return limit;
}

function normalizeSearchQuery(value?: string) {
  return value?.trim() ?? '';
}

function normalizeSearchLimit(value?: string) {
  if (!value) {
    return 20;
  }

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new BadRequestException('limit must be an integer between 1 and 100');
  }

  return limit;
}

function normalizeSearchOffset(value?: string) {
  if (!value) {
    return 0;
  }

  const offset = Number(value);
  if (!Number.isInteger(offset) || offset < 0) {
    throw new BadRequestException('offset must be a non-negative integer');
  }

  return offset;
}

function buildRecipientSearchWhere(
  ownerUserId: string,
  query: string,
  status: RecipientStatusFilter
): Prisma.ManagedUserWhereInput {
  const where: Prisma.ManagedUserWhereInput = {
    ownerUserId
  };

  if (status !== 'all') {
    where.status = status;
  }

  if (query) {
    where.OR = [
      { name: { contains: query, mode: 'insensitive' } },
      { email: { contains: query, mode: 'insensitive' } },
      { phone: { contains: query, mode: 'insensitive' } },
      { externalId: { contains: query, mode: 'insensitive' } },
      { source: { contains: query, mode: 'insensitive' } },
      { userType: { contains: query, mode: 'insensitive' } },
      { segment: { contains: query, mode: 'insensitive' } },
      { gradeOrLevel: { contains: query, mode: 'insensitive' } }
    ];
  }

  return where;
}

function isJsonArray(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === 'string' ? item : ''))
    .filter(Boolean);
}

function isJsonRecord(value: Prisma.JsonValue | null): Record<string, string | number | boolean | null> {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return {};
  }

  const record: Record<string, string | number | boolean | null> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    if (
      typeof rawValue === 'string' ||
      typeof rawValue === 'number' ||
      typeof rawValue === 'boolean' ||
      rawValue === null
    ) {
      record[key] = rawValue;
    }
  }

  return record;
}
