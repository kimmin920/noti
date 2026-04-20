import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { extractRequiredVariables, formatSmsBody, sanitizeAdvertisingServiceName } from '@publ/shared';
import {
  BulkSmsCampaignStatus,
  BulkSmsRecipientStatus,
  Prisma,
  SenderNumberStatus,
  TemplateStatus
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { NhnService } from '../nhn/nhn.service';
import { QueueService } from '../queue/queue.service';
import { SmsQuotaService } from '../sms-quota/sms-quota.service';
import { CreateBulkSmsCampaignDto } from './bulk-sms.dto';
import { USER_SYSTEM_FIELDS } from '../users/users.mapping';

@Injectable()
export class BulkSmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nhnService: NhnService,
    private readonly queueService: QueueService,
    private readonly smsQuotaService: SmsQuotaService
  ) {}

  async listCampaignsForUser(ownerUserId: string) {
    return this.listCampaigns(ownerUserId);
  }

  async createCampaignForUser(userId: string, dto: CreateBulkSmsCampaignDto) {
    return this.createCampaign(userId, userId, dto);
  }

  async createQueuedCampaignForUser(userId: string, dto: CreateBulkSmsCampaignDto) {
    return this.createQueuedCampaign(userId, userId, dto);
  }

  async getCampaignByIdForUser(ownerUserId: string, campaignId: string) {
    return this.getCampaignById(ownerUserId, campaignId);
  }

  async listCampaigns(ownerUserId: string) {
    const campaigns = await this.prisma.bulkSmsCampaign.findMany({
      where: { ownerUserId },
      include: {
        senderNumber: true,
        template: true,
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

  async createCampaign(ownerUserId: string, userId: string, dto: CreateBulkSmsCampaignDto) {
    const draft = await this.prepareCampaignDraft(ownerUserId, userId, dto);

    const providerBody = draft.requiredVariables.length > 0 ? normalizeNhnTemplateBody(draft.body) : draft.body;

    const providerResult = await this.nhnService.sendBulkSms({
      sendNo: normalizePhoneNumber(draft.senderNumber.phoneNumber) || draft.senderNumber.phoneNumber,
      body: providerBody,
      scheduledAt: draft.campaign.scheduledAt,
      recipients: draft.recipientDrafts.map((recipient) => ({
        recipientNo: recipient.recipientPhone,
        recipientName: recipient.recipientName,
        recipientGroupingKey: recipient.recipientGroupingKey,
        templateParameters: recipient.templateParameters
      }))
    });

    const updateTasks: Promise<unknown>[] = [];
    let hasAcceptedRecipient = false;
    let hasFailedRecipient = false;

    for (const [index, result] of providerResult.sendResultList.entries()) {
      const isAccepted = result.resultCode === null || result.resultCode === '0';
      hasAcceptedRecipient ||= isAccepted;
      hasFailedRecipient ||= !isAccepted;

      const fallbackRecipient = draft.recipientDrafts[index];
      const recipientWhere = buildBulkRecipientWhere(draft.campaign.id, {
        recipientGroupingKey: result.recipientGroupingKey,
        recipientNo: result.recipientNo,
        fallbackGroupingKey: fallbackRecipient?.recipientGroupingKey
      });

      if (!recipientWhere) {
        continue;
      }

      updateTasks.push(
        this.prisma.bulkSmsRecipient.updateMany({
          where: recipientWhere,
          data: isAccepted
            ? {
                recipientSeq: result.recipientSeq
              }
            : {
                recipientSeq: result.recipientSeq,
                status: BulkSmsRecipientStatus.FAILED
              }
        })
      );
    }

    await Promise.all(updateTasks);

    const campaignStatus =
      hasAcceptedRecipient && !hasFailedRecipient
        ? BulkSmsCampaignStatus.SENT_TO_PROVIDER
        : hasAcceptedRecipient
          ? BulkSmsCampaignStatus.PARTIAL_FAILED
          : BulkSmsCampaignStatus.FAILED;

    await this.prisma.bulkSmsCampaign.update({
      where: { id: draft.campaign.id },
      data: {
        status: campaignStatus,
        nhnRequestId: providerResult.requestId,
        providerRequest: Prisma.JsonNull,
        providerResponse: Prisma.JsonNull
      }
    });

    return {
      campaign: await this.loadCampaignOrThrow(draft.campaign.id)
    };
  }

  async createQueuedCampaign(ownerUserId: string, userId: string, dto: CreateBulkSmsCampaignDto) {
    const draft = await this.prepareCampaignDraft(ownerUserId, userId, dto);
    await this.queueService.enqueueBulkSmsCampaign(draft.campaign.id, draft.campaign.scheduledAt);

    return {
      campaign: await this.loadCampaignOrThrow(draft.campaign.id)
    };
  }

  async getCampaignById(ownerUserId: string, campaignId: string) {
    const campaign = await this.prisma.bulkSmsCampaign.findFirst({
      where: {
        id: campaignId,
        ownerUserId
      },
      include: {
        senderNumber: true,
        template: true,
        recipients: {
          orderBy: [{ status: 'asc' }, { createdAt: 'asc' }]
        }
      }
    });

    if (!campaign) {
      throw new ConflictException('Bulk SMS campaign not found');
    }

    return {
      campaign
    };
  }

  private async prepareCampaignDraft(
    ownerUserId: string,
    userId: string,
    dto: CreateBulkSmsCampaignDto
  ) {
    const scheduledAt = normalizeScheduledAt(dto.scheduledAt);
    const normalizedUserIds = [...new Set(dto.userIds.map((value) => value.trim()).filter(Boolean))];
    if (normalizedUserIds.length === 0) {
      throw new ConflictException('최소 한 명 이상의 유저를 선택하세요.');
    }

    if (normalizedUserIds.length > 1000) {
      throw new ConflictException('NHN bulk SMS는 한 번에 최대 1,000명까지 발송할 수 있습니다.');
    }

    const [senderNumber, template, users, customFields] = await Promise.all([
      this.prisma.senderNumber.findFirst({
        where: {
          id: dto.senderNumberId,
          ownerUserId,
          status: SenderNumberStatus.APPROVED
        }
      }),
      dto.templateId
        ? this.prisma.template.findFirst({
            where: {
              id: dto.templateId,
              ownerUserId,
              channel: 'SMS'
            }
          })
        : Promise.resolve(null),
      this.prisma.managedUser.findMany({
        where: {
          ownerUserId,
          id: {
            in: normalizedUserIds
          }
        }
      }),
      this.prisma.managedUserField.findMany({
        where: { ownerUserId },
        select: { key: true }
      })
    ]);

    if (!senderNumber) {
      throw new ConflictException('승인된 SMS 발신번호가 필요합니다.');
    }

    if (normalizedUserIds.length !== users.length) {
      throw new ConflictException('선택한 유저 중 일부를 찾을 수 없습니다. 목록을 새로고침한 뒤 다시 선택하세요.');
    }

    let body = dto.body?.trim() || '';
    if (dto.templateId) {
      if (!template || template.status !== TemplateStatus.PUBLISHED) {
        throw new ConflictException('대량 SMS에는 게시된 SMS 템플릿만 사용할 수 있습니다.');
      }

      body = template.body.trim();
    }

    if (!body) {
      throw new ConflictException('발송 본문을 입력하세요.');
    }

    const advertisingServiceName = sanitizeAdvertisingServiceName(dto.advertisingServiceName);
    body = formatSmsBody(body, {
      isAdvertisement: dto.isAdvertisement,
      advertisingServiceName
    });

    const requiredVariables = extractRequiredVariables(body);
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
      templateParameters?: Record<string, string>;
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

      const templateParameters =
        requiredVariables.length > 0 ? buildRecipientTemplateParameters(user, requiredVariables, variableMappings) : undefined;

      seenPhones.add(normalizedPhone);
      recipientDrafts.push({
        managedUserId: user.id,
        recipientPhone: normalizedPhone,
        recipientName: user.name,
        recipientGroupingKey: `managed-user:${user.id}`,
        ...(templateParameters ? { templateParameters } : {})
      });
    }

    if (recipientDrafts.length === 0) {
      throw new ConflictException('전화번호가 있는 유저를 최소 한 명 이상 선택해야 합니다.');
    }

    const title = dto.title?.trim() || `${new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date())} 대량 SMS`;

    const usageAt = scheduledAt ?? new Date();
    const campaign = await this.prisma.$transaction(async (tx) => {
      await this.smsQuotaService.assertCanReserveUsage(tx, ownerUserId, recipientDrafts.length, usageAt);
      const created = await tx.bulkSmsCampaign.create({
        data: {
          ownerUserId,
          title,
          scheduledAt,
          status: BulkSmsCampaignStatus.PROCESSING,
          senderNumberId: senderNumber.id,
          templateId: template?.id ?? null,
          body,
          totalRecipientCount: recipientDrafts.length,
          skippedNoPhoneCount,
          duplicatePhoneCount
        }
      });

      await tx.bulkSmsRecipient.createMany({
        data: recipientDrafts.map((recipient) => ({
          campaignId: created.id,
          managedUserId: recipient.managedUserId,
          recipientPhone: recipient.recipientPhone,
          recipientName: recipient.recipientName,
          recipientGroupingKey: recipient.recipientGroupingKey,
          templateParameters: (recipient.templateParameters as Prisma.InputJsonValue | undefined) ?? undefined,
          status: BulkSmsRecipientStatus.REQUESTED
        }))
      });

      await this.smsQuotaService.reserveUsage(tx, {
        ownerUserId,
        senderNumberId: senderNumber.id,
        bulkSmsCampaignId: created.id,
        quantity: recipientDrafts.length,
        usageAt
      });

      return created;
    });

    return {
      campaign,
      senderNumber,
      recipientDrafts,
      requiredVariables,
      body
    };
  }

  private async loadCampaignOrThrow(campaignId: string) {
    return this.prisma.bulkSmsCampaign.findUniqueOrThrow({
      where: { id: campaignId },
      include: {
        senderNumber: true,
        template: true,
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

function buildBulkRecipientWhere(
  campaignId: string,
  options: {
    recipientGroupingKey?: string | null;
    recipientNo?: string | null;
    fallbackGroupingKey?: string | null;
  }
): Prisma.BulkSmsRecipientWhereInput | null {
  if (options.recipientGroupingKey) {
    return {
      campaignId,
      recipientGroupingKey: options.recipientGroupingKey
    };
  }

  const normalizedRecipientNo = normalizePhoneNumber(options.recipientNo);
  if (normalizedRecipientNo) {
    return {
      campaignId,
      recipientPhone: normalizedRecipientNo
    };
  }

  if (options.fallbackGroupingKey) {
    return {
      campaignId,
      recipientGroupingKey: options.fallbackGroupingKey
    };
  }

  return null;
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

  return Object.keys(parameters).length > 0 ? parameters : undefined;
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

function normalizeNhnTemplateBody(body: string) {
  return body.replace(/\{\{\s*([^}]+?)\s*\}\}|#\{\s*([^}]+?)\s*\}/g, (_, mustacheKey: string | undefined, hashKey: string | undefined) => {
    const key = (mustacheKey ?? hashKey ?? '').trim();
    return key ? `##${key}##` : '';
  });
}
