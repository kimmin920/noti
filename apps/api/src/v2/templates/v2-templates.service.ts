import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { MessageChannel, TemplateStatus } from '@prisma/client';
import { SessionUser } from '../../common/session-request.interface';
import { PrismaService } from '../../database/prisma.service';
import { NhnService } from '../../nhn/nhn.service';
import { V2KakaoTemplateCatalogService } from '../shared/v2-kakao-template-catalog.service';
import { V2ReadinessService } from '../shared/v2-readiness.service';
import { canUsePartnerGroupTemplates } from '../v2-auth.utils';
import { CreateV2KakaoTemplateDto, GetV2KakaoTemplateDetailQueryDto } from './v2-templates.dto';

@Injectable()
export class V2TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly readinessService: V2ReadinessService,
    private readonly kakaoTemplateCatalogService: V2KakaoTemplateCatalogService,
    private readonly nhnService: NhnService
  ) {}

  async getSummary(sessionUser: SessionUser) {
    const [readiness, sms, kakao] = await Promise.all([
      this.readinessService.getReadiness(sessionUser.tenantId, sessionUser.userId),
      this.getSmsSummary(sessionUser.tenantId, sessionUser.userId),
      this.getKakaoSummary(sessionUser)
    ]);

    return {
      readiness,
      sms,
      kakao
    };
  }

  async getSmsTemplates(sessionUser: SessionUser) {
    const [summary, items] = await Promise.all([
      this.getSmsSummary(sessionUser.tenantId, sessionUser.userId),
      this.prisma.template.findMany({
        where: {
          tenantId: sessionUser.tenantId,
          ownerAdminUserId: sessionUser.userId,
          channel: MessageChannel.SMS
        },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          body: true,
          status: true,
          requiredVariables: true,
          updatedAt: true,
          versions: {
            orderBy: { version: 'desc' },
            take: 1,
            select: {
              version: true,
              createdAt: true
            }
          },
          _count: {
            select: {
              versions: true
            }
          }
        }
      })
    ]);

    return {
      summary,
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        body: item.body,
        status: item.status,
        requiredVariables: item.requiredVariables,
        updatedAt: item.updatedAt,
        latestVersion: item.versions[0] ?? null,
        versionCount: item._count.versions
      }))
    };
  }

  async getSmsTemplateDetail(sessionUser: SessionUser, templateId: string) {
    const template = await this.prisma.template.findFirst({
      where: {
        id: templateId,
        tenantId: sessionUser.tenantId,
        ownerAdminUserId: sessionUser.userId,
        channel: MessageChannel.SMS
      },
      select: {
        id: true,
        name: true,
        body: true,
        syntax: true,
        status: true,
        requiredVariables: true,
        createdAt: true,
        updatedAt: true,
        versions: {
          orderBy: { version: 'desc' },
          select: {
            id: true,
            version: true,
            bodySnapshot: true,
            requiredVariablesSnapshot: true,
            createdBy: true,
            createdAt: true
          }
        }
      }
    });

    if (!template) {
      throw new NotFoundException('SMS 템플릿을 찾을 수 없습니다.');
    }

    return {
      template: {
        id: template.id,
        name: template.name,
        body: template.body,
        syntax: template.syntax,
        status: template.status,
        requiredVariables: template.requiredVariables,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
        latestVersion: template.versions[0]
          ? {
              version: template.versions[0].version,
              createdAt: template.versions[0].createdAt
            }
          : null,
        versionCount: template.versions.length,
        versions: template.versions
      }
    };
  }

  async getKakaoTemplates(sessionUser: SessionUser) {
    const includePartnerGroupTemplates = canUsePartnerGroupTemplates(sessionUser);
    const [catalog, registrationTargets, categories] = await Promise.all([
      this.kakaoTemplateCatalogService.getTemplateCatalog(sessionUser.tenantId, {
        includeDefaultGroup: includePartnerGroupTemplates,
        groupScope: sessionUser.partnerScope ?? null,
        ownerAdminUserId: sessionUser.userId
      }),
      this.kakaoTemplateCatalogService.getRegistrationTargets(sessionUser.tenantId, {
        includeDefaultGroup: includePartnerGroupTemplates,
        groupScope: sessionUser.partnerScope ?? null,
        ownerAdminUserId: sessionUser.userId
      }),
      this.nhnService.fetchTemplateCategories().catch(() => [])
    ]);
    const sortedItems = [...catalog.items].sort(compareKakaoTemplateCreatedAtDesc);

    return {
      summary: {
        totalCount: catalog.summary.totalCount,
        approvedCount: catalog.summary.approvedCount,
        pendingCount: catalog.summary.pendingCount,
        rejectedCount: catalog.summary.rejectedCount
      },
      registrationTargets,
      categories: categories.map((group) => ({
        name: group.name,
        subCategories: group.subCategories.map((item) => ({
          code: item.code,
          name: item.name,
          groupName: item.groupName,
          inclusion: item.inclusion,
          exclusion: item.exclusion
        }))
      })),
      items: sortedItems.map((item) => ({
        id: item.id,
        source: item.source,
        ownerKey: item.ownerKey,
        ownerLabel: item.ownerLabel,
        name: item.templateName,
        body: item.templateBody,
        requiredVariables: item.requiredVariables,
        updatedAt: item.updatedAt,
        createdAt: item.createdAt,
        providerStatus: item.providerStatus,
        providerStatusRaw: item.providerStatusRaw,
        providerStatusName: item.providerStatusName,
        templateCode: item.templateCode,
        kakaoTemplateCode: item.kakaoTemplateCode,
        messageType: item.templateMessageType
      }))
    };
  }

  async getKakaoTemplateDetail(sessionUser: SessionUser, query: GetV2KakaoTemplateDetailQueryDto) {
    const ownerKey = query.ownerKey?.trim() || null;
    const catalog = await this.kakaoTemplateCatalogService.getTemplateCatalog(sessionUser.tenantId, {
      includeDefaultGroup: canUsePartnerGroupTemplates(sessionUser),
      groupScope: sessionUser.partnerScope ?? null,
      ownerAdminUserId: sessionUser.userId
    });
    const catalogItem = catalog.items.find(
      (item) =>
        item.source === query.source &&
        (item.ownerKey ?? null) === ownerKey &&
        (item.templateCode === query.templateCode || item.kakaoTemplateCode === query.templateCode)
    );

    if (!catalogItem?.senderKey) {
      throw new NotFoundException('알림톡 템플릿을 찾을 수 없습니다.');
    }

    const detail = await this.nhnService.fetchTemplateDetailForSenderOrGroup(
      catalogItem.senderKey,
      catalogItem.templateCode || query.templateCode
    );

    if (!detail) {
      throw new NotFoundException('알림톡 템플릿 상세를 불러올 수 없습니다.');
    }

    return {
      template: {
        id: catalogItem.id,
        source: catalogItem.source,
        ownerKey: catalogItem.ownerKey,
        ownerLabel: catalogItem.ownerLabel,
        plusFriendId: detail.plusFriendId,
        senderKey: detail.senderKey,
        plusFriendType: detail.plusFriendType,
        providerStatus: normalizeKakaoTemplateStatus(detail.status),
        providerStatusRaw: detail.status,
        providerStatusName: detail.statusName,
        templateCode: detail.templateCode,
        kakaoTemplateCode: detail.kakaoTemplateCode,
        name: detail.templateName || catalogItem.templateName,
        body: detail.templateContent || catalogItem.templateBody,
        requiredVariables: extractTemplateVariables(detail.templateContent || catalogItem.templateBody),
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
        comment: detail.comments
      }
    };
  }

  async createKakaoTemplate(sessionUser: SessionUser, dto: CreateV2KakaoTemplateDto) {
    const templateCode = dto.templateCode.trim();
    const name = dto.name.trim();
    const body = dto.body.trim();
    const categoryCode = dto.categoryCode.trim();
    const messageType = dto.messageType ?? 'AD';
    const emphasizeType = dto.emphasizeType ?? 'NONE';

    if (!templateCode || !name || !body || !categoryCode) {
      throw new BadRequestException('템플릿 코드, 이름, 본문, 카테고리는 비어 있을 수 없습니다.');
    }

    if (!/^[A-Za-z0-9_-]{1,20}$/.test(templateCode)) {
      throw new BadRequestException('템플릿 코드는 영문, 숫자, 하이픈(-), 언더스코어(_)만 허용하며 최대 20자입니다.');
    }

    if (emphasizeType === 'TEXT' && (!dto.title?.trim() || !dto.subtitle?.trim())) {
      throw new BadRequestException('강조 표기형은 제목과 부제목이 필요합니다.');
    }

    if (emphasizeType === 'IMAGE' && (!dto.imageName?.trim() || !dto.imageUrl?.trim())) {
      throw new BadRequestException('이미지형은 업로드된 이미지가 필요합니다.');
    }

    if ((messageType === 'EX' || messageType === 'MI') && !dto.extra?.trim()) {
      throw new BadRequestException('부가 정보형 또는 복합형은 부가 정보가 필요합니다.');
    }

    if ((dto.buttons?.length ?? 0) > 5) {
      throw new BadRequestException('버튼은 최대 5개까지 등록할 수 있습니다.');
    }

    if ((dto.quickReplies?.length ?? 0) > 5) {
      throw new BadRequestException('바로연결은 최대 5개까지 등록할 수 있습니다.');
    }

    if (dto.targetType === 'DEFAULT_GROUP' && !canUsePartnerGroupTemplates(sessionUser)) {
      throw new ForbiddenException('협업 운영자만 그룹 템플릿을 등록할 수 있습니다.');
    }

    const registrationTargets = await this.kakaoTemplateCatalogService.getRegistrationTargets(sessionUser.tenantId, {
      includeDefaultGroup: canUsePartnerGroupTemplates(sessionUser),
      groupScope: sessionUser.partnerScope ?? null,
      ownerAdminUserId: sessionUser.userId
    });
    const target =
      dto.targetType === 'DEFAULT_GROUP'
        ? registrationTargets.find((item) => item.type === 'DEFAULT_GROUP')
        : registrationTargets.find((item) => item.type === 'SENDER_PROFILE' && item.senderProfileId === dto.senderProfileId);

    if (!target) {
      throw new NotFoundException('알림톡 템플릿 등록 대상이 없습니다.');
    }

    let synced;
    try {
      synced = await this.nhnService.requestAlimtalkTemplateSync({
        templateCode,
        name,
        body,
        senderKey: target.senderKey,
        senderProfileType: target.senderProfileType,
        messageType,
        emphasizeType,
        extra: dto.extra?.trim() || undefined,
        title: dto.title?.trim() || undefined,
        subtitle: dto.subtitle?.trim() || undefined,
        imageName: dto.imageName?.trim() || undefined,
        imageUrl: dto.imageUrl?.trim() || undefined,
        securityFlag: dto.securityFlag ?? false,
        categoryCode,
        buttons: (dto.buttons ?? []).map((button, index) => ({
          ordering: index + 1,
          type: button.type,
          ...(button.name?.trim() ? { name: button.name.trim() } : {}),
          ...(button.linkMo?.trim() ? { linkMo: button.linkMo.trim() } : {}),
          ...(button.linkPc?.trim() ? { linkPc: button.linkPc.trim() } : {}),
          ...(button.schemeIos?.trim() ? { schemeIos: button.schemeIos.trim() } : {}),
          ...(button.schemeAndroid?.trim() ? { schemeAndroid: button.schemeAndroid.trim() } : {}),
          ...(button.bizFormId ? { bizFormId: Number(button.bizFormId) } : {}),
          ...(button.pluginId?.trim() ? { pluginId: button.pluginId.trim() } : {}),
          ...(button.telNumber?.trim() ? { telNumber: button.telNumber.trim() } : {})
        })),
        quickReplies: (dto.quickReplies ?? []).map((quickReply, index) => ({
          ordering: index + 1,
          type: quickReply.type,
          ...(quickReply.name?.trim() ? { name: quickReply.name.trim() } : {}),
          ...(quickReply.linkMo?.trim() ? { linkMo: quickReply.linkMo.trim() } : {}),
          ...(quickReply.linkPc?.trim() ? { linkPc: quickReply.linkPc.trim() } : {}),
          ...(quickReply.schemeIos?.trim() ? { schemeIos: quickReply.schemeIos.trim() } : {}),
          ...(quickReply.schemeAndroid?.trim() ? { schemeAndroid: quickReply.schemeAndroid.trim() } : {}),
          ...(quickReply.bizFormId ? { bizFormId: Number(quickReply.bizFormId) } : {}),
          ...(quickReply.pluginId?.trim() ? { pluginId: quickReply.pluginId.trim() } : {})
        }))
      });
    } catch {
      throw new BadGatewayException('알림톡 템플릿 검수 요청에 실패했습니다. 입력값과 발신 채널 상태를 확인해 주세요.');
    }

    return {
      target: {
        type: target.type,
        label: target.label,
        senderKey: target.senderKey
      },
      template: synced
    };
  }

  async uploadKakaoTemplateImage(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('업로드할 이미지 파일이 필요합니다.');
    }

    let uploaded;
    try {
      uploaded = await this.nhnService.uploadTemplateImage(file);
    } catch (error) {
      const baseMessage = '템플릿 이미지 업로드에 실패했습니다.';
      const fallbackMessage = `${baseMessage} 파일 형식과 크기를 확인해 주세요.`;

      if (error instanceof HttpException) {
        const response = error.getResponse();
        const responseObject =
          response && typeof response === 'object' ? (response as { message?: string | string[] }) : null;
        const rawMessage =
          typeof response === 'string'
            ? response
            : Array.isArray(responseObject?.message)
              ? responseObject.message.join(', ')
              : typeof responseObject?.message === 'string'
                ? responseObject.message
                : error.message;
        const normalizedMessage = rawMessage
          .replace(/^NHN template image upload failed:\s*/i, '')
          .replace(/^템플릿 이미지 업로드에 실패했습니다\.\s*/i, '')
          .trim();

        throw new BadGatewayException(normalizedMessage ? `${baseMessage} ${normalizedMessage}` : fallbackMessage);
      }

      throw new BadGatewayException(
        error instanceof Error && error.message ? `${baseMessage} ${error.message}` : fallbackMessage
      );
    }

    if (!uploaded.templateImageName || !uploaded.templateImageUrl) {
      throw new BadRequestException('템플릿 이미지 응답이 올바르지 않습니다.');
    }

    return uploaded;
  }

  private async getSmsSummary(tenantId: string, ownerAdminUserId: string) {
    const [totalCount, draftCount, publishedCount, archivedCount] = await Promise.all([
      this.prisma.template.count({
        where: {
          tenantId,
          ownerAdminUserId,
          channel: MessageChannel.SMS
        }
      }),
      this.prisma.template.count({
        where: {
          tenantId,
          ownerAdminUserId,
          channel: MessageChannel.SMS,
          status: TemplateStatus.DRAFT
        }
      }),
      this.prisma.template.count({
        where: {
          tenantId,
          ownerAdminUserId,
          channel: MessageChannel.SMS,
          status: TemplateStatus.PUBLISHED
        }
      }),
      this.prisma.template.count({
        where: {
          tenantId,
          ownerAdminUserId,
          channel: MessageChannel.SMS,
          status: TemplateStatus.ARCHIVED
        }
      })
    ]);

    return {
      totalCount,
      draftCount,
      publishedCount,
      archivedCount
    };
  }

  private async getKakaoSummary(sessionUser: SessionUser) {
    const catalog = await this.kakaoTemplateCatalogService.getTemplateCatalog(sessionUser.tenantId, {
      includeDefaultGroup: canUsePartnerGroupTemplates(sessionUser),
      groupScope: sessionUser.partnerScope ?? null,
      ownerAdminUserId: sessionUser.userId
    });

    return {
      totalCount: catalog.summary.totalCount,
      approvedCount: catalog.summary.approvedCount,
      pendingCount: catalog.summary.pendingCount,
      rejectedCount: catalog.summary.rejectedCount
    };
  }
}

function extractTemplateVariables(body: string) {
  return Array.from(new Set([...body.matchAll(/#\{([^}]+)\}/g)].map((item) => item[1].trim()).filter(Boolean)));
}

function normalizeKakaoTemplateStatus(status: string | null | undefined) {
  const normalized = String(status || '').toUpperCase();

  if (normalized === 'APR' || normalized === 'TSC03') {
    return 'APR' as const;
  }

  if (normalized === 'REJ' || normalized === 'TSC04') {
    return 'REJ' as const;
  }

  return 'REQ' as const;
}

function compareKakaoTemplateCreatedAtDesc(
  left: { createdAt: string | null; updatedAt: string | null },
  right: { createdAt: string | null; updatedAt: string | null }
) {
  const leftTime = parseSortableDate(left.createdAt) ?? parseSortableDate(left.updatedAt) ?? 0;
  const rightTime = parseSortableDate(right.createdAt) ?? parseSortableDate(right.updatedAt) ?? 0;

  return rightTime - leftTime;
}

function parseSortableDate(value: string | null) {
  if (!value) {
    return null;
  }

  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}
