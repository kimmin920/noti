"use client";

import { useMemo, useState } from "react";
import { AppIcon } from "@/components/icons/AppIcon";

type ChannelId = "sms" | "alimtalk" | "brand";
type SendMode = "single" | "bulk";
type CurrentItemId =
  | "sms-send"
  | "sms-campaign"
  | "alimtalk-send"
  | "alimtalk-campaign"
  | "brand-send"
  | "brand-campaign";

type IconName = Parameters<typeof AppIcon>[0]["name"];

type CurrentItem = {
  id: CurrentItemId;
  label: string;
  channel: ChannelId;
  mode: SendMode;
  icon: IconName;
  note: string;
};

type RecommendedPrimaryItem = {
  id: SendMode;
  label: string;
  icon: IconName;
  note: string;
};

const CHANNEL_LABELS: Record<ChannelId, string> = {
  sms: "SMS",
  alimtalk: "알림톡",
  brand: "브랜드 메시지",
};

const CHANNEL_CHIPS: Record<ChannelId, string> = {
  sms: "chip chip-sms",
  alimtalk: "chip chip-kakao",
  brand: "chip chip-brand",
};

const CURRENT_SECTIONS: Array<{ title: string; items: CurrentItem[] }> = [
  {
    title: "메시지 발송",
    items: [
      {
        id: "sms-send",
        label: "SMS 발송",
        channel: "sms",
        mode: "single",
        icon: "sms",
        note: "단건 문자와 MMS",
      },
      {
        id: "sms-campaign",
        label: "SMS 대량 발송",
        channel: "sms",
        mode: "bulk",
        icon: "sms-bulk",
        note: "SMS 캠페인",
      },
    ],
  },
  {
    title: "카카오 발송",
    items: [
      {
        id: "alimtalk-send",
        label: "알림톡 발송",
        channel: "alimtalk",
        mode: "single",
        icon: "kakao",
        note: "승인 템플릿 단건",
      },
      {
        id: "alimtalk-campaign",
        label: "알림톡 대량 발송",
        channel: "alimtalk",
        mode: "bulk",
        icon: "kakao-bulk",
        note: "알림톡 캠페인",
      },
      {
        id: "brand-send",
        label: "브랜드 메시지",
        channel: "brand",
        mode: "single",
        icon: "brand",
        note: "친구 대상 단건",
      },
      {
        id: "brand-campaign",
        label: "브랜드 메시지 대량",
        channel: "brand",
        mode: "bulk",
        icon: "brand-bulk",
        note: "브랜드 캠페인",
      },
    ],
  },
];

const RECOMMENDED_PRIMARY_ITEMS: RecommendedPrimaryItem[] = [
  {
    id: "single",
    label: "단건 발송",
    icon: "send",
    note: "한 명에게 바로 보내기",
  },
  {
    id: "bulk",
    label: "대량 발송",
    icon: "campaign",
    note: "수신자를 고르고 캠페인 만들기",
  },
];

const CHANNELS: Array<{ id: ChannelId; label: string; icon: IconName }> = [
  { id: "sms", label: "SMS", icon: "sms" },
  { id: "alimtalk", label: "알림톡", icon: "kakao" },
  { id: "brand", label: "브랜드", icon: "brand" },
];

const MODE_LABELS: Record<SendMode, string> = {
  single: "단건 발송",
  bulk: "대량 발송",
};

function currentItems() {
  return CURRENT_SECTIONS.flatMap((section) => section.items);
}

function getChannelDescription(channel: ChannelId, mode: SendMode) {
  if (mode === "bulk") {
    if (channel === "sms") return "수신자 그룹에 맞춰 SMS 캠페인을 만들고 진행률을 확인합니다.";
    if (channel === "alimtalk") return "승인된 알림톡 템플릿과 수신자 컬럼을 연결해 캠페인을 만듭니다.";
    return "채널 친구 대상 브랜드 메시지 캠페인을 자유형 또는 템플릿형으로 만듭니다.";
  }

  if (channel === "sms") return "문자 내용을 입력하면 SMS, LMS, MMS 전환 기준을 바로 확인합니다.";
  if (channel === "alimtalk") return "카카오 채널과 승인 템플릿을 선택하고 변수 값을 입력합니다.";
  return "브랜드 메시지의 자유형, 템플릿형, 이미지 타입을 한 흐름에서 선택합니다.";
}

