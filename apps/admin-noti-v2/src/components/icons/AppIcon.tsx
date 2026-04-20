import type { SVGProps } from "react";

type AppIconName =
  | "dashboard"
  | "sms"
  | "sms-bulk"
  | "kakao"
  | "kakao-bulk"
  | "brand"
  | "campaign"
  | "brand-bulk"
  | "zap"
  | "template"
  | "key"
  | "log"
  | "users"
  | "settings"
  | "lock"
  | "bell"
  | "warn"
  | "info"
  | "check-circle"
  | "check"
  | "plus"
  | "refresh"
  | "download"
  | "upload"
  | "trash"
  | "copy"
  | "external"
  | "search"
  | "filter"
  | "phone"
  | "inbox"
  | "activity"
  | "webhook"
  | "shield"
  | "send"
  | "user-plus"
  | "chevron-left"
  | "chevron-right"
  | "merge"
  | "clock"
  | "x"
  | "x-circle"
  | "sliders";

type AppIconProps = SVGProps<SVGSVGElement> & {
  name: AppIconName;
};

const shared = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function AppIcon({ name, ...props }: AppIconProps) {
  const bulkBadge = (
    <>
      <circle cx="18" cy="6" r="5.1" fill="currentColor" opacity="0.96" />
      <text
        x="18"
        y="7.95"
        textAnchor="middle"
        fontSize="6.7"
        fontWeight="800"
        fill="#fff"
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      >
        B
      </text>
    </>
  );

  const brandLetter = (
    <text
      x="12"
      y="15.4"
      textAnchor="middle"
      fontSize="8.9"
      fontWeight="800"
      fill="currentColor"
      stroke="#fff"
      strokeWidth="1"
      paintOrder="stroke"
      textLength="10.2"
      lengthAdjust="spacingAndGlyphs"
      fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    >
      AD
    </text>
  );

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      {name === "dashboard" ? (
        <>
          <rect x="3" y="3" width="7" height="7" {...shared} />
          <rect x="14" y="3" width="7" height="7" {...shared} />
          <rect x="14" y="14" width="7" height="7" {...shared} />
          <rect x="3" y="14" width="7" height="7" {...shared} />
        </>
      ) : null}
      {name === "sms" ? <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" {...shared} /> : null}
      {name === "sms-bulk" ? (
        <>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" {...shared} />
          {bulkBadge}
        </>
      ) : null}
      {name === "kakao" ? <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" {...shared} /> : null}
      {name === "kakao-bulk" ? (
        <>
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" {...shared} />
          {bulkBadge}
        </>
      ) : null}
      {name === "brand" ? (
        <>
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" {...shared} />
          {brandLetter}
        </>
      ) : null}
      {name === "campaign" ? <path d="M3 11l19-9-9 19-2-8-8-2z" {...shared} /> : null}
      {name === "brand-bulk" ? (
        <>
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" {...shared} />
          {brandLetter}
          {bulkBadge}
        </>
      ) : null}
      {name === "zap" ? <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" {...shared} /> : null}
      {name === "template" ? (
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" {...shared} />
          <polyline points="14 2 14 8 20 8" {...shared} />
          <line x1="16" y1="13" x2="8" y2="13" {...shared} />
          <line x1="16" y1="17" x2="8" y2="17" {...shared} />
          <line x1="10" y1="9" x2="8" y2="9" {...shared} />
        </>
      ) : null}
      {name === "key" ? (
        <>
          <circle cx="7.5" cy="15.5" r="5.5" {...shared} />
          <path d="M21 2l-9.6 9.6" {...shared} />
          <path d="M15.5 7.5l3 3L22 7l-3-3" {...shared} />
        </>
      ) : null}
      {name === "log" ? (
        <>
          <line x1="18" y1="20" x2="18" y2="10" {...shared} />
          <line x1="12" y1="20" x2="12" y2="4" {...shared} />
          <line x1="6" y1="20" x2="6" y2="14" {...shared} />
        </>
      ) : null}
      {name === "users" ? (
        <>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" {...shared} />
          <circle cx="9" cy="7" r="4" {...shared} />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" {...shared} />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" {...shared} />
        </>
      ) : null}
      {name === "settings" ? (
        <>
          <circle cx="12" cy="12" r="3" {...shared} />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" {...shared} />
        </>
      ) : null}
      {name === "lock" ? (
        <>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" {...shared} />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" {...shared} />
        </>
      ) : null}
      {name === "bell" ? (
        <>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" {...shared} />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" {...shared} />
        </>
      ) : null}
      {name === "warn" ? (
        <>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" {...shared} />
          <line x1="12" y1="9" x2="12" y2="13" {...shared} />
          <line x1="12" y1="17" x2="12.01" y2="17" {...shared} />
        </>
      ) : null}
      {name === "info" ? (
        <>
          <circle cx="12" cy="12" r="10" {...shared} />
          <line x1="12" y1="16" x2="12" y2="12" {...shared} />
          <line x1="12" y1="8" x2="12.01" y2="8" {...shared} />
        </>
      ) : null}
      {name === "check-circle" ? (
        <>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" {...shared} />
          <polyline points="22 4 12 14.01 9 11.01" {...shared} />
        </>
      ) : null}
      {name === "check" ? <polyline points="20 6 9 17 4 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {name === "plus" ? (<><line x1="12" y1="5" x2="12" y2="19" {...shared} /><line x1="5" y1="12" x2="19" y2="12" {...shared} /></>) : null}
      {name === "refresh" ? (<><polyline points="23 4 23 10 17 10" {...shared} /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" {...shared} /></>) : null}
      {name === "download" ? (<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" {...shared} /><polyline points="7 10 12 15 17 10" {...shared} /><line x1="12" y1="15" x2="12" y2="3" {...shared} /></>) : null}
      {name === "upload" ? (<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" {...shared} /><polyline points="17 8 12 3 7 8" {...shared} /><line x1="12" y1="3" x2="12" y2="15" {...shared} /></>) : null}
      {name === "trash" ? (
        <>
          <polyline points="3 6 5 6 21 6" {...shared} />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" {...shared} />
          <path d="M10 11v6" {...shared} />
          <path d="M14 11v6" {...shared} />
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" {...shared} />
        </>
      ) : null}
      {name === "copy" ? (<><rect x="9" y="9" width="13" height="13" rx="2" ry="2" {...shared} /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" {...shared} /></>) : null}
      {name === "external" ? (<><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" {...shared} /><polyline points="15 3 21 3 21 9" {...shared} /><line x1="10" y1="14" x2="21" y2="3" {...shared} /></>) : null}
      {name === "search" ? (<><circle cx="11" cy="11" r="8" {...shared} /><line x1="21" y1="21" x2="16.65" y2="16.65" {...shared} /></>) : null}
      {name === "filter" ? <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" {...shared} /> : null}
      {name === "phone" ? (<><rect x="5" y="2" width="14" height="20" rx="2" ry="2" {...shared} /><line x1="12" y1="18" x2="12.01" y2="18" {...shared} /></>) : null}
      {name === "inbox" ? (<><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" {...shared} /><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" {...shared} /></>) : null}
      {name === "activity" ? <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" {...shared} /> : null}
      {name === "webhook" ? (
        <>
          <path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2" {...shared} />
          <path d="m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06" {...shared} />
          <path d="m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8" {...shared} />
        </>
      ) : null}
      {name === "shield" ? <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" {...shared} /> : null}
      {name === "send" ? (<><line x1="22" y1="2" x2="11" y2="13" {...shared} /><polygon points="22 2 15 22 11 13 2 9 22 2" {...shared} /></>) : null}
      {name === "user-plus" ? (<><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" {...shared} /><circle cx="8.5" cy="7" r="4" {...shared} /><line x1="20" y1="8" x2="20" y2="14" {...shared} /><line x1="23" y1="11" x2="17" y2="11" {...shared} /></>) : null}
      {name === "chevron-left" ? <polyline points="15 18 9 12 15 6" {...shared} /> : null}
      {name === "chevron-right" ? <polyline points="9 18 15 12 9 6" {...shared} /> : null}
      {name === "merge" ? (
        <>
          <circle cx="18" cy="18" r="3" {...shared} />
          <circle cx="6" cy="6" r="3" {...shared} />
          <path d="M6 21V9a9 9 0 0 0 9 9" {...shared} />
        </>
      ) : null}
      {name === "clock" ? (<><circle cx="12" cy="12" r="10" {...shared} /><polyline points="12 6 12 12 16 14" {...shared} /></>) : null}
      {name === "x" ? (<><line x1="18" y1="6" x2="6" y2="18" {...shared} /><line x1="6" y1="6" x2="18" y2="18" {...shared} /></>) : null}
      {name === "x-circle" ? (
        <>
          <circle cx="12" cy="12" r="10" {...shared} />
          <line x1="15" y1="9" x2="9" y2="15" {...shared} />
          <line x1="9" y1="9" x2="15" y2="15" {...shared} />
        </>
      ) : null}
      {name === "sliders" ? (<><line x1="4" y1="21" x2="4" y2="14" {...shared} /><line x1="4" y1="10" x2="4" y2="3" {...shared} /><line x1="12" y1="21" x2="12" y2="12" {...shared} /><line x1="12" y1="8" x2="12" y2="3" {...shared} /><line x1="20" y1="21" x2="20" y2="16" {...shared} /><line x1="20" y1="12" x2="20" y2="3" {...shared} /><line x1="1" y1="14" x2="7" y2="14" {...shared} /><line x1="9" y1="8" x2="15" y2="8" {...shared} /><line x1="17" y1="16" x2="23" y2="16" {...shared} /></>) : null}
    </svg>
  );
}
