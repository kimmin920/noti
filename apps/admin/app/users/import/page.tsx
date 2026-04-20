'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, FileJson2, Plus, Sparkles, Trash2, UploadCloud } from 'lucide-react';
import { LoginRequiredState, SessionPendingState, TenantAdminRequiredState } from '@/components/access-state';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useAdminSession } from '@/hooks/use-admin-session';
import { apiFetch } from '@/lib/api';
import {
  buildPreviewUsers,
  buildSystemMappings,
  collectSourcePathOptions,
  DEFAULT_MANAGED_USER_FIELDS,
  extractImportRecords,
  findSamplesForPath,
  SAMPLE_USER_IMPORT_JSON,
  sanitizeCustomFieldKey,
  type ManagedUserImportMapping,
  type SourcePathOption
} from '@/lib/user-import';
import { cn } from '@/lib/utils';
import type { ManagedUserFieldDefinition, ManagedUserFieldType } from '@/types/admin';

type ImportFieldsResponse = {
  fields: ManagedUserFieldDefinition[];
};

type ImportResult = {
  totalReceived: number;
  created: number;
  updated: number;
  skipped: number;
  customFieldsCreated: number;
};

const FIELD_TYPE_OPTIONS: ManagedUserFieldType[] = ['TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'DATETIME', 'JSON'];

function formatDate(value: string | null) {
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

function prettifySourceLabel(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function dedupeFields(fields: ManagedUserFieldDefinition[]) {
  return fields.reduce<ManagedUserFieldDefinition[]>((acc, field) => {
    if (acc.some((existing) => existing.key === field.key && existing.kind === field.kind)) {
      return acc;
    }
    acc.push(field);
    return acc;
  }, []);
}

function buildUniqueCustomKey(baseKey: string, usedKeys: Set<string>) {
  let candidate = sanitizeCustomFieldKey(baseKey);
  let index = 1;

  while (usedKeys.has(candidate)) {
    candidate = `${sanitizeCustomFieldKey(baseKey)}_${index}`;
    index += 1;
  }

  return candidate;
}

export default function UsersImportPage() {
  const session = useAdminSession();
  const [source, setSource] = useState('publ');
  const [rawJson, setRawJson] = useState('');
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [sourcePathOptions, setSourcePathOptions] = useState<SourcePathOption[]>([]);
  const [systemMappings, setSystemMappings] = useState<ManagedUserImportMapping[]>(buildSystemMappings(DEFAULT_MANAGED_USER_FIELDS, []));
  const [customMappings, setCustomMappings] = useState<ManagedUserImportMapping[]>([]);
  const [storedFields, setStoredFields] = useState<ManagedUserFieldDefinition[]>(DEFAULT_MANAGED_USER_FIELDS);
  const [parseError, setParseError] = useState('');
  const [fetchError, setFetchError] = useState('');
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  async function loadFields() {
    try {
      const response = await apiFetch<ImportFieldsResponse>('/v1/users/fields');
      setStoredFields(dedupeFields([...DEFAULT_MANAGED_USER_FIELDS, ...response.fields]));
      setFetchError('');
    } catch (caughtError) {
      setFetchError(caughtError instanceof Error ? caughtError.message : '필드 정의를 불러오지 못했습니다.');
    }
  }

  useEffect(() => {
    if (!session.loading && session.me?.role === 'USER') {
      void loadFields();
    }
  }, [session.loading, session.me?.role]);

  const availableFields = useMemo(
    () => dedupeFields([...DEFAULT_MANAGED_USER_FIELDS, ...storedFields]),
    [storedFields]
  );
  const storedCustomFields = availableFields.filter((field) => field.kind === 'custom');
  const activeMappings = useMemo(
    () => [...systemMappings, ...customMappings].filter((mapping) => mapping.sourcePath.trim()),
    [customMappings, systemMappings]
  );
  const previewUsers = useMemo(
    () => buildPreviewUsers(records, source.trim() || 'publ', activeMappings),
    [activeMappings, records, source]
  );
  const previewCustomMappings = customMappings.filter((mapping) => mapping.sourcePath.trim());

  function analyzeJson() {
    setImportResult(null);
    try {
      const nextRecords = extractImportRecords(rawJson);
      const nextSourcePathOptions = collectSourcePathOptions(nextRecords);

      setRecords(nextRecords);
      setSourcePathOptions(nextSourcePathOptions);
      setSystemMappings(buildSystemMappings(availableFields, nextSourcePathOptions));
      setParseError('');
    } catch (caughtError) {
      setRecords([]);
      setSourcePathOptions([]);
      setSystemMappings(buildSystemMappings(availableFields, []));
      setParseError(caughtError instanceof Error ? caughtError.message : 'JSON 분석에 실패했습니다.');
    }
  }

  function updateSystemMapping(targetKey: string, patch: Partial<ManagedUserImportMapping>) {
    setSystemMappings((current) =>
      current.map((mapping) => (mapping.targetKey === targetKey ? { ...mapping, ...patch } : mapping))
    );
  }

  function updateCustomMapping(targetKey: string, patch: Partial<ManagedUserImportMapping>) {
    setCustomMappings((current) =>
      current.map((mapping) => (mapping.targetKey === targetKey ? { ...mapping, ...patch } : mapping))
    );
  }

  function addCustomMapping(field?: ManagedUserFieldDefinition) {
    const existingKeys = new Set(customMappings.map((mapping) => mapping.targetKey));
    const baseKey = field?.key ?? `custom_field_${customMappings.length + 1}`;
    const targetKey = buildUniqueCustomKey(baseKey, existingKeys);
    const label = field?.label ?? prettifySourceLabel(targetKey);

    setCustomMappings((current) => [
      ...current,
      {
        kind: 'CUSTOM',
        targetKey,
        label,
        dataType: field?.dataType ?? 'TEXT',
        sourcePath: ''
      }
    ]);
  }

  function removeCustomMapping(targetKey: string) {
    setCustomMappings((current) => current.filter((mapping) => mapping.targetKey !== targetKey));
  }

  async function submitImport() {
    if (records.length === 0) {
      setImportError('먼저 JSON을 분석하세요.');
      return;
    }

    const payloadMappings = [
      ...systemMappings
        .filter((mapping) => mapping.sourcePath.trim())
        .map((mapping) => ({
          kind: 'SYSTEM' as const,
          systemField: mapping.targetKey,
          sourcePath: mapping.sourcePath.trim()
        })),
      ...customMappings
        .filter((mapping) => mapping.sourcePath.trim())
        .map((mapping) => ({
          kind: 'CUSTOM' as const,
          customKey: sanitizeCustomFieldKey(mapping.targetKey),
          customLabel: mapping.label.trim() || mapping.targetKey,
          dataType: mapping.dataType,
          sourcePath: mapping.sourcePath.trim()
        }))
    ];

    if (payloadMappings.length === 0) {
      setImportError('최소 한 개 이상의 sourcePath를 매핑하세요.');
      return;
    }

    setImporting(true);
    setImportError('');
    setImportResult(null);

    try {
      const response = await apiFetch<ImportResult>('/v1/users/import', {
        method: 'POST',
        body: JSON.stringify({
          source: source.trim(),
          records,
          mappings: payloadMappings
        })
      });

      setImportResult(response);
      await loadFields();
    } catch (caughtError) {
      setImportError(caughtError instanceof Error ? caughtError.message : '유저 가져오기에 실패했습니다.');
    } finally {
      setImporting(false);
    }
  }

  if (!session.me) {
    if (session.loading) {
      return (
        <SessionPendingState
          title="유저 불러오기"
          description="유저 가져오기 권한과 현재 세션을 확인하고 있습니다."
        />
      );
    }

    return (
      <LoginRequiredState
        title="유저 불러오기"
        description="외부 JSON을 분석해 우리 서비스 기준 유저 스키마로 정규화합니다. 먼저 사업자 계정으로 로그인해야 합니다."
        nextPath="/users/import"
        error={session.error}
      />
    );
  }

  if (session.me.role === 'OPERATOR') {
    return (
      <TenantAdminRequiredState
        title="사업자 계정이 필요합니다"
        description="유저 불러오기는 테넌트 데이터 적재 기능이라 `USER` 세션에서만 사용할 수 있습니다."
        message="로그인 페이지에서 사업자 계정으로 다시 인증한 뒤 이 메뉴를 사용하세요."
        nextPath="/users/import"
      />
    );
  }

  return (
    <div className="space-y-8">
      <datalist id="managed-user-source-paths">
        {sourcePathOptions.map((option) => (
          <option key={option.path} value={option.path} />
        ))}
      </datalist>

      <section className="overflow-hidden rounded-[32px] border border-border/70 bg-card/90 shadow-soft">
        <div className="relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.15),_transparent_42%),radial-gradient(circle_at_bottom_right,_rgba(37,99,235,0.14),_transparent_35%)]" />
          <div className="relative grid gap-6 px-7 py-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <Badge variant="outline" className="w-fit border-primary/20 bg-primary/5 text-primary">
                Source Path Mapper
              </Badge>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">우리 컬럼 = 외부 JSON 경로</h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  이번 방식은 <code>name -&gt; user.name</code>, <code>phone -&gt; user.profileAdditionalInformations.value</code>
                  처럼 우리 쪽 컬럼이 어떤 JSON 경로를 읽을지 직접 지정합니다. Nested object도 <code>key.key.key</code> 방식으로
                  바로 매핑할 수 있습니다.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                <div className="rounded-full border border-border/70 bg-background/70 px-3 py-1.5">1. Array&lt;Object&gt; 분석</div>
                <div className="rounded-full border border-border/70 bg-background/70 px-3 py-1.5">2. sourcePath 선택</div>
                <div className="rounded-full border border-border/70 bg-background/70 px-3 py-1.5">3. 커스텀 컬럼 추가</div>
                <div className="rounded-full border border-border/70 bg-background/70 px-3 py-1.5">4. 미리보기 후 저장</div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <StepCard label="레코드" value={`${records.length}건`} hint="분석된 Array<Object> 행 수" />
              <StepCard label="탐지 경로" value={`${sourcePathOptions.length}개`} hint="nested path 포함 sourcePath 후보" />
              <StepCard label="기본 컬럼" value={`${systemMappings.length}개`} hint="이름/전화번호/이메일/수신여부 등" />
              <StepCard label="추가 컬럼" value={`${customMappings.length}개`} hint="동적으로 늘린 커스텀 컬럼" />
            </div>
          </div>
        </div>
      </section>

      {(session.error || fetchError || parseError || importError) && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {session.error || fetchError || parseError || importError}
        </div>
      )}

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-border/70 bg-card/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <FileJson2 className="h-5 w-5 text-primary" />
              원본 JSON
            </CardTitle>
            <CardDescription>
              기본 입력은 <code>[&#123;...&#125;, &#123;...&#125;]</code> 이며 nested object는 자동으로 sourcePath 후보를
              뽑아냅니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[0.75fr_0.25fr]">
              <div className="space-y-2">
                <Label htmlFor="user-import-source">외부 소스 이름</Label>
                <Input
                  id="user-import-source"
                  value={source}
                  onChange={(event) => setSource(event.target.value)}
                  placeholder="publ"
                  className="h-11 rounded-2xl"
                />
              </div>
              <div className="flex items-end gap-2">
                <Button type="button" variant="outline" className="w-full rounded-2xl" onClick={() => setRawJson(SAMPLE_USER_IMPORT_JSON)}>
                  샘플 넣기
                </Button>
                <Button type="button" className="w-full rounded-2xl" onClick={analyzeJson}>
                  분석 실행
                </Button>
              </div>
            </div>

            <Textarea
              value={rawJson}
              onChange={(event) => setRawJson(event.target.value)}
              placeholder='[{"user":{"name":"홍길동","profileAdditionalInformations":{"value":"01012345678"}}}]'
              className="min-h-[320px] rounded-[24px] bg-background/80 font-mono text-xs leading-6"
            />
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95">
          <CardHeader>
            <CardTitle className="text-xl">탐지된 sourcePath</CardTitle>
            <CardDescription>콤보박스처럼 입력창에서 바로 추천될 경로 목록입니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {sourcePathOptions.length > 0 ? (
              sourcePathOptions.slice(0, 24).map((option) => (
                <div key={option.path} className="rounded-[20px] border border-border/70 bg-muted/20 p-3">
                  <div className="font-mono text-sm text-foreground">{option.path}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {option.samples.length > 0 ? option.samples.join(' / ') : '샘플 없음'}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
                JSON을 분석하면 nested path 목록이 여기에 나옵니다.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="border-border/70 bg-card/95">
        <CardHeader>
          <CardTitle className="text-xl">기본 컬럼 매핑</CardTitle>
          <CardDescription>
            기본적으로 이름, 전화번호, 이메일, 수신 여부 등이 준비되어 있고, 각 컬럼이 바라볼 sourcePath만 지정하면 됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {systemMappings.map((mapping) => (
            <MappingCard
              key={mapping.targetKey}
              mapping={mapping}
              pathOptions={sourcePathOptions}
              onPathChange={(value) => updateSystemMapping(mapping.targetKey, { sourcePath: value })}
            />
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/95">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="text-xl">추가 컬럼</CardTitle>
            <CardDescription>우리 쪽에서 관리할 키 이름, 표시 이름, 타입, sourcePath를 직접 추가합니다.</CardDescription>
          </div>
          <Button type="button" className="rounded-2xl" onClick={() => addCustomMapping()}>
            <Plus className="mr-2 h-4 w-4" />
            새 컬럼 추가
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {storedCustomFields.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {storedCustomFields.map((field) => (
                <button
                  key={field.key}
                  type="button"
                  onClick={() => addCustomMapping(field)}
                  className="rounded-full border border-border/70 bg-muted/20 px-3 py-1.5 text-sm text-foreground transition hover:bg-muted/40"
                >
                  {field.label}
                </button>
              ))}
            </div>
          )}

          {customMappings.length > 0 ? (
            customMappings.map((mapping) => (
              <div key={mapping.targetKey} className="rounded-[24px] border border-border/70 bg-muted/20 p-4">
                <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr_auto]">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>우리 키 이름</Label>
                      <Input
                        value={mapping.targetKey}
                        onChange={(event) =>
                          updateCustomMapping(mapping.targetKey, { targetKey: sanitizeCustomFieldKey(event.target.value) })
                        }
                        className="h-11 rounded-2xl"
                        placeholder="point_balance"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>표시 이름</Label>
                      <Input
                        value={mapping.label}
                        onChange={(event) => updateCustomMapping(mapping.targetKey, { label: event.target.value })}
                        className="h-11 rounded-2xl"
                        placeholder="포인트 잔액"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[220px_1fr]">
                    <div className="space-y-2">
                      <Label>타입</Label>
                      <Select
                        value={mapping.dataType}
                        onValueChange={(value) =>
                          updateCustomMapping(mapping.targetKey, { dataType: value as ManagedUserFieldType })
                        }
                      >
                        <SelectTrigger className="h-11 rounded-2xl bg-background/80">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_TYPE_OPTIONS.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>외부 JSON 경로</Label>
                      <Input
                        value={mapping.sourcePath}
                        onChange={(event) => updateCustomMapping(mapping.targetKey, { sourcePath: event.target.value })}
                        placeholder="user.profileAdditionalInformations.value"
                        list="managed-user-source-paths"
                        className="h-11 rounded-2xl bg-background/80 font-mono text-sm"
                      />
                      <div className="text-xs text-muted-foreground">
                        {findSamplesForPath(sourcePathOptions, mapping.sourcePath).join(' / ') || '샘플 미리보기 없음'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start justify-end">
                    <Button type="button" variant="outline" className="rounded-2xl" onClick={() => removeCustomMapping(mapping.targetKey)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      삭제
                    </Button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[24px] border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
              아직 추가 컬럼이 없습니다. <code>새 컬럼 추가</code>로 dynamic column을 만들어보세요.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/95">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-primary" />
              정규화 미리보기
            </CardTitle>
            <CardDescription>현재 sourcePath 매핑 기준으로 저장될 형태를 5행까지 미리 보여줍니다.</CardDescription>
          </div>
          <Badge variant="secondary">미리보기 {previewUsers.length}행</Badge>
        </CardHeader>
        <CardContent>
          <Table className="min-w-[920px]">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[120px]">소스</TableHead>
                <TableHead className="min-w-[160px]">이름</TableHead>
                <TableHead className="min-w-[160px]">전화번호</TableHead>
                <TableHead className="min-w-[220px]">이메일</TableHead>
                <TableHead className="min-w-[110px]">수신 여부</TableHead>
                <TableHead className="min-w-[140px]">외부 ID</TableHead>
                {previewCustomMappings.map((mapping) => (
                  <TableHead key={mapping.targetKey} className="min-w-[140px]">
                    {mapping.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewUsers.length > 0 ? (
                previewUsers.map((user, index) => (
                  <TableRow key={`${user.source}_${user.externalId || index}`}>
                    <TableCell><Badge variant="outline">{user.source}</Badge></TableCell>
                    <TableCell>{user.name}</TableCell>
                    <TableCell>{user.phone || '-'}</TableCell>
                    <TableCell>{user.email || '-'}</TableCell>
                    <TableCell>{user.marketingConsent === null ? '-' : user.marketingConsent ? '수신' : '미수신'}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{user.externalId || '-'}</TableCell>
                    {previewCustomMappings.map((mapping) => (
                      <TableCell key={`${mapping.targetKey}_${index}`}>
                        {user.customAttributes?.[mapping.targetKey] === undefined || user.customAttributes?.[mapping.targetKey] === null
                          ? '-'
                          : String(user.customAttributes[mapping.targetKey])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6 + previewCustomMappings.length} className="py-10 text-center text-sm text-muted-foreground">
                    JSON을 분석하고 sourcePath를 지정하면 여기에서 저장 전 결과를 확인할 수 있습니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/95">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <UploadCloud className="h-5 w-5 text-primary" />
            가져오기 실행
          </CardTitle>
          <CardDescription>
            현재 sourcePath 매핑 구성을 기준으로 유저를 저장합니다. custom column은 이번 설정 그대로 같이 생성됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {importResult && (
            <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-900">
              총 {importResult.totalReceived}건 중 {importResult.created}건 생성, {importResult.updated}건 업데이트,
              {importResult.skipped}건 스킵, 새 컬럼 {importResult.customFieldsCreated}개를 반영했습니다.
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button type="button" className="rounded-2xl" onClick={submitImport} disabled={importing || records.length === 0}>
              {importing ? '가져오는 중...' : '유저 가져오기 실행'}
            </Button>
            <Link href="/users" className={cn(buttonVariants({ variant: 'outline' }), 'rounded-2xl')}>
              유저 목록으로 이동
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MappingCard({
  mapping,
  pathOptions,
  onPathChange
}: {
  mapping: ManagedUserImportMapping;
  pathOptions: SourcePathOption[];
  onPathChange: (value: string) => void;
}) {
  return (
    <div className="rounded-[24px] border border-border/70 bg-muted/20 p-4">
      <div className="grid gap-4 xl:grid-cols-[0.7fr_1.3fr]">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{mapping.label}</Badge>
            <Badge variant="secondary">{mapping.dataType}</Badge>
          </div>
          <div className="text-xs leading-5 text-muted-foreground">
            우리 서비스의 <code>{mapping.targetKey}</code> 컬럼이 읽어올 외부 JSON 경로를 지정하세요.
          </div>
        </div>

        <div className="space-y-2">
          <Label>외부 JSON 경로</Label>
          <Input
            value={mapping.sourcePath}
            onChange={(event) => onPathChange(event.target.value)}
            placeholder="user.profileAdditionalInformations.value"
            list="managed-user-source-paths"
            className="h-11 rounded-2xl bg-background/80 font-mono text-sm"
          />
          <div className="text-xs text-muted-foreground">
            {findSamplesForPath(pathOptions, mapping.sourcePath).join(' / ') || '샘플 미리보기 없음'}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-[24px] border border-white/70 bg-white/80 p-4 shadow-sm shadow-slate-200/60">
      <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">{value}</div>
      <div className="mt-2 text-xs leading-5 text-muted-foreground">{hint}</div>
    </div>
  );
}
