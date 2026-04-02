import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import {
  BulkSmsCampaignStatus,
  BulkSmsRecipientStatus,
  Prisma,
  ProviderTemplateStatus,
  SenderProfileStatus
} from '@prisma/client';
import { extractRequiredVariables } from '@publ/shared';
import { PrismaService } from '../database/prisma.service';
import { NhnService } from '../nhn/nhn.service';
import { QueueService } from '../queue/queue.service';
import { USER_SYSTEM_FIELDS } from '../users/users.mapping';
import { CreateBulkAlimtalkCampaignDto } from './bulk-alimtalk.dto';

@Injectable()
export class BulkAlimtalkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nhnService: NhnService,
    private readonly queueService: QueueService
  ) {}

  async listCampaigns(tenantId: string, ownerAdminUserId: string) {
    const campaigns = await this.prisma.bulkAlimtalkCampaign.findMany({
      where: { tenantId, ownerAdminUserId },
      include: {
        senderProfile: true,
        providerTemplate: {
          include: {
            template: true
          }
        },
        recipients: {
          orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
          take: 6
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    return {
      campaigns
    };
  }

  async createCampaign(
    tenantId: string,
    ownerAdminUserId: string,
    userId: string,
    dto: CreateBulkAlimtalkCampaignDto
  ) {
    const draft = await this.prepareCampaignDraft(tenantId, ownerAdminUserId, userId, dto);
    const providerResult = await this.nhnService.sendBulkAlimtalk({
      senderKey: draft.senderProfile.senderKey,
      templateCode: draft.templateCode,
      scheduledAt: draft.campaign.scheduledAt,
      recipients: draft.recipientDrafts.map((recipient) => ({
        recipientNo: recipient.recipientPhone,
        recipientName: recipient.recipientName,
        recipientGroupingKey: recipient.recipientGroupingKey,
        templateParameters: recipient.templateParameters
      }))
    });

    let acceptedCount = 0;
    let failedCount = 0;
    const updateTasks: Promise<unknown>[] = [];

    for (const result of providerResult.sendResultList) {
      const isAccepted = result.resultCode === null || result.resultCode === '0';
      if (isAccepted) {
        acceptedCount += 1;
      } else {
        failedCount += 1;
      }

      if (result.recipientGroupingKey) {
        updateTasks.push(
          this.prisma.bulkAlimtalkRecipient.updateMany({
            where: {
              campaignId: draft.campaign.id,
              recipientGroupingKey: result.recipientGroupingKey
            },
            data: {
              recipientSeq: result.recipientSeq,
              status: isAccepted ? BulkSmsRecipientStatus.ACCEPTED : BulkSmsRecipientStatus.FAILED,
              providerResultCode: result.resultCode,
              providerResultMessage: result.resultMessage
            }
          })
        );
      }
    }

    await Promise.all(updateTasks);

    const campaignStatus =
      failedCount === 0
        ? BulkSmsCampaignStatus.SENT_TO_PROVIDER
        : acceptedCount > 0
          ? BulkSmsCampaignStatus.PARTIAL_FAILED
          : BulkSmsCampaignStatus.FAILED;

    await this.prisma.bulkAlimtalkCampaign.update({
      where: { id: draft.campaign.id },
      data: {
        status: campaignStatus,
        nhnRequestId: providerResult.requestId,
        acceptedCount,
        failedCount,
        providerRequest: providerResult.providerRequest as Prisma.InputJsonValue,
        providerResponse: providerResult.providerResponse as Prisma.InputJsonValue
      }
    });

    return {
      campaign: await this.loadCampaignOrThrow(draft.campaign.id)
    };
  }

  async createQueuedCampaign(
    tenantId: string,
    ownerAdminUserId: string,
    userId: string,
    dto: CreateBulkAlimtalkCampaignDto
  ) {
    const draft = await this.prepareCampaignDraft(tenantId, ownerAdminUserId, userId, dto);
    await this.queueService.enqueueBulkAlimtalkCampaign(draft.campaign.id, draft.campaign.scheduledAt);

    return {
      campaign: await this.loadCampaignOrThrow(draft.campaign.id)
    };
  }

  async getCampaignById(tenantId: string, ownerAdminUserId: string, campaignId: string) {
    const campaign = await this.prisma.bulkAlimtalkCampaign.findFirst({
      where: {
        id: campaignId,
        tenantId,
        ownerAdminUserId
      },
      include: {
        senderProfile: true,
        providerTemplate: {
          include: {
            template: true
          }
        },
        recipients: {
          orderBy: [{ status: 'asc' }, { createdAt: 'asc' }]
        }
      }
    });

    if (!campaign) {
      throw new ConflictException('Bulk AlimTalk campaign not found');
    }

    return {
      campaign
    };
  }

  private async prepareCampaignDraft(
    tenantId: string,
    ownerAdminUserId: string,
    userId: string,
    dto: CreateBulkAlimtalkCampaignDto
  ) {
    const scheduledAt = normalizeScheduledAt(dto.scheduledAt);
    const normalizedUserIds = [...new Set(dto.userIds.map((value) => value.trim()).filter(Boolean))];
    if (normalizedUserIds.length === 0) {
      throw new ConflictException('최소 한 명 이상의 유저를 선택하세요.');
    }

    if (normalizedUserIds.length > 1000) {
      throw new ConflictException('NHN bulk 알림톡은 한 번에 최대 1,000명까지 발송할 수 있습니다.');
    }

    const [senderProfile, providerTemplate, users, customFields] = await Promise.all([
      this.prisma.senderProfile.findFirst({
        where: {
          id: dto.senderProfileId,
          tenantId,
          ownerAdminUserId
        }
      }),
      dto.providerTemplateId
        ? this.prisma.providerTemplate.findFirst({
            where: {
              id: dto.providerTemplateId,
              tenantId,
              ownerAdminUserId,
              channel: 'ALIMTALK'
            },
            include: {
              template: true
            }
          })
        : Promise.resolve(null),
      this.prisma.managedUser.findMany({
        where: {
          tenantId,
          ownerAdminUserId,
          id: {
            in: normalizedUserIds
          }
        }
      }),
      this.prisma.managedUserField.findMany({
        where: { tenantId, ownerAdminUserId },
        select: { key: true }
      })
    ]);

    if (!senderProfile) {
      throw new ConflictException('등록된 카카오 채널이 필요합니다.');
    }

    if (senderProfile.status === SenderProfileStatus.BLOCKED || senderProfile.status === SenderProfileStatus.DORMANT) {
      throw new ConflictException('차단되었거나 휴면 상태인 카카오 채널로는 대량 알림톡을 보낼 수 없습니다.');
    }

    if (normalizedUserIds.length !== users.length) {
      throw new ConflictException('선택한 유저 중 일부를 찾을 수 없습니다. 목록을 새로고침한 뒤 다시 선택하세요.');
    }

    let templateSource: 'LOCAL' | 'GROUP' = 'LOCAL';
    let resolvedProviderTemplateId: string | null = null;
    let templateName = '';
    let templateCode: string | null = null;
    let body = '';
    let requiredVariables: string[] = [];

    if (providerTemplate) {
      if (providerTemplate.providerStatus !== ProviderTemplateStatus.APR) {
        throw new ConflictException('APR 승인된 알림톡 템플릿이 필요합니다.');
      }

      templateSource = 'LOCAL';
      resolvedProviderTemplateId = providerTemplate.id;
      templateName = providerTemplate.template.name;
      templateCode = providerTemplate.templateCode || providerTemplate.kakaoTemplateCode || providerTemplate.nhnTemplateId || null;
      body = providerTemplate.template.body.trim();
      requiredVariables =
        (providerTemplate.template.requiredVariables as string[] | null | undefined)?.filter(Boolean) ||
        extractRequiredVariables(body);
    } else if (dto.templateSource === 'GROUP') {
      templateSource = 'GROUP';
      templateName = dto.templateName?.trim() || dto.templateCode?.trim() || '그룹 템플릿';
      templateCode = dto.templateCode?.trim() || null;
      body = dto.templateBody?.trim() || '';
      requiredVariables = extractRequiredVariables(body);
    } else {
      throw new ConflictException('APR 승인된 로컬 템플릿 또는 승인된 그룹 템플릿이 필요합니다.');
    }

    if (!templateCode) {
      throw new ConflictException('선택한 알림톡 템플릿의 NHN templateCode를 찾을 수 없습니다.');
    }

    if (!body) {
      throw new ConflictException('선택한 알림톡 템플릿 본문이 비어 있습니다.');
    }

    const variableMappings = new Map(
      (dto.templateVariableMappings ?? [])
        .map((mapping) => [mapping.templateVariable.trim(), mapping.userFieldKey.trim()] as const)
        .filter(([templateVariable, userFieldKey]) => templateVariable && userFieldKey)
    );
    const availableFieldKeys = new Set([...USER_SYSTEM_FIELDS.map((field) => field.key), ...customFields.map((field) => field.key)]);

    for (const [templateVariable, userFieldKey] of variableMappings.entries()) {
      if (!requiredVariables.includes(templateVariable)) {
        continue;
      }

      if (!availableFieldKeys.has(userFieldKey)) {
        throw new ConflictException(`변수 ${templateVariable} 매핑에 사용한 컬럼 ${userFieldKey} 을(를) 찾을 수 없습니다.`);
      }
    }

    const missingMappings = requiredVariables.filter((variable) => !variableMappings.get(variable));
    if (missingMappings.length > 0) {
      throw new ConflictException(`다음 템플릿 변수의 컬럼 매핑이 필요합니다: ${missingMappings.join(', ')}`);
    }

    const usersById = new Map(users.map((item) => [item.id, item]));
    const seenPhones = new Set<string>();
    const recipientDrafts: Array<{
      managedUserId: string;
      recipientPhone: string;
      recipientName: string;
      recipientGroupingKey: string;
      templateParameters: Record<string, string>;
    }> = [];
    let skippedNoPhoneCount = 0;
    let duplicatePhoneCount = 0;

    for (const id of normalizedUserIds) {
      const user = usersById.get(id);
      if (!user) {
        continue;
      }

      const normalizedPhone = normalizePhoneNumber(user.phone);
      if (!normalizedPhone) {
        skippedNoPhoneCount += 1;
        continue;
      }

      if (seenPhones.has(normalizedPhone)) {
        duplicatePhoneCount += 1;
        continue;
      }

      const templateParameters = buildRecipientTemplateParameters(user, requiredVariables, variableMappings);

      seenPhones.add(normalizedPhone);
      recipientDrafts.push({
        managedUserId: user.id,
        recipientPhone: normalizedPhone,
        recipientName: user.name,
        recipientGroupingKey: `managed-user:${user.id}`,
        templateParameters
      });
    }

    if (recipientDrafts.length === 0) {
      throw new ConflictException('전화번호가 있는 유저를 최소 한 명 이상 선택해야 합니다.');
    }

    const title =
      dto.title?.trim() ||
      `${new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date())} 대량 알림톡`;

    const campaign = await this.prisma.bulkAlimtalkCampaign.create({
      data: {
        tenantId,
        ownerAdminUserId,
        title,
        scheduledAt,
        status: BulkSmsCampaignStatus.PROCESSING,
        senderProfileId: senderProfile.id,
        providerTemplateId: resolvedProviderTemplateId,
        templateSource,
        templateName,
        templateCode,
        body,
        totalRecipientCount: recipientDrafts.length,
        skippedNoPhoneCount,
        duplicatePhoneCount,
        requestedBy: userId
      }
    });

    await this.prisma.bulkAlimtalkRecipient.createMany({
      data: recipientDrafts.map((recipient) => ({
        campaignId: campaign.id,
        managedUserId: recipient.managedUserId,
        recipientPhone: recipient.recipientPhone,
        recipientName: recipient.recipientName,
        recipientGroupingKey: recipient.recipientGroupingKey,
        templateParameters: recipient.templateParameters as Prisma.InputJsonValue,
        status: BulkSmsRecipientStatus.REQUESTED
      }))
    });

    return {
      campaign,
      senderProfile,
      recipientDrafts,
      templateCode
    };
  }

  private async loadCampaignOrThrow(campaignId: string) {
    return this.prisma.bulkAlimtalkCampaign.findUniqueOrThrow({
      where: { id: campaignId },
      include: {
        senderProfile: true,
        providerTemplate: {
          include: {
            template: true
          }
        },
        recipients: {
          orderBy: [{ status: 'asc' }, { createdAt: 'asc' }]
        }
      }
    });
  }
}

function normalizeScheduledAt(value?: string): Date | null {
  if (!value) {
    return null;
  }

  const scheduledAt = new Date(value);
  if (Number.isNaN(scheduledAt.getTime())) {
    throw new BadRequestException('scheduledAt must be a valid ISO 8601 datetime');
  }

  if (scheduledAt.getTime() <= Date.now()) {
    throw new BadRequestException('scheduledAt must be in the future');
  }

  return scheduledAt;
}

function normalizePhoneNumber(value: string | null | undefined) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) {
    return null;
  }

  if (digits.startsWith('746010')) {
    return digits.slice(3);
  }

  return digits;
}

function buildRecipientTemplateParameters(
  user: {
    name: string;
    customAttributes: Prisma.JsonValue | null;
    [key: string]: unknown;
  },
  requiredVariables: string[],
  variableMappings: Map<string, string>
) {
  const parameters: Record<string, string> = {};

  for (const variable of requiredVariables) {
    const userFieldKey = variableMappings.get(variable);
    if (!userFieldKey) {
      continue;
    }

    const value = resolveManagedUserFieldValue(user, userFieldKey);
    if (value === undefined || value === null || value === '') {
      throw new ConflictException(`유저 ${user.name} 의 ${userFieldKey} 값이 비어 있어 변수 ${variable} 를 채울 수 없습니다.`);
    }

    parameters[variable] = value;
  }

  return parameters;
}

function resolveManagedUserFieldValue(
  user: {
    customAttributes: Prisma.JsonValue | null;
    [key: string]: unknown;
  },
  fieldKey: string
) {
  const systemValue = user[fieldKey];
  if (systemValue !== undefined) {
    return stringifyTemplateValue(fieldKey === 'phone' ? normalizePhoneNumber(String(systemValue)) : systemValue);
  }

  const customAttributes = user.customAttributes;
  if (!customAttributes || Array.isArray(customAttributes) || typeof customAttributes !== 'object') {
    return undefined;
  }

  return stringifyTemplateValue((customAttributes as Record<string, unknown>)[fieldKey]);
}

function stringifyTemplateValue(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value instanceof Date) {
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(value);
  }

  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => stringifyTemplateValue(item))
      .filter((item): item is string => Boolean(item));
    return normalized.length > 0 ? normalized.join(', ') : undefined;
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return undefined;
}
