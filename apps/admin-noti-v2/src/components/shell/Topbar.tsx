"use client";

import { AppIcon } from "@/components/icons/AppIcon";
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
}: {
  activePage: PageId;
  workspaceName: string;
  notices: NoticeRecord[];
  noticeCount: number;
  resources: ResourceState;
}) {
  const noticeOpen = useAppStore((state) => state.ui.topbarNoticeOpen);
  const toggleNotice = useAppStore((state) => state.toggleTopbarNotice);
  const toggleDevPanel = useAppStore((state) => state.toggleDevPanel);
  const navigate = useRouteNavigate();
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
          <button type="button" className="topbar-avatar-btn" title="김관리자" aria-label="계정">
            <span>김</span>
          </button>
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
