"use client";

import { AppIcon } from "@/components/icons/AppIcon";
import { SkeletonStatGrid, SkeletonTableBox } from "@/components/loading/PageSkeleton";
import type { V2LogsResponse } from "@/lib/api/v2";

type LogsPageProps = {
  data: V2LogsResponse | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
};

export function LogsPage({ data, loading, error, onRefresh }: LogsPageProps) {
  const items = data?.items ?? [];
  const statusCounts = data?.summary.statusCounts ?? {};
  const deliveredCount = countStatuses(statusCounts, ["DELIVERED", "SENT_TO_PROVIDER"]);
  const failedCount = countStatuses(statusCounts, ["DELIVERY_FAILED", "SEND_FAILED", "DEAD"]);
  const processingCount = countStatuses(statusCounts, ["ACCEPTED", "PROCESSING"]);
  const showLoadingNotice = Boolean(loading && !data);

  if (showLoadingNotice) {
    return (
      <>
        <div className="page-header">
          <div className="page-header-row">
            <div>
              <div className="page-title">발송 로그</div>
              <div className="page-desc">메시지 요청 이력과 배송 결과를 조회합니다</div>
            </div>
            <button className="btn btn-default" disabled>
              <AppIcon name="refresh" className="icon icon-14" />
              상태 새로고침
            </button>
          </div>
        </div>

        <SkeletonStatGrid columns={4} />
        <SkeletonTableBox titleWidth={96} rows={5} columns={["110px", "1.2fr", "90px", "120px", "110px", "1fr", "120px"]} />
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <div className="page-title">발송 로그</div>
            <div className="page-desc">메시지 요청 이력과 배송 결과를 조회합니다</div>
          </div>
          <button className="btn btn-default" onClick={onRefresh}>
            <AppIcon name="refresh" className="icon icon-14" />
            상태 새로고침
          </button>
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
            <div className="stat-label-t">전체 요청</div>
            <div className="stat-value-t">{data?.summary.totalCount ?? 0}</div>
            <div className="stat-sub-t">최근 조회 범위</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label-t">처리 중</div>
            <div className="stat-value-t" style={{ color: "var(--accent-emphasis)" }}>{processingCount}</div>
            <div className="stat-sub-t">접수/전송 중</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label-t">전달 완료</div>
            <div className="stat-value-t" style={{ color: "var(--success-fg)" }}>{deliveredCount}</div>
            <div className="stat-sub-t">DELIVERED / SENT_TO_PROVIDER</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label-t">실패</div>
            <div className="stat-value-t" style={{ color: "var(--danger-fg)" }}>{failedCount}</div>
            <div className="stat-sub-t">실패/Dead 포함</div>
          </div>
        </div>
      </div>

      <div className="box">
        {items.length > 0 ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>요청 ID</th>
                  <th>이벤트</th>
                  <th>채널</th>
                  <th>수신번호</th>
                  <th>상태</th>
                  <th>최근 결과</th>
                  <th>요청 시각</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="td-mono">{shortId(item.id)}</td>
                    <td>
                      <div className="table-title-text">{item.eventKey || "manual.send"}</div>
                      {item.lastErrorCode ? <div className="table-subtext">오류 코드: {item.lastErrorCode}</div> : null}
                    </td>
                    <td>{renderLogChannel(item.channel)}</td>
                    <td className="td-mono">{item.recipientPhone}</td>
                    <td>
                      <span className={`label ${requestStatusClass(item.status)}`}>
                        <span className="label-dot" />
                        {requestStatusText(item.status)}
                      </span>
                    </td>
                    <td className="td-muted">
                      {item.latestDeliveryResult?.providerStatusMessage ||
                        item.latestDeliveryResult?.deliveryStatus ||
                        item.lastErrorMessage ||
                        "—"}
                    </td>
                    <td className="td-muted text-small">{formatShortDateTime(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">
              <AppIcon name="inbox" className="icon icon-40" />
            </div>
            <div className="empty-title">발송 기록이 없습니다</div>
            <div className="empty-desc">발신 자원을 등록하고 메시지를 발송하면 여기에 로그가 기록됩니다.</div>
          </div>
        )}
      </div>
    </>
  );
}

function countStatuses(statusCounts: Record<string, number>, keys: string[]) {
  return keys.reduce((sum, key) => sum + (statusCounts[key] ?? 0), 0);
}

function shortId(value: string) {
  return value.length > 10 ? `${value.slice(0, 8)}…` : value;
}

function renderLogChannel(channel: "sms" | "kakao" | null) {
  if (channel === "sms") {
    return <span className="chip chip-sms">SMS</span>;
  }

  if (channel === "kakao") {
    return <span className="chip chip-kakao">알림톡</span>;
  }

  return <span className="td-muted">—</span>;
}

function requestStatusText(status: string) {
  if (status === "ACCEPTED") return "접수됨";
  if (status === "PROCESSING") return "처리 중";
  if (status === "SENT_TO_PROVIDER" || status === "DELIVERED") return "전달 완료";
  if (status === "DELIVERY_FAILED") return "전달 실패";
  if (status === "SEND_FAILED") return "발송 실패";
  if (status === "CANCELED") return "취소됨";
  if (status === "DEAD") return "중단됨";
  return status;
}

function requestStatusClass(status: string) {
  if (status === "SENT_TO_PROVIDER" || status === "DELIVERED") return "label-green";
  if (status === "ACCEPTED" || status === "PROCESSING") return "label-blue";
  if (status === "DELIVERY_FAILED" || status === "SEND_FAILED" || status === "DEAD") return "label-red";
  if (status === "CANCELED") return "label-gray";
  return "label-gray";
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
