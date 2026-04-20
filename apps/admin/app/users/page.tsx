'use client';

import Link from 'next/link';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { DatabaseZap, RefreshCw, UserPlus, Users2 } from 'lucide-react';
import { LoginRequiredState, SessionPendingState, TenantAdminRequiredState } from '@/components/access-state';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAdminSession } from '@/hooks/use-admin-session';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { ManagedUser, ManagedUserFieldDefinition, ManagedUsersResponse } from '@/types/admin';

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

function statusVariant(status: ManagedUser['status']) {
  if (status === 'ACTIVE') return 'success';
  if (status === 'DORMANT') return 'warning';
  if (status === 'BLOCKED') return 'danger';
  return 'secondary';
}

function formatCustomValue(value: unknown, field: ManagedUserFieldDefinition) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  if (field.dataType === 'BOOLEAN') {
    return value ? '수신' : '미수신';
  }

  if (field.dataType === 'NUMBER') {
    return typeof value === 'number' ? value.toLocaleString('ko-KR') : String(value);
  }

  if (field.dataType === 'DATE' || field.dataType === 'DATETIME') {
    return typeof value === 'string' ? formatDate(value) : String(value);
  }

  if (field.dataType === 'JSON') {
    return Array.isArray(value) ? value.join(', ') : JSON.stringify(value);
  }

  return String(value);
}

