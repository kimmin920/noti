import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { BulkSmsCampaignStatus, BulkSmsRecipientStatus, Prisma, SenderProfileStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { NhnService } from '../nhn/nhn.service';
import { QueueService } from '../queue/queue.service';
import { USER_SYSTEM_FIELDS } from '../users/users.mapping';
import { CreateBulkBrandMessageCampaignDto } from './bulk-brand-message.dto';

@Injectable()
export class BulkBrandMessageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nhnService: NhnService,
    private readonly queueService: QueueService
  ) {}

  async createQueuedCampaignForUser(userId: string, dto: CreateBulkBrandMessageCampaignDto) {
    return this.createQueuedCampaign(userId, userId, dto);
  }

  async getCampaignByIdForUser(ownerUserId: string, campaignId: string) {
    return this.getCampaignById(ownerUserId, campaignId);
  }

  async createCampaign(ownerUserId: string, userId: string, dto: CreateBulkBrandMessageCampaignDto) {
    const draft = await this.prepareCampaignDraft(ownerUserId, userId, dto);

    const providerResult = await this.nhnService.sendBulkBrandMessage({
      senderKey: draft.senderProfile.senderKey,
      mode: draft.campaign.mode as 'FREESTYLE' | 'TEMPLATE',
      targeting: 'I',
      messageType: draft.campaign.messageType as
        | 'TEXT'
        | 'IMAGE'
        | 'WIDE'
        | 'WIDE_ITEM_LIST'
        | 'CAROUSEL_FEED'
        | 'PREMIUM_VIDEO'
        | 'COMMERCE'
        | 'CAROUSEL_COMMERCE',
      content: draft.campaign.mode === 'FREESTYLE' ? draft.campaign.body : undefined,
      templateCode: draft.campaign.templateCode,
      pushAlarm: draft.campaign.pushAlarm,
      adult: draft.campaign.adult,
      statsId: draft.campaign.statsEventKey,
      resellerCode: draft.campaign.resellerCode,
      buttons: parseButtons(draft.campaign.buttonsJson),
      image:
        draft.campaign.imageUrl || draft.campaign.imageLink
          ? {
              imageUrl: draft.campaign.imageUrl,
              imageLink: draft.campaign.imageLink
            }
          : null,
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
        this.prisma.bulkBrandMessageRecipient.updateMany({
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

    await this.prisma.bulkBrandMessageCampaign.update({
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

  async createQueuedCampaign(ownerUserId: string, userId: string, dto: CreateBulkBrandMessageCampaignDto) {
    const draft = await this.prepareCampaignDraft(ownerUserId, userId, dto);
    await this.queueService.enqueueBulkBrandMessageCampaign(draft.campaign.id, draft.campaign.scheduledAt);

    return {
      campaign: await this.loadCampaignOrThrow(draft.campaign.id)
    };
  }

  async getCampaignById(ownerUserId: string, campaignId: string) {
    const campaign = await this.prisma.bulkBrandMessageCampaign.findFirst({
      where: {
        id: campaignId,
        ownerUserId
      },
      include: {
        senderProfile: true,
        recipients: {
          orderBy: [{ status: 'asc' }, { createdAt: 'asc' }]
        }
      }
    });

    if (!campaign) {
      throw new ConflictException('Bulk brand message campaign not found');
    }

    return {
      campaign
    };
  }

  private async prepareCampaignDraft(
    ownerUserId: string,
    userId: string,
    dto: CreateBulkBrandMessageCampaignDto
  ) {
    const mode = dto.mode ?? 'FREESTYLE';
    const scheduledAt = normalizeScheduledAt(dto.scheduledAt);
    const normalizedUserIds = [...new Set(dto.userIds.map((value) => value.trim()).filter(Boolean))];
    if (normalizedUserIds.length === 0) {
      throw new ConflictException('최소 한 명 이상의 유저를 선택하세요.');
    }

    if (normalizedUserIds.length > 1000) {
      throw new ConflictException('브랜드 메시지 대량 발송은 한 번에 최대 1,000명까지 선택할 수 있습니다.');
    }

    const [senderProfile, users, customFields] = await Promise.all([
      this.prisma.senderProfile.findFirst({
        where: {
          id: dto.senderProfileId,
          ownerUserId
        }
      }),
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

    if (!senderProfile) {
      throw new ConflictException('등록된 카카오 채널이 필요합니다.');
    }

    if (senderProfile.status === SenderProfileStatus.BLOCKED || senderProfile.status === SenderProfileStatus.DORMANT) {
      throw new ConflictException('차단되었거나 휴면 상태인 카카오 채널로는 브랜드 메시지를 보낼 수 없습니다.');
    }

    if (normalizedUserIds.length !== users.length) {
      throw new ConflictException('선택한 유저 중 일부를 찾을 수 없습니다. 목록을 새로고침한 뒤 다시 선택하세요.');
    }

    const buttons =
      dto.buttons
        ?.map((button) => ({
          type: button.type,
          name: button.name.trim(),
          linkMo: button.linkMo?.trim() || null,
          linkPc: button.linkPc?.trim() || null,
          schemeIos: button.schemeIos?.trim() || null,
          schemeAndroid: button.schemeAndroid?.trim() || null
        }))
        .filter((button) => button.name) ?? [];

    const normalizedImageLink = dto.image?.imageLink?.trim() || null;
    if (normalizedImageLink && !/^https?:\/\//i.test(normalizedImageLink)) {
      throw new ConflictException('이미지 링크는 http:// 또는 https:// 를 포함해야 합니다.');
    }

    const imageUrl = dto.image?.imageUrl?.trim() || null;

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

      seenPhones.add(normalizedPhone);

      recipientDrafts.push({
        managedUserId: user.id,
        recipientPhone: normalizedPhone,
        recipientName: user.name,
        recipientGroupingKey: `managed-user:${user.id}`
      });
    }

    if (recipientDrafts.length === 0) {
      throw new ConflictException('전화번호가 있는 유저를 최소 한 명 이상 선택해야 합니다.');
    }

    const availableFieldKeys = new Set([...USER_SYSTEM_FIELDS.map((field) => field.key), ...customFields.map((field) => field.key)]);
    let messageType =
      (dto.messageType as
        | 'TEXT'
        | 'IMAGE'
        | 'WIDE'
        | 'WIDE_ITEM_LIST'
        | 'CAROUSEL_FEED'
        | 'PREMIUM_VIDEO'
        | 'COMMERCE'
        | 'CAROUSEL_COMMERCE'
        | undefined) ?? 'TEXT';
    let body = '';
    let templateName: string | null = null;
    let templateCode: string | null = null;

    if (mode === 'TEMPLATE') {
      templateCode = dto.templateCode?.trim() || null;
      templateName = dto.templateName?.trim() || dto.templateCode?.trim() || '브랜드 템플릿';
      body = dto.templateBody?.trim() || '';

      if (!templateCode) {
        throw new ConflictException('브랜드 템플릿 코드를 선택해 주세요.');
      }

      if (!body) {
        throw new ConflictException('선택한 브랜드 템플릿 본문 정보를 찾을 수 없습니다.');
      }

      const requiredVariables =
        (dto.requiredVariables ?? [])
          .map((item) => item.trim())
          .filter(Boolean)
          .filter((item, index, array) => array.indexOf(item) === index)
          .length > 0
          ? (dto.requiredVariables ?? [])
              .map((item) => item.trim())
              .filter(Boolean)
              .filter((item, index, array) => array.indexOf(item) === index)
          : extractBrandTemplateVariables(body);

      const variableMappings = new Map(
        (dto.templateVariableMappings ?? [])
          .map((mapping) => [mapping.templateVariable.trim(), mapping.userFieldKey.trim()] as const)
          .filter(([templateVariable, userFieldKey]) => templateVariable && userFieldKey)
      );

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

      recipientDrafts.splice(
        0,
        recipientDrafts.length,
        ...recipientDrafts.map((recipient) => {
          const user = usersById.get(recipient.managedUserId);
          if (!user) {
            return recipient;
          }

          return {
            ...recipient,
            templateParameters: buildRecipientTemplateParameters(user, requiredVariables, variableMappings)
          };
        })
      );
    } else {
      body = dto.content?.trim() || '';
      if (!body) {
        throw new ConflictException('브랜드 메시지 본문을 입력하세요.');
      }

      if (messageType !== 'TEXT' && messageType !== 'IMAGE' && messageType !== 'WIDE') {
        throw new ConflictException('자유형 브랜드 메시지는 텍스트형, 이미지형, 와이드형만 지원합니다.');
      }

      if (messageType === 'IMAGE' && body.length > 400) {
        throw new ConflictException('이미지 브랜드 메시지 본문은 400자 이하로 입력하세요.');
      }

      if (messageType === 'WIDE' && body.length > 76) {
        throw new ConflictException('와이드 브랜드 메시지 본문은 76자 이하로 입력하세요.');
      }

      const buttonLimit = messageType === 'WIDE' ? 2 : 5;
      if (buttons.length > buttonLimit) {
        throw new ConflictException(
          messageType === 'WIDE'
            ? '와이드 브랜드 메시지 버튼은 최대 2개까지 추가할 수 있습니다.'
            : '브랜드 메시지 버튼은 최대 5개까지 추가할 수 있습니다.'
        );
      }

      if (messageType !== 'TEXT' && !imageUrl) {
        throw new ConflictException('이미지형 브랜드 메시지는 이미지 URL이 필요합니다.');
      }
    }

    const title =
      dto.title?.trim() ||
      `${new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date())} 브랜드 메시지`;

    const campaign = await this.prisma.bulkBrandMessageCampaign.create({
      data: {
        ownerUserId,
        title,
        scheduledAt,
        status: BulkSmsCampaignStatus.PROCESSING,
        senderProfileId: senderProfile.id,
        mode,
        messageType,
        templateName,
        templateCode,
        body,
        pushAlarm: dto.pushAlarm !== false,
        adult: Boolean(dto.adult),
        statsEventKey: dto.statsEventKey?.trim() || null,
        resellerCode: dto.resellerCode?.trim() || null,
        imageUrl,
        imageLink: normalizedImageLink,
        buttonsJson: buttons as Prisma.InputJsonValue,
        totalRecipientCount: recipientDrafts.length,
        skippedNoPhoneCount,
        duplicatePhoneCount
      }
    });

    await this.prisma.bulkBrandMessageRecipient.createMany({
      data: recipientDrafts.map((recipient) => ({
        campaignId: campaign.id,
        managedUserId: recipient.managedUserId,
        recipientPhone: recipient.recipientPhone,
        recipientName: recipient.recipientName,
        recipientGroupingKey: recipient.recipientGroupingKey,
        templateParameters: recipient.templateParameters
          ? (recipient.templateParameters as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        status: BulkSmsRecipientStatus.REQUESTED
      }))
    });

    return {
      campaign,
      senderProfile,
      recipientDrafts
    };
  }

  private async loadCampaignOrThrow(campaignId: string) {
    return this.prisma.bulkBrandMessageCampaign.findUniqueOrThrow({
      where: { id: campaignId },
      include: {
        senderProfile: true,
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

function parseButtons(value: Prisma.JsonValue | null) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>) : null))
    .filter(Boolean)
    .flatMap((item) => {
      if (!item || typeof item.type !== 'string' || typeof item.name !== 'string') {
        return [];
      }

      return [
        {
          type: item.type as 'WL' | 'AL' | 'BK' | 'MD',
          name: item.name,
          linkMo: typeof item.linkMo === 'string' ? item.linkMo : null,
          linkPc: typeof item.linkPc === 'string' ? item.linkPc : null,
          schemeIos: typeof item.schemeIos === 'string' ? item.schemeIos : null,
          schemeAndroid: typeof item.schemeAndroid === 'string' ? item.schemeAndroid : null
        }
      ];
    });
}

function buildBulkRecipientWhere(
  campaignId: string,
  options: {
    recipientGroupingKey?: string | null;
    recipientNo?: string | null;
    fallbackGroupingKey?: string | null;
  }
): Prisma.BulkBrandMessageRecipientWhereInput | null {
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

function extractBrandTemplateVariables(body: string) {
  return Array.from(
    new Set(
      Array.from(body.matchAll(/#\{([^}]+)\}/g))
        .map((match) => match[1]?.trim())
        .filter((value): value is string => Boolean(value))
    )
  );
}
