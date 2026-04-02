import { Injectable } from '@nestjs/common';
import { SenderProfileStatus } from '@prisma/client';
import { EnvService } from '../../common/env';
import { PrismaService } from '../../database/prisma.service';
import { NhnAlimtalkTemplate, NhnSenderGroup, NhnService } from '../../nhn/nhn.service';

export type V2KakaoTemplateSource = 'GROUP' | 'SENDER_PROFILE';
export type V2KakaoTemplateStatus = 'APR' | 'REQ' | 'REJ';

export interface V2KakaoSenderProfileItem {
  id: string;
  plusFriendId: string;
  senderKey: string;
  senderProfileType: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface V2KakaoTemplateCatalogItem {
  id: string;
  source: V2KakaoTemplateSource;
  ownerKey: string | null;
  ownerLabel: string;
  plusFriendId: string | null;
  senderKey: string | null;
  providerStatus: V2KakaoTemplateStatus;
  providerStatusRaw: string | null;
  providerStatusName: string | null;
  templateCode: string | null;
  kakaoTemplateCode: string | null;
  templateMessageType: string | null;
  templateName: string;
  templateBody: string;
  requiredVariables: string[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface V2KakaoTemplateCatalogSummary {
  totalCount: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
}

export interface V2KakaoTemplateRegistrationTarget {
  id: string;
  type: V2KakaoTemplateSource;
  label: string;
  senderKey: string;
  senderProfileType: 'GROUP' | 'NORMAL';
  senderProfileId: string | null;
  plusFriendId: string | null;
}

export interface V2KakaoTemplateCatalogOptions {
  activeOnly?: boolean;
  includeDefaultGroup?: boolean;
  groupScope?: 'DIRECT' | 'PUBL' | null;
  ownerAdminUserId?: string | null;
}

@Injectable()
export class V2KakaoTemplateCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nhnService: NhnService,
    private readonly env: EnvService
  ) {}

  async getSenderProfiles(
    tenantId: string,
    options?: Pick<V2KakaoTemplateCatalogOptions, 'activeOnly' | 'ownerAdminUserId'>
  ) {
    return this.prisma.senderProfile.findMany({
      where: {
        tenantId,
        ...(options?.ownerAdminUserId ? { ownerAdminUserId: options.ownerAdminUserId } : {}),
        ...(options?.activeOnly ? { status: SenderProfileStatus.ACTIVE } : {})
      },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        plusFriendId: true,
        senderKey: true,
        senderProfileType: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    }) as Promise<V2KakaoSenderProfileItem[]>;
  }

  async getTemplateCatalog(tenantId: string, options?: V2KakaoTemplateCatalogOptions) {
    const senderProfiles = await this.getSenderProfiles(tenantId, options);
    const defaultGroupKey =
      options?.includeDefaultGroup === true ? this.resolveGroupSenderKey(options.groupScope ?? null) : null;

    const [defaultGroup, defaultGroupTemplates, senderProfileTemplateBuckets] = await Promise.all([
      this.fetchDefaultGroup(defaultGroupKey),
      this.fetchDefaultGroupTemplates(defaultGroupKey),
      Promise.all(senderProfiles.map(async (profile) => ({
        senderKey: profile.senderKey,
        ownerLabel: profile.plusFriendId,
        templates: await this.fetchTemplatesForOwner(profile.senderKey)
      })))
    ]);

    const items = [
      ...defaultGroupTemplates.map((template) =>
        this.serializeTemplate({
          source: 'GROUP',
          ownerKey: defaultGroupKey,
          ownerLabel: defaultGroup?.groupName || '기본 그룹',
          template
        })
      ),
      ...senderProfileTemplateBuckets.flatMap((bucket) =>
        bucket.templates.map((template) =>
          this.serializeTemplate({
            source: 'SENDER_PROFILE',
            ownerKey: bucket.senderKey,
            ownerLabel: bucket.ownerLabel,
            template
          })
        )
      )
    ];

    return {
      senderProfiles,
      defaultGroup: {
        configuredGroupKey: defaultGroupKey,
        groupName: defaultGroup?.groupName || null,
        exists: Boolean(defaultGroup)
      },
      items,
      summary: this.summarize(items)
    };
  }

  async getRegistrationTargets(
    tenantId: string,
    options?: Pick<V2KakaoTemplateCatalogOptions, 'includeDefaultGroup' | 'groupScope' | 'ownerAdminUserId'>
  ): Promise<V2KakaoTemplateRegistrationTarget[]> {
    const configuredGroupKey =
      options?.includeDefaultGroup === true ? this.resolveGroupSenderKey(options.groupScope ?? null) : null;
    const [defaultGroup, senderProfiles] = await Promise.all([
      this.fetchDefaultGroup(configuredGroupKey),
      this.getSenderProfiles(tenantId, {
        activeOnly: true,
        ownerAdminUserId: options?.ownerAdminUserId ?? null
      })
    ]);

    return [
      ...(configuredGroupKey && defaultGroup
        ? [
            {
              id: configuredGroupKey,
              type: 'GROUP' as const,
              label: defaultGroup.groupName || '기본 그룹',
              senderKey: configuredGroupKey,
              senderProfileType: 'GROUP' as const,
              senderProfileId: null,
              plusFriendId: null
            }
          ]
        : []),
      ...senderProfiles.map((profile) => ({
        id: profile.id,
        type: 'SENDER_PROFILE' as const,
        label: profile.plusFriendId,
        senderKey: profile.senderKey,
        senderProfileType: (profile.senderProfileType === 'GROUP' ? 'GROUP' : 'NORMAL') as 'GROUP' | 'NORMAL',
        senderProfileId: profile.id,
        plusFriendId: profile.plusFriendId
      }))
    ];
  }

  private async fetchDefaultGroup(groupSenderKey: string | null): Promise<NhnSenderGroup | null> {
    if (!groupSenderKey) {
      return null;
    }

    try {
      return await this.nhnService.fetchSenderGroup(groupSenderKey);
    } catch {
      return null;
    }
  }

  private async fetchDefaultGroupTemplates(groupSenderKey: string | null): Promise<NhnAlimtalkTemplate[]> {
    if (!groupSenderKey) {
      return [];
    }

    return this.fetchTemplatesForOwner(groupSenderKey);
  }

  private async fetchTemplatesForOwner(senderKey: string): Promise<NhnAlimtalkTemplate[]> {
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

  private resolveGroupSenderKey(groupScope: 'DIRECT' | 'PUBL' | null) {
    if (groupScope !== 'PUBL') {
      return null;
    }

    return this.env.nhnDefaultSenderGroupKey.trim() || null;
  }

  private summarize(items: V2KakaoTemplateCatalogItem[]): V2KakaoTemplateCatalogSummary {
    const approvedCount = items.filter((item) => item.providerStatus === 'APR').length;
    const rejectedCount = items.filter((item) => item.providerStatus === 'REJ').length;

    return {
      totalCount: items.length,
      approvedCount,
      rejectedCount,
      pendingCount: items.length - approvedCount - rejectedCount
    };
  }

  private serializeTemplate(params: {
    source: V2KakaoTemplateSource;
    ownerKey: string | null;
    ownerLabel: string | null;
    template: NhnAlimtalkTemplate;
  }): V2KakaoTemplateCatalogItem {
    const status = normalizeKakaoTemplateStatus(params.template.status);
    const templateCode =
      params.template.templateCode ||
      params.template.kakaoTemplateCode ||
      `${params.source.toLowerCase()}_${params.ownerKey || 'default'}_${params.template.templateName || 'template'}`;

    return {
      id: `nhn:${params.source}:${params.ownerKey || 'none'}:${templateCode}`,
      source: params.source,
      ownerKey: params.ownerKey,
      ownerLabel: params.ownerLabel || (params.source === 'GROUP' ? '기본 그룹' : '연결 채널'),
      plusFriendId: params.template.plusFriendId,
      senderKey: params.template.senderKey,
      providerStatus: status,
      providerStatusRaw: params.template.status,
      providerStatusName: params.template.statusName,
      templateCode: params.template.templateCode,
      kakaoTemplateCode: params.template.kakaoTemplateCode,
      templateMessageType: params.template.templateMessageType,
      templateName:
        params.template.templateName ||
        params.template.templateCode ||
        params.template.kakaoTemplateCode ||
        '이름 없는 템플릿',
      templateBody: params.template.templateContent || '',
      requiredVariables: extractTemplateVariables(params.template.templateContent || ''),
      createdAt: params.template.createDate,
      updatedAt: params.template.updateDate
    };
  }
}

function normalizeKakaoTemplateStatus(status: string | null | undefined): V2KakaoTemplateStatus {
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
  const matches = [
    ...Array.from(body.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)),
    ...Array.from(body.matchAll(/#\{\s*([^}]+?)\s*\}/g))
  ]
    .map((match) => match[1]?.trim())
    .filter(Boolean) as string[];

  return [...new Set(matches)];
}
