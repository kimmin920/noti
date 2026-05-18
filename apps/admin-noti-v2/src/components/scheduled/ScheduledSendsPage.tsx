"use client";

import { Flash, ThemeProvider, VisuallyHidden } from "@primer/react";
import { DataTable, Table, type Column } from "@primer/react/experimental";
import { useMemo } from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import { SkeletonStatGrid, SkeletonTableBox } from "@/components/loading/PageSkeleton";
import type { V2ScheduledSendsResponse } from "@/lib/api/v2";

type ScheduledSendsPageProps = {
  data: V2ScheduledSendsResponse | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
};

type ScheduledSendItem = V2ScheduledSendsResponse["items"][number];

export function ScheduledSendsPage({ data, loading = false, error, onRefresh }: ScheduledSendsPageProps) {
  const items = data?.items ?? [];
  const tableColumns = useMemo<Array<Column<ScheduledSendItem>>>(() => [
    {
      header: "발송",
      field: "title",
      rowHeader: true,
      width: "minmax(220px, 1fr)",
      renderCell: (item) => (
        <div>
          <div className="text-semibold">{item.title}</div>
          <div className="td-muted text-small">{item.kind === "campaign" ? "대량 발송" : "단건 발송"}</div>
        </div>
      ),
    },
    {
      header: "채널",
      field: "channel",
      width: "120px",
      renderCell: renderChannel,
    },
    {
      header: "예약 시각",
      field: "scheduledAt",
      width: "180px",
      renderCell: (item) => <span className="td-mono">{formatDateTime(item.scheduledAt)}</span>,
    },
    {
      header: "대상",
      field: "recipientCount",
      width: "136px",
      align: "end",
      renderCell: renderRecipient,
    },
    {
      header: "상태",
      field: "status",
      width: "104px",
      renderCell: () => (
        <span className="label label-yellow">
          <span className="label-dot" />
          예약됨
        </span>
      ),
    },
  ], []);

  if (loading && !data) {
    return (
      <>
        <ScheduledHeader onRefresh={onRefresh} refreshDisabled />
        <SkeletonStatGrid columns={4} />
        <SkeletonTableBox titleWidth={132} rows={4} columns={["minmax(220px, 1fr)", 120, 180, 136, 104]} />
      </>
    );
  }

  return (
    <>
      <ScheduledHeader onRefresh={onRefresh} refreshDisabled={loading} />

      {error ? <Flash variant="danger">{error}</Flash> : null}

      <div className="box">
        <ScheduledStatsGrid
          totalCount={data?.summary.totalCount ?? 0}
          todayCount={data?.summary.todayCount ?? 0}
          messageCount={data?.summary.messageCount ?? 0}
          campaignCount={data?.summary.campaignCount ?? 0}
        />
      </div>

      {items.length === 0 ? (
        <div className="inbox-empty">
          <div className="inbox-empty-icon scheduled-empty-icon">
            <AppIcon name="clock" className="icon icon-32" />
          </div>
          <div className="empty-title">예정된 예약 발송이 없습니다</div>
          <div className="empty-desc">앞으로 예정된 예약 발송이 생기면 이곳에 표시됩니다.</div>
        </div>
      ) : (
        <div className="box scheduled-table-box">
          <div className="box-header">
            <div className="box-title" id="scheduled-sends-table-title">예약 발송 목록</div>
          </div>
          <div className="logs-primer-table-scroll" tabIndex={0} aria-label="예약 발송 표 가로 스크롤">
            <ThemeProvider colorMode="light" dayScheme="light" preventSSRMismatch>
              <Table.Container className="logs-primer-table-container">
                <DataTable
                  aria-labelledby="scheduled-sends-table-title"
                  data={items}
                  columns={tableColumns}
                />
              </Table.Container>
            </ThemeProvider>
          </div>
        </div>
      )}
    </>
  );
}

function ScheduledHeader({
  onRefresh,
  refreshDisabled,
}: {
  onRefresh?: () => void;
  refreshDisabled?: boolean;
}) {
  return (
    <div className="page-header">
      <div className="page-header-row">
        <div>
          <div className="page-title">예약 현황</div>
          <div className="page-desc">앞으로 예정된 예약 발송을 확인합니다</div>
        </div>
        {onRefresh ? (
          <button className="btn btn-default btn-sm" onClick={onRefresh} disabled={refreshDisabled}>
            <AppIcon name="refresh" className="icon icon-14" />
            새로고침
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ScheduledStatsGrid({
  totalCount,
  todayCount,
  messageCount,
  campaignCount,
}: {
  totalCount: number;
  todayCount: number;
  messageCount: number;
  campaignCount: number;
}) {
  return (
    <div className="stats-grid scheduled-stats-grid">
      <div className="stat-cell">
        <div className="stat-label-t">전체 예정</div>
        <div className="stat-value-t">{totalCount}</div>
        <div className="stat-sub-t">예약 발송</div>
      </div>
      <div className="stat-cell">
        <div className="stat-label-t">오늘 예약</div>
        <div className="stat-value-t stat-value-attention">{todayCount}</div>
        <div className="stat-sub-t">예약 발송</div>
      </div>
      <div className="stat-cell">
        <div className="stat-label-t">단건</div>
        <div className="stat-value-t">{messageCount}</div>
        <div className="stat-sub-t">메시지</div>
      </div>
      <div className="stat-cell">
        <div className="stat-label-t">대량</div>
        <div className="stat-value-t">{campaignCount}</div>
        <div className="stat-sub-t">캠페인</div>
      </div>
    </div>
  );
}

function renderChannel(item: ScheduledSendItem) {
  if (item.channel === "brand") {
    return <span className="chip chip-brand">브랜드</span>;
  }

  if (item.channel === "alimtalk") {
    return <span className="chip chip-kakao">알림톡</span>;
  }

  if (item.channel === "sms") {
    return <span className="chip chip-sms">SMS</span>;
  }

  return <VisuallyHidden>채널 없음</VisuallyHidden>;
}

function renderRecipient(item: ScheduledSendItem) {
  if (item.kind === "campaign") {
    return <span className="td-mono">{item.recipientCount.toLocaleString()}명</span>;
  }

  return <span className="td-mono">{item.recipientLabel ?? "1명"}</span>;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
