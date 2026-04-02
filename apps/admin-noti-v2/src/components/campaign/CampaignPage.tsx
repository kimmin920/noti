"use client";

import { useMemo, useState } from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import { SmsCampaignBuilder } from "@/components/campaign/SmsCampaignBuilder";
import { SkeletonStatGrid, SkeletonTableBox, SkeletonToolbarBox } from "@/components/loading/PageSkeleton";
import { FormSelect } from "@/components/ui/FormSelect";
import { fetchV2CampaignDetail, type V2CampaignDetailResponse, type V2CampaignsResponse } from "@/lib/api/v2";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";
import { useAppStore } from "@/lib/store/app-store";
import type { ResourceState } from "@/lib/store/types";

function renderCampaignStepCircle(currentStep: 1 | 2 | 3 | 4, step: 1 | 2 | 3 | 4) {
  const done = step < currentStep;
  const active = step === currentStep;

  return (
    <div className={`step-circle${done ? " done" : active ? " active" : ""}`}>
      {done ? <AppIcon name="check" className="icon icon-14" /> : step}
    </div>
  );
}

function CampaignList({
  data,
  loading,
  error,
  resources,
}: {
  data: V2CampaignsResponse | null;
  loading?: boolean;
  error?: string | null;
  resources: ResourceState;
}) {
  const setCampaign = useAppStore((state) => state.setCampaign);
  const smsReady = resources.sms === "active";
  const items = data?.items ?? [];
  const totalRecipients = items.reduce((sum, item) => sum + item.recipientStats.totalCount, 0);
  const totalAccepted = items.reduce((sum, item) => sum + item.recipientStats.acceptedCount, 0);
  const totalHandled = items.reduce(
    (sum, item) => sum + item.recipientStats.acceptedCount + item.recipientStats.failedCount,
    0
  );
  const successRate = totalHandled > 0 ? `${((totalAccepted / totalHandled) * 100).toFixed(1)}%` : "—";
  const processingCount = items.filter((item) => item.status === "PROCESSING").length;
  const showLoadingNotice = Boolean(loading && !data);

  if (showLoadingNotice) {
    return (
      <>
        <div className="page-header">
          <div className="page-header-row">
            <div>
              <div className="page-title">대량 발송</div>
              <div className="page-desc">다수의 수신자에게 캠페인 메시지를 발송합니다</div>
            </div>
            <button className="btn btn-accent" disabled>
              <AppIcon name="plus" className="icon icon-14" />
              캠페인 만들기
            </button>
          </div>
        </div>

        <SkeletonStatGrid columns={4} />
        <SkeletonToolbarBox />
        <SkeletonTableBox titleWidth={92} rows={4} columns={["1.5fr", "90px", "90px", "1.2fr", "90px", "100px", "110px", "84px"]} />
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <div className="page-title">대량 발송</div>
            <div className="page-desc">다수의 수신자에게 캠페인 메시지를 발송합니다</div>
          </div>
          <button className="btn btn-accent" onClick={() => setCampaign({ mode: "new", step: 1, channel: "sms" })} disabled={!smsReady} title={smsReady ? undefined : "현재는 SMS 발신번호가 준비된 경우에만 캠페인을 만들 수 있습니다."}>
            <AppIcon name="plus" className="icon icon-14" />
            캠페인 만들기
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
          <div className="stat-cell"><div className="stat-label-t">전체 캠페인</div><div className="stat-value-t">{data?.counts.totalCount ?? 0}</div><div className="stat-sub-t">전체 채널</div></div>
          <div className="stat-cell"><div className="stat-label-t">진행 중</div><div className="stat-value-t" style={{ color: "var(--accent-emphasis)" }}>{processingCount}</div><div className="stat-sub-t">현재</div></div>
          <div className="stat-cell"><div className="stat-label-t">총 수신자</div><div className="stat-value-t">{formatCount(totalRecipients)}</div><div className="stat-sub-t">현재 목록 기준</div></div>
          <div className="stat-cell"><div className="stat-label-t">평균 성공률</div><div className="stat-value-t" style={{ color: "var(--success-fg)" }}>{successRate}</div><div className="stat-sub-t">처리 완료분 기준</div></div>
        </div>
      </div>

      <div className="box mb-16">
        <div className="box-body toolbar-box-body">
          <div className="toolbar-row">
            <div className="toolbar-search-wrap narrow">
              <AppIcon name="search" className="icon icon-14 toolbar-search-icon" />
              <input className="form-control toolbar-input-with-icon" placeholder="캠페인명 검색" disabled />
            </div>
            <FormSelect className="form-control toolbar-select narrow" disabled>
              <option>{data?.filter.channel === "all" ? "전체 채널" : data?.filter.channel === "sms" ? "SMS" : "알림톡"}</option>
            </FormSelect>
            <FormSelect className="form-control toolbar-select narrow" disabled>
              <option>최근 {data?.filter.limit ?? 20}건</option>
            </FormSelect>
          </div>
        </div>
      </div>

      <div className="box">
        <div className="box-header">
          <div className="box-title">캠페인 목록</div>
          <span className="text-small text-muted">총 {data?.counts.totalCount ?? 0}건</span>
        </div>
        {items.length > 0 ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>캠페인명</th><th>채널</th><th>수신자</th><th style={{ minWidth: 160 }}>발송 현황</th><th>성공률</th><th>상태</th><th>발송일시</th><th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const handledCount = item.recipientStats.acceptedCount + item.recipientStats.failedCount;
                  const progressRatio = item.recipientStats.totalCount > 0
                    ? Math.round((handledCount / item.recipientStats.totalCount) * 100)
                    : 0;
                  const itemSuccessRate = handledCount > 0
                    ? `${((item.recipientStats.acceptedCount / handledCount) * 100).toFixed(1)}%`
                    : "—";

                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="table-title-text">{item.title}</div>
                        <div className="table-subtext">{item.template?.name || item.sender.label}</div>
                      </td>
                      <td>{item.channel === "sms" ? <span className="chip chip-sms">SMS</span> : <span className="chip chip-kakao">알림톡</span>}</td>
                      <td className="td-mono">{formatCount(item.recipientStats.totalCount)}</td>
                      <td>
                        <div className="metric-progress-block">
                          <div className="metric-progress-row">
                            <span className="mono">{formatCount(handledCount)} / {formatCount(item.recipientStats.totalCount)}</span>
                            <span className={`ratio ${progressRatio >= 100 ? "success" : "info"}`}>{progressRatio}%</span>
                          </div>
                          <div className="progress thin">
                            <div className={`progress-bar${progressRatio >= 100 ? " green" : ""}`} style={{ width: `${progressRatio}%` }} />
                          </div>
                        </div>
                      </td>
                      <td>{itemSuccessRate === "—" ? <span className="td-muted">—</span> : <span className="table-success-text">{itemSuccessRate}</span>}</td>
                      <td><span className={`label ${campaignStatusClass(item.status)}`}><span className="label-dot" />{campaignStatusText(item.status)}</span></td>
                      <td className="td-muted text-small">{formatCampaignDate(item.scheduledAt || item.createdAt)}</td>
                      <td><button className="btn btn-default btn-sm" onClick={() => setCampaign({ mode: "detail", selectedCampaignId: item.id, selectedCampaignChannel: item.channel })}>상세</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">
              <AppIcon name="campaign" className="icon icon-40" />
            </div>
            <div className="empty-title">캠페인이 없습니다</div>
            <div className="empty-desc">첫 대량 발송 캠페인을 만들면 여기에 상태가 기록됩니다.</div>
          </div>
        )}
      </div>
    </>
  );
}

