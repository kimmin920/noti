import type { KakaoStatus, SmsStatus } from "@/lib/store/types";
import nhnKakaoBizmessageErrorCodes from "@/lib/resources/nhn-kakao-bizmessage-error-codes.json";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
type NhnKakaoBizmessageErrorMeta =
  | string
  | {
      description: string;
      guide?: string;
    };

const NHN_KAKAO_ERROR_CODE_MAP = nhnKakaoBizmessageErrorCodes as Record<string, NhnKakaoBizmessageErrorMeta>;

export type V2KakaoTemplateSource = "GROUP" | "SENDER_PROFILE";

function normalizeApiErrorMessage(message: string) {
  const cleanedMessage = message
    .replace(/^(?:NHN\s+)?template sync failed:\s*/i, "")
    .trim();
  const codeMatch = cleanedMessage.match(/^\[(-?\d+)\]\s*(.*)$/);

  if (!codeMatch) {
    return cleanedMessage;
  }

  const [, code] = codeMatch;
  const meta = NHN_KAKAO_ERROR_CODE_MAP[code];
  if (!meta) {
    return cleanedMessage;
  }

  if (typeof meta === "string") {
    return `[${code}] ${meta}`;
  }

  return [`[${code}] ${meta.description}`, meta.guide ? `해결 방법: ${meta.guide}` : null].filter(Boolean).join("\n");
}

async function readApiErrorMessage(response: Response) {
  let message = `${response.status} ${response.statusText}`;

  try {
    const data = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(data.message)) {
      message = data.message.join(", ");
    } else if (typeof data.message === "string") {
      message = data.message;
    }
  } catch {
    // ignore json parsing failure
  }

  return normalizeApiErrorMessage(message);
}

type V2Readiness = {
  resourceState: {
    sms: SmsStatus;
    kakao: KakaoStatus;
  };
  pendingSetupCount: number;
  allReady: boolean;
  nextRequiredAction: string | null;
  sms: {
    status: SmsStatus;
    totalCount: number;
    approvedCount: number;
    submittedCount: number;
    supplementRequestedCount: number;
    rejectedCount: number;
  };
  kakao: {
    status: KakaoStatus;
    totalCount: number;
    activeCount: number;
    blockedCount: number;
    dormantCount: number;
    unknownCount: number;
  };
};

export type V2BootstrapResponse = {
  currentUser: {
    userId: string;
    serviceName: string;
    email: string | null;
    loginId: string | null;
    role: string;
    serviceStatus: string;
    serviceCreatedAt: string;
  };
  readiness: V2Readiness;
  counts: {
    smsTemplateCount: number;
    smsPublishedTemplateCount: number;
    kakaoTemplateCount: number;
    kakaoApprovedTemplateCount: number;
    enabledEventRuleCount: number;
    noticeCount: number;
  };
};

export type V2DashboardResponse = {
  currentUser: V2BootstrapResponse["currentUser"];
  balance: {
    autoRechargeEnabled: boolean;
    lowBalanceAlertEnabled: boolean;
  };
  sendQuota: {
    todaySent: number;
    dailyMax: number;
    remaining: number;
  };
  quotaSnapshotAt: string;
  notices: Array<{
    id: string;
    title: string;
    body: string;
    isPinned: boolean;
    createdAt: string;
  }>;
  readiness: V2Readiness;
  stats: {
    senderNumberCount: number;
    senderProfileCount: number;
    publishedSmsTemplateCount: number;
    approvedKakaoTemplateCount: number;
    activeEventRuleCount: number;
    recentFailedRequestCount: number;
    smsSentCount: number;
    kakaoSentCount: number;
    smsMonthSentCount: number;
    smsMonthlyLimit: number;
    kakaoDaySentCount: number;
    brandDaySentCount: number;
  };
};

export type V2ResourcesSummaryResponse = V2Readiness;

