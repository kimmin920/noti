"use client";

import { CampaignPage } from "@/components/campaign/CampaignPage";
import { DashboardPage } from "@/components/dashboard/DashboardPage";
import { DraftInboxPage } from "@/components/drafts/DraftInboxPage";
import { EventsPage } from "@/components/events/EventsPage";
import { KakaoSendPage } from "@/components/kakao/KakaoSendPage";
import { LogsPage } from "@/components/logs/LogsPage";
import { OpsPage } from "@/components/ops/OpsPage";
import { PartnerOverviewPage } from "@/components/partner/PartnerOverviewPage";
import { RecipientsPage } from "@/components/recipients/RecipientsPage";
import { KakaoChannelConnectPage } from "@/components/resources/KakaoChannelConnectPage";
import { ResourcesPage } from "@/components/resources/ResourcesPage";
import { SenderNumberApplicationPage } from "@/components/resources/SenderNumberApplicationPage";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { SmsSendPage } from "@/components/sms/SmsSendPage";
import { TemplatesPage } from "@/components/templates/TemplatesPage";
import type {
  V2BootstrapResponse,
  V2CampaignsResponse,
  V2DashboardResponse,
  V2EventsResponse,
  V2KakaoConnectBootstrapResponse,
  V2KakaoSendOptionsResponse,
  V2KakaoSendReadinessResponse,
  V2LogsResponse,
  V2OpsHealthResponse,
  V2PartnerOverviewResponse,
  V2KakaoResourcesResponse,
  V2ResourcesSummaryResponse,
  V2SmsResourcesResponse,
  V2SmsSendOptionsResponse,
  V2SmsSendReadinessResponse,
  V2KakaoTemplatesResponse,
  V2SmsTemplatesResponse,
  V2TemplatesSummaryResponse,
} from "@/lib/api/v2";
import { getRouteByPageId } from "@/lib/routes";
import type { PageId, ResourceState } from "@/lib/store/types";

type PageContentProps = {
  currentPage: PageId;
  sessionRole: "TENANT_ADMIN" | "PARTNER_ADMIN" | "SUPER_ADMIN";
  sessionPartnerScope: "DIRECT" | "PUBL" | null;
  resources: ResourceState;
  onNavigate: (page: PageId) => void;
  bootstrapData: V2BootstrapResponse | null;
  dashboardData: V2DashboardResponse | null;
  dashboardLoading: boolean;
  dashboardError: string | null;
  resourcesData: {
    summary: V2ResourcesSummaryResponse | null;
    sms: V2SmsResourcesResponse | null;
    kakao: V2KakaoResourcesResponse | null;
  };
  resourcesLoading: boolean;
  resourcesError: string | null;
  templatesData: {
    summary: V2TemplatesSummaryResponse | null;
    sms: V2SmsTemplatesResponse | null;
    kakao: V2KakaoTemplatesResponse | null;
  };
  templatesLoading: boolean;
  templatesError: string | null;
  eventsData: V2EventsResponse | null;
  eventsLoading: boolean;
  eventsError: string | null;
  logsData: V2LogsResponse | null;
  logsLoading: boolean;
  logsError: string | null;
  opsHealthData: V2OpsHealthResponse | null;
  opsHealthLoading: boolean;
  opsHealthError: string | null;
  campaignsData: V2CampaignsResponse | null;
  campaignsLoading: boolean;
  campaignsError: string | null;
  partnerOverviewData: V2PartnerOverviewResponse | null;
  partnerOverviewLoading: boolean;
  partnerOverviewError: string | null;
  onRefreshCurrentPage: () => void;
  initialSmsSendData?: {
    readiness: V2SmsSendReadinessResponse | null;
    options: V2SmsSendOptionsResponse | null;
  };
  initialKakaoConnectData?: V2KakaoConnectBootstrapResponse | null;
  initialKakaoSendData?: {
    readiness: V2KakaoSendReadinessResponse | null;
    options: V2KakaoSendOptionsResponse | null;
  };
};

