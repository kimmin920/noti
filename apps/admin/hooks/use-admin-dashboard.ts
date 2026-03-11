'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch, samplePayloads } from '@/lib/api';
import {
    Template,
    EventRule,
    SenderNumber,
    SenderProfile,
    SenderProfileCategory,
    DefaultSenderGroupStatus,
    GroupTemplate,
    MessageLog,
    ViewerProfile
} from '@/types/admin';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

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

export function useAdminDashboard() {
    const [me, setMe] = useState<ViewerProfile | null>(null);
    const [error, setError] = useState<string>('');
    const [loading, setLoading] = useState(false);

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
    const [employmentFile, setEmploymentFile] = useState<File | null>(null);
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
    const [manualSmsForm, setManualSmsForm] = useState({
        senderNumberId: '',
        recipientPhone: '',
        body: ''
    });
    const [manualAlimtalkForm, setManualAlimtalkForm] = useState({
        senderProfileId: '',
        providerTemplateId: '',
        recipientPhone: ''
    });
    const [manualAlimtalkVariables, setManualAlimtalkVariables] = useState<Record<string, string>>({});
    const [templateLibrarySearch, setTemplateLibrarySearch] = useState('');
    const [selectedTemplateLibraryKey, setSelectedTemplateLibraryKey] = useState('');
    const [showTemplateComposer, setShowTemplateComposer] = useState(false);
    const [sendingManualSms, setSendingManualSms] = useState(false);
    const [sendingManualAlimtalk, setSendingManualAlimtalk] = useState(false);

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

    const effectiveSamplePayloads = useMemo(() => {
        const tenantId = me?.tenantId ?? 'tenant_demo';
        const userId = me?.publUserId ?? 'publ_user_1';
        return Object.fromEntries(
            Object.entries(samplePayloads).map(([key, payload]: [string, any]) => [
                key,
                { ...payload, tenantId, recipient: { ...payload.recipient, userId } }
            ])
        ) as typeof samplePayloads;
    }, [me]);

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
                setTemplates([]); setEventRules([]); setSenderNumbers([]); setLogs([]); return;
            }
            const [templateRows, eventRuleRows, senderRows, nhnRegisteredRows, logRows] = await Promise.all([
                apiFetch<any[]>('/v1/templates'),
                apiFetch<any[]>('/v1/event-rules'),
                apiFetch<any[]>('/v1/sender-numbers'),
                apiFetch<any[]>('/v1/admin/sender-number-reviews/nhn-registered'),
                apiFetch<any[]>('/v1/admin/message-requests')
            ]);
            await refreshSenderProfiles();
            setTemplates(templateRows);
            setEventRules(eventRuleRows);
            setSenderNumbers(senderRows);
            setNhnRegisteredSenders(nhnRegisteredRows);
            setLogs(logRows);
        } catch (e) {
            setMe(null);
            setError(e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }

    async function refreshLogs() {
        if (!me || me.role === 'OPERATOR') return;
        const logRows = await apiFetch<any[]>('/v1/admin/message-requests');
        setLogs(logRows);
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

    function startGoogleLogin() { window.location.href = `${apiBase}/v1/auth/google/start`; }

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

    async function sendSample(eventKey: string) {
        const payload = (effectiveSamplePayloads as any)[eventKey];
        const idempotency = `${payload.metadata.publEventId}_${Date.now()}`;
        try {
            await apiFetch('/v1/message-requests', {
                method: 'POST',
                headers: { 'Idempotency-Key': idempotency, ...(publServiceToken ? { Authorization: `Bearer ${publServiceToken}` } : {}) },
                body: JSON.stringify(payload)
            });
            await refreshAll();
        } catch (e) { setError(e instanceof Error ? e.message : 'Sample send failed'); }
    }

    async function applySenderNumber() {
        const formData = new FormData();
        formData.append('phoneNumber', senderForm.phoneNumber);
        formData.append('type', senderForm.type);
        if (telecomFile) formData.append('telecomCertificate', telecomFile);
        if (employmentFile) formData.append('employmentCertificate', employmentFile);
        const response = await fetch(`${apiBase}/v1/sender-numbers/apply`, { method: 'POST', credentials: 'include', body: formData });
        if (!response.ok) { setError(await response.text()); return; }
        setSenderForm({ phoneNumber: '', type: 'COMPANY' });
        setTelecomFile(null); setEmploymentFile(null);
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

    async function sendDirectSms() {
        if (!manualSmsForm.senderNumberId || !manualSmsForm.recipientPhone || !manualSmsForm.body.trim()) {
            setError('발신/수신번호 및 본문을 입력하세요.'); return;
        }
        try {
            setSendingManualSms(true); setError('');
            const response = await apiFetch<any>('/v1/message-requests/manual-sms', {
                method: 'POST',
                body: JSON.stringify(manualSmsForm)
            });
            setManualSmsForm((p) => ({ ...p, recipientPhone: '', body: '' }));
            await refreshAll();
            await waitForRequestResult(response.requestId);
        } catch (e) { setError(e instanceof Error ? e.message : 'SMS send failed'); } finally { setSendingManualSms(false); }
    }

    async function sendDirectAlimtalk() {
        if (!manualAlimtalkForm.senderProfileId || !manualAlimtalkForm.providerTemplateId || !manualAlimtalkForm.recipientPhone) {
            setError('정보를 모두 입력하세요.'); return;
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
                    variables: parsedVariables
                })
            });
            setManualAlimtalkForm((p) => ({ ...p, recipientPhone: '' }));
            setManualAlimtalkVariables(p => Object.fromEntries(Object.keys(p).map(k => [k, ''])));
            await refreshAll();
            await waitForRequestResult(response.requestId);
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

    return {
        me,
        error,
        setError,
        loading,
        refreshAll,

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
        smsTemplates,
        alimtalkProviders,
        senderProfilesWithStatus,
        focusSenderProfileCenter,
        upsertRule,
        sendSample,
        eventRules,

        // Direct Send
        approvedSenderNumbers,
        manualSmsForm, setManualSmsForm,
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
        setEmploymentFile,
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
