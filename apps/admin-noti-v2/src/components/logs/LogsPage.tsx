"use client";

import { Flash, Heading, Label, Spinner, ThemeProvider, VisuallyHidden } from "@primer/react";
import { DataTable, Dialog, Table, type Column } from "@primer/react/experimental";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { AppIcon } from "@/components/icons/AppIcon";
import { SkeletonStatGrid, SkeletonTableBox } from "@/components/loading/PageSkeleton";
import { fetchV2LogDetail, fetchV2Logs, type V2LogDetailResponse, type V2LogsResponse } from "@/lib/api/v2";
import { buildCampaignDetailPath } from "@/lib/routes";
import { useAppStore } from "@/lib/store/app-store";

type LogsPageProps = {
  data: V2LogsResponse | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
};

type LogItem = V2LogsResponse["items"][number];
type LogStatusFilter = "all" | "waiting" | "in_progress" | "delivered" | "failed";
type LogChannelFilter = "all" | "sms" | "alimtalk" | "brand";
type LogLimitFilter = 50 | 100 | 200;

const DEFAULT_LOG_LIMIT: LogLimitFilter = 100;

export function LogsPage({ data, loading, error, onRefresh }: LogsPageProps) {
  const router = useRouter();
  const showDraftToast = useAppStore((state) => state.showDraftToast);
  const detailReturnFocusRef = useRef<HTMLElement | null>(null);
  const [statusFilter, setStatusFilter] = useState<LogStatusFilter>("all");
  const [channelFilter, setChannelFilter] = useState<LogChannelFilter>("all");
  const [limitFilter, setLimitFilter] = useState<LogLimitFilter>(DEFAULT_LOG_LIMIT);
  const [filteredData, setFilteredData] = useState<V2LogsResponse | null>(null);
  const [filterLoading, setFilterLoading] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<V2LogDetailResponse | null>(null);
  const hasActiveFilters = statusFilter !== "all" || channelFilter !== "all" || limitFilter !== DEFAULT_LOG_LIMIT;
  const activeData = filteredData ?? data;
  const items = activeData?.items ?? [];
  const statusCounts = activeData?.summary.statusCounts ?? {};
  const deliveredCount = countStatuses(statusCounts, ["DELIVERED"]);
  const failedCount = countStatuses(statusCounts, ["DELIVERY_FAILED", "SEND_FAILED", "DEAD", "LOOKUP_FAILED", "FAILED", "PARTIAL_FAILED"]);
  const waitingCount = countStatuses(statusCounts, ["WAITING", "ACCEPTED"]);
  const inProgressCount = countStatuses(statusCounts, ["IN_PROGRESS", "PROCESSING", "SENT_TO_PROVIDER"]);
  const displayError = filterError || error;
  const showLoadingNotice = Boolean((loading || filterLoading) && !activeData);

  const loadFilteredLogs = useCallback(async () => {
    setFilterLoading(true);
    setFilterError(null);

    try {
      const next = await fetchV2Logs(buildLogFilters(statusFilter, channelFilter, limitFilter));
      setFilteredData(next);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "발송 기록을 불러오지 못했습니다.";
      setFilterError(message);
      showDraftToast(message);
    } finally {
      setFilterLoading(false);
    }
  }, [channelFilter, limitFilter, showDraftToast, statusFilter]);

  useEffect(() => {
    if (!hasActiveFilters) {
      setFilteredData(null);
      setFilterError(null);
      setFilterLoading(false);
      return;
    }

    void loadFilteredLogs();
  }, [hasActiveFilters, loadFilteredLogs]);

  const openCampaignDetail = useCallback((item: LogItem) => {
    if (item.kind !== "campaign" || !item.campaignChannel) {
      return;
    }

    router.push(buildCampaignDetailPath(item.campaignChannel, item.id, { from: "logs" }));
  }, [router]);

  const openDetail = useCallback(async (requestId: string) => {
    setSelectedRequestId(requestId);
    setDrawerOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);

    try {
      const next = await fetchV2LogDetail(requestId);
      setDetail(next);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "발송 로그 상세를 불러오지 못했습니다.";
      setDetailError(message);
      showDraftToast(message);
    } finally {
      setDetailLoading(false);
    }
  }, [showDraftToast]);

  const logColumns = useMemo<Array<Column<LogItem>>>(() => [
    {
      header: "발송",
      field: "title",
      rowHeader: true,
      width: "minmax(220px, 1fr)",
      renderCell: (item) => {
        const title = logTitle(item);
        return (
          <span className="logs-title-cell" title={title}>
            {title}
          </span>
        );
      },
    },
    {
      header: "채널",
      field: "providerChannel",
      width: "128px",
      renderCell: renderLogChannel,
    },
    {
      header: "방식",
      field: "mode",
      width: "112px",
      renderCell: (item) => renderLogMode(item.mode),
    },
    {
      header: "대상",
      field: "recipientPhone",
      width: "132px",
      renderCell: renderLogRecipient,
    },
    {
      header: "상태",
      field: "status",
      width: "112px",
      renderCell: renderLogStatus,
    },
    {
      id: "actions",
      header: () => <VisuallyHidden>작업</VisuallyHidden>,
      align: "end",
      width: "auto",
      renderCell: (item) => (
        <button
          className="btn btn-default btn-sm"
          aria-label={`${logTitle(item)} ${item.kind === "campaign" ? "상세" : "보기"}`}
          onClick={(event) => {
            if (item.kind === "campaign") {
              openCampaignDetail(item);
              return;
            }
            detailReturnFocusRef.current = event.currentTarget;
            void openDetail(item.id);
          }}
        >
          {item.kind === "campaign" ? "상세" : "보기"}
        </button>
      ),
    },
  ], [openCampaignDetail, openDetail]);

  const closeDetail = () => {
    setDrawerOpen(false);
    setSelectedRequestId(null);
    setDetailLoading(false);
    setDetailError(null);
    setDetail(null);
  };

  const refreshLogs = () => {
    if (hasActiveFilters) {
      void loadFilteredLogs();
      return;
    }

    onRefresh?.();
  };

  const clearFilters = () => {
    setStatusFilter("all");
    setChannelFilter("all");
    setLimitFilter(DEFAULT_LOG_LIMIT);
    setFilteredData(null);
    setFilterError(null);
  };

  if (showLoadingNotice) {
    return (
      <>
        <div className="page-header">
          <div className="page-header-row">
            <div>
              <div className="page-title" id="logs-page-title">발송 기록</div>
              <div className="page-desc">보낸 메시지와 처리 결과를 확인합니다</div>
            </div>
            <button className="btn btn-default" disabled>
              <AppIcon name="refresh" className="icon icon-14" />
              상태 새로고침
            </button>
          </div>
        </div>

        <SkeletonStatGrid columns={5} />
        <SkeletonTableBox titleWidth={96} rows={5} columns={["110px", "1.2fr", "90px", "120px", "110px", "1fr", "120px"]} />
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <div className="page-title" id="logs-page-title">발송 기록</div>
            <div className="page-desc">보낸 메시지와 처리 결과를 확인합니다</div>
          </div>
          <button className="btn btn-default" onClick={refreshLogs} disabled={filterLoading}>
            <AppIcon name="refresh" className="icon icon-14" />
            상태 새로고침
          </button>
        </div>
      </div>

      {displayError ? (
        <div className="flash flash-attention">
          <AppIcon name="warn" className="icon icon-16 flash-icon" />
          <div className="flash-body">{displayError}</div>
        </div>
      ) : null}

      <div className="box mb-16">
        <div className="stats-grid logs-stats-grid">
          <div className="stat-cell">
            <div className="stat-label-t">조회 기록</div>
            <div className="stat-value-t">{activeData?.summary.totalCount ?? 0}</div>
            <div className="stat-sub-t">{limitFilter}건 기준</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label-t">예약</div>
            <div className="stat-value-t" style={{ color: "var(--attention-fg)" }}>{waitingCount}</div>
            <div className="stat-sub-t">예약 발송</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label-t">처리 중</div>
            <div className="stat-value-t" style={{ color: "var(--accent-emphasis)" }}>{inProgressCount}</div>
            <div className="stat-sub-t">전송/확인 중</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label-t">성공</div>
            <div className="stat-value-t" style={{ color: "var(--success-fg)" }}>{deliveredCount}</div>
            <div className="stat-sub-t">최종 성공</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label-t">실패</div>
            <div className="stat-value-t" style={{ color: "var(--danger-fg)" }}>{failedCount}</div>
            <div className="stat-sub-t">최종 실패</div>
          </div>
        </div>
      </div>

      <div className="box logs-list-box" aria-busy={filterLoading}>
        <div className="box-header logs-table-header">
          <div>
            <div className="box-subtitle" id="logs-table-description">{logsTableSubtitle(activeData, items.length, filterLoading)}</div>
          </div>
          {filterLoading ? <span className="label label-blue">필터 적용 중</span> : null}
        </div>

        <div className="box-body toolbar-box-body logs-filter-body">
          <div className="logs-filter-row" aria-label="발송 기록 필터">
            <label className="logs-filter-control">
              <span className="logs-filter-label">상태</span>
              <span className="form-select logs-filter-select">
                <select
                  className="form-control"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as LogStatusFilter)}
                >
                  <option value="all">전체</option>
                  <option value="in_progress">처리 중</option>
                  <option value="delivered">성공</option>
                  <option value="failed">실패</option>
                  <option value="waiting">예약</option>
                </select>
              </span>
            </label>
            <label className="logs-filter-control">
              <span className="logs-filter-label">채널</span>
              <span className="form-select logs-filter-select">
                <select
                  className="form-control"
                  value={channelFilter}
                  onChange={(event) => setChannelFilter(event.target.value as LogChannelFilter)}
                >
                  <option value="all">전체</option>
                  <option value="sms">SMS</option>
                  <option value="alimtalk">알림톡</option>
                  <option value="brand">브랜드 메시지</option>
                </select>
              </span>
            </label>
            <label className="logs-filter-control logs-filter-control-compact">
              <span className="logs-filter-label">개수</span>
              <span className="form-select logs-filter-select logs-filter-limit">
                <select
                  className="form-control"
                  value={String(limitFilter)}
                  onChange={(event) => setLimitFilter(Number(event.target.value) as LogLimitFilter)}
                >
                  <option value="50">50건</option>
                  <option value="100">100건</option>
                  <option value="200">200건</option>
                </select>
              </span>
            </label>
            <button className="btn btn-default btn-sm" onClick={clearFilters} disabled={!hasActiveFilters || filterLoading}>
              필터 초기화
            </button>
          </div>
        </div>

        {items.length > 0 ? (
          <div className="logs-primer-table-scroll" tabIndex={0} aria-label="발송 기록 표 가로 스크롤">
            <ThemeProvider colorMode="light" dayScheme="light" preventSSRMismatch>
              <Table.Container className="logs-primer-table-container">
                <DataTable
                  aria-labelledby="logs-page-title"
                  aria-describedby="logs-table-description"
                  cellPadding="normal"
                  data={items}
                  columns={logColumns}
                />
              </Table.Container>
            </ThemeProvider>
          </div>
        ) : (
          <LogsEmptyState filtered={hasActiveFilters} onClearFilters={clearFilters} />
        )}
      </div>

      <LogDetailDrawer
        open={drawerOpen}
        requestId={selectedRequestId}
        detail={detail}
        loading={detailLoading}
        error={detailError}
        returnFocusRef={detailReturnFocusRef}
        onClose={closeDetail}
      />
    </>
  );
}

