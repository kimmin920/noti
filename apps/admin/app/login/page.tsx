'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { AuthSection } from '@/components/auth-section';
import { SessionPendingState } from '@/components/access-state';
import { buttonVariants } from '@/components/ui/button';
import { useAdminSession } from '@/hooks/use-admin-session';
import { cn } from '@/lib/utils';

function sanitizeNextPath(candidate: string | null) {
  if (!candidate || !candidate.startsWith('/')) {
    return '/';
  }

  return candidate;
}

function buildDevChunkPath(nextPath: string) {
  const normalized = nextPath
    .split(/[?#]/, 1)[0]
    .replace(/^\/+|\/+$/g, '');

  return normalized
    ? `/_next/static/chunks/app/${normalized}/page.js`
    : '/_next/static/chunks/app/page.js';
}

async function warmNextPath(nextPath: string, signal: AbortSignal) {
  try {
    await fetch(nextPath, {
      cache: 'no-store',
      credentials: 'same-origin',
      signal
    });
  } catch {
    // Ignore route warmup failures and fall back to a normal document navigation below.
  }

  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  const chunkPath = buildDevChunkPath(nextPath);
  const startedAt = Date.now();

  while (!signal.aborted && Date.now() - startedAt < 4000) {
    try {
      const response = await fetch(chunkPath, {
        cache: 'no-store',
        credentials: 'same-origin',
        signal
      });

      if (response.ok) {
        return;
      }
    } catch {
      if (signal.aborted) {
        return;
      }
    }

    await new Promise((resolve) => window.setTimeout(resolve, 150));
  }
}

function LoginPageContent() {
  const searchParams = useSearchParams();
  const session = useAdminSession();
  const nextPath = sanitizeNextPath(searchParams.get('next'));
  const [isNextPathReady, setIsNextPathReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setIsNextPathReady(false);

    warmNextPath(nextPath, controller.signal)
      .finally(() => {
        if (!cancelled) {
          setIsNextPathReady(true);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [nextPath]);

  useEffect(() => {
    if (!session.loading && session.me && isNextPathReady) {
      window.location.replace(nextPath);
    }
  }, [isNextPathReady, nextPath, session.loading, session.me]);

  if (session.loading || session.me) {
    return (
      <SessionPendingState
        title="로그인"
        description={
          session.me
            ? '로그인이 확인되어 요청한 화면을 준비하고 있습니다.'
            : '현재 세션을 확인하고 로그인 화면을 준비하고 있습니다.'
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="space-y-3">
        <Link href="/" className={cn(buttonVariants({ variant: 'outline' }), 'w-fit rounded-xl')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          대시보드로 돌아가기
        </Link>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">로그인</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            사업자 운영과 내부 심사 인증을 이 페이지로 모았습니다. 로그인에 성공하면 방금 보던 메뉴로 자동 이동합니다.
          </p>
        </div>
      </header>

      <AuthSection
        me={session.me}
        error={session.error}
        localPasswordLoginEnabled={session.localPasswordLoginEnabled}
        localLoginId={session.localLoginId}
        setLocalLoginId={session.setLocalLoginId}
        localPassword={session.localPassword}
        setLocalPassword={session.setLocalPassword}
        loginWithPassword={session.loginWithPassword}
        ssoToken={session.ssoToken}
        setSsoToken={session.setSsoToken}
        exchangeSso={session.exchangeSso}
        startGoogleLogin={session.startGoogleLogin}
        publServiceToken={session.publServiceToken}
        setPublServiceToken={session.setPublServiceToken}
        isOperator={false}
      />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <SessionPendingState
          title="로그인"
          description="로그인 화면을 준비하고 있습니다."
        />
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
