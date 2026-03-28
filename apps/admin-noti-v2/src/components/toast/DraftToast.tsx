"use client";

import { AppIcon } from "@/components/icons/AppIcon";
import { useRouteNavigate } from "@/lib/hooks/use-route-navigate";
import { useAppStore } from "@/lib/store/app-store";

export function DraftToast() {
  const toast = useAppStore((state) => state.draftToast);
  const hideDraftToast = useAppStore((state) => state.hideDraftToast);
  const navigate = useRouteNavigate();

  return (
    <div className={`draft-toast${toast.open ? " show" : ""}`}>
      <AppIcon name="inbox" className="icon icon-16" style={{ color: "#58a6ff", flexShrink: 0 }} />
      <span className="draft-toast-msg">{toast.message || "초안이 임시저장되었습니다."}</span>
      <button
        className="draft-toast-action"
        onClick={() => {
          navigate("drafts");
          hideDraftToast();
        }}
      >
        보기
      </button>
      <button
        onClick={hideDraftToast}
        style={{ background: "none", border: "none", color: "rgba(255,255,255,.5)", cursor: "pointer", padding: 0, marginLeft: 2, display: "flex", alignItems: "center" }}
      >
        <AppIcon name="x" className="icon icon-14" />
      </button>
    </div>
  );
}
