import { BadGatewayException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { EnvService } from '../common/env';

interface NhnTokenCache {
  accessToken: string;
  expiresAt: number;
}

export interface NhnRegisteredSendNo {
  serviceId: number | null;
  sendNo: string;
  useYn: 'Y' | 'N';
  blockYn: 'Y' | 'N';
  blockReason: string | null;
  createDate: string | null;
  createUser: string | null;
  updateDate: string | null;
  updateUser: string | null;
}

export interface NhnAlimtalkSender {
  plusFriendId: string;
  senderKey: string;
  categoryCode: string | null;
  status: string | null;
  statusName: string | null;
  kakaoStatus: string | null;
  kakaoStatusName: string | null;
  kakaoProfileStatus: string | null;
  kakaoProfileStatusName: string | null;
  profileSpamLevel: string | null;
  profileMessageSpamLevel: string | null;
  dormant: boolean | null;
  block: boolean | null;
  createDate: string | null;
  initialUserRestriction: boolean | null;
  alimtalk: Record<string, unknown> | null;
  friendtalk: Record<string, unknown> | null;
}

export interface NhnAlimtalkSenderCategory {
  parentCode: string | null;
  depth: number | null;
  code: string | null;
  name: string | null;
  subCategories: NhnAlimtalkSenderCategory[];
}

export interface NhnApiHeader {
  resultCode?: number;
  resultMessage?: string;
  isSuccessful?: boolean;
}

interface NhnSenderListApiResponse {
  header?: NhnApiHeader;
  senders?: unknown[];
  totalCount?: number;
}

interface NhnSenderApiResponse {
  header?: NhnApiHeader;
  sender?: unknown;
}

interface NhnSenderGroupApiResponse {
  header?: NhnApiHeader;
  senderGroup?: {
    groupName?: string;
    senderKey?: string;
    status?: string;
    senders?: Array<{
      plusFriendId?: string;
      senderKey?: string;
      createDate?: string;
    }>;
    createDate?: string;
    updateDate?: string;
  };
}

interface NhnTemplateListApiResponse {
  header?: NhnApiHeader;
  templateListResponse?: {
    templates?: unknown[];
    totalCount?: number;
  };
}

interface NhnTemplateApiResponse {
  header?: NhnApiHeader;
  template?: unknown;
}

export interface NhnAlimtalkTemplate {
  plusFriendId: string | null;
  senderKey: string | null;
  plusFriendType: string | null;
  templateCode: string | null;
  kakaoTemplateCode: string | null;
  templateName: string | null;
  templateMessageType: string | null;
  templateEmphasizeType: string | null;
  templateContent: string | null;
  status: string | null;
  statusName: string | null;
  securityFlag: boolean | null;
  categoryCode: string | null;
  createDate: string | null;
  updateDate: string | null;
}

export interface NhnSenderGroupMember {
  plusFriendId: string | null;
  senderKey: string | null;
  createDate: string | null;
}

export interface NhnSenderGroup {
  groupName: string | null;
  senderKey: string | null;
  status: string | null;
  senders: NhnSenderGroupMember[];
  createDate: string | null;
  updateDate: string | null;
}

@Injectable()
export class NhnService {
  private readonly logger = new Logger(NhnService.name);
  private tokenCache: NhnTokenCache | null = null;

  constructor(private readonly env: EnvService) {}

  private ensureAlimtalkApiConfig() {
    if (this.env.isPlaceholder(this.env.nhnAlimtalkAppKey) || this.env.isPlaceholder(this.env.nhnAlimtalkSecretKey)) {
      throw new InternalServerErrorException('NHN_ALIMTALK_APP_KEY and NHN_ALIMTALK_SECRET_KEY must be configured');
    }
  }

  private async requestAlimtalkApi<T>(config: AxiosRequestConfig): Promise<T> {
    this.ensureAlimtalkApiConfig();

    try {
      const response = await axios.request<T>({
        baseURL: this.env.nhnAlimtalkBaseUrl,
        ...config,
        headers: {
          'X-Secret-Key': this.env.nhnAlimtalkSecretKey,
          ...(config.headers ?? {})
        }
      });

      return response.data;
    } catch (error) {
      const axiosError = error instanceof AxiosError ? error : null;
      const responseData = axiosError?.response?.data as
        | { header?: { resultMessage?: string }; message?: string }
        | undefined;

      const message =
        responseData?.header?.resultMessage ||
        responseData?.message ||
        axiosError?.message ||
        'Unknown NHN AlimTalk API error';

      throw new BadGatewayException(`NHN AlimTalk API request failed: ${message}`);
    }
  }

  private mapTemplateStatus(status: string | null | undefined): 'REQ' | 'APR' | 'REJ' {
    const normalized = String(status || '').toUpperCase();

    if (normalized === 'TSC03' || normalized === 'APR') {
      return 'APR';
    }

    if (normalized === 'TSC04' || normalized === 'REJ') {
      return 'REJ';
    }

    return 'REQ';
  }

  private normalizeSender(raw: unknown): NhnAlimtalkSender | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const sender = raw as Record<string, unknown>;
    const plusFriendId = sender.plusFriendId;
    const senderKey = sender.senderKey;

    if (typeof plusFriendId !== 'string' || typeof senderKey !== 'string') {
      return null;
    }

    return {
      plusFriendId,
      senderKey,
      categoryCode: typeof sender.categoryCode === 'string' ? sender.categoryCode : null,
      status: typeof sender.status === 'string' ? sender.status : null,
      statusName: typeof sender.statusName === 'string' ? sender.statusName : null,
      kakaoStatus: typeof sender.kakaoStatus === 'string' ? sender.kakaoStatus : null,
      kakaoStatusName: typeof sender.kakaoStatusName === 'string' ? sender.kakaoStatusName : null,
      kakaoProfileStatus: typeof sender.kakaoProfileStatus === 'string' ? sender.kakaoProfileStatus : null,
      kakaoProfileStatusName:
        typeof sender.kakaoProfileStatusName === 'string' ? sender.kakaoProfileStatusName : null,
      profileSpamLevel: typeof sender.profileSpamLevel === 'string' ? sender.profileSpamLevel : null,
      profileMessageSpamLevel:
        typeof sender.profileMessageSpamLevel === 'string' ? sender.profileMessageSpamLevel : null,
      dormant: typeof sender.dormant === 'boolean' ? sender.dormant : null,
      block: typeof sender.block === 'boolean' ? sender.block : null,
      createDate: typeof sender.createDate === 'string' ? sender.createDate : null,
      initialUserRestriction:
        typeof sender.initialUserRestriction === 'boolean' ? sender.initialUserRestriction : null,
      alimtalk:
        sender.alimtalk && typeof sender.alimtalk === 'object'
          ? (sender.alimtalk as Record<string, unknown>)
          : null,
      friendtalk:
        sender.friendtalk && typeof sender.friendtalk === 'object'
          ? (sender.friendtalk as Record<string, unknown>)
          : null
    };
  }

  private normalizeCategories(raw: unknown): NhnAlimtalkSenderCategory[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }

        const category = item as Record<string, unknown>;

        return {
          parentCode: typeof category.parentCode === 'string' ? category.parentCode : null,
          depth: typeof category.depth === 'number' ? category.depth : null,
          code: typeof category.code === 'string' ? category.code : null,
          name: typeof category.name === 'string' ? category.name : null,
          subCategories: this.normalizeCategories(category.subCategories)
        } satisfies NhnAlimtalkSenderCategory;
      })
      .filter(Boolean) as NhnAlimtalkSenderCategory[];
  }

  private normalizeTemplate(raw: unknown): NhnAlimtalkTemplate | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const template = raw as Record<string, unknown>;

    return {
      plusFriendId: typeof template.plusFriendId === 'string' ? template.plusFriendId : null,
      senderKey: typeof template.senderKey === 'string' ? template.senderKey : null,
      plusFriendType: typeof template.plusFriendType === 'string' ? template.plusFriendType : null,
      templateCode: typeof template.templateCode === 'string' ? template.templateCode : null,
      kakaoTemplateCode: typeof template.kakaoTemplateCode === 'string' ? template.kakaoTemplateCode : null,
      templateName: typeof template.templateName === 'string' ? template.templateName : null,
      templateMessageType: typeof template.templateMessageType === 'string' ? template.templateMessageType : null,
      templateEmphasizeType: typeof template.templateEmphasizeType === 'string' ? template.templateEmphasizeType : null,
      templateContent: typeof template.templateContent === 'string' ? template.templateContent : null,
      status: typeof template.status === 'string' ? template.status : null,
      statusName: typeof template.statusName === 'string' ? template.statusName : null,
      securityFlag: typeof template.securityFlag === 'boolean' ? template.securityFlag : null,
      categoryCode: typeof template.categoryCode === 'string' ? template.categoryCode : null,
      createDate: typeof template.createDate === 'string' ? template.createDate : null,
      updateDate: typeof template.updateDate === 'string' ? template.updateDate : null
    };
  }

  private normalizeSenderGroup(raw: unknown): NhnSenderGroup | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const senderGroup = raw as Record<string, unknown>;
    const senders = Array.isArray(senderGroup.senders)
      ? senderGroup.senders.map((sender) => {
          if (!sender || typeof sender !== 'object') {
            return null;
          }

          const member = sender as Record<string, unknown>;

          return {
            plusFriendId: typeof member.plusFriendId === 'string' ? member.plusFriendId : null,
            senderKey: typeof member.senderKey === 'string' ? member.senderKey : null,
            createDate: typeof member.createDate === 'string' ? member.createDate : null
          } satisfies NhnSenderGroupMember;
        }).filter(Boolean) as NhnSenderGroupMember[]
      : [];

    return {
      groupName: typeof senderGroup.groupName === 'string' ? senderGroup.groupName : null,
      senderKey: typeof senderGroup.senderKey === 'string' ? senderGroup.senderKey : null,
      status: typeof senderGroup.status === 'string' ? senderGroup.status : null,
      senders,
      createDate: typeof senderGroup.createDate === 'string' ? senderGroup.createDate : null,
      updateDate: typeof senderGroup.updateDate === 'string' ? senderGroup.updateDate : null
    };
  }

  private async getAccessToken(): Promise<string> {
    if (this.env.isNhnMockMode) {
      return 'mock-access-token';
    }

    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt > now + 5 * 60 * 1000) {
      return this.tokenCache.accessToken;
    }

    const basic = Buffer.from(`${this.env.nhnUserAccessKeyId}:${this.env.nhnSecretAccessKey}`).toString('base64');

    const response = await axios.post(
      `${this.env.nhnOAuthUrl}/oauth2/token/create`,
      new URLSearchParams({ grant_type: 'client_credentials' }),
      {
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const accessToken = response.data.access_token as string;
    const expiresIn = Number(response.data.expires_in || 86400);

    this.tokenCache = {
      accessToken,
      expiresAt: now + expiresIn * 1000
    };

    return accessToken;
  }

  async requestAlimtalkTemplateSync(payload: {
    existingTemplateCode?: string;
    templateCode?: string;
    senderKey?: string;
    senderProfileType?: 'GROUP' | 'NORMAL';
    body: string;
    name: string;
  }): Promise<{ nhnTemplateId: string; templateCode: string; kakaoTemplateCode: string | null; providerStatus: 'REQ' | 'APR' | 'REJ' }> {
    if (this.env.isNhnMockMode) {
      this.logger.log('NHN template sync in mock mode');
      const mockTemplateCode = payload.templateCode ?? `TPL_${Date.now()}`.slice(0, 20);
      return {
        nhnTemplateId: payload.existingTemplateCode ?? mockTemplateCode,
        templateCode: mockTemplateCode,
        kakaoTemplateCode: mockTemplateCode,
        providerStatus: 'REQ'
      };
    }

    const senderKey = payload.senderKey ?? this.env.nhnDefaultSenderGroupKey.trim();
    if (!senderKey) {
      throw new InternalServerErrorException('NHN_DEFAULT_SENDER_GROUP_KEY must be configured for AlimTalk template sync');
    }

    try {
      const existingTemplateCode = payload.existingTemplateCode?.trim() || undefined;
      const templateCode = payload.templateCode ?? `TPL_${Date.now().toString(36)}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 20);
      const normalizedBody = payload.body.replace(/\{\{\s*([^}]+?)\s*\}\}/g, '#{$1}');
      const response = await this.requestAlimtalkApi<NhnTemplateApiResponse>({
        url: existingTemplateCode
          ? `/alimtalk/v2.3/appkeys/${this.env.nhnAlimtalkAppKey}/senders/${senderKey}/templates/${existingTemplateCode}`
          : `/alimtalk/v2.3/appkeys/${this.env.nhnAlimtalkAppKey}/senders/${senderKey}/templates`,
        method: existingTemplateCode ? 'PUT' : 'POST',
        data: {
          senderKey,
          senderProfileType: payload.senderProfileType ?? 'GROUP',
          templateCode,
          templateName: payload.name,
          templateMessageType: 'BA',
          templateEmphasizeType: 'NONE',
          templateContent: normalizedBody,
          securityFlag: false,
          categoryCode: '999999'
        }
      });

      const resultCode = response.header?.resultCode ?? 0;
      if (resultCode !== 0) {
        throw new BadGatewayException(`NHN template sync failed: ${response.header?.resultMessage || 'Unknown Bizmessage template error'}`);
      }

      const detail = await this.requestAlimtalkApi<NhnTemplateApiResponse>({
        url: `/alimtalk/v2.3/appkeys/${this.env.nhnAlimtalkAppKey}/senders/${senderKey}/templates/${templateCode}`,
        method: 'GET'
      });
      const template = this.normalizeTemplate(detail.template);

      if (!template) {
        throw new InternalServerErrorException('NHN Bizmessage template sync succeeded but template details could not be loaded');
      }

      return {
        nhnTemplateId: template.templateCode || templateCode,
        templateCode: template.templateCode || templateCode,
        kakaoTemplateCode: template.kakaoTemplateCode,
        providerStatus: this.mapTemplateStatus(template.status)
      };
    } catch (error) {
      const axiosError = error instanceof AxiosError ? error : null;
      const data = axiosError?.response?.data as
        | { header?: { resultMessage?: string }; message?: string; title?: string }
        | undefined;
      const message =
        data?.header?.resultMessage ||
        data?.message ||
        data?.title ||
        axiosError?.message ||
        (error instanceof Error ? error.message : 'Unknown NHN template sync error');

      throw new BadGatewayException(`NHN template sync failed: ${message}`);
    }
  }

  async fetchRegisteredSendNumbers(): Promise<NhnRegisteredSendNo[]> {
    if (this.env.isPlaceholder(this.env.nhnSmsAppKey) || this.env.isPlaceholder(this.env.nhnSmsSecretKey)) {
      throw new InternalServerErrorException('NHN_SMS_APP_KEY and NHN_SMS_SECRET_KEY must be configured');
    }

    const response = await axios.get(`${this.env.nhnSmsBaseUrl}/sms/v3.0/appKeys/${this.env.nhnSmsAppKey}/sendNos`, {
      headers: {
        'X-Secret-Key': this.env.nhnSmsSecretKey
      }
    });

    const items = response.data?.header?.isSuccessful
      ? response.data?.body?.data ?? response.data?.sendNos ?? []
      : [];

    if (!response.data?.header?.isSuccessful) {
      throw new InternalServerErrorException(response.data?.header?.resultMessage ?? 'NHN sendNos request failed');
    }

    return items
      .map(
        (item: {
          serviceId?: number | null;
          sendNo?: string;
          useYn?: 'Y' | 'N';
          blockYn?: 'Y' | 'N';
          blockReason?: string | null;
          createDate?: string | null;
          createUser?: string | null;
          updateDate?: string | null;
          updateUser?: string | null;
        }) => {
          if (!item.sendNo) {
            return null;
          }

          return {
            serviceId: item.serviceId ?? null,
            sendNo: String(item.sendNo),
            useYn: item.useYn ?? 'N',
            blockYn: item.blockYn ?? 'N',
            blockReason: item.blockReason ?? null,
            createDate: item.createDate ?? null,
            createUser: item.createUser ?? null,
            updateDate: item.updateDate ?? null,
            updateUser: item.updateUser ?? null
          } satisfies NhnRegisteredSendNo;
        }
      )
      .filter(Boolean) as NhnRegisteredSendNo[];
  }

  async fetchApprovedSendNumbers(): Promise<string[]> {
    const items = await this.fetchRegisteredSendNumbers();
    return items
      .filter((item) => item.useYn === 'Y' && item.blockYn === 'N')
      .map((item) => item.sendNo);
  }

  async fetchSenderCategories(): Promise<NhnAlimtalkSenderCategory[]> {
    const response = await this.requestAlimtalkApi<{ categories?: unknown[] }>({
      url: `/alimtalk/v2.3/appkeys/${this.env.nhnAlimtalkAppKey}/sender/categories`,
      method: 'GET'
    });

    return this.normalizeCategories(response.categories);
  }

  async registerSenderProfile(payload: {
    plusFriendId: string;
    phoneNo: string;
    categoryCode: string;
  }): Promise<{ header: NhnApiHeader }> {
    const response = await this.requestAlimtalkApi<{ header?: NhnApiHeader }>({
      url: `/alimtalk/v2.3/appkeys/${this.env.nhnAlimtalkAppKey}/senders`,
      method: 'POST',
      data: payload
    });

    return {
      header: response.header ?? {}
    };
  }

  async verifySenderProfileToken(payload: {
    plusFriendId: string;
    token: number;
  }): Promise<{ header: NhnApiHeader; sender: NhnAlimtalkSender | null }> {
    const response = await this.requestAlimtalkApi<NhnSenderApiResponse>({
      url: `/alimtalk/v2.3/appkeys/${this.env.nhnAlimtalkAppKey}/sender/token`,
      method: 'POST',
      data: payload
    });

    return {
      header: response.header ?? {},
      sender: this.normalizeSender(response.sender)
    };
  }

  async fetchSenderProfile(senderKey: string): Promise<NhnAlimtalkSender | null> {
    const response = await this.requestAlimtalkApi<NhnSenderApiResponse>({
      url: `/alimtalk/v2.3/appkeys/${this.env.nhnAlimtalkAppKey}/senders/${senderKey}`,
      method: 'GET'
    });

    return this.normalizeSender(response.sender);
  }

  async fetchSenderProfiles(query: {
    plusFriendId?: string;
    senderKey?: string;
    status?: string;
    pageNum?: number;
    pageSize?: number;
  }): Promise<{ header: NhnApiHeader; senders: NhnAlimtalkSender[]; totalCount: number }> {
    const response = await this.requestAlimtalkApi<NhnSenderListApiResponse>({
      url: `/alimtalk/v2.3/appkeys/${this.env.nhnAlimtalkAppKey}/senders`,
      method: 'GET',
      params: query
    });

    return {
      header: response.header ?? {},
      senders: Array.isArray(response.senders)
        ? response.senders.map((item) => this.normalizeSender(item)).filter(Boolean) as NhnAlimtalkSender[]
        : [],
      totalCount: typeof response.totalCount === 'number' ? response.totalCount : 0
    };
  }

  async fetchSenderGroup(groupSenderKey: string): Promise<NhnSenderGroup | null> {
    const response = await this.requestAlimtalkApi<NhnSenderGroupApiResponse>({
      url: `/alimtalk/v2.3/appkeys/${this.env.nhnAlimtalkAppKey}/sender-groups/${groupSenderKey}`,
      method: 'GET'
    });

    return this.normalizeSenderGroup(response.senderGroup);
  }

  async fetchTemplatesForSenderOrGroup(senderKey: string, query?: { templateStatus?: string; pageNum?: number; pageSize?: number }) {
    const response = await this.requestAlimtalkApi<NhnTemplateListApiResponse>({
      url: `/alimtalk/v2.3/appkeys/${this.env.nhnAlimtalkAppKey}/senders/${senderKey}/templates`,
      method: 'GET',
      params: query
    });

    const templates = Array.isArray(response.templateListResponse?.templates)
      ? response.templateListResponse?.templates.map((item) => this.normalizeTemplate(item)).filter(Boolean) as NhnAlimtalkTemplate[]
      : [];

    return {
      header: response.header ?? {},
      templates,
      totalCount: typeof response.templateListResponse?.totalCount === 'number' ? response.templateListResponse?.totalCount : 0
    };
  }

  async ensureSenderInDefaultGroup(senderKey: string): Promise<{
    enabled: boolean;
    groupSenderKey: string | null;
    added: boolean;
    alreadyMember: boolean;
    error?: string;
  }> {
    const groupSenderKey = this.env.nhnDefaultSenderGroupKey.trim();

    if (!groupSenderKey) {
      return {
        enabled: false,
        groupSenderKey: null,
        added: false,
        alreadyMember: false
      };
    }

    try {
      const group = await this.requestAlimtalkApi<NhnSenderGroupApiResponse>({
        url: `/alimtalk/v2.3/appkeys/${this.env.nhnAlimtalkAppKey}/sender-groups/${groupSenderKey}`,
        method: 'GET'
      });

      const existingSenders = Array.isArray(group.senderGroup?.senders) ? group.senderGroup?.senders ?? [] : [];
      const alreadyMember = existingSenders.some((sender) => sender.senderKey === senderKey);

      if (alreadyMember) {
        return {
          enabled: true,
          groupSenderKey,
          added: false,
          alreadyMember: true
        };
      }

      await this.requestAlimtalkApi<{ header?: NhnApiHeader }>({
        url: `/alimtalk/v2.3/appkeys/${this.env.nhnAlimtalkAppKey}/sender-groups/${groupSenderKey}/senders/${senderKey}`,
        method: 'POST'
      });

      return {
        enabled: true,
        groupSenderKey,
        added: true,
        alreadyMember: false
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown sender-group sync error';
      this.logger.warn(`Failed to sync sender ${senderKey} to default group ${groupSenderKey}: ${message}`);

      return {
        enabled: true,
        groupSenderKey,
        added: false,
        alreadyMember: false,
        error: message
      };
    }
  }
}