function CampaignDetail() {
  const selectedCampaignId = useAppStore((state) => state.campaign.selectedCampaignId);
  const selectedCampaignChannel = useAppStore((state) => state.campaign.selectedCampaignChannel);

  if (!selectedCampaignId) {
    return <CampaignDetailContent campaignId={null} campaignChannel={selectedCampaignChannel} />;
  }

  return (
    <CampaignDetailContent
      key={`${selectedCampaignId}:${selectedCampaignChannel ?? "unknown"}`}
      campaignId={selectedCampaignId}
      campaignChannel={selectedCampaignChannel}
    />
  );
}

function CampaignDetailContent({
  campaignId,
  campaignChannel,
}: {
  campaignId: string | null;
  campaignChannel: "sms" | "kakao" | null;
}) {
  const setCampaign = useAppStore((state) => state.setCampaign);
  const [detail, setDetail] = useState<V2CampaignDetailResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(campaignId));
  const [error, setError] = useState<string | null>(null);

  useMountEffect(() => {
    let cancelled = false;

    if (!campaignId) {
      setLoading(false);
      setDetail(null);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetchV2CampaignDetail(campaignId, campaignChannel ?? undefined);
        if (cancelled) return;
        setDetail(response);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "캠페인 상세를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  });

  const campaign = detail?.campaign ?? null;
  const errorCounts = useMemo(() => {
    if (!campaign) return [];

    const map = new Map<string, number>();

    for (const recipient of campaign.recipients) {
      const code = recipient.providerResultCode || recipient.providerResultMessage;
      if (!code) continue;
      map.set(code, (map.get(code) ?? 0) + 1);
    }

    return Array.from(map.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3);
  }, [campaign]);
  const showLoadingNotice = Boolean(loading && !detail);

  if (!campaignId) {
    return (
      <>
        <div className="page-header">
          <div className="page-header-row">
            <div>
              <div className="page-title">캠페인 상세</div>
              <div className="page-desc">선택된 캠페인이 없습니다</div>
            </div>
          </div>
        </div>
        <div className="box">
          <div className="empty-state">
            <div className="empty-icon">
              <AppIcon name="campaign" className="icon icon-40" />
            </div>
            <div className="empty-title">먼저 캠페인을 선택해 주세요</div>
            <div className="empty-actions">
              <button className="btn btn-default" onClick={() => setCampaign({ mode: "list" })}>목록으로 돌아가기</button>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (showLoadingNotice) {
    return (
      <>
        <div className="page-header">
          <div className="page-header-row">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button className="btn btn-default btn-sm" onClick={() => setCampaign({ mode: "list", selectedCampaignId: null, selectedCampaignChannel: null })}>
                <AppIcon name="chevron-right" className="icon icon-14" />
              </button>
              <div>
                <div className="page-title">캠페인 상세</div>
                <div className="page-desc">선택한 캠페인 정보를 불러오고 있습니다</div>
              </div>
            </div>
          </div>
        </div>

        <SkeletonStatGrid columns={5} />
        <div className="campaign-detail-grid">
          <SkeletonTableBox titleWidth={110} rows={5} columns={["120px", "90px", "90px", "90px", "110px"]} />
          <SkeletonTableBox titleWidth={92} rows={4} columns={["1.3fr", "110px"]} />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-row">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="btn btn-default btn-sm" onClick={() => setCampaign({ mode: "list", selectedCampaignId: null, selectedCampaignChannel: null })}>
              <AppIcon name="chevron-right" className="icon icon-14" />
            </button>
            <div>
              <div className="page-title">{campaign?.title || "캠페인 상세"}</div>
              <div className="page-desc">
                {detail?.channel === "kakao" ? "알림톡" : "SMS"} · 생성일: {campaign ? formatDateTimeText(campaign.createdAt) : "불러오는 중"} · 담당: {campaign?.requestedBy || "확인되지 않음"}
              </div>
            </div>
          </div>
          {campaign ? <span className={`label ${campaignStatusClass(campaign.status)}`} style={{ fontSize: 13 }}><span className="label-dot" />{campaignStatusText(campaign.status)}</span> : null}
        </div>
      </div>

      {error ? (
        <div className="flash flash-attention">
          <AppIcon name="warn" className="icon icon-16 flash-icon" />
          <div className="flash-body">{error}</div>
        </div>
      ) : null}

      <div className="box mb-16">
        <div className="box-body" style={{ padding: "20px 24px" }}>
          <div className="stats-grid-5">
            <div className="stat-cell-split"><div className="stat-label-t">전체 수신자</div><div className="stat-value-t">{formatCount(campaign?.recipientStats.totalCount ?? 0)}</div></div>
            <div className="stat-cell-split"><div className="stat-label-t">발송 완료</div><div className="stat-value-t" style={{ color: "var(--success-fg)" }}>{formatCount((campaign?.recipientStats.acceptedCount ?? 0) + (campaign?.recipientStats.failedCount ?? 0))}</div><div className="stat-sub-t text-success">{formatRatio((campaign?.recipientStats.acceptedCount ?? 0) + (campaign?.recipientStats.failedCount ?? 0), campaign?.recipientStats.totalCount ?? 0)}</div></div>
            <div className="stat-cell-split"><div className="stat-label-t">성공</div><div className="stat-value-t" style={{ color: "var(--success-fg)" }}>{formatCount(campaign?.recipientStats.acceptedCount ?? 0)}</div><div className="stat-sub-t text-success">{formatRatio(campaign?.recipientStats.acceptedCount ?? 0, (campaign?.recipientStats.acceptedCount ?? 0) + (campaign?.recipientStats.failedCount ?? 0))}</div></div>
            <div className="stat-cell-split"><div className="stat-label-t">실패</div><div className="stat-value-t" style={{ color: "var(--danger-fg)" }}>{formatCount(campaign?.recipientStats.failedCount ?? 0)}</div><div className="stat-sub-t text-danger">{formatRatio(campaign?.recipientStats.failedCount ?? 0, (campaign?.recipientStats.acceptedCount ?? 0) + (campaign?.recipientStats.failedCount ?? 0))}</div></div>
            <div className="stat-cell-split"><div className="stat-label-t">대기 중</div><div className="stat-value-t" style={{ color: "var(--attention-fg)" }}>{formatCount(campaign?.recipientStats.pendingCount ?? 0)}</div><div className="stat-sub-t">{formatRatio(campaign?.recipientStats.pendingCount ?? 0, campaign?.recipientStats.totalCount ?? 0)}</div></div>
          </div>
          <div style={{ marginTop: 20 }}>
            <div className="stat-progress-row">
              <span className="label">진행률</span>
              <span className="value">{formatCount((campaign?.recipientStats.acceptedCount ?? 0) + (campaign?.recipientStats.failedCount ?? 0))} / {formatCount(campaign?.recipientStats.totalCount ?? 0)}건</span>
            </div>
            <div className="progress tall"><div className="progress-bar" style={{ width: `${progressRatio(campaign)}%` }} /></div>
          </div>
        </div>
      </div>

      <div className="campaign-detail-grid">
        <div>
          <div className="box">
            <div className="box-header">
              <div className="box-title">수신자별 발송 현황</div>
              <span className="text-small text-muted">최근 {campaign?.recipients.length ?? 0}건</span>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>수신번호</th><th>이름</th><th>상태</th><th>결과 코드</th><th>처리 시각</th></tr></thead>
                <tbody>
                  {(campaign?.recipients ?? []).map((recipient) => (
                    <tr key={recipient.id}>
                      <td className="td-mono">{formatPhone(recipient.recipientPhone)}</td>
                      <td className="td-muted">{recipient.recipientName || "이름 없음"}</td>
                      <td><span className={`label ${recipientStatusClass(recipient.status)}`} style={{ fontSize: 11 }}><span className="label-dot" />{recipientStatusText(recipient.status)}</span></td>
                      <td className={`td-mono ${recipient.providerResultCode ? "" : "td-muted"}`} style={recipient.providerResultCode ? { color: "var(--danger-fg)" } : undefined}>{recipient.providerResultCode || "—"}</td>
                      <td className="td-muted text-small">{formatShortDateTime(recipient.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="box-footer">
              <span className="text-small text-muted">{campaign?.recipients.length ?? 0}건 표시 중 (전체 {formatCount(campaign?.recipientStats.totalCount ?? 0)}건)</span>
              <span />
            </div>
          </div>
        </div>

        <div>
          <div className="box">
            <div className="box-header"><div className="box-title">캠페인 정보</div></div>
            <div className="box-section-tight">
              <div className="box-row"><div className="box-row-content"><div className="table-kind-text">채널</div><div className="table-title-text">{detail?.channel === "kakao" ? <span className="chip chip-kakao">알림톡</span> : <span className="chip chip-sms">SMS</span>}</div></div></div>
              <div className="box-row"><div className="box-row-content"><div className="table-kind-text">발신 자원</div><div className="text-mono">{campaign?.sender.label || "—"}</div></div></div>
              <div className="box-row"><div className="box-row-content"><div className="table-kind-text">템플릿</div><div className="table-title-text">{campaign?.template?.name || "직접 작성"}</div></div></div>
              <div className="box-row"><div className="box-row-content"><div className="table-kind-text">발송 시작</div><div className="table-title-text">{campaign ? formatDateTimeText(campaign.scheduledAt || campaign.createdAt) : "—"}</div></div></div>
              <div className="box-row" style={{ borderBottom: "none" }}><div className="box-row-content"><div className="table-kind-text">메시지</div><div className="box-row-desc" style={{ fontSize: 12, lineHeight: 1.5 }}>{campaign?.body || "—"}</div></div></div>
            </div>
          </div>

          <div className="box">
            <div className="box-header"><div className="box-title">오류 분석</div></div>
            <div className="box-section-tight">
              {errorCounts.length > 0 ? (
                errorCounts.map(([code, count], index) => (
                  <div className="box-row" style={index === errorCounts.length - 1 ? { borderBottom: "none" } : undefined} key={code}>
                    <div className="box-row-title text-small">{code}</div>
                    <div className="text-mono" style={{ color: "var(--danger-fg)" }}>{formatCount(count)}건</div>
                  </div>
                ))
              ) : (
                <div className="box-row" style={{ borderBottom: "none" }}>
                  <div className="box-row-title text-small">실패 코드 없음</div>
                  <div className="text-mono">0건</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function CampaignNew({
  onRefresh,
}: {
  onRefresh: () => void;
}) {
  const setCampaign = useAppStore((state) => state.setCampaign);

  return (
    <SmsCampaignBuilder
      onSubmitted={(campaignId) => {
        onRefresh();
        setCampaign({
          mode: "detail",
          step: 1,
          channel: "sms",
          selectedCampaignId: campaignId,
          selectedCampaignChannel: "sms",
        });
      }}
    />
  );
}

export function CampaignPage({
  data,
  loading,
  error,
  resources,
  onRefresh,
}: {
  data?: V2CampaignsResponse | null;
  loading?: boolean;
  error?: string | null;
  resources: ResourceState;
  onRefresh: () => void;
}) {
  const mode = useAppStore((state) => state.campaign.mode);

  if (mode === "new") return <CampaignNew onRefresh={onRefresh} />;
  if (mode === "detail") return <CampaignDetail />;
  return <CampaignList data={data ?? null} loading={loading} error={error} resources={resources} />;
}

function campaignStatusText(status: string) {
  if (status === "PROCESSING") return "진행 중";
  if (status === "SENT_TO_PROVIDER") return "전달 완료";
  if (status === "PARTIAL_FAILED") return "부분 실패";
  if (status === "FAILED") return "실패";
  return status;
}

function campaignStatusClass(status: string) {
  if (status === "SENT_TO_PROVIDER") return "label-green";
  if (status === "PROCESSING") return "label-blue";
  if (status === "PARTIAL_FAILED") return "label-yellow";
  if (status === "FAILED") return "label-red";
  return "label-gray";
}

function formatCount(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function recipientStatusText(status: string) {
  if (status === "ACCEPTED") return "성공";
  if (status === "FAILED") return "실패";
  if (status === "REQUESTED") return "대기";
  return status;
}

function recipientStatusClass(status: string) {
  if (status === "ACCEPTED") return "label-green";
  if (status === "FAILED") return "label-red";
  if (status === "REQUESTED") return "label-gray";
  return "label-gray";
}

function formatCampaignDate(value: string) {
  try {
    const date = new Date(value);
    const dateText = new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
    const timeText = new Intl.DateTimeFormat("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);

    return (
      <>
        {dateText}
        <br />
        {timeText}
      </>
    );
  } catch {
    return value;
  }
}

function formatDateTimeText(value: string) {
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

function formatShortDateTime(value: string) {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatPhone(value: string) {
  if (value.length !== 11) return value;
  return `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7)}`;
}

function formatRatio(value: number, total: number) {
  if (total <= 0) return "—";
  return `${Math.round((value / total) * 100)}%`;
}

function progressRatio(campaign: V2CampaignDetailResponse["campaign"] | null) {
  if (!campaign || campaign.recipientStats.totalCount <= 0) return 0;

  const completed = campaign.recipientStats.acceptedCount + campaign.recipientStats.failedCount;
  return Math.round((completed / campaign.recipientStats.totalCount) * 100);
}
