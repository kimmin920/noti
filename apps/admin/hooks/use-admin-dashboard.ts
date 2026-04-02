'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch, samplePayloads } from '@/lib/api';
import { getApiBase } from '@/lib/api-base';
import { isThirdPartyBusinessType } from '@/lib/sender-number';
import { classifyDomesticSmsBody } from '@/lib/sms-message-spec';
import { formatSmsBodyForAdvertisement, sanitizeAdvertisingServiceName } from '@/lib/sms-advertisement';
import { missingTemplateVariables, renderTemplatePreview } from '@/lib/template-variables';
import {
    Template,
    EventRule,
    SenderNumber,
    SenderProfile,
    SenderProfileCategory,
    DefaultSenderGroupStatus,
    GroupTemplate,
    MessageLog,
    BulkSmsCampaignsResponse,
    BulkAlimtalkCampaignsResponse,
    DashboardOverview,
    ViewerProfile
} from '@/types/admin';

function isSessionError(message: string) {
    return message.includes('Session cookie missing') || message.includes('Invalid session');
}

function flattenSenderProfileCategories(
    categories: SenderProfileCategory[],
    depth = 0,
    parentCode = ''
): Array<{ code: string; label: string }> {
    return categories.flatMap((category: any) => {
        if (!category.code || !category.name) {
            return flattenSenderProfileCategories(category.subCategories ?? [], depth + 1, parentCode);
        }
        const fullCode = `${parentCode}${category.code}`;
        const current = {
            code: fullCode,
            label: `${'· '.repeat(depth)}${category.name} (${fullCode})`
        };
        return [current, ...flattenSenderProfileCategories(category.subCategories ?? [], depth + 1, fullCode)];
    });
}

