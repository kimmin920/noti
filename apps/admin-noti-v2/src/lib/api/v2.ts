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
  account: {
    tenantId: string;
    tenantName: string;
    email: string | null;
    loginId: string | null;
    role: string;
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
  account: V2BootstrapResponse["account"];
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
    kakaoDaySentCount: number;
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
    createdAt: string | null;
    updatedAt: string | null;
  } | null;
};

export type V2CreateSenderNumberApplicationResponse = {
  id: string;
  tenantId: string;
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
      providerTemplateId: string;
      templateId: string;
      templateName: string;
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
      updatedAt: string;
    }>;
    kakaoSenderProfiles: Array<{
      id: string;
      plusFriendId: string;
      senderKey: string;
      status: string;
      updatedAt: string;
    }>;
  };
};

export type V2LogsResponse = {
  filters: {
    status: string | null;
    eventKey: string | null;
    channel: "sms" | "kakao" | null;
    limit: number;
  };
  summary: {
    totalCount: number;
    statusCounts: Record<string, number>;
  };
  items: Array<{
    id: string;
    eventKey: string;
    channel: "sms" | "kakao" | null;
    status: string;
    recipientPhone: string;
    scheduledAt: string | null;
    lastErrorCode: string | null;
    lastErrorMessage: string | null;
    createdAt: string;
    updatedAt: string;
    latestDeliveryResult: {
      deliveryStatus?: string | null;
      providerStatusCode?: string | null;
      providerStatusMessage?: string | null;
      createdAt?: string;
    } | null;
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
  | "businessRegistration"
  | "relationshipProof"
  | "additional"
  | "employment";

export type V2OpsSenderNumberApplicationsResponse = {
  summary: {
    totalCount: number;
    submittedCount: number;
    approvedCount: number;
    rejectedCount: number;
    providerApprovedCount: number;
    providerBlockedCount: number;
  };
  items: Array<{
    id: string;
    tenantId: string;
    tenantName: string;
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
    tenantId: string | null;
    tenantName: string;
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
    tenantId: string | null;
    tenantName: string;
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
  };
};

export type V2OpsAdminUsersResponse = {
  summary: {
    totalCount: number;
    tenantAdminCount: number;
    partnerAdminCount: number;
    superAdminCount: number;
    tenantCount: number;
  };
  items: Array<{
    id: string;
    tenantId: string;
    tenantName: string;
    tenantStatus: string;
    providerUserId: string;
    loginId: string | null;
    email: string | null;
    role: "TENANT_ADMIN" | "PARTNER_ADMIN" | "SUPER_ADMIN";
    accessOrigin: "DIRECT" | "PUBL";
    partnerScope: "DIRECT" | "PUBL" | null;
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
    tenantCount: number;
    sourceCount: number;
  };
  items: Array<{
    id: string;
    tenantId: string;
    tenantName: string;
    tenantStatus: string;
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

export type V2PartnerOverviewResponse = {
  summary: {
    tenantCount: number;
    tenantAdminCount: number;
    smsReadyTenantCount: number;
    kakaoReadyTenantCount: number;
    managedUserCount: number;
  };
  tenants: Array<{
    id: string;
    name: string;
    status: string;
    accessOrigin: "DIRECT" | "PUBL";
    tenantAdminCount: number;
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
  adminUsers: Array<{
    id: string;
    tenantId: string;
    tenantName: string;
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

export type V2PartnerTenantDetailResponse = {
  tenant: {
    id: string;
    name: string;
    status: string;
    accessOrigin: "DIRECT" | "PUBL";
    createdAt: string;
    updatedAt: string;
  };
  summary: {
    tenantAdminCount: number;
    approvedSenderNumberCount: number;
    activeSenderProfileCount: number;
    managedUserCount: number;
    smsTemplateCount: number;
    enabledEventRuleCount: number;
    approvedKakaoTemplateCount: number;
    recentManualRequestCount: number;
    recentBulkCampaignCount: number;
  };
  adminUsers: Array<{
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
    accountCount: number;
    activeAccountCount: number;
    smsMessageCount: number;
    kakaoMessageCount: number;
    senderNumberCount: number;
    channelCount: number;
  };
  items: Array<{
    adminUserId: string;
    tenantId: string;
    tenantName: string;
    loginId: string | null;
    email: string | null;
    role: "TENANT_ADMIN" | "PARTNER_ADMIN" | "SUPER_ADMIN" | null;
    smsMessageCount: number;
    smsSenderNumberCount: number;
    kakaoMessageCount: number;
    kakaoChannelCount: number;
    lastSentAt: string | null;
  }>;
};

export type V2OpsSendActivityDetailResponse = {
  range: V2OpsSendActivityResponse["range"];
  account: {
    adminUserId: string;
    tenantId: string;
    tenantName: string;
    loginId: string | null;
    email: string | null;
    role: "TENANT_ADMIN" | "PARTNER_ADMIN" | "SUPER_ADMIN" | null;
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
    channel: "all" | "sms" | "kakao";
    limit: number;
  };
  counts: {
    totalCount: number;
    smsCount: number;
    kakaoCount: number;
  };
  items: Array<{
    id: string;
    channel: "sms" | "kakao";
    title: string;
    status: string;
    scheduledAt: string | null;
    nhnRequestId: string | null;
    createdAt: string;
    updatedAt: string;
    recipientStats: {
      totalCount: number;
      acceptedCount: number;
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
  channel: "sms" | "kakao";
  campaign: {
    id: string;
    channel: "sms" | "kakao";
    title: string;
    status: string;
    scheduledAt: string | null;
    nhnRequestId: string | null;
    body: string;
    createdAt: string;
    updatedAt: string;
    requestedBy: string | null;
    recipientStats: {
      totalCount: number;
      acceptedCount: number;
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
  };
  template: {
    nhnTemplateId: string;
    templateCode: string;
    kakaoTemplateCode: string | null;
    providerStatus: "REQ" | "APR" | "REJ";
  };
};

export type V2CreateKakaoTemplatePayload = {
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

export type V2UploadKakaoTemplateImageResponse = {
  templateImageName: string;
  templateImageUrl: string;
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

export async function fetchV2TemplatesBundle() {
  const [summary, sms, kakao] = await Promise.all([
    apiFetch<V2TemplatesSummaryResponse>("/v2/templates/summary"),
    apiFetch<V2SmsTemplatesResponse>("/v2/templates/sms"),
    apiFetch<V2KakaoTemplatesResponse>("/v2/templates/kakao"),
  ]);

  return { summary, sms, kakao };
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

export function fetchV2Events() {
  return apiFetch<V2EventsResponse>("/v2/events");
}

export function fetchV2Logs() {
  return apiFetch<V2LogsResponse>("/v2/logs");
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

export function fetchV2OpsManagedUsers() {
  return apiFetch<V2OpsManagedUsersResponse>("/v2/ops/managed-users");
}

export function fetchV2PartnerOverview() {
  return apiFetch<V2PartnerOverviewResponse>("/v2/partner/overview");
}

export function fetchV2PartnerTenantDetail(tenantId: string) {
  return apiFetch<V2PartnerTenantDetailResponse>(`/v2/partner/tenants/${encodeURIComponent(tenantId)}`);
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
  tenantId?: string | null;
  source?: V2KakaoTemplateSource;
}) {
  const search = new URLSearchParams();
  search.set("senderKey", params.senderKey);
  search.set("templateCode", params.templateCode);
  if (params.tenantId) {
    search.set("tenantId", params.tenantId);
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

export function fetchV2CampaignDetail(campaignId: string, channel?: "sms" | "kakao") {
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

export function createV2KakaoTemplate(payload: V2CreateKakaoTemplatePayload) {
  return apiFetch<V2CreateKakaoTemplateResponse>("/v2/templates/kakao", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function uploadV2KakaoTemplateImage(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  return apiFetchForm<V2UploadKakaoTemplateImageResponse>("/v2/templates/kakao/image", formData);
}
