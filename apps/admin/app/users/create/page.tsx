'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { DatabaseZap, RefreshCw, UserPlus, Users2 } from 'lucide-react';
import { LoginRequiredState, SessionPendingState, TenantAdminRequiredState } from '@/components/access-state';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAdminSession } from '@/hooks/use-admin-session';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { ManagedUser } from '@/types/admin';

type CreateUserResponse = {
  mode: 'created' | 'updated';
  user: ManagedUser;
};

export default function CreateUserPage() {
  const session = useAdminSession();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CreateUserResponse | null>(null);
  const [form, setForm] = useState({
    source: 'manual',
    externalId: '',
    name: '',
    email: '',
    phone: '',
    status: 'ACTIVE' as ManagedUser['status'],
    userType: '',
    segment: '',
    gradeOrLevel: '',
    marketingConsent: 'unset' as 'unset' | 'true' | 'false',
    tags: '',
    registeredAt: '',
    lastLoginAt: '',
    customAttributes: '{\n  "note": "내부 수동 등록"\n}'
  });

  function updateForm<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  async function submit() {
    setSaving(true);
    setError('');
    setResult(null);

    try {
      let customAttributes: Record<string, unknown> | undefined;
      const trimmedJson = form.customAttributes.trim();
      if (trimmedJson) {
        const parsed = JSON.parse(trimmedJson);
        if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
          throw new Error('커스텀 속성 JSON은 객체 형태여야 합니다.');
        }
        customAttributes = parsed as Record<string, unknown>;
      }

      const response = await apiFetch<CreateUserResponse>('/v1/users', {
        method: 'POST',
        body: JSON.stringify({
          source: form.source || undefined,
          externalId: form.externalId || undefined,
          name: form.name,
          email: form.email || undefined,
          phone: form.phone || undefined,
          status: form.status,
          userType: form.userType || undefined,
          segment: form.segment || undefined,
          gradeOrLevel: form.gradeOrLevel || undefined,
          marketingConsent:
            form.marketingConsent === 'unset' ? undefined : form.marketingConsent === 'true',
          tags: form.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
          registeredAt: form.registeredAt ? new Date(form.registeredAt).toISOString() : undefined,
          lastLoginAt: form.lastLoginAt ? new Date(form.lastLoginAt).toISOString() : undefined,
          customAttributes
        })
      });

      setResult(response);
      setForm((current) => ({
        ...current,
        externalId: '',
        name: '',
        email: '',
        phone: '',
        userType: '',
        segment: '',
        gradeOrLevel: '',
        tags: '',
        registeredAt: '',
        lastLoginAt: '',
        customAttributes: '{\n  "note": "내부 수동 등록"\n}'
      }));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '유저 등록에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  if (!session.me) {
    if (session.loading) {
      return (
        <SessionPendingState
          title="유저 추가하기"
          description="유저 추가 화면 접근 권한과 현재 세션을 확인하고 있습니다."
        />
      );
    }

    return (
      <LoginRequiredState
        title="유저 추가하기"
        description="내부용 유저를 직접 등록하려면 먼저 사업자 계정으로 로그인해야 합니다."
        nextPath="/users/create"
        error={session.error}
      />
    );
  }

  if (session.me.role === 'OPERATOR') {
    return (
      <TenantAdminRequiredState
        title="사업자 계정이 필요합니다"
        description="유저 직접 등록은 테넌트 단위 데이터 작업이라 `USER` 세션에서만 허용합니다."
        message="로그인 페이지에서 사업자 계정으로 다시 인증한 뒤 이 메뉴를 사용하세요."
        nextPath="/users/create"
      />
    );
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[32px] border border-border/70 bg-card/90 shadow-soft">
        <div className="relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_45%),radial-gradient(circle_at_bottom_right,_rgba(37,99,235,0.12),_transparent_40%)]" />
          <div className="relative grid gap-6 px-7 py-8 lg:grid-cols-[1.35fr_0.85fr]">
            <div className="space-y-4">
              <Badge variant="outline" className="w-fit border-emerald-500/20 bg-emerald-500/5 text-emerald-700">
                Internal Entry
              </Badge>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">유저 추가하기</h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  외부 가져오기 전에 테스트 대상이나 운영 보정용 유저를 빠르게 직접 등록하는 내부용 화면입니다.
                  같은 `source` 안에서 외부 ID, 이메일, 전화번호가 이미 있으면 새로 만들지 않고 기존 유저를 업데이트합니다.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/users" className={cn(buttonVariants({ variant: 'outline' }), 'rounded-xl')}>
                  <Users2 className="mr-2 h-4 w-4" />
                  유저 목록
                </Link>
                <Link href="/users/import" className={cn(buttonVariants({ variant: 'outline' }), 'rounded-xl')}>
                  <DatabaseZap className="mr-2 h-4 w-4" />
                  유저 불러오기
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryCard label="기본 source" value={form.source || 'manual'} hint="중복 판별은 source 기준으로 묶입니다." />
              <SummaryCard label="등록 상태" value={form.status} hint="새 유저는 기본적으로 ACTIVE 입니다." />
              <SummaryCard label="태그" value={`${form.tags.split(',').map((tag) => tag.trim()).filter(Boolean).length}개`} hint="쉼표로 구분해 입력합니다." />
              <SummaryCard label="커스텀 JSON" value={form.customAttributes.trim() ? '사용 중' : '없음'} hint="새 키는 자동으로 커스텀 컬럼에 추가됩니다." />
            </div>
          </div>
        </div>
      </section>

      {(session.error || error) && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {session.error || error}
        </div>
      )}

      {result ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700">
          {result.mode === 'created' ? '새 유저를 등록했습니다.' : '기존 유저를 업데이트했습니다.'} 이름은 `{result.user.name}`,
          source는 `{result.user.source}` 입니다.
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-border/70 bg-card/95">
          <CardHeader>
            <CardTitle className="text-xl">기본 정보</CardTitle>
            <CardDescription>검색과 발송 대상 매칭에 자주 쓰는 공통 필드입니다.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <Field>
              <Label htmlFor="source">source</Label>
              <Input id="source" value={form.source} onChange={(event) => updateForm('source', event.target.value)} />
            </Field>
            <Field>
              <Label htmlFor="externalId">외부 ID</Label>
              <Input id="externalId" value={form.externalId} onChange={(event) => updateForm('externalId', event.target.value)} placeholder="manual_user_1001" />
            </Field>
            <Field>
              <Label htmlFor="name">이름</Label>
              <Input id="name" value={form.name} onChange={(event) => updateForm('name', event.target.value)} placeholder="김민우" />
            </Field>
            <Field>
              <Label htmlFor="status">상태</Label>
              <Select value={form.status} onValueChange={(value) => updateForm('status', value as ManagedUser['status'])}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                  <SelectItem value="INACTIVE">INACTIVE</SelectItem>
                  <SelectItem value="DORMANT">DORMANT</SelectItem>
                  <SelectItem value="BLOCKED">BLOCKED</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <Label htmlFor="email">이메일</Label>
              <Input id="email" type="email" value={form.email} onChange={(event) => updateForm('email', event.target.value)} placeholder="minu@example.com" />
            </Field>
            <Field>
              <Label htmlFor="phone">전화번호</Label>
              <Input id="phone" value={form.phone} onChange={(event) => updateForm('phone', event.target.value)} placeholder="01012345678" />
            </Field>
            <Field>
              <Label htmlFor="userType">유형</Label>
              <Input id="userType" value={form.userType} onChange={(event) => updateForm('userType', event.target.value)} placeholder="학생 / 회원 / 임직원" />
            </Field>
            <Field>
              <Label htmlFor="segment">세그먼트</Label>
              <Input id="segment" value={form.segment} onChange={(event) => updateForm('segment', event.target.value)} placeholder="Spring 5기" />
            </Field>
            <Field>
              <Label htmlFor="gradeOrLevel">등급/레벨</Label>
              <Input id="gradeOrLevel" value={form.gradeOrLevel} onChange={(event) => updateForm('gradeOrLevel', event.target.value)} placeholder="Gold" />
            </Field>
            <Field>
              <Label htmlFor="marketingConsent">마케팅 수신</Label>
              <Select value={form.marketingConsent} onValueChange={(value) => updateForm('marketingConsent', value as 'unset' | 'true' | 'false')}>
                <SelectTrigger id="marketingConsent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">미입력</SelectItem>
                  <SelectItem value="true">동의</SelectItem>
                  <SelectItem value="false">미동의</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95">
          <CardHeader>
            <CardTitle className="text-xl">확장 필드</CardTitle>
            <CardDescription>내부 운영에 필요한 보조 정보와 커스텀 속성을 같이 넣습니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Field>
              <Label htmlFor="tags">태그</Label>
              <Input
                id="tags"
                value={form.tags}
                onChange={(event) => updateForm('tags', event.target.value)}
                placeholder="vip, internal, sample"
              />
            </Field>
            <Field>
              <Label htmlFor="registeredAt">가입일</Label>
              <Input
                id="registeredAt"
                type="datetime-local"
                value={form.registeredAt}
                onChange={(event) => updateForm('registeredAt', event.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="lastLoginAt">최근 로그인</Label>
              <Input
                id="lastLoginAt"
                type="datetime-local"
                value={form.lastLoginAt}
                onChange={(event) => updateForm('lastLoginAt', event.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="customAttributes">커스텀 속성 JSON</Label>
              <Textarea
                id="customAttributes"
                value={form.customAttributes}
                onChange={(event) => updateForm('customAttributes', event.target.value)}
                rows={12}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                객체 형태 JSON만 허용됩니다. 새 키는 자동으로 커스텀 컬럼으로 등록됩니다.
              </p>
            </Field>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => void submit()} disabled={saving}>
          {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
          유저 저장하기
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setForm({
              source: 'manual',
              externalId: '',
              name: '',
              email: '',
              phone: '',
              status: 'ACTIVE',
              userType: '',
              segment: '',
              gradeOrLevel: '',
              marketingConsent: 'unset',
              tags: '',
              registeredAt: '',
              lastLoginAt: '',
              customAttributes: '{\n  "note": "내부 수동 등록"\n}'
            })
          }
        >
          입력 초기화
        </Button>
      </div>
    </div>
  );
}

function Field({ children }: { children: ReactNode }) {
  return <div className="space-y-2">{children}</div>;
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="border-border/70 bg-background/70">
      <CardContent className="space-y-1 px-4 py-4">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
  );
}
