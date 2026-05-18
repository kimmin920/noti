import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store/app-store";
import { useRouteNavigate } from "@/lib/hooks/use-route-navigate";
import type { DraftItem } from "@/lib/store/types";

let lastSeenTopDraftId: number | null = null;

type CalendarDate = {
  monthLabel: string;
  dayLabel: string;
  fullLabel: string;
};

function getCalendarLocale() {
  if (typeof document !== "undefined") {
    return document.documentElement.lang || navigator.language || "ko-KR";
  }

  return "ko-KR";
}

function formatCalendarDate(date: Date, locale = getCalendarLocale()): CalendarDate {
  const normalizedLocale = locale.toLowerCase();
  const isKorean = normalizedLocale.startsWith("ko");
  const resolvedLocale = locale || (isKorean ? "ko-KR" : "en-US");
  const monthLabel = isKorean
    ? `${date.getMonth() + 1}월`
    : new Intl.DateTimeFormat(resolvedLocale, { month: "short" })
        .format(date)
        .replace(/\.$/, "")
        .toUpperCase();

  return {
    monthLabel,
    dayLabel: String(date.getDate()),
    fullLabel: new Intl.DateTimeFormat(resolvedLocale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date),
  };
}

function useTodayCalendarDate() {
  const [today, setToday] = useState<CalendarDate>(() => formatCalendarDate(new Date(), "ko-KR"));

  useEffect(() => {
    let midnightTimer: number | null = null;

    const syncToday = () => {
      const now = new Date();
      setToday(formatCalendarDate(now));

      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 1, 0);
      midnightTimer = window.setTimeout(syncToday, nextMidnight.getTime() - now.getTime());
    };

    syncToday();

    return () => {
      if (midnightTimer != null) {
        window.clearTimeout(midnightTimer);
      }
    };
  }, []);

  return today;
}

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
    <button
      type="button"
      className={`inbox-widget-wrap${active ? " active" : ""}`}
      onClick={onClick}
      aria-label={`임시저장함 ${count}개 보기`}
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
    </button>
  );
}

function TodayCalendarCard({
  active = false,
  count = 0,
  loading = false,
  onClick,
}: {
  active?: boolean;
  count?: number;
  loading?: boolean;
  onClick: () => void;
}) {
  const today = useTodayCalendarDate();
  const countLabel = loading ? "…" : count;

  return (
    <button
      type="button"
      className={`today-calendar-wrap${active ? " active" : ""}`}
      aria-label={loading ? "예약 발송 목록 불러오는 중" : `오늘 예약 발송 ${count}건 보기`}
      onClick={onClick}
    >
      <div className="today-calendar">
        <div className="today-calendar-month">{today.monthLabel}</div>
        <div className="today-calendar-day">{today.dayLabel}</div>
      </div>
      <div className="today-calendar-label">
        <span>오늘 예약</span>
        <span className={`inbox-chip${count > 0 ? " has-items" : ""}`}>{countLabel}</span>
      </div>
    </button>
  );
}

export function DraftWidgetCompare({
  currentPage,
  scheduledTodayCount = 0,
  scheduledCountLoading = false,
}: {
  currentPage: string;
  scheduledTodayCount?: number;
  scheduledCountLoading?: boolean;
}) {
  const drafts = useAppStore((state) => state.drafts.items);
  const navigate = useRouteNavigate();
  const [enteringId, setEnteringId] = useState<number | null>(null);
  const topDraftId = drafts[0]?.id ?? null;

  useEffect(() => {
    let syncTimer: number | null = null;
    let clearTimer: number | null = null;
    const queueEnteringId = (nextEnteringId: number | null) => {
      syncTimer = window.setTimeout(() => {
        setEnteringId(nextEnteringId);
      }, 0);
    };

    if (topDraftId == null) {
      lastSeenTopDraftId = null;
      queueEnteringId(null);
    } else if (lastSeenTopDraftId == null) {
      lastSeenTopDraftId = topDraftId;
      queueEnteringId(null);
    } else if (topDraftId === lastSeenTopDraftId) {
      queueEnteringId(null);
    } else {
      lastSeenTopDraftId = topDraftId;
      queueEnteringId(topDraftId);

      clearTimer = window.setTimeout(() => {
        setEnteringId((current) => (current === topDraftId ? null : current));
      }, 420);
    }

    return () => {
      if (syncTimer != null) {
        window.clearTimeout(syncTimer);
      }
      if (clearTimer != null) {
        window.clearTimeout(clearTimer);
      }
    };
  }, [topDraftId]);

  return (
    <div className="draft-sidebar-widgets">
      <WidgetCard
        active={currentPage === "drafts"}
        count={drafts.length}
        drafts={drafts}
        enteringId={enteringId}
        onClick={() => navigate("drafts")}
      />
      <TodayCalendarCard
        active={currentPage === "scheduled"}
        count={scheduledTodayCount}
        loading={scheduledCountLoading}
        onClick={() => navigate("scheduled")}
      />
    </div>
  );
}
