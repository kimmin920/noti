export type Template = {
    id: string;
    name: string;
    channel: 'SMS' | 'ALIMTALK';
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
    body: string;
    requiredVariables: string[];
    createdAt: string;
    updatedAt: string;
    providerTemplates?: Array<{
        id: string;
        providerStatus: string;
        templateCode?: string | null;
        nhnTemplateId?: string | null;
        kakaoTemplateCode?: string | null;
    }>;
};

export type EventRule = {
    id: string;
    eventKey: string;
    displayName: string;
    enabled: boolean;
    channelStrategy: 'SMS_ONLY' | 'ALIMTALK_ONLY' | 'ALIMTALK_THEN_SMS';
    messagePurpose?: 'NORMAL';
    requiredVariables: string[];
    smsTemplateId?: string;
    smsSenderNumberId?: string;
    alimtalkTemplateId?: string;
    alimtalkSenderProfileId?: string;
    updatedAt?: string;
    smsTemplate?: Template | null;
    smsSenderNumber?: SenderNumber | null;
    alimtalkTemplate?: {
        id: string;
        providerStatus: string;
        templateCode?: string | null;
        nhnTemplateId?: string | null;
        kakaoTemplateCode?: string | null;
    } | null;
    alimtalkSenderProfile?: SenderProfile | null;
};

export type SenderNumber = {
    id: string;
    phoneNumber: string;
    type: 'COMPANY' | 'EMPLOYEE';
    status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
    reviewMemo?: string;
    telecomCertificatePath?: string | null;
    consentDocumentPath?: string | null;
    thirdPartyBusinessRegistrationPath?: string | null;
    relationshipProofPath?: string | null;
    additionalDocumentPath?: string | null;
    employmentCertificatePath?: string | null;
};

export type NhnRegisteredSender = {
    serviceId: number | null;
    sendNo: string;
    useYn: 'Y' | 'N';
    blockYn: 'Y' | 'N';
    blockReason: string | null;
    createDate: string | null;
    updateDate: string | null;
    linkedToTenant: boolean;
    localSenderNumberId: string | null;
    localStatus: string | null;
    localType: string | null;
};

export type SenderProfile = {
    plusFriendId: string;
    senderKey: string;
    localSenderProfileId?: string;
    localStatus?: string;
    senderProfileType?: string;
    categoryCode?: string | null;
    status?: string | null;
    statusName?: string | null;
    kakaoStatus?: string | null;
    kakaoStatusName?: string | null;
    kakaoProfileStatus?: string | null;
    kakaoProfileStatusName?: string | null;
    profileSpamLevel?: string | null;
    profileMessageSpamLevel?: string | null;
    dormant?: boolean | null;
    block?: boolean | null;
    createDate?: string | null;
    initialUserRestriction?: boolean | null;
};

export type SenderProfilesResponse = {
    source: 'local' | 'nhn';
    totalCount: number;
    senders: SenderProfile[];
};

export type SenderProfileCategory = {
    parentCode: string | null;
    depth: number | null;
    code: string | null;
    name: string | null;
    subCategories: SenderProfileCategory[];
};

export type DefaultSenderGroupStatus = {
    configuredGroupKey: string | null;
    exists: boolean;
    group: {
        groupName: string | null;
        senderKey: string | null;
        status: string | null;
        senders: Array<{
            plusFriendId: string | null;
            senderKey: string | null;
            createDate: string | null;
        }>;
        createDate: string | null;
        updateDate: string | null;
    } | null;
    error?: string;
};

export type GroupTemplate = {
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
};

export type MessageLog = {
    id: string;
    source: 'MESSAGE_REQUEST' | 'BULK_SMS' | 'BULK_ALIMTALK';
    title: string;
    status: string;
    recipientPhone: string;
    createdAt: string;
    scheduledAt?: string | null;
    resolvedChannel: string | null;
    nhnRequestId?: string | null;
    totalRecipientCount?: number | null;
    lastErrorCode?: string | null;
    lastErrorMessage?: string | null;
    deliveryResults?: Array<{
        providerStatus: string;
        providerCode?: string | null;
        providerMessage?: string | null;
        createdAt: string;
    }>;
};

export type ViewerProfile = {
    tenantId: string;
    userId: string;
    providerUserId: string;
    email: string | null;
    loginProvider: 'GOOGLE_OAUTH' | 'PUBL_SSO' | 'LOCAL_PASSWORD';
    role: 'TENANT_ADMIN' | 'OPERATOR';
};

