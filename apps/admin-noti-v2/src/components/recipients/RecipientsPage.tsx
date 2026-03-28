"use client";

import { AppIcon } from "@/components/icons/AppIcon";

export function RecipientsPage() {
  return (
    <>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <div className="page-title">수신자 관리</div>
            <div className="page-desc">발송 대상 유저와 세그먼트를 관리합니다</div>
          </div>
          <div className="flex gap-8">
            <button className="btn btn-default">
              <AppIcon name="download" className="icon icon-14" />
              CSV Import
            </button>
            <button className="btn btn-accent">
              <AppIcon name="user-plus" className="icon icon-14" />
              수신자 추가
            </button>
          </div>
        </div>
      </div>

      <div className="box mb-16">
        <div className="stats-grid">
          <div className="stat-cell">
            <div className="stat-label-t">전체 수신자</div>
            <div className="stat-value-t">0</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label-t">마케팅 동의</div>
            <div className="stat-value-t" style={{ color: "var(--success-fg)" }}>0</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label-t">세그먼트</div>
            <div className="stat-value-t">0</div>
          </div>
          <div className="stat-cell" style={{ borderRight: "none" }}>
            <div className="stat-label-t">수신 거부</div>
            <div className="stat-value-t" style={{ color: "var(--danger-fg)" }}>0</div>
          </div>
        </div>
      </div>

      <div className="box">
        <div className="empty-state">
          <div className="empty-icon">
            <AppIcon name="users" className="icon icon-40" />
          </div>
          <div className="empty-title">수신자가 없습니다</div>
          <div className="empty-desc">수신자를 추가하거나 CSV 파일로 일괄 가져올 수 있습니다.</div>
          <div className="empty-actions">
            <button className="btn btn-default">
              <AppIcon name="download" className="icon icon-14" />
              CSV Import
            </button>
            <button className="btn btn-accent">
              <AppIcon name="user-plus" className="icon icon-14" />
              수신자 추가
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
