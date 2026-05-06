"use client";

import { useEffect, useEffectEvent } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { V2BootstrapResponse, V2DashboardResponse, V2KakaoSendPageData } from "@/lib/api/v2";
import type {
  V2KakaoConnectBootstrapResponse,
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
  initialKakaoConnectData,
  initialKakaoSendData,
  initialCampaignDetail,
}: {
  initialPage?: PageId;
  initialAuthState?: AuthSessionSnapshot;
  initialShellData?: V2InitialShellData;
  initialSmsSendData?: {
    readiness: V2SmsSendReadinessResponse | null;
    options: V2SmsSendOptionsResponse | null;
  };
  initialKakaoConnectData?: V2KakaoConnectBootstrapResponse | null;
  initialKakaoSendData?: V2KakaoSendPageData;
  initialCampaignDetail?: {
    campaignId: string;
    campaignChannel: "sms" | "kakao" | "brand";
    from?: "logs" | null;
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
      initialKakaoConnectData={initialKakaoConnectData}
      initialKakaoSendData={initialKakaoSendData}
      initialCampaignDetail={initialCampaignDetail}
    />
  );
}

function AuthenticatedShell({
  activePage,
  session,
  onSignedOut,
  initialShellData,
  initialSmsSendData,
  initialKakaoConnectData,
  initialKakaoSendData,
  initialCampaignDetail,
}: {
  activePage: PageId;
  session: NonNullable<AuthSessionSnapshot["session"]>;
  onSignedOut: () => void | Promise<void>;
  initialShellData?: V2InitialShellData;
  initialSmsSendData?: {
    readiness: V2SmsSendReadinessResponse | null;
    options: V2SmsSendOptionsResponse | null;
  };
  initialKakaoConnectData?: V2KakaoConnectBootstrapResponse | null;
  initialKakaoSendData?: V2KakaoSendPageData;
  initialCampaignDetail?: {
    campaignId: string;
    campaignChannel: "sms" | "kakao" | "brand";
    from?: "logs" | null;
  };
}) {
  const searchParams = useSearchParams();
  const devPanelEnabled =
    process.env.NEXT_PUBLIC_ENABLE_DEV_PANEL === "true" ||
    searchParams?.get("dev") === "1";
  const storedResources = useAppStore((state) => state.resources);
  const devResourceOverrides = useAppStore((state) => state.devResourceOverrides);
  const navigate = useRouteNavigate();
  const isSuperAdminOpsPage = session.role === "SUPER_ADMIN" && activePage === "ops";
  const hideFloatingHelper = isSuperAdminOpsPage || activePage === "sms-mock";
  const canManagePartnerEvents = session.role === "PARTNER_ADMIN";
  const clearNavigationPending = useAppStore((state) => state.clearNavigationPending);
  const closeDevPanel = useAppStore((state) => state.closeDevPanel);
  const closeTopbarNotice = useAppStore((state) => state.closeTopbarNotice);
  const closeFloatingHelper = useAppStore((state) => state.closeFloatingHelper);
  const closeSmsRegModal = useAppStore((state) => state.closeSmsRegModal);
  const closeKakaoRegModal = useAppStore((state) => state.closeKakaoRegModal);
  const closeLockedModal = useAppStore((state) => state.closeLockedModal);
  const { data, loading, errors, refreshCurrentPage } = useV2ShellData(activePage, initialShellData, {
    skipBootstrap: isSuperAdminOpsPage,
    allowEvents: canManagePartnerEvents,
    sessionCacheKey: `${session.userId}:${session.loginProvider}:${session.role}:${session.accessOrigin}`,
  });
  const scheduledStatus: ScheduledStatus = data.bootstrap?.counts.enabledEventRuleCount ? "active" : "none";
  const bootstrapResources = data.bootstrap
    ? {
        ...storedResources,
        sms: data.bootstrap.readiness.resourceState.sms,
        kakao: data.bootstrap.readiness.resourceState.kakao,
        scheduled: scheduledStatus,
      }
    : storedResources;
  const resources = devPanelEnabled
    ? {
        ...bootstrapResources,
        ...devResourceOverrides,
      }
    : bootstrapResources;

  useMountEffect(() => {
    clearNavigationPending();
  });

  useEffect(() => {
    const bootstrap = data.bootstrap;
    if (isSuperAdminOpsPage || !bootstrap) {
      return;
    }

    useAppStore.setState((state) => ({
      resources: {
        ...state.resources,
        sms: bootstrap.readiness.resourceState.sms,
        kakao: bootstrap.readiness.resourceState.kakao,
        scheduled: bootstrap.counts.enabledEventRuleCount > 0 ? "active" : "none",
      },
    }));
  }, [data.bootstrap, isSuperAdminOpsPage]);

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
        serviceName={isSuperAdminOpsPage ? "내부 운영" : data.bootstrap?.currentUser.serviceName ?? "MessageOps"}
        notices={data.dashboard?.notices ?? []}
        noticeCount={isSuperAdminOpsPage ? 0 : data.bootstrap?.counts.noticeCount ?? 0}
        resources={resources}
        session={session}
        onSignedOut={onSignedOut}
        showFallbackNotices={!isSuperAdminOpsPage}
        showDevPanelToggle={devPanelEnabled}
      />
      {devPanelEnabled ? <DevPanel /> : null}
      <div className="layout">
        <Sidebar
          currentPage={activePage}
          resources={resources}
          role={session.role}
          accessOrigin={session.accessOrigin}
          eventRuleCount={isSuperAdminOpsPage ? 0 : data.bootstrap?.counts.enabledEventRuleCount ?? 0}
        />
        <main className="main">
          <div className="page active">
            <PageContent
              currentPage={activePage}
              sessionRole={session.role}
              sessionAccessOrigin={session.accessOrigin}
              resources={resources}
              onNavigate={navigate}
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
              initialCampaignDetail={initialCampaignDetail}
              partnerOverviewData={data.partnerOverview}
              partnerOverviewLoading={loading.partnerOverview}
              partnerOverviewError={errors.partnerOverview}
              onRefreshCurrentPage={refreshCurrentPage}
              initialSmsSendData={initialSmsSendData}
              initialKakaoConnectData={initialKakaoConnectData}
              initialKakaoSendData={initialKakaoSendData}
            />
          </div>
        </main>
      </div>
      {hideFloatingHelper ? null : <FloatingHelper />}
      {isSuperAdminOpsPage ? null : <ModalLayer />}
      {isSuperAdminOpsPage ? null : <DraftToast />}
    </>
  );
}
