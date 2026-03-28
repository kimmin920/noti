"use client";

import { AppIcon } from "@/components/icons/AppIcon";
import { useAppStore } from "@/lib/store/app-store";
import { useRouteNavigate } from "@/lib/hooks/use-route-navigate";
import {
  canCampaign,
  canKakao,
  canSMS,
  pendingResourceCount,
} from "@/lib/store/selectors";
import type { PageId, ResourceState } from "@/lib/store/types";
import { DraftWidgetCompare } from "./DraftWidgetCompare";
import { SidebarSetupBox } from "./SidebarSetupBox";

function NavButton({
  active = false,
  locked = false,
  label,
  badge,
  icon,
  onClick,
}: {
  active?: boolean;
  locked?: boolean;
  label: string;
  badge?: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={`sidebar-item${active ? " active" : ""}${locked ? " locked" : ""}`}
      onClick={onClick}
    >
      <span className="si-left">
        {icon}
        {label}
      </span>
      <span className="si-right">
        {badge}
      </span>
    </button>
  );
}

function LockPill() {
  return (
    <span className="lock-pill">
      <AppIcon name="lock" className="icon icon-12" />
    </span>
  );
}

export function Sidebar({
  currentPage,
  resources,
  eventRuleCount = 0,
}: {
  currentPage: PageId;
  resources: ResourceState;
  eventRuleCount?: number;
}) {
  const navigate = useRouteNavigate();
  const openLockedModal = useAppStore((state) => state.openLockedModal);

  const smsReady = canSMS(resources);
  const kakaoReady = canKakao(resources);
  const campaignReady = canCampaign(resources);
  const pendingCount = pendingResourceCount(resources);

  return (
    <nav className="sidebar">
      <SidebarSetupBox resources={resources} onGoResources={() => navigate("resources")} />

      <div className="sidebar-section">
        <span className="sidebar-heading">대시보드</span>
        <NavButton
          active={currentPage === "dashboard"}
          label="개요"
          icon={<AppIcon name="dashboard" className="icon icon-16" />}
          onClick={() => navigate("dashboard")}
        />
      </div>

      <div className="sidebar-section">
        <span className="sidebar-heading">메시지 발송</span>
        <NavButton
          active={currentPage === "sms-send"}
          locked={!smsReady}
          label="SMS 발송"
          icon={<AppIcon name="sms" className="icon icon-16" />}
          badge={!smsReady ? <LockPill /> : null}
          onClick={() => (smsReady ? navigate("sms-send") : openLockedModal("sms"))}
        />
        <NavButton
          active={currentPage === "kakao-send"}
          locked={!kakaoReady}
          label="알림톡 발송"
          icon={<AppIcon name="kakao" className="icon icon-16" />}
          badge={!kakaoReady ? <LockPill /> : null}
          onClick={() => (kakaoReady ? navigate("kakao-send") : openLockedModal("kakao"))}
        />
        <NavButton
          active={currentPage === "campaign"}
          locked={!campaignReady}
          label="대량 발송"
          icon={<AppIcon name="campaign" className="icon icon-16" />}
          badge={!campaignReady ? <LockPill /> : null}
          onClick={() => (campaignReady ? navigate("campaign") : openLockedModal("campaign"))}
        />
      </div>

      <DraftWidgetCompare currentPage={currentPage} />

      <div className="sidebar-section">
        <span className="sidebar-heading">자동화</span>
        <NavButton
          active={currentPage === "events"}
          label="이벤트 규칙"
          icon={<AppIcon name="zap" className="icon icon-16" />}
          badge={eventRuleCount > 0 ? <span className="sidebar-badge blue">{eventRuleCount}</span> : null}
          onClick={() => navigate("events")}
        />
        <NavButton
          active={currentPage === "templates"}
          label="템플릿 관리"
          icon={<AppIcon name="template" className="icon icon-16" />}
          onClick={() => navigate("templates")}
        />
      </div>

      <div className="sidebar-section">
        <span className="sidebar-heading">운영</span>
        <NavButton
          active={currentPage === "resources"}
          label="발신 자원 관리"
          icon={<AppIcon name="key" className="icon icon-16" />}
          badge={
            pendingCount > 0 ? <span className="sidebar-badge">{pendingCount}</span> : null
          }
          onClick={() => navigate("resources")}
        />
        <NavButton
          active={currentPage === "logs"}
          label="발송 로그"
          icon={<AppIcon name="log" className="icon icon-16" />}
          onClick={() => navigate("logs")}
        />
        <NavButton
          active={currentPage === "recipients"}
          label="수신자 관리"
          icon={<AppIcon name="users" className="icon icon-16" />}
          onClick={() => navigate("recipients")}
        />
      </div>

      <div className="sidebar-section">
        <span className="sidebar-heading">설정</span>
        <NavButton
          active={currentPage === "settings"}
          label="운영 설정"
          icon={<AppIcon name="settings" className="icon icon-16" />}
          onClick={() => navigate("settings")}
        />
      </div>
    </nav>
  );
}
