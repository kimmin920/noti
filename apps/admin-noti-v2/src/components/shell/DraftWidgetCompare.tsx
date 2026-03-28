import { useAppStore } from "@/lib/store/app-store";
import { useRouteNavigate } from "@/lib/hooks/use-route-navigate";
import type { DraftItem } from "@/lib/store/types";

function InboxGlyph() {
  return (
    <svg
      className="inbox-glyph"
      viewBox="0 0 18 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M1 7.5 L1 12 Q1 13 2 13 L16 13 Q17 13 17 12 L17 7.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M1 7.5 L5.5 7.5 Q6 7.5 6.3 8 L7 9 Q7.5 9.5 9 9.5 Q10.5 9.5 11 9 L11.7 8 Q12 7.5 12.5 7.5 L17 7.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M9 1 L9 6 M7 4.2 L9 6.2 L11 4.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function previewOf(draft: DraftItem) {
  return draft.body.replace(/\n/g, " ").slice(0, 16) || "(초안)";
}

function stackColor(type: DraftItem["type"]) {
  switch (type) {
    case "mms":
      return "#a78bfa";
    case "kakao":
      return "#fbbf24";
    default:
      return "#60a5fa";
  }
}

function StackCards({
  drafts,
  enteringId,
}: {
  drafts: DraftItem[];
  enteringId: number | null;
}) {
  const visibleDrafts = drafts.slice(0, 6).reverse();

  return (
    <div className="inbox-stack">
      {visibleDrafts.map((draft, index) => (
        <div
          className={`isc show pos-${index}${enteringId === draft.id ? " entering" : ""}`}
          key={`${draft.id}-${index}`}
        >
          <div className="isc-circle" style={{ background: stackColor(draft.type), flexShrink: 0 }} />
          <span className="isc-text">{previewOf(draft)}</span>
        </div>
      ))}
    </div>
  );
}

function WidgetCard({
  active = false,
  count = 0,
  drafts = [],
  enteringId,
  onClick,
}: {
  active?: boolean;
  count?: number;
  drafts?: DraftItem[];
  enteringId: number | null;
  onClick: () => void;
}) {
  return (
    <div
      className={`inbox-widget-wrap${active ? " active" : ""}`}
      onClick={onClick}
    >
      <div className="tv-frame">
        <div className="tv-screen" />
        <StackCards drafts={drafts} enteringId={enteringId} />
        <InboxGlyph />
      </div>
      <div className="inbox-label-row">
        <span>임시저장함</span>
        <span className={`inbox-chip${count > 0 ? " has-items" : ""}`}>{count}</span>
      </div>
    </div>
  );
}

export function DraftWidgetCompare({ currentPage }: { currentPage: string }) {
  const drafts = useAppStore((state) => state.drafts.items);
  const navigate = useRouteNavigate();
  const enteringId = drafts[0]?.id ?? null;

  return (
    <WidgetCard
      active={currentPage === "drafts"}
      count={drafts.length}
      drafts={drafts}
      enteringId={enteringId}
      onClick={() => navigate("drafts")}
    />
  );
}
