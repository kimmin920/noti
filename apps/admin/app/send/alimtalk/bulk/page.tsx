'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Users2 } from 'lucide-react';
import { LoginRequiredState, SessionPendingState, TenantAdminRequiredState } from '@/components/access-state';
import { InlineSendScheduler } from '@/components/inline-send-scheduler';
import { ResourceRequiredDialog } from '@/components/resource-required-dialog';
import { SendPageShell } from '@/components/send-page-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAdminSession } from '@/hooks/use-admin-session';
import { apiFetch } from '@/lib/api';
import { statusVariant } from '@/lib/status';
import type {
  BulkAlimtalkCampaign,
  BulkAlimtalkCampaignsResponse,
  DefaultSenderGroupStatus,
  GroupTemplate,
  ManagedUser,
  ManagedUserFieldDefinition,
  ManagedUsersResponse,
  SenderProfilesResponse,
  Template
} from '@/types/admin';

const TEMPLATE_VARIABLE_REGEX = /\{\{\s*([^}]+?)\s*\}\}|#\{\s*([^}]+?)\s*\}/g;
const UNMAPPED_FIELD_VALUE = '__unmapped__';

type BulkAlimtalkTemplateOption = {
  selectionKey: string;
  source: 'LOCAL' | 'GROUP';
  templateName: string;
  templateBody: string;
  requiredVariables: string[];
  templateCode: string | null;
  providerTemplateId: string | null;
  providerStatus: string;
  ownerLabel: string;
};

function formatDate(value: string | null | undefined) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function normalizePhone(value: string | null | undefined) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) {
    return null;
  }

  if (digits.startsWith('746010')) {
    return digits.slice(3);
  }

  return digits;
}

function extractTemplateVariables(body: string) {
  const variables = new Set<string>();
  const regex = new RegExp(TEMPLATE_VARIABLE_REGEX);
  let match = regex.exec(body);

  while (match) {
    const key = (match[1] ?? match[2] ?? '').trim();
    if (key) {
      variables.add(key);
    }
    match = regex.exec(body);
  }

  return [...variables];
}

function getManagedUserFieldValue(user: ManagedUser, fieldKey: string) {
  if (!fieldKey) {
    return undefined;
  }

  const record = user as Record<string, unknown>;
  if (fieldKey in record) {
    const value = record[fieldKey];
    if (fieldKey === 'phone' && typeof value === 'string') {
      return normalizePhone(value) ?? undefined;
    }
    return stringifyFieldValue(value, fieldKey);
  }

  return stringifyFieldValue(user.customAttributes?.[fieldKey], fieldKey);
}

function stringifyFieldValue(value: unknown, fieldKey?: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    if (fieldKey && ['registeredAt', 'lastLoginAt', 'createdAt', 'updatedAt'].includes(fieldKey)) {
      const date = new Date(trimmed);
      if (!Number.isNaN(date.getTime())) {
        return formatDate(trimmed);
      }
    }

    return trimmed;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    const normalized = value.map((item) => stringifyFieldValue(item)).filter(Boolean);
    return normalized.length > 0 ? normalized.join(', ') : undefined;
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return undefined;
}

function renderTemplatePreview(body: string, variables: Record<string, string>) {
  return body.replace(TEMPLATE_VARIABLE_REGEX, (_, mustacheKey: string | undefined, hashKey: string | undefined) => {
    const key = (mustacheKey ?? hashKey ?? '').trim();
    return variables[key] ?? `{{${key}}}`;
  });
}

