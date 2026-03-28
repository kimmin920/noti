"use client";

import { useEffect, useRef, useState } from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import { logout, type AuthMeResponse } from "@/lib/api/auth";
import { useRouteNavigate } from "@/lib/hooks/use-route-navigate";
import { getNoticeItems } from "@/lib/helpers/dashboard-story";
import { useAppStore } from "@/lib/store/app-store";
import type { PageId, ResourceState } from "@/lib/store/types";

type NoticeRecord = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
};

export function Topbar({
  activePage: _activePage,
  workspaceName,
  notices,
  noticeCount,
  resources,
  session,
  onSignedOut,
}: {
  activePage: PageId;
  workspaceName: string;
  notices: NoticeRecord[];
  noticeCount: number;
  resources: ResourceState;
  session: AuthMeResponse | null;
  onSignedOut: () => void | Promise<void>;
}) {
  const noticeOpen = useAppStore((state) => state.ui.topbarNoticeOpen);
  const toggleNotice = useAppStore((state) => state.toggleTopbarNotice);
  const toggleDevPanel = useAppStore((state) => state.toggleDevPanel);
  const navigate = useRouteNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const fallbackItems = getNoticeItems(resources);
  const items =
    notices.length > 0
      ? notices.map((item) => ({
          title: item.title,
          desc: item.body,
          time: formatNoticeDate(item.createdAt),
          tone: "info" as const,
          icon: "check" as const,
        }))
      : fallbackItems;
  const visibleNoticeCount = noticeCount || items.length;
  const profileLabel = session?.email?.trim() || workspaceName;
  const profileInitial = profileLabel.charAt(0).toUpperCase() || "M";
  const roleLabel = session?.role === "TENANT_ADMIN" ? "Tenant Admin" : "Operator";

  useEffect(() => {
    if (!profileOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [profileOpen]);

  const handleLogout = async () => {
    setLoggingOut(true);
    setLogoutError(null);

    try {
      await logout();
      setProfileOpen(false);
      await onSignedOut();
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "로그아웃에 실패했습니다.");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="topbar-left">
          <button
            type="button"
            className="topbar-logo topbar-logo-button"
            onClick={() => navigate("dashboard")}
            aria-label="홈으로 이동"
          >
            <img className="topbar-logo-mark" src="/assets/noti-mark.svg" alt="" />
          </button>
          <div className="topbar-context" aria-label="현재 위치">
            <div className="topbar-context-workspace">
              <span className="topbar-context-label">Workspace</span>
              <span className="topbar-context-value">{workspaceName}</span>
            </div>
          </div>
        </div>
        <div className="topbar-right">
          <div className="topbar-notice-anchor">
            <button
            type="button"
            className={`topbar-utility-btn${noticeOpen ? " active" : ""}`}
            onClick={toggleNotice}
            aria-expanded={noticeOpen}
            aria-haspopup="dialog"
            aria-label={visibleNoticeCount > 0 ? `알림 ${visibleNoticeCount}건` : "알림 없음"}
          >
            <AppIcon name="bell" className="icon icon-14" />
            {visibleNoticeCount > 0 ? (
              <span className="topbar-utility-dot" aria-hidden="true" />
            ) : null}
          </button>
            <div className={`topbar-notice-panel${noticeOpen ? " open" : ""}`} role="dialog" aria-label="알림 센터">
              <div className="notice-panel-header">
                <div>
                  <div className="notice-panel-title">알림 센터</div>
                  <div className="notice-panel-subtitle">최근 공지와 상태 변화를 확인하세요</div>
                </div>
                <div className="notice-panel-count">{visibleNoticeCount}</div>
              </div>
              <div className="topbar-notice-list">
                {items.map((item) => (
                  <div key={`${item.time}-${item.title}`} className={`topbar-notice-row ${item.tone}`}>
                    <div className="topbar-notice-row-icon">
                      {item.icon === "warn" ? (
                        <AppIcon name="warn" className="icon icon-14" />
                      ) : (
                        <AppIcon name="check-circle" className="icon icon-14" />
                      )}
                    </div>
                    <div className="topbar-notice-row-body">
                      <div className="topbar-notice-row-top">
                        <div className="topbar-notice-row-title">{item.title}</div>
                        <div className="topbar-notice-row-time">{item.time}</div>
                      </div>
                      <div className="topbar-notice-row-desc">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <button type="button" className="topbar-utility-btn dev-toggle topbar-dev-btn" onClick={toggleDevPanel} aria-label="개발자 패널 열기">
            <AppIcon name="sliders" className="icon icon-14" />
          </button>
          <div className="topbar-profile-anchor" ref={profileRef}>
            <button
              type="button"
              className={`topbar-avatar-btn${profileOpen ? " active" : ""}`}
              title={profileLabel}
              aria-label="계정 메뉴"
              aria-expanded={profileOpen}
              aria-haspopup="menu"
              onClick={() => setProfileOpen((open) => !open)}
            >
              <span>{profileInitial}</span>
            </button>
            <div className={`topbar-profile-panel${profileOpen ? " open" : ""}`} role="menu" aria-label="계정 메뉴">
              <div className="topbar-profile-header">
                <div className="topbar-profile-avatar" aria-hidden="true">
                  {profileInitial}
                </div>
                <div className="topbar-profile-meta">
                  <div className="topbar-profile-name">{profileLabel}</div>
                  <div className="topbar-profile-role">{roleLabel}</div>
                </div>
              </div>
              {logoutError ? <div className="topbar-profile-error">{logoutError}</div> : null}
              <button
                type="button"
                className="topbar-profile-action"
                onClick={() => void handleLogout()}
                disabled={loggingOut}
                role="menuitem"
              >
                <AppIcon name="lock" className="icon icon-14" />
                <span>{loggingOut ? "로그아웃 중..." : "로그아웃"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function formatNoticeDate(value: string) {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}
