"use client";

import { AppIcon } from "@/components/icons/AppIcon";
import { useRouteNavigate } from "@/lib/hooks/use-route-navigate";
import { useAppStore } from "@/lib/store/app-store";

export function DraftToast() {
  const toast = useAppStore((state) => state.draftToast);
  const hideDraftToast = useAppStore((state) => state.hideDraftToast);
  const navigate = useRouteNavigate();
  const iconName = toast.tone === "error" ? "warn" : toast.tone === "success" ? "check" : "inbox";
  const iconColor = toast.tone === "error" ? "#ff938a" : toast.tone === "success" ? "#3fb950" : "#58a6ff";

  return (
    <div className={`draft-toast draft-toast-${toast.tone}${toast.open ? " show" : ""}`}>
      <AppIcon name={iconName} className="icon icon-16" style={{ color: iconColor, flexShrink: 0, marginTop: 1 }} />
      <span className="draft-toast-msg">{toast.message || "초안이 임시저장되었습니다."}</span>
      {toast.action === "drafts" ? (
        <button
          className="draft-toast-action"
          onClick={() => {
            navigate("drafts");
            hideDraftToast();
          }}
        >
          보기
        </button>
      ) : null}
      <button
        onClick={hideDraftToast}
        style={{ background: "none", border: "none", color: "rgba(255,255,255,.5)", cursor: "pointer", padding: 0, marginLeft: 2, display: "flex", alignItems: "center", alignSelf: "flex-start" }}
      >
        <AppIcon name="x" className="icon icon-14" />
      </button>
    </div>
  );
}
