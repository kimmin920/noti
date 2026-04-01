import { BadGatewayException, BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import FormData from 'form-data';
import { formatNhnRequestDate } from '@publ/shared';
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

export interface NhnAlimtalkTemplateCategoryItem {
  code: string | null;
  name: string | null;
  groupName: string | null;
  inclusion: string | null;
  exclusion: string | null;
}

export interface NhnAlimtalkTemplateCategoryGroup {
  name: string | null;
  subCategories: NhnAlimtalkTemplateCategoryItem[];
}

export interface NhnApiHeader {
  resultCode?: number;
  resultMessage?: string;
  isSuccessful?: boolean;
}

export interface NhnBulkSmsRecipientPayload {
  recipientNo: string;
  recipientName?: string | null;
  recipientGroupingKey?: string | null;
  templateParameters?: Record<string, string>;
}

export interface NhnBulkAlimtalkRecipientPayload {
  recipientNo: string;
  recipientName?: string | null;
  recipientGroupingKey?: string | null;
  templateParameters: Record<string, string>;
}

export interface NhnBulkSmsSendResult {
  recipientNo: string;
  recipientSeq: string | null;
  resultCode: string | null;
  resultMessage: string | null;
  recipientGroupingKey: string | null;
}

export interface NhnBulkSmsSendResponse {
  requestId: string;
  sendResultList: NhnBulkSmsSendResult[];
  providerRequest: Record<string, unknown>;
  providerResponse: unknown;
}

export type NhnBulkAlimtalkSendResponse = NhnBulkSmsSendResponse;

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

function buildSafeUploadFileName(originalName: string | null | undefined, mimetype: string | null | undefined) {
  const fallbackExtension = mimetype === 'image/png' ? 'png' : 'jpg';
  const normalizedBase = (originalName || 'template-image')
    .replace(/\.[^.]+$/, '')
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

  const safeBase = normalizedBase || 'template-image';
  return `${safeBase}.${fallbackExtension}`;
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
  templateExtra: string | null;
  templateTitle: string | null;
  templateSubtitle: string | null;
  templateImageName: string | null;
  templateImageUrl: string | null;
  status: string | null;
  statusName: string | null;
  securityFlag: boolean | null;
  categoryCode: string | null;
  createDate: string | null;
  updateDate: string | null;
  buttons: NhnAlimtalkTemplateButton[];
  quickReplies: NhnAlimtalkTemplateQuickReply[];
  comments: string | null;
}

export interface NhnAlimtalkTemplateButton {
  ordering: number;
  type: string;
  name?: string;
  linkMo?: string;
  linkPc?: string;
  schemeIos?: string;
  schemeAndroid?: string;
  bizFormId?: number;
  pluginId?: string;
  telNumber?: string;
}

export interface NhnAlimtalkTemplateQuickReply {
  ordering: number;
  type: string;
  name?: string;
  linkMo?: string;
  linkPc?: string;
  schemeIos?: string;
  schemeAndroid?: string;
  bizFormId?: number;
  pluginId?: string;
}

export interface NhnAlimtalkTemplateImage {
  templateImageName: string | null;
  templateImageUrl: string | null;
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

function normalizeAlimtalkSendFailure(responseData: any): string | null {
  const headerResultCode = responseData?.header?.resultCode;
  if (typeof headerResultCode === 'number' && headerResultCode !== 0) {
    return String(responseData?.header?.resultMessage || `NHN header resultCode=${headerResultCode}`);
  }

  const sendResults = responseData?.message?.sendResults;
  if (Array.isArray(sendResults)) {
    const failed = sendResults.find((item) => Number(item?.resultCode) !== 0);
    if (failed) {
      return String(failed?.resultMessage || `NHN send resultCode=${failed?.resultCode}`);
    }
  }

  return null;
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

  private ensureSmsApiConfig() {
    if (this.env.isPlaceholder(this.env.nhnSmsAppKey) || this.env.isPlaceholder(this.env.nhnSmsSecretKey)) {
      throw new InternalServerErrorException('NHN_SMS_APP_KEY and NHN_SMS_SECRET_KEY must be configured');
    }
  }

  private ensureNotificationHubConfig() {
    if (
      this.env.isPlaceholder(this.env.nhnAppKey) ||
      this.env.isPlaceholder(this.env.nhnUserAccessKeyId) ||
      this.env.isPlaceholder(this.env.nhnSecretAccessKey)
    ) {
      throw new InternalServerErrorException(
        'NHN_NOTIFICATION_HUB_APP_KEY, NHN_USER_ACCESS_KEY_ID, and NHN_SECRET_ACCESS_KEY must be configured'
      );
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

      throw new BadGatewayException(message);
    }
  }

  private assertSuccessfulAlimtalkHeader(header: NhnApiHeader | undefined, fallbackMessage: string): void {
    if (!header) {
      return;
    }

    const resultCode = typeof header.resultCode === 'number' ? header.resultCode : 0;
    const isSuccessful = header.isSuccessful;

    if (isSuccessful === false || resultCode !== 0) {
      throw new BadRequestException(header.resultMessage || fallbackMessage);
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

  private normalizeTemplateCategories(raw: unknown): NhnAlimtalkTemplateCategoryGroup[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }

        const group = item as Record<string, unknown>;
        const subCategories = Array.isArray(group.subCategories)
          ? group.subCategories
              .map((subItem) => {
                if (!subItem || typeof subItem !== 'object') {
                  return null;
                }

                const subCategory = subItem as Record<string, unknown>;

                return {
                  code: typeof subCategory.code === 'string' ? subCategory.code : null,
                  name: typeof subCategory.name === 'string' ? subCategory.name : null,
                  groupName: typeof subCategory.groupName === 'string' ? subCategory.groupName : null,
                  inclusion: typeof subCategory.inclusion === 'string' ? subCategory.inclusion : null,
                  exclusion: typeof subCategory.exclusion === 'string' ? subCategory.exclusion : null
                } satisfies NhnAlimtalkTemplateCategoryItem;
              })
              .filter(Boolean) as NhnAlimtalkTemplateCategoryItem[]
          : [];

        return {
          name: typeof group.name === 'string' ? group.name : null,
          subCategories
        } satisfies NhnAlimtalkTemplateCategoryGroup;
      })
      .filter(Boolean) as NhnAlimtalkTemplateCategoryGroup[];
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
      templateExtra: typeof template.templateExtra === 'string' ? template.templateExtra : null,
      templateTitle: typeof template.templateTitle === 'string' ? template.templateTitle : null,
      templateSubtitle: typeof template.templateSubtitle === 'string' ? template.templateSubtitle : null,
      templateImageName: typeof template.templateImageName === 'string' ? template.templateImageName : null,
      templateImageUrl: typeof template.templateImageUrl === 'string' ? template.templateImageUrl : null,
      status: typeof template.status === 'string' ? template.status : null,
      statusName: typeof template.statusName === 'string' ? template.statusName : null,
      securityFlag: typeof template.securityFlag === 'boolean' ? template.securityFlag : null,
      categoryCode: typeof template.categoryCode === 'string' ? template.categoryCode : null,
      createDate: typeof template.createDate === 'string' ? template.createDate : null,
      updateDate: typeof template.updateDate === 'string' ? template.updateDate : null,
      buttons: this.normalizeTemplateButtons(template.buttons),
      quickReplies: this.normalizeTemplateQuickReplies(template.quickReplies),
      comments: typeof template.comments === 'string' ? template.comments : null
    };
  }

  private normalizeTemplateButtons(raw: unknown): NhnAlimtalkTemplateButton[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw
      .map((item, index) => {
        if (!item || typeof item !== 'object') {
          return null;
        }

        const button = item as Record<string, unknown>;

        return {
          ordering: typeof button.ordering === 'number' ? button.ordering : index + 1,
          type: typeof button.type === 'string' ? button.type : '',
          ...(typeof button.name === 'string' ? { name: button.name } : {}),
          ...(typeof button.linkMo === 'string' ? { linkMo: button.linkMo } : {}),
          ...(typeof button.linkPc === 'string' ? { linkPc: button.linkPc } : {}),
          ...(typeof button.schemeIos === 'string' ? { schemeIos: button.schemeIos } : {}),
          ...(typeof button.schemeAndroid === 'string' ? { schemeAndroid: button.schemeAndroid } : {}),
          ...(typeof button.bizFormId === 'number' ? { bizFormId: button.bizFormId } : {}),
          ...(typeof button.pluginId === 'string' ? { pluginId: button.pluginId } : {}),
          ...(typeof button.telNumber === 'string' ? { telNumber: button.telNumber } : {})
        } satisfies NhnAlimtalkTemplateButton;
      })
      .filter((item): item is NhnAlimtalkTemplateButton => Boolean(item?.type));
  }

  private normalizeTemplateQuickReplies(raw: unknown): NhnAlimtalkTemplateQuickReply[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw
      .map((item, index) => {
        if (!item || typeof item !== 'object') {
          return null;
        }

        const quickReply = item as Record<string, unknown>;

        return {
          ordering: typeof quickReply.ordering === 'number' ? quickReply.ordering : index + 1,
          type: typeof quickReply.type === 'string' ? quickReply.type : '',
          ...(typeof quickReply.name === 'string' ? { name: quickReply.name } : {}),
          ...(typeof quickReply.linkMo === 'string' ? { linkMo: quickReply.linkMo } : {}),
          ...(typeof quickReply.linkPc === 'string' ? { linkPc: quickReply.linkPc } : {}),
          ...(typeof quickReply.schemeIos === 'string' ? { schemeIos: quickReply.schemeIos } : {}),
          ...(typeof quickReply.schemeAndroid === 'string' ? { schemeAndroid: quickReply.schemeAndroid } : {}),
          ...(typeof quickReply.bizFormId === 'number' ? { bizFormId: quickReply.bizFormId } : {}),
          ...(typeof quickReply.pluginId === 'string' ? { pluginId: quickReply.pluginId } : {})
        } satisfies NhnAlimtalkTemplateQuickReply;
      })
      .filter((item): item is NhnAlimtalkTemplateQuickReply => Boolean(item?.type));
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
    this.ensureNotificationHubConfig();

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
    messageType?: 'BA' | 'AD' | 'EX' | 'MI';
    emphasizeType?: 'NONE' | 'TEXT' | 'IMAGE';
    extra?: string;
    title?: string;
    subtitle?: string;
    imageName?: string;
    imageUrl?: string;
    securityFlag?: boolean;
    categoryCode?: string;
    buttons?: NhnAlimtalkTemplateButton[];
    quickReplies?: NhnAlimtalkTemplateQuickReply[];
  }): Promise<{ nhnTemplateId: string; templateCode: string; kakaoTemplateCode: string | null; providerStatus: 'REQ' | 'APR' | 'REJ' }> {
    const senderKey = payload.senderKey ?? this.env.nhnDefaultSenderGroupKey.trim();
    if (!senderKey) {
      throw new InternalServerErrorException('NHN_DEFAULT_SENDER_GROUP_KEY must be configured for AlimTalk template sync');
    }

    try {
      const existingTemplateCode = payload.existingTemplateCode?.trim() || undefined;
      const templateCode = payload.templateCode ?? `TPL_${Date.now().toString(36)}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 20);
      const normalizedBody = payload.body.replace(/\{\{\s*([^}]+?)\s*\}\}/g, '#{$1}');
      const normalizedMessageType = payload.messageType ?? 'BA';
      const normalizedEmphasizeType = payload.emphasizeType ?? 'NONE';
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
          templateMessageType: normalizedMessageType,
          templateEmphasizeType: normalizedEmphasizeType,
          templateContent: normalizedBody,
          ...(payload.extra ? { templateExtra: payload.extra } : {}),
          ...(payload.title ? { templateTitle: payload.title } : {}),
          ...(payload.subtitle ? { templateSubtitle: payload.subtitle } : {}),
          ...(payload.imageName ? { templateImageName: payload.imageName } : {}),
          ...(payload.imageUrl ? { templateImageUrl: payload.imageUrl } : {}),
          securityFlag: payload.securityFlag ?? false,
          categoryCode: payload.categoryCode ?? '999999',
          ...(payload.buttons?.length ? { buttons: payload.buttons } : {}),
          ...(payload.quickReplies?.length ? { quickReplies: payload.quickReplies } : {})
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

  async sendBulkSms(payload: {
    sendNo: string;
    body: string;
    recipients: NhnBulkSmsRecipientPayload[];
    scheduledAt?: Date | null;
  }): Promise<NhnBulkSmsSendResponse> {
    const providerRequest = {
      body: payload.body,
      sendNo: payload.sendNo,
      ...(payload.scheduledAt ? { requestDate: formatNhnRequestDate(payload.scheduledAt) } : {}),
      recipientList: payload.recipients.map((recipient) => ({
        recipientNo: recipient.recipientNo,
        ...(recipient.recipientName ? { recipientName: recipient.recipientName } : {}),
        ...(recipient.recipientGroupingKey ? { recipientGroupingKey: recipient.recipientGroupingKey } : {}),
        ...(recipient.templateParameters && Object.keys(recipient.templateParameters).length > 0
          ? { templateParameter: recipient.templateParameters }
          : {})
      }))
    };

    this.ensureSmsApiConfig();

    try {
      const response = await axios.post(
        `${this.env.nhnSmsBaseUrl}/sms/v3.0/appKeys/${this.env.nhnSmsAppKey}/sender/sms`,
        providerRequest,
        {
          headers: {
            'X-Secret-Key': this.env.nhnSmsSecretKey
          }
        }
      );

      if (response.data?.header?.isSuccessful === false) {
        throw new InternalServerErrorException(response.data?.header?.resultMessage ?? 'NHN bulk SMS send failed');
      }

      const body = response.data?.body?.data ?? response.data?.body ?? response.data;
      const requestId = body?.requestId ?? response.data?.requestId;
      const rawResults = body?.sendResultList ?? response.data?.sendResultList ?? [];

      if (!requestId) {
        throw new InternalServerErrorException('NHN bulk SMS response did not include requestId');
      }

      return {
        requestId: String(requestId),
        sendResultList: Array.isArray(rawResults)
          ? rawResults.map((item: Record<string, unknown>) => ({
              recipientNo: String(item.recipientNo ?? ''),
              recipientSeq: item.recipientSeq ? String(item.recipientSeq) : null,
              resultCode: item.resultCode !== undefined && item.resultCode !== null ? String(item.resultCode) : null,
              resultMessage: item.resultMessage ? String(item.resultMessage) : null,
              recipientGroupingKey: item.recipientGroupingKey ? String(item.recipientGroupingKey) : null
            }))
          : [],
        providerRequest,
        providerResponse: response.data
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
        (error instanceof Error ? error.message : 'Unknown NHN bulk SMS error');

      throw new BadGatewayException(`NHN bulk SMS request failed: ${message}`);
    }
  }

  async sendBulkAlimtalk(payload: {
    senderKey: string;
    templateCode: string;
    recipients: NhnBulkAlimtalkRecipientPayload[];
    scheduledAt?: Date | null;
    smsFailover?: {
      senderNo: string;
      msgSms: string;
      smsKind: 'SMS' | 'LMS';
    } | null;
  }): Promise<NhnBulkAlimtalkSendResponse> {
    const providerRequest = {
      senderKey: payload.senderKey,
      templateCode: payload.templateCode,
      ...(payload.scheduledAt ? { requestDate: formatNhnRequestDate(payload.scheduledAt) } : {}),
      ...(payload.smsFailover
        ? {
            useSmsFailover: true,
            senderNo: payload.smsFailover.senderNo,
            msgSms: payload.smsFailover.msgSms,
            smsKind: payload.smsFailover.smsKind
          }
        : {}),
      recipientList: payload.recipients.map((recipient) => ({
        recipientNo: recipient.recipientNo,
        ...(recipient.recipientName ? { recipientName: recipient.recipientName } : {}),
        ...(recipient.recipientGroupingKey ? { recipientGroupingKey: recipient.recipientGroupingKey } : {}),
        templateParameter: recipient.templateParameters
      }))
    };

    this.ensureAlimtalkApiConfig();

    try {
      const response = await axios.post(
        `${this.env.nhnAlimtalkBaseUrl}/alimtalk/v2.3/appkeys/${this.env.nhnAlimtalkAppKey}/messages`,
        providerRequest,
        {
          headers: {
            'X-Secret-Key': this.env.nhnAlimtalkSecretKey,
            'Content-Type': 'application/json;charset=UTF-8'
          }
        }
      );

      const immediateFailure = normalizeAlimtalkSendFailure(response.data);
      if (immediateFailure) {
        throw new InternalServerErrorException(immediateFailure);
      }

      const body = response.data?.message ?? response.data?.body ?? response.data;
      const requestId = body?.requestId ?? response.data?.requestId;
      const rawResults = body?.sendResults ?? body?.sendResultList ?? response.data?.sendResults ?? [];

      if (!requestId) {
        throw new InternalServerErrorException('NHN bulk AlimTalk response did not include requestId');
      }

      return {
        requestId: String(requestId),
        sendResultList: Array.isArray(rawResults)
          ? rawResults.map((item: Record<string, unknown>) => ({
              recipientNo: String(item.recipientNo ?? ''),
              recipientSeq: item.recipientSeq ? String(item.recipientSeq) : null,
              resultCode: item.resultCode !== undefined && item.resultCode !== null ? String(item.resultCode) : null,
              resultMessage: item.resultMessage ? String(item.resultMessage) : null,
              recipientGroupingKey: item.recipientGroupingKey ? String(item.recipientGroupingKey) : null
            }))
          : [],
        providerRequest,
        providerResponse: response.data
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
        (error instanceof Error ? error.message : 'Unknown NHN bulk AlimTalk error');

      throw new BadGatewayException(`NHN bulk AlimTalk request failed: ${message}`);
    }
  }

  async fetchSenderCategories(): Promise<NhnAlimtalkSenderCategory[]> {
    const response = await this.requestAlimtalkApi<{ categories?: unknown[] }>({
      url: `/alimtalk/v2.3/appkeys/${this.env.nhnAlimtalkAppKey}/sender/categories`,
      method: 'GET'
    });

    return this.normalizeCategories(response.categories);
  }

  async fetchTemplateCategories(): Promise<NhnAlimtalkTemplateCategoryGroup[]> {
    const response = await this.requestAlimtalkApi<{ categories?: unknown[] }>({
      url: `/alimtalk/v2.3/appkeys/${this.env.nhnAlimtalkAppKey}/template/categories`,
      method: 'GET'
    });

    return this.normalizeTemplateCategories(response.categories);
  }

  async uploadTemplateImage(
    file: Pick<Express.Multer.File, 'buffer' | 'originalname' | 'mimetype'>,
    options?: { itemHighlight?: boolean }
  ): Promise<NhnAlimtalkTemplateImage> {
    this.ensureAlimtalkApiConfig();

    const formData = new FormData();
    const contentType = file.mimetype || 'application/octet-stream';
    const fileName = buildSafeUploadFileName(file.originalname, file.mimetype);

    formData.append('file', file.buffer, {
      filename: fileName,
      contentType
    });
    formData.append('image', file.buffer, {
      filename: fileName,
      contentType
    });

    const path = options?.itemHighlight ? 'template-image/item-highlight' : 'template-image';

    try {
      const headers = {
        ...formData.getHeaders(),
        'X-Secret-Key': this.env.nhnAlimtalkSecretKey,
        'Content-Length': String(formData.getLengthSync())
      };
      const response = await axios.post<{ header?: NhnApiHeader; templateImage?: Record<string, unknown> }>(
        `${this.env.nhnAlimtalkBaseUrl}/alimtalk/v2.3/appkeys/${this.env.nhnAlimtalkAppKey}/${path}`,
        formData,
        {
          headers
        }
      );

      this.assertSuccessfulAlimtalkHeader(response.data?.header, '알림톡 템플릿 이미지 업로드에 실패했습니다.');

      const templateImage = response.data?.templateImage;

      return {
        templateImageName: typeof templateImage?.templateImageName === 'string' ? templateImage.templateImageName : null,
        templateImageUrl: typeof templateImage?.templateImageUrl === 'string' ? templateImage.templateImageUrl : null
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
        (error instanceof Error ? error.message : 'Unknown NHN template image upload error');

      throw new BadGatewayException(`NHN template image upload failed: ${message}`);
    }
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

    this.assertSuccessfulAlimtalkHeader(response.header, '카카오 채널 OTP 요청에 실패했습니다.');

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

    this.assertSuccessfulAlimtalkHeader(response.header, '카카오 채널 OTP 인증에 실패했습니다.');

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

  async fetchTemplateDetailForSenderOrGroup(senderKey: string, templateCode: string) {
    const response = await this.requestAlimtalkApi<NhnTemplateApiResponse>({
      url: `/alimtalk/v2.3/appkeys/${this.env.nhnAlimtalkAppKey}/senders/${senderKey}/templates/${templateCode}`,
      method: 'GET'
    });

    return this.normalizeTemplate(response.template);
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
