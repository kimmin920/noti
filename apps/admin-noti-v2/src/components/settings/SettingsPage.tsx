"use client";

import { UnderlineNav } from "@primer/react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppIcon } from "@/components/icons/AppIcon";
import { NotionRecipientSyncPanel } from "@/components/integrations/NotionRecipientSyncPanel";
import { SkeletonTableBox } from "@/components/loading/PageSkeleton";
import { Sms080SettingsPanel } from "@/components/settings/Sms080SettingsPanel";
import type { V2OpsHealthResponse } from "@/lib/api/v2";

type SettingsPageProps = {
  serviceName?: string;
  email?: string | null;
  loginId?: string | null;
  opsHealth: V2OpsHealthResponse | null;
  loading?: boolean;
  error?: string | null;
};

type SettingsTab = "account" | "integrations" | "sms080" | "system";

const SETTINGS_TABS: Array<{ id: SettingsTab; label: string; href: string }> = [
  { id: "account", label: "계정", href: "/settings?tab=account" },
  { id: "integrations", label: "외부 연동", href: "/settings?tab=integrations" },
  { id: "sms080", label: "080 수신거부", href: "/settings?tab=080" },
  { id: "system", label: "시스템", href: "/settings?tab=system" },
];

function SettingsHeader() {
  const description = "계정, 외부 연동, 시스템 상태를 확인합니다";

  return (
    <div className="page-header">
      <div className="page-header-row">
        <div>
          <div className="page-title">운영 설정</div>
          <div className="page-desc">{description}</div>
        </div>
      </div>
    </div>
  );
}

function buildSettingsTabHref(tab: SettingsTab, preserveDev: boolean) {
  const nextParams = new URLSearchParams();
  nextParams.set("tab", tab === "sms080" ? "080" : tab);
  if (preserveDev) {
    nextParams.set("dev", "1");
  }
  return `/settings?${nextParams.toString()}`;
}

export function SettingsPage({
  serviceName = "NOTI",
  email,
  loginId,
  opsHealth,
  loading,
  error,
}: SettingsPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = resolveSettingsTab(searchParams.get("tab"));
  const preserveDev = searchParams.get("dev") === "1";
  const settingsTabs = SETTINGS_TABS.map((tab) => ({
    ...tab,
    href: buildSettingsTabHref(tab.id, preserveDev),
  }));
  const showLoadingNotice = Boolean(loading && !opsHealth && !email && !loginId);

  if (showLoadingNotice) {
    return (
      <>
        <SettingsHeader />

        <SkeletonTableBox titleWidth={110} rows={3} columns={["1.4fr", "1fr"]} />
        <SkeletonTableBox titleWidth={88} rows={4} columns={["1.3fr", "110px"]} />
        <SkeletonTableBox titleWidth={118} rows={3} columns={["1.2fr", "1fr"]} />
      </>
    );
  }

  return (
    <>
      <SettingsHeader />

      {error ? (
        <div className="flash flash-attention">
          <AppIcon name="warn" className="icon icon-16 flash-icon" />
          <div className="flash-body">{error}</div>
        </div>
      ) : null}

      <UnderlineNav aria-label="운영 설정 섹션" className="settings-tabs" variant="flush">
        {settingsTabs.map((tab) => (
          <UnderlineNav.Item
            key={tab.id}
            href={tab.href}
            aria-current={activeTab === tab.id ? "page" : undefined}
            onSelect={(event) => {
              event.preventDefault();
              router.push(tab.href);
            }}
          >
            {tab.label}
          </UnderlineNav.Item>
        ))}
      </UnderlineNav>

      <div className="settings-tab-content">
        {activeTab === "account" ? <AccountSettingsPanel serviceName={serviceName} email={email} loginId={loginId} /> : null}
        {activeTab === "integrations" ? <NotionRecipientSyncPanel /> : null}
        {activeTab === "sms080" ? <Sms080SettingsPanel serviceName={serviceName} /> : null}
        {activeTab === "system" ? <SystemSettingsPanels opsHealth={opsHealth} /> : null}
      </div>
    </>
  );
}

