"use client";

import { useState, useEffectEvent } from "react";
import { useRouter } from "next/navigation";
import { AppIcon } from "@/components/icons/AppIcon";
import { SkeletonStatGrid, SkeletonTableBox } from "@/components/loading/PageSkeleton";
import { fetchV2LogDetail, type V2LogDetailResponse, type V2LogsResponse } from "@/lib/api/v2";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";
import { buildCampaignDetailPath } from "@/lib/routes";
import { useAppStore } from "@/lib/store/app-store";

type LogsPageProps = {
  data: V2LogsResponse | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
};

export function LogsPage({ data, loading, error, onRefresh }: LogsPageProps) {
  const router = useRouter();
  const showDraftToast = useAppStore((state) => state.showDraftToast);
  const items = data?.items ?? [];
  const statusCounts = data?.summary.statusCounts ?? {};
  const deliveredCount = countStatuses(statusCounts, ["DELIVERED"]);
  const failedCount = countStatuses(statusCounts, ["DELIVERY_FAILED", "SEND_FAILED", "DEAD", "LOOKUP_FAILED", "FAILED", "PARTIAL_FAILED"]);
  const waitingCount = countStatuses(statusCounts, ["WAITING"]);
  const inProgressCount = countStatuses(statusCounts, ["IN_PROGRESS", "SENT_TO_PROVIDER"]);
  const showLoadingNotice = Boolean(loading && !data);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<V2LogDetailResponse | null>(null);

  const openCampaignDetail = (item: V2LogsResponse["items"][number]) => {
    if (item.kind !== "campaign" || !item.campaignChannel) {
      return;
    }

    router.push(buildCampaignDetailPath(item.campaignChannel, item.id, { from: "logs" }));
  };

  const openDetail = async (requestId: string) => {
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
  };

  const closeDetail = () => {
    setDrawerOpen(false);
    setSelectedRequestId(null);
    setDetailLoading(false);
    setDetailError(null);
    setDetail(null);
  };

  if (showLoadingNotice) {
    return (
      <>
        <div className="page-header">
          <div className="page-header-row">
            <div>
              <div className="page-title">발송 기록</div>
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
            <div className="page-title">발송 기록</div>
            <div className="page-desc">보낸 메시지와 처리 결과를 확인합니다</div>
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
        <div className="stats-grid logs-stats-grid">
          <div className="stat-cell">
            <div className="stat-label-t">전체</div>
            <div className="stat-value-t">{data?.summary.totalCount ?? 0}</div>
            <div className="stat-sub-t">최근 조회 범위</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label-t">예약됨</div>
            <div className="stat-value-t" style={{ color: "var(--attention-fg)" }}>{waitingCount}</div>
            <div className="stat-sub-t">예약 발송</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label-t">처리 중</div>
            <div className="stat-value-t" style={{ color: "var(--accent-emphasis)" }}>{inProgressCount}</div>
            <div className="stat-sub-t">전송/확인 중</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label-t">완료</div>
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

      <div className="box">
        {items.length > 0 ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>기록 ID</th>
                  <th>발송 정보</th>
                  <th>채널</th>
                  <th>수신자</th>
                  <th>현재 상태</th>
                  <th>발송 시각</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="td-mono">{shortId(item.id)}</td>
                    <td>
                      <div className="table-title-text">
                        {item.kind === "campaign" ? item.title || eventLabel(item.eventKey, item.providerChannel) : eventLabel(item.eventKey, item.providerChannel)}
                      </div>
                      <div className="table-subtext td-mono">
                        {item.kind === "campaign" ? eventLabel(item.eventKey, item.providerChannel) : item.eventKey || "manual.send"}
                      </div>
                      {item.lastErrorCode ? <div className="table-subtext">오류 코드: {item.lastErrorCode}</div> : null}
                    </td>
                    <td>{renderLogChannel(item.channel, item.providerChannel, item.messageType, item.kind)}</td>
                    <td className="td-mono">
                      {item.kind === "campaign"
                        ? `${formatCount(item.recipientCount ?? 0)}명`
                        : item.recipientPhone || "—"}
                    </td>
                    <td>
                      <span className={`label ${requestStatusClass(item.status)}`}>
                        <span className="label-dot" />
                        {requestStatusText(item.status)}
                      </span>
                    </td>
                    <td className="td-muted text-small">{formatShortDateTime(item.createdAt)}</td>
                    <td>
                      <button
                        className="btn btn-default btn-sm"
                        onClick={() => {
                          if (item.kind === "campaign") {
                            openCampaignDetail(item);
                            return;
                          }
                          void openDetail(item.id);
                        }}
                      >
                        {item.kind === "campaign" ? "상세" : "보기"}
                      </button>
                    </td>
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

      <LogDetailDrawer
        open={drawerOpen}
        requestId={selectedRequestId}
        detail={detail}
        loading={detailLoading}
        error={detailError}
        onClose={closeDetail}
      />
    </>
  );
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

function renderLogChannel(
  channel: "sms" | "kakao" | null,
  providerChannel: "SMS" | "ALIMTALK" | "BRAND_MESSAGE" | null,
  messageType: string | null,
  kind: "message" | "campaign"
) {
  if (providerChannel === "BRAND_MESSAGE") {
    return (
      <div className="log-channel-stack">
        <span className="chip chip-brand">{kind === "campaign" ? "브랜드 메시지 대량" : "브랜드 메시지"}</span>
        {messageType ? <span className="chip chip-event">{messageTypeLabel(messageType)}</span> : null}
      </div>
    );
  }

  if (channel === "sms") {
    const smsLabel = kind === "campaign" ? "SMS 대량" : messageTypeLabel(messageType);
    return <span className="chip chip-sms">{smsLabel}</span>;
  }

  if (channel === "kakao") {
    return <span className="chip chip-kakao">{kind === "campaign" ? "알림톡 대량" : "알림톡"}</span>;
  }

  return <span className="td-muted">—</span>;
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
  onClose,
}: {
  open: boolean;
  requestId: string | null;
  detail: V2LogDetailResponse | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const handleEscape = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape") {
      onClose();
    }
  });

  useMountEffect(() => {
    const onKeydown = (event: KeyboardEvent) => handleEscape(event);
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  });

  if (!open) {
    return null;
  }

  return (
    <div className="template-detail-backdrop" onClick={onClose}>
      <aside className="template-detail-drawer" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="발송 로그 보기">
        <div className="template-detail-header">
          <div>
            <div className="template-detail-eyebrow">발송 로그</div>
            <div className="template-detail-title">
              {detail ? eventLabel(detail.eventKey, detail.providerChannel) : requestId ? `요청 ${shortId(requestId)}` : "상세 보기"}
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="발송 로그 닫기">
            <AppIcon name="x" className="icon icon-18" />
          </button>
        </div>

        <div className="template-detail-body">
          {loading ? (
            <div className="box">
              <div className="box-body">
                <div className="text-small text-muted">발송 로그 상세를 불러오는 중입니다.</div>
              </div>
            </div>
          ) : null}

          {!loading && error ? (
            <div className="flash flash-attention">
              <AppIcon name="warn" className="icon icon-16 flash-icon" />
              <div className="flash-body">{error}</div>
            </div>
          ) : null}

          {!loading && !error && detail ? (
            <div className="template-detail-stack">
              <div className="box">
                <div className="box-header">
                  <div>
                    <div className="box-title">{eventLabel(detail.eventKey, detail.providerChannel)}</div>
                    <div className="box-subtitle">{statusSummary(detail)}</div>
                  </div>
                  <span className={`label ${requestStatusClass(detail.status)}`}>
                    <span className="label-dot" />
                    {requestStatusText(detail.status)}
                  </span>
                </div>
                <div className="box-body">
                  <div className="template-detail-meta-grid">
                    <MetaField label="요청 ID" value={detail.id} mono />
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
                  </div>
                  <div className="template-detail-meta-grid template-detail-meta-grid-tight">
                    <MetaField label="메시지 타입" value={messageTypeLabel(detail.messageType)} />
                    <MetaField label="예약 시각" value={detail.scheduledAt ? formatShortDateTime(detail.scheduledAt) : "즉시 발송"} />
                    <MetaField label="요청 시각" value={formatShortDateTime(detail.createdAt)} />
                    <MetaField label="최근 갱신" value={formatShortDateTime(detail.updatedAt)} />
                  </div>
                </div>
              </div>

              {detail.manualBody ? (
                <div className="box">
                  <div className="box-header">
                    <div className="box-title">본문</div>
                  </div>
                  <div className="box-body">
                    <pre className="template-detail-pre">{detail.manualBody}</pre>
                  </div>
                </div>
              ) : null}

              {detail.providerChannel === "BRAND_MESSAGE" && detail.brandMessage ? (
                <div className="box">
                  <div className="box-header">
                    <div className="box-title">브랜드 메시지 설정</div>
                  </div>
                  <div className="box-body">
                    <div className="template-detail-meta-grid">
                      <MetaField label="모드" value={detail.brandMessage.mode || "—"} />
                      <MetaField label="타겟팅" value={detail.brandMessage.targeting || "—"} />
                      <MetaField label="푸시 알람" value={detail.brandMessage.pushAlarm ? "활성화" : "비활성화"} />
                      <MetaField label="성인용" value={detail.brandMessage.adult ? "예" : "아니오"} />
                    </div>
                    <div className="template-detail-meta-grid template-detail-meta-grid-tight">
                      <MetaField label="통계 이벤트 키" value={detail.brandMessage.statsEventKey || detail.brandMessage.statsId || "—"} mono />
                      <MetaField label="재판매사 식별코드" value={detail.brandMessage.resellerCode || "—"} mono />
                    </div>

                    {detail.brandMessage.image?.imageUrl ? (
                      <div className="template-detail-section">
                        <div className="template-detail-section-title">이미지</div>
                        <div className="log-detail-image-wrap">
                          <img
                            src={detail.brandMessage.image.imageUrl}
                            alt="브랜드 메시지 이미지"
                            className="log-detail-image"
                          />
                        </div>
                        <div className="template-action-links" style={{ marginTop: 12 }}>
                          <div className="template-action-meta">
                            <div className="template-action-meta-label">이미지 URL</div>
                            <div className="template-action-meta-value mono">{detail.brandMessage.image.imageUrl}</div>
                          </div>
                          <div className="template-action-meta">
                            <div className="template-action-meta-label">이미지 링크</div>
                            <div className="template-action-meta-value mono">{detail.brandMessage.image.imageLink || "미설정"}</div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {(detail.brandMessage.buttons?.length ?? 0) > 0 ? (
                      <div className="template-detail-section">
                        <div className="template-detail-section-title">버튼</div>
                        <div className="template-action-list">
                          {detail.brandMessage.buttons?.map((button, index) => (
                            <div key={`${button.type || "button"}-${button.name || index}`} className="box-row template-action-row">
                              <div className="box-row-content">
                                <div className="box-row-title">{button.name || `버튼 ${index + 1}`}</div>
                                <div className="box-row-desc">{button.type || "—"}</div>
                                <div className="template-action-links">
                                  <div className="template-action-meta">
                                    <div className="template-action-meta-label">모바일 링크</div>
                                    <div className="template-action-meta-value mono">{button.linkMo || "—"}</div>
                                  </div>
                                  <div className="template-action-meta">
                                    <div className="template-action-meta-label">PC 링크</div>
                                    <div className="template-action-meta-value mono">{button.linkPc || "—"}</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="box">
                <div className="box-header">
                  <div className="box-title">전달 결과</div>
                </div>
                <div className="box-body">
                  {detail.deliveryResults.length > 0 ? (
                    <div className="template-action-list">
                      {detail.deliveryResults.map((result) => (
                        <div key={result.id} className="box-row template-action-row">
                          <div className="box-row-content">
                            <div className="box-row-title">{result.providerStatus}</div>
                            <div className="box-row-desc">{formatShortDateTime(result.createdAt)}</div>
                            <div className="template-action-links">
                              <div className="template-action-meta">
                                <div className="template-action-meta-label">코드</div>
                                <div className="template-action-meta-value mono">{result.providerCode || "—"}</div>
                              </div>
                              <div className="template-action-meta">
                                <div className="template-action-meta-label">메시지</div>
                                <div className="template-action-meta-value">{result.providerMessage || "—"}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="template-detail-empty-inline">아직 전달 결과가 없습니다.</div>
                  )}
                </div>
              </div>

              <div className="box">
                <div className="box-header">
                  <div className="box-title">시도 이력</div>
                </div>
                <div className="box-body">
                  {detail.attempts.length > 0 ? (
                    <div className="template-action-list">
                      {detail.attempts.map((attempt) => (
                        <div key={attempt.id} className="box-row template-action-row">
                          <div className="box-row-content">
                            <div className="box-row-title">{attempt.attemptNumber}차 시도</div>
                            <div className="box-row-desc">{formatShortDateTime(attempt.createdAt)}</div>
                            <div className="template-action-links">
                              <div className="template-action-meta">
                                <div className="template-action-meta-label">오류 코드</div>
                                <div className="template-action-meta-value mono">{attempt.errorCode || "—"}</div>
                              </div>
                              <div className="template-action-meta">
                                <div className="template-action-meta-label">오류 메시지</div>
                                <div className="template-action-meta-value">{attempt.errorMessage || "—"}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="template-detail-empty-inline">아직 시도 이력이 없습니다.</div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function MetaField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="template-detail-meta-field">
      <div className="template-detail-meta-label">{label}</div>
      <div className={`template-detail-meta-value${mono ? " mono" : ""}`}>{value}</div>
    </div>
  );
}
