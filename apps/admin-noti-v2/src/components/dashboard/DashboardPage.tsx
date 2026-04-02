"use client";

import { AppIcon } from "@/components/icons/AppIcon";
import { SkeletonStatGrid, SkeletonTableBox } from "@/components/loading/PageSkeleton";
import type { V2DashboardResponse } from "@/lib/api/v2";
import { buildResourcesKakaoConnectPath, buildResourcesTabPath, SENDER_NUMBER_APPLICATION_PATH } from "@/lib/routes";
import type { ResourceState } from "@/lib/store/types";
import { canKakao, canSMS } from "@/lib/store/selectors";

function MiniSteps({ state }: { state: "pending" | "done" }) {
  const steps = ["신청", "검토", "완료"];
  const doneCount = state === "done" ? steps.length : 1;
  const activeIndex = state === "done" ? -1 : 1;

  return (
    <>
      <div className="mini-steps">
        {steps.map((label, index) => {
          const done = index < doneCount;
          const active = index === activeIndex;
          return (
            <div className="mini-step" key={label}>
              <div className={`mini-step-dot${done ? " done" : active ? " active" : ""}`}>
                {done ? <AppIcon name="check" className="icon icon-12" /> : index + 1}
              </div>
              {index < steps.length - 1 ? (
                <div className={`mini-step-line${done ? " done" : index === activeIndex - 1 ? " active" : ""}`} />
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="mini-step-labels">
        {steps.map((label, index) => {
          const done = index < doneCount;
          const active = index === activeIndex;
          return (
            <span key={label}>
              <span className={`mini-step-label${done ? " done" : active ? " active" : ""}`}>{label}</span>
              {index < steps.length - 1 ? <span className="mini-step-spacer" /> : null}
            </span>
          );
        })}
      </div>
    </>
  );
}

function ChecklistBadge({ operating }: { operating: number }) {
  if (operating === 2) {
    return (
      <span className="label label-green">
        <span className="label-dot" />
        2 / 2 운영 중
      </span>
    );
  }

  if (operating === 1) {
    return (
      <span className="label label-blue">
        <span className="label-dot" />
        1 / 2 운영 중
      </span>
    );
  }

  return (
    <span className="label label-yellow">
      <span className="label-dot" />
      0 / 2 운영 중
    </span>
  );
}

function ChecklistSection({
  canManageEvents,
  resources,
  dashboard,
  onGoTemplates,
  onGoSmsSend,
  onGoKakaoSend,
}: {
  canManageEvents: boolean;
  resources: ResourceState;
  dashboard: V2DashboardResponse | null;
  onGoTemplates: () => void;
  onGoSmsSend: () => void;
  onGoKakaoSend: () => void;
}) {
  const smsSentCount = dashboard?.stats.smsSentCount ?? 0;
  const kakaoSentCount = dashboard?.stats.kakaoSentCount ?? 0;
  const approvedKakaoTemplateCount = dashboard?.stats.approvedKakaoTemplateCount ?? 0;
  const operating = Number(smsSentCount > 0) + Number(kakaoSentCount > 0);
  const smsManageUrl = buildResourcesTabPath("tab-sms");
  const kakaoManageUrl = buildResourcesKakaoConnectPath();
  const smsOperating = smsSentCount > 0;
  const kakaoOperating = kakaoSentCount > 0;
  const smsRejected = resources.sms === "rejected";
  const kakaoReady = resources.kakao === "active";
  const kakaoCanSend = kakaoReady && approvedKakaoTemplateCount > 0;

  return (
    <div className="box box-no-margin">
      <div className="box-header">
        <div>
          <div className="box-title">시작하기</div>
          <div className="box-subtitle">채널별 준비 상태를 확인하고 필요한 작업을 이어가세요</div>
        </div>
        <ChecklistBadge operating={operating} />
      </div>

      <div className="checklist-item">
        <div
          className={`ci-check ${
            smsOperating
              ? "done"
              : resources.sms === "none"
                ? "pending"
                : resources.sms === "pending"
                  ? "in-review"
                  : resources.sms === "rejected"
                    ? "rejected"
                    : "done"
          }`}
        >
          {smsOperating ? (
            <AppIcon name="check" className="icon icon-12" />
          ) : resources.sms === "none" ? (
            <AppIcon name="warn" className="icon icon-12" />
          ) : resources.sms === "pending" ? (
            <AppIcon name="clock" className="icon icon-12" />
          ) : resources.sms === "rejected" ? (
            <AppIcon name="warn" className="icon icon-12" />
          ) : (
            <AppIcon name="check" className="icon icon-12" />
          )}
        </div>
        <div className="ci-body">
          <div className="ci-title">
            <AppIcon name="sms" className="icon icon-14" />
            SMS
            {!smsOperating && resources.sms === "none" ? (
              <span className="label label-yellow">
                <span className="label-dot" />
                미등록
              </span>
            ) : !smsOperating && resources.sms === "pending" ? (
              <span className="label label-blue">
                <span className="label-dot" />
                검토 중
              </span>
            ) : !smsOperating && resources.sms === "rejected" ? (
              <span className="label label-red">
                <span className="label-dot" />
                거절됨
              </span>
            ) : !smsOperating ? (
              <span className="label label-green">
                <span className="label-dot" />
                등록 완료
              </span>
            ) : null}
          </div>
          <div className="ci-desc">
            {smsOperating
              ? `누적 ${smsSentCount.toLocaleString()}건 발송했습니다. 지금은 SMS를 운영 중입니다.`
              : resources.sms === "none"
                ? "문자 발송에 사용할 번호를 신청합니다. 서류 검토가 완료되면 SMS 발송을 시작할 수 있습니다."
                : resources.sms === "pending"
                  ? "신청서가 접수되었습니다. 검토가 끝나면 SMS 발송 준비가 완료됩니다."
                  : resources.sms === "rejected"
                    ? "발신번호 신청이 거절되었습니다. 거절 사유를 확인하고 서류를 보완해 다시 신청해 주세요."
                    : "발신번호 등록이 완료되었습니다. 첫 SMS 1건을 보내면 운영 중으로 전환됩니다."}
          </div>
          <div className="ci-action">
            {smsOperating ? (
              <button className="btn btn-default btn-sm" onClick={onGoSmsSend}>
                SMS 발송하기
              </button>
            ) : resources.sms === "none" ? (
              <a className="btn btn-default btn-sm" href={SENDER_NUMBER_APPLICATION_PATH}>
                발신번호 신청하기
              </a>
            ) : resources.sms === "pending" ? (
              <a className="btn btn-default btn-sm" href={smsManageUrl}>
                신청 상태 보기
              </a>
            ) : resources.sms === "rejected" ? (
              <a className="btn btn-default btn-sm" href={smsManageUrl}>
                거절 사유 보기
              </a>
            ) : (
              <button className="btn btn-default btn-sm" onClick={onGoSmsSend}>
                SMS 첫 발송하기
              </button>
            )}
          </div>
          {!smsOperating && resources.sms !== "none" && !smsRejected ? (
            <div style={{ marginTop: 10 }}>
              <MiniSteps state={resources.sms === "pending" ? "pending" : "done"} />
            </div>
          ) : null}
        </div>
      </div>

      <div className="checklist-item">
        <div className={`ci-check ${kakaoOperating || kakaoReady ? "done" : "pending"}`}>
          {kakaoOperating || kakaoReady ? (
            <AppIcon name="check" className="icon icon-12" />
          ) : resources.kakao === "none" ? (
            <AppIcon name="warn" className="icon icon-12" />
          ) : (
            <AppIcon name="check" className="icon icon-12" />
          )}
        </div>
        <div className="ci-body">
          <div className="ci-title">
            <AppIcon name="kakao" className="icon icon-14" />
            카카오 알림톡
            {!kakaoOperating && resources.kakao === "none" ? (
              <span className="label label-yellow">
                <span className="label-dot" />
                미연결
              </span>
            ) : !kakaoOperating ? (
              <span className="label label-blue">
                <span className="label-dot" />
                발송 준비 완료
              </span>
            ) : null}
          </div>
          <div className="ci-desc">
            {kakaoOperating
              ? `누적 ${kakaoSentCount.toLocaleString()}건 발송했습니다. 지금은 알림톡을 운영 중입니다.`
              : resources.kakao === "none"
              ? "알림톡 발송을 위해 카카오 채널을 연결합니다. 연결 후 템플릿을 준비하면 바로 시작할 수 있습니다."
              : approvedKakaoTemplateCount > 0
                ? "채널 연결이 완료되었습니다. 알림톡 1건 이상 발송하면 운영 중으로 전환됩니다."
                : "채널 연결은 완료되었습니다. 다음으로 알림톡 템플릿을 준비해 주세요."}
          </div>
          <div className="ci-action">
            {kakaoOperating ? (
              <button className="btn btn-default btn-sm" onClick={onGoKakaoSend}>
                알림톡 발송하기
              </button>
            ) : resources.kakao === "none" ? (
              <a className="btn btn-default btn-sm" href={kakaoManageUrl}>
                채널 연결하기
              </a>
            ) : kakaoCanSend ? (
              <button className="btn btn-default btn-sm" onClick={onGoKakaoSend}>
                알림톡 첫 발송하기
              </button>
            ) : (
              <button className="btn btn-default btn-sm" onClick={onGoTemplates}>
                알림톡 템플릿 준비
              </button>
            )}
          </div>
        </div>
      </div>

      {canManageEvents && operating === 0 ? (
        <div className="checklist-item" style={{ opacity: 0.6 }}>
          <div className="ci-check todo" />
          <div className="ci-body">
            <div className="ci-title">
              <AppIcon name="zap" className="icon icon-14" />
              이벤트 규칙
            </div>
            <div className="ci-desc">채널 준비가 끝나면 자동 발송 규칙도 함께 설정할 수 있습니다.</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChannelStatusColumn({
  notices,
}: {
  notices: V2DashboardResponse["notices"];
}) {
  return (
    <div>
      <div className="box">
        <div className="box-header">
          <div className="box-title">공지사항</div>
          <button className="btn btn-default btn-sm" disabled={notices.length === 0}>전체 보기</button>
        </div>
        <div style={{ padding: "8px 16px" }}>
          {notices.length > 0 ? notices.slice(0, 2).map((notice) => (
            <div className="notice-row" key={notice.id}>
              <span className={`notice-type ${notice.isPinned ? "nt-warn" : "nt-upd"}`}>{notice.isPinned ? "NOTICE" : "UPDATE"}</span>
              <div>
                <div className="notice-text">{notice.title}</div>
                <div className="notice-date">{formatDashboardDate(notice.createdAt)}</div>
              </div>
            </div>
          )) : (
            <div className="text-small text-muted" style={{ padding: "8px 0" }}>표시할 공지사항이 없습니다.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuotaPanel({ dashboard }: { dashboard: V2DashboardResponse | null }) {
  const smsApprovedCount = dashboard?.readiness.sms.approvedCount ?? 0;
  const kakaoActiveCount = dashboard?.readiness.kakao.activeCount ?? 0;
  const smsMonthlyLimit = smsApprovedCount * 1000;
  const kakaoDailyLimit = kakaoActiveCount * 1000;
  const smsMonthSent = dashboard?.stats.smsMonthSentCount ?? 0;
  const kakaoDaySent = dashboard?.stats.kakaoDaySentCount ?? 0;
  const smsProgress =
    smsMonthlyLimit > 0 ? Math.min(100, Math.round((smsMonthSent / smsMonthlyLimit) * 100)) : 0;
  const kakaoProgress =
    kakaoDailyLimit > 0 ? Math.min(100, Math.round((kakaoDaySent / kakaoDailyLimit) * 100)) : 0;
  const quotaSnapshotAt = dashboard?.quotaSnapshotAt ?? new Date().toISOString();
  const quotaBaseDate = formatQuotaBaseDate(quotaSnapshotAt);
  const nextMonthlyReset = formatNextMonthlyReset(quotaSnapshotAt);

  return (
    <div className="box">
      <div className="box-header">
        <div className="box-title">발송량</div>
        <span className="text-small text-muted">기준일: {quotaBaseDate}</span>
      </div>
      <div className="box-body quota-panel-body">
        <div className="quota-item">
          <div className="quota-item-top">
            <div className="quota-item-title">
              <AppIcon name="sms" className="icon icon-16 text-muted" />
              <span>SMS 발송</span>
              <span className="label label-gray quota-period-chip">월간</span>
            </div>
            <span className="quota-item-value text-mono">
              {smsMonthlyLimit > 0 ? `${smsMonthSent.toLocaleString()} / ${smsMonthlyLimit.toLocaleString()} 건` : "0 / 0 건"}
            </span>
          </div>
          <div className="progress quota-progress"><div className="progress-bar" style={{ width: `${smsProgress}%` }} /></div>
          <div className="quota-item-meta">
            <span>매월 1일 초기화</span>
            <span>다음 리셋: {nextMonthlyReset}</span>
          </div>
        </div>

        <div className="quota-item">
          <div className="quota-item-top">
            <div className="quota-item-title">
              <AppIcon name="kakao" className="icon icon-16 text-muted" />
              <span>알림톡 발송</span>
              <span className="label label-gray quota-period-chip">일간</span>
            </div>
            <span className="quota-item-value text-mono">
              {kakaoDailyLimit > 0 ? `${kakaoDaySent.toLocaleString()} / ${kakaoDailyLimit.toLocaleString()} 건` : "0 / 0 건"}
            </span>
          </div>
          <div className="progress quota-progress"><div className="progress-bar green" style={{ width: `${kakaoProgress}%` }} /></div>
          <div className="quota-item-meta">
            <span>매일 자정(00:00) 초기화</span>
            <span>다음 리셋: 내일 00:00</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardPage({
  sessionRole,
  resources,
  dashboard,
  loading,
  error,
  onGoTemplates,
  onGoSmsSend,
  onGoKakaoSend,
}: {
  sessionRole: "TENANT_ADMIN" | "PARTNER_ADMIN" | "SUPER_ADMIN";
  resources: ResourceState;
  dashboard: V2DashboardResponse | null;
  loading?: boolean;
  error?: string | null;
  onGoTemplates: () => void;
  onGoSmsSend: () => void;
  onGoKakaoSend: () => void;
}) {
  const canManageEvents = sessionRole === "PARTNER_ADMIN";
  const ready = canSMS(resources) || canKakao(resources);
  const showLoadingNotice = Boolean(loading && !dashboard);

  if (showLoadingNotice) {
    return (
      <>
        <div className="page-header">
          <div className="page-header-row">
            <div>
              <div className="page-title">대시보드</div>
              <div className="page-desc">워크스페이스 운영 현황</div>
            </div>
          </div>
        </div>

        <SkeletonStatGrid columns={4} />
        <div className="dash-row dash-row-70-30">
          <SkeletonTableBox titleWidth={76} rows={4} columns={["1.8fr", "120px"]} />
          <SkeletonTableBox titleWidth={68} rows={4} columns={["1.4fr", "80px"]} />
        </div>
        <SkeletonTableBox titleWidth={88} rows={3} columns={["1.4fr", "110px"]} />
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <div className="page-title">대시보드</div>
            <div className="page-desc">{dashboard?.account.tenantName ?? "워크스페이스"} 운영 현황</div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="flash flash-attention">
          <AppIcon name="warn" className="icon icon-16 flash-icon" />
          <div className="flash-body">{error}</div>
        </div>
      ) : null}

      <div className="box mb-16">
        <div className="stats-grid">
          <div className="stat-cell">
            <div className="stat-label-t">오늘 발송 요청</div>
            <div className="stat-value-t" style={!ready ? { color: "var(--fg-subtle)" } : undefined}>
              {ready ? (dashboard?.sendQuota.todaySent ?? 0).toLocaleString() : "—"}
            </div>
            <div className="stat-sub-t">{ready ? "발송 대기 중" : "발신 자원 미설정"}</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label-t">등록된 발신번호</div>
            <div className="stat-value-t">{dashboard?.stats.senderNumberCount ?? 0}</div>
            <div className="stat-sub-t">승인 기준</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label-t">승인된 알림톡 템플릿</div>
            <div className="stat-value-t">{dashboard?.stats.approvedKakaoTemplateCount ?? 0}</div>
            <div className="stat-sub-t">발송 가능 템플릿</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label-t">이벤트 규칙</div>
            <div
              className="stat-value-t"
              style={
                (dashboard?.stats.activeEventRuleCount ?? 0) === 0
                  ? { color: "var(--fg-subtle)" }
                  : undefined
              }
            >
              {dashboard?.stats.activeEventRuleCount ?? 0}
            </div>
            <div className="stat-sub-t">활성 중</div>
          </div>
        </div>
      </div>

          <div className="dash-row dash-row-70-30">
            <ChecklistSection
              canManageEvents={canManageEvents}
              resources={resources}
              dashboard={dashboard}
              onGoTemplates={onGoTemplates}
              onGoSmsSend={onGoSmsSend}
              onGoKakaoSend={onGoKakaoSend}
            />
            <ChannelStatusColumn notices={dashboard?.notices ?? []} />
          </div>

      <QuotaPanel dashboard={dashboard} />
    </>
  );
}

function formatDashboardDate(value: string) {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatQuotaBaseDate(value: string) {
  try {
    return new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatNextMonthlyReset(value: string) {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
    });
    const parts = formatter.formatToParts(new Date(value));
    const year = Number(parts.find((part) => part.type === "year")?.value ?? "1970");
    const month = Number(parts.find((part) => part.type === "month")?.value ?? "01");
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  } catch {
    return "-";
  }
}