export function PageContent({
  currentPage,
  sessionRole,
  sessionPartnerScope,
  resources,
  onNavigate,
  bootstrapData,
  dashboardData,
  dashboardLoading,
  dashboardError,
  resourcesData,
  resourcesLoading,
  resourcesError,
  templatesData,
  templatesLoading,
  templatesError,
  eventsData,
  eventsLoading,
  eventsError,
  logsData,
  logsLoading,
  logsError,
  opsHealthData,
  opsHealthLoading,
  opsHealthError,
  campaignsData,
  campaignsLoading,
  campaignsError,
  partnerOverviewData,
  partnerOverviewLoading,
  partnerOverviewError,
  onRefreshCurrentPage,
  initialSmsSendData,
  initialKakaoConnectData,
  initialKakaoSendData,
}: PageContentProps) {
  const meta = getRouteByPageId(currentPage);
  const canManagePartnerEvents = sessionRole === "PARTNER_ADMIN";
  const canUsePartnerGroupTemplates = sessionRole === "PARTNER_ADMIN" && sessionPartnerScope === "PUBL";

  switch (currentPage) {
    case "dashboard":
      return (
        <DashboardPage
          sessionRole={sessionRole}
          resources={resources}
          dashboard={dashboardData}
          loading={dashboardLoading}
          error={dashboardError}
          onGoTemplates={() => onNavigate("templates")}
          onGoSmsSend={() => onNavigate("sms-send")}
          onGoKakaoSend={() => onNavigate("kakao-send")}
        />
      );
    case "resources":
      return (
        <ResourcesPage
          resources={resources}
          data={resourcesData}
          loading={resourcesLoading}
          error={resourcesError}
        />
      );
    case "sender-number-apply":
      return <SenderNumberApplicationPage />;
    case "kakao-connect":
      return <KakaoChannelConnectPage initialData={initialKakaoConnectData} />;
    case "templates":
      return (
        <TemplatesPage
          sessionRole={sessionRole}
          partnerScope={sessionPartnerScope}
          resources={resources}
          data={templatesData}
          loading={templatesLoading}
          error={templatesError}
          onRefresh={onRefreshCurrentPage}
        />
      );
    case "events":
      return <EventsPage canManageEvents={canManagePartnerEvents} data={eventsData} loading={eventsLoading} error={eventsError} />;
    case "logs":
      return <LogsPage data={logsData} loading={logsLoading} error={logsError} onRefresh={onRefreshCurrentPage} />;
    case "recipients":
      return <RecipientsPage />;
    case "drafts":
      return <DraftInboxPage />;
    case "settings":
      return (
        <SettingsPage
          workspaceName={bootstrapData?.account.tenantName}
          tenantId={bootstrapData?.account.tenantId}
          email={bootstrapData?.account.email}
          loginId={bootstrapData?.account.loginId}
          opsHealth={opsHealthData}
          loading={opsHealthLoading}
          error={opsHealthError}
        />
      );
    case "ops":
      return <OpsPage role={sessionRole} />;
    case "partner":
      return (
        <PartnerOverviewPage
          role={sessionRole}
          partnerScope={sessionPartnerScope}
          data={partnerOverviewData}
          loading={partnerOverviewLoading}
          error={partnerOverviewError}
          onRefresh={onRefreshCurrentPage}
        />
      );
    case "sms-send":
      return <SmsSendPage initialData={initialSmsSendData} />;
    case "kakao-send":
      return <KakaoSendPage initialData={initialKakaoSendData} allowGroupTemplates={canUsePartnerGroupTemplates} />;
    case "campaign":
      return (
        <CampaignPage
          data={campaignsData}
          loading={campaignsLoading}
          error={campaignsError}
          resources={resources}
          onRefresh={onRefreshCurrentPage}
        />
      );
    default:
      return (
        <>
          <div className="page-header">
            <div className="page-header-row">
              <div>
                <div className="page-title">{meta.title}</div>
                <div className="page-desc">{meta.desc}</div>
              </div>
            </div>
          </div>
          <div className="box">
            <div className="box-header">
              <div>
                <div className="box-title">React 전환 진행 중</div>
                <div className="box-subtitle">이 페이지는 다음 단계에서 순서대로 이식할 예정입니다</div>
              </div>
            </div>
            <div className="box-body">
              <p className="text-muted">
                현재는 shell, 상태 시뮬레이터, 사이드바, 그리고 대시보드 본문까지 먼저 맞추고 있습니다.
              </p>
            </div>
          </div>
        </>
      );
  }
}