function AccountSettingsPanel({
  serviceName,
  email,
  loginId,
}: Pick<SettingsPageProps, "serviceName" | "email" | "loginId">) {
  return (
    <div className="box">
      <div className="box-header">
        <div>
          <div className="box-title">계정 정보</div>
          <div className="box-subtitle">현재 로그인 기준 정보</div>
        </div>
      </div>
      <div className="box-section-tight">
        <div className="box-row">
          <div className="box-row-content">
            <div className="box-row-title">서비스 이름</div>
            <div className="box-row-desc">{serviceName}</div>
          </div>
        </div>
        <div className="box-row">
          <div className="box-row-content">
            <div className="box-row-title">로그인 계정</div>
            <div className="box-row-desc">{email || loginId || "확인되지 않음"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SystemSettingsPanels({ opsHealth }: { opsHealth: V2OpsHealthResponse | null }) {
  return (
    <>
      <div className="box">
        <div className="box-header">
          <div>
            <div className="box-title">시스템 상태</div>
            <div className="box-subtitle">`/v2/ops/health` 기준 실시간 상태</div>
          </div>
          <span className={`label ${opsHealthStatusClass(opsHealth?.status)}`}>
            <span className="label-dot" />
            {opsHealthStatusText(opsHealth?.status)}
          </span>
        </div>
        <div className="box-section-tight">
          <div className="box-row">
            <div className="box-row-content">
              <div className="box-row-title">전체 상태</div>
              <div className="box-row-desc">
                {opsHealth ? `${opsHealthStatusText(opsHealth.status)} · ${formatShortDateTime(opsHealth.checkedAt)} 확인` : "아직 상태 정보를 불러오지 못했습니다."}
              </div>
            </div>
          </div>
          <ComponentHealthRow
            title="Database"
            status={opsHealth?.components.database.status}
            detail={opsHealth ? `${opsHealth.components.database.latencyMs}ms` : "확인 전"}
            message={opsHealth?.components.database.message}
          />
          <ComponentHealthRow
            title="Redis"
            status={opsHealth?.components.redis.status}
            detail={opsHealth ? `${opsHealth.components.redis.latencyMs}ms` : "확인 전"}
            message={opsHealth?.components.redis.message}
          />
          <ComponentHealthRow
            title="Queue"
            status={opsHealth?.components.queue.status}
            detail={opsHealth ? `${opsHealth.components.queue.queueName} · ${opsHealth.components.queue.latencyMs}ms` : "확인 전"}
            message={opsHealth?.components.queue.message || formatQueueCounts(opsHealth?.components.queue.counts)}
          />
          <div className="box-row box-row-last">
            <div className="box-row-content">
              <div className="box-row-title">설정 점검</div>
              <div className="box-row-desc">{formatConfigSummary(opsHealth)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="box">
        <div className="box-header">
          <div>
            <div className="box-title">헬스체크 엔드포인트</div>
            <div className="box-subtitle">운영 점검과 배포 전 smoke test에 사용할 수 있습니다</div>
          </div>
        </div>
        <div className="box-section-tight">
          <div className="box-row">
            <div className="box-row-content">
              <div className="box-row-title">Liveness</div>
              <div className="box-row-desc text-mono">GET /health/live</div>
            </div>
          </div>
          <div className="box-row">
            <div className="box-row-content">
              <div className="box-row-title">Readiness</div>
              <div className="box-row-desc text-mono">GET /health/ready</div>
            </div>
          </div>
          <div className="box-row box-row-last">
            <div className="box-row-content">
              <div className="box-row-title">Operations</div>
              <div className="box-row-desc text-mono">GET /v2/ops/health</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function resolveSettingsTab(value: string | null): SettingsTab {
  if (value === "integrations" || value === "system") {
    return value;
  }
  if (value === "080" || value === "sms080") {
    return "sms080";
  }

  return "account";
}

function ComponentHealthRow({
  title,
  status,
  detail,
  message,
}: {
  title: string;
  status?: "ok" | "warning" | "error";
  detail: string;
  message?: string;
}) {
  return (
    <div className="box-row">
      <div className="box-row-content">
        <div className="box-row-title">{title}</div>
        <div className="box-row-desc">{detail}{message ? ` · ${message}` : ""}</div>
      </div>
      <span className={`label ${componentStatusClass(status)}`}>
        <span className="label-dot" />
        {componentStatusText(status)}
      </span>
    </div>
  );
}

function opsHealthStatusText(status?: "ok" | "degraded" | "error") {
  if (status === "ok") return "정상";
  if (status === "degraded") return "주의";
  if (status === "error") return "장애";
  return "확인 전";
}

function opsHealthStatusClass(status?: "ok" | "degraded" | "error") {
  if (status === "ok") return "label-green";
  if (status === "degraded") return "label-yellow";
  if (status === "error") return "label-red";
  return "label-gray";
}

function componentStatusText(status?: "ok" | "warning" | "error") {
  if (status === "ok") return "정상";
  if (status === "warning") return "주의";
  if (status === "error") return "오류";
  return "확인 전";
}

function componentStatusClass(status?: "ok" | "warning" | "error") {
  if (status === "ok") return "label-green";
  if (status === "warning") return "label-yellow";
  if (status === "error") return "label-red";
  return "label-gray";
}

function formatQueueCounts(counts?: Record<string, number>) {
  if (!counts) return "";

  return Object.entries(counts)
    .map(([key, value]) => `${key}:${value}`)
    .join(" · ");
}

function formatConfigSummary(opsHealth: V2OpsHealthResponse | null) {
  if (!opsHealth) {
    return "설정 상태를 아직 확인하지 못했습니다.";
  }

  const config = opsHealth.components.config;
  const tokens = [
    config.notificationHubConfigured ? "Notification Hub" : null,
    config.smsConfigured ? "SMS" : null,
    config.alimtalkConfigured ? "AlimTalk" : null,
    config.webhookSecretConfigured ? "Webhook secret" : null,
    config.defaultSenderGroupConfigured ? "Default sender group" : null,
  ].filter(Boolean);

  if (tokens.length === 0) {
    return "필수 메시지 설정이 비어 있습니다.";
  }

  return `${tokens.join(", ")} 설정 확인됨`;
}

function formatShortDateTime(value: string) {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}
