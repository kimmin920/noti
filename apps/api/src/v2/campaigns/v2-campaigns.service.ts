import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ManagedUserStatus, Prisma, TemplateStatus } from '@prisma/client';
import { CreateBulkAlimtalkCampaignDto } from '../../bulk-alimtalk/bulk-alimtalk.dto';
import { BulkAlimtalkService } from '../../bulk-alimtalk/bulk-alimtalk.service';
import { CreateBulkSmsCampaignDto } from '../../bulk-sms/bulk-sms.dto';
import { BulkSmsService } from '../../bulk-sms/bulk-sms.service';
import { PrismaService } from '../../database/prisma.service';
import { buildUserFieldDefinitions, normalizeManagedUserPhone, USER_SYSTEM_FIELDS } from '../../users/users.mapping';
import { V2ReadinessService } from '../shared/v2-readiness.service';

type CampaignChannel = 'sms' | 'kakao';
type RecipientStatusFilter = 'all' | ManagedUserStatus;

type SmsCampaignListItem = Prisma.BulkSmsCampaignGetPayload<{
  select: {
    id: true;
    title: true;
    status: true;
    scheduledAt: true;
    nhnRequestId: true;
    totalRecipientCount: true;
    acceptedCount: true;
    failedCount: true;
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
    acceptedCount: true;
    failedCount: true;
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
  };
}>;

type SmsCampaignDetail = Awaited<ReturnType<BulkSmsService['getCampaignById']>>['campaign'];
type KakaoCampaignDetail = Awaited<ReturnType<BulkAlimtalkService['getCampaignById']>>['campaign'];