function buildLogFilters(statusFilter: LogStatusFilter, channelFilter: LogChannelFilter, limitFilter: LogLimitFilter) {
  return {
    statusGroup: statusFilter === "all" ? undefined : statusFilter,
    channel: logChannelParam(channelFilter),
    limit: limitFilter === DEFAULT_LOG_LIMIT ? undefined : limitFilter,
  };
}

function logChannelParam(channelFilter: LogChannelFilter) {
  if (channelFilter === "sms") return "sms" as const;
  if (channelFilter === "alimtalk") return "ALIMTALK" as const;
  if (channelFilter === "brand") return "BRAND_MESSAGE" as const;
  return undefined;
}

function logsTableSubtitle(data: V2LogsResponse | null, visibleCount: number, loading: boolean) {
  if (loading) {
    return "조건에 맞는 발송 기록을 불러오는 중입니다.";
  }

  if (!data) {
    return "최근 발송 기록을 불러오면 여기에 표시됩니다.";
  }

  return `표시 ${formatCount(visibleCount)}건 · 조회 ${formatCount(data.summary.totalCount)}건`;
}

function countStatuses(statusCounts: Record<string, number>, keys: string[]) {
  return keys.reduce((sum, key) => sum + (statusCounts[key] ?? 0), 0);
}