function extractTemplateVariables(body: string): string[] {
    const matches = [
        ...Array.from(body.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)),
        ...Array.from(body.matchAll(/#\{\s*([^}]+?)\s*\}/g))
    ]
        .map((match) => match[1]?.trim())
        .filter(Boolean) as string[];
    return [...new Set(matches)];
}

function normalizeEventToken(value: string): string {
    const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return normalized || 'custom_event';
}

function buildEventTestRequestExample(params: {
    tenantId?: string | null;
    eventKey: string;
    recipientPhone: string;
    recipientUserId: string;
    variables: Record<string, string>;
}) {
    const normalizedEventKey = normalizeEventToken(params.eventKey);
    const payload = {
        tenantId: params.tenantId || '<tenant_id>',
        eventKey: params.eventKey,
        recipient: {
            phone: params.recipientPhone.trim() || '<recipient_phone>',
            ...(params.recipientUserId.trim()
                ? { userId: params.recipientUserId.trim() }
                : { userId: '<publ_user_id>' })
        },
        variables: Object.fromEntries(
            Object.entries(params.variables).map(([key, value]) => [key, value.trim() || `<${key}>`])
        ),
        metadata: {
            publEventId: `evt_${normalizedEventKey}`,
            traceId: `trace_${normalizedEventKey}`
        }
    };

    return {
        endpoint: `${getApiBase()}/v1/message-requests`,
        idempotencyKey: `evt_${normalizedEventKey}_001`,
        payload
    };
}

export function useAdminDashboard() {
    const apiBase = getApiBase();
    const [me, setMe] = useState<ViewerProfile | null>(null);
    const [error, setError] = useState<string>('');
    const [loading, setLoading] = useState(true);

    // Data states
    const [templates, setTemplates] = useState<Template[]>([]);
    const [eventRules, setEventRules] = useState<EventRule[]>([]);
    const [senderNumbers, setSenderNumbers] = useState<SenderNumber[]>([]);
    const [senderProfiles, setSenderProfiles] = useState<SenderProfile[]>([]);
    const [senderProfileCategories, setSenderProfileCategories] = useState<SenderProfileCategory[]>([]);
    const [defaultSenderGroup, setDefaultSenderGroup] = useState<DefaultSenderGroupStatus | null>(null);
    const [defaultGroupTemplates, setDefaultGroupTemplates] = useState<GroupTemplate[]>([]);
    const [nhnRegisteredSenders, setNhnRegisteredSenders] = useState<any[]>([]);
    const [logs, setLogs] = useState<MessageLog[]>([]);
    const [dashboardOverview, setDashboardOverview] = useState<DashboardOverview | null>(null);

    // Auth states
    const [ssoToken, setSsoToken] = useState('');
    const [localLoginId, setLocalLoginId] = useState('');
    const [localPassword, setLocalPassword] = useState('');
    const [publServiceToken, setPublServiceToken] = useState('');

    // Form states
    const [templateForm, setTemplateForm] = useState({ channel: 'ALIMTALK', name: '', body: '' });
    const [eventRuleForm, setEventRuleForm] = useState({
        eventKey: 'PUBL_USER_SIGNUP',
        displayName: '회원 가입',
        enabled: true,
        channelStrategy: 'SMS_ONLY',
        messagePurpose: 'NORMAL',
        requiredVariables: 'username',
        smsTemplateId: '',
        smsSenderNumberId: '',
        alimtalkTemplateId: '',
        alimtalkSenderProfileId: ''
    });
    const [senderForm, setSenderForm] = useState({ phoneNumber: '', type: 'COMPANY' as 'COMPANY' | 'EMPLOYEE' });
    const [telecomFile, setTelecomFile] = useState<File | null>(null);
    const [consentFile, setConsentFile] = useState<File | null>(null);
    const [thirdPartyBusinessRegistrationFile, setThirdPartyBusinessRegistrationFile] = useState<File | null>(null);
    const [relationshipProofFile, setRelationshipProofFile] = useState<File | null>(null);
    const [additionalDocumentFile, setAdditionalDocumentFile] = useState<File | null>(null);
    const [showSenderProfileApply, setShowSenderProfileApply] = useState(false);
    const [senderProfileForm, setSenderProfileForm] = useState({
        plusFriendId: '',
        phoneNo: '',
        categoryCode: ''
    });
    const [senderProfileTokenForm, setSenderProfileTokenForm] = useState({
        plusFriendId: '',
        token: ''
    });
    const [applyingSenderProfile, setApplyingSenderProfile] = useState(false);
    const [verifyingSenderProfile, setVerifyingSenderProfile] = useState(false);
    const [syncingGroupSenderKeys, setSyncingGroupSenderKeys] = useState<string[]>([]);
    const [manualSmsForm, setManualSmsForm] = useState<{
        senderNumberId: string;
        recipientPhone: string;
        body: string;
        templateId: string;
        isAdvertisement: boolean;
        advertisingServiceName: string;
        mmsTitle: string;
        attachments: File[];
    }>({
        senderNumberId: '',
        recipientPhone: '',
        body: '',
        templateId: '',
        isAdvertisement: false,
        advertisingServiceName: '',
        mmsTitle: '',
        attachments: []
    });
    const [manualSmsVariables, setManualSmsVariables] = useState<Record<string, string>>({});
    const [manualAlimtalkForm, setManualAlimtalkForm] = useState({
        senderProfileId: '',
        providerTemplateId: '',
        recipientPhone: '',
        useSmsFailover: false,
        fallbackSenderNumberId: ''
    });
    const [manualAlimtalkVariables, setManualAlimtalkVariables] = useState<Record<string, string>>({});
    const [templateLibrarySearch, setTemplateLibrarySearch] = useState('');
    const [selectedTemplateLibraryKey, setSelectedTemplateLibraryKey] = useState('');
    const [showTemplateComposer, setShowTemplateComposer] = useState(false);
    const [sendingManualSms, setSendingManualSms] = useState(false);
    const [sendingManualAlimtalk, setSendingManualAlimtalk] = useState(false);
    const [sendingEventTest, setSendingEventTest] = useState(false);
    const [savingDashboardSettingKey, setSavingDashboardSettingKey] = useState<'autoRechargeEnabled' | 'lowBalanceAlertEnabled' | null>(null);
    const [selectedEventTestKey, setSelectedEventTestKey] = useState('');
    const [eventTestRecipientPhone, setEventTestRecipientPhone] = useState('');
    const [eventTestRecipientUserId, setEventTestRecipientUserId] = useState('');
    const [eventTestVariables, setEventTestVariables] = useState<Record<string, string>>({});

    function buildUnifiedLogs(params: {
        messageLogs: any[];
        bulkSmsCampaigns: BulkSmsCampaignsResponse['campaigns'];
        bulkAlimtalkCampaigns: BulkAlimtalkCampaignsResponse['campaigns'];
    }): MessageLog[] {
        const singleLogs: MessageLog[] = params.messageLogs.map((log: any) => ({
            id: `message:${log.id}`,
            source: 'MESSAGE_REQUEST',
            title: log.eventKey,
            status: log.status,
            recipientPhone: log.recipientPhone,
            createdAt: log.createdAt,
            scheduledAt: log.scheduledAt,
            resolvedChannel: log.resolvedChannel,
            nhnRequestId: log.nhnMessageId ?? null,
            totalRecipientCount: null,
            lastErrorCode: log.lastErrorCode,
            lastErrorMessage: log.lastErrorMessage,
            deliveryResults: log.deliveryResults
        }));

        const bulkSmsLogs: MessageLog[] = params.bulkSmsCampaigns.map((campaign) => ({
            id: `bulk-sms:${campaign.id}`,
            source: 'BULK_SMS',
            title: campaign.title,
            status: campaign.status,
            recipientPhone: `대상 ${campaign.totalRecipientCount}명`,
            createdAt: campaign.createdAt,
            scheduledAt: campaign.scheduledAt,
            resolvedChannel: 'SMS',
            nhnRequestId: campaign.nhnRequestId,
            totalRecipientCount: campaign.totalRecipientCount,
            lastErrorCode: campaign.failedCount > 0 ? String(campaign.failedCount) : null,
            lastErrorMessage:
                campaign.failedCount > 0
                    ? `성공 ${campaign.acceptedCount}건 · 실패 ${campaign.failedCount}건`
                    : campaign.nhnRequestId
                        ? `NHN 요청 ID ${campaign.nhnRequestId}`
                        : null,
            deliveryResults: []
        }));

        const bulkAlimtalkLogs: MessageLog[] = params.bulkAlimtalkCampaigns.map((campaign) => ({
            id: `bulk-alimtalk:${campaign.id}`,
            source: 'BULK_ALIMTALK',
            title: campaign.title,
            status: campaign.status,
            recipientPhone: `대상 ${campaign.totalRecipientCount}명`,
            createdAt: campaign.createdAt,
            scheduledAt: campaign.scheduledAt,
            resolvedChannel: 'ALIMTALK',
            nhnRequestId: campaign.nhnRequestId,
            totalRecipientCount: campaign.totalRecipientCount,
            lastErrorCode: campaign.failedCount > 0 ? String(campaign.failedCount) : null,
            lastErrorMessage:
                campaign.failedCount > 0
                    ? `성공 ${campaign.acceptedCount}건 · 실패 ${campaign.failedCount}건`
                    : campaign.nhnRequestId
                        ? `NHN 요청 ID ${campaign.nhnRequestId}`
                        : null,
            deliveryResults: []
        }));

        return [...singleLogs, ...bulkSmsLogs, ...bulkAlimtalkLogs].sort(
            (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
        );
    }

    // Derived memos
    const smsTemplates = useMemo(() => templates.filter((t: any) => t.channel === 'SMS'), [templates]);
    const approvedSenderNumbers = useMemo(
        () => senderNumbers.filter((sender: any) => sender.status === 'APPROVED'),
        [senderNumbers]
    );
    const alimtalkProviders = useMemo(
        () => templates.filter((t: any) => t.channel === 'ALIMTALK' && t.providerTemplates?.some((p: any) => p.providerStatus === 'APR')),
        [templates]
    );
    const senderProfileCategoryOptions = useMemo(
        () => flattenSenderProfileCategories(senderProfileCategories),
        [senderProfileCategories]
    );
    const defaultGroupMemberSenderKeys = useMemo(
        () => new Set((defaultSenderGroup?.group?.senders ?? []).map((sender: any) => sender.senderKey).filter(Boolean)),
        [defaultSenderGroup]
    );
    const senderProfilesWithStatus = useMemo(
        () => senderProfiles.filter((profile: any) => profile.localSenderProfileId),
        [senderProfiles]
    );
    const readySenderProfiles = useMemo(
        () =>
            senderProfilesWithStatus.filter(
                (profile: any) =>
                    profile.localSenderProfileId &&
                    !profile.block &&
                    !profile.dormant &&
                    (profile.localStatus === 'ACTIVE' || profile.status === 'YSC03')
            ),
        [senderProfilesWithStatus]
    );

    const activeSenderProfiles = useMemo(
        () =>
            senderProfiles.filter(
                (profile: any) =>
                    profile.status === 'YSC03' &&
                    (profile.kakaoProfileStatus === 'A' || profile.kakaoProfileStatus === null || profile.kakaoProfileStatus === undefined)
            ),
        [senderProfiles]
    );
    const pendingSenderProfiles = useMemo(
        () => senderProfiles.filter((profile: any) => profile.status === 'YSC02' || profile.localStatus === 'UNKNOWN'),
        [senderProfiles]
    );
    const blockedSenderProfiles = useMemo(
        () => senderProfiles.filter((profile: any) => profile.block || profile.kakaoProfileStatus === 'B' || profile.localStatus === 'BLOCKED'),
        [senderProfiles]
    );

    const alimtalkTemplateOptions = useMemo(
        () => {
            const localOptions = templates
                .filter((template: any) => template.channel === 'ALIMTALK')
                .map((template: any) => {
                    const approvedProvider = template.providerTemplates?.find((provider: any) => provider.providerStatus === 'APR');
                    if (!approvedProvider) return null;
                    return {
                        selectionKey: `local:${approvedProvider.id}`,
                        source: 'LOCAL' as const,
                        templateName: template.name,
                        providerTemplateId: approvedProvider.id,
                        templateCode: approvedProvider.templateCode ?? approvedProvider.kakaoTemplateCode ?? approvedProvider.nhnTemplateId ?? null,
                        templateBody: template.body,
                        requiredVariables: template.requiredVariables,
                        providerStatus: approvedProvider.providerStatus,
                        ownerLabel: '개별 템플릿'
                    };
                })
                .filter(Boolean);

            const groupOptions = defaultGroupTemplates
                .filter((template: any) => template.status === 'TSC03' || template.statusName === '승인')
                .map((template: any) => ({
                    selectionKey: `group:${template.templateCode || template.kakaoTemplateCode || template.templateName || 'group-template'}`,
                    source: 'GROUP' as const,
                    templateName: template.templateName || template.templateCode || template.kakaoTemplateCode || '이름 없는 그룹 템플릿',
                    providerTemplateId: null,
                    templateCode: template.templateCode || template.kakaoTemplateCode,
                    templateBody: template.templateContent || null,
                    requiredVariables: extractTemplateVariables(template.templateContent || ''),
                    providerStatus: template.status,
                    ownerLabel: defaultSenderGroup?.group?.groupName || 'PUBL 그룹'
                }));

            return [...localOptions, ...groupOptions] as any[];
        },
        [defaultGroupTemplates, defaultSenderGroup, templates]
    );

    const alimtalkTemplateLibrary = useMemo(
        () => {
            const localTemplates = templates
                .filter((template: any) => template.channel === 'ALIMTALK')
                .map((template: any) => {
                    const preferredProvider =
                        template.providerTemplates?.find((provider: any) => provider.providerStatus === 'APR') ?? template.providerTemplates?.[0] ?? null;
                    return {
                        key: `local:${template.id}`,
                        source: 'LOCAL' as const,
                        name: template.name,
                        body: template.body,
                        createdAt: null,
                        updatedAt: null,
                        lifecycleStatus: template.status,
                        providerStatus: preferredProvider?.providerStatus ?? null,
                        templateCode: preferredProvider?.templateCode ?? preferredProvider?.nhnTemplateId ?? null,
                        kakaoTemplateCode: preferredProvider?.kakaoTemplateCode ?? null,
                        requiredVariables: template.requiredVariables,
                        messageType: 'TEXT',
                        ownerLabel: '개별 채널 템플릿',
                        ownerKey: null,
                        templateId: template.id,
                        providerTemplateId: preferredProvider?.id ?? null
                    };
                });

            const groupTemplates = defaultGroupTemplates.map((template: any, index: number) => ({
                key: `group:${template.templateCode || template.kakaoTemplateCode || `${template.templateName || 'group'}_${index}`}`,
                source: 'GROUP' as const,
                name: template.templateName || template.templateCode || template.kakaoTemplateCode || '이름 없는 그룹 템플릿',
                body: template.templateContent || '',
                createdAt: template.createDate,
                updatedAt: template.updateDate,
                lifecycleStatus: null,
                providerStatus: template.status,
                templateCode: template.templateCode,
                kakaoTemplateCode: template.kakaoTemplateCode,
                requiredVariables: extractTemplateVariables(template.templateContent || ''),
                messageType: template.templateMessageType,
                ownerLabel: defaultSenderGroup?.group?.groupName || 'PUBL 그룹 템플릿',
                ownerKey: defaultSenderGroup?.group?.senderKey || defaultSenderGroup?.configuredGroupKey || null,
                templateId: null,
                providerTemplateId: null
            }));

            return [...groupTemplates, ...localTemplates];
        },
        [defaultGroupTemplates, defaultSenderGroup, templates]
    );

    const filteredAlimtalkTemplateLibrary = useMemo(() => {
        const keyword = templateLibrarySearch.trim().toLowerCase();
        if (!keyword) return alimtalkTemplateLibrary;
        return alimtalkTemplateLibrary.filter((template: any) =>
            [template.name, template.body, template.templateCode, template.kakaoTemplateCode, template.ownerLabel]
                .filter(Boolean)
                .some((value) => value?.toLowerCase().includes(keyword))
        );
    }, [alimtalkTemplateLibrary, templateLibrarySearch]);

    const selectedAlimtalkTemplate = useMemo(
        () => filteredAlimtalkTemplateLibrary.find((template: any) => template.key === selectedTemplateLibraryKey) ?? null,
        [filteredAlimtalkTemplateLibrary, selectedTemplateLibraryKey]
    );

    const selectedManualSenderProfile = useMemo(
        () => senderProfilesWithStatus.find((profile: any) => profile.localSenderProfileId === manualAlimtalkForm.senderProfileId) ?? null,
        [manualAlimtalkForm.senderProfileId, senderProfilesWithStatus]
    );
    const canUseDefaultGroupTemplates = useMemo(
        () => !!selectedManualSenderProfile?.senderKey && defaultGroupMemberSenderKeys.has(selectedManualSenderProfile.senderKey),
        [defaultGroupMemberSenderKeys, selectedManualSenderProfile]
    );
    const directAlimtalkTemplateOptions = useMemo(
        () =>
            alimtalkTemplateOptions.filter((option: any) => option.source === 'LOCAL').concat(
                canUseDefaultGroupTemplates ? alimtalkTemplateOptions.filter((option: any) => option.source === 'GROUP') : []
            ),
        [alimtalkTemplateOptions, canUseDefaultGroupTemplates]
    );
    const selectedDirectAlimtalkTemplate = useMemo(
        () => directAlimtalkTemplateOptions.find((template: any) => template.selectionKey === manualAlimtalkForm.providerTemplateId) ?? null,
        [directAlimtalkTemplateOptions, manualAlimtalkForm.providerTemplateId]
    );
    const directSmsTemplateOptions = useMemo(
        () => smsTemplates.filter((template: any) => template.status !== 'ARCHIVED'),
        [smsTemplates]
    );
    const selectedManualSmsTemplate = useMemo(
        () => directSmsTemplateOptions.find((template: any) => template.id === manualSmsForm.templateId) ?? null,
        [directSmsTemplateOptions, manualSmsForm.templateId]
    );
    const renderedManualSmsBody = useMemo(() => {
        if (!selectedManualSmsTemplate) {
            return manualSmsForm.body;
        }

        return renderTemplatePreview(selectedManualSmsTemplate.body, manualSmsVariables);
    }, [manualSmsForm.body, manualSmsVariables, selectedManualSmsTemplate]);
    const formattedManualSmsBody = useMemo(
        () =>
            formatSmsBodyForAdvertisement(renderedManualSmsBody, {
                isAdvertisement: manualSmsForm.isAdvertisement,
                advertisingServiceName: manualSmsForm.advertisingServiceName
            }),
        [manualSmsForm.advertisingServiceName, manualSmsForm.isAdvertisement, renderedManualSmsBody]
    );

    const selectedEventTestRule = useMemo(
        () => eventRules.find((rule) => rule.eventKey === selectedEventTestKey) ?? null,
        [eventRules, selectedEventTestKey]
    );
    const eventTestRequestExample = useMemo(() => {
        if (!selectedEventTestRule) {
            return null;
        }

        return buildEventTestRequestExample({
            tenantId: me?.tenantId ?? null,
            eventKey: selectedEventTestRule.eventKey,
            recipientPhone: eventTestRecipientPhone,
            recipientUserId: eventTestRecipientUserId,
            variables: Object.fromEntries(
                selectedEventTestRule.requiredVariables.map((variable) => [variable, eventTestVariables[variable] ?? ''])
            )
        });
    }, [eventTestRecipientPhone, eventTestRecipientUserId, eventTestVariables, me?.tenantId, selectedEventTestRule]);

    // Methods
    async function refreshSenderProfiles() {
        const [localProfiles, categories, groupStatus, groupTemplates] = await Promise.all([
            apiFetch<any>('/v1/sender-profiles'),
            apiFetch<any>('/v1/sender-profiles/categories'),
            apiFetch<any>('/v1/sender-profiles/default-group/status'),
            apiFetch<any>('/v1/sender-profiles/default-group/templates')
        ]);

        const hydratedProfiles = await Promise.all(
            localProfiles.senders.map(async (profile: any) => {
                if (!profile.senderKey) return profile;
                try {
                    return await apiFetch<any>(`/v1/sender-profiles/${profile.senderKey}`);
                } catch {
                    return profile;
                }
            })
        );

        setSenderProfiles(hydratedProfiles);
        setSenderProfileCategories(categories);
        setDefaultSenderGroup(groupStatus);
        setDefaultGroupTemplates(groupTemplates.templates);
    }

    async function refreshAll() {
        setLoading(true);
        setError('');
        try {
            const authMe = await apiFetch<any>('/v1/auth/me');
            setMe(authMe);
            if (authMe.role === 'OPERATOR') {
                setTemplates([]); setEventRules([]); setSenderNumbers([]); setLogs([]); setDashboardOverview(null); return;
            }
            const [overview, templateRows, eventRuleRows, senderRows, nhnRegisteredRows, logRows, bulkSmsCampaigns, bulkAlimtalkCampaigns] = await Promise.all([
                apiFetch<DashboardOverview>('/v1/dashboard/overview'),
                apiFetch<any[]>('/v1/templates'),
                apiFetch<any[]>('/v1/event-rules'),
                apiFetch<any[]>('/v1/sender-numbers'),
                apiFetch<any[]>('/v1/admin/sender-number-reviews/nhn-registered'),
                apiFetch<any[]>('/v1/admin/message-requests'),
                apiFetch<BulkSmsCampaignsResponse>('/v1/bulk-sms/campaigns'),
                apiFetch<BulkAlimtalkCampaignsResponse>('/v1/bulk-alimtalk/campaigns')
            ]);
            await refreshSenderProfiles();
            setDashboardOverview(overview);
            setTemplates(templateRows);
            setEventRules(eventRuleRows);
            setSenderNumbers(senderRows);
            setNhnRegisteredSenders(nhnRegisteredRows);
            setLogs(
                buildUnifiedLogs({
                    messageLogs: logRows,
                    bulkSmsCampaigns: bulkSmsCampaigns.campaigns,
                    bulkAlimtalkCampaigns: bulkAlimtalkCampaigns.campaigns
                })
            );
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            setMe(null);
            setTemplates([]);
            setEventRules([]);
            setSenderNumbers([]);
            setSenderProfiles([]);
            setSenderProfileCategories([]);
            setDefaultSenderGroup(null);
            setDefaultGroupTemplates([]);
            setNhnRegisteredSenders([]);
            setLogs([]);
            setDashboardOverview(null);
            setError(isSessionError(message) ? '' : message);
        } finally {
            setLoading(false);
        }
    }

    async function refreshLogs() {
        if (!me || me.role === 'OPERATOR') return;
        const [logRows, bulkSmsCampaigns, bulkAlimtalkCampaigns] = await Promise.all([
            apiFetch<any[]>('/v1/admin/message-requests'),
            apiFetch<BulkSmsCampaignsResponse>('/v1/bulk-sms/campaigns'),
            apiFetch<BulkAlimtalkCampaignsResponse>('/v1/bulk-alimtalk/campaigns')
        ]);
        setLogs(
            buildUnifiedLogs({
                messageLogs: logRows,
                bulkSmsCampaigns: bulkSmsCampaigns.campaigns,
                bulkAlimtalkCampaigns: bulkAlimtalkCampaigns.campaigns
            })
        );
    }

    async function waitForRequestResult(requestId: string) {
        const terminal = new Set(['DELIVERED', 'DELIVERY_FAILED', 'SEND_FAILED', 'CANCELED', 'DEAD']);
        for (let attempt = 0; attempt < 15; attempt += 1) {
            await new Promise((resolve) => window.setTimeout(resolve, 1000));
            const detail = await apiFetch<any>(`/v1/admin/message-requests/${requestId}`);
            await refreshLogs();
            if (terminal.has(detail.status)) {
                if (detail.status !== 'DELIVERED' && detail.lastErrorMessage) {
                    setError(`${detail.status}: ${detail.lastErrorMessage}`);
                }
                return;
            }
        }
    }

    // Handlers
    async function exchangeSso() {
        if (!ssoToken) { setError('SSO JWT를 입력하세요.'); return; }
        setError('');
        try {
            await apiFetch('/v1/auth/sso/exchange', { method: 'POST', headers: { Authorization: `Bearer ${ssoToken}` } });
            await refreshAll();
        } catch (e) { setError(e instanceof Error ? e.message : 'SSO exchange failed'); }
    }

    async function loginWithPassword() {
        if (!localLoginId || !localPassword) { setError('ID와 비밀번호를 입력하세요.'); return; }
        setError('');
        try {
            await apiFetch('/v1/auth/password/login', { method: 'POST', body: JSON.stringify({ loginId: localLoginId, password: localPassword }) });
            await refreshAll();
        } catch (e) { setError(e instanceof Error ? e.message : 'Login failed'); }
    }

    function startGoogleLogin() {
        const url = new URL(`${apiBase}/v1/auth/google/start`);
        url.searchParams.set('returnTo', window.location.href);
        window.location.href = url.toString();
    }

    async function createTemplate() {
        try {
            setError('');
            await apiFetch('/v1/templates', { method: 'POST', body: JSON.stringify(templateForm) });
            setTemplateForm({ channel: 'ALIMTALK', name: '', body: '' });
            setShowTemplateComposer(false);
            await refreshAll();
        } catch (e) { setError(e instanceof Error ? e.message : 'Template create failed'); }
    }

    async function previewTemplate(templateId: string) {
        const raw = window.prompt('미리보기 변수 JSON', '{"username":"민우","ticketName":"VIP","amount":"39000"}');
        if (!raw) return;
        try {
            const parsed = JSON.parse(raw);
            const result = await apiFetch<{ rendered: string }>(`/v1/templates/${templateId}/preview`, { method: 'POST', body: JSON.stringify({ variables: parsed }) });
            window.alert(result.rendered);
        } catch (e) { setError(e instanceof Error ? e.message : 'Preview failed'); }
    }

    async function updateTemplate(template: any) {
        const nextBody = window.prompt('템플릿 본문 수정', template.body);
        if (nextBody === null) return;
        try {
            await apiFetch(`/v1/templates/${template.id}`, { method: 'PUT', body: JSON.stringify({ body: nextBody }) });
            await refreshAll();
        } catch (e) { setError(e instanceof Error ? e.message : 'Template update failed'); }
    }

    async function syncTemplate(templateId: string) {
        await apiFetch(`/v1/templates/${templateId}/nhn-sync`, { method: 'POST' });
        await refreshAll();
    }

    async function upsertRule() {
        try {
            await apiFetch('/v1/event-rules/upsert', {
                method: 'POST',
                body: JSON.stringify({
                    ...eventRuleForm,
                    requiredVariables: eventRuleForm.requiredVariables.split(',').map((v: string) => v.trim()).filter(Boolean)
                })
            });
            await refreshAll();
        } catch (e) { setError(e instanceof Error ? e.message : 'Rule update failed'); }
    }

    function setEventRuleChannelStrategy(channelStrategy: 'SMS_ONLY' | 'ALIMTALK_ONLY' | 'ALIMTALK_THEN_SMS') {
        setEventRuleForm((current) => {
            if (channelStrategy === 'SMS_ONLY') {
                return {
                    ...current,
                    channelStrategy,
                    alimtalkTemplateId: '',
                    alimtalkSenderProfileId: ''
                };
            }

            if (channelStrategy === 'ALIMTALK_ONLY') {
                return {
                    ...current,
                    channelStrategy,
                    smsTemplateId: '',
                    smsSenderNumberId: ''
                };
            }

            return {
                ...current,
                channelStrategy
            };
        });
    }

    function selectEventRuleSmsTemplate(templateId: string) {
        const template = smsTemplates.find((item) => item.id === templateId);
        setEventRuleForm((current) => ({
            ...current,
            smsTemplateId: templateId,
            requiredVariables: template?.requiredVariables?.join(', ') || current.requiredVariables
        }));
    }

    function selectEventRuleAlimtalkTemplate(providerTemplateId: string) {
        const template = alimtalkProviders.find((item) =>
            item.providerTemplates?.some((providerTemplate: any) => providerTemplate.id === providerTemplateId)
        );

        setEventRuleForm((current) => ({
            ...current,
            alimtalkTemplateId: providerTemplateId,
            requiredVariables: template?.requiredVariables?.join(', ') || current.requiredVariables
        }));
    }

    function updateEventTestVariable(variableName: string, value: string) {
        setEventTestVariables((current) => ({
            ...current,
            [variableName]: value
        }));
    }

    async function executeEventTest() {
        if (!selectedEventTestRule) {
            setError('실행할 이벤트를 선택하세요.');
            return;
        }

        if (!selectedEventTestRule.enabled) {
            setError('비활성화된 이벤트는 테스트 발송할 수 없습니다.');
            return;
        }

        if (!me?.tenantId) {
            setError('현재 tenant 정보를 확인할 수 없습니다.');
            return;
        }

        const recipientPhone = eventTestRecipientPhone.trim();
        if (!recipientPhone) {
            setError('테스트 수신번호를 입력하세요.');
            return;
        }

        const missingVariables = selectedEventTestRule.requiredVariables.filter((variable) => !(eventTestVariables[variable] || '').trim());
        if (missingVariables.length > 0) {
            setError(`필수 변수 값을 입력하세요: ${missingVariables.join(', ')}`);
            return;
        }

        const normalizedEventKey = normalizeEventToken(selectedEventTestRule.eventKey);
        const timestamp = Date.now();
        const idempotency = `evt_${normalizedEventKey}_${timestamp}`;
        const payload = {
            tenantId: me.tenantId,
            eventKey: selectedEventTestRule.eventKey,
            recipient: {
                phone: recipientPhone,
                ...(eventTestRecipientUserId.trim() ? { userId: eventTestRecipientUserId.trim() } : {})
            },
            variables: Object.fromEntries(
                selectedEventTestRule.requiredVariables.map((variable) => [variable, eventTestVariables[variable].trim()])
            ),
            metadata: {
                publEventId: `evt_${normalizedEventKey}_${timestamp}`,
                traceId: `trace_${normalizedEventKey}_${timestamp}`
            }
        };

        try {
            setSendingEventTest(true);
            setError('');
            const response = await apiFetch<{ requestId: string }>('/v1/message-requests', {
                method: 'POST',
                headers: { 'Idempotency-Key': idempotency, ...(publServiceToken ? { Authorization: `Bearer ${publServiceToken}` } : {}) },
                body: JSON.stringify(payload)
            });
            await refreshAll();
            await waitForRequestResult(response.requestId);
        } catch (e) { setError(e instanceof Error ? e.message : 'Event test failed'); }
        finally { setSendingEventTest(false); }
    }

    async function applySenderNumber() {
        const normalizedPhoneNumber = senderForm.phoneNumber.trim();

        if (!normalizedPhoneNumber) {
            setError('발신번호를 입력하세요.');
            return;
        }

        if (!telecomFile) {
            setError('통신서비스 이용증명원을 첨부하세요.');
            return;
        }

        if (!consentFile) {
            setError('이용승낙서를 첨부하세요.');
            return;
        }

        if (isThirdPartyBusinessType(senderForm.type)) {
            if (!thirdPartyBusinessRegistrationFile) {
                setError('번호 명의 사업자등록증을 첨부하세요.');
                return;
            }

            if (!relationshipProofFile) {
                setError('관계 확인 문서를 첨부하세요.');
                return;
            }
        }

        const formData = new FormData();
        formData.append('phoneNumber', normalizedPhoneNumber);
        formData.append('type', senderForm.type);
        if (telecomFile) formData.append('telecomCertificate', telecomFile);
        if (consentFile) formData.append('consentDocument', consentFile);
        if (thirdPartyBusinessRegistrationFile) {
            formData.append('thirdPartyBusinessRegistration', thirdPartyBusinessRegistrationFile);
        }
        if (relationshipProofFile) {
            formData.append('relationshipProof', relationshipProofFile);
        }
        if (additionalDocumentFile) {
            formData.append('additionalDocument', additionalDocumentFile);
        }

        setError('');
        const response = await fetch(`${apiBase}/v1/sender-numbers/apply`, { method: 'POST', credentials: 'include', body: formData });
        if (!response.ok) { setError(await response.text()); return; }
        setSenderForm({ phoneNumber: '', type: 'COMPANY' });
        setTelecomFile(null);
        setConsentFile(null);
        setThirdPartyBusinessRegistrationFile(null);
        setRelationshipProofFile(null);
        setAdditionalDocumentFile(null);
        await refreshAll();
    }

    async function applySenderProfile() {
        if (!senderProfileForm.plusFriendId || !senderProfileForm.phoneNo || !senderProfileForm.categoryCode) {
            setError('모든 정보를 입력하세요.'); return;
        }
        try {
            setApplyingSenderProfile(true); setError('');
            await apiFetch('/v1/sender-profiles/apply', { method: 'POST', body: JSON.stringify(senderProfileForm) });
            setSenderProfileTokenForm((p) => ({ ...p, plusFriendId: senderProfileForm.plusFriendId }));
            await refreshSenderProfiles();
        } catch (e) { setError(e instanceof Error ? e.message : '신청 실패'); } finally { setApplyingSenderProfile(false); }
    }

    async function verifySenderProfileToken() {
        if (!senderProfileTokenForm.plusFriendId || !senderProfileTokenForm.token) { setError('ID와 토큰을 입력하세요.'); return; }
        try {
            setVerifyingSenderProfile(true); setError('');
            await apiFetch('/v1/sender-profiles/token', {
                method: 'POST',
                body: JSON.stringify({ plusFriendId: senderProfileTokenForm.plusFriendId, token: Number(senderProfileTokenForm.token) })
            });
            setSenderProfileTokenForm({ plusFriendId: '', token: '' });
            await refreshSenderProfiles();
        } catch (e) { setError(e instanceof Error ? e.message : '인증 실패'); } finally { setVerifyingSenderProfile(false); }
    }

    async function syncApprovedNumbers() {
        await apiFetch('/v1/admin/sender-number-reviews/sync', { method: 'POST' });
        await refreshAll();
    }

    async function updateDashboardSettings(patch: {
        autoRechargeEnabled?: boolean;
        lowBalanceAlertEnabled?: boolean;
    }) {
        const key =
            patch.autoRechargeEnabled !== undefined
                ? 'autoRechargeEnabled'
                : patch.lowBalanceAlertEnabled !== undefined
                    ? 'lowBalanceAlertEnabled'
                    : null;

        if (!key) return;

        try {
            setSavingDashboardSettingKey(key);
            setError('');
            const next = await apiFetch<DashboardOverview['balance']>('/v1/dashboard/settings', {
                method: 'POST',
                body: JSON.stringify(patch)
            });
            setDashboardOverview((current) =>
                current
                    ? {
                        ...current,
                        balance: {
                            ...current.balance,
                            ...next
                        }
                    }
                    : current
            );
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Dashboard settings update failed');
        } finally {
            setSavingDashboardSettingKey(null);
        }
    }

    async function sendDirectSms(scheduledAt?: string | null) {
        const body =
            selectedManualSmsTemplate
                ? renderTemplatePreview(
                    selectedManualSmsTemplate.body,
                    Object.fromEntries(
                        Object.entries(manualSmsVariables).map(([key, value]) => [key, value.trim()])
                    )
                )
                : manualSmsForm.body.trim();
        const finalBody = formatSmsBodyForAdvertisement(body, {
            isAdvertisement: manualSmsForm.isAdvertisement,
            advertisingServiceName: manualSmsForm.advertisingServiceName
        });
        const advertisingServiceName = sanitizeAdvertisingServiceName(manualSmsForm.advertisingServiceName);

        if (!manualSmsForm.senderNumberId || !manualSmsForm.recipientPhone || !finalBody.trim()) {
            setError('발신/수신번호 및 본문을 입력하세요.'); return;
        }

        if (selectedManualSmsTemplate) {
            const missing = missingTemplateVariables(
                selectedManualSmsTemplate.requiredVariables,
                Object.fromEntries(Object.entries(manualSmsVariables).map(([key, value]) => [key, value.trim()]))
            );
            if (missing.length > 0) {
                setError(`템플릿 변수 값을 입력하세요: ${missing.join(', ')}`);
                return;
            }
        }

        const smsMessageType = classifyDomesticSmsBody(finalBody, {
            hasAttachments: manualSmsForm.attachments.length > 0
        });

        if (smsMessageType === 'OVER_LIMIT') {
            setError(
                manualSmsForm.attachments.length > 0
                    ? '이미지를 첨부한 MMS 본문은 2,000byte 이하로 입력하세요.'
                    : '본문이 SMS/LMS 표준 규격 2,000byte를 초과했습니다.'
            );
            return;
        }
        try {
            setSendingManualSms(true); setError('');
            const formData = new FormData();
            formData.append('senderNumberId', manualSmsForm.senderNumberId);
            formData.append('recipientPhone', manualSmsForm.recipientPhone);
            formData.append('body', body);
            formData.append('isAdvertisement', String(manualSmsForm.isAdvertisement));
            if (advertisingServiceName) {
                formData.append('advertisingServiceName', advertisingServiceName);
            }
            if (manualSmsForm.mmsTitle.trim()) {
                formData.append('mmsTitle', manualSmsForm.mmsTitle.trim());
            }
            if (scheduledAt) {
                formData.append('scheduledAt', scheduledAt);
            }
            manualSmsForm.attachments.forEach((attachment) => {
                formData.append('attachments', attachment);
            });

            const rawResponse = await fetch(`${apiBase}/v1/message-requests/manual-sms`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            if (!rawResponse.ok) {
                const rawText = await rawResponse.text();
                let message = rawText || `HTTP ${rawResponse.status}`;

                if (rawText) {
                    try {
                        const parsed = JSON.parse(rawText) as { message?: string | string[]; error?: string };
                        if (Array.isArray(parsed.message) && parsed.message.length > 0) {
                            message = parsed.message.join(', ');
                        } else if (typeof parsed.message === 'string' && parsed.message.trim()) {
                            message = parsed.message;
                        } else if (typeof parsed.error === 'string' && parsed.error.trim()) {
                            message = parsed.error;
                        }
                    } catch {
                        // Keep the raw response text when the server does not return JSON.
                    }
                }

                throw new Error(message);
            }

            const response = await rawResponse.json() as { requestId: string };
            setManualSmsForm((p) => ({
                ...p,
                recipientPhone: '',
                body: p.templateId ? p.body : '',
                mmsTitle: '',
                attachments: []
            }));
            if (selectedManualSmsTemplate) {
                setManualSmsVariables(
                    Object.fromEntries(
                        selectedManualSmsTemplate.requiredVariables.map((variable: string) => [variable, ''])
                    )
                );
            }
            await refreshAll();
            if (!scheduledAt) {
                await waitForRequestResult(response.requestId);
            }
        } catch (e) { setError(e instanceof Error ? e.message : 'SMS send failed'); } finally { setSendingManualSms(false); }
    }

    async function sendDirectAlimtalk(scheduledAt?: string | null) {
        if (!manualAlimtalkForm.senderProfileId || !manualAlimtalkForm.providerTemplateId || !manualAlimtalkForm.recipientPhone) {
            setError('정보를 모두 입력하세요.'); return;
        }
        if (manualAlimtalkForm.useSmsFailover && !manualAlimtalkForm.fallbackSenderNumberId) {
            setError('SMS 대체 발송용 발신 번호를 선택하세요.'); return;
        }
        try {
            setSendingManualAlimtalk(true); setError('');
            const selectedTemplate = directAlimtalkTemplateOptions.find((t: any) => t.selectionKey === manualAlimtalkForm.providerTemplateId);
            if (!selectedTemplate) throw new Error('템플릿을 찾을 수 없습니다.');
            const parsedVariables = Object.fromEntries(Object.entries(manualAlimtalkVariables).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v.length > 0));

            const response = await apiFetch<any>('/v1/message-requests/manual-alimtalk', {
                method: 'POST',
                body: JSON.stringify({
                    senderProfileId: manualAlimtalkForm.senderProfileId,
                    ...(selectedTemplate.source === 'LOCAL'
                        ? { providerTemplateId: selectedTemplate.providerTemplateId, templateSource: 'LOCAL' }
                        : { templateSource: 'GROUP', templateCode: selectedTemplate.templateCode, templateName: selectedTemplate.templateName, templateBody: selectedTemplate.templateBody, requiredVariables: selectedTemplate.requiredVariables }),
                    recipientPhone: manualAlimtalkForm.recipientPhone,
                    useSmsFailover: manualAlimtalkForm.useSmsFailover,
                    fallbackSenderNumberId: manualAlimtalkForm.useSmsFailover ? manualAlimtalkForm.fallbackSenderNumberId : undefined,
                    variables: parsedVariables,
                    scheduledAt: scheduledAt || undefined
                })
            });
            setManualAlimtalkForm((p) => ({ ...p, recipientPhone: '' }));
            setManualAlimtalkVariables(p => Object.fromEntries(Object.keys(p).map(k => [k, ''])));
            await refreshAll();
            if (!scheduledAt) {
                await waitForRequestResult(response.requestId);
            }
        } catch (e) { setError(e instanceof Error ? e.message : 'AlimTalk send failed'); } finally { setSendingManualAlimtalk(false); }
    }

    async function syncSenderToDefaultGroup(senderKey: string) {
        try {
            setSyncingGroupSenderKeys((p) => [...p, senderKey]); setError('');
            await apiFetch(`/v1/sender-profiles/${senderKey}/default-group-sync`, { method: 'POST' });
            await refreshSenderProfiles();
        } catch (e) { setError(e instanceof Error ? e.message : '동기화 실패'); }
        finally { setSyncingGroupSenderKeys((p) => p.filter((k) => k !== senderKey)); }
    }

    function focusSenderProfileCenter() {
        document.getElementById('senders')?.scrollIntoView({ behavior: 'smooth' });
    }

    // Initial load and effects
    useEffect(() => { refreshAll().catch(() => undefined); }, []);

    useEffect(() => {
        if (approvedSenderNumbers.length > 0 && !manualSmsForm.senderNumberId) {
            setManualSmsForm(p => ({ ...p, senderNumberId: approvedSenderNumbers[0].id }));
        }
    }, [approvedSenderNumbers]);

    useEffect(() => {
        const requiredVariables = selectedManualSmsTemplate?.requiredVariables ?? [];
        setManualSmsVariables((current) =>
            Object.fromEntries(requiredVariables.map((variable: string) => [variable, current[variable] ?? '']))
        );
    }, [selectedManualSmsTemplate]);

    useEffect(() => {
        if (approvedSenderNumbers.length === 0 && (manualAlimtalkForm.useSmsFailover || manualAlimtalkForm.fallbackSenderNumberId)) {
            setManualAlimtalkForm(p => ({
                ...p,
                useSmsFailover: false,
                fallbackSenderNumberId: ''
            }));
            return;
        }

        if (approvedSenderNumbers.length > 0 && !manualAlimtalkForm.fallbackSenderNumberId) {
            setManualAlimtalkForm(p => ({ ...p, fallbackSenderNumberId: approvedSenderNumbers[0].id }));
        }
    }, [approvedSenderNumbers, manualAlimtalkForm.useSmsFailover, manualAlimtalkForm.fallbackSenderNumberId]);

    useEffect(() => {
        if (readySenderProfiles.length > 0 && !manualAlimtalkForm.senderProfileId) {
            setManualAlimtalkForm(p => ({ ...p, senderProfileId: readySenderProfiles[0].localSenderProfileId || '' }));
        }
    }, [readySenderProfiles]);

    useEffect(() => {
        if (directAlimtalkTemplateOptions.length > 0 && !manualAlimtalkForm.providerTemplateId) {
            setManualAlimtalkForm(p => ({ ...p, providerTemplateId: directAlimtalkTemplateOptions[0].selectionKey }));
        }
    }, [directAlimtalkTemplateOptions]);

    useEffect(() => {
        const requiredVariables = selectedDirectAlimtalkTemplate?.requiredVariables ?? [];
        setManualAlimtalkVariables(current => Object.fromEntries(requiredVariables.map((v: string) => [v, current[v] ?? ''])));
    }, [selectedDirectAlimtalkTemplate]);

    useEffect(() => {
        if (eventRules.length === 0) {
            if (selectedEventTestKey) {
                setSelectedEventTestKey('');
            }
            return;
        }

        if (!selectedEventTestKey || !eventRules.some((rule) => rule.eventKey === selectedEventTestKey)) {
            const firstRule = eventRules.find((rule) => rule.enabled) ?? eventRules[0];
            setSelectedEventTestKey(firstRule.eventKey);
        }
    }, [eventRules, selectedEventTestKey]);

    useEffect(() => {
        const requiredVariables = selectedEventTestRule?.requiredVariables ?? [];
        const sampleVariables =
            selectedEventTestRule
                ? ((samplePayloads as Record<string, { variables?: Record<string, string> }>)[selectedEventTestRule.eventKey]?.variables ?? {})
                : {};

        setEventTestVariables((current) =>
            Object.fromEntries(requiredVariables.map((variable) => [variable, current[variable] ?? sampleVariables[variable] ?? '']))
        );
    }, [selectedEventTestRule?.eventKey, selectedEventTestRule?.requiredVariables]);

    useEffect(() => {
        if (me?.providerUserId && !eventTestRecipientUserId) {
            setEventTestRecipientUserId(me.providerUserId);
        }
    }, [eventTestRecipientUserId, me?.providerUserId]);

    return {
        me,
        error,
        setError,
        loading,
        refreshAll,
        dashboardOverview,
        savingDashboardSettingKey,
        updateDashboardSettings,

        // Auth
        localLoginId, setLocalLoginId,
        localPassword, setLocalPassword,
        loginWithPassword,
        ssoToken, setSsoToken,
        exchangeSso,
        startGoogleLogin,
        publServiceToken, setPublServiceToken,

        // Templates
        alimtalkTemplateLibrary,
        defaultGroupTemplates,
        templates,
        filteredAlimtalkTemplateLibrary,
        templateLibrarySearch, setTemplateLibrarySearch,
        selectedTemplateLibraryKey, setSelectedTemplateLibraryKey,
        selectedAlimtalkTemplate,
        showTemplateComposer, setShowTemplateComposer,
        templateForm, setTemplateForm,
        createTemplate,
        updateTemplate,
        previewTemplate,
        syncTemplate,

        // Event Rules
        eventRuleForm, setEventRuleForm,
        setEventRuleChannelStrategy,
        selectEventRuleSmsTemplate,
        selectEventRuleAlimtalkTemplate,
        selectedEventTestKey, setSelectedEventTestKey,
        selectedEventTestRule,
        eventTestRecipientPhone, setEventTestRecipientPhone,
        eventTestRecipientUserId, setEventTestRecipientUserId,
        eventTestVariables,
        updateEventTestVariable,
        eventTestRequestExample,
        smsTemplates,
        alimtalkProviders,
        senderProfilesWithStatus,
        focusSenderProfileCenter,
        upsertRule,
        sendingEventTest,
        executeEventTest,
        eventRules,

        // Direct Send
        approvedSenderNumbers,
        manualSmsForm, setManualSmsForm,
        directSmsTemplateOptions,
        selectedManualSmsTemplate,
        manualSmsVariables, setManualSmsVariables,
        renderedManualSmsBody,
        formattedManualSmsBody,
        sendingManualSms,
        sendDirectSms,
        readySenderProfiles,
        manualAlimtalkForm, setManualAlimtalkForm,
        directAlimtalkTemplateOptions,
        selectedDirectAlimtalkTemplate,
        manualAlimtalkVariables, setManualAlimtalkVariables,
        sendingManualAlimtalk,
        sendDirectAlimtalk,

        // Senders & Logs
        senderNumbers,
        nhnRegisteredSenders,
        syncApprovedNumbers,
        senderForm, setSenderForm,
        setTelecomFile,
        setConsentFile,
        setThirdPartyBusinessRegistrationFile,
        setRelationshipProofFile,
        setAdditionalDocumentFile,
        applySenderNumber,
        activeSenderProfiles,
        pendingSenderProfiles,
        blockedSenderProfiles,
        senderProfileForm, setSenderProfileForm,
        senderProfileCategoryOptions,
        applyingSenderProfile,
        applySenderProfile,
        senderProfileTokenForm, setSenderProfileTokenForm,
        verifyingSenderProfile,
        verifySenderProfileToken,
        syncingGroupSenderKeys,
        syncSenderToDefaultGroup,
        logs
    };
}