function getFieldRows(channel: ChannelId, mode: SendMode) {
  if (mode === "bulk") {
    return [
      ["1", "기본 설정", channel === "brand" ? "발송 방식, 채널, 시간" : "캠페인명, 발신 자원, 시간"],
      ["2", "수신자 선택", "검색, 필터, 현재 목록 선택"],
      ["3", channel === "alimtalk" ? "템플릿 선택" : "메시지 작성", "변수와 수신자 컬럼 연결"],
      ["4", "검토 및 발송", "최종 요약 확인 후 접수"],
    ];
  }

  if (channel === "sms") {
    return [
      ["발신", "발신번호", "승인된 번호만 표시"],
      ["수신", "수신번호", "직접 입력 또는 수신자 선택"],
      ["내용", "본문", "SMS/LMS/MMS 자동 전환"],
      ["시간", "즉시 또는 예약", "야간 제한 안내"],
    ];
  }

  if (channel === "alimtalk") {
    return [
      ["채널", "발신 채널", "연결된 카카오 채널"],
      ["템플릿", "승인 템플릿", "채널별 사용 가능 템플릿"],
      ["변수", "#{변수}", "템플릿 변수 값 입력"],
      ["대체", "SMS fallback", "실패 시 문자 대체"],
    ];
  }

  return [
    ["방식", "자유형/템플릿형", "먼저 작성 방식을 선택"],
    ["타입", "텍스트/이미지/와이드", "선택에 따라 필드 노출"],
    ["수신", "채널 친구 대상", "I 타겟팅 기준"],
    ["시간", "즉시 또는 예약", "야간 제한 검증"],
  ];
}

function MiniSidebarButton({
  active,
  icon,
  label,
  note,
  onClick,
}: {
  active: boolean;
  icon: IconName;
  label: string;
  note?: string;
  onClick: () => void;
}) {
  return (
    <button className={`ux-nav-item${active ? " active" : ""}`} type="button" aria-pressed={active} onClick={onClick}>
      <span className="ux-nav-item-main">
        <AppIcon name={icon} className="icon icon-16" />
        <span>{label}</span>
      </span>
      {note ? <span className="ux-nav-note">{note}</span> : null}
    </button>
  );
}