@Injectable()
export class V2CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly readinessService: V2ReadinessService,
    private readonly bulkSmsService: BulkSmsService,
    private readonly bulkAlimtalkService: BulkAlimtalkService
  ) {}

  async getSmsBootstrap(tenantId: string) {
    const [readiness, senderNumbers, templates, customFields, totalUsers, activeUsers, contactableUsers] =
      await Promise.all([
        this.readinessService.getReadiness(tenantId),
        this.prisma.senderNumber.findMany({
          where: {
            tenantId,
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
            tenantId,
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
          where: { tenantId },
          orderBy: [{ createdAt: 'asc' }, { label: 'asc' }],
          select: {
            key: true,
            label: true,
            dataType: true
          }
        }),
        this.prisma.managedUser.count({
          where: { tenantId }
        }),
        this.prisma.managedUser.count({
          where: {
            tenantId,
            status: ManagedUserStatus.ACTIVE
          }
        }),
        this.prisma.managedUser.count({
          where: {
            tenantId,
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

  async searchRecipients(
    tenantId: string,
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
    const where = buildRecipientSearchWhere(tenantId, query, status);

    const [totalCount, filteredCount, filteredContactableCount, users] = await Promise.all([
      this.prisma.managedUser.count({
        where: { tenantId }
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

  async listCampaigns(tenantId: string, channelInput?: string, limitInput?: string) {
    const channel = normalizeChannel(channelInput);
    const limit = normalizeLimit(limitInput);

    const [readiness, smsCount, kakaoCount, smsItems, kakaoItems] = await Promise.all([
      this.readinessService.getReadiness(tenantId),
      this.prisma.bulkSmsCampaign.count({
        where: { tenantId }
      }),
      this.prisma.bulkAlimtalkCampaign.count({
        where: { tenantId }
      }),
      channel === 'kakao'
        ? Promise.resolve([] as SmsCampaignListItem[])
        : this.prisma.bulkSmsCampaign.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
              id: true,
              title: true,
              status: true,
              scheduledAt: true,
              nhnRequestId: true,
              totalRecipientCount: true,
              acceptedCount: true,
              failedCount: true,
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
              }
            }
          }),
      channel === 'sms'
        ? Promise.resolve([] as KakaoCampaignListItem[])
        : this.prisma.bulkAlimtalkCampaign.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
              id: true,
              title: true,
              status: true,
              scheduledAt: true,
              nhnRequestId: true,
              totalRecipientCount: true,
              acceptedCount: true,
              failedCount: true,
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
              }
            }
          })
    ]);

    const items = [
      ...smsItems.map((item) => this.serializeSmsCampaignListItem(item)),
      ...kakaoItems.map((item) => this.serializeKakaoCampaignListItem(item))
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
        totalCount: smsCount + kakaoCount,
        smsCount,
        kakaoCount
      },
      items
    };
  }

  async createSmsCampaign(tenantId: string, userId: string, dto: CreateBulkSmsCampaignDto) {
    const { campaign } = await this.bulkSmsService.createQueuedCampaign(tenantId, userId, dto);

    return {
      campaignId: campaign.id,
      channel: 'sms' as const,
      status: campaign.status,
      queued: true,
      scheduledAt: campaign.scheduledAt,
      createdAt: campaign.createdAt
    };
  }

  async createKakaoCampaign(tenantId: string, userId: string, dto: CreateBulkAlimtalkCampaignDto) {
    const { campaign } = await this.bulkAlimtalkService.createQueuedCampaign(tenantId, userId, dto);

    return {
      campaignId: campaign.id,
      channel: 'kakao' as const,
      status: campaign.status,
      queued: true,
      scheduledAt: campaign.scheduledAt,
      createdAt: campaign.createdAt
    };
  }

  async getCampaignById(tenantId: string, campaignId: string, channelInput?: string) {
    const channel = normalizeChannel(channelInput);

    if (channel === 'sms') {
      const campaign = await this.tryGetSmsCampaignById(tenantId, campaignId);
      if (!campaign) {
        throw new NotFoundException('Campaign not found');
      }

      return {
        channel,
        campaign: this.serializeSmsCampaignDetail(campaign)
      };
    }

    if (channel === 'kakao') {
      const campaign = await this.tryGetKakaoCampaignById(tenantId, campaignId);
      if (!campaign) {
        throw new NotFoundException('Campaign not found');
      }

      return {
        channel,
        campaign: this.serializeKakaoCampaignDetail(campaign)
      };
    }

    const [smsCampaign, kakaoCampaign] = await Promise.all([
      this.tryGetSmsCampaignById(tenantId, campaignId),
      this.tryGetKakaoCampaignById(tenantId, campaignId)
    ]);

    if (smsCampaign) {
      return {
        channel: 'sms' as const,
        campaign: this.serializeSmsCampaignDetail(smsCampaign)
      };
    }

    if (kakaoCampaign) {
      return {
        channel: 'kakao' as const,
        campaign: this.serializeKakaoCampaignDetail(kakaoCampaign)
      };
    }

    throw new NotFoundException('Campaign not found');
  }

  private async tryGetSmsCampaignById(tenantId: string, campaignId: string) {
    try {
      return (await this.bulkSmsService.getCampaignById(tenantId, campaignId)).campaign;
    } catch (error) {
      if (error instanceof ConflictException) {
        return null;
      }

      throw error;
    }
  }

  private async tryGetKakaoCampaignById(tenantId: string, campaignId: string) {
    try {
      return (await this.bulkAlimtalkService.getCampaignById(tenantId, campaignId)).campaign;
    } catch (error) {
      if (error instanceof ConflictException) {
        return null;
      }

      throw error;
    }
  }

  private serializeSmsCampaignListItem(campaign: SmsCampaignListItem) {
    return {
      id: campaign.id,
      channel: 'sms' as const,
      title: campaign.title,
      status: campaign.status,
      scheduledAt: campaign.scheduledAt,
      nhnRequestId: campaign.nhnRequestId,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      recipientStats: buildRecipientStats(campaign),
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

  private serializeKakaoCampaignListItem(campaign: KakaoCampaignListItem) {
    return {
      id: campaign.id,
      channel: 'kakao' as const,
      title: campaign.title,
      status: campaign.status,
      scheduledAt: campaign.scheduledAt,
      nhnRequestId: campaign.nhnRequestId,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      recipientStats: buildRecipientStats(campaign),
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

  private serializeSmsCampaignDetail(campaign: SmsCampaignDetail) {
    return {
      id: campaign.id,
      channel: 'sms' as const,
      title: campaign.title,
      status: campaign.status,
      scheduledAt: campaign.scheduledAt,
      nhnRequestId: campaign.nhnRequestId,
      body: campaign.body,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      requestedBy: campaign.requestedBy,
      recipientStats: buildRecipientStats(campaign),
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
        status: recipient.status,
        providerResultCode: recipient.providerResultCode,
        providerResultMessage: recipient.providerResultMessage,
        templateParameters: recipient.templateParameters,
        createdAt: recipient.createdAt,
        updatedAt: recipient.updatedAt
      }))
    };
  }

  private serializeKakaoCampaignDetail(campaign: KakaoCampaignDetail) {
    return {
      id: campaign.id,
      channel: 'kakao' as const,
      title: campaign.title,
      status: campaign.status,
      scheduledAt: campaign.scheduledAt,
      nhnRequestId: campaign.nhnRequestId,
      body: campaign.body,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      requestedBy: campaign.requestedBy,
      recipientStats: buildRecipientStats(campaign),
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
        status: recipient.status,
        providerResultCode: recipient.providerResultCode,
        providerResultMessage: recipient.providerResultMessage,
        templateParameters: recipient.templateParameters,
        createdAt: recipient.createdAt,
        updatedAt: recipient.updatedAt
      }))
    };
  }
}

function normalizeChannel(value?: string): CampaignChannel | undefined {
  if (!value) {
    return undefined;
  }

  if (value === 'sms' || value === 'kakao') {
    return value;
  }

  throw new BadRequestException('channel must be one of: sms, kakao');
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

function buildRecipientSearchWhere(tenantId: string, query: string, status: RecipientStatusFilter): Prisma.ManagedUserWhereInput {
  const where: Prisma.ManagedUserWhereInput = {
    tenantId
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

function buildRecipientStats(campaign: {
  totalRecipientCount: number;
  acceptedCount: number;
  failedCount: number;
  skippedNoPhoneCount: number;
  duplicatePhoneCount: number;
}) {
  return {
    totalCount: campaign.totalRecipientCount,
    acceptedCount: campaign.acceptedCount,
    failedCount: campaign.failedCount,
    pendingCount: Math.max(0, campaign.totalRecipientCount - campaign.acceptedCount - campaign.failedCount),
    skippedNoPhoneCount: campaign.skippedNoPhoneCount,
    duplicatePhoneCount: campaign.duplicatePhoneCount
  };
}
