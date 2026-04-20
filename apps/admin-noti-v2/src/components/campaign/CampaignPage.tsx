"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppIcon } from "@/components/icons/AppIcon";
import { AlimtalkCampaignBuilder } from "@/components/campaign/AlimtalkCampaignBuilder";
import { BrandCampaignBuilder } from "@/components/campaign/BrandCampaignBuilder";
import { SmsCampaignBuilder } from "@/components/campaign/SmsCampaignBuilder";
import { BrandTemplatePreview } from "@/components/templates/BrandTemplatePreview";
import { SkeletonStatGrid, SkeletonTableBox, SkeletonToolbarBox } from "@/components/loading/PageSkeleton";
import { FormSelect } from "@/components/ui/FormSelect";
import { fetchV2BrandTemplateDetail, fetchV2CampaignDetail, type V2BrandTemplateDetailResponse, type V2CampaignDetailResponse, type V2CampaignsResponse } from "@/lib/api/v2";
import { applyVariablesToBrandTemplate, normalizeTemplateParameters } from "@/lib/brand-template-rendering";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";
import { buildCampaignDetailPath, buildCampaignListPath } from "@/lib/routes";
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
  channel,
  title,
  description,
  createLabel,
  canCreate,
  createDisabledReason,
}: {
  data: V2CampaignsResponse | null;
  loading?: boolean;
  error?: string | null;
  resources: ResourceState;
  channel: "sms" | "kakao" | "brand";
  title: string;
  description: string;
  createLabel: string;
  canCreate: boolean;
  createDisabledReason?: string;
}) {
  const router = useRouter();
  const setCampaign = useAppStore((state) => state.setCampaign);
  const channelReady = channel === "sms" ? resources.sms === "active" : resources.kakao === "active";
  const items = (data?.items ?? []).filter((item) => item.channel === channel);
  const totalCampaignCount =
    channel === "sms" ? data?.counts.smsCount ?? 0 : channel === "kakao" ? data?.counts.kakaoCount ?? 0 : data?.counts.brandCount ?? 0;
  const totalRecipients = items.reduce((sum, item) => sum + item.recipientStats.totalCount, 0);
  const totalDelivered = items.reduce((sum, item) => sum + item.recipientStats.deliveredCount, 0);
  const totalFinalized = items.reduce(
    (sum, item) => sum + item.recipientStats.deliveredCount + item.recipientStats.failedCount,
    0
  );
  const successRate = totalFinalized > 0 ? `${((totalDelivered / totalFinalized) * 100).toFixed(1)}%` : "—";
  const processingCount = items.filter((item) =>
    ["WAITING", "IN_PROGRESS", "SENT_TO_PROVIDER", "PROCESSING", "ACCEPTED"].includes(item.status)
  ).length;
  const showLoadingNotice = Boolean(loading && !data);
  const bulkIconName = channel === "sms" ? "sms-bulk" : channel === "kakao" ? "kakao-bulk" : "brand-bulk";

  if (showLoadingNotice) {
    return (
      <>
        <div className="page-header">
          <div className="page-header-row">
            <div>
              <div className="page-title">{title}</div>
              <div className="page-desc">{description}</div>
            </div>
            <button className="btn btn-accent" disabled>
              <AppIcon name="plus" className="icon icon-14" />
              {createLabel}
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
            <div className="page-title">{title}</div>
            <div className="page-desc">{description}</div>
          </div>
          <button
            className="btn btn-accent"
            onClick={() => setCampaign({ mode: "new", step: 1, channel })}
            disabled={!canCreate || !channelReady}
            title={!canCreate ? createDisabledReason : channelReady ? undefined : createDisabledReason}
          >
            <AppIcon name="plus" className="icon icon-14" />
            {createLabel}
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
          <div className="stat-cell"><div className="stat-label-t">전체 캠페인</div><div className="stat-value-t">{totalCampaignCount}</div><div className="stat-sub-t">{channel === "sms" ? "SMS 채널" : channel === "kakao" ? "알림톡 채널" : "브랜드 메시지 채널"}</div></div>
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
              <option>{channel === "sms" ? "SMS만 보기" : channel === "kakao" ? "알림톡만 보기" : "브랜드 메시지만 보기"}</option>
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
          <span className="text-small text-muted">총 {totalCampaignCount}건</span>
        </div>
        {items.length > 0 ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>캠페인명</th><th>채널</th><th>수신자</th><th style={{ minWidth: 160 }}>진행률</th><th>성공률</th><th>요약 상태</th><th>발송일시</th><th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const handledCount = item.recipientStats.submittedCount + item.recipientStats.deliveredCount + item.recipientStats.failedCount;
                  const finalizedCount = item.recipientStats.deliveredCount + item.recipientStats.failedCount;
                  const progressRatio = item.recipientStats.totalCount > 0
                    ? Math.round((handledCount / item.recipientStats.totalCount) * 100)
                    : 0;
                  const itemSuccessRate = finalizedCount > 0
                    ? `${((item.recipientStats.deliveredCount / finalizedCount) * 100).toFixed(1)}%`
                    : "—";

                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="table-title-text">{item.title}</div>
                        <div className="table-subtext">{item.template?.name || item.sender.label}</div>
                      </td>
                      <td>{item.channel === "sms" ? <span className="chip chip-sms">SMS</span> : item.channel === "kakao" ? <span className="chip chip-kakao">알림톡</span> : <span className="chip chip-brand">브랜드</span>}</td>
                      <td className="td-mono">{formatCount(item.recipientStats.totalCount)}</td>
                      <td>
                        <div className="metric-progress-block">
                          <div className="metric-progress-row">
                            <span className="mono">처리 완료</span>
                            <span className="ratio">{formatCount(handledCount)} / {formatCount(item.recipientStats.totalCount)}건</span>
                          </div>
                          <div className="progress thin">
                            <div className="progress-bar neutral" style={{ width: `${progressRatio}%` }} />
                          </div>
                        </div>
                      </td>
                      <td>{itemSuccessRate === "—" ? <span className="td-muted">—</span> : <span className="table-success-text">{itemSuccessRate}</span>}</td>
                      <td><span className={`label ${campaignStatusClass(item.status)}`}><span className="label-dot" />{campaignStatusText(item.status)}</span></td>
                      <td className="td-muted text-small">{formatCampaignDate(item.scheduledAt || item.createdAt)}</td>
                      <td>
                        <button
                          className="btn btn-default btn-sm"
                          onClick={() => router.push(buildCampaignDetailPath(item.channel, item.id))}
                        >
                          상세
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">
              <AppIcon name={bulkIconName} className="icon icon-40" />
            </div>
            <div className="empty-title">캠페인이 없습니다</div>
            <div className="empty-desc">
              {channel === "sms"
                ? "첫 SMS 대량 발송 캠페인을 만들면 여기에 상태가 기록됩니다."
                : channel === "kakao"
                  ? "알림톡 대량 발송 이력이 생기면 여기에 상태가 기록됩니다."
                  : "브랜드 메시지 대량 발송 이력이 생기면 여기에 상태가 기록됩니다."}
            </div>
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
  backPath,
}: {
  campaignId: string | null;
  campaignChannel: "sms" | "kakao" | "brand" | null;
  backPath?: string | null;
}) {
  const router = useRouter();
  const setCampaign = useAppStore((state) => state.setCampaign);
  const [detail, setDetail] = useState<V2CampaignDetailResponse | null>(null);
  const [brandTemplateDetail, setBrandTemplateDetail] = useState<V2BrandTemplateDetailResponse | null>(null);
  const [brandTemplateDetailLoading, setBrandTemplateDetailLoading] = useState(false);
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
  const brandTemplateVariables = useMemo(() => {
    return toStringArray(brandTemplateDetail?.template.requiredVariables);
  }, [brandTemplateDetail?.template.requiredVariables]);
  const previewTemplateParameters = useMemo(() => {
    if (!campaign) return {};

    for (const recipient of campaign.recipients) {
      const normalized = normalizeTemplateParameters(recipient.templateParameters);
      if (Object.keys(normalized).length > 0) {
        return normalized;
      }
    }

    return {};
  }, [campaign]);
  const brandTemplatePreviewModel = useMemo(() => {
    if (detail?.channel !== "brand" || campaign?.template?.source !== "TEMPLATE" || !brandTemplateDetail?.template) {
      return null;
    }

    return applyVariablesToBrandTemplate(brandTemplateDetail.template, previewTemplateParameters);
  }, [brandTemplateDetail, campaign?.template?.source, detail?.channel, previewTemplateParameters]);
  const templateParameterRows = useMemo(() => {
    const keys =
      brandTemplateVariables.length > 0
        ? brandTemplateVariables
        : Object.keys(previewTemplateParameters);

    return keys.map((key) => ({
      key,
      value: previewTemplateParameters[key] || "",
    }));
  }, [brandTemplateVariables, previewTemplateParameters]);
  const errorCounts = useMemo(() => {
    if (!campaign) return [];

    const map = new Map<string, number>();

    for (const recipient of campaign.recipients) {
      const summary =
        recipient.providerResultCode && recipient.providerResultMessage
          ? `[${recipient.providerResultCode}] ${recipient.providerResultMessage}`
          : recipient.providerResultCode || recipient.providerResultMessage;
      if (!summary) continue;
      map.set(summary, (map.get(summary) ?? 0) + 1);
    }

    return Array.from(map.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3);
  }, [campaign]);

  useEffect(() => {
    let cancelled = false;

    const senderProfileId = campaign?.sender.id || "";
    const templateCode = campaign?.template?.code || "";
    const isBrandTemplateCampaign =
      detail?.channel === "brand" &&
      campaign?.template?.source === "TEMPLATE" &&
      Boolean(senderProfileId) &&
      Boolean(templateCode);

    if (!isBrandTemplateCampaign) {
      setBrandTemplateDetail(null);
      setBrandTemplateDetailLoading(false);
      return;
    }

    const load = async () => {
      setBrandTemplateDetailLoading(true);

      try {
        const response = await fetchV2BrandTemplateDetail({
          senderProfileId,
          templateCode,
        });
        if (cancelled) return;
        setBrandTemplateDetail(response);
      } catch {
        if (cancelled) return;
        setBrandTemplateDetail(null);
      } finally {
        if (!cancelled) {
          setBrandTemplateDetailLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [campaign?.sender.id, campaign?.template?.code, campaign?.template?.source, detail?.channel]);

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
              <button
                className="btn btn-default btn-sm"
                onClick={() => {
                  if (backPath) {
                    router.push(backPath);
                    return;
                  }

                  setCampaign({ mode: "list", selectedCampaignId: null, selectedCampaignChannel: null });
                }}
              >
                <AppIcon name="chevron-left" className="icon icon-14" />
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
            <button
              className="btn btn-default btn-sm"
              onClick={() => {
                if (backPath) {
                  router.push(backPath);
                  return;
                }

                setCampaign({ mode: "list", selectedCampaignId: null, selectedCampaignChannel: null });
              }}
            >
              <AppIcon name="chevron-left" className="icon icon-14" />
            </button>
            <div>
              <div className="page-title">{campaign?.title || "캠페인 상세"}</div>
              <div className="page-desc">
                {detail?.channel === "kakao" ? "알림톡" : detail?.channel === "brand" ? "브랜드 메시지" : "SMS"} · 생성일: {campaign ? formatDateTimeText(campaign.createdAt) : "불러오는 중"}
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

      {campaign?.status === "SENT_TO_PROVIDER" || campaign?.status === "IN_PROGRESS" ? (
        <div className="flash flash-info mb-16">
          <AppIcon name="info" className="icon icon-16 flash-icon" />
          <div className="flash-body">현재 상태는 최종 결과를 확인하는 중입니다. 아래 수신자별 결과에서 최신 원본 응답을 확인할 수 있습니다.</div>
        </div>
      ) : null}

      {campaign?.status === "LOOKUP_FAILED" ? (
        <div className="flash flash-attention mb-16">
          <AppIcon name="warn" className="icon icon-16 flash-icon" />
          <div className="flash-body">사업자 결과 조회에 일시적으로 실패했습니다. 잠시 후 새로고침하면 최신 상태를 다시 확인할 수 있습니다.</div>
        </div>
      ) : null}

      <div className="box mb-16">
        <div className="box-body" style={{ padding: "20px 24px" }}>
          <div className="stats-grid-5">
            <div className="stat-cell-split"><div className="stat-label-t">전체 수신자</div><div className="stat-value-t">{formatCount(campaign?.recipientStats.totalCount ?? 0)}</div></div>
            <div className="stat-cell-split"><div className="stat-label-t">최종 처리</div><div className="stat-value-t" style={{ color: "var(--accent-emphasis)" }}>{formatCount((campaign?.recipientStats.deliveredCount ?? 0) + (campaign?.recipientStats.failedCount ?? 0))}</div><div className="stat-sub-t">{formatRatio((campaign?.recipientStats.deliveredCount ?? 0) + (campaign?.recipientStats.failedCount ?? 0), campaign?.recipientStats.totalCount ?? 0)}</div></div>
            <div className="stat-cell-split"><div className="stat-label-t">전달 완료</div><div className="stat-value-t" style={{ color: "var(--success-fg)" }}>{formatCount(campaign?.recipientStats.deliveredCount ?? 0)}</div><div className="stat-sub-t text-success">{formatRatio(campaign?.recipientStats.deliveredCount ?? 0, (campaign?.recipientStats.deliveredCount ?? 0) + (campaign?.recipientStats.failedCount ?? 0))}</div></div>
            <div className="stat-cell-split"><div className="stat-label-t">실패</div><div className="stat-value-t" style={{ color: "var(--danger-fg)" }}>{formatCount(campaign?.recipientStats.failedCount ?? 0)}</div><div className="stat-sub-t text-danger">{formatRatio(campaign?.recipientStats.failedCount ?? 0, (campaign?.recipientStats.deliveredCount ?? 0) + (campaign?.recipientStats.failedCount ?? 0))}</div></div>
            <div className="stat-cell-split"><div className="stat-label-t">대기 중</div><div className="stat-value-t" style={{ color: "var(--attention-fg)" }}>{formatCount(campaign?.recipientStats.pendingCount ?? 0)}</div><div className="stat-sub-t">{formatRatio(campaign?.recipientStats.pendingCount ?? 0, campaign?.recipientStats.totalCount ?? 0)}</div></div>
          </div>
          <div style={{ marginTop: 20 }}>
            <div className="stat-progress-row">
              <span className="label">진행률</span>
              <span className="value">{formatCount((campaign?.recipientStats.submittedCount ?? 0) + (campaign?.recipientStats.deliveredCount ?? 0) + (campaign?.recipientStats.failedCount ?? 0))} / {formatCount(campaign?.recipientStats.totalCount ?? 0)}건</span>
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
                <thead><tr><th>수신번호</th><th>이름</th><th>요약 상태</th><th>원본 응답</th><th>처리 시각</th></tr></thead>
                <tbody>
                  {(campaign?.recipients ?? []).map((recipient) => (
                    <tr key={recipient.id}>
                      <td className="td-mono">{formatPhone(recipient.recipientPhone)}</td>
                      <td className="td-muted">{recipient.recipientName || "이름 없음"}</td>
                      <td><span className={`label ${recipientStatusClass(recipient.status)}`} style={{ fontSize: 11 }}><span className="label-dot" />{recipientStatusText(recipient.status)}</span></td>
                      <td>
                        {recipient.providerResultCode || recipient.providerResultMessage ? (
                          <div>
                            <div className={`td-mono ${recipient.providerResultCode ? "" : "td-muted"}`} style={recipient.providerResultCode ? { color: "var(--danger-fg)" } : undefined}>
                              {recipient.providerResultCode || "—"}
                            </div>
                            {recipient.providerResultMessage ? (
                              <div className="table-subtext" style={{ color: "var(--danger-fg)", maxWidth: 320 }}>
                                {recipient.providerResultMessage}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="td-muted">—</span>
                        )}
                      </td>
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
              <div className="box-row"><div className="box-row-content"><div className="table-kind-text">채널</div><div className="table-title-text">{detail?.channel === "kakao" ? <span className="chip chip-kakao">알림톡</span> : detail?.channel === "brand" ? <span className="chip chip-brand">브랜드</span> : <span className="chip chip-sms">SMS</span>}</div></div></div>
              <div className="box-row"><div className="box-row-content"><div className="table-kind-text">발신 자원</div><div className="text-mono">{campaign?.sender.label || "—"}</div></div></div>
              <div className="box-row"><div className="box-row-content"><div className="table-kind-text">템플릿</div><div className="table-title-text">{campaign?.template?.name || "직접 작성"}</div></div></div>
              <div className="box-row"><div className="box-row-content"><div className="table-kind-text">발송 시작</div><div className="table-title-text">{campaign ? formatDateTimeText(campaign.scheduledAt || campaign.createdAt) : "—"}</div></div></div>
              {detail?.channel === "brand" ? (
                <>
                  <div className="box-row"><div className="box-row-content"><div className="table-kind-text">메시지 타입</div><div className="table-title-text">{campaign?.template?.messageType || "TEXT"}</div></div></div>
                  <div className="box-row"><div className="box-row-content"><div className="table-kind-text">부가 설정</div><div className="box-row-desc" style={{ fontSize: 12, lineHeight: 1.5 }}>{campaign?.template?.pushAlarm ? "푸시 알람 사용" : "푸시 알람 미사용"} · {campaign?.template?.adult ? "성인용 메시지" : "일반 메시지"}</div></div></div>
                  {campaign?.template?.imageUrl ? (
                    <div className="box-row"><div className="box-row-content"><div className="table-kind-text">이미지</div><div className="box-row-desc" style={{ fontSize: 12, lineHeight: 1.5 }}><a href={campaign.template?.imageUrl || "#"} target="_blank" rel="noreferrer" className="text-link">업로드된 이미지 열기</a>{campaign.template?.imageLink ? ` · ${campaign.template.imageLink}` : ""}</div></div></div>
                  ) : null}
                  {(campaign?.template?.buttons ?? []).length ? (
                    <div className="box-row"><div className="box-row-content"><div className="table-kind-text">버튼</div><div className="box-row-desc" style={{ fontSize: 12, lineHeight: 1.6 }}>{(campaign?.template?.buttons ?? []).map((button) => `${button.name}(${button.type})`).join(", ")}</div></div></div>
                  ) : null}
                  {campaign?.template?.source === "TEMPLATE" ? (
                    <div className="box-row">
                      <div className="box-row-content">
                        <div className="table-kind-text">템플릿 구조</div>
                        {brandTemplateDetailLoading ? (
                          <div className="box-row-desc">템플릿 구조를 불러오는 중입니다.</div>
                        ) : brandTemplatePreviewModel ? (
                          <div className="campaign-brand-template-preview-wrap">
                            <BrandTemplatePreview model={brandTemplatePreviewModel} compact />
                          </div>
                        ) : (
                          <div className="box-row-desc">템플릿 구조를 불러오지 못했습니다.</div>
                        )}
                      </div>
                    </div>
                  ) : null}
                  {campaign?.template?.source === "TEMPLATE" && templateParameterRows.length > 0 ? (
                    <div className="box-row">
                      <div className="box-row-content">
                        <div className="table-kind-text">적용 변수</div>
                        <div className="campaign-template-variable-list">
                          {templateParameterRows.map((row) => (
                            <div className="campaign-template-variable-row" key={row.key}>
                              <div className="campaign-template-variable-token">#{`{${row.key}}`}</div>
                              <div className="campaign-template-variable-field">첫 수신자 샘플 값</div>
                              <div className="campaign-template-variable-sample">{row.value || "샘플 값 없음"}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
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
  channel,
  onRefresh,
}: {
  channel: "sms" | "kakao" | "brand";
  onRefresh: () => void;
}) {
  const router = useRouter();
  const setCampaign = useAppStore((state) => state.setCampaign);

  if (channel === "kakao") {
    return (
      <AlimtalkCampaignBuilder
        onSubmitted={(campaignId) => {
          onRefresh();
          setCampaign({ mode: "list", step: 1, channel: "kakao", selectedCampaignId: null, selectedCampaignChannel: null });
          router.push(buildCampaignDetailPath("kakao", campaignId));
        }}
      />
    );
  }

  if (channel === "brand") {
    return (
      <BrandCampaignBuilder
        onSubmitted={(campaignId) => {
          onRefresh();
          setCampaign({ mode: "list", step: 1, channel: "brand", selectedCampaignId: null, selectedCampaignChannel: null });
          router.push(buildCampaignDetailPath("brand", campaignId));
        }}
      />
    );
  }

  return (
    <SmsCampaignBuilder
      onSubmitted={(campaignId) => {
        onRefresh();
        setCampaign({ mode: "list", step: 1, channel: "sms", selectedCampaignId: null, selectedCampaignChannel: null });
        router.push(buildCampaignDetailPath("sms", campaignId));
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
  channel,
  title,
  description,
  createLabel,
  canCreate = true,
  createDisabledReason,
  initialCampaignDetail,
}: {
  data?: V2CampaignsResponse | null;
  loading?: boolean;
  error?: string | null;
  resources: ResourceState;
  onRefresh: () => void;
  channel: "sms" | "kakao" | "brand";
  title: string;
  description: string;
  createLabel: string;
  canCreate?: boolean;
  createDisabledReason?: string;
  initialCampaignDetail?: {
    campaignId: string;
    campaignChannel: "sms" | "kakao" | "brand";
    from?: "logs" | null;
  };
}) {
  const mode = useAppStore((state) => state.campaign.mode);
  const draftCampaignChannel = useAppStore((state) => state.campaign.channel);
  const selectedCampaignChannel = useAppStore((state) => state.campaign.selectedCampaignChannel);
  const resolvedMode =
    mode === "detail" && selectedCampaignChannel && selectedCampaignChannel !== channel
      ? "list"
      : mode === "new" && draftCampaignChannel && draftCampaignChannel !== channel
        ? "list"
        : mode;

  if (initialCampaignDetail?.campaignId && initialCampaignDetail.campaignChannel === channel) {
    const backPath =
      initialCampaignDetail.from === "logs"
        ? "/logs"
        : buildCampaignListPath(channel);

    return (
      <CampaignDetailContent
        campaignId={initialCampaignDetail.campaignId}
        campaignChannel={initialCampaignDetail.campaignChannel}
        backPath={backPath}
      />
    );
  }

  if (resolvedMode === "new") return <CampaignNew channel={channel} onRefresh={onRefresh} />;
  if (resolvedMode === "detail") return <CampaignDetail />;
  return (
    <CampaignList
      data={data ?? null}
      loading={loading}
      error={error}
      resources={resources}
      channel={channel}
      title={title}
      description={description}
      createLabel={createLabel}
      canCreate={canCreate}
      createDisabledReason={createDisabledReason}
    />
  );
}

function campaignStatusText(status: string) {
  if (status === "WAITING" || status === "ACCEPTED") return "대기";
  if (status === "IN_PROGRESS" || status === "PROCESSING") return "진행 중";
  if (status === "LOOKUP_FAILED") return "조회 실패";
  if (status === "SENT_TO_PROVIDER") return "발송 접수";
  if (status === "DELIVERED") return "전달 완료";
  if (status === "PARTIAL_FAILED") return "부분 실패";
  if (status === "FAILED") return "실패";
  return status;
}

function campaignStatusClass(status: string) {
  if (status === "DELIVERED") return "label-green";
  if (status === "SENT_TO_PROVIDER") return "label-blue";
  if (status === "IN_PROGRESS" || status === "PROCESSING") return "label-blue";
  if (status === "WAITING" || status === "ACCEPTED") return "label-gray";
  if (status === "LOOKUP_FAILED") return "label-yellow";
  if (status === "PARTIAL_FAILED") return "label-yellow";
  if (status === "FAILED") return "label-red";
  return "label-gray";
}

function formatCount(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item).trim())
    .filter(Boolean);
}

function recipientStatusText(status: string) {
  if (status === "WAITING" || status === "REQUESTED") return "대기";
  if (status === "IN_PROGRESS" || status === "PROCESSING") return "진행 중";
  if (status === "SENT_TO_PROVIDER") return "발송 접수";
  if (status === "LOOKUP_FAILED") return "조회 실패";
  if (status === "ACCEPTED") return "대기";
  if (status === "DELIVERED") return "전달 완료";
  if (status === "DELIVERY_FAILED" || status === "FAILED") return "실패";
  return status;
}

function recipientStatusClass(status: string) {
  if (status === "SENT_TO_PROVIDER") return "label-blue";
  if (status === "IN_PROGRESS" || status === "PROCESSING") return "label-blue";
  if (status === "WAITING" || status === "REQUESTED" || status === "ACCEPTED") return "label-gray";
  if (status === "LOOKUP_FAILED") return "label-yellow";
  if (status === "DELIVERED") return "label-green";
  if (status === "DELIVERY_FAILED" || status === "FAILED") return "label-red";
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

  const completed =
    campaign.recipientStats.submittedCount +
    campaign.recipientStats.deliveredCount +
    campaign.recipientStats.failedCount;
  return Math.round((completed / campaign.recipientStats.totalCount) * 100);
}
