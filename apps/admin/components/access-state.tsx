'use client';

import Link from 'next/link';
import { ArrowRight, LoaderCircle, LockKeyhole, ShieldAlert } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

function buildLoginHref(nextPath: string) {
  return `/login?next=${encodeURIComponent(nextPath)}`;
}

interface SessionPendingStateProps {
  title: string;
  description: string;
}

export function SessionPendingState({ title, description }: SessionPendingStateProps) {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </header>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
            세션 확인 중
          </CardTitle>
          <CardDescription>현재 로그인 상태와 접근 가능한 데이터를 확인하고 있습니다.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

interface LoginRequiredStateProps {
  title: string;
  description: string;
  nextPath: string;
  error?: string;
}

export function LoginRequiredState({
  title,
  description,
  nextPath,
  error
}: LoginRequiredStateProps) {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </header>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <LockKeyhole className="h-5 w-5 text-primary" />
            로그인 페이지에서 계속하세요
          </CardTitle>
          <CardDescription>
            인증 폼은 별도 로그인 페이지로 분리했습니다. 로그인 후 지금 보고 있던 화면으로 바로 돌아옵니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Link
            href={buildLoginHref(nextPath)}
            className={cn(buttonVariants(), 'inline-flex rounded-xl shadow-lg shadow-primary/20')}
          >
            로그인 페이지 열기
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
          {error ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

interface TenantAdminRequiredStateProps {
  message: string;
  nextPath: string;
  title?: string;
  description?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}

export function TenantAdminRequiredState({
  message,
  nextPath,
  title = '사업자 계정이 필요합니다',
  description = '이 메뉴는 테넌트 운영 권한이 있는 `USER` 세션에서만 사용할 수 있습니다.',
  primaryLabel = '사업자 계정으로 로그인',
  secondaryHref,
  secondaryLabel
}: TenantAdminRequiredStateProps) {
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-500" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <p>{message}</p>
        <div className="flex flex-wrap gap-3">
          <Link href={buildLoginHref(nextPath)} className={cn(buttonVariants(), 'rounded-xl')}>
            {primaryLabel}
          </Link>
          {secondaryHref && secondaryLabel ? (
            <Link href={secondaryHref} className={cn(buttonVariants({ variant: 'outline' }), 'rounded-xl')}>
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
