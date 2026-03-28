"use client";

/* eslint-disable @next/next/no-img-element */

import { AppIcon } from "@/components/icons/AppIcon";
import { getNoticeGreeting, getNoticeItems } from "@/lib/helpers/dashboard-story";
import { useRouteNavigate } from "@/lib/hooks/use-route-navigate";
import { useAppStore } from "@/lib/store/app-store";

function badgeMeta(tone: "notice" | "update" | "info") {
  if (tone === "notice") return { className: "label label-yellow", text: "확인 필요", icon: "warn" as const };
  if (tone === "update") return { className: "label label-blue", text: "진행 중", icon: "check" as const };
  return { className: "label label-green", text: "준비 완료", icon: "check" as const };
}

export function FloatingHelper() {
  const resources = useAppStore((state) => state.resources);
  const open = useAppStore((state) => state.overlays.floatingHelperOpen);
  const toggle = useAppStore((state) => state.toggleFloatingHelper);
  const close = useAppStore((state) => state.closeFloatingHelper);
  const navigate = useRouteNavigate();
  const items = getNoticeItems(resources);

  return (
    <div className="notice-anchor">
      <div className={`notice-panel${open ? " open" : ""}`} role="dialog" aria-label="안내 패널">
        <div className="notice-panel-header">
          <div>
            <div className="notice-panel-title">{getNoticeGreeting()}</div>
            <div className="notice-panel-subtitle">지금 확인하면 좋은 설정 상태를 정리해두었어요</div>
          </div>
          <div className="notice-panel-count">{items.length}</div>
        </div>
        <div className="notice-panel-list">
          {items.length === 0 ? (
            <div className="notice-panel-empty">현재 확인할 알림이 없습니다.</div>
          ) : (
            items.map((item) => {
              const badge = badgeMeta(item.tone);
              return (
                <div key={`${item.time}-${item.title}`} className={`notice-card ${badge.icon === "warn" ? "warn" : item.tone === "info" ? "success" : "info"}`}>
                  <div className="notice-card-icon">
                    {badge.icon === "warn" ? (
                      <AppIcon name="warn" className="icon icon-16" />
                    ) : (
                      <AppIcon name="check-circle" className="icon icon-16" />
                    )}
                  </div>
                  <div className="notice-card-body">
                    <div className="notice-card-top">
                      <div className="notice-card-title">{item.title}</div>
                      <div className="notice-card-time">{item.time}</div>
                    </div>
                    <div className="notice-card-desc">{item.desc}</div>
                    <div className="notice-card-badge">
                      <span className={badge.className} style={{ fontSize: 11 }}><span className="label-dot" />{badge.text}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="notice-panel-footer">
          <span>{items.length > 0 ? `현재 확인할 알림 ${items.length}건` : "현재 확인할 알림이 없습니다."}</span>
          <button
            className="notice-panel-link"
            onClick={() => {
              navigate("resources");
              close();
            }}
          >
            자원 관리
          </button>
        </div>
      </div>
      <button
        className={`notice-fab${open ? " active" : ""}`}
        onClick={toggle}
        aria-expanded={open}
        aria-controls="noticePanel"
        aria-haspopup="dialog"
        aria-label="안내 열기"
      >
        <img src="/assets/minu-face.png" alt="" aria-hidden="true" />
        <span className="notice-fab-badge">{items.length}</span>
      </button>
    </div>
  );
}
