"use client";

import { useEffectEvent } from "react";
import { usePathname } from "next/navigation";
import type { V2BootstrapResponse, V2DashboardResponse } from "@/lib/api/v2";
import type {
  V2KakaoSendOptionsResponse,
  V2KakaoSendReadinessResponse,
  V2SmsSendOptionsResponse,
  V2SmsSendReadinessResponse,
} from "@/lib/api/v2";
import type { AuthSessionSnapshot } from "@/lib/auth-types";
import { AuthGate, AuthLoadingScreen } from "@/components/auth/AuthGate";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";
import { useAuthSession } from "@/lib/hooks/use-auth-session";
import { useV2ShellData, type V2InitialShellData } from "@/lib/hooks/use-v2-shell-data";
import { useAppStore } from "@/lib/store/app-store";
import { useRouteNavigate } from "@/lib/hooks/use-route-navigate";
import { getPageIdByPath } from "@/lib/routes";
import type { PageId, ResourceState, ScheduledStatus } from "@/lib/store/types";
import { FloatingHelper } from "@/components/floating/FloatingHelper";
import { ModalLayer } from "@/components/modals/ModalLayer";
import { DraftToast } from "@/components/toast/DraftToast";
import { DevPanel } from "./DevPanel";
import { PageContent } from "./PageContent";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({
  initialPage = "dashboard",
  initialAuthState,
  initialShellData,
  initialSmsSendData,
  initialKakaoSendData,
}: {
  initialPage?: PageId;
  initialAuthState?: AuthSessionSnapshot;
  initialShellData?: V2InitialShellData;
  initialSmsSendData?: {
    readiness: V2SmsSendReadinessResponse | null;
    options: V2SmsSendOptionsResponse | null;
  };
  initialKakaoSendData?: {
    readiness: V2KakaoSendReadinessResponse | null;
    options: V2KakaoSendOptionsResponse | null;
  };
}) {
  const pathname = usePathname();
  const pageFromPath = pathname ? getPageIdByPath(pathname) : null;
  const activePage = pageFromPath ?? initialPage;
  const auth = useAuthSession(initialAuthState);

  if (auth.status === "loading") {
    return <AuthLoadingScreen currentPage={activePage} />;
  }

  if (auth.status !== "authenticated") {
    return (
      <AuthGate
        currentPage={activePage}
        sessionError={auth.status === "error" ? auth.error : null}
        onRetrySessionCheck={auth.refreshSession}
        onSignedIn={auth.refreshSession}
      />
    );
  }

  if (!auth.session) {
    return <AuthLoadingScreen currentPage={activePage} />;
  }

  return (
    <AuthenticatedShell
      activePage={activePage}
      session={auth.session}
      onSignedOut={auth.refreshSession}
      initialShellData={initialShellData}
      initialSmsSendData={initialSmsSendData}
      initialKakaoSendData={initialKakaoSendData}
    />
  );
}

