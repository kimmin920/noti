"use client";

import { AppIcon } from "@/components/icons/AppIcon";
import { useRouteNavigate } from "@/lib/hooks/use-route-navigate";
import { useAppStore } from "@/lib/store/app-store";
import type { DraftItem } from "@/lib/store/types";

function formatRelTime(savedAt: string) {
  const diff = Date.now() - new Date(savedAt).getTime();
  if (diff < 60_000) return "방금 전";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return new Date(savedAt).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
}

function getDraftMeta(draft: DraftItem) {
  switch (draft.type) {
    case "mms":
      return { label: "MMS", className: "mms" as const, icon: <AppIcon name="upload" className="icon icon-16" /> };
    case "kakao":
      return { label: "알림톡", className: "kakao" as const, icon: <AppIcon name="kakao" className="icon icon-16" /> };
    case "lms":
      return { label: "LMS", className: "sms" as const, icon: <AppIcon name="sms" className="icon icon-16" /> };
    default:
      return { label: "SMS", className: "sms" as const, icon: <AppIcon name="sms" className="icon icon-16" /> };
  }
}

export function DraftInboxPage() {
  const drafts = useAppStore((state) => state.drafts.items);
  const clearDrafts = useAppStore((state) => state.clearDrafts);
  const loadDraftIntoSmsComposer = useAppStore((state) => state.loadDraftIntoSmsComposer);
  const deleteDraft = useAppStore((state) => state.deleteDraft);
  const navigate = useRouteNavigate();

  return (
    <>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <div className="page-title draft-page-title">
              임시저장함
              {drafts.length > 0 ? <span className="inbox-count-badge">{drafts.length}</span> : null}
            </div>
            <div className="page-desc">작성 중 저장된 메시지 초안입니다. 이어서 발송하거나 삭제할 수 있습니다.</div>
          </div>
          {drafts.length > 0 ? (
            <button className="btn btn-danger btn-sm" onClick={clearDrafts}>
              <AppIcon name="trash" className="icon icon-14" />
              전체 삭제
            </button>
          ) : null}
        </div>
      </div>

      {drafts.length === 0 ? (
        <div className="inbox-empty">
          <div className="inbox-empty-icon">
            <AppIcon name="inbox" className="icon icon-32" style={{ color: "rgba(255,255,255,.85)", position: "relative", zIndex: 1 }} />
          </div>
          <div className="empty-title" style={{ marginTop: 4 }}>임시저장된 메시지가 없습니다</div>
          <div className="empty-desc">메시지를 작성하다 발송하지 않고 이동하면 자동으로 여기에 저장됩니다.</div>
          <div className="empty-actions">
            <button className="btn btn-accent" onClick={() => navigate("sms-send")}>
              <AppIcon name="sms" className="icon icon-14" />
              SMS 작성
            </button>
          </div>
        </div>
      ) : (
        <div className="box">
          <div className="draft-list">
            {drafts.map((draft, index) => {
              const meta = getDraftMeta(draft);
              return (
                <div className="draft-card" key={draft.id} style={{ animationDelay: `${index * 0.05}s` }}>
                  <div className={`draft-card-icon ${meta.className}`}>{meta.icon}</div>
                  <div className="draft-card-body">
                    <div className="draft-card-header">
                      <span className={`chip ${meta.className === "kakao" ? "chip-kakao" : "chip-sms"} draft-chip-sm`}>
                        {meta.label}
                      </span>
                      <span className="draft-card-title">{draft.subject || "제목 없음"}</span>
                      <span className="draft-card-time">{formatRelTime(draft.savedAt)}</span>
                    </div>
                    <div className="draft-card-to">
                      {draft.to || "수신자 미입력"}
                      {draft.hasImages ? <span className="draft-inline-meta">이미지 {draft.imageCount}개</span> : null}
                    </div>
                    <div className="draft-card-preview">{draft.body || "(내용 없음)"}</div>
                  </div>
                  <div className="draft-card-actions">
                    <button
                      className="btn btn-accent btn-sm"
                      onClick={() => {
                        loadDraftIntoSmsComposer(draft.id);
                        navigate("sms-send");
                      }}
                    >
                      이어서 발송
                    </button>
                    <button className="btn btn-default btn-sm" onClick={() => deleteDraft(draft.id)}>
                      <AppIcon name="trash" className="icon icon-12" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
