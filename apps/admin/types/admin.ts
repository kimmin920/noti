export type Template = {
    id: string;
    name: string;
    channel: 'SMS' | 'ALIMTALK';
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
    body: string;
    requiredVariables: string[];
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
    requiredVariables: string[];
    smsTemplateId?: string;
    smsSenderNumberId?: string;
    alimtalkTemplateId?: string;
    alimtalkSenderProfileId?: string;
};

export type SenderNumber = {
    id: string;
    phoneNumber: string;
    type: 'COMPANY' | 'EMPLOYEE';
    status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
    reviewMemo?: string;
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
    eventKey: string;
    status: string;
    recipientPhone: string;
    createdAt: string;
    resolvedChannel: string | null;
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
    publUserId: string;
    email: string | null;
    loginProvider: 'GOOGLE_OAUTH' | 'PUBL_SSO' | 'LOCAL_PASSWORD';
    role: 'TENANT_ADMIN' | 'OPERATOR';
};