export default function UsersPage() {
  const session = useAdminSession();
  const [response, setResponse] = useState<ManagedUsersResponse | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  async function loadUsers() {
    setLoadingUsers(true);
    setFetchError('');
    try {
      const nextResponse = await apiFetch<ManagedUsersResponse>('/v1/users');
      setResponse(nextResponse);
    } catch (caughtError) {
      setFetchError(caughtError instanceof Error ? caughtError.message : '유저 목록을 불러오지 못했습니다.');
    } finally {
      setLoadingUsers(false);
    }
  }

  useEffect(() => {
    if (!session.loading && session.me?.role === 'USER') {
      void loadUsers();
    }
  }, [session.loading, session.me?.role]);

  const customFields = response?.fields.filter((field) => field.kind === 'custom') ?? [];
  const filteredUsers = useMemo(() => {
    if (!response) {
      return [];
    }

    const keyword = deferredSearch.trim().toLowerCase();
    if (!keyword) {
      return response.users;
    }

    return response.users.filter((user) => {
      const searchable = [
        user.name,
        user.externalId,
        user.source,
        user.email,
        user.phone,
        user.userType,
        user.segment,
        user.gradeOrLevel,
        ...Object.values(user.customAttributes ?? {}).map((value) =>
          typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
            ? String(value)
            : JSON.stringify(value)
        )
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchable.includes(keyword);
    });
  }, [deferredSearch, response]);

  if (!session.me) {
    if (session.loading) {
      return (
        <SessionPendingState
          title="유저 목록"
          description="유저 목록 접근 권한과 현재 세션을 확인하고 있습니다."
        />
      );
    }

    return (
      <LoginRequiredState
        title="유저 목록"
        description="외부 소스에서 정규화된 유저 데이터를 조회합니다. 먼저 사업자 계정으로 로그인해야 합니다."
        nextPath="/users"
        error={session.error}
      />
    );
  }

  if (session.me.role === 'OPERATOR') {
    return (
      <TenantAdminRequiredState
        title="사업자 계정이 필요합니다"
        description="유저 관리는 테넌트 단위 데이터입니다. `USER` 세션에서만 목록 조회와 가져오기를 허용합니다."
        message="로그인 페이지에서 사업자 계정으로 다시 인증한 뒤 이 메뉴를 사용하세요."
        nextPath="/users"
      />
    );
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[32px] border border-border/70 bg-card/90 shadow-soft">
        <div className="relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.16),_transparent_45%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.12),_transparent_40%)]" />
          <div className="relative grid gap-6 px-7 py-8 lg:grid-cols-[1.4fr_0.9fr]">
            <div className="space-y-4">
              <Badge variant="outline" className="w-fit border-primary/20 bg-primary/5 text-primary">
                User Console
              </Badge>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">유저 기본 테이블</h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  커머스, 강의, 멤버십처럼 소스마다 다른 스키마를 `우리 서비스 기준 유저 스키마`로 정규화해 관리합니다.
                  오른쪽 상단에서 최신 데이터를 다시 불러오거나, 새 JSON을 가져와 컬럼을 확장할 수 있습니다.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void loadUsers()}
                  className={cn(
                    buttonVariants({ variant: 'outline' }),
                    'rounded-xl border-primary/20 bg-white/80 hover:bg-primary/5'
                  )}
                  disabled={loadingUsers}
                >
                  <RefreshCw className={cn('mr-2 h-4 w-4', loadingUsers && 'animate-spin')} />
                  목록 새로고침
                </button>
                <Link href="/users/import" className={cn(buttonVariants({ variant: 'default' }), 'rounded-xl')}>
                  <DatabaseZap className="mr-2 h-4 w-4" />
                  유저 불러오기
                </Link>
                <Link href="/users/create" className={cn(buttonVariants({ variant: 'outline' }), 'rounded-xl')}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  유저 추가하기
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryCard label="전체 유저" value={`${response?.summary.totalUsers ?? 0}명`} hint="현재 테넌트에 적재된 유저" />
              <SummaryCard label="활성 유저" value={`${response?.summary.activeUsers ?? 0}명`} hint="정상 상태로 분류된 유저" />
              <SummaryCard label="연동 소스" value={`${response?.summary.sourceCount ?? 0}개`} hint="퍼블, LMS 등 외부 공급원 수" />
              <SummaryCard label="커스텀 컬럼" value={`${response?.summary.customFieldCount ?? 0}개`} hint="가져오기 중 새로 만든 컬럼" />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-border/70 bg-card/95">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">빠른 검색</CardTitle>
            <CardDescription>이름, 외부 ID, 연락처, 커스텀 컬럼 값으로 유저를 찾습니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="예: 김민우 / publ_user_1001 / Gold / 포인트"
              className="h-11 rounded-2xl bg-background/80"
            />
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">소스 분포</CardTitle>
            <CardDescription>현재 저장된 유저가 어느 외부 소스에서 들어왔는지 보여줍니다.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {(response?.sourceBreakdown ?? []).length > 0 ? (
              response?.sourceBreakdown.map((source) => (
                <div key={source.source} className="rounded-2xl border border-border/70 bg-muted/30 px-3 py-2 text-sm">
                  <div className="font-medium text-foreground">{source.source}</div>
                  <div className="text-xs text-muted-foreground">{source.count}명</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">아직 가져온 소스가 없습니다.</div>
            )}
          </CardContent>
        </Card>
      </section>

      {(session.error || fetchError) && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {session.error || fetchError}
        </div>
      )}

      <Card className="border-border/70 bg-card/95">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="text-xl">정규화된 유저 테이블</CardTitle>
            <CardDescription>
              기본 컬럼은 공통 스키마를 따르고, 오른쪽 끝에는 가져오기 과정에서 만든 커스텀 컬럼이 이어집니다.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="w-fit">
            검색 결과 {filteredUsers.length}명
          </Badge>
        </CardHeader>
        <CardContent>
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[220px]">이름</TableHead>
                <TableHead className="min-w-[140px]">외부 ID</TableHead>
                <TableHead className="min-w-[120px]">소스</TableHead>
                <TableHead className="min-w-[220px]">연락처</TableHead>
                <TableHead className="min-w-[110px]">상태</TableHead>
                <TableHead className="min-w-[120px]">등급/레벨</TableHead>
                <TableHead className="min-w-[100px]">마케팅</TableHead>
                <TableHead className="min-w-[160px]">가입일</TableHead>
                <TableHead className="min-w-[160px]">최근 로그인</TableHead>
                {customFields.map((field) => (
                  <TableHead key={field.key} className="min-w-[140px]">
                    {field.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-foreground">{user.name}</div>
                        <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                          {user.userType && <span>{user.userType}</span>}
                          {user.segment && <span>{user.segment}</span>}
                          {user.tags?.length ? <span>{user.tags.join(', ')}</span> : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{user.externalId || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{user.source}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div>{user.email || '-'}</div>
                        <div className="text-xs text-muted-foreground">{user.phone || '-'}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(user.status)}>{user.status}</Badge>
                    </TableCell>
                    <TableCell>{user.gradeOrLevel || '-'}</TableCell>
                    <TableCell>{user.marketingConsent === null ? '-' : user.marketingConsent ? '수신' : '미수신'}</TableCell>
                    <TableCell>{formatDate(user.registeredAt)}</TableCell>
                    <TableCell>{formatDate(user.lastLoginAt)}</TableCell>
                    {customFields.map((field) => (
                      <TableCell key={`${user.id}_${field.key}`}>
                        {formatCustomValue(user.customAttributes?.[field.key], field)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9 + customFields.length} className="py-12 text-center text-sm text-muted-foreground">
                    아직 가져온 유저가 없습니다. `유저 불러오기` 메뉴에서 JSON을 붙여 첫 번째 소스를 연결해보세요.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-[24px] border border-white/70 bg-white/80 p-4 shadow-sm shadow-slate-200/60">
      <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
        <Users2 className="h-5 w-5 text-primary" />
        {value}
      </div>
      <div className="mt-2 text-xs leading-5 text-muted-foreground">{hint}</div>
    </div>
  );
}