function AuthenticatedShell({
  activePage,
  session,
  onSignedOut,
  initialShellData,
  initialSmsSendData,
  initialKakaoSendData,
}: {
  activePage: PageId;
  session: NonNullable<AuthSessionSnapshot["session"]>;
  onSignedOut: () => void | Promise<void>;
  initialShellData?: V2InitialShellData;
  initialSmsSendData?: {
    readiness: V2SmsSendReadinessResponse | null;
    options: V2SmsSendOptionsResponse | null;
  };
  initialKakaoSendData?: {
    readiness: V2KakaoSendReadinessResponse | null;
    options: V2KakaoSendOptionsResponse | null;
  };
}) {
  const storedResources = useAppStore((state) => state.resources);
  const navigate = useRouteNavigate();
  const activeResourceTab = useAppStore((state) => state.ui.activeResourceTab);
  const setActiveResourceTab = useAppStore((state) => state.setActiveResourceTab);
  const clearNavigationPending = useAppStore((state) => state.clearNavigationPending);
  const closeDevPanel = useAppStore((state) => state.closeDevPanel);
  const closeTopbarNotice = useAppStore((state) => state.closeTopbarNotice);
  const closeFloatingHelper = useAppStore((state) => state.closeFloatingHelper);
  const closeSmsRegModal = useAppStore((state) => state.closeSmsRegModal);
  const closeKakaoRegModal = useAppStore((state) => state.closeKakaoRegModal);
  const closeLockedModal = useAppStore((state) => state.closeLockedModal);
  const openSmsRegModal = useAppStore((state) => state.openSmsRegModal);
  const openKakaoRegModal = useAppStore((state) => state.openKakaoRegModal);
  const { data, loading, errors, refreshCurrentPage } = useV2ShellData(activePage, initialShellData);
  const scheduledStatus: ScheduledStatus = data.bootstrap?.counts.enabledEventRuleCount ? "active" : "none";
  const resources = data.bootstrap
    ? {
        ...storedResources,
        sms: data.bootstrap.readiness.resourceState.sms,
        kakao: data.bootstrap.readiness.resourceState.kakao,
        scheduled: scheduledStatus,
      }
    : storedResources;

  useMountEffect(() => {
    clearNavigationPending();

    if (!initialShellData?.bootstrap) {
      return;
    }

    useAppStore.setState((state) => ({
      resources: {
        ...state.resources,
        sms: initialShellData.bootstrap!.readiness.resourceState.sms,
        kakao: initialShellData.bootstrap!.readiness.resourceState.kakao,
        scheduled: initialShellData.bootstrap!.counts.enabledEventRuleCount > 0 ? "active" : "none",
      },
    }));
  });

  const handleDocumentClick = useEffectEvent((event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (!target.closest(".topbar-notice-anchor")) {
      closeTopbarNotice();
    }
    if (!target.closest(".dev-panel") && !target.closest(".dev-toggle")) {
      closeDevPanel();
    }
    if (!target.closest(".notice-anchor")) {
      closeFloatingHelper();
    }
  });

  const handleEscape = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape") {
      closeDevPanel();
      closeTopbarNotice();
      closeFloatingHelper();
      closeSmsRegModal();
      closeKakaoRegModal();
      closeLockedModal();
    }
  });

  useMountEffect(() => {
    const onDocumentClick = (event: MouseEvent) => handleDocumentClick(event);
    const onEscape = (event: KeyboardEvent) => handleEscape(event);

    document.addEventListener("click", onDocumentClick);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("keydown", onEscape);
    };
  });

  return (
    <>
      <Topbar
        activePage={activePage}
        workspaceName={data.bootstrap?.account.tenantName ?? "MessageOps"}
        notices={data.dashboard?.notices ?? []}
        noticeCount={data.bootstrap?.counts.noticeCount ?? 0}
        resources={resources}
        session={session}
        onSignedOut={onSignedOut}
      />
      <DevPanel />
      <div className="layout">
        <Sidebar
          currentPage={activePage}
          resources={resources}
          eventRuleCount={data.bootstrap?.counts.enabledEventRuleCount ?? 0}
        />
        <main className="main">
          <div className="page active">
            <PageContent
              currentPage={activePage}
              resources={resources}
              activeResourceTab={activeResourceTab}
              onNavigate={navigate}
              onChangeResourceTab={setActiveResourceTab}
              onOpenSmsReg={openSmsRegModal}
              onOpenKakaoReg={openKakaoRegModal}
              bootstrapData={data.bootstrap}
              dashboardData={data.dashboard}
              dashboardLoading={loading.dashboard}
              dashboardError={errors.dashboard}
              resourcesData={data.resources}
              resourcesLoading={loading.resources}
              resourcesError={errors.resources}
              templatesData={data.templates}
              templatesLoading={loading.templates}
              templatesError={errors.templates}
              eventsData={data.events}
              eventsLoading={loading.events}
              eventsError={errors.events}
              logsData={data.logs}
              logsLoading={loading.logs}
              logsError={errors.logs}
              opsHealthData={data.opsHealth}
              opsHealthLoading={loading.opsHealth}
              opsHealthError={errors.opsHealth}
              campaignsData={data.campaigns}
              campaignsLoading={loading.campaigns}
              campaignsError={errors.campaigns}
              onRefreshCurrentPage={refreshCurrentPage}
              initialSmsSendData={initialSmsSendData}
              initialKakaoSendData={initialKakaoSendData}
            />
          </div>
        </main>
      </div>
      <FloatingHelper />
      <ModalLayer />
      <DraftToast />
    </>
  );
}
