"use client";

import { AppIcon } from "@/components/icons/AppIcon";
import { SkeletonStatGrid, SkeletonTableBox } from "@/components/loading/PageSkeleton";
import type { V2EventsResponse } from "@/lib/api/v2";

type EventsPageProps = {
  canManageEvents: boolean;
  data: V2EventsResponse | null;
  loading?: boolean;
  error?: string | null;
};

export function EventsPage({ canManageEvents, data, loading, error }: EventsPageProps) {
  if (!canManageEvents) {
    return (
      <>
        <div className="page-header">
          <div className="page-header-row">
            <div>
              <div className="page-title">이벤트 규칙</div>
              <div className="page-desc">협업 운영자 전용 자동화 설정 화면입니다</div>
            </div>
          </div>
        </div>

        <div className="box">
          <div className="empty-state">
            <div className="empty-icon">
              <AppIcon name="zap" className="icon icon-40" />
            </div>
            <div className="empty-title">접근 권한이 없습니다</div>
            <div className="empty-desc">이벤트 규칙은 협업 운영자 계정에서만 설정할 수 있습니다.</div>
          </div>
        </div>
      </>
    );
  }

  const items = data?.items ?? [];
  const showLoadingNotice = Boolean(loading && !data);

  if (showLoadingNotice) {
    return (
      <>
        <div className="page-header">
          <div className="page-header-row">
            <div>
              <div className="page-title">이벤트 규칙</div>
              <div className="page-desc">외부 이벤트에 따라 자동으로 메시지를 발송하는 규칙을 관리합니다</div>
            </div>
            <button className="btn btn-accent" disabled>
              <AppIcon name="plus" className="icon icon-14" />
              규칙 만들기
            </button>
          </div>
        </div>

        <div className="dash-row dash-row-3" style={{ marginBottom: 16 }}>
          <SkeletonStatGrid columns={3} />
        </div>
        <SkeletonTableBox titleWidth={110} rows={4} columns={["1.5fr", "1.2fr", "1fr", "1.8fr", "90px", "90px"]} />
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <div className="page-title">이벤트 규칙</div>
            <div className="page-desc">외부 이벤트에 따라 자동으로 메시지를 발송하는 규칙을 관리합니다</div>
          </div>
          <button className="btn btn-accent">
            <AppIcon name="plus" className="icon icon-14" />
            규칙 만들기
          </button>
        </div>
      </div>

      {error ? (
        <div className="flash flash-attention">
          <AppIcon name="warn" className="icon icon-16 flash-icon" />
          <div className="flash-body">{error}</div>
        </div>
      ) : null}

      <div className="dash-row dash-row-3" style={{ marginBottom: 16 }}>
        <div className="box" style={{ marginBottom: 0 }}>
          <div className="box-body" style={{ padding: "14px 16px" }}>
            <div className="flex items-center gap-8" style={{ marginBottom: 4 }}>
              <AppIcon name="zap" className="icon icon-16" style={{ color: "var(--accent-fg)" }} />
              <span className="text-small text-muted">Enabled Rules</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{data?.counts.enabledCount ?? 0}개 규칙 활성</div>
            <div className="text-small text-muted mt-8">전체 {data?.counts.totalCount ?? 0}개 규칙</div>
          </div>
        </div>
        <div className="box" style={{ marginBottom: 0 }}>
          <div className="box-body" style={{ padding: "14px 16px" }}>
            <div className="flex items-center gap-8" style={{ marginBottom: 4 }}>
              <AppIcon name="sms" className="icon icon-16" style={{ color: "var(--success-fg)" }} />
              <span className="text-small text-muted">SMS Readiness</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{smsReadinessText(data?.readiness.resourceState.sms)}</div>
            <div className="text-small text-muted mt-8">발신번호 {data?.readiness.sms.approvedCount ?? 0}개 사용 가능</div>
          </div>
        </div>
        <div className="box" style={{ marginBottom: 0 }}>
          <div className="box-body" style={{ padding: "14px 16px" }}>
            <div className="flex items-center gap-8" style={{ marginBottom: 4 }}>
              <AppIcon name="kakao" className="icon icon-16" style={{ color: "var(--done-fg)" }} />
              <span className="text-small text-muted">Kakao Readiness</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{kakaoReadinessText(data?.readiness.resourceState.kakao)}</div>
            <div className="text-small text-muted mt-8">채널 {data?.readiness.kakao.activeCount ?? 0}개 연결됨</div>
          </div>
        </div>
      </div>

      <div className="box">
        <div className="box-header">
          <div className="box-title">활성 이벤트 규칙</div>
        </div>
        {items.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>이벤트 키</th>
                  <th>전략</th>
                  <th>채널</th>
                  <th>연결 템플릿</th>
                  <th>상태</th>
                  <th>업데이트</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="table-title-text">{item.displayName}</div>
                      <code className="td-mono td-muted">{item.eventKey}</code>
                    </td>
                    <td className="td-muted">
                      <span className="flex items-center gap-8">
                        <AppIcon
                          name={item.channelStrategy === "ALIMTALK_THEN_SMS" ? "merge" : "send"}
                          className="icon icon-12"
                          style={{ color: "var(--fg-muted)" }}
                        />
                        {channelStrategyText(item.channelStrategy)}
                      </span>
                    </td>
                    <td>{renderChannelOrder(item)}</td>
                    <td className="td-muted">{connectedTemplateText(item)}</td>
                    <td>
                      <span className={`label ${item.enabled ? "label-green" : "label-gray"}`}>
                        <span className="label-dot" />
                        {item.enabled ? "활성" : "비활성"}
                      </span>
                    </td>
                    <td className="td-muted text-small">{formatShortDateTime(item.updatedAt)}</td>
                    <td>
                      <button className="btn btn-default btn-sm">편집</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">
              <AppIcon name="zap" className="icon icon-40" />
            </div>
            <div className="empty-title">등록된 이벤트 규칙이 없습니다</div>
            <div className="empty-desc">규칙을 만들면 외부 이벤트를 받아 SMS 또는 알림톡을 자동 발송할 수 있습니다.</div>
          </div>
        )}
      </div>
    </>
  );
}

