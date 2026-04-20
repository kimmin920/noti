'use client';

import { useEffect, useState } from 'react';
import { LoginRequiredState, SessionPendingState, TenantAdminRequiredState } from '@/components/access-state';
import { useRouter } from 'next/navigation';
import { useAdminDashboard } from '@/hooks/use-admin-dashboard';
import { DashboardMessageNavigator } from '@/components/dashboard-message-navigator';
import { DashboardOperationsSection } from '@/components/dashboard-operations-section';
import { SendWorkspaceSection } from '@/components/send-workspace-section';
import { SenderSection } from '@/components/sender-section';
import { LogOut, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';

export default function Page() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const {
    me,
    error,
    loading,
    refreshAll,
    dashboardOverview,
    savingDashboardSettingKey,
    updateDashboardSettings,

    approvedSenderNumbers,
    readySenderProfiles,
    directAlimtalkTemplateOptions,
    logs
  } = useAdminDashboard();

  useEffect(() => {
    const redirectLegacyDashboardHashes = () => {
      if (window.location.hash === '#templates') {
        router.replace('/send/alimtalk/templates');
        return;
      }

      if (window.location.hash === '#senders') {
        router.replace('/send/alimtalk/channels');
      }
    };

    redirectLegacyDashboardHashes();
    window.addEventListener('hashchange', redirectLegacyDashboardHashes);
    return () => window.removeEventListener('hashchange', redirectLegacyDashboardHashes);
  }, [router]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await apiFetch('/v1/auth/logout', { method: 'POST' });
      router.replace('/login');
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  if (loading && !me) {
    return (
      <SessionPendingState
        title="서비스 운영 현황"
        description="Publ 내부 머시징 서비스 통합 관리 대시보드를 불러오고 있습니다."
      />
    );
  }

  if (!me) {
    return (
      <LoginRequiredState
        title="서비스 운영 현황"
        description="로그인 후 발송 워크스페이스와 운영 로그를 한 자리에서 관리할 수 있습니다."
        nextPath="/"
        error={error}
      />
    );
  }

  if (me.role === 'OPERATOR') {
    return (
      <div className="space-y-10 animate-in fade-in duration-500">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">서비스 운영 현황</h1>
            <p className="text-muted-foreground mt-1">Publ 내부 머시징 서비스 통합 관리 대시보드</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={refreshAll} disabled={loading} className="rounded-xl">
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              데이터 갱신
            </Button>
            <Button variant="outline" onClick={() => void handleLogout()} disabled={loggingOut} className="rounded-xl">
              <LogOut className={`mr-2 h-4 w-4 ${loggingOut ? 'animate-pulse' : ''}`} />
              로그아웃
            </Button>
          </div>
        </header>

        <TenantAdminRequiredState
          title="운영자 세션에서는 사업자 대시보드를 표시하지 않습니다"
          description="현재 세션은 내부 심사용 `OPERATOR` 역할입니다. 사업자 운영 메뉴는 `USER` 세션으로 전환해야 합니다."
          message="내부 검수는 전용 도구에서 계속할 수 있고, 템플릿/발송 관리가 필요하면 로그인 페이지에서 사업자 계정으로 다시 인증하세요."
          nextPath="/"
          primaryLabel="사업자 계정으로 전환"
          secondaryHref="/internal"
          secondaryLabel="내부 심사 도구 열기"
        />
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">서비스 운영 현황</h1>
          <p className="text-muted-foreground mt-1">Publ 내부 머시징 서비스 통합 관리 대시보드</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={refreshAll} disabled={loading} className="rounded-xl">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            데이터 갱신
          </Button>
          <Button variant="outline" onClick={() => void handleLogout()} disabled={loggingOut} className="rounded-xl">
            <LogOut className={`mr-2 h-4 w-4 ${loggingOut ? 'animate-pulse' : ''}`} />
            로그아웃
          </Button>
        </div>
      </header>

      <section id="message-navigator">
        <DashboardMessageNavigator
          approvedSenderNumberCount={approvedSenderNumbers.length}
          readySenderProfileCount={readySenderProfiles.length}
          approvedAlimtalkTemplateCount={directAlimtalkTemplateOptions.length}
        />
      </section>

      <section id="send-tools">
        <DashboardOperationsSection
          overview={dashboardOverview}
          loading={loading}
          savingKey={savingDashboardSettingKey}
          onToggleSetting={async (key, value) => {
            await updateDashboardSettings({ [key]: value });
          }}
        />
      </section>

      <section id="workspace">
        <SendWorkspaceSection
          approvedSenderNumberCount={approvedSenderNumbers.length}
          readySenderProfileCount={readySenderProfiles.length}
          approvedAlimtalkTemplateCount={directAlimtalkTemplateOptions.length}
        />
      </section>

      <section id="logs">
        <SenderSection logs={logs} />
      </section>
    </div>
  );
}