function shortId(value: string) {
  return value.length > 10 ? `${value.slice(0, 8)}…` : value;
}

function formatCount(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function logTitle(item: LogItem) {
  if (item.kind === "campaign") {
    return item.title || eventLabel(item.eventKey, item.providerChannel);
  }

  return eventLabel(item.eventKey, item.providerChannel);
}

function renderLogRecipient(item: LogItem) {
  if (item.kind === "campaign") {
    return <span className="td-mono">{formatCount(item.recipientCount ?? 0)}명</span>;
  }

  return <span className="td-mono">{item.recipientPhone || "수신자 없음"}</span>;
}

function renderLogStatus(item: LogItem) {
  return (
    <span className={`label ${requestStatusClass(item.status)}`}>
      <span className="label-dot" />
      {requestStatusText(item.status)}
    </span>
  );
}

function renderLogChannel(item: LogItem) {
  if (item.providerChannel === "BRAND_MESSAGE") {
    return <span className="chip chip-brand">브랜드 메시지</span>;
  }

  if (item.providerChannel === "SMS" || item.channel === "sms") {
    return <span className="chip chip-sms">SMS</span>;
  }

  if (item.providerChannel === "ALIMTALK" || item.channel === "kakao") {
    return <span className="chip chip-kakao">알림톡</span>;
  }

  return null;
}

function renderLogMode(mode: LogItem["mode"]) {
  if (mode === "AUTO") return <span className="chip chip-event">자동 발송</span>;
  if (mode === "BULK") return <span className="chip chip-event">대량 발송</span>;
  return <span className="chip chip-neutral">직접 발송</span>;
}

function LogsEmptyState({ filtered, onClearFilters }: { filtered: boolean; onClearFilters: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <AppIcon name="inbox" className="icon icon-40" />
      </div>
      <div className="empty-title">{filtered ? "조건에 맞는 발송 기록이 없습니다" : "발송 기록이 없습니다"}</div>
      <div className="empty-desc">
        {filtered
          ? "상태나 채널 조건을 바꾸면 다른 기록을 확인할 수 있습니다."
          : "발신 자원을 등록하고 메시지를 발송하면 여기에 로그가 기록됩니다."}
      </div>
      {filtered ? (
        <button className="btn btn-default btn-sm" onClick={onClearFilters}>
          필터 초기화
        </button>
      ) : null}
    </div>
  );
}

function requestStatusText(status: string) {
  if (status === "WAITING" || status === "ACCEPTED") return "예약됨";
  if (status === "IN_PROGRESS" || status === "PROCESSING" || status === "SENT_TO_PROVIDER") return "처리 중";
  if (status === "LOOKUP_FAILED") return "확인 필요";
  if (status === "DELIVERED") return "완료";
  if (status === "PARTIAL_FAILED") return "일부 실패";
  if (status === "FAILED") return "실패";
  if (status === "DELIVERY_FAILED" || status === "SEND_FAILED") return "실패";
  if (status === "CANCELED") return "취소됨";
  if (status === "DEAD") return "중단됨";
  return status;
}

function requestStatusClass(status: string) {
  if (status === "DELIVERED") return "label-green";
  if (status === "SENT_TO_PROVIDER") return "label-blue";
  if (status === "IN_PROGRESS" || status === "PROCESSING") return "label-blue";
  if (status === "WAITING" || status === "ACCEPTED") return "label-gray";
  if (status === "LOOKUP_FAILED") return "label-yellow";
  if (status === "DELIVERY_FAILED" || status === "SEND_FAILED" || status === "DEAD" || status === "FAILED" || status === "PARTIAL_FAILED") return "label-red";
  if (status === "CANCELED") return "label-gray";
  return "label-gray";
}

function requestStatusLabelVariant(status: string) {
  if (status === "DELIVERED") return "success";
  if (status === "SENT_TO_PROVIDER" || status === "IN_PROGRESS" || status === "PROCESSING") return "accent";
  if (status === "WAITING" || status === "ACCEPTED" || status === "CANCELED") return "secondary";
  if (status === "LOOKUP_FAILED") return "attention";
  if (status === "DELIVERY_FAILED" || status === "SEND_FAILED" || status === "DEAD" || status === "FAILED" || status === "PARTIAL_FAILED") return "danger";
  return "secondary";
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

function eventLabel(eventKey: string, providerChannel: "SMS" | "ALIMTALK" | "BRAND_MESSAGE" | null) {
  if (eventKey === "MANUAL_SMS_SEND") return "직접 SMS 발송";
  if (eventKey === "MANUAL_ALIMTALK_SEND") return "직접 알림톡 발송";
  if (eventKey === "MANUAL_BRAND_MESSAGE_SEND") return "직접 브랜드 메시지 발송";
  if (eventKey === "BULK_SMS_SEND") return "대량 SMS 발송";
  if (eventKey === "BULK_ALIMTALK_SEND") return "대량 알림톡 발송";
  if (eventKey === "BULK_BRAND_MESSAGE_SEND") return "대량 브랜드 메시지 발송";
  if (!eventKey && providerChannel === "BRAND_MESSAGE") return "브랜드 메시지 발송";
  return eventKey || "manual.send";
}

function messageTypeLabel(value: string | null) {
  if (!value) return "—";
  if (value === "SMS") return "SMS";
  if (value === "LMS") return "LMS";
  if (value === "MMS") return "MMS";
  if (value === "TEXT") return "텍스트";
  if (value === "IMAGE") return "이미지";
  if (value === "WIDE") return "와이드 이미지";
  return value;
}

function providerChannelLabel(value: "SMS" | "ALIMTALK" | "BRAND_MESSAGE" | null) {
  if (value === "SMS") return "SMS";
  if (value === "ALIMTALK") return "알림톡";
  if (value === "BRAND_MESSAGE") return "브랜드 메시지";
  return "—";
}

function statusSummary(detail: V2LogDetailResponse | null) {
  if (!detail) return "불러오는 중";
  return detail.deliveryResults[0]?.providerMessage || detail.deliveryResults[0]?.providerStatus || detail.lastErrorMessage || "상세 결과 없음";
}

function LogDetailDrawer({
  open,
  requestId,
  detail,
  loading,
  error,
  returnFocusRef,
  onClose,
}: {
  open: boolean;
  requestId: string | null;
  detail: V2LogDetailResponse | null;
  loading: boolean;
  error: string | null;
  returnFocusRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  const title = detail ? eventLabel(detail.eventKey, detail.providerChannel) : requestId ? `요청 ${shortId(requestId)}` : "발송 로그";
  const subtitle = detail ? statusSummary(detail) : loading ? "상세 정보를 불러오는 중입니다." : "발송 요청 상세";

  return (
    <ThemeProvider colorMode="light" dayScheme="light" preventSSRMismatch>
      <Dialog
        title={title}
        subtitle={subtitle}
        onClose={() => onClose()}
        returnFocusRef={returnFocusRef}
        position={{ narrow: "fullscreen", regular: "right" }}
        width="xlarge"
        height="large"
        className="log-detail-dialog"
      >
        <div className="log-detail-dialog-content">
          {loading ? (
            <div className="log-detail-loading-state" role="status">
              <Spinner size="medium" srText="발송 로그 상세를 불러오는 중입니다." />
              <span>발송 로그 상세를 불러오는 중입니다.</span>
            </div>
          ) : null}

          {!loading && error ? (
            <Flash variant="danger">{error}</Flash>
          ) : null}

          {!loading && !error && detail ? (
            <div className="log-detail-sections">
              <section className="log-detail-section" aria-labelledby="log-detail-summary-heading">
                <div className="log-detail-section-header">
                  <div>
                    <Heading as="h3" variant="small" id="log-detail-summary-heading">요약</Heading>
                    <p className="log-detail-section-desc">{eventLabel(detail.eventKey, detail.providerChannel)}</p>
                  </div>
                  <Label variant={requestStatusLabelVariant(detail.status)}>
                    {requestStatusText(detail.status)}
                  </Label>
                </div>

                {detail.lastErrorCode || detail.lastErrorMessage ? (
                  <Flash variant="warning" className="log-detail-alert">
                    <div>
                      <strong>오류 확인 필요</strong>
                      <div>{detail.lastErrorCode ? `[${detail.lastErrorCode}] ` : ""}{detail.lastErrorMessage || "전달 결과를 확인해 주세요."}</div>
                    </div>
                  </Flash>
                ) : null}

                <dl className="log-detail-meta-list">
                  <MetaField label="채널" value={providerChannelLabel(detail.providerChannel)} />
                  <MetaField label="수신번호" value={detail.recipientPhone} mono />
                  <MetaField
                    label="발신 자원"
                    value={
                      detail.resolvedSenderProfile?.plusFriendId ||
                      detail.resolvedSenderNumber?.phoneNumber ||
                      "—"
                    }
                    mono={Boolean(detail.resolvedSenderProfile?.senderKey || detail.resolvedSenderNumber?.phoneNumber)}
                  />
                  <MetaField label="요청 시각" value={formatShortDateTime(detail.createdAt)} />
                  <MetaField label="최근 결과" value={statusSummary(detail)} />
                  <MetaField label="요청 ID" value={detail.id} mono />
                  <MetaField label="메시지 타입" value={messageTypeLabel(detail.messageType)} />
                  <MetaField label="예약 시각" value={detail.scheduledAt ? formatShortDateTime(detail.scheduledAt) : "즉시 발송"} />
                  <MetaField
                    label="템플릿"
                    value={detail.resolvedTemplate?.name || detail.resolvedProviderTemplate?.templateCode || "—"}
                    mono={!detail.resolvedTemplate?.name}
                  />
                </dl>
              </section>

              {detail.manualBody ? (
                <section className="log-detail-section" aria-labelledby="log-detail-body-heading">
                  <Heading as="h3" variant="small" id="log-detail-body-heading">본문</Heading>
                  <pre className="log-detail-pre">{detail.manualBody}</pre>
                </section>
              ) : null}

              {detail.providerChannel === "BRAND_MESSAGE" && detail.brandMessage ? (
                <section className="log-detail-section" aria-labelledby="log-detail-brand-heading">
                  <Heading as="h3" variant="small" id="log-detail-brand-heading">브랜드 메시지 설정</Heading>
                  <dl className="log-detail-meta-list">
                    <MetaField label="모드" value={detail.brandMessage.mode || "—"} />
                    <MetaField label="타겟팅" value={detail.brandMessage.targeting || "—"} />
                    <MetaField label="푸시 알람" value={detail.brandMessage.pushAlarm ? "활성화" : "비활성화"} />
                    <MetaField label="성인용" value={detail.brandMessage.adult ? "예" : "아니오"} />
                    <MetaField label="통계 이벤트 키" value={detail.brandMessage.statsEventKey || detail.brandMessage.statsId || "—"} mono />
                    <MetaField label="재판매사 식별코드" value={detail.brandMessage.resellerCode || "—"} mono />
                  </dl>

                  {detail.brandMessage.image?.imageUrl ? (
                    <div className="log-detail-subsection">
                      <Heading as="h4" variant="small">이미지</Heading>
                      <div className="log-detail-image-wrap">
                        <img
                          src={detail.brandMessage.image.imageUrl}
                          alt="브랜드 메시지 이미지"
                          className="log-detail-image"
                        />
                      </div>
                      <dl className="log-detail-inline-meta">
                        <MetaField label="이미지 URL" value={detail.brandMessage.image.imageUrl} mono />
                        <MetaField label="이미지 링크" value={detail.brandMessage.image.imageLink || "미설정"} mono />
                      </dl>
                    </div>
                  ) : null}

                  {(detail.brandMessage.buttons?.length ?? 0) > 0 ? (
                    <div className="log-detail-subsection">
                      <Heading as="h4" variant="small">버튼</Heading>
                      <ul className="log-detail-row-list">
                        {detail.brandMessage.buttons?.map((button, index) => (
                          <li key={`${button.type || "button"}-${button.name || index}`} className="log-detail-row">
                            <div className="log-detail-row-main">
                              <strong className="log-detail-row-title">{button.name || `버튼 ${index + 1}`}</strong>
                              <span className="log-detail-row-meta">{button.type || "—"}</span>
                            </div>
                            <dl className="log-detail-inline-meta">
                              <MetaField label="모바일 링크" value={button.linkMo || "—"} mono />
                              <MetaField label="PC 링크" value={button.linkPc || "—"} mono />
                            </dl>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </section>
              ) : null}

              <section className="log-detail-section" aria-labelledby="log-detail-results-heading">
                <Heading as="h3" variant="small" id="log-detail-results-heading">전달 결과</Heading>
                {detail.deliveryResults.length > 0 ? (
                  <ul className="log-detail-row-list">
                    {detail.deliveryResults.map((result) => (
                      <li key={result.id} className="log-detail-row">
                        <div className="log-detail-row-main">
                          <strong className="log-detail-row-title">{result.providerStatus}</strong>
                          <span className="log-detail-row-meta">{formatShortDateTime(result.createdAt)}</span>
                        </div>
                        <dl className="log-detail-inline-meta">
                          <MetaField label="코드" value={result.providerCode || "—"} mono />
                          <MetaField label="메시지" value={result.providerMessage || "—"} />
                        </dl>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="log-detail-empty-text">아직 전달 결과가 없습니다.</p>
                )}
              </section>

              <section className="log-detail-section" aria-labelledby="log-detail-attempts-heading">
                <Heading as="h3" variant="small" id="log-detail-attempts-heading">시도 이력</Heading>
                {detail.attempts.length > 0 ? (
                  <ul className="log-detail-row-list">
                    {detail.attempts.map((attempt) => (
                      <li key={attempt.id} className="log-detail-row">
                        <div className="log-detail-row-main">
                          <strong className="log-detail-row-title">{attempt.attemptNumber}차 시도</strong>
                          <span className="log-detail-row-meta">{formatShortDateTime(attempt.createdAt)}</span>
                        </div>
                        <dl className="log-detail-inline-meta">
                          <MetaField label="오류 코드" value={attempt.errorCode || "—"} mono />
                          <MetaField label="오류 메시지" value={attempt.errorMessage || "—"} />
                        </dl>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="log-detail-empty-text">아직 시도 이력이 없습니다.</p>
                )}
              </section>

              {detail.variablesJson || detail.metadataJson ? (
                <section className="log-detail-section" aria-labelledby="log-detail-source-heading">
                  <Heading as="h3" variant="small" id="log-detail-source-heading">원본 데이터</Heading>
                  <div className="log-json-stack">
                    {detail.variablesJson ? <LogJsonDetails title="변수" value={detail.variablesJson} /> : null}
                    {detail.metadataJson ? <LogJsonDetails title="메타데이터" value={detail.metadataJson} /> : null}
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}
        </div>
      </Dialog>
    </ThemeProvider>
  );
}

function MetaField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="log-detail-meta-item">
      <dt className="log-detail-meta-term">{label}</dt>
      <dd className={`log-detail-meta-description${mono ? " mono" : ""}`}>{value}</dd>
    </div>
  );
}

function LogJsonDetails({ title, value }: { title: string; value: Record<string, unknown> }) {
  return (
    <details className="log-json-details">
      <summary>{title}</summary>
      <pre className="log-detail-pre">{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}