function smsReadinessText(status?: "none" | "pending" | "supplement" | "rejected" | "active") {
  if (status === "active") return "발송 가능";
  if (status === "pending") return "심사 중";
  if (status === "supplement") return "서류 보완 필요";
  if (status === "rejected") return "재신청 필요";
  return "등록 필요";
}

function kakaoReadinessText(status?: "none" | "active") {
  if (status === "active") return "발송 가능";
  return "연결 필요";
}

function channelStrategyText(strategy: string) {
  if (strategy === "ALIMTALK_THEN_SMS") return "Fallback";
  if (strategy === "ALIMTALK_ONLY") return "알림톡만";
  return "SMS만";
}

function connectedTemplateText(item: V2EventsResponse["items"][number]) {
  const tokens = [];

  if (item.kakao) {
    tokens.push(`알림톡: ${item.kakao.templateName}`);
  }

  if (item.sms) {
    tokens.push(`SMS: ${item.sms.templateName}`);
  }

  return tokens.length > 0 ? tokens.join(" / ") : "미연결";
}

function renderChannelOrder(item: V2EventsResponse["items"][number]) {
  if (item.kakao && item.sms && item.channelStrategy === "ALIMTALK_THEN_SMS") {
    return (
      <span className="flex items-center gap-8">
        <span className="chip chip-kakao">알림톡</span>
        <AppIcon name="chevron-right" className="icon icon-12" style={{ color: "var(--fg-subtle)" }} />
        <span className="chip chip-sms">SMS</span>
      </span>
    );
  }

  if (item.kakao) {
    return <span className="chip chip-kakao">알림톡</span>;
  }

  if (item.sms) {
    return <span className="chip chip-sms">SMS</span>;
  }

  return <span className="td-muted">—</span>;
}

function formatShortDateTime(value: string) {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}