export default function BulkAlimtalkPage() {
  const session = useAdminSession();
  const [usersResponse, setUsersResponse] = useState<ManagedUsersResponse | null>(null);
  const [senderProfilesResponse, setSenderProfilesResponse] = useState<SenderProfilesResponse | null>(null);
  const [defaultSenderGroup, setDefaultSenderGroup] = useState<DefaultSenderGroupStatus | null>(null);
  const [defaultGroupTemplates, setDefaultGroupTemplates] = useState<GroupTemplate[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [campaigns, setCampaigns] = useState<BulkAlimtalkCampaign[]>([]);
  const [loadingPage, setLoadingPage] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  const [title, setTitle] = useState('');
  const [senderProfileId, setSenderProfileId] = useState('');
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [templateVariableMappings, setTemplateVariableMappings] = useState<Record<string, string>>({});

  const readySenderProfiles = useMemo(
    () =>
      (senderProfilesResponse?.senders ?? []).filter(
        (profile) =>
          Boolean(profile.localSenderProfileId) &&
          profile.localStatus !== 'BLOCKED' &&
          profile.localStatus !== 'DORMANT'
      ),
    [senderProfilesResponse?.senders]
  );

  const approvedTemplateOptions = useMemo<BulkAlimtalkTemplateOption[]>(
    () => [
      ...templates
        .filter((template) => template.channel === 'ALIMTALK')
        .flatMap((template) =>
          (template.providerTemplates ?? [])
            .filter((providerTemplate) => providerTemplate.providerStatus === 'APR')
            .map((providerTemplate) => ({
              selectionKey: `local:${providerTemplate.id}`,
              source: 'LOCAL' as const,
              templateName: template.name,
              templateBody: template.body,
              requiredVariables:
                template.requiredVariables.length > 0 ? template.requiredVariables : extractTemplateVariables(template.body),
              templateCode: providerTemplate.templateCode ?? providerTemplate.kakaoTemplateCode ?? providerTemplate.nhnTemplateId ?? null,
              providerTemplateId: providerTemplate.id,
              providerStatus: providerTemplate.providerStatus,
              ownerLabel: '개별 템플릿'
            }))
            .filter((option) => Boolean(option.templateCode) && Boolean(option.templateBody.trim()))
        ),
      ...defaultGroupTemplates
        .filter((template) => template.status === 'TSC03' || template.statusName === '승인')
        .map((template) => ({
          selectionKey: `group:${template.templateCode || template.kakaoTemplateCode || template.templateName || 'group-template'}`,
          source: 'GROUP' as const,
          templateName: template.templateName || template.templateCode || template.kakaoTemplateCode || '이름 없는 그룹 템플릿',
          templateBody: template.templateContent || '',
          requiredVariables: extractTemplateVariables(template.templateContent || ''),
          templateCode: template.templateCode || template.kakaoTemplateCode,
          providerTemplateId: null,
          providerStatus: template.status || 'APR',
          ownerLabel: defaultSenderGroup?.group?.groupName || '기본 그룹 템플릿'
        }))
        .filter((option) => Boolean(option.templateCode) && Boolean(option.templateBody.trim()))
    ],
    [defaultGroupTemplates, defaultSenderGroup?.group?.groupName, templates]
  );

  const selectedTemplateOption = useMemo(
    () => approvedTemplateOptions.find((option) => option.selectionKey === selectedTemplateKey) ?? null,
    [approvedTemplateOptions, selectedTemplateKey]
  );
  const resolvedBody = selectedTemplateOption?.templateBody ?? '';
  const templateVariables = useMemo(
    () =>
      selectedTemplateOption
        ? selectedTemplateOption.requiredVariables.length > 0
          ? selectedTemplateOption.requiredVariables
          : extractTemplateVariables(selectedTemplateOption.templateBody)
        : [],
    [selectedTemplateOption]
  );

  async function loadPage() {
    setLoadingPage(true);
    setFetchError('');
    try {
      const [users, senderProfiles, templateRows, campaignRows, groupStatus, groupTemplates] = await Promise.all([
        apiFetch<ManagedUsersResponse>('/v1/users'),
        apiFetch<SenderProfilesResponse>('/v1/sender-profiles'),
        apiFetch<Template[]>('/v1/templates'),
        apiFetch<BulkAlimtalkCampaignsResponse>('/v1/bulk-alimtalk/campaigns'),
        apiFetch<DefaultSenderGroupStatus>('/v1/sender-profiles/default-group/status'),
        apiFetch<{ configuredGroupKey: string | null; exists: boolean; templates: GroupTemplate[]; totalCount: number; error?: string }>(
          '/v1/sender-profiles/default-group/templates'
        )
      ]);
      setUsersResponse(users);
      setSenderProfilesResponse(senderProfiles);
      setTemplates(templateRows);
      setCampaigns(campaignRows.campaigns);
      setDefaultSenderGroup(groupStatus);
      setDefaultGroupTemplates(groupTemplates.templates ?? []);
    } catch (caughtError) {
      setFetchError(caughtError instanceof Error ? caughtError.message : '대량 알림톡 화면을 불러오지 못했습니다.');
    } finally {
      setLoadingPage(false);
    }
  }

  useEffect(() => {
    if (!session.loading && session.me?.role === 'USER') {
      void loadPage();
    }
  }, [session.loading, session.me?.role]);

  useEffect(() => {
    if (readySenderProfiles.length > 0 && !senderProfileId) {
      setSenderProfileId(readySenderProfiles[0].localSenderProfileId || '');
    }
  }, [readySenderProfiles, senderProfileId]);

  useEffect(() => {
    if (approvedTemplateOptions.length === 0) {
      if (selectedTemplateKey) {
        setSelectedTemplateKey('');
      }
      return;
    }

    if (!approvedTemplateOptions.some((option) => option.selectionKey === selectedTemplateKey)) {
      setSelectedTemplateKey(approvedTemplateOptions[0].selectionKey);
    }
  }, [approvedTemplateOptions, selectedTemplateKey]);

  const filteredUsers = useMemo(() => {
    const users = usersResponse?.users ?? [];
    const keyword = deferredSearch.trim().toLowerCase();
    if (!keyword) {
      return users;
    }

    return users.filter((user) => {
      const searchable = [user.name, user.phone, user.email, user.externalId, user.source, user.segment, user.gradeOrLevel]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchable.includes(keyword);
    });
  }, [deferredSearch, usersResponse?.users]);

  const selectableVisibleUsers = useMemo(
    () => filteredUsers.filter((user) => Boolean(normalizePhone(user.phone))),
    [filteredUsers]
  );
  const selectedUserSet = useMemo(() => new Set(selectedUserIds), [selectedUserIds]);
  const selectedUsers = useMemo(
    () => (usersResponse?.users ?? []).filter((user) => selectedUserSet.has(user.id)),
    [selectedUserSet, usersResponse?.users]
  );
  const selectedContactableUsers = useMemo(
    () => selectedUsers.filter((user) => Boolean(normalizePhone(user.phone))),
    [selectedUsers]
  );
  const selectedContactableCount = selectedContactableUsers.length;
  const allVisibleSelected =
    selectableVisibleUsers.length > 0 && selectableVisibleUsers.every((user) => selectedUserSet.has(user.id));
  const fieldOptions = useMemo<ManagedUserFieldDefinition[]>(() => usersResponse?.fields ?? [], [usersResponse?.fields]);
  const fieldLabelMap = useMemo(() => new Map(fieldOptions.map((field) => [field.key, field])), [fieldOptions]);
  const previewUser = useMemo(
    () => selectedContactableUsers[0] ?? selectableVisibleUsers[0] ?? null,
    [selectedContactableUsers, selectableVisibleUsers]
  );

  useEffect(() => {
    setTemplateVariableMappings((current) =>
      Object.fromEntries(templateVariables.map((variable) => [variable, current[variable] ?? '']))
    );
  }, [templateVariables]);

  const variableRows = useMemo(
    () =>
      templateVariables.map((variable) => {
        const fieldKey = templateVariableMappings[variable] ?? '';
        const field = fieldKey ? fieldLabelMap.get(fieldKey) ?? null : null;
        const sampleValue = previewUser && fieldKey ? getManagedUserFieldValue(previewUser, fieldKey) : undefined;
        const missingCount =
          fieldKey && selectedContactableUsers.length > 0
            ? selectedContactableUsers.filter((user) => !getManagedUserFieldValue(user, fieldKey)).length
            : 0;

        return {
          variable,
          fieldKey,
          field,
          sampleValue,
          missingCount
        };
      }),
    [fieldLabelMap, previewUser, selectedContactableUsers, templateVariableMappings, templateVariables]
  );

  const previewVariables = useMemo(
    () =>
      Object.fromEntries(
        variableRows
          .filter((row) => row.sampleValue)
          .map((row) => [row.variable, row.sampleValue as string])
      ),
    [variableRows]
  );

  const previewMessage = useMemo(
    () => (previewUser && resolvedBody ? renderTemplatePreview(resolvedBody, previewVariables) : ''),
    [previewUser, previewVariables, resolvedBody]
  );

  function toggleUser(userId: string) {
    setSelectedUserIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]
    );
  }

  function toggleVisibleUsers() {
    setSelectedUserIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        selectableVisibleUsers.forEach((user) => next.delete(user.id));
      } else {
        selectableVisibleUsers.forEach((user) => next.add(user.id));
      }
      return [...next];
    });
  }

  async function submitBulkAlimtalk(scheduledAt?: string | null) {
    setSubmitError('');
    setSuccessMessage('');

    if (!senderProfileId) {
      setSubmitError('발송에 사용할 카카오 채널을 선택하세요.');
      return;
    }

    if (!selectedTemplateOption) {
      setSubmitError('승인된 알림톡 템플릿을 선택하세요.');
      return;
    }

    if (selectedUserIds.length === 0) {
      setSubmitError('발송할 유저를 최소 한 명 이상 선택하세요.');
      return;
    }

    if (selectedUserIds.length > 1000) {
      setSubmitError('현재 MVP는 한 번에 최대 1,000명까지만 보낼 수 있습니다.');
      return;
    }

    const unmappedVariables = variableRows.filter((row) => !row.fieldKey).map((row) => row.variable);
    if (unmappedVariables.length > 0) {
      setSubmitError(`다음 변수의 유저 컬럼 매핑이 필요합니다: ${unmappedVariables.join(', ')}`);
      return;
    }

    const invalidVariables = variableRows.filter((row) => row.fieldKey && row.missingCount > 0);
    if (invalidVariables.length > 0) {
      setSubmitError(
        invalidVariables
          .map((row) => `${row.variable}(${row.missingCount}명 값 없음)`)
          .join(', ') + ' 값을 먼저 채우거나 다른 컬럼으로 매핑하세요.'
      );
      return;
    }

    try {
      setSending(true);
      const response = await apiFetch<{ campaign: BulkAlimtalkCampaign }>('/v1/bulk-alimtalk/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim() || undefined,
          senderProfileId,
          scheduledAt: scheduledAt || undefined,
          ...(selectedTemplateOption.source === 'LOCAL' && selectedTemplateOption.providerTemplateId
            ? { providerTemplateId: selectedTemplateOption.providerTemplateId }
            : {
                templateSource: 'GROUP',
                templateCode: selectedTemplateOption.templateCode,
                templateName: selectedTemplateOption.templateName,
                templateBody: selectedTemplateOption.templateBody
              }),
          userIds: selectedUserIds,
          templateVariableMappings: variableRows
            .filter((row) => row.fieldKey)
            .map((row) => ({
              templateVariable: row.variable,
              userFieldKey: row.fieldKey
            }))
        })
      });

      setSuccessMessage(
        scheduledAt
          ? `${response.campaign.totalRecipientCount}명 예약 발송을 접수했습니다. ${formatDate(scheduledAt)}에 발송 예정입니다.`
          : `${response.campaign.totalRecipientCount}명 알림톡 발송 요청을 접수했습니다. ` +
              `성공 ${response.campaign.acceptedCount}건 / 실패 ${response.campaign.failedCount}건`
      );
      setCampaigns((current) => [response.campaign, ...current.filter((item) => item.id !== response.campaign.id)].slice(0, 20));
      setSelectedUserIds([]);
      setTitle('');
      await loadPage();
    } catch (caughtError) {
      setSubmitError(caughtError instanceof Error ? caughtError.message : '대량 알림톡 발송에 실패했습니다.');
    } finally {
      setSending(false);
    }
  }

  if (!session.me) {
    if (session.loading) {
      return (
        <SessionPendingState
          title="대량 알림톡 보내기"
          description="대량 알림톡 발송 권한과 현재 세션을 확인하고 있습니다."
        />
      );
    }

    return (
      <LoginRequiredState
        title="대량 알림톡 보내기"
        description="승인된 카카오 채널과 템플릿으로 유저에게 알림톡을 한 번에 보냅니다. 먼저 사업자 계정으로 로그인해야 합니다."
        nextPath="/send/alimtalk/bulk"
        error={session.error}
      />
    );
  }

  if (session.me.role === 'OPERATOR') {
    return (
      <TenantAdminRequiredState
        title="사업자 계정이 필요합니다"
        description="대량 알림톡 발송은 실제 사업자 채널과 승인 템플릿을 사용하므로 `USER` 세션에서만 허용됩니다."
        message="로그인 페이지에서 사업자 계정으로 다시 인증한 뒤 이 화면을 사용하세요."
        nextPath="/send/alimtalk/bulk"
      />
    );
  }

  const missingSenderProfile = !loadingPage && readySenderProfiles.length === 0;

  return (
    <>
      <SendPageShell
        icon={Users2}
        badge="Bulk AlimTalk"
        title="대량 알림톡 보내기"
        description="승인된 카카오 채널과 알림톡 템플릿을 고른 뒤, 유저 컬럼을 변수에 매핑해 대량 알림톡을 한 번에 발송합니다."
        stats={[
          {
            label: '발송 가능 유저',
            value: `${(usersResponse?.users ?? []).filter((user) => Boolean(normalizePhone(user.phone))).length}명`,
            hint: '전화번호가 있는 서비스 유저'
          },
          {
            label: '카카오 채널',
            value: `${readySenderProfiles.length}개`,
            hint: '현재 선택 가능한 로컬 채널'
          },
          {
            label: '승인 템플릿',
            value: `${approvedTemplateOptions.length}개`,
            hint: '개별 + 기본 그룹 승인 템플릿'
          }
        ]}
        quickLinks={[
          {
            label: '단건 알림톡 보내기',
            href: '/send/alimtalk/single',
            description: '한 명에게 즉시 보내는 기존 알림톡 화면입니다.'
          },
          {
            label: '알림톡 템플릿',
            href: '/send/alimtalk/templates',
            description: '승인 상태와 기본 그룹 템플릿을 함께 점검합니다.'
          },
          {
            label: '유저 목록',
            href: '/users',
            description: '대상 유저의 전화번호와 컬럼 값을 먼저 점검합니다.'
          },
          {
            label: '유저 불러오기',
            href: '/users/import',
            description: '외부 JSON을 정규화해 알림톡 대상 사용자 풀을 만듭니다.'
          },
          {
            label: '카카오 채널 관리',
            href: '/send/alimtalk/channels',
            description: '카카오 채널 상태와 승인 흐름을 확인합니다.'
          }
        ]}
      >
        {fetchError && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {fetchError}
          </div>
        )}

      {submitError && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {submitError}
        </div>
      )}

      {successMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      )}

        <Card className="glass">
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>발송 구성</CardTitle>
            <CardDescription>카카오 채널, 승인 템플릿, 그리고 템플릿 변수가 읽을 유저 컬럼을 함께 구성합니다.</CardDescription>
          </div>
          <Button variant="outline" onClick={() => void loadPage()} disabled={loadingPage}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loadingPage ? 'animate-spin' : ''}`} />
            데이터 새로고침
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="bulk-title">배치 이름</Label>
            <Input
              id="bulk-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="예: 3월 수강생 공지"
              className="bg-white"
            />
          </div>

          <div className="space-y-2">
            <Label>카카오 채널</Label>
            <Select value={senderProfileId} onValueChange={setSenderProfileId}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="발송 가능한 카카오 채널 선택" />
              </SelectTrigger>
              <SelectContent>
                {readySenderProfiles.map((profile) => (
                  <SelectItem key={profile.localSenderProfileId} value={profile.localSenderProfileId || profile.senderKey}>
                    {profile.plusFriendId} · {profile.senderKey}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 lg:col-span-2">
            <Label>승인 알림톡 템플릿</Label>
            <Select value={selectedTemplateKey} onValueChange={setSelectedTemplateKey}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="개별 또는 기본 그룹 승인 템플릿 선택" />
              </SelectTrigger>
              <SelectContent>
                {approvedTemplateOptions.map((option) => (
                  <SelectItem key={option.selectionKey} value={option.selectionKey}>
                    [{option.source === 'GROUP' ? '그룹' : '개별'}] {option.templateName} · {option.templateCode || 'templateCode 없음'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplateOption ? (
              <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-semibold text-foreground">{selectedTemplateOption.templateName}</div>
                  <Badge variant={selectedTemplateOption.source === 'GROUP' ? 'secondary' : 'outline'}>
                    {selectedTemplateOption.source === 'GROUP' ? '기본 그룹' : '개별 템플릿'}
                  </Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {selectedTemplateOption.ownerLabel} · {selectedTemplateOption.templateCode || 'templateCode 없음'}
                </div>
                <div className="mt-3 whitespace-pre-wrap leading-6">{selectedTemplateOption.templateBody}</div>
              </div>
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                승인된 개별 템플릿이 없더라도 기본 그룹에 승인된 템플릿이 있으면 여기서 바로 선택할 수 있습니다.
              </div>
            )}
          </div>

          {templateVariables.length > 0 ? (
            <div className="grid gap-4 lg:col-span-2 2xl:grid-cols-[minmax(0,1.15fr)_360px]">
              <div className="rounded-[28px] border border-primary/15 bg-white/80 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-foreground">변수 컬럼 매핑</div>
                    <div className="mt-1 text-xs leading-5 text-muted-foreground">
                      템플릿 변수마다 어떤 유저 컬럼 값을 보낼지 선택합니다.
                    </div>
                  </div>
                  <Badge variant={variableRows.every((row) => row.fieldKey) ? 'success' : 'secondary'}>
                    {variableRows.filter((row) => row.fieldKey).length}/{variableRows.length} 매핑
                  </Badge>
                </div>

                <div className="mt-4 space-y-3">
                  {variableRows.map((row) => (
                    <div key={row.variable} className="rounded-2xl border border-border/70 bg-background/85 px-4 py-4">
                      <div className="grid gap-4 lg:grid-cols-[160px_minmax(0,1fr)] 2xl:grid-cols-[160px_minmax(260px,1fr)_220px] 2xl:items-center">
                        <div className="space-y-2">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Template Var
                          </div>
                          <div className="font-mono text-sm font-semibold text-foreground">{row.variable}</div>
                        </div>

                        <div className="min-w-0 space-y-2">
                          <Label className="block text-xs text-muted-foreground">유저 컬럼 선택</Label>
                          <Select
                            value={row.fieldKey || UNMAPPED_FIELD_VALUE}
                            onValueChange={(value) =>
                              setTemplateVariableMappings((current) => ({
                                ...current,
                                [row.variable]: value === UNMAPPED_FIELD_VALUE ? '' : value
                              }))
                            }
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="컬럼 선택" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={UNMAPPED_FIELD_VALUE}>컬럼 선택</SelectItem>
                              {fieldOptions.map((field) => (
                                <SelectItem key={field.key} value={field.key}>
                                  {field.label}
                                  {field.kind === 'custom' ? ' · 커스텀' : ' · 기본'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="rounded-2xl border border-dashed border-border/80 bg-muted/30 px-4 py-3 lg:col-span-2 2xl:col-span-1">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Sample
                          </div>
                          <div className="mt-2 text-sm font-medium text-foreground">
                            {row.sampleValue || '미리보기용 유저 값을 기다리는 중'}
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {row.field ? `${row.field.label} · ${row.field.dataType}` : '컬럼을 선택하면 첫 선택 유저 기준 값을 보여줍니다.'}
                          </div>
                          {row.fieldKey && row.missingCount > 0 ? (
                            <div className="mt-2 text-xs text-amber-700">{row.missingCount}명은 이 컬럼 값이 비어 있습니다.</div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.08),_transparent_48%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.92))] p-5 shadow-sm">
                <div className="text-sm font-semibold text-foreground">첫 선택 유저 미리보기</div>
                <div className="mt-1 text-xs leading-5 text-muted-foreground">
                  {previewUser
                    ? `${previewUser.name} 기준으로 실제 발송 메시지가 어떻게 보일지 미리 확인합니다.`
                    : '유저를 선택하면 이 영역에 실제 렌더링 예시가 나타납니다.'}
                </div>

                <div className="mt-4 rounded-3xl border border-yellow-200 bg-[linear-gradient(180deg,rgba(254,240,138,0.28),rgba(255,255,255,0.96))] px-4 py-4 shadow-inner">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Rendered AlimTalk</div>
                  <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-foreground">
                    {previewMessage || resolvedBody || '승인 템플릿을 선택하면 미리보기가 준비됩니다.'}
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {variableRows.map((row) => (
                    <div key={row.variable} className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-white/80 px-3 py-3">
                      <div className="font-mono text-xs font-semibold text-foreground">{row.variable}</div>
                      <div className="text-right text-xs text-muted-foreground">{row.field ? row.field.label : '컬럼 미선택'}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

        <Card className="glass">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle>대상 유저 선택</CardTitle>
              <CardDescription>유저 목록에서 최대 1,000명까지 선택할 수 있습니다. 전화번호가 없는 유저는 선택할 수 없습니다.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{selectedContactableCount}명 선택됨</Badge>
              <Button variant="outline" size="sm" onClick={toggleVisibleUsers} disabled={selectableVisibleUsers.length === 0}>
                {allVisibleSelected ? '보이는 유저 선택 해제' : '보이는 유저 전체 선택'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedUserIds([])} disabled={selectedUserIds.length === 0}>
                전체 해제
              </Button>
            </div>
          </div>

          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="이름, 전화번호, 이메일, 소스, 외부 ID로 검색"
            className="bg-white"
          />
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                <TableRow>
                  <TableHead className="w-[64px]">선택</TableHead>
                  <TableHead>이름</TableHead>
                  <TableHead>전화번호</TableHead>
                  <TableHead>소스</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>마케팅 수신</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => {
                    const hasPhone = Boolean(normalizePhone(user.phone));
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedUserSet.has(user.id)}
                            disabled={!hasPhone}
                            onChange={() => toggleUser(user.id)}
                            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{user.name}</div>
                          <div className="text-xs text-muted-foreground">{user.email || user.externalId || '-'}</div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{user.phone || '전화번호 없음'}</TableCell>
                        <TableCell>{user.source}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(user.status)}>{user.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {typeof user.marketingConsent === 'boolean' ? (
                            <Badge variant={user.marketingConsent ? 'success' : 'secondary'}>
                              {user.marketingConsent ? '동의' : '미동의'}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">미입력</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      검색 결과가 없습니다.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-primary/10 bg-primary/5 px-4 py-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-foreground">발송 요약</div>
              <div className="text-xs text-muted-foreground">
                현재 선택 {selectedUserIds.length}명 중 전화번호가 있는 대상은 {selectedContactableCount}명입니다.
              </div>
            </div>
            <InlineSendScheduler
              tone="alimtalk"
              primaryLabel="대량 알림톡 보내기"
              scheduledPrimaryLabel="지금 보내기"
              loadingLabel="대량 알림톡 발송 중..."
              loading={sending || loadingPage}
              onPrimaryAction={() => submitBulkAlimtalk(null)}
              onScheduledAction={(scheduledAt) => submitBulkAlimtalk(scheduledAt)}
              className="md:min-w-[340px] md:max-w-[380px]"
            />
          </div>
        </CardContent>
      </Card>

        <Card className="glass">
        <CardHeader>
          <CardTitle>최근 대량 알림톡 배치</CardTitle>
          <CardDescription>최근에 등록한 대량 알림톡의 NHN 접수 및 예약 결과입니다. 수신자 미리보기와 요청 ID를 함께 확인할 수 있습니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {campaigns.length > 0 ? (
            campaigns.map((campaign) => {
              const isScheduledReservationPending =
                campaign.scheduledAt ? new Date(campaign.scheduledAt).getTime() > Date.now() : false;

              return (
              <div key={campaign.id} className="rounded-2xl border border-border/70 bg-background/85 p-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-base font-semibold">{campaign.title}</div>
                      <Badge variant={statusVariant(campaign.status)}>{campaign.status}</Badge>
                      {isScheduledReservationPending ? (
                        <Badge variant="outline">예약 등록</Badge>
                      ) : null}
                      <Badge variant={campaign.templateSource === 'GROUP' ? 'secondary' : 'outline'}>
                        {campaign.templateSource === 'GROUP' ? '기본 그룹' : '개별 템플릿'}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(campaign.createdAt)} · 채널 {campaign.senderProfile.plusFriendId} · 템플릿 {campaign.templateName}
                      {campaign.templateCode ? ` (${campaign.templateCode})` : ''} · 요청 ID {campaign.nhnRequestId || '-'}
                    </div>
                    {campaign.scheduledAt ? (
                      <div className="text-xs text-primary">예약 발송 시각 {formatDate(campaign.scheduledAt)}</div>
                    ) : null}
                    <div className="text-sm leading-6 text-muted-foreground whitespace-pre-wrap">{campaign.body}</div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-4 lg:min-w-[360px]">
                    <SummaryPill label="대상" value={`${campaign.totalRecipientCount}명`} />
                    <SummaryPill label="성공" value={`${campaign.acceptedCount}건`} />
                    <SummaryPill label="실패" value={`${campaign.failedCount}건`} />
                    <SummaryPill label="제외" value={`${campaign.skippedNoPhoneCount + campaign.duplicatePhoneCount}건`} />
                  </div>
                </div>

                <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {campaign.recipients.map((recipient) => (
                    <div key={recipient.id} className="rounded-2xl border border-border/70 bg-card px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold">{recipient.recipientName || '이름 없음'}</div>
                        <Badge variant={statusVariant(recipient.status)}>{recipient.status}</Badge>
                      </div>
                      <div className="mt-1 font-mono text-xs text-muted-foreground">{recipient.recipientPhone}</div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {recipient.providerResultMessage || recipient.providerResultCode || '초기 접수 완료'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              아직 대량 알림톡 배치가 없습니다.
            </div>
          )}
        </CardContent>
      </Card>
      </SendPageShell>
      <ResourceRequiredDialog
        open={missingSenderProfile}
        icon={Users2}
        badge="카카오 채널 필요"
        title="대량 알림톡을 보낼 채널이 아직 없습니다"
        description="대량 알림톡은 등록된 카카오 채널이 있어야 시작할 수 있습니다. 채널을 먼저 연결하면 템플릿 선택과 발송 대상 설정을 바로 이어서 진행할 수 있습니다."
        primaryHref="/send/alimtalk/channels"
        primaryLabel="채널 등록하러 가기"
      />
    </>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card px-3 py-3 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-lg font-semibold">{value}</div>
    </div>
  );
}