export type DashboardNotice = {
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

export type DashboardOverview = {
    account: {
        tenantId: string;
        tenantName: string;
        tenantStatus: 'ACTIVE' | 'SUSPENDED';
        tenantCreatedAt: string;
        userId: string;
        providerUserId: string;
        loginId: string | null;
        email: string | null;
        role: 'TENANT_ADMIN' | 'OPERATOR';
        loginProvider: 'GOOGLE_OAUTH' | 'PUBL_SSO' | 'LOCAL_PASSWORD';
        joinedAt: string;
    };
    balance: {
        autoRechargeEnabled: boolean;
        lowBalanceAlertEnabled: boolean;
    };
    sendQuota: {
        todaySent: number;
        dailyMax: number;
        remaining: number;
    };
    notices: DashboardNotice[];
};

export type ManagedUserStatus = 'ACTIVE' | 'INACTIVE' | 'DORMANT' | 'BLOCKED';

export type ManagedUserFieldType = 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'DATETIME' | 'JSON';

export type ManagedUserFieldDefinition = {
    key: string;
    label: string;
    kind: 'system' | 'custom';
    dataType: ManagedUserFieldType;
    importable: boolean;
    visibleByDefault: boolean;
};

export type ManagedUser = {
    id: string;
    source: string;
    externalId: string | null;
    name: string;
    email: string | null;
    phone: string | null;
    status: ManagedUserStatus;
    userType: string | null;
    segment: string | null;
    gradeOrLevel: string | null;
    marketingConsent: boolean | null;
    tags: string[];
    registeredAt: string | null;
    lastLoginAt: string | null;
    customAttributes: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
};

export type ManagedUsersSummary = {
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    dormantUsers: number;
    blockedUsers: number;
    sourceCount: number;
    customFieldCount: number;
};

export type ManagedUsersResponse = {
    fields: ManagedUserFieldDefinition[];
    users: ManagedUser[];
    summary: ManagedUsersSummary;
    sourceBreakdown: Array<{
        source: string;
        count: number;
    }>;
};

export type BulkSmsRecipient = {
    id: string;
    managedUserId: string | null;
    recipientPhone: string;
    recipientName: string | null;
    recipientSeq: string | null;
    recipientGroupingKey: string | null;
    status: 'REQUESTED' | 'ACCEPTED' | 'FAILED';
    providerResultCode: string | null;
    providerResultMessage: string | null;
    createdAt: string;
    updatedAt: string;
};

export type BulkSmsCampaign = {
    id: string;
    title: string;
    status: 'PROCESSING' | 'SENT_TO_PROVIDER' | 'PARTIAL_FAILED' | 'FAILED';
    body: string;
    scheduledAt: string | null;
    nhnRequestId: string | null;
    totalRecipientCount: number;
    acceptedCount: number;
    failedCount: number;
    skippedNoPhoneCount: number;
    duplicatePhoneCount: number;
    requestedBy: string | null;
    createdAt: string;
    updatedAt: string;
    senderNumber: SenderNumber;
    template: Template | null;
    recipients: BulkSmsRecipient[];
};

export type BulkSmsCampaignsResponse = {
    campaigns: BulkSmsCampaign[];
};

export type BulkAlimtalkRecipient = {
    id: string;
    managedUserId: string | null;
    recipientPhone: string;
    recipientName: string | null;
    recipientSeq: string | null;
    recipientGroupingKey: string | null;
    status: 'REQUESTED' | 'ACCEPTED' | 'FAILED';
    providerResultCode: string | null;
    providerResultMessage: string | null;
    createdAt: string;
    updatedAt: string;
};

export type BulkAlimtalkCampaign = {
    id: string;
    title: string;
    status: 'PROCESSING' | 'SENT_TO_PROVIDER' | 'PARTIAL_FAILED' | 'FAILED';
    templateSource: 'LOCAL' | 'GROUP';
    templateName: string;
    templateCode: string | null;
    body: string;
    scheduledAt: string | null;
    nhnRequestId: string | null;
    totalRecipientCount: number;
    acceptedCount: number;
    failedCount: number;
    skippedNoPhoneCount: number;
    duplicatePhoneCount: number;
    requestedBy: string | null;
    createdAt: string;
    updatedAt: string;
    senderProfile: SenderProfile;
    providerTemplate: {
        id: string;
        templateCode?: string | null;
        kakaoTemplateCode?: string | null;
        nhnTemplateId?: string | null;
        providerStatus: string;
        template: Template;
    } | null;
    recipients: BulkAlimtalkRecipient[];
};

export type BulkAlimtalkCampaignsResponse = {
    campaigns: BulkAlimtalkCampaign[];
};
