"use client";

import { useMemo, useState } from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import { SkeletonStatGrid, SkeletonTableBox } from "@/components/loading/PageSkeleton";
import { MarkdownContent } from "@/components/ui/MarkdownContent";
import type { V2DashboardResponse } from "@/lib/api/v2";
import {
  buildResourcesKakaoConnectPath,
  buildResourcesTabPath,
  SENDER_NUMBER_APPLICATION_PATH,
} from "@/lib/routes";
import type { ResourceState } from "@/lib/store/types";
import { canKakao, canSMS } from "@/lib/store/selectors";
import { SmsChecklistLottie } from "@/components/dashboard/SmsChecklistLottie";

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
  const smsManageUrl = buildResourcesTabPath("tab-sms");
  const kakaoManageUrl = buildResourcesKakaoConnectPath();
  const smsOperating = resources.sms === "active";
  const kakaoOperating = resources.kakao === "active";
  const operating = Number(smsOperating) + Number(kakaoOperating);
  const smsRejected = resources.sms === "rejected";
  const smsSupplementRequested = resources.sms === "supplement";
  const smsLottieVariant =
    smsRejected ? "rejected" : smsSupplementRequested || resources.sms === "pending" ? "review" : resources.sms === "none" ? "idea" : "done";
  const kakaoCanSend = kakaoOperating && approvedKakaoTemplateCount > 0;

  return (
    <div className="box box-no-margin">
      <div className="box-header">
        <div>
          <div className="box-title">시작하기</div>
          <div className="box-subtitle">채널별 준비 상태를 확인하고 필요한 작업을 이어가세요</div>
        </div>
        <ChecklistBadge operating={operating} />
      </div>

      <div className="checklist-item checklist-item-with-aside">
        <div
          className={`ci-check ${
            smsOperating
              ? "done"
              : resources.sms === "none"
                ? "pending"
                : resources.sms === "pending"
                  ? "in-review"
                  : resources.sms === "supplement"
                    ? "rejected"
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
          ) : resources.sms === "supplement" ? (
            <AppIcon name="warn" className="icon icon-12" />
          ) : resources.sms === "rejected" ? (
            <AppIcon name="warn" className="icon icon-12" />
          ) : (
            <AppIcon name="check" className="icon icon-12" />
          )}
        </div>
        <div className="ci-main">
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
              ) : !smsOperating && resources.sms === "supplement" ? (
                <span className="label label-yellow">
                  <span className="label-dot" />
                  보완 요청
                </span>
              ) : !smsOperating && resources.sms === "rejected" ? (
                <span className="label label-red">
                  <span className="label-dot" />
                  거절됨
                </span>
              ) : null}
            </div>
            <div className="ci-desc">
              {smsOperating
                ? smsSentCount > 0
                  ? `누적 ${smsSentCount.toLocaleString()}건 발송했습니다.`
                  : "발신번호 등록이 완료되었습니다."
                : resources.sms === "none"
                  ? "문자 발송에 사용할 번호를 신청합니다. 서류 검토가 완료되면 SMS 발송을 시작할 수 있습니다."
                  : resources.sms === "pending"
                    ? "신청서가 접수되었습니다. 검토가 끝나면 SMS 발송 준비가 완료됩니다."
                    : resources.sms === "supplement"
                      ? "서류 보완 요청이 있습니다. 기존 신청서를 수정하고 필요한 서류를 다시 제출해 주세요."
                  : resources.sms === "rejected"
                      ? "발신번호 신청이 거절되었습니다. 거절 사유를 확인하고 신청서를 수정해 다시 제출해 주세요."
                      : "발신번호 등록이 완료되었습니다."}
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
              ) : resources.sms === "supplement" ? (
                <a className="btn btn-default btn-sm" href={smsManageUrl}>
                  신청서 수정
                </a>
              ) : resources.sms === "rejected" ? (
                <a className="btn btn-default btn-sm" href={smsManageUrl}>
                  신청서 수정
                </a>
              ) : (
                <button className="btn btn-default btn-sm" onClick={onGoSmsSend}>
                  SMS 발송하기
                </button>
              )}
            </div>
            {!smsOperating && resources.sms !== "none" && !smsRejected ? (
              <div style={{ marginTop: 10 }}>
                <MiniSteps state={resources.sms === "pending" ? "pending" : "done"} />
              </div>
            ) : null}
          </div>
          <div className="ci-aside">
            <SmsChecklistLottie variant={smsLottieVariant} />
          </div>
        </div>
      </div>

      <div className="checklist-item">
        <div className={`ci-check ${kakaoOperating ? "done" : "pending"}`}>
          {kakaoOperating ? (
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
            ) : null}
          </div>
          <div className="ci-desc">
            {kakaoOperating
              ? kakaoSentCount > 0
                ? `누적 ${kakaoSentCount.toLocaleString()}건 발송했습니다.`
                : approvedKakaoTemplateCount > 0
                  ? "채널 연결이 완료되었습니다."
                  : "채널 연결이 완료되었습니다. 템플릿을 준비하면 바로 발송할 수 있습니다."
              : resources.kakao === "none"
              ? "알림톡 발송을 위해 카카오 채널을 연결합니다. 연결 후 템플릿을 준비하면 바로 시작할 수 있습니다."
              : approvedKakaoTemplateCount > 0
                ? "채널 연결이 완료되었습니다."
                : "채널 연결은 완료되었습니다. 다음으로 알림톡 템플릿을 준비해 주세요."}
          </div>
          <div className="ci-action">
            {kakaoOperating && kakaoCanSend ? (
              <button className="btn btn-default btn-sm" onClick={onGoKakaoSend}>
                알림톡 발송하기
              </button>
            ) : resources.kakao === "none" ? (
              <a className="btn btn-default btn-sm" href={kakaoManageUrl}>
                채널 연결하기
              </a>
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
              알림톡 자동화
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
  onOpenNoticeList,
}: {
  notices: V2DashboardResponse["notices"];
  onOpenNoticeList: (noticeId?: string) => void;
}) {
  return (
    <div>
      <div className="box">
        <div className="box-header">
          <div className="box-title">공지사항</div>
          <button className="btn btn-default btn-sm" disabled={notices.length === 0} onClick={() => onOpenNoticeList()}>
            전체 보기
          </button>
        </div>
        <div style={{ padding: "8px 16px" }}>
          {notices.length > 0 ? notices.slice(0, 2).map((notice) => (
            <button className="notice-row notice-row-button" key={notice.id} onClick={() => onOpenNoticeList(notice.id)}>
              <span className={`notice-type ${notice.isPinned ? "nt-warn" : "nt-upd"}`}>{notice.isPinned ? "NOTICE" : "UPDATE"}</span>
              <div>
                <div className="notice-text">{notice.title}</div>
                <div className="notice-date">{formatDashboardDate(notice.createdAt)}</div>
                <div className="notice-preview">{summarizeNoticeBody(notice.body)}</div>
              </div>
            </button>
          )) : (
            <div className="text-small text-muted" style={{ padding: "8px 0" }}>표시할 공지사항이 없습니다.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuotaPanel({ dashboard }: { dashboard: V2DashboardResponse | null }) {
  const kakaoActiveCount = dashboard?.readiness.kakao.activeCount ?? 0;
  const smsMonthlyLimit = dashboard?.stats.smsMonthlyLimit ?? 0;
  const kakaoDailyLimit = kakaoActiveCount * 1000;
  const brandDailyLimit = kakaoActiveCount * 1000;
  const smsMonthSent = dashboard?.stats.smsMonthSentCount ?? 0;
  const kakaoDaySent = dashboard?.stats.kakaoDaySentCount ?? 0;
  const brandDaySent = dashboard?.stats.brandDaySentCount ?? 0;
  const smsProgress =
    smsMonthlyLimit > 0 ? Math.min(100, Math.round((smsMonthSent / smsMonthlyLimit) * 100)) : 0;
  const kakaoProgress =
    kakaoDailyLimit > 0 ? Math.min(100, Math.round((kakaoDaySent / kakaoDailyLimit) * 100)) : 0;
  const brandProgress =
    brandDailyLimit > 0 ? Math.min(100, Math.round((brandDaySent / brandDailyLimit) * 100)) : 0;
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

        <div className="quota-item">
          <div className="quota-item-top">
            <div className="quota-item-title">
              <AppIcon name="brand" className="icon icon-16 text-muted" />
              <span>브랜드 메시지 발송</span>
              <span className="label label-gray quota-period-chip">일간</span>
            </div>
            <span className="quota-item-value text-mono">
              {brandDailyLimit > 0 ? `${brandDaySent.toLocaleString()} / ${brandDailyLimit.toLocaleString()} 건` : "0 / 0 건"}
            </span>
          </div>
          <div className="progress quota-progress"><div className="progress-bar kakao-bar" style={{ width: `${brandProgress}%` }} /></div>
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
  sessionRole: "USER" | "PARTNER_ADMIN" | "SUPER_ADMIN";
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
  const notices = dashboard?.notices ?? [];
  const [noticeModalOpen, setNoticeModalOpen] = useState(false);
  const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);
  const selectedNotice = useMemo(
    () => notices.find((notice) => notice.id === selectedNoticeId) ?? notices[0] ?? null,
    [notices, selectedNoticeId]
  );

  const openNoticeList = (noticeId?: string) => {
    setSelectedNoticeId(noticeId ?? notices[0]?.id ?? null);
    setNoticeModalOpen(true);
  };

  if (showLoadingNotice) {
    return (
      <>
        <div className="page-header">
          <div className="page-header-row">
            <div>
              <div className="page-title">대시보드</div>
              <div className="page-desc">서비스 운영 현황</div>
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
            <div className="page-desc">{dashboard?.currentUser.serviceName ?? "서비스"} 운영 현황</div>
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
            <div className="stat-label-t">알림톡 자동화</div>
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
            <ChannelStatusColumn notices={notices} onOpenNoticeList={openNoticeList} />
          </div>

      <QuotaPanel dashboard={dashboard} />
      <DashboardNoticeModal
        notices={notices}
        open={noticeModalOpen}
        selectedNoticeId={selectedNotice?.id ?? null}
        onSelectNotice={setSelectedNoticeId}
        onClose={() => setNoticeModalOpen(false)}
      />
    </>
  );
}

function DashboardNoticeModal({
  notices,
  open,
  selectedNoticeId,
  onSelectNotice,
  onClose,
}: {
  notices: V2DashboardResponse["notices"];
  open: boolean;
  selectedNoticeId: string | null;
  onSelectNotice: (noticeId: string) => void;
  onClose: () => void;
}) {
  const selectedNotice = notices.find((notice) => notice.id === selectedNoticeId) ?? notices[0] ?? null;

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div className="modal modal-xl dashboard-notice-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <AppIcon name="bell" className="icon icon-18" />
            공지사항
          </div>
          <button className="modal-close" onClick={onClose} aria-label="공지사항 닫기">
            <AppIcon name="x" className="icon icon-18" />
          </button>
        </div>
        <div className="modal-body">
          <div className="dashboard-notice-layout">
            <aside className="dashboard-notice-list">
              {notices.length > 0 ? (
                notices.map((notice) => (
                  <button
                    key={notice.id}
                    className={`dashboard-notice-list-item${selectedNotice?.id === notice.id ? " active" : ""}`}
                    onClick={() => onSelectNotice(notice.id)}
                  >
                    <div className="dashboard-notice-list-top">
                      <span className={`notice-type ${notice.isPinned ? "nt-warn" : "nt-upd"}`}>{notice.isPinned ? "NOTICE" : "UPDATE"}</span>
                      <span className="notice-date">{formatDashboardDate(notice.createdAt)}</span>
                    </div>
                    <div className="dashboard-notice-list-title">{notice.title}</div>
                    <div className="dashboard-notice-list-preview">{summarizeNoticeBody(notice.body)}</div>
                  </button>
                ))
              ) : (
                <div className="empty-state" style={{ minHeight: 220 }}>
                  <div className="empty-icon">
                    <AppIcon name="bell" className="icon icon-40" />
                  </div>
                  <div className="empty-title">표시할 공지사항이 없습니다</div>
                </div>
              )}
            </aside>
            <section className="dashboard-notice-detail">
              {selectedNotice ? (
                <>
                  <div className="dashboard-notice-detail-head">
                    <div>
                      <div className="dashboard-notice-detail-title">{selectedNotice.title}</div>
                      <div className="dashboard-notice-detail-meta">
                        {selectedNotice.isPinned ? "상단 고정" : "일반 공지"} · {formatDashboardDate(selectedNotice.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="dashboard-notice-detail-body">
                    <MarkdownContent value={selectedNotice.body} />
                  </div>
                </>
              ) : (
                <div className="empty-state" style={{ minHeight: 260 }}>
                  <div className="empty-title">공지사항을 선택해 주세요</div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
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

function summarizeNoticeBody(value: string) {
  return value
    .replace(/[#>*`_\-\[\]\(\)!]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
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
