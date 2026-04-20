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
import {
  NhnBrandTemplate,
  NhnBrandTemplateButton,
  NhnBrandTemplateCarousel,
  NhnBrandTemplateCommerce,
  NhnBrandTemplateCoupon,
  NhnBrandTemplateImagePayload,
  NhnBrandTemplateImageType,
  NhnBrandTemplateVideo,
  NhnBrandTemplateWideItem,
  NhnService
} from '../../nhn/nhn.service';
import { V2KakaoTemplateCatalogService } from '../shared/v2-kakao-template-catalog.service';
import { V2ReadinessService } from '../shared/v2-readiness.service';
import { canUsePartnerGroupTemplates } from '../v2-auth.utils';
import {
  CreateV2BrandTemplateDto,
  CreateV2KakaoTemplateDto,
  DeleteV2BrandTemplateQueryDto,
  GetV2BrandTemplateDetailQueryDto,
  GetV2KakaoTemplateDetailQueryDto,
  UpdateV2BrandTemplateDto,
  UploadV2BrandTemplateImageDto
} from './v2-templates.dto';

@Injectable()
export class V2TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly readinessService: V2ReadinessService,
    private readonly kakaoTemplateCatalogService: V2KakaoTemplateCatalogService,
    private readonly nhnService: NhnService
  ) {}

  async getSummary(sessionUser: SessionUser) {
    const [readiness, sms, kakao, brand] = await Promise.all([
      this.readinessService.getReadinessForUser(sessionUser.userId),
      this.getSmsSummary(sessionUser.userId),
      this.getKakaoSummary(sessionUser),
      this.getBrandSummary(sessionUser.userId)
    ]);

    return {
      readiness,
      sms,
      kakao,
      brand
    };
  }

  async getSmsTemplates(sessionUser: SessionUser) {
    const [summary, items] = await Promise.all([
      this.getSmsSummary(sessionUser.userId),
      this.prisma.template.findMany({
        where: {
          ownerUserId: sessionUser.userId,
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
        ownerUserId: sessionUser.userId,
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
      this.kakaoTemplateCatalogService.getTemplateCatalogForUser(sessionUser.userId, {
        includeDefaultGroup: includePartnerGroupTemplates,
        groupScope: sessionUser.accessOrigin === 'PUBL' ? 'PUBL' : null
      }),
      this.kakaoTemplateCatalogService.getRegistrationTargetsForUser(sessionUser.userId, {
        includeDefaultGroup: includePartnerGroupTemplates,
        groupScope: sessionUser.accessOrigin === 'PUBL' ? 'PUBL' : null
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

  async getBrandTemplates(sessionUser: SessionUser) {
    const senderProfiles = await this.kakaoTemplateCatalogService.getSenderProfilesForUser(sessionUser.userId, {
      activeOnly: true
    });
    const buckets = await Promise.all(
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
    const items = summarizeBrandTemplateList(buckets);

    return {
      summary: {
        totalCount: items.length,
        approvedCount: items.filter((item) => item.providerStatus === 'APR').length,
        pendingCount: items.filter((item) => item.providerStatus === 'REQ').length,
        rejectedCount: items.filter((item) => item.providerStatus === 'REJ').length
      },
      registrationTargets: senderProfiles.map((profile) => ({
        id: profile.id,
        label: profile.plusFriendId,
        senderKey: profile.senderKey,
        plusFriendId: profile.plusFriendId,
        senderProfileType: profile.senderProfileType,
        status: profile.status
      })),
      items
    };
  }

  async getKakaoTemplateDetail(sessionUser: SessionUser, query: GetV2KakaoTemplateDetailQueryDto) {
    const ownerKey = query.ownerKey?.trim() || null;
    const catalog = await this.kakaoTemplateCatalogService.getTemplateCatalogForUser(sessionUser.userId, {
      includeDefaultGroup: canUsePartnerGroupTemplates(sessionUser),
      groupScope: sessionUser.accessOrigin === 'PUBL' ? 'PUBL' : null
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

  async getBrandTemplateDetail(sessionUser: SessionUser, query: GetV2BrandTemplateDetailQueryDto) {
    const senderProfile = await this.prisma.senderProfile.findFirst({
      where: {
        id: query.senderProfileId,
        ownerUserId: sessionUser.userId
      },
      select: {
        id: true,
        plusFriendId: true,
        senderKey: true,
        senderProfileType: true,
        status: true
      }
    });

    if (!senderProfile) {
      throw new NotFoundException('브랜드 메시지 발신 프로필을 찾을 수 없습니다.');
    }

    const detail = await this.nhnService.fetchBrandTemplateDetail(senderProfile.senderKey, query.templateCode.trim());

    if (!detail) {
      throw new NotFoundException('브랜드 메시지 템플릿 상세를 불러올 수 없습니다.');
    }

    return {
      template: summarizeBrandTemplate(senderProfile, detail)
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

    if (dto.targetType === 'GROUP' && !canUsePartnerGroupTemplates(sessionUser)) {
      throw new ForbiddenException('협업 운영자만 그룹 템플릿을 등록할 수 있습니다.');
    }

    const registrationTargets = await this.kakaoTemplateCatalogService.getRegistrationTargetsForUser(sessionUser.userId, {
      includeDefaultGroup: canUsePartnerGroupTemplates(sessionUser),
      groupScope: sessionUser.accessOrigin === 'PUBL' ? 'PUBL' : null
    });
    const requestedTargetId = dto.targetId?.trim() || null;
    const target =
      dto.targetType === 'GROUP'
        ? registrationTargets.find(
            (item) =>
              item.type === 'GROUP' &&
              (requestedTargetId ? item.id === requestedTargetId || item.senderKey === requestedTargetId : true)
          )
        : registrationTargets.find(
            (item) =>
              item.type === 'SENDER_PROFILE' &&
              (requestedTargetId ? item.id === requestedTargetId : item.senderProfileId === dto.senderProfileId)
          );

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
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new BadGatewayException('알림톡 템플릿 검수 요청에 실패했습니다. 입력값과 발신 채널 상태를 확인해 주세요.');
    }

    return {
      target: {
        id: target.id,
        type: target.type,
        label: target.label,
        senderKey: target.senderKey
      },
      template: synced
    };
  }

  async createBrandTemplate(sessionUser: SessionUser, dto: CreateV2BrandTemplateDto) {
    validateBrandTemplatePayload(dto);

    const senderProfile = await this.prisma.senderProfile.findFirst({
      where: {
        id: dto.senderProfileId,
        ownerUserId: sessionUser.userId
      },
      select: {
        id: true,
        plusFriendId: true,
        senderKey: true,
        senderProfileType: true,
        status: true
      }
    });

    if (!senderProfile) {
      throw new NotFoundException('브랜드 메시지 발신 프로필을 찾을 수 없습니다.');
    }

    let created;
    try {
      created = await this.nhnService.createBrandTemplate(buildBrandTemplateCreateRequest(senderProfile.senderKey, dto));
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new BadGatewayException('브랜드 메시지 템플릿 등록에 실패했습니다. 입력값과 발신 프로필 상태를 확인해 주세요.');
    }

    return {
      target: {
        id: senderProfile.id,
        label: senderProfile.plusFriendId,
        senderKey: senderProfile.senderKey
      },
      template: created.template ? summarizeBrandTemplate(senderProfile, created.template) : created
    };
  }

  async updateBrandTemplate(sessionUser: SessionUser, templateCode: string, dto: UpdateV2BrandTemplateDto) {
    validateBrandTemplatePayload(dto);

    const senderProfile = await this.prisma.senderProfile.findFirst({
      where: {
        id: dto.senderProfileId,
        ownerUserId: sessionUser.userId
      },
      select: {
        id: true,
        plusFriendId: true,
        senderKey: true,
        senderProfileType: true,
        status: true
      }
    });

    if (!senderProfile) {
      throw new NotFoundException('브랜드 메시지 발신 프로필을 찾을 수 없습니다.');
    }

    let updated;
    try {
      updated = await this.nhnService.updateBrandTemplate({
        templateCode: templateCode.trim(),
        ...buildBrandTemplateCreateRequest(senderProfile.senderKey, dto)
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new BadGatewayException('브랜드 메시지 템플릿 수정에 실패했습니다. 입력값과 발신 프로필 상태를 확인해 주세요.');
    }

    return {
      target: {
        id: senderProfile.id,
        label: senderProfile.plusFriendId,
        senderKey: senderProfile.senderKey
      },
      template: updated.template ? summarizeBrandTemplate(senderProfile, updated.template) : updated
    };
  }

  async deleteBrandTemplate(
    sessionUser: SessionUser,
    templateCode: string,
    query: DeleteV2BrandTemplateQueryDto
  ) {
    const senderProfile = await this.prisma.senderProfile.findFirst({
      where: {
        id: query.senderProfileId,
        ownerUserId: sessionUser.userId
      },
      select: {
        id: true,
        plusFriendId: true,
        senderKey: true
      }
    });

    if (!senderProfile) {
      throw new NotFoundException('브랜드 메시지 발신 프로필을 찾을 수 없습니다.');
    }

    try {
      await this.nhnService.deleteBrandTemplate(senderProfile.senderKey, templateCode.trim());
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new BadGatewayException('브랜드 메시지 템플릿 삭제에 실패했습니다. 발신 프로필 상태를 확인해 주세요.');
    }

    return {
      deleted: {
        senderProfileId: senderProfile.id,
        senderKey: senderProfile.senderKey,
        templateCode: templateCode.trim()
      }
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

  async uploadBrandTemplateImage(file: Express.Multer.File, dto: UploadV2BrandTemplateImageDto) {
    if (!file) {
      throw new BadRequestException('업로드할 이미지 파일이 필요합니다.');
    }

    let uploaded;
    try {
      uploaded = await this.nhnService.uploadBrandMessageImage(file, {
        imageType: dto.imageType as NhnBrandTemplateImageType
      });
    } catch (error) {
      const baseMessage = '브랜드 메시지 템플릿 이미지 업로드에 실패했습니다.';
      const fallbackMessage = `${baseMessage} 파일 형식과 크기, 비율을 확인해 주세요.`;

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
          .replace(/^NHN brand message image upload failed:\s*/i, '')
          .replace(/^브랜드 메시지 템플릿 이미지 업로드에 실패했습니다\.\s*/i, '')
          .trim();

        throw new BadGatewayException(normalizedMessage ? `${baseMessage} ${normalizedMessage}` : fallbackMessage);
      }

      throw new BadGatewayException(
        error instanceof Error && error.message ? `${baseMessage} ${error.message}` : fallbackMessage
      );
    }

    if (!uploaded.imageUrl) {
      throw new BadRequestException('브랜드 메시지 템플릿 이미지 응답이 올바르지 않습니다.');
    }

    return uploaded;
  }

  private async getSmsSummary(ownerUserId: string) {
    const [totalCount, draftCount, publishedCount, archivedCount] = await Promise.all([
      this.prisma.template.count({
        where: {
          ownerUserId,
          channel: MessageChannel.SMS
        }
      }),
      this.prisma.template.count({
        where: {
          ownerUserId,
          channel: MessageChannel.SMS,
          status: TemplateStatus.DRAFT
        }
      }),
      this.prisma.template.count({
        where: {
          ownerUserId,
          channel: MessageChannel.SMS,
          status: TemplateStatus.PUBLISHED
        }
      }),
      this.prisma.template.count({
        where: {
          ownerUserId,
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
    const catalog = await this.kakaoTemplateCatalogService.getTemplateCatalogForUser(sessionUser.userId, {
      includeDefaultGroup: canUsePartnerGroupTemplates(sessionUser),
      groupScope: sessionUser.accessOrigin === 'PUBL' ? 'PUBL' : null
    });

    return {
      totalCount: catalog.summary.totalCount,
      approvedCount: catalog.summary.approvedCount,
      pendingCount: catalog.summary.pendingCount,
      rejectedCount: catalog.summary.rejectedCount
    };
  }

  private async getBrandSummary(ownerUserId: string) {
    const senderProfiles = await this.kakaoTemplateCatalogService.getSenderProfilesForUser(ownerUserId, {
      activeOnly: true
    });
    const items = (
      await Promise.all(
        senderProfiles.map(async (profile) => {
          try {
            const response = await this.nhnService.fetchBrandTemplatesForSender(profile.senderKey, {
              pageNum: 1,
              pageSize: 100
            });
            return response.templates.map((template) => summarizeBrandTemplate(profile, template));
          } catch {
            return [];
          }
        })
      )
    ).flat();
    const approvedCount = items.filter((item) => item.providerStatus === 'APR').length;
    const rejectedCount = items.filter((item) => item.providerStatus === 'REJ').length;

    return {
      totalCount: items.length,
      approvedCount,
      pendingCount: items.length - approvedCount - rejectedCount,
      rejectedCount
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

function normalizeBrandTemplateStatus(status: string | null | undefined, statusName?: string | null) {
  const normalized = String(status || '')
    .trim()
    .toUpperCase();
  const normalizedName = String(statusName || '')
    .trim()
    .toUpperCase();

  if (
    normalized === 'APR' ||
    normalized === 'A' ||
    normalized === 'APPROVED' ||
    normalized === 'USE' ||
    normalized === 'USABLE' ||
    normalized === 'AVAILABLE' ||
    normalized === 'ACTIVE' ||
    normalizedName.includes('사용 가능'.toUpperCase()) ||
    normalizedName.includes('사용가능'.toUpperCase()) ||
    normalizedName.includes('AVAILABLE') ||
    normalizedName.includes('ACTIVE')
  ) {
    return 'APR' as const;
  }

  if (
    normalized === 'REJ' ||
    normalized === 'REJECTED' ||
    normalized === 'DENY' ||
    normalized === 'DENIED' ||
    normalized === 'FAIL' ||
    normalizedName.includes('반려'.toUpperCase()) ||
    normalizedName.includes('거부'.toUpperCase()) ||
    normalizedName.includes('실패'.toUpperCase())
  ) {
    return 'REJ' as const;
  }

  return 'REQ' as const;
}

function summarizeBrandTemplate(
  senderProfile: {
    id: string;
    plusFriendId: string;
    senderKey: string;
    senderProfileType?: string | null;
    status?: string | null;
  },
  template: NhnBrandTemplate
) {
  const templateCode = template.templateCode || `brand:${senderProfile.id}:${template.templateName || 'template'}`;
  const requiredVariables = extractBrandTemplateVariables(template);

  return {
    id: `nhn:brand:${senderProfile.id}:${templateCode}`,
    senderProfileId: senderProfile.id,
    senderKey: senderProfile.senderKey,
    plusFriendId: senderProfile.plusFriendId,
    senderProfileType: senderProfile.senderProfileType ?? null,
    senderProfileStatus: senderProfile.status ?? null,
    ownerLabel: senderProfile.plusFriendId,
    providerStatus: normalizeBrandTemplateStatus(template.status, template.statusName),
    providerStatusRaw: template.status,
    providerStatusName: template.statusName,
    templateCode: template.templateCode,
    templateName: template.templateName || '이름 없는 브랜드 템플릿',
    requiredVariables,
    chatBubbleType: template.chatBubbleType,
    adult: template.adult,
    content: template.content,
    header: template.header,
    additionalContent: template.additionalContent,
    image: template.image,
    buttons: template.buttons,
    item: template.item,
    coupon: template.coupon,
    commerce: template.commerce,
    video: template.video,
    carousel: template.carousel,
    createdAt: template.createDate,
    updatedAt: template.updateDate
  };
}

function summarizeBrandTemplateList(
  buckets: Array<{
    profile: {
      id: string;
      plusFriendId: string;
      senderKey: string;
      senderProfileType?: string | null;
      status?: string | null;
    };
    templates: NhnBrandTemplate[];
  }>
) {
  return buckets
    .flatMap((bucket) => bucket.templates.map((template) => summarizeBrandTemplate(bucket.profile, template)))
    .sort(compareBrandTemplateCreatedAtDesc);
}

function compareBrandTemplateCreatedAtDesc(
  left: { createdAt: string | null; updatedAt: string | null },
  right: { createdAt: string | null; updatedAt: string | null }
) {
  return compareKakaoTemplateCreatedAtDesc(left, right);
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

function validateBrandTemplatePayload(dto: CreateV2BrandTemplateDto) {
  if (!dto.senderProfileId?.trim()) {
    throw new BadRequestException('발신 프로필을 선택해 주세요.');
  }

  if (!dto.templateName?.trim()) {
    throw new BadRequestException('템플릿 이름을 입력해 주세요.');
  }

  const type = dto.chatBubbleType;

  if (type === 'TEXT' || type === 'IMAGE' || type === 'WIDE') {
    if (!dto.content?.trim()) {
      throw new BadRequestException('내용을 입력해 주세요.');
    }
  }

  if ((type === 'IMAGE' || type === 'WIDE' || type === 'COMMERCE') && !dto.image?.imageUrl?.trim()) {
    throw new BadRequestException('이 유형은 이미지를 먼저 업로드해 주세요.');
  }

  if (type === 'WIDE_ITEM_LIST') {
    if (!dto.header?.trim()) {
      throw new BadRequestException('와이드 아이템리스트형은 header가 필요합니다.');
    }
    if (!dto.item?.list?.length) {
      throw new BadRequestException('와이드 아이템리스트형은 아이템 목록이 필요합니다.');
    }
    if (dto.item.list.length < 3 || dto.item.list.length > 4) {
      throw new BadRequestException('와이드 아이템리스트형은 3~4개 아이템이 필요합니다.');
    }
  }

  if (type === 'PREMIUM_VIDEO' && !dto.video?.videoUrl?.trim()) {
    throw new BadRequestException('프리미엄 동영상형은 Video URL이 필요합니다.');
  }

  if (type === 'COMMERCE' && !dto.commerce?.title?.trim()) {
    throw new BadRequestException('커머스형은 commerce title이 필요합니다.');
  }

  if ((type === 'CAROUSEL_FEED' || type === 'CAROUSEL_COMMERCE') && !dto.carousel?.list?.length) {
    throw new BadRequestException('캐러셀형은 캐러셀 아이템이 필요합니다.');
  }

  if (type === 'CAROUSEL_FEED') {
    if (dto.carousel!.list.length < 2 || dto.carousel!.list.length > 6) {
      throw new BadRequestException('캐러셀 피드형은 2~6개 아이템이 필요합니다.');
    }
    if (dto.carousel!.list.some((item) => !item.header?.trim() || !item.message?.trim())) {
      throw new BadRequestException('캐러셀 피드형은 각 아이템의 header와 message가 필요합니다.');
    }
  }

  if (type === 'CAROUSEL_COMMERCE') {
    const minCount = dto.carousel?.head ? 1 : 2;
    const maxCount = dto.carousel?.head ? 5 : 6;
    if ((dto.carousel?.list.length ?? 0) < minCount || (dto.carousel?.list.length ?? 0) > maxCount) {
      throw new BadRequestException(`캐러셀 커머스형은 ${minCount}~${maxCount}개 아이템이 필요합니다.`);
    }
    if (dto.carousel?.head && (!dto.carousel.head.header?.trim() || !dto.carousel.head.content?.trim() || !dto.carousel.head.imageUrl?.trim())) {
      throw new BadRequestException('캐러셀 커머스형 인트로는 header, content, imageUrl이 모두 필요합니다.');
    }
    if (dto.carousel?.list.some((item) => !item.commerce?.title?.trim())) {
      throw new BadRequestException('캐러셀 커머스형은 각 아이템의 commerce title이 필요합니다.');
    }
  }

  if (dto.additionalContent?.trim() && type !== 'COMMERCE') {
    throw new BadRequestException('부가정보는 커머스형에서만 사용할 수 있습니다.');
  }

  if (dto.header?.trim() && type !== 'WIDE_ITEM_LIST' && type !== 'PREMIUM_VIDEO') {
    throw new BadRequestException('header는 와이드 아이템리스트형 또는 프리미엄 동영상형에서만 사용할 수 있습니다.');
  }

  if (dto.item && type !== 'WIDE_ITEM_LIST') {
    throw new BadRequestException('와이드 아이템리스트형이 아닌 경우 item을 사용할 수 없습니다.');
  }

  if (dto.video && type !== 'PREMIUM_VIDEO') {
    throw new BadRequestException('video는 프리미엄 동영상형에서만 사용할 수 있습니다.');
  }

  if (dto.commerce && type !== 'COMMERCE') {
    throw new BadRequestException('commerce는 커머스형에서만 사용할 수 있습니다.');
  }

  if (dto.carousel && type !== 'CAROUSEL_FEED' && type !== 'CAROUSEL_COMMERCE') {
    throw new BadRequestException('carousel은 캐러셀형에서만 사용할 수 있습니다.');
  }

  if ((dto.buttons?.length ?? 0) > 5) {
    throw new BadRequestException('버튼은 최대 5개까지 등록할 수 있습니다.');
  }
}

function buildBrandTemplateCreateRequest(senderKey: string, dto: CreateV2BrandTemplateDto) {
  const base = {
    senderKey,
    templateName: dto.templateName.trim(),
    chatBubbleType: dto.chatBubbleType,
    adult: dto.adult ?? false
  };

  const content = trimOrUndefined(dto.content);
  const header = trimOrUndefined(dto.header);
  const additionalContent = trimOrUndefined(dto.additionalContent);
  const image = normalizeBrandImage(dto.image);
  const buttons = normalizeBrandButtons(dto.buttons);
  const item = normalizeBrandWideItems(dto.item);
  const coupon = normalizeBrandCoupon(dto.coupon);
  const commerce = normalizeBrandCommerce(dto.commerce);
  const video = normalizeBrandVideo(dto.video);
  const carousel = normalizeBrandCarousel(dto);

  switch (dto.chatBubbleType) {
    case 'TEXT':
      return {
        ...base,
        ...(content ? { content } : {}),
        ...(buttons.length ? { buttons } : {}),
        ...(coupon ? { coupon } : {})
      };
    case 'IMAGE':
      return {
        ...base,
        ...(content ? { content } : {}),
        ...(image ? { image } : {}),
        ...(buttons.length ? { buttons } : {}),
        ...(coupon ? { coupon } : {})
      };
    case 'WIDE':
      return {
        ...base,
        ...(content ? { content } : {}),
        ...(image ? { image } : {}),
        ...(buttons.length ? { buttons } : {}),
        ...(coupon ? { coupon } : {})
      };
    case 'WIDE_ITEM_LIST':
      return {
        ...base,
        ...(header ? { header } : {}),
        ...(item ? { item } : {})
      };
    case 'PREMIUM_VIDEO':
      return {
        ...base,
        ...(content ? { content } : {}),
        ...(header ? { header } : {}),
        ...(video ? { video } : {}),
        ...(buttons.length ? { buttons } : {})
      };
    case 'COMMERCE':
      return {
        ...base,
        ...(additionalContent ? { additionalContent } : {}),
        ...(image ? { image } : {}),
        ...(commerce ? { commerce } : {}),
        ...(buttons.length ? { buttons } : {}),
        ...(coupon ? { coupon } : {})
      };
    case 'CAROUSEL_FEED':
    case 'CAROUSEL_COMMERCE':
      return {
        ...base,
        ...(carousel ? { carousel } : {})
      };
  }
}

function trimOrUndefined(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeBrandImage(image: CreateV2BrandTemplateDto['image']): NhnBrandTemplateImagePayload | undefined {
  if (!image?.imageUrl?.trim()) {
    return undefined;
  }

  return {
    imageUrl: image.imageUrl.trim(),
    imageLink: image.imageLink?.trim() || null
  };
}

function normalizeBrandButtons(buttons: CreateV2BrandTemplateDto['buttons'] = []): NhnBrandTemplateButton[] {
  return (buttons ?? []).map((button) => ({
    name: button.name.trim(),
    type: button.type,
    ...(button.linkMo?.trim() ? { linkMo: button.linkMo.trim() } : {}),
    ...(button.linkPc?.trim() ? { linkPc: button.linkPc.trim() } : {}),
    ...(button.schemeAndroid?.trim() ? { schemeAndroid: button.schemeAndroid.trim() } : {}),
    ...(button.schemeIos?.trim() ? { schemeIos: button.schemeIos.trim() } : {}),
    ...(button.chatExtra?.trim() ? { chatExtra: button.chatExtra.trim() } : {}),
    ...(button.chatEvent?.trim() ? { chatEvent: button.chatEvent.trim() } : {}),
    ...(button.bizFormKey?.trim() ? { bizFormKey: button.bizFormKey.trim() } : {})
  }));
}

function normalizeBrandWideItems(item: CreateV2BrandTemplateDto['item']): { list: NhnBrandTemplateWideItem[] } | undefined {
  if (!item?.list?.length) {
    return undefined;
  }

  return {
    list: item.list.map((entry) => ({
      title: entry.title?.trim() || null,
      imageUrl: entry.imageUrl.trim(),
      ...(entry.linkMo?.trim() ? { linkMo: entry.linkMo.trim() } : {}),
      ...(entry.linkPc?.trim() ? { linkPc: entry.linkPc.trim() } : {}),
      ...(entry.schemeAndroid?.trim() ? { schemeAndroid: entry.schemeAndroid.trim() } : {}),
      ...(entry.schemeIos?.trim() ? { schemeIos: entry.schemeIos.trim() } : {})
    }))
  };
}

function normalizeBrandCoupon(coupon: CreateV2BrandTemplateDto['coupon']): NhnBrandTemplateCoupon | undefined {
  if (!coupon?.title?.trim()) {
    return undefined;
  }

  return {
    title: coupon.title.trim(),
    description: coupon.description?.trim() || null,
    ...(coupon.linkMo?.trim() ? { linkMo: coupon.linkMo.trim() } : {}),
    ...(coupon.linkPc?.trim() ? { linkPc: coupon.linkPc.trim() } : {}),
    ...(coupon.schemeAndroid?.trim() ? { schemeAndroid: coupon.schemeAndroid.trim() } : {}),
    ...(coupon.schemeIos?.trim() ? { schemeIos: coupon.schemeIos.trim() } : {})
  };
}

function normalizeBrandCommerce(commerce: CreateV2BrandTemplateDto['commerce']): NhnBrandTemplateCommerce | undefined {
  if (!commerce?.title?.trim()) {
    return undefined;
  }

  return {
    title: commerce.title.trim(),
    regularPrice: commerce.regularPrice ?? null,
    discountPrice: commerce.discountPrice ?? null,
    discountRate: commerce.discountRate ?? null,
    discountFixed: commerce.discountFixed ?? null
  };
}

function normalizeBrandVideo(video: CreateV2BrandTemplateDto['video']): NhnBrandTemplateVideo | undefined {
  if (!video?.videoUrl?.trim()) {
    return undefined;
  }

  return {
    videoUrl: video.videoUrl.trim(),
    thumbnailUrl: video.thumbnailUrl?.trim() || null
  };
}

function normalizeBrandCarousel(dto: CreateV2BrandTemplateDto): NhnBrandTemplateCarousel | undefined {
  if (!dto.carousel?.list?.length) {
    return undefined;
  }

  const head =
    dto.chatBubbleType === 'CAROUSEL_COMMERCE' && dto.carousel.head
      ? {
          header: dto.carousel.head.header?.trim() || null,
          content: dto.carousel.head.content?.trim() || null,
          imageUrl: dto.carousel.head.imageUrl.trim(),
          ...(dto.carousel.head.linkMo?.trim() ? { linkMo: dto.carousel.head.linkMo.trim() } : {}),
          ...(dto.carousel.head.linkPc?.trim() ? { linkPc: dto.carousel.head.linkPc.trim() } : {}),
          ...(dto.carousel.head.schemeAndroid?.trim() ? { schemeAndroid: dto.carousel.head.schemeAndroid.trim() } : {}),
          ...(dto.carousel.head.schemeIos?.trim() ? { schemeIos: dto.carousel.head.schemeIos.trim() } : {})
        }
      : null;

  return {
    head,
    list: dto.carousel.list.map((item) => ({
      header: dto.chatBubbleType === 'CAROUSEL_FEED' ? item.header?.trim() || null : null,
      message: dto.chatBubbleType === 'CAROUSEL_FEED' ? item.message?.trim() || null : null,
      additionalContent: dto.chatBubbleType === 'CAROUSEL_COMMERCE' ? item.additionalContent?.trim() || null : null,
      imageUrl: item.imageUrl.trim(),
      imageLink: item.imageLink?.trim() || null,
      buttons: normalizeBrandButtons(item.buttons),
      coupon: normalizeBrandCoupon(item.coupon) ?? null,
      commerce: dto.chatBubbleType === 'CAROUSEL_COMMERCE' ? normalizeBrandCommerce(item.commerce) ?? null : null
    })),
    tail: dto.carousel.tail
      ? {
          ...(dto.carousel.tail.linkMo?.trim() ? { linkMo: dto.carousel.tail.linkMo.trim() } : {}),
          ...(dto.carousel.tail.linkPc?.trim() ? { linkPc: dto.carousel.tail.linkPc.trim() } : {}),
          ...(dto.carousel.tail.schemeAndroid?.trim() ? { schemeAndroid: dto.carousel.tail.schemeAndroid.trim() } : {}),
          ...(dto.carousel.tail.schemeIos?.trim() ? { schemeIos: dto.carousel.tail.schemeIos.trim() } : {})
        }
      : null
  };
}