export type V2SmsResourcesResponse = {
  status: SmsStatus;
  summary: V2Readiness["sms"];
  items: Array<{
    id: string;
    phoneNumber: string;
    type: string;
    status: string;
    reviewMemo: string | null;
    approvedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

export type V2SenderNumberApplicationDetailResponse = {
  id: string;
  phoneNumber: string;
  type: "COMPANY" | "EMPLOYEE";
  status: string;
  reviewMemo: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: {
    telecom: boolean;
    consent: boolean;
    personalInfoConsent: boolean;
    idCardCopy: boolean;
    businessRegistration: boolean;
    relationshipProof: boolean;
    additional: boolean;
    employment: boolean;
  };
};

export type V2KakaoResourcesResponse = {
  status: KakaoStatus;
  summary: V2Readiness["kakao"] & {
    approvedTemplateCount: number;
  };
  items: Array<{
    id: string;
    plusFriendId: string;
    senderKey: string;
    senderProfileType: string | null;
    status: string;
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
};

export type V2KakaoConnectCategoryNode = {
  code: string;
  label: string;
  depth: number | null;
  children: V2KakaoConnectCategoryNode[];
};

export type V2KakaoConnectBootstrapResponse = {
  readiness: {
    status: KakaoStatus;
    totalCount: number;
    activeCount: number;
    blockedCount: number;
    dormantCount: number;
    unknownCount: number;
  };
  categories: V2KakaoConnectCategoryNode[];
  existingChannels: Array<{
    id: string;
    plusFriendId: string;
    senderKey: string;
    senderProfileType: string | null;
    status: string;
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
};

export type V2KakaoConnectRequestPayload = {
  plusFriendId: string;
  phoneNo: string;
  categoryCode: string;
};

export type V2KakaoConnectRequestResponse = {
  requestAccepted: boolean;
  plusFriendId: string;
  phoneNo: string;
  categoryCode: string;
  message: string;
};

export type V2KakaoConnectVerifyPayload = {
  plusFriendId: string;
  token: number;
};

export type V2KakaoConnectVerifyResponse = {
  verified: boolean;
  message: string;
  sender: {
    id: string;
    plusFriendId: string;
    senderKey: string;
    senderProfileType: string | null;
    status: string;
    isDefault: boolean;
    createdAt: string | null;
    updatedAt: string | null;
  } | null;
};

export type V2CreateSenderNumberApplicationResponse = {
  id: string;
  userId: string;
  phoneNumber: string;
  type: "COMPANY" | "EMPLOYEE";
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type V2TemplatesSummaryResponse = {
  readiness: V2Readiness;
  sms: {
    totalCount: number;
    draftCount: number;
    publishedCount: number;
    archivedCount: number;
  };
  kakao: {
    totalCount: number;
    approvedCount: number;
    pendingCount: number;
    rejectedCount: number;
  };
  brand: {
    totalCount: number;
    approvedCount: number;
    pendingCount: number;
    rejectedCount: number;
  };
};

export type V2SmsTemplatesResponse = {
  summary: V2TemplatesSummaryResponse["sms"];
  items: Array<{
    id: string;
    name: string;
    body: string;
    status: string;
    requiredVariables: unknown;
    updatedAt: string;
    latestVersion: {
      version: number;
      createdAt: string;
    } | null;
    versionCount: number;
  }>;
};

export type V2SmsTemplateDetailResponse = {
  template: {
    id: string;
    name: string;
    body: string;
    syntax: string;
    status: string;
    requiredVariables: unknown;
    createdAt: string;
    updatedAt: string;
    latestVersion: {
      version: number;
      createdAt: string;
    } | null;
    versionCount: number;
    versions: Array<{
      id: string;
      version: number;
      bodySnapshot: string;
      requiredVariablesSnapshot: unknown;
      createdBy: string | null;
      createdAt: string;
    }>;
  };
};

export type V2KakaoTemplatesResponse = {
  summary: V2TemplatesSummaryResponse["kakao"];
  registrationTargets: V2KakaoTemplateRegistrationTarget[];
  categories: V2KakaoTemplateCategoryGroup[];
  items: Array<{
    id: string;
    source: V2KakaoTemplateSource;
    ownerKey: string | null;
    ownerLabel: string;
    name: string;
    body: string;
    requiredVariables: unknown;
    updatedAt: string | null;
    createdAt: string | null;
    providerStatus: string;
    providerStatusRaw: string | null;
    providerStatusName: string | null;
    templateCode: string | null;
    kakaoTemplateCode: string | null;
    messageType: string | null;
  }>;
  drafts: V2KakaoTemplateDraftItem[];
};

export type V2KakaoTemplateDraftAction = {
  ordering?: number;
  type?: string;
  name?: string;
  linkMo?: string;
  linkPc?: string;
  schemeIos?: string;
  schemeAndroid?: string;
  bizFormId?: number | null;
  pluginId?: string;
  telNumber?: string;
};

export type V2KakaoTemplateDraftItem = {
  id: string;
  name: string;
  body: string;
  requiredVariables: string[];
  createdAt: string;
  updatedAt: string;
  sourceEventKey: string | null;
  targetType: V2KakaoTemplateSource | null;
  targetId: string | null;
  senderProfileId: string | null;
  templateCode: string | null;
  messageType: string | null;
  emphasizeType: string | null;
  extra: string;
  title: string;
  subtitle: string;
  imageName: string;
  imageUrl: string;
  categoryCode: string | null;
  securityFlag: boolean;
  buttons: V2KakaoTemplateDraftAction[];
  quickReplies: V2KakaoTemplateDraftAction[];
  comment: string;
  savedAt: string | null;
};

export type V2KakaoTemplateDraftsResponse = {
  items: V2KakaoTemplateDraftItem[];
};

export type V2KakaoTemplateDetailResponse = {
  template: {
    id: string;
    source: V2KakaoTemplateSource;
    ownerKey: string | null;
    ownerLabel: string;
    plusFriendId: string | null;
    senderKey: string | null;
    plusFriendType: string | null;
    providerStatus: string;
    providerStatusRaw: string | null;
    providerStatusName: string | null;
    templateCode: string | null;
    kakaoTemplateCode: string | null;
    name: string;
    body: string;
    requiredVariables: string[];
    messageType: string | null;
    emphasizeType: string | null;
    extra: string | null;
    title: string | null;
    subtitle: string | null;
    imageName: string | null;
    imageUrl: string | null;
    securityFlag: boolean | null;
    categoryCode: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    buttons: Array<{
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
    }>;
    quickReplies: Array<{
      ordering: number;
      type: string;
      name?: string;
      linkMo?: string;
      linkPc?: string;
      schemeIos?: string;
      schemeAndroid?: string;
      bizFormId?: number;
      pluginId?: string;
    }>;
    comment: string | null;
    comments: string[];
    rejectedReason: string | null;
  };
};

export type V2KakaoTemplateRegistrationTarget = {
  id: string;
  type: V2KakaoTemplateSource;
  label: string;
  senderKey: string;
  senderProfileType: "GROUP" | "NORMAL";
  senderProfileId: string | null;
  plusFriendId: string | null;
};

export type V2KakaoTemplateCategoryGroup = {
  name: string | null;
  subCategories: Array<{
    code: string | null;
    name: string | null;
    groupName: string | null;
    inclusion: string | null;
    exclusion: string | null;
  }>;
};

export type V2BrandTemplateButton = {
  name: string;
  type: string;
  linkMo?: string;
  linkPc?: string;
  schemeAndroid?: string;
  schemeIos?: string;
  chatExtra?: string;
  chatEvent?: string;
  bizFormKey?: string;
};

export type V2BrandTemplateCoupon = {
  title: string;
  description?: string;
  linkMo?: string;
  linkPc?: string;
  schemeAndroid?: string;
  schemeIos?: string;
};

export type V2BrandTemplateImage = {
  imageUrl: string;
  imageLink?: string;
};

export type V2BrandTemplateWideItem = {
  title?: string;
  imageUrl: string;
  linkMo?: string;
  linkPc?: string;
  schemeAndroid?: string;
  schemeIos?: string;
};

export type V2BrandTemplateVideo = {
  videoUrl: string;
  thumbnailUrl?: string;
};

export type V2BrandTemplateCommerce = {
  title: string;
  regularPrice?: number;
  discountPrice?: number;
  discountRate?: number;
  discountFixed?: number;
};

export type V2BrandTemplateCarouselHead = {
  header?: string;
  content?: string;
  imageUrl: string;
  linkMo?: string;
  linkPc?: string;
  schemeAndroid?: string;
  schemeIos?: string;
};

export type V2BrandTemplateCarouselTail = {
  linkMo?: string;
  linkPc?: string;
  schemeAndroid?: string;
  schemeIos?: string;
};

export type V2BrandTemplateCarouselItem = {
  header?: string;
  message?: string;
  additionalContent?: string;
  imageUrl: string;
  imageLink?: string;
  buttons?: V2BrandTemplateButton[];
  coupon?: V2BrandTemplateCoupon | null;
  commerce?: V2BrandTemplateCommerce | null;
};

export type V2BrandTemplatesResponse = {
  summary: V2TemplatesSummaryResponse["brand"];
  registrationTargets: Array<{
    id: string;
    label: string;
    senderKey: string;
    plusFriendId: string | null;
    senderProfileType: string | null;
    status: string;
  }>;
  items: Array<{
    id: string;
    senderProfileId: string;
    senderKey: string;
    plusFriendId: string | null;
    senderProfileType: string | null;
    senderProfileStatus: string | null;
    ownerLabel: string;
    providerStatus: string;
    providerStatusRaw: string | null;
    providerStatusName: string | null;
    templateCode: string | null;
    templateName: string;
    requiredVariables: string[];
    chatBubbleType: string | null;
    adult: boolean | null;
    content: string | null;
    header: string | null;
    additionalContent: string | null;
    image: V2BrandTemplateImage | null;
    buttons: V2BrandTemplateButton[];
    item: {
      list: V2BrandTemplateWideItem[];
    } | null;
    coupon: V2BrandTemplateCoupon | null;
    commerce: V2BrandTemplateCommerce | null;
    video: V2BrandTemplateVideo | null;
    carousel: {
      head: V2BrandTemplateCarouselHead | null;
      list: V2BrandTemplateCarouselItem[];
      tail: V2BrandTemplateCarouselTail | null;
    } | null;
    createdAt: string | null;
    updatedAt: string | null;
  }>;
};

export type V2BrandTemplateDetailResponse = {
  template: V2BrandTemplatesResponse["items"][number];
};

export type V2EventsResponse = {
  readiness: V2Readiness;
  counts: {
    totalCount: number;
    enabledCount: number;
  };
  items: Array<{
    id: string;
    eventKey: string;
    displayName: string;
    enabled: boolean;
    channelStrategy: string;
    alimtalkTemplateBindingMode: "DEFAULT" | "CUSTOM";
    messagePurpose: string;
    requiredVariables: unknown;
    updatedBy: string | null;
    updatedAt: string;
    sms: {
      templateId: string;
      templateName: string;
      senderNumberId: string;
      senderNumber: string;
    } | null;
    kakao: {
      templateBindingMode: "DEFAULT" | "CUSTOM";
      providerTemplateId: string | null;
      templateId: string | null;
      templateName: string;
      templateCode: string | null;
      kakaoTemplateCode: string | null;
      providerStatus: string;
      senderProfileId: string;
      plusFriendId: string;
      senderKey: string;
    } | null;
  }>;
  options: {
    channelStrategies: string[];
    messagePurposes: string[];
    smsTemplates: Array<{
      id: string;
      name: string;
      updatedAt: string;
    }>;
    smsSenderNumbers: Array<{
      id: string;
      phoneNumber: string;
      approvedAt: string | null;
      updatedAt: string;
    }>;
    kakaoTemplates: Array<{
      id: string;
      templateId: string;
      name: string;
      templateCode: string | null;
      kakaoTemplateCode: string | null;
      providerStatus: string;
      requiredVariables: string[];
      updatedAt: string;
    }>;
    kakaoSenderProfiles: Array<{
      id: string;
      plusFriendId: string;
      senderKey: string;
      status: string;
      isDefault: boolean;
      updatedAt: string;
    }>;
  };
};

export type V2PublEventProp = {
  id: string;
  rawPath: string;
  alias: string;
  label: string;
  labelVariable: string;
  type: "text" | "number" | "datetime" | "boolean" | "enum" | "object" | "array" | string;
  required: boolean;
  sample: string | null;
  description: string | null;
  fallback: string | null;
  parserPipeline: unknown;
  enabled: boolean;
  sortOrder: number;
};

export type V2PublEventItem = {
  id: string;
  catalogKey: string | null;
  eventKey: string;
  displayName: string;
  category: string;
  pAppCode: string | null;
  pAppName: string | null;
  triggerText: string | null;
  detailText: string | null;
  defaultTemplateSource: V2KakaoTemplateSource | string | null;
  defaultTemplateOwnerKey: string | null;
  defaultTemplateOwnerLabel: string | null;
  defaultTemplateName: string | null;
  defaultTemplateCode: string | null;
  defaultKakaoTemplateCode: string | null;
  defaultTemplateStatus: string | null;
  defaultTemplateBody: string | null;
  serviceStatus: "ACTIVE" | "INACTIVE" | "DRAFT" | string;
  locationType: string | null;
  locationId: string | null;
  sourceType: string | null;
  actionType: string | null;
  docsVersion: string | null;
  editable: boolean;
  createdAt: string;
  updatedAt: string;
  props: V2PublEventProp[];
};

export type V2PublEventsResponse = {
  counts: {
    totalCount: number;
    activeCount: number;
    inactiveCount: number;
    draftCount: number;
  };
  categories: string[];
  parserOptions: string[];
  items: V2PublEventItem[];
};

export type V2UpsertPublEventPayload = {
  eventKey: string;
  displayName: string;
  category: string;
  pAppCode?: string;
  pAppName?: string;
  triggerText?: string;
  detailText?: string;
  defaultTemplateSource?: string;
  defaultTemplateOwnerKey?: string;
  defaultTemplateOwnerLabel?: string;
  defaultTemplateName?: string;
  defaultTemplateCode?: string;
  defaultKakaoTemplateCode?: string;
  defaultTemplateStatus?: string;
  defaultTemplateBody?: string;
  serviceStatus: "ACTIVE" | "INACTIVE" | "DRAFT";
  locationType?: string;
  locationId?: string;
  sourceType?: string;
  actionType?: string;
  docsVersion?: string;
  props: Array<{
    id?: string;
    rawPath: string;
    alias: string;
    label: string;
    type: "text" | "number" | "datetime" | "boolean" | "enum" | "object" | "array";
    required: boolean;
    sample?: string;
    description?: string;
    fallback?: string;
    parserPipeline?: unknown;
    enabled: boolean;
    sortOrder?: number;
  }>;
};

export type V2PublEventMutationResponse = {
  item: V2PublEventItem;
};

export type V2LogsResponse = {
  filters: {
    status: string | null;
    statusGroup: "waiting" | "in_progress" | "delivered" | "failed" | null;
    eventKey: string | null;
    channel: "sms" | "kakao" | "alimtalk" | "brand" | null;
    limit: number;
  };
  summary: {
    totalCount: number;
    statusCounts: Record<string, number>;
  };
  items: Array<{
    id: string;
    kind: "message" | "campaign";
    mode: "MANUAL" | "AUTO" | "BULK";
    eventKey: string;
    channel: "sms" | "kakao" | null;
    campaignChannel: "sms" | "kakao" | "brand" | null;
    providerChannel: "SMS" | "ALIMTALK" | "BRAND_MESSAGE" | null;
    title: string | null;
    messageType: string | null;
    status: string;
    recipientPhone: string | null;
    recipientCount: number | null;
    scheduledAt: string | null;
    lastErrorCode: string | null;
    lastErrorMessage: string | null;
    createdAt: string;
    updatedAt: string;
    latestDeliveryResult: {
      providerStatus: string;
      providerCode: string | null;
      providerMessage: string | null;
      createdAt: string;
    } | null;
    retry: V2LogRetrySummary;
  }>;
};

export type V2LogRetrySummary = {
  retryOfRequestId: string | null;
  latestRequestId: string | null;
  latestStatus: string | null;
  latestCreatedAt: string | null;
  retryCount: number;
};

export type V2LogDetailResponse = {
  id: string;
  eventKey: string;
  channel: "sms" | "kakao" | null;
  providerChannel: "SMS" | "ALIMTALK" | "BRAND_MESSAGE" | null;
  messageType: string | null;
  status: string;
  recipientPhone: string;
  recipientUserId: string | null;
  variablesJson: Record<string, unknown> | null;
  metadataJson: Record<string, unknown> | null;
  brandMessage: {
    mode?: string | null;
    targeting?: string | null;
    messageType?: string | null;
    pushAlarm?: boolean | null;
    adult?: boolean | null;
    statsId?: string | null;
    statsEventKey?: string | null;
    resellerCode?: string | null;
    buttons?: Array<{
      type?: string | null;
      name?: string | null;
      linkMo?: string | null;
      linkPc?: string | null;
      schemeIos?: string | null;
      schemeAndroid?: string | null;
    }>;
    image?: {
      assetId?: string | null;
      imageUrl?: string | null;
      imageLink?: string | null;
    } | null;
  } | null;
  manualBody: string | null;
  scheduledAt: string | null;
  resolvedSenderNumberId: string | null;
  resolvedSenderProfileId: string | null;
  resolvedTemplateId: string | null;
  resolvedProviderTemplateId: string | null;
  resolvedSenderNumber: {
    id: string;
    phoneNumber: string;
  } | null;
  resolvedSenderProfile: {
    id: string;
    plusFriendId: string;
    senderKey: string;
  } | null;
  resolvedTemplate: {
    id: string;
    name: string;
  } | null;
  resolvedProviderTemplate: {
    id: string;
    templateCode: string | null;
    kakaoTemplateCode: string | null;
  } | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  retry: V2LogRetrySummary;
  attempts: Array<{
    id: string;
    attemptNumber: number;
    errorCode: string | null;
    errorMessage: string | null;
    createdAt: string;
  }>;
  deliveryResults: Array<{
    id: string;
    providerStatus: string;
    providerCode: string | null;
    providerMessage: string | null;
    createdAt: string;
  }>;
};

export type V2OpsHealthResponse = {
  status: "ok" | "degraded" | "error";
  checkedAt: string;
  components: {
    database: {
      status: "ok" | "error";
      latencyMs: number;
      message?: string;
    };
    redis: {
      status: "ok" | "error";
      latencyMs: number;
      message?: string;
    };
    queue: {
      status: "ok" | "error";
      latencyMs: number;
      queueName: string;
      counts?: Record<string, number>;
      message?: string;
    };
    config: {
      status: "ok" | "error";
      notificationHubConfigured: boolean;
      smsConfigured: boolean;
      alimtalkConfigured: boolean;
      webhookSecretConfigured: boolean;
      defaultSenderGroupConfigured: boolean;
      redisUrlConfigured: boolean;
      queueNameConfigured: boolean;
    };
  };
  notes: string[];
};

export type V2OpsSenderNumberAttachmentKind =
  | "telecom"
  | "consent"
  | "personalInfoConsent"
  | "idCardCopy"
  | "businessRegistration"
  | "relationshipProof"
  | "additional"
  | "employment";

export type V2OpsSenderNumberApplicationsResponse = {
  summary: {
    totalCount: number;
    submittedCount: number;
    supplementRequestedCount: number;
    approvedCount: number;
    rejectedCount: number;
    providerApprovedCount: number;
    providerBlockedCount: number;
  };
  items: Array<{
    id: string;
    userId: string;
    userLabel: string;
    phoneNumber: string;
    type: string;
    status: string;
    reviewMemo: string | null;
    approvedAt: string | null;
    reviewedBy: string | null;
    createdAt: string;
    updatedAt: string;
    attachments: Record<V2OpsSenderNumberAttachmentKind, boolean>;
    providerStatus: {
      registered: boolean;
      approved: boolean;
      blocked: boolean;
      blockReason: string | null;
      createdAt: string | null;
      updatedAt: string | null;
    };
  }>;
};

export type V2OpsKakaoTemplateApplicationsResponse = {
  summary: {
    totalCount: number;
    approvedCount: number;
    pendingCount: number;
    rejectedCount: number;
    defaultGroupCount: number;
    connectedChannelCount: number;
  };
  items: Array<{
    id: string;
    source: V2KakaoTemplateSource;
    userId: string | null;
    userLabel: string;
    ownerLabel: string;
    ownerKey: string | null;
    plusFriendId: string | null;
    senderKey: string | null;
    providerStatus: "APR" | "REQ" | "REJ";
    providerStatusRaw: string | null;
    providerStatusName: string | null;
    templateCode: string | null;
    kakaoTemplateCode: string | null;
    messageType: string | null;
    name: string;
    body: string;
    createdAt: string | null;
    updatedAt: string | null;
  }>;
};

export type V2OpsKakaoTemplateDetailResponse = {
  template: {
    source: V2KakaoTemplateSource;
    userId: string | null;
    userLabel: string;
    ownerLabel: string;
    plusFriendId: string | null;
    senderKey: string | null;
    plusFriendType: string | null;
    providerStatus: "APR" | "REQ" | "REJ";
    providerStatusRaw: string | null;
    providerStatusName: string | null;
    templateCode: string | null;
    kakaoTemplateCode: string | null;
    name: string;
    body: string;
    requiredVariables: string[];
    messageType: string | null;
    emphasizeType: string | null;
    extra: string | null;
    title: string | null;
    subtitle: string | null;
    imageName: string | null;
    imageUrl: string | null;
    securityFlag: boolean | null;
    categoryCode: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    buttons: Array<{
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
    }>;
    quickReplies: Array<{
      ordering: number;
      type: string;
      name?: string;
      linkMo?: string;
      linkPc?: string;
      schemeIos?: string;
      schemeAndroid?: string;
      bizFormId?: number;
      pluginId?: string;
    }>;
    comment: string | null;
    comments: string[];
    rejectedReason: string | null;
  };
};

export type V2OpsAdminUsersResponse = {
  summary: {
    totalCount: number;
    userCount: number;
    partnerAdminCount: number;
    superAdminCount: number;
    publOriginCount: number;
    directOriginCount: number;
  };
  items: Array<{
    id: string;
    providerUserId: string;
    loginId: string | null;
    email: string | null;
    loginProvider: "GOOGLE_OAUTH" | "PUBL_SSO" | "LOCAL_PASSWORD";
    role: "USER" | "PARTNER_ADMIN" | "SUPER_ADMIN";
    accessOrigin: "DIRECT" | "PUBL";
    createdAt: string;
    updatedAt: string;
  }>;
};

export type V2OpsManagedUsersResponse = {
  summary: {
    totalCount: number;
    activeCount: number;
    inactiveCount: number;
    dormantCount: number;
    blockedCount: number;
    userCount: number;
    sourceCount: number;
  };
  items: Array<{
    id: string;
    userId: string;
    userLabel: string;
    userStatus: string;
    source: string;
    externalId: string | null;
    name: string;
    email: string | null;
    phone: string | null;
    status: "ACTIVE" | "INACTIVE" | "DORMANT" | "BLOCKED";
    userType: string | null;
    segment: string | null;
    gradeOrLevel: string | null;
    marketingConsent: boolean | null;
    registeredAt: string | null;
    lastLoginAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

export type V2OpsNotice = {
  id: string;
  title: string;
  body: string;
  isPinned: boolean;
  createdBy: string | null;
  createdByEmail: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type V2OpsNoticesResponse = {
  summary: {
    totalCount: number;
    pinnedCount: number;
  };
  items: V2OpsNotice[];
};

export type V2OpsCreateNoticePayload = {
  title: string;
  body: string;
  isPinned?: boolean;
};

export type V2OpsUpdateNoticePayload = {
  title?: string;
  body?: string;
  isPinned?: boolean;
};

export type V2OpsSmsQuotasResponse = {
  summary: {
    userCount: number;
    defaultLimit: number;
    totalMonthlyLimit: number;
    totalMonthlyUsed: number;
  };
  items: Array<{
    userId: string;
    userLabel: string;
    loginId: string | null;
    email: string | null;
    providerUserId: string | null;
    role: "USER" | "PARTNER_ADMIN" | null;
    accessOrigin: "DIRECT" | "PUBL";
    approvedSenderNumberCount: number;
    monthlySmsLimit: number;
    monthlySmsUsed: number;
    monthlySmsRemaining: number;
  }>;
};

export type V2RecipientsResponse = {
  fields: Array<{
    key: string;
    label: string;
    kind: "system" | "custom";
    dataType: "TEXT" | "NUMBER" | "BOOLEAN" | "DATE" | "DATETIME" | "JSON";
    importable: boolean;
    visibleByDefault: boolean;
  }>;
  summary: {
    totalCount: number;
    activeCount: number;
    inactiveCount: number;
    dormantCount: number;
    blockedCount: number;
    sourceCount: number;
    customFieldCount: number;
    phoneCount: number;
    marketingConsentCount: number;
  };
  sourceBreakdown: Array<{
    source: string;
    count: number;
  }>;
  items: Array<{
    id: string;
    source: string;
    externalId: string | null;
    name: string;
    email: string | null;
    phone: string | null;
    status: "ACTIVE" | "INACTIVE" | "DORMANT" | "BLOCKED";
    userType: string | null;
    segment: string | null;
    gradeOrLevel: string | null;
    marketingConsent: boolean | null;
    tags: string[];
    registeredAt: string | null;
    lastLoginAt: string | null;
    createdAt: string;
    updatedAt: string;
    customAttributes: Record<string, unknown>;
  }>;
};

export type V2CreateRecipientPayload = {
  source?: string;
  externalId?: string;
  name: string;
  email?: string;
  phone?: string;
  status?: "ACTIVE" | "INACTIVE" | "DORMANT" | "BLOCKED";
  userType?: string;
  segment?: string;
  gradeOrLevel?: string;
  marketingConsent?: boolean;
  tags?: string[];
  registeredAt?: string;
  lastLoginAt?: string;
  customAttributes?: Record<string, unknown>;
};

export type V2CreateRecipientResponse = {
  mode: "created" | "updated";
  user: V2RecipientsResponse["items"][number];
};

export type V2PartnerOverviewResponse = {
  summary: {
    clientCount: number;
    userAccountCount: number;
    smsReadyClientCount: number;
    kakaoReadyClientCount: number;
    managedUserCount: number;
  };
  clients: Array<{
    id: string;
    name: string;
    status: string;
    accessOrigin: "DIRECT" | "PUBL";
    userAccountCount: number;
    approvedSenderNumberCount: number;
    activeSenderProfileCount: number;
    managedUserCount: number;
    primaryAdmin: {
      id: string;
      loginId: string | null;
      email: string | null;
    } | null;
    createdAt: string;
    updatedAt: string;
  }>;
  userAccounts: Array<{
    id: string;
    clientId: string;
    clientName: string;
    loginId: string | null;
    email: string | null;
    accessOrigin: "DIRECT" | "PUBL";
    approvedSenderNumberCount: number;
    activeSenderProfileCount: number;
    managedUserCount: number;
    createdAt: string;
    updatedAt: string;
  }>;
};

export type V2PartnerClientDetailResponse = {
  client: {
    id: string;
    name: string;
    status: string;
    accessOrigin: "DIRECT" | "PUBL";
    createdAt: string;
    updatedAt: string;
  };
  summary: {
    userAccountCount: number;
    approvedSenderNumberCount: number;
    activeSenderProfileCount: number;
    managedUserCount: number;
    smsTemplateCount: number;
    enabledEventRuleCount: number;
    approvedKakaoTemplateCount: number;
    recentManualRequestCount: number;
    recentBulkCampaignCount: number;
  };
  userAccounts: Array<{
    id: string;
    loginId: string | null;
    email: string | null;
    accessOrigin: "DIRECT" | "PUBL";
    createdAt: string;
    updatedAt: string;
  }>;
  senderNumbers: Array<{
    id: string;
    phoneNumber: string;
    type: string;
    status: string;
    reviewMemo: string | null;
    approvedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  senderProfiles: Array<{
    id: string;
    plusFriendId: string;
    senderKey: string;
    senderProfileType: string | null;
    isDefault: boolean;
    status: string;
    createdAt: string;
    updatedAt: string;
  }>;
};

export type V2OpsSendActivityRangeKey = "1d" | "7d" | "30d" | "all" | "custom";

export type V2OpsSendActivityResponse = {
  range: {
    key: V2OpsSendActivityRangeKey;
    label: string;
    since: string | null;
    startDate: string | null;
    endDate: string | null;
  };
  summary: {
    userCount: number;
    activeUserCount: number;
    smsMessageCount: number;
    kakaoMessageCount: number;
    senderNumberCount: number;
    channelCount: number;
  };
  items: Array<{
    adminUserId: string;
    userId: string;
    userLabel: string;
    loginId: string | null;
    email: string | null;
    role: "USER" | "PARTNER_ADMIN" | "SUPER_ADMIN" | null;
    smsMessageCount: number;
    smsSenderNumberCount: number;
    kakaoMessageCount: number;
    kakaoChannelCount: number;
    lastSentAt: string | null;
  }>;
};

export type V2OpsSendActivityDetailResponse = {
  range: V2OpsSendActivityResponse["range"];
  user: {
    adminUserId: string;
    userId: string;
    userLabel: string;
    loginId: string | null;
    email: string | null;
    role: "USER" | "PARTNER_ADMIN" | "SUPER_ADMIN" | null;
  };
  summary: {
    smsMessageCount: number;
    smsSenderNumberCount: number;
    kakaoMessageCount: number;
    kakaoChannelCount: number;
    lastSentAt: string | null;
  };
  smsSenderNumbers: Array<{
    senderNumberId: string | null;
    label: string;
    count: number;
    manualCount: number;
    bulkCount: number;
    lastSentAt: string | null;
  }>;
  kakaoChannels: Array<{
    senderProfileId: string | null;
    label: string;
    senderKey: string | null;
    count: number;
    manualCount: number;
    bulkCount: number;
    lastSentAt: string | null;
  }>;
  recentActivities: Array<{
    id: string;
    channel: "sms" | "kakao";
    mode: "MANUAL" | "BULK";
    resourceLabel: string;
    count: number;
    createdAt: string;
  }>;
};

export type V2CampaignsResponse = {
  readiness: V2Readiness;
  filter: {
    channel: "all" | "sms" | "kakao" | "brand";
    limit: number;
  };
  counts: {
    totalCount: number;
    smsCount: number;
    kakaoCount: number;
    brandCount: number;
  };
  items: Array<{
    id: string;
    channel: "sms" | "kakao" | "brand";
    title: string;
    status: string;
    scheduledAt: string | null;
    nhnRequestId: string | null;
    createdAt: string;
    updatedAt: string;
    recipientStats: {
      totalCount: number;
      submittedCount: number;
      deliveredCount: number;
      failedCount: number;
      pendingCount: number;
      skippedNoPhoneCount: number;
      duplicatePhoneCount: number;
    };
    sender: {
      id: string;
      label: string;
      status: string;
    };
    template: {
      id?: string;
      name: string;
      status?: string;
      source?: string;
      code?: string | null;
      providerTemplateId?: string | null;
      providerStatus?: string | null;
    } | null;
  }>;
};

export type V2CampaignDetailResponse = {
  channel: "sms" | "kakao" | "brand";
  campaign: {
    id: string;
    channel: "sms" | "kakao" | "brand";
    title: string;
    status: string;
    scheduledAt: string | null;
    nhnRequestId: string | null;
    body: string;
    createdAt: string;
    updatedAt: string;
    recipientStats: {
      totalCount: number;
      submittedCount: number;
      deliveredCount: number;
      failedCount: number;
      pendingCount: number;
      skippedNoPhoneCount: number;
      duplicatePhoneCount: number;
    };
    sender: {
      id: string;
      label: string;
      status: string;
      type?: string;
      senderKey?: string;
    };
    template: {
      source?: string;
      name: string;
      status?: string;
      code?: string | null;
      providerTemplateId?: string | null;
      providerStatus?: string | null;
      templateId?: string | null;
      messageType?: "TEXT" | "IMAGE" | "WIDE" | null;
      pushAlarm?: boolean;
      adult?: boolean;
      statsEventKey?: string | null;
      resellerCode?: string | null;
      imageUrl?: string | null;
      imageLink?: string | null;
      buttons?: Array<{
        type: "WL" | "AL" | "BK" | "MD";
        name: string;
        linkMo?: string | null;
        linkPc?: string | null;
        schemeIos?: string | null;
        schemeAndroid?: string | null;
      }> | null;
    } | null;
    recipients: Array<{
      id: string;
      managedUserId: string | null;
      recipientPhone: string;
      recipientName: string | null;
      recipientSeq: number | null;
      recipientGroupingKey: string | null;
      status: string;
      providerResultCode: string | null;
      providerResultMessage: string | null;
      templateParameters: unknown;
      createdAt: string;
      updatedAt: string;
    }>;
  };
};

export type V2RecipientFieldDefinition = {
  key: string;
  label: string;
  kind: "system" | "custom";
  dataType: string;
  importable: boolean;
  visibleByDefault: boolean;
};

export type V2SmsCampaignBootstrapResponse = {
  readiness: V2SmsSendReadinessResponse;
  senderNumbers: Array<{
    id: string;
    phoneNumber: string;
    type: string;
    approvedAt: string | null;
    updatedAt: string;
  }>;
  templates: Array<{
    id: string;
    name: string;
    body: string;
    requiredVariables: unknown;
    updatedAt: string;
  }>;
  recipientFields: V2RecipientFieldDefinition[];
  recipientSummary: {
    totalCount: number;
    activeCount: number;
    contactableCount: number;
    customFieldCount: number;
  };
  limits: {
    maxUserCount: number;
  };
};

export type V2KakaoCampaignBootstrapResponse = {
  readiness: V2KakaoSendReadinessResponse;
  senderProfiles: Array<{
    id: string;
    plusFriendId: string;
    senderKey: string;
    senderProfileType: string | null;
    isDefault: boolean;
    updatedAt: string;
  }>;
  templates: Array<{
    id: string;
    source: V2KakaoTemplateSource;
    ownerKey: string | null;
    ownerLabel: string;
    providerStatus: string;
    providerStatusRaw: string | null;
    providerStatusName: string | null;
    templateCode: string | null;
    kakaoTemplateCode: string | null;
    updatedAt: string | null;
    template: {
      name: string;
      body: string;
      requiredVariables: unknown;
      messageType: string | null;
    };
  }>;
  recipientFields: V2RecipientFieldDefinition[];
  recipientSummary: {
    totalCount: number;
    activeCount: number;
    contactableCount: number;
    customFieldCount: number;
  };
  limits: {
    maxUserCount: number;
  };
};

export type V2BrandCampaignBootstrapResponse = {
  readiness: V2BrandMessageReadinessResponse;
  senderProfiles: Array<{
    id: string;
    plusFriendId: string;
    senderKey: string;
    senderProfileType: string | null;
    isDefault: boolean;
    status: string;
    createdAt: string;
    updatedAt: string;
  }>;
  templates: Array<{
    id: string;
    senderProfileId: string;
    senderKey: string;
    plusFriendId: string | null;
    senderProfileType: string | null;
    senderProfileStatus: string | null;
    ownerLabel: string;
    providerStatus: string;
    providerStatusRaw: string | null;
    providerStatusName: string | null;
    templateCode: string | null;
    templateName: string;
    requiredVariables: string[];
    chatBubbleType: string | null;
    content: string | null;
    header: string | null;
    additionalContent: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  }>;
  recipientFields: V2RecipientFieldDefinition[];
  recipientSummary: {
    totalCount: number;
    activeCount: number;
    contactableCount: number;
    customFieldCount: number;
  };
  supportedMessageTypes: Array<"TEXT" | "IMAGE" | "WIDE">;
  constraints: V2BrandMessageOptionsResponse["constraints"];
  limits: {
    maxUserCount: number;
  };
};

export type V2CampaignRecipientSearchResponse = {
  filters: {
    query: string;
    status: "all" | "ACTIVE" | "INACTIVE" | "DORMANT" | "BLOCKED";
    limit: number;
    offset: number;
  };
  summary: {
    totalCount: number;
    filteredCount: number;
    contactableCount: number;
  };
  page: {
    limit: number;
    offset: number;
    hasNext: boolean;
    nextOffset: number | null;
    prevOffset: number | null;
  };
  items: Array<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    externalId: string | null;
    status: "ACTIVE" | "INACTIVE" | "DORMANT" | "BLOCKED";
    source: string;
    userType: string | null;
    segment: string | null;
    gradeOrLevel: string | null;
    marketingConsent: boolean | null;
    hasPhone: boolean;
    customAttributes: Record<string, string | number | boolean | null>;
    updatedAt: string;
    createdAt: string;
  }>;
};

export type V2SendBlocker = {
  code: string;
  message: string;
  cta: string;
};

export type V2SmsSendReadinessResponse = {
  ready: boolean;
  status: SmsStatus;
  blockers: V2SendBlocker[];
};

export type V2SmsSendOptionsResponse = {
  readiness: V2SmsSendReadinessResponse;
  senderNumbers: Array<{
    id: string;
    phoneNumber: string;
    type: string;
    approvedAt: string | null;
    updatedAt: string;
  }>;
  templates: Array<{
    id: string;
    name: string;
    body: string;
    requiredVariables: unknown;
    updatedAt: string;
  }>;
};

export type V2KakaoSendReadinessResponse = {
  ready: boolean;
  status: KakaoStatus;
  blockers: V2SendBlocker[];
};

export type V2KakaoSendOptionsResponse = {
  readiness: V2KakaoSendReadinessResponse;
  senderProfiles: Array<{
    id: string;
    plusFriendId: string;
    senderKey: string;
    senderProfileType: string | null;
    isDefault: boolean;
    updatedAt: string;
  }>;
  templates: Array<{
    id: string;
    source: V2KakaoTemplateSource;
    ownerKey: string | null;
    ownerLabel: string;
    providerStatus: string;
    providerStatusRaw: string | null;
    providerStatusName: string | null;
    templateCode: string | null;
    kakaoTemplateCode: string | null;
    updatedAt: string | null;
    template: {
      name: string;
      body: string;
      requiredVariables: unknown;
      messageType: string | null;
    };
  }>;
  fallbackSenderNumbers: Array<{
    id: string;
    phoneNumber: string;
    type: string;
    approvedAt: string | null;
  }>;
};

export type V2BrandMessageReadinessResponse = {
  ready: boolean;
  status: KakaoStatus;
  blockers: V2SendBlocker[];
};

export type V2BrandMessageOptionsResponse = {
  readiness: V2BrandMessageReadinessResponse;
  senderProfiles: Array<{
    id: string;
    plusFriendId: string;
    senderKey: string;
    senderProfileType: string | null;
    isDefault: boolean;
    status: string;
    createdAt: string;
    updatedAt: string;
  }>;
  supportedModes: Array<"FREESTYLE" | "TEMPLATE">;
  supportedTargetings: Array<"I" | "M" | "N">;
  supportedMessageTypes: Array<"TEXT" | "IMAGE" | "WIDE">;
  tabs: Array<{
    id: "regular" | "mass" | "templates" | "unsubscribe" | "mn-activation";
    label: string;
    enabled: boolean;
  }>;
  constraints: {
    nightSendRestricted: boolean;
    nightSendWindow: {
      start: string;
      end: string;
    };
    supportedFeatures: {
      pushAlarm: boolean;
      statsEventKey: boolean;
      resellerCode: boolean;
      adult: boolean;
      schedule: boolean;
      buttons: boolean;
      preview: boolean;
      coupon: boolean;
      template: boolean;
      mnTargeting: boolean;
      massUpload: boolean;
      unsubscribePerRecipient: boolean;
      resendPerRecipient: boolean;
    };
  };
};

export type V2KakaoSendPageData = {
  alimtalk: {
    readiness: V2KakaoSendReadinessResponse | null;
    options: V2KakaoSendOptionsResponse | null;
  };
  brand: {
    readiness: V2BrandMessageReadinessResponse | null;
    options: V2BrandMessageOptionsResponse | null;
  };
};

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }

  return response.json() as Promise<T>;
}

async function apiFetchForm<T>(path: string, body: FormData): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }

  return response.json() as Promise<T>;
}

export type V2AcceptedMessageRequestResponse = {
  requestId: string;
  status: string;
  idempotent?: boolean;
};

export type V2CreateKakaoTemplateResponse = {
  target: {
    id: string;
    type: V2KakaoTemplateSource;
    label: string;
    senderKey: string;
    senderProfileId: string | null;
  };
  template: {
    templateId: string;
    providerTemplateId: string;
    nhnTemplateId: string;
    name: string;
    body: string;
    templateCode: string;
    kakaoTemplateCode: string | null;
    providerStatus: "REQ" | "APR" | "REJ";
  };
};

export type V2UpdateKakaoTemplateResponse = {
  target: V2CreateKakaoTemplateResponse["target"];
  template: Omit<V2CreateKakaoTemplateResponse["template"], "templateId" | "providerTemplateId"> & {
    templateId: string | null;
    providerTemplateId: string | null;
  };
};

export type V2DeleteKakaoTemplateResponse = {
  deleted: {
    source: V2KakaoTemplateSource;
    ownerKey: string | null;
    senderKey: string;
    templateCode: string;
    kakaoTemplateCode: string | null;
  };
};

export type V2UpsertPublEventKakaoBindingPayload = {
  eventKey: string;
  providerTemplateId?: string;
  kakaoTemplateCatalogId?: string;
  templateBindingMode?: "DEFAULT" | "CUSTOM";
  senderProfileId: string;
};

export type V2UpsertPublEventKakaoBindingResponse = {
  item: V2EventsResponse["items"][number];
};

export type V2CreateKakaoTemplatePayload = {
  draftTemplateId?: string;
  targetType: V2KakaoTemplateSource;
  targetId?: string;
  senderProfileId?: string;
  templateCode: string;
  name: string;
  body: string;
  messageType?: "BA" | "AD" | "EX" | "MI";
  emphasizeType?: "NONE" | "TEXT" | "IMAGE";
  extra?: string;
  title?: string;
  subtitle?: string;
  imageName?: string;
  imageUrl?: string;
  categoryCode: string;
  securityFlag?: boolean;
  buttons?: Array<{
    type: string;
    name?: string;
    linkMo?: string;
    linkPc?: string;
    schemeIos?: string;
    schemeAndroid?: string;
    bizFormId?: number;
    pluginId?: string;
    telNumber?: string;
  }>;
  quickReplies?: Array<{
    type: string;
    name?: string;
    linkMo?: string;
    linkPc?: string;
    schemeIos?: string;
    schemeAndroid?: string;
    bizFormId?: number;
    pluginId?: string;
  }>;
  comment?: string;
};

export type V2SaveKakaoTemplateDraftPayload = {
  draftTemplateId?: string;
  targetType?: V2KakaoTemplateSource;
  targetId?: string;
  senderProfileId?: string;
  templateCode?: string;
  name?: string;
  body?: string;
  messageType?: "BA" | "AD" | "EX" | "MI";
  emphasizeType?: "NONE" | "TEXT" | "IMAGE";
  extra?: string;
  title?: string;
  subtitle?: string;
  imageName?: string;
  imageUrl?: string;
  categoryCode?: string;
  securityFlag?: boolean;
  buttons?: V2KakaoTemplateDraftAction[];
  quickReplies?: V2KakaoTemplateDraftAction[];
  comment?: string;
  sourceEventKey?: string;
};

export type V2SaveKakaoTemplateDraftResponse = {
  draft: V2KakaoTemplateDraftItem;
};

export type V2UploadKakaoTemplateImageResponse = {
  templateImageName: string;
  templateImageUrl: string;
};

export type V2CreateBrandTemplateResponse = {
  target: {
    id: string;
    label: string;
    senderKey: string;
  };
  template:
    | V2BrandTemplatesResponse["items"][number]
    | {
        templateCode: string;
        status: string | null;
      };
};

export type V2UpdateBrandTemplateResponse = V2CreateBrandTemplateResponse;

export type V2DeleteBrandTemplateResponse = {
  deleted: {
    senderProfileId: string;
    senderKey: string;
    templateCode: string;
  };
};

export type V2CreateBrandTemplatePayload = {
  senderProfileId: string;
  templateName: string;
  chatBubbleType:
    | "TEXT"
    | "IMAGE"
    | "WIDE"
    | "WIDE_ITEM_LIST"
    | "PREMIUM_VIDEO"
    | "COMMERCE"
    | "CAROUSEL_FEED"
    | "CAROUSEL_COMMERCE";
  adult?: boolean;
  content?: string;
  header?: string;
  additionalContent?: string;
  image?: V2BrandTemplateImage;
  buttons?: V2BrandTemplateButton[];
  item?: {
    list: V2BrandTemplateWideItem[];
  };
  coupon?: V2BrandTemplateCoupon;
  commerce?: V2BrandTemplateCommerce;
  video?: V2BrandTemplateVideo;
  carousel?: {
    head?: V2BrandTemplateCarouselHead;
    list: V2BrandTemplateCarouselItem[];
    tail?: V2BrandTemplateCarouselTail;
  };
};

export type V2UploadBrandMessageImageResponse = {
  imageSeq: number | null;
  imageUrl: string;
  imageName: string | null;
};

export function fetchV2Bootstrap() {
  return apiFetch<V2BootstrapResponse>("/v2/bootstrap");
}

export function fetchV2Dashboard() {
  return apiFetch<V2DashboardResponse>("/v2/dashboard");
}

export async function fetchV2ResourcesBundle() {
  const [summary, sms, kakao] = await Promise.all([
    apiFetch<V2ResourcesSummaryResponse>("/v2/resources/summary"),
    apiFetch<V2SmsResourcesResponse>("/v2/resources/sms"),
    apiFetch<V2KakaoResourcesResponse>("/v2/resources/kakao"),
  ]);

  return { summary, sms, kakao };
}

export function setV2DefaultKakaoChannel(senderProfileId: string) {
  return apiFetch<{
    item: {
      localSenderProfileId: string;
      plusFriendId: string;
      senderKey: string;
      localStatus: string;
      isDefault: boolean;
      senderProfileType: string | null;
      createdAt: string | null;
      updatedAt: string | null;
    };
  }>(`/v2/resources/kakao/${encodeURIComponent(senderProfileId)}/default`, {
    method: "POST",
  });
}

export async function fetchV2TemplatesBundle() {
  const [summary, sms, kakao, brand] = await Promise.all([
    apiFetch<V2TemplatesSummaryResponse>("/v2/templates/summary"),
    apiFetch<V2SmsTemplatesResponse>("/v2/templates/sms"),
    apiFetch<V2KakaoTemplatesResponse>("/v2/templates/kakao"),
    apiFetch<V2BrandTemplatesResponse>("/v2/templates/brand"),
  ]);

  return { summary, sms, kakao, brand };
}

export function fetchV2KakaoTemplates() {
  return apiFetch<V2KakaoTemplatesResponse>("/v2/templates/kakao");
}

export function fetchV2KakaoTemplateDrafts(params: { sourceEventKey?: string } = {}) {
  const search = new URLSearchParams();
  if (params.sourceEventKey) {
    search.set("sourceEventKey", params.sourceEventKey);
  }
  const query = search.toString();
  return apiFetch<V2KakaoTemplateDraftsResponse>(`/v2/templates/kakao/drafts${query ? `?${query}` : ""}`);
}

export function fetchV2SmsTemplateDetail(templateId: string) {
  return apiFetch<V2SmsTemplateDetailResponse>(`/v2/templates/sms/${templateId}`);
}

export function fetchV2KakaoTemplateDetail(params: {
  source: V2KakaoTemplateSource;
  ownerKey?: string | null;
  templateCode: string;
}) {
  const search = new URLSearchParams();
  search.set("source", params.source);
  if (params.ownerKey) {
    search.set("ownerKey", params.ownerKey);
  }
  search.set("templateCode", params.templateCode);

  return apiFetch<V2KakaoTemplateDetailResponse>(`/v2/templates/kakao/detail?${search.toString()}`);
}

export function fetchV2BrandTemplateDetail(params: { senderProfileId: string; templateCode: string }) {
  const search = new URLSearchParams();
  search.set("senderProfileId", params.senderProfileId);
  search.set("templateCode", params.templateCode);
  return apiFetch<V2BrandTemplateDetailResponse>(`/v2/templates/brand/detail?${search.toString()}`);
}

export function fetchV2BrandTemplates() {
  return apiFetch<V2BrandTemplatesResponse>("/v2/templates/brand");
}

export function fetchV2Events() {
  return apiFetch<V2EventsResponse>("/v2/events");
}

export function upsertV2PublEventKakaoBinding(payload: V2UpsertPublEventKakaoBindingPayload) {
  return apiFetch<V2UpsertPublEventKakaoBindingResponse>("/v2/events/publ-kakao-binding", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchV2PublEvents() {
  return apiFetch<V2PublEventsResponse>("/v2/publ-events");
}

export function createV2PublEvent(payload: V2UpsertPublEventPayload) {
  return apiFetch<V2PublEventMutationResponse>("/v2/publ-events", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateV2PublEvent(eventId: string, payload: V2UpsertPublEventPayload) {
  return apiFetch<V2PublEventMutationResponse>(`/v2/publ-events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function fetchV2Logs(params?: {
  status?: string;
  statusGroup?: "waiting" | "in_progress" | "delivered" | "failed";
  eventKey?: string;
  channel?: "sms" | "kakao" | "ALIMTALK" | "BRAND_MESSAGE";
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.statusGroup) query.set("statusGroup", params.statusGroup);
  if (params?.eventKey) query.set("eventKey", params.eventKey);
  if (params?.channel) query.set("channel", params.channel);
  if (params?.limit) query.set("limit", String(params.limit));
  const queryString = query.toString();
  return apiFetch<V2LogsResponse>(`/v2/logs${queryString ? `?${queryString}` : ""}`);
}

export function fetchV2LogDetail(requestId: string) {
  return apiFetch<V2LogDetailResponse>(`/v2/logs/${encodeURIComponent(requestId)}`);
}

export function retryV2Log(requestId: string) {
  return apiFetch<{ requestId: string; status: string; retryOfRequestId: string }>(`/v2/logs/${encodeURIComponent(requestId)}/retry`, {
    method: "POST",
  });
}

export function fetchV2OpsHealth() {
  return apiFetch<V2OpsHealthResponse>("/v2/ops/health");
}

export function fetchV2OpsSenderNumberApplications() {
  return apiFetch<V2OpsSenderNumberApplicationsResponse>("/v2/ops/sender-number-applications");
}

export function fetchV2OpsKakaoTemplateApplications() {
  return apiFetch<V2OpsKakaoTemplateApplicationsResponse>("/v2/ops/kakao-template-applications");
}

export function fetchV2OpsAdminUsers() {
  return apiFetch<V2OpsAdminUsersResponse>("/v2/ops/admin-users");
}

export function updateV2OpsAdminUserRole(adminUserId: string, payload: { role: "USER" | "PARTNER_ADMIN" }) {
  return apiFetch<{ id: string; role: "USER" | "PARTNER_ADMIN" | "SUPER_ADMIN" }>(
    `/v2/ops/admin-users/${encodeURIComponent(adminUserId)}/role`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );
}

export function updateV2OpsAdminUserAccessOrigin(adminUserId: string, payload: { accessOrigin: "DIRECT" | "PUBL" }) {
  return apiFetch<{ id: string; accessOrigin: "DIRECT" | "PUBL" }>(
    `/v2/ops/admin-users/${encodeURIComponent(adminUserId)}/access-origin`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );
}

export function fetchV2OpsManagedUsers() {
  return apiFetch<V2OpsManagedUsersResponse>("/v2/ops/managed-users");
}

export function fetchV2OpsNotices() {
  return apiFetch<V2OpsNoticesResponse>("/v2/ops/notices");
}

export function fetchV2OpsSmsQuotas() {
  return apiFetch<V2OpsSmsQuotasResponse>("/v2/ops/sms-quotas");
}

export function updateV2OpsSmsQuota(userId: string, payload: { monthlySmsLimit: number }) {
  return apiFetch<{ userId: string; monthlySmsLimit: number }>(`/v2/ops/sms-quotas/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function createV2OpsNotice(payload: V2OpsCreateNoticePayload) {
  return apiFetch<V2OpsNotice>("/v2/ops/notices", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateV2OpsNotice(noticeId: string, payload: V2OpsUpdateNoticePayload) {
  return apiFetch<V2OpsNotice>(`/v2/ops/notices/${encodeURIComponent(noticeId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function archiveV2OpsNotice(noticeId: string) {
  return apiFetch<{ id: string }>(`/v2/ops/notices/${encodeURIComponent(noticeId)}/archive`, {
    method: "POST",
  });
}

export function fetchV2Recipients() {
  return apiFetch<V2RecipientsResponse>("/v2/recipients");
}

export function createV2Recipient(payload: V2CreateRecipientPayload) {
  return apiFetch<V2CreateRecipientResponse>("/v2/recipients", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchV2PartnerOverview() {
  return apiFetch<V2PartnerOverviewResponse>("/v2/partner/overview");
}

export function fetchV2PartnerClientDetail(clientId: string) {
  return apiFetch<V2PartnerClientDetailResponse>(`/v2/partner/clients/${encodeURIComponent(clientId)}`);
}

export function fetchV2OpsSendActivity(params?: {
  range?: Exclude<V2OpsSendActivityRangeKey, "custom">;
  startDate?: string;
  endDate?: string;
}) {
  const search = new URLSearchParams();
  if (params?.range) {
    search.set("range", params.range);
  }
  if (params?.startDate) {
    search.set("startDate", params.startDate);
  }
  if (params?.endDate) {
    search.set("endDate", params.endDate);
  }

  return apiFetch<V2OpsSendActivityResponse>(`/v2/ops/send-activity${search.toString() ? `?${search.toString()}` : ""}`);
}

export function fetchV2OpsSendActivityDetail(
  adminUserId: string,
  params?: {
    range?: Exclude<V2OpsSendActivityRangeKey, "custom">;
    startDate?: string;
    endDate?: string;
  }
) {
  const search = new URLSearchParams();
  if (params?.range) {
    search.set("range", params.range);
  }
  if (params?.startDate) {
    search.set("startDate", params.startDate);
  }
  if (params?.endDate) {
    search.set("endDate", params.endDate);
  }

  return apiFetch<V2OpsSendActivityDetailResponse>(
    `/v2/ops/send-activity/${encodeURIComponent(adminUserId)}${search.toString() ? `?${search.toString()}` : ""}`
  );
}

export function fetchV2OpsKakaoTemplateDetail(params: {
  senderKey: string;
  templateCode: string;
  userId?: string | null;
  source?: V2KakaoTemplateSource;
}) {
  const search = new URLSearchParams();
  search.set("senderKey", params.senderKey);
  search.set("templateCode", params.templateCode);
  if (params.userId) {
    search.set("userId", params.userId);
  }
  if (params.source) {
    search.set("source", params.source);
  }

  return apiFetch<V2OpsKakaoTemplateDetailResponse>(`/v2/ops/kakao-template-applications/detail?${search.toString()}`);
}

export function approveV2OpsSenderNumberApplication(senderNumberId: string, memo?: string) {
  return apiFetch<{ ok: true }>(`/v2/ops/sender-number-applications/${senderNumberId}/approve`, {
    method: "POST",
    body: JSON.stringify({ memo }),
  });
}

export function requestSupplementV2OpsSenderNumberApplication(senderNumberId: string, memo?: string) {
  return apiFetch<{ ok: true }>(`/v2/ops/sender-number-applications/${senderNumberId}/request-supplement`, {
    method: "POST",
    body: JSON.stringify({ memo }),
  });
}

export function rejectV2OpsSenderNumberApplication(senderNumberId: string, memo?: string) {
  return apiFetch<{ ok: true }>(`/v2/ops/sender-number-applications/${senderNumberId}/reject`, {
    method: "POST",
    body: JSON.stringify({ memo }),
  });
}

export function buildV2OpsSenderNumberAttachmentUrl(
  senderNumberId: string,
  kind: V2OpsSenderNumberAttachmentKind,
) {
  return `${API_BASE_URL}/v2/ops/sender-number-applications/${encodeURIComponent(senderNumberId)}/attachments/${kind}`;
}

export function fetchV2Campaigns() {
  return apiFetch<V2CampaignsResponse>("/v2/campaigns");
}

export function fetchV2SmsCampaignBootstrap() {
  return apiFetch<V2SmsCampaignBootstrapResponse>("/v2/campaigns/sms/bootstrap");
}

export function fetchV2KakaoCampaignBootstrap() {
  return apiFetch<V2KakaoCampaignBootstrapResponse>("/v2/campaigns/kakao/bootstrap");
}

export function fetchV2BrandCampaignBootstrap() {
  return apiFetch<V2BrandCampaignBootstrapResponse>("/v2/campaigns/brand/bootstrap");
}

export function searchV2CampaignRecipients(params?: {
  query?: string;
  status?: "all" | "ACTIVE" | "INACTIVE" | "DORMANT" | "BLOCKED";
  limit?: number;
  offset?: number;
}) {
  const query = new URLSearchParams();
  if (params?.query) query.set("q", params.query);
  if (params?.status) query.set("status", params.status);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));

  const search = query.toString();
  return apiFetch<V2CampaignRecipientSearchResponse>(`/v2/campaigns/recipients/search${search ? `?${search}` : ""}`);
}

export function fetchV2CampaignDetail(campaignId: string, channel?: "sms" | "kakao" | "brand") {
  const query = channel ? `?channel=${channel}` : "";
  return apiFetch<V2CampaignDetailResponse>(`/v2/campaigns/${campaignId}${query}`);
}

export function createV2SmsCampaign(payload: {
  title?: string;
  senderNumberId: string;
  templateId?: string;
  body?: string;
  isAdvertisement?: boolean;
  advertisingServiceName?: string;
  userIds: string[];
  templateVariableMappings?: Array<{
    templateVariable: string;
    userFieldKey: string;
  }>;
  scheduledAt?: string;
}) {
  return apiFetch<{
    campaignId: string;
    channel: "sms";
    status: string;
    queued: boolean;
    scheduledAt: string | null;
    createdAt: string;
  }>("/v2/campaigns/sms", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createV2KakaoCampaign(payload: {
  title?: string;
  senderProfileId: string;
  providerTemplateId?: string;
  templateSource?: "GROUP";
  templateCode?: string;
  templateName?: string;
  templateBody?: string;
  userIds: string[];
  templateVariableMappings?: Array<{
    templateVariable: string;
    userFieldKey: string;
  }>;
  scheduledAt?: string;
}) {
  return apiFetch<{
    campaignId: string;
    channel: "kakao";
    status: string;
    queued: boolean;
    scheduledAt: string | null;
    createdAt: string;
  }>("/v2/campaigns/kakao", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createV2BrandCampaign(payload: {
  title?: string;
  senderProfileId: string;
  mode?: "FREESTYLE" | "TEMPLATE";
  messageType?:
    | "TEXT"
    | "IMAGE"
    | "WIDE"
    | "WIDE_ITEM_LIST"
    | "CAROUSEL_FEED"
    | "PREMIUM_VIDEO"
    | "COMMERCE"
    | "CAROUSEL_COMMERCE";
  content?: string;
  templateCode?: string;
  templateName?: string;
  templateBody?: string;
  requiredVariables?: string[];
  pushAlarm?: boolean;
  adult?: boolean;
  statsEventKey?: string;
  resellerCode?: string;
  buttons?: Array<{
    type: "WL" | "AL" | "BK" | "MD";
    name: string;
    linkMo?: string;
    linkPc?: string;
    schemeIos?: string;
    schemeAndroid?: string;
  }>;
  image?: {
    imageUrl?: string;
    imageLink?: string;
  };
  userIds: string[];
  templateVariableMappings?: Array<{
    templateVariable: string;
    userFieldKey: string;
  }>;
  scheduledAt?: string;
}) {
  return apiFetch<{
    campaignId: string;
    channel: "brand";
    status: string;
    queued: boolean;
    scheduledAt: string | null;
    createdAt: string;
  }>("/v2/campaigns/brand", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchV2SmsSendReadiness() {
  return apiFetch<V2SmsSendReadinessResponse>("/v2/send/sms/readiness");
}

export function fetchV2SmsSendOptions() {
  return apiFetch<V2SmsSendOptionsResponse>("/v2/send/sms/options");
}

export function fetchV2KakaoSendReadiness() {
  return apiFetch<V2KakaoSendReadinessResponse>("/v2/send/kakao/readiness");
}

export function fetchV2KakaoSendOptions() {
  return apiFetch<V2KakaoSendOptionsResponse>("/v2/send/kakao/options");
}

export function fetchV2BrandMessageReadiness() {
  return apiFetch<V2BrandMessageReadinessResponse>("/v2/send/kakao/brand/readiness");
}

export function fetchV2BrandMessageOptions() {
  return apiFetch<V2BrandMessageOptionsResponse>("/v2/send/kakao/brand/options");
}

export function fetchV2KakaoConnectBootstrap() {
  return apiFetch<V2KakaoConnectBootstrapResponse>("/v2/resources/kakao/connect/bootstrap");
}

export function requestV2KakaoConnect(payload: V2KakaoConnectRequestPayload) {
  return apiFetch<V2KakaoConnectRequestResponse>("/v2/resources/kakao/connect/request", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function verifyV2KakaoConnect(payload: V2KakaoConnectVerifyPayload) {
  return apiFetch<V2KakaoConnectVerifyResponse>("/v2/resources/kakao/connect/verify", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createV2SmsRequest(formData: FormData) {
  return apiFetchForm<V2AcceptedMessageRequestResponse>("/v2/send/sms/requests", formData);
}

export function fetchV2SenderNumberApplicationDetail(senderNumberId: string) {
  return apiFetch<V2SenderNumberApplicationDetailResponse>(`/v2/resources/sender-numbers/${encodeURIComponent(senderNumberId)}`);
}

export function createV2SenderNumberApplication(formData: FormData) {
  return apiFetchForm<V2CreateSenderNumberApplicationResponse>("/v2/resources/sender-numbers/apply", formData);
}

export function createV2KakaoRequest(payload: {
  senderProfileId: string;
  templateSource?: "GROUP" | "NHN";
  templateCode?: string;
  templateName?: string;
  templateBody?: string;
  requiredVariables?: string[];
  recipientPhone: string;
  useSmsFailover?: boolean;
  fallbackSenderNumberId?: string;
  variables: Record<string, string>;
  scheduledAt?: string;
}) {
  return apiFetch<V2AcceptedMessageRequestResponse>("/v2/send/kakao/requests", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createV2BrandMessageRequest(payload: {
  senderProfileId: string;
  mode: "FREESTYLE" | "TEMPLATE";
  targeting: "I" | "M" | "N";
  messageType?:
    | "TEXT"
    | "IMAGE"
    | "WIDE"
    | "WIDE_ITEM_LIST"
    | "CAROUSEL_FEED"
    | "PREMIUM_VIDEO"
    | "COMMERCE"
    | "CAROUSEL_COMMERCE";
  recipientPhone: string;
  templateCode?: string;
  templateName?: string;
  templateBody?: string;
  requiredVariables?: string[];
  variables?: Record<string, string>;
  content?: string;
  pushAlarm?: boolean;
  adult?: boolean;
  statsEventKey?: string;
  resellerCode?: string;
  buttons?: Array<{
    type: "WL" | "AL" | "BK" | "MD";
    name: string;
    linkMo?: string;
    linkPc?: string;
    schemeIos?: string;
    schemeAndroid?: string;
  }>;
  image?: {
    assetId?: string;
    imageUrl?: string;
    imageLink?: string;
  };
  scheduledAt?: string;
}) {
  return apiFetch<V2AcceptedMessageRequestResponse>("/v2/send/kakao/brand/requests", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function uploadV2BrandMessageImage(file: File, messageType: "IMAGE" | "WIDE") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("messageType", messageType);

  return apiFetchForm<V2UploadBrandMessageImageResponse>("/v2/send/kakao/brand/image", formData);
}

export function createV2KakaoTemplate(payload: V2CreateKakaoTemplatePayload) {
  return apiFetch<V2CreateKakaoTemplateResponse>("/v2/templates/kakao", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function saveV2KakaoTemplateDraft(payload: V2SaveKakaoTemplateDraftPayload) {
  return apiFetch<V2SaveKakaoTemplateDraftResponse>("/v2/templates/kakao/drafts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateV2KakaoTemplate(templateCode: string, payload: V2CreateKakaoTemplatePayload) {
  return apiFetch<V2UpdateKakaoTemplateResponse>(`/v2/templates/kakao/${encodeURIComponent(templateCode)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteV2KakaoTemplate(params: {
  source: V2KakaoTemplateSource;
  ownerKey?: string | null;
  templateCode: string;
}) {
  const search = new URLSearchParams();
  search.set("source", params.source);
  if (params.ownerKey) {
    search.set("ownerKey", params.ownerKey);
  }
  search.set("templateCode", params.templateCode);

  return apiFetch<V2DeleteKakaoTemplateResponse>(
    `/v2/templates/kakao/${encodeURIComponent(params.templateCode)}?${search.toString()}`,
    {
      method: "DELETE",
    }
  );
}

export function createV2BrandTemplate(payload: V2CreateBrandTemplatePayload) {
  return apiFetch<V2CreateBrandTemplateResponse>("/v2/templates/brand", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateV2BrandTemplate(templateCode: string, payload: V2CreateBrandTemplatePayload) {
  return apiFetch<V2UpdateBrandTemplateResponse>(`/v2/templates/brand/${encodeURIComponent(templateCode)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteV2BrandTemplate(params: { senderProfileId: string; templateCode: string }) {
  const search = new URLSearchParams();
  search.set("senderProfileId", params.senderProfileId);
  return apiFetch<V2DeleteBrandTemplateResponse>(
    `/v2/templates/brand/${encodeURIComponent(params.templateCode)}?${search.toString()}`,
    {
      method: "DELETE",
    }
  );
}

export function uploadV2KakaoTemplateImage(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  return apiFetchForm<V2UploadKakaoTemplateImageResponse>("/v2/templates/kakao/image", formData);
}

export function uploadV2BrandTemplateImage(
  file: File,
  imageType:
    | "IMAGE"
    | "WIDE_IMAGE"
    | "MAIN_WIDE_ITEMLIST_IMAGE"
    | "NORMAL_WIDE_ITEMLIST_IMAGE"
    | "CAROUSEL_FEED_IMAGE"
    | "CAROUSEL_COMMERCE_IMAGE"
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("imageType", imageType);

  return apiFetchForm<V2UploadBrandMessageImageResponse>("/v2/templates/brand/image", formData);
}