function WorkSurface({
  label,
  mode,
  channel,
  compactTitle,
}: {
  label: string;
  mode: SendMode;
  channel: ChannelId;
  compactTitle?: string;
}) {
  const rows = getFieldRows(channel, mode);

  return (
    <div className="ux-work-surface">
      <div className="ux-work-head">
        <div>
          <div className="ux-work-title">{compactTitle ?? label}</div>
          <div className="ux-work-desc">{getChannelDescription(channel, mode)}</div>
        </div>
        <span className={CHANNEL_CHIPS[channel]}>{CHANNEL_LABELS[channel]}</span>
      </div>

      {mode === "bulk" ? (
        <div className="ux-mini-steps" aria-label={`${label} 단계`}>
          {rows.map(([index, title]) => (
            <div className="ux-mini-step" key={index}>
              <span className="ux-mini-step-index">{index}</span>
              <span>{title}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="ux-field-list">
        {rows.map(([key, title, desc]) => (
          <div className="ux-field-row" key={`${key}-${title}`}>
            <div className="ux-field-key">{key}</div>
            <div>
              <div className="ux-field-title">{title}</div>
              <div className="ux-field-desc">{desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="ux-preview-strip">
        <div className="ux-preview-phone" aria-hidden="true">
          <div className="ux-preview-dot" />
          <div className="ux-preview-bubble" />
          <div className="ux-preview-line short" />
          <div className="ux-preview-line" />
        </div>
        <div className="ux-preview-meta">
          <div className="ux-preview-title">작업 맥락</div>
          <div className="ux-preview-copy">
            {mode === "bulk"
              ? "단계형 검토가 필요하므로 단건 작성 화면과 분리하는 편이 안전합니다."
              : "필드 구조가 비슷하므로 채널 탭만 바뀌어도 사용자가 흐름을 유지할 수 있습니다."}
          </div>
        </div>
      </div>
    </div>
  );
}

function CurrentPrototype({
  activeId,
  onSelect,
}: {
  activeId: CurrentItemId;
  onSelect: (id: CurrentItemId) => void;
}) {
  const activeItem = currentItems().find((item) => item.id === activeId) ?? CURRENT_SECTIONS[0].items[0];

  return (
    <div className="ux-prototype-shell">
      <aside className="ux-mini-sidebar" aria-label="현재 구조">
        {CURRENT_SECTIONS.map((section) => (
          <div className="ux-nav-section" key={section.title}>
            <div className="ux-nav-heading">{section.title}</div>
            {section.items.map((item) => (
              <MiniSidebarButton
                key={item.id}
                active={activeItem.id === item.id}
                icon={item.icon}
                label={item.label}
                note={item.note}
                onClick={() => onSelect(item.id)}
              />
            ))}
          </div>
        ))}
      </aside>
      <section className="ux-prototype-main">
        <WorkSurface
          label={activeItem.label}
          mode={activeItem.mode}
          channel={activeItem.channel}
        />
      </section>
    </div>
  );
}

function RecommendedPrototype({
  mode,
  channel,
  onModeChange,
  onChannelChange,
}: {
  mode: SendMode;
  channel: ChannelId;
  onModeChange: (mode: SendMode) => void;
  onChannelChange: (channel: ChannelId) => void;
}) {
  return (
    <div className="ux-prototype-shell">
      <aside className="ux-mini-sidebar compact" aria-label="권장 구조">
        <div className="ux-nav-section">
          <div className="ux-nav-heading">메시지</div>
          {RECOMMENDED_PRIMARY_ITEMS.map((item) => (
            <MiniSidebarButton
              key={item.id}
              active={mode === item.id}
              icon={item.icon}
              label={item.label}
              note={item.note}
              onClick={() => onModeChange(item.id)}
            />
          ))}
        </div>
        <div className="ux-nav-section muted">
          <div className="ux-nav-heading">운영</div>
          <div className="ux-nav-static">템플릿 관리</div>
          <div className="ux-nav-static">발송 기록</div>
          <div className="ux-nav-static">수신자 관리</div>
        </div>
      </aside>
      <section className="ux-prototype-main">
        <div className="ux-channel-tabs" role="tablist" aria-label={`${MODE_LABELS[mode]} 채널`}>
          {CHANNELS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={channel === item.id}
              className={`ux-channel-tab${channel === item.id ? " active" : ""}`}
              onClick={() => onChannelChange(item.id)}
            >
              <AppIcon name={item.icon} className="icon icon-14" />
              {item.label}
            </button>
          ))}
        </div>
        <WorkSurface
          compactTitle={MODE_LABELS[mode]}
          label={`${CHANNEL_LABELS[channel]} ${MODE_LABELS[mode]}`}
          mode={mode}
          channel={channel}
        />
      </section>
    </div>
  );
}

function DecisionCard({
  title,
  value,
  tone = "neutral",
}: {
  title: string;
  value: string;
  tone?: "neutral" | "good" | "warn";
}) {
  return (
    <div className={`ux-decision-card ${tone}`}>
      <div className="ux-decision-title">{title}</div>
      <div className="ux-decision-value">{value}</div>
    </div>
  );
}

function ComparePanel({
  eyebrow,
  headingId,
  title,
  summary,
  children,
  metrics,
}: {
  eyebrow: string;
  headingId: string;
  title: string;
  summary: string;
  children: React.ReactNode;
  metrics: Array<{ title: string; value: string; tone?: "neutral" | "good" | "warn" }>;
}) {
  return (
    <section className="ux-compare-panel" aria-labelledby={headingId}>
      <div className="ux-panel-head">
        <div>
          <div className="ux-panel-eyebrow">{eyebrow}</div>
          <h2 id={headingId} className="ux-panel-title">{title}</h2>
          <p className="ux-panel-summary">{summary}</p>
        </div>
      </div>
      <div className="ux-decision-grid">
        {metrics.map((metric) => (
          <DecisionCard key={metric.title} {...metric} />
        ))}
      </div>
      {children}
    </section>
  );
}

export function MessagingNavigationComparePage() {
  const [currentActiveId, setCurrentActiveId] = useState<CurrentItemId>("alimtalk-send");
  const [recommendedMode, setRecommendedMode] = useState<SendMode>("single");
  const [recommendedChannel, setRecommendedChannel] = useState<ChannelId>("alimtalk");
  const currentActiveItem = useMemo(
    () => currentItems().find((item) => item.id === currentActiveId) ?? CURRENT_SECTIONS[0].items[0],
    [currentActiveId],
  );
  const recommendedClickPath = recommendedMode === "single" ? "사이드바 1회 + 채널 탭 1회" : "사이드바 1회 + 채널 탭 1회";

  return (
    <>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <div className="page-title">메시징 내비게이션 비교</div>
            <div className="page-desc">현재 6개 진입점과 권장 2개 진입점을 같은 조건에서 클릭해 비교합니다</div>
          </div>
          <span className="label label-blue status-label-sm">
            <span className="label-dot" />
            내부 검토용
          </span>
        </div>
      </div>

      <div className="ux-compare-note">
        <AppIcon name="info" className="icon icon-16" />
        <div>
          <strong>실제 발송 기능은 연결하지 않은 프로토타입입니다.</strong>
          <span> 사이드바 정보 구조, 채널 선택 위치, 단건/대량 구분만 비교합니다.</span>
        </div>
      </div>

      <div className="ux-compare-grid">
        <ComparePanel
          eyebrow="현재 버전"
          headingId="current-messaging-navigation-title"
          title="채널과 발송 규모를 사이드바에서 모두 선택"
          summary="목적이 이미 정해진 운영자는 빠르게 진입하지만, 첫 사용자는 6개 항목을 동시에 해석해야 합니다."
          metrics={[
            { title: "진입점", value: "6개", tone: "warn" },
            { title: "현재 선택", value: currentActiveItem.label },
            { title: "장점", value: "직접 진입이 빠름", tone: "good" },
          ]}
        >
          <CurrentPrototype activeId={currentActiveId} onSelect={setCurrentActiveId} />
        </ComparePanel>

        <ComparePanel
          eyebrow="권장안"
          headingId="recommended-messaging-navigation-title"
          title="먼저 단건/대량을 고르고, 화면 안에서 채널 선택"
          summary="작업 규모를 먼저 정한 뒤 같은 화면 맥락에서 SMS, 알림톡, 브랜드 메시지를 바꿔봅니다."
          metrics={[
            { title: "진입점", value: "2개", tone: "good" },
            { title: "선택 경로", value: recommendedClickPath },
            { title: "장점", value: "확장에 강함", tone: "good" },
          ]}
        >
          <RecommendedPrototype
            mode={recommendedMode}
            channel={recommendedChannel}
            onModeChange={setRecommendedMode}
            onChannelChange={setRecommendedChannel}
          />
        </ComparePanel>
      </div>

      <div className="ux-verdict-grid">
        <section className="box">
          <div className="box-header">
            <div className="box-title">판단 포인트</div>
          </div>
          <div className="box-section-tight">
            <div className="box-row">
              <div className="box-row-content">
                <div className="table-kind-text">처음 온 사용자</div>
                <div className="box-row-desc">권장안이 시작점을 더 빨리 설명합니다. 먼저 “단건인지 대량인지”만 고르면 됩니다.</div>
              </div>
            </div>
            <div className="box-row">
              <div className="box-row-content">
                <div className="table-kind-text">숙련 운영자</div>
                <div className="box-row-desc">현재안은 특정 채널로 바로 들어가는 클릭 수가 적습니다. 자주 쓰는 항목을 상단 바로가기로 보완할 수 있습니다.</div>
              </div>
            </div>
            <div className="box-row" style={{ borderBottom: "none" }}>
              <div className="box-row-content">
                <div className="table-kind-text">서비스 확장</div>
                <div className="box-row-desc">권장안은 RCS, 친구톡, 이메일 같은 채널이 늘어도 사이드바가 과도하게 길어지지 않습니다.</div>
              </div>
            </div>
          </div>
        </section>

        <section className="box">
          <div className="box-header">
            <div className="box-title">결정 전에 볼 것</div>
          </div>
          <div className="box-section-tight">
            <div className="box-row">
              <div className="box-row-content">
                <div className="table-kind-text">클릭 실험</div>
                <div className="box-row-desc">자주 쓰는 작업 3개를 정하고 두 버전에서 어디를 누르게 되는지 비교합니다.</div>
              </div>
            </div>
            <div className="box-row">
              <div className="box-row-content">
                <div className="table-kind-text">용어 확인</div>
                <div className="box-row-desc">“비즈메시지” 대신 사용자가 구분해야 하는 실제 선택지인 알림톡과 브랜드 메시지를 유지합니다.</div>
              </div>
            </div>
            <div className="box-row" style={{ borderBottom: "none" }}>
              <div className="box-row-content">
                <div className="table-kind-text">기능 보존</div>
                <div className="box-row-desc">기존 URL은 유지하고 사이드바 노출만 줄이면 북마크와 외부 링크 영향이 작습니다.</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
