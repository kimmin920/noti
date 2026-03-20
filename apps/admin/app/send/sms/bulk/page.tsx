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
import { Textarea } from '@/components/ui/textarea';
import { useAdminSession } from '@/hooks/use-admin-session';
import { apiFetch } from '@/lib/api';
import { formatSmsBodyForAdvertisement, sanitizeAdvertisingServiceName, SMS_ADVERTISEMENT_OPT_OUT_TEXT } from '@/lib/sms-advertisement';
import { statusVariant } from '@/lib/status';
import type {
  BulkSmsCampaign,
  BulkSmsCampaignsResponse,
  ManagedUserFieldDefinition,
  ManagedUser,
  ManagedUsersResponse,
  SenderNumber,
  Template
} from '@/types/admin';

const TEMPLATE_VARIABLE_REGEX = /\{\{\s*([^}]+?)\s*\}\}|#\{\s*([^}]+?)\s*\}/g;
const UNMAPPED_FIELD_VALUE = '__unmapped__';

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

export default function BulkSmsPage() {
  const session = useAdminSession();
  const [usersResponse, setUsersResponse] = useState<ManagedUsersResponse | null>(null);
  const [senderNumbers, setSenderNumbers] = useState<SenderNumber[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [campaigns, setCampaigns] = useState<BulkSmsCampaign[]>([]);
  const [loadingPage, setLoadingPage] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  const [title, setTitle] = useState('');
  const [senderNumberId, setSenderNumberId] = useState('');
  const [templateId, setTemplateId] = useState('__manual__');
  const [body, setBody] = useState('');
  const [isAdvertisement, setIsAdvertisement] = useState(false);
  const [advertisingServiceName, setAdvertisingServiceName] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [templateVariableMappings, setTemplateVariableMappings] = useState<Record<string, string>>({});

  const approvedSenderNumbers = useMemo(
    () => senderNumbers.filter((sender) => sender.status === 'APPROVED'),
    [senderNumbers]
  );
  const smsTemplates = useMemo(
    () => templates.filter((template) => template.channel === 'SMS' && template.status === 'PUBLISHED'),
    [templates]
  );
  const selectedTemplate = useMemo(
    () => smsTemplates.find((template) => template.id === templateId) ?? null,
    [smsTemplates, templateId]
  );
  const resolvedBody = selectedTemplate ? selectedTemplate.body : body;
  const formattedResolvedBody = useMemo(
    () =>
      formatSmsBodyForAdvertisement(resolvedBody, {
        isAdvertisement,
        advertisingServiceName
      }),
    [advertisingServiceName, isAdvertisement, resolvedBody]
  );
  const templateVariables = useMemo(() => {
    if (selectedTemplate) {
      return selectedTemplate.requiredVariables.length > 0
        ? selectedTemplate.requiredVariables
        : extractTemplateVariables(selectedTemplate.body);
    }

    return extractTemplateVariables(body);
  }, [body, selectedTemplate]);

  async function loadPage() {
    setLoadingPage(true);
    setFetchError('');
    try {
      const [users, senders, templateRows, campaignRows] = await Promise.all([
        apiFetch<ManagedUsersResponse>('/v1/users'),
        apiFetch<SenderNumber[]>('/v1/sender-numbers'),
        apiFetch<Template[]>('/v1/templates'),
        apiFetch<BulkSmsCampaignsResponse>('/v1/bulk-sms/campaigns')
      ]);
      setUsersResponse(users);
      setSenderNumbers(senders);
      setTemplates(templateRows);
      setCampaigns(campaignRows.campaigns);
    } catch (caughtError) {
      setFetchError(caughtError instanceof Error ? caughtError.message : '대량 SMS 화면을 불러오지 못했습니다.');
    } finally {
      setLoadingPage(false);
    }
  }

  useEffect(() => {
    if (!session.loading && session.me?.role === 'TENANT_ADMIN') {
      void loadPage();
    }
  }, [session.loading, session.me?.role]);

  useEffect(() => {
    if (approvedSenderNumbers.length > 0 && !senderNumberId) {
      setSenderNumberId(approvedSenderNumbers[0].id);
    }
  }, [approvedSenderNumbers, senderNumberId]);

  const filteredUsers = useMemo(() => {
    const users = usersResponse?.users ?? [];
    const keyword = deferredSearch.trim().toLowerCase();
    if (!keyword) {
      return users;
    }

    return users.filter((user) => {
      const searchable = [
        user.name,
        user.phone,
        user.email,
        user.externalId,
        user.source,
        user.segment,
        user.gradeOrLevel
      ]
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
  const fieldLabelMap = useMemo(
    () => new Map(fieldOptions.map((field) => [field.key, field])),
    [fieldOptions]
  );
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
    () =>
      previewUser && resolvedBody
        ? formatSmsBodyForAdvertisement(renderTemplatePreview(resolvedBody, previewVariables), {
            isAdvertisement,
            advertisingServiceName
          })
        : '',
    [advertisingServiceName, isAdvertisement, previewUser, previewVariables, resolvedBody]
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

  async function submitBulkSms(scheduledAt?: string | null) {
    setSubmitError('');
    setSuccessMessage('');

    if (!senderNumberId) {
      setSubmitError('승인된 발신번호를 선택하세요.');
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

    if (!resolvedBody.trim()) {
      setSubmitError('발송 본문을 입력하거나 SMS 템플릿을 선택하세요.');
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
      const response = await apiFetch<{ campaign: BulkSmsCampaign }>('/v1/bulk-sms/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim() || undefined,
          senderNumberId,
          templateId: selectedTemplate?.id,
          body: selectedTemplate ? undefined : body.trim(),
          isAdvertisement,
          advertisingServiceName: sanitizeAdvertisingServiceName(advertisingServiceName) || undefined,
          userIds: selectedUserIds,
          scheduledAt: scheduledAt || undefined,
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
          : `${response.campaign.totalRecipientCount}명 발송 요청을 접수했습니다. ` +
              `성공 ${response.campaign.acceptedCount}건 / 실패 ${response.campaign.failedCount}건`
      );
      setCampaigns((current) => [response.campaign, ...current.filter((item) => item.id !== response.campaign.id)].slice(0, 20));
      setSelectedUserIds([]);
      if (!selectedTemplate) {
        setBody('');
      }
      setTitle('');
      await loadPage();
    } catch (caughtError) {
      setSubmitError(caughtError instanceof Error ? caughtError.message : '대량 SMS 발송에 실패했습니다.');
    } finally {
      setSending(false);
    }
  }

  if (!session.me) {
    if (session.loading) {
      return (
        <SessionPendingState
          title="대량메세지 보내기"
          description="대량 SMS 발송 권한과 현재 세션을 확인하고 있습니다."
        />
      );
    }

    return (
      <LoginRequiredState
        title="대량메세지 보내기"
        description="유저에게 같은 메시지를 한 번에 보내는 화면입니다. 먼저 사업자 계정으로 로그인해야 합니다."
        nextPath="/send/sms/bulk"
        error={session.error}
      />
    );
  }

  if (session.me.role === 'OPERATOR') {
    return (
      <TenantAdminRequiredState
        title="사업자 계정이 필요합니다"
        description="대량 SMS 발송은 실제 사업자 유저 데이터와 발신번호를 사용하므로 `TENANT_ADMIN` 세션에서만 허용됩니다."
        message="로그인 페이지에서 사업자 계정으로 다시 인증한 뒤 이 화면을 사용하세요."
        nextPath="/send/sms/bulk"
      />
    );
  }

  const missingSenderNumber = !loadingPage && approvedSenderNumbers.length === 0;

  return (
    <>
      <SendPageShell
        icon={Users2}
        badge="Bulk SMS"
        title="대량메세지 보내기"
        description="유저 테이블에서 수신 대상을 고른 뒤 대량 SMS로 한 번에 발송합니다. 기존 단건 SMS 발송과는 별도 기능으로 동작합니다."
        stats={[
          {
            label: '발송 가능 유저',
            value: `${(usersResponse?.users ?? []).filter((user) => Boolean(normalizePhone(user.phone))).length}명`,
            hint: '전화번호가 있는 서비스 유저'
          },
          {
            label: '선택 인원',
            value: `${selectedContactableCount}명`,
            hint: '현재 발송 대상'
          },
          {
            label: '발송 제한',
            value: '1,000명',
            hint: '한 번에 보낼 수 있는 최대 인원'
          }
        ]}
        quickLinks={[
          {
            label: '단건 SMS 보내기',
            href: '/send/sms/single',
            description: '한 명에게 즉시 발송하는 기존 SMS 화면입니다.'
          },
          {
            label: 'SMS 템플릿',
            href: '/send/sms/templates',
            description: 'SMS 템플릿의 변수는 유저 컬럼과 연결해 대량 개인화에 사용할 수 있습니다.'
          },
          {
            label: '유저 목록',
            href: '/users',
            description: '대상 유저의 전화번호와 기본 속성을 미리 점검합니다.'
          },
          {
            label: '유저 불러오기',
            href: '/users/import',
            description: '외부 JSON을 정규화해 발송 가능한 사용자 풀을 만듭니다.'
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
            <CardDescription>발신번호, 템플릿, 그리고 템플릿 변수가 읽을 유저 컬럼을 함께 구성합니다.</CardDescription>
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
              placeholder="예: 3월 신규가입자 공지"
              className="bg-white"
            />
          </div>

          <div className="space-y-2">
            <Label>발신번호</Label>
            <Select value={senderNumberId} onValueChange={setSenderNumberId}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="승인된 발신번호 선택" />
              </SelectTrigger>
              <SelectContent>
                {approvedSenderNumbers.map((sender) => (
                  <SelectItem key={sender.id} value={sender.id}>
                    {sender.phoneNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 lg:col-span-2">
            <Label>SMS 템플릿</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="SMS 템플릿 선택 또는 직접 작성" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__manual__">직접 작성</SelectItem>
                {smsTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                    {template.requiredVariables.length > 0 ? ' · 변수형' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate ? (
                <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
                  <div className="font-semibold text-foreground">{selectedTemplate.name}</div>
                  <div className="mt-2 whitespace-pre-wrap leading-6">{selectedTemplate.body}</div>
                </div>
            ) : null}
          </div>

          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="bulk-body">메시지 본문</Label>
            <Textarea
              id="bulk-body"
              value={resolvedBody}
              readOnly={Boolean(selectedTemplate)}
              onChange={(event) => setBody(event.target.value)}
              placeholder="모든 선택 유저에게 동일하게 보낼 내용을 입력하세요."
              className="min-h-[140px] resize-none bg-white"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                변수 없이 쓰면 동일 본문, 예를 들어 <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px]">{'{{username}}'}</code>{' '}
                같은 변수를 쓰면 선택한 유저 컬럼 값으로 개인화됩니다.
              </span>
              <span>{isAdvertisement ? `실제 발송 ${formattedResolvedBody.length}자` : `${resolvedBody.length}자`}</span>
            </div>
          </div>

          <div className="space-y-4 rounded-[28px] border border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,219,0.92),rgba(255,255,255,0.98))] p-5 lg:col-span-2">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={isAdvertisement}
                onChange={(event) => setIsAdvertisement(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <div className="space-y-2">
                <div className="text-sm font-semibold text-foreground">광고메시지 여부</div>
                <div className="text-xs leading-5 text-muted-foreground">
                  광고문자를 발송하는 경우 반드시 체크합니다. 체크 시 메시지 상단에 `(광고)서비스명`, 하단에{' '}
                  <code className="rounded bg-white px-1 py-0.5 text-[11px] text-amber-900">{SMS_ADVERTISEMENT_OPT_OUT_TEXT}</code>
                  가 자동 포함됩니다.
                </div>
                <div className="rounded-2xl border border-amber-200/80 bg-white/80 px-4 py-3 text-[11px] leading-5 text-amber-950">
                  광고 문자임에도 광고 표기 가이드라인을 지키지 않으면 이용 약관에 따라 예고 없이 계정이 차단될 수 있으며, 환불도 불가능합니다.
                </div>
              </div>
            </label>

            {isAdvertisement ? (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
                <div className="space-y-2">
                  <Label htmlFor="bulk-advertising-service-name">광고 서비스명</Label>
                  <Input
                    id="bulk-advertising-service-name"
                    value={advertisingServiceName}
                    onChange={(event) => setAdvertisingServiceName(event.target.value)}
                    placeholder="예: 비주오"
                    className="bg-white"
                  />
                  <p className="text-[11px] leading-5 text-muted-foreground">
                    사업자 정보 자동 채움은 아직 연결 전이라 비워둘 수 있습니다. 비워두면 `(광고)`만 붙습니다.
                  </p>
                </div>

                <div className="rounded-2xl border border-amber-300/80 bg-white px-4 py-4 shadow-sm">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">실제 발송 미리보기</div>
                  <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
                    {resolvedBody.trim()
                      ? formattedResolvedBody
                      : '본문을 입력하거나 템플릿을 선택하면 광고 표기 포함 최종 본문이 여기에 표시됩니다.'}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {templateVariables.length > 0 ? (
            <div className="grid gap-4 lg:col-span-2 2xl:grid-cols-[minmax(0,1.15fr)_360px]">
              <div className="rounded-[28px] border border-primary/15 bg-white/80 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-foreground">변수 컬럼 매핑</div>
                    <div className="mt-1 text-xs leading-5 text-muted-foreground">
                      수동 입력 없이, 각 변수에 어떤 유저 컬럼을 연결할지 선택합니다.
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
                    ? `${previewUser.name} 기준으로 실제 발송 본문이 어떻게 보일지 미리 확인합니다.`
                    : '유저를 선택하면 이 영역에 실제 렌더링 예시가 나타납니다.'}
                </div>

                <div className="mt-4 rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-inner">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Rendered SMS</div>
                  <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-foreground">
                    {previewMessage || resolvedBody || '본문을 입력하면 미리보기가 준비됩니다.'}
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {variableRows.map((row) => (
                    <div key={row.variable} className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-white/80 px-3 py-3">
                      <div className="font-mono text-xs font-semibold text-foreground">{row.variable}</div>
                      <div className="text-right text-xs text-muted-foreground">
                        {row.field ? row.field.label : '컬럼 미선택'}
                      </div>
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
              tone="sms"
              primaryLabel="대량 SMS 보내기"
              scheduledPrimaryLabel="지금 보내기"
              loadingLabel="대량 SMS 발송 중..."
              loading={sending || loadingPage}
              onPrimaryAction={() => submitBulkSms(null)}
              onScheduledAction={(scheduledAt) => submitBulkSms(scheduledAt)}
              className="md:min-w-[340px] md:max-w-[380px]"
            />
          </div>
        </CardContent>
      </Card>

        <Card className="glass">
        <CardHeader>
          <CardTitle>최근 대량 SMS 배치</CardTitle>
          <CardDescription>최근에 등록한 대량 SMS의 NHN 접수 및 예약 결과입니다. 수신자 미리보기와 요청 ID를 함께 확인할 수 있습니다.</CardDescription>
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
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(campaign.createdAt)} · 발신번호 {campaign.senderNumber.phoneNumber} · 요청 ID {campaign.nhnRequestId || '-'}
                    </div>
                    {campaign.scheduledAt ? (
                      <div className="text-xs text-primary">예약 발송 시각 {formatDate(campaign.scheduledAt)}</div>
                    ) : null}
                    <div className="text-sm leading-6 text-muted-foreground whitespace-pre-wrap">
                      {campaign.body}
                    </div>
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
              아직 대량 SMS 배치가 없습니다.
            </div>
          )}
        </CardContent>
      </Card>
      </SendPageShell>
      <ResourceRequiredDialog
        open={missingSenderNumber}
        icon={Users2}
        badge="발신번호 필요"
        title="대량 SMS를 보낼 발신번호가 아직 없습니다"
        description="대량 SMS는 승인된 발신번호가 있어야 시작할 수 있습니다. 발신번호를 등록하고 승인 상태를 확인하면 이 페이지에서 바로 발송 준비를 이어갈 수 있습니다."
        primaryHref="/send/sms/sender-numbers"
        primaryLabel="발신번호 등록하러 가기"
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
