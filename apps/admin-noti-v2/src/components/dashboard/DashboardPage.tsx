"use client";

import { AppIcon } from "@/components/icons/AppIcon";
import { SkeletonStatGrid, SkeletonTableBox } from "@/components/loading/PageSkeleton";
import type { V2DashboardResponse } from "@/lib/api/v2";
import type { ResourceState } from "@/lib/store/types";
import { canKakao, canSMS } from "@/lib/store/selectors";

function MiniSteps({ state }: { state: "pending" | "done" }) {
  const currentStep = state === "done" ? 2 : 1;
  const steps = ["신청", "검토", "완료"];

  return (
    <>
      <div className="mini-steps">
        {steps.map((label, index) => {
          const done = index < currentStep;
          const active = index === currentStep;
          return (
            <div className="mini-step" key={label}>
              <div className={`mini-step-dot${done ? " done" : active ? " active" : ""}`}>
                {done ? <AppIcon name="check" className="icon icon-12" /> : index + 1}
              </div>
              {index < steps.length - 1 ? (
                <div className={`mini-step-line${done ? " done" : index === currentStep - 1 ? " active" : ""}`} />
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="mini-step-labels">
        {steps.map((label, index) => {
          const done = index < currentStep;
          const active = index === currentStep;
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

function ChecklistBadge({ completed }: { completed: number }) {
  if (completed === 2) {
    return (
      <span className="label label-green">
        <span className="label-dot" />
        2 / 2 완료
      </span>
    );
  }

  if (completed === 1) {
    return (
      <span className="label label-blue">
        <span className="label-dot" />
        1 / 2 완료
      </span>
    );
  }

  return (
    <span className="label label-yellow">
      <span className="label-dot" />
      0 / 2 완료
    </span>
  );
}

function ChecklistSection({
  resources,
  onOpenSmsReg,
  onOpenKakaoReg,
  onGoTemplates,
  onGoSmsSend,
}: {
  resources: ResourceState;
  onOpenSmsReg: () => void;
  onOpenKakaoReg: () => void;
  onGoTemplates: () => void;
  onGoSmsSend: () => void;
}) {
  const completed = Number(resources.sms === "active") + Number(resources.kakao === "active");
  const anyDone = resources.sms === "active" || resources.kakao === "active";

  return (
    <div className="box">
      <div className="box-header">
        <div>
          <div className="box-title">시작하기</div>
          <div className="box-subtitle">아래 단계를 완료하면 각 메시지 발송이 활성화됩니다</div>
        </div>
        <ChecklistBadge completed={completed} />
      </div>

      <div className="checklist-item">
        <div
          className={`ci-check ${
            resources.sms === "none"
              ? "pending"
              : resources.sms === "pending"
                ? "in-review"
                : "done"
          }`}
        >
          {resources.sms === "none" ? (
            <AppIcon name="warn" className="icon icon-12" />
          ) : resources.sms === "pending" ? (
            <AppIcon name="clock" className="icon icon-12" />
          ) : (
            <AppIcon name="check" className="icon icon-12" />
          )}
        </div>
        <div className="ci-body">
          <div className="ci-title">
            <AppIcon name="phone" className="icon icon-14" />
            SMS 발신번호 등록
            {resources.sms === "none" ? (
              <span className="label label-yellow">
                <span className="label-dot" />
                미등록
              </span>
            ) : resources.sms === "pending" ? (
              <span className="label label-blue">
                <span className="label-dot" />
                검토 중
              </span>
            ) : (
              <span className="label label-green">
                <span className="label-dot" />
                등록 완료
              </span>
            )}
          </div>
          <div className="ci-desc">
            {resources.sms === "none"
              ? "문자 발송에 사용할 번호를 신청합니다. 사업자등록증 등 서류 제출 후 검토가 완료되면 SMS 발송이 활성화됩니다."
              : resources.sms === "pending"
                ? "신청서가 접수되었습니다. 서류 검토가 완료되면 SMS 발송이 자동 활성화됩니다."
                : "SMS 발신번호가 등록되어 SMS 발송이 활성화되었습니다."}
          </div>
          <div className="ci-action">
            {resources.sms === "none" ? (
              <button className="btn btn-accent btn-sm" onClick={onOpenSmsReg}>
                <AppIcon name="key" className="icon icon-12" />
                발신번호 신청하기
              </button>
            ) : resources.sms === "pending" ? (
              <button className="btn btn-default btn-sm" onClick={onOpenSmsReg}>
                <AppIcon name="key" className="icon icon-14" />
                신청 상태 보기
              </button>
            ) : (
              <button className="btn btn-default btn-sm" onClick={onGoSmsSend}>
                <AppIcon name="sms" className="icon icon-12" />
                SMS 발송하기
              </button>
            )}
          </div>
          {resources.sms !== "none" ? (
            <div style={{ marginTop: 10 }}>
              <MiniSteps state={resources.sms === "pending" ? "pending" : "done"} />
            </div>
          ) : null}
        </div>
      </div>

      <div className="checklist-item">
        <div className={`ci-check ${resources.kakao === "none" ? "pending" : "done"}`}>
          {resources.kakao === "none" ? (
            <AppIcon name="warn" className="icon icon-12" />
          ) : (
            <AppIcon name="check" className="icon icon-12" />
          )}
        </div>
        <div className="ci-body">
          <div className="ci-title">
            <AppIcon name="kakao" className="icon icon-14" />
            카카오채널 연결
            {resources.kakao === "none" ? (
              <span className="label label-yellow">
                <span className="label-dot" />
                미연결
              </span>
            ) : (
              <span className="label label-green">
                <span className="label-dot" />
                연결 완료
              </span>
            )}
          </div>
          <div className="ci-desc">
            {resources.kakao === "none"
              ? "알림톡 발송을 위해 카카오 비즈니스 채널을 연결합니다. 채널 검색용 ID가 필요합니다."
              : "카카오채널이 연결되어 알림톡 발송이 활성화되었습니다."}
          </div>
          <div className="ci-action">
            {resources.kakao === "none" ? (
              <button className="btn btn-kakao btn-sm" onClick={onOpenKakaoReg}>
                <AppIcon name="kakao" className="icon icon-12" />
                채널 연결하기
              </button>
            ) : (
              <button className="btn btn-default btn-sm" onClick={onGoTemplates}>
                <AppIcon name="template" className="icon icon-12" />
                알림톡 템플릿 보기
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="checklist-item" style={{ opacity: anyDone ? 1 : 0.45 }}>
        <div className="ci-check todo" />
        <div className="ci-body">
          <div className="ci-title">
            <AppIcon name="template" className="icon icon-14" />
            템플릿 작성
          </div>
          <div className="ci-desc">발신 자원 등록 후 SMS/알림톡 템플릿을 작성합니다.</div>
        </div>
      </div>

      <div className="checklist-item" style={{ opacity: anyDone ? 1 : 0.45 }}>
        <div className="ci-check todo" />
        <div className="ci-body">
          <div className="ci-title">
            <AppIcon name="zap" className="icon icon-14" />
            이벤트 규칙 설정
          </div>
          <div className="ci-desc">외부 이벤트와 발송 채널을 연결하는 규칙을 설정합니다.</div>
        </div>
      </div>
    </div>
  );
}

function ChannelStatusColumn({
  resources,
  notices,
}: {
  resources: ResourceState;
  notices: V2DashboardResponse["notices"];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="box">
        <div className="box-header">
          <div className="box-title">채널 상태</div>
        </div>
        <div className="box-row">
          <div className="box-row-content">
            <div className="box-row-title text-small">메시지 큐</div>
          </div>
          <span>
            <span className="status-dot sd-green" />
            <span className="text-small text-success">정상</span>
          </span>
        </div>
        <div className="box-row">
          <div className="box-row-content">
            <div className="box-row-title text-small">SMS 발신번호</div>
          </div>
          <span>
            {resources.sms === "none" ? (
              <>
                <span className="status-dot sd-yellow" />
                <span className="text-small" style={{ color: "var(--attention-fg)" }}>미등록</span>
              </>
            ) : resources.sms === "pending" ? (
              <>
                <span className="status-dot" style={{ background: "var(--accent-emphasis)", boxShadow: "0 0 0 3px rgba(9,105,218,.15)" }} />
                <span className="text-small" style={{ color: "var(--accent-fg)" }}>심사 중</span>
              </>
            ) : (
              <>
                <span className="status-dot sd-green" />
                <span className="text-small text-success">활성</span>
              </>
            )}
          </span>
        </div>
        <div className="box-row">
          <div className="box-row-content">
            <div className="box-row-title text-small">카카오채널</div>
          </div>
          <span>
            {resources.kakao === "none" ? (
              <>
                <span className="status-dot sd-yellow" />
                <span className="text-small" style={{ color: "var(--attention-fg)" }}>미연결</span>
              </>
            ) : (
              <>
                <span className="status-dot sd-green" />
                <span className="text-small text-success">활성</span>
              </>
            )}
          </span>
        </div>
      </div>

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

function QuickActions({
  resources,
  onGoSmsSend,
  onGoEvents,
}: {
  resources: ResourceState;
  onGoSmsSend: () => void;
  onGoEvents: () => void;
}) {
  const smsReady = canSMS(resources);
  const kakaoReady = canKakao(resources);

  return (
    <div className="box">
      <div className="box-header">
        <div className="box-title">빠른 실행</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
        <div style={{ padding: 20, borderRight: "1px solid var(--border-subtle)", opacity: smsReady ? 1 : 0.5, textAlign: "center" }}>
          <AppIcon name="sms" className="icon icon-32" style={{ color: "var(--accent-fg)", marginBottom: 10 }} />
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>SMS 발송</div>
          <div className="text-small text-muted" style={{ marginBottom: 12 }}>단건 문자 · MMS</div>
          {smsReady ? (
            <button className="btn btn-accent btn-sm" onClick={onGoSmsSend}>
              <AppIcon name="send" className="icon icon-12" />
              발송하기
            </button>
          ) : (
            <button className="btn btn-default btn-sm" disabled>
              <AppIcon name="sms" className="icon icon-12" />
              {resources.sms === "pending" ? "심사 진행 중" : "발신번호 필요"}
            </button>
          )}
        </div>

        <div style={{ padding: 20, borderRight: "1px solid var(--border-subtle)", opacity: kakaoReady ? 1 : 0.5, textAlign: "center" }}>
          <AppIcon name="kakao" className="icon icon-32" style={{ color: "#7a6a00", marginBottom: 10 }} />
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>알림톡 발송</div>
          <div className="text-small text-muted" style={{ marginBottom: 12 }}>카카오 비즈메시지</div>
          {kakaoReady ? (
            <button className="btn btn-kakao btn-sm">
              <AppIcon name="send" className="icon icon-12" />
              발송하기
            </button>
          ) : (
            <button className="btn btn-default btn-sm" disabled>
              <AppIcon name="kakao" className="icon icon-12" />
              채널 필요
            </button>
          )}
        </div>

        <div style={{ padding: 20, textAlign: "center" }}>
          <AppIcon name="zap" className="icon icon-32" style={{ color: "var(--done-fg)", marginBottom: 10 }} />
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>이벤트 규칙</div>
          <div className="text-small text-muted" style={{ marginBottom: 12 }}>자동 발송 설정</div>
          <button className="btn btn-accent btn-sm" onClick={onGoEvents}>
            <AppIcon name="chevron-right" className="icon icon-12" />
            규칙 관리
          </button>
        </div>
      </div>
    </div>
  );
}

function QuotaPanel({ dashboard }: { dashboard: V2DashboardResponse | null }) {
  const todaySent = dashboard?.sendQuota.todaySent ?? 0;
  const dailyMax = dashboard?.sendQuota.dailyMax ?? 1;
  const remaining = dashboard?.sendQuota.remaining ?? 0;
  const progress = Math.min(100, Math.round((todaySent / Math.max(dailyMax, 1)) * 100));

  return (
    <div className="box">
      <div className="box-header">
        <div className="box-title">일일 발송 쿼터</div>
        <span className="text-small text-muted">남은 수량 {remaining.toLocaleString()}건</span>
      </div>
      <div className="box-body">
        <div style={{ marginBottom: 14 }}>
          <div className="flex items-center gap-8" style={{ marginBottom: 6 }}>
            <AppIcon name="send" className="icon icon-14" style={{ color: "var(--accent-fg)" }} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>오늘 전체 발송</span>
            <span className="ml-auto text-small text-muted text-mono">
              {todaySent.toLocaleString()} / {dailyMax.toLocaleString()} 건
            </span>
          </div>
          <div className="progress"><div className="progress-bar" style={{ width: `${progress}%` }} /></div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <div className="flex items-center gap-8" style={{ marginBottom: 6 }}>
            <AppIcon name="check-circle" className="icon icon-14" style={{ color: "var(--success-fg)" }} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>남은 발송 여유</span>
            <span className="ml-auto text-small text-muted text-mono">{remaining.toLocaleString()} 건</span>
          </div>
          <div className="progress"><div className="progress-bar green" style={{ width: `${Math.max(0, 100 - progress)}%` }} /></div>
        </div>
        <div>
          <div className="flex items-center gap-8" style={{ marginBottom: 6 }}>
            <AppIcon name="zap" className="icon icon-14" style={{ color: "var(--success-fg)" }} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>자동 충전</span>
            <span className="ml-auto text-small text-muted text-mono">
              {dashboard?.balance.autoRechargeEnabled ? "활성" : "비활성"}
            </span>
          </div>
          <div className="text-small text-muted">
            {dashboard?.balance.lowBalanceAlertEnabled ? "잔액 알림 사용 중" : "잔액 알림 미설정"}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardPage({
  resources,
  dashboard,
  loading,
  error,
  onOpenSmsReg,
  onOpenKakaoReg,
  onGoTemplates,
  onGoSmsSend,
  onGoEvents,
}: {
  resources: ResourceState;
  dashboard: V2DashboardResponse | null;
  loading?: boolean;
  error?: string | null;
  onOpenSmsReg: () => void;
  onOpenKakaoReg: () => void;
  onGoTemplates: () => void;
  onGoSmsSend: () => void;
  onGoEvents: () => void;
}) {
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
            <div className="stat-value-t" style={{ color: "var(--accent-emphasis)" }}>
              {dashboard?.stats.activeEventRuleCount ?? 0}
            </div>
            <div className="stat-sub-t">활성 중</div>
          </div>
        </div>
      </div>

      <div className="dash-row dash-row-70-30">
        <ChecklistSection
          resources={resources}
          onOpenSmsReg={onOpenSmsReg}
          onOpenKakaoReg={onOpenKakaoReg}
          onGoTemplates={onGoTemplates}
          onGoSmsSend={onGoSmsSend}
        />
        <ChannelStatusColumn resources={resources} notices={dashboard?.notices ?? []} />
      </div>

      <QuickActions resources={resources} onGoSmsSend={onGoSmsSend} onGoEvents={onGoEvents} />
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
