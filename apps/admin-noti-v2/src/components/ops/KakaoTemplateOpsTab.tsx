"use client";

import { useState, useEffectEvent } from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import { SkeletonStatGrid, SkeletonTableBox } from "@/components/loading/PageSkeleton";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";
import { useAppStore } from "@/lib/store/app-store";
import {
  fetchV2OpsKakaoTemplateApplications,
  fetchV2OpsKakaoTemplateDetail,
  type V2OpsKakaoTemplateApplicationsResponse,
  type V2OpsKakaoTemplateDetailResponse,
} from "@/lib/api/v2";

type KakaoTemplateOpsItem = V2OpsKakaoTemplateApplicationsResponse["items"][number];

export function KakaoTemplateOpsTab() {
  const showDraftToast = useAppStore((state) => state.showDraftToast);
  const [data, setData] = useState<V2OpsKakaoTemplateApplicationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<KakaoTemplateOpsItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<V2OpsKakaoTemplateDetailResponse | null>(null);

  const loadTemplates = async (background = false) => {
    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const next = await fetchV2OpsKakaoTemplateApplications();
      setData(next);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "알림톡 템플릿 현황을 불러오지 못했습니다.";
      setError(message);
      if (background) {
        showDraftToast(message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useMountEffect(() => {
    void loadTemplates();
  });

  const openDetail = async (item: KakaoTemplateOpsItem) => {
    if (!item.senderKey || !(item.templateCode || item.kakaoTemplateCode)) {
      showDraftToast("템플릿 상세 정보를 열 수 없습니다.");
      return;
    }

    setSelectedItem(item);
    setDrawerOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);

    try {
      const nextDetail = await fetchV2OpsKakaoTemplateDetail({
        senderKey: item.senderKey,
        templateCode: item.templateCode || item.kakaoTemplateCode || "",
        tenantId: item.tenantId,
        source: item.source,
      });
      setDetail(nextDetail);
    } catch (fetchError) {
      setDetailError(fetchError instanceof Error ? fetchError.message : "템플릿 상세를 불러오지 못했습니다.");
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedItem(null);
    setDetail(null);
    setDetailLoading(false);
    setDetailError(null);
  };

  const hasData = Boolean(data);
  const resolvedData = data;

  return (
    <>
      {loading && !hasData ? (
        <>
          <SkeletonStatGrid columns={6} />
          <SkeletonTableBox titleWidth={160} rows={6} columns={["1.4fr", "1fr", "1fr", "0.9fr", "0.8fr", "0.9fr", "90px"]} />
        </>
      ) : null}

      {!loading && error && !hasData ? (
        <div className="flash flash-attention">
          <AppIcon name="warn" className="icon icon-16 flash-icon" />
          <div className="flash-body">{error}</div>
          <div className="flash-actions">
            <button className="btn btn-default btn-sm" onClick={() => void loadTemplates()}>
              <AppIcon name="refresh" className="icon icon-14" />
              다시 불러오기
            </button>
          </div>
        </div>
      ) : null}

      {resolvedData ? (
        <>
          <div className="box">
            <div className="box-header">
              <div>
                <div className="box-title">알림톡 템플릿 현황</div>
                <div className="box-subtitle">연결된 채널과 기본 그룹의 템플릿 상태를 외부 원본 기준으로 검수합니다.</div>
              </div>
              <button className="btn btn-default btn-sm" onClick={() => void loadTemplates(true)}>
                <AppIcon name="refresh" className={`icon icon-14${refreshing ? " spin" : ""}`} />
                새로고침
              </button>
            </div>
            <div className="box-body" style={{ padding: 0 }}>
              <div className="ops-summary-grid">
                <SummaryStat label="전체 템플릿" value={String(resolvedData.summary.totalCount)} />
                <SummaryStat label="승인됨" value={String(resolvedData.summary.approvedCount)} tone="success" />
                <SummaryStat label="검토 중" value={String(resolvedData.summary.pendingCount)} />
                <SummaryStat label="반려" value={String(resolvedData.summary.rejectedCount)} tone="danger" />
                <SummaryStat label="기본 그룹" value={String(resolvedData.summary.defaultGroupCount)} />
                <SummaryStat label="연결 채널" value={String(resolvedData.summary.connectedChannelCount)} />
              </div>
            </div>
          </div>

          {error ? (
            <div className="flash flash-attention">
              <AppIcon name="warn" className="icon icon-16 flash-icon" />
              <div className="flash-body">{error}</div>
            </div>
          ) : null}

          <div className="box">
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>템플릿명</th>
                    <th>테넌트</th>
                    <th>채널</th>
                    <th>상태</th>
                    <th>출처</th>
                    <th>등록일</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {resolvedData.items.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="empty-state">
                          <div className="empty-icon">
                            <AppIcon name="kakao" className="icon icon-40" />
                          </div>
                          <div className="empty-title">조회된 알림톡 템플릿이 없습니다</div>
                          <div className="empty-desc">연결된 채널이나 기본 그룹에서 템플릿을 찾지 못했습니다.</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    resolvedData.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="table-title-text">{item.name}</div>
                          <div className="table-subtext td-mono">{item.templateCode || item.kakaoTemplateCode || "—"}</div>
                        </td>
                        <td>
                          <div className="table-title-text">{item.tenantName}</div>
                          <div className="table-subtext td-mono">{item.tenantId ? item.tenantId.slice(0, 8) : "shared"}</div>
                        </td>
                        <td>
                          <div className="table-title-text">{item.ownerLabel}</div>
                          <div className="table-subtext">{messageTypeText(item.messageType)}</div>
                        </td>
                        <td>
                          <span className={`label ${providerStatusClass(item.providerStatus)}`}>
                            <span className="label-dot" />
                            {providerStatusText(item.providerStatus)}
                          </span>
                        </td>
                        <td className="td-muted">{sourceText(item.source)}</td>
                        <td className="td-muted text-small">{formatShortDate(item.createdAt || item.updatedAt)}</td>
                        <td>
                          <button className="btn btn-default btn-sm" onClick={() => void openDetail(item)}>
                            보기
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      <KakaoTemplateOpsDrawer
        open={drawerOpen}
        item={selectedItem}
        detail={detail}
        loading={detailLoading}
        error={detailError}
        onClose={closeDrawer}
      />
    </>
  );
}

function KakaoTemplateOpsDrawer({
  open,
  item,
  detail,
  loading,
  error,
  onClose,
}: {
  open: boolean;
  item: KakaoTemplateOpsItem | null;
  detail: V2OpsKakaoTemplateDetailResponse | null;
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

  if (!open || !item) {
    return null;
  }

  const resolvedDetail = detail?.template;

  return (
    <div className="template-detail-backdrop" onClick={onClose}>
      <aside className="template-detail-drawer" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="알림톡 템플릿 보기">
        <div className="template-detail-header">
          <div>
            <div className="template-detail-eyebrow">알림톡 템플릿</div>
            <div className="template-detail-title">{item.name}</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="알림톡 템플릿 보기 닫기">
            <AppIcon name="x" className="icon icon-18" />
          </button>
        </div>

        <div className="template-detail-body">
          <div className="template-detail-stack">
            {loading ? (
              <div className="box">
                <div className="box-body">
                  <div className="template-detail-loading-line wide" />
                  <div className="template-detail-loading-grid">
                    <div className="template-detail-loading-line" />
                    <div className="template-detail-loading-line" />
                    <div className="template-detail-loading-line" />
                    <div className="template-detail-loading-line" />
                  </div>
                  <div className="template-detail-loading-block" style={{ marginTop: 16 }} />
                </div>
              </div>
            ) : null}

            {!loading && error ? (
              <div className="flash flash-attention">
                <AppIcon name="warn" className="icon icon-16 flash-icon" />
                <div className="flash-body">{error}</div>
              </div>
            ) : null}

            {!loading && !error && resolvedDetail ? (
              <>
                <div className="box">
                  <div className="box-header">
                    <div>
                      <div className="box-title">{resolvedDetail.tenantName}</div>
                      <div className="box-subtitle">{resolvedDetail.ownerLabel}</div>
                    </div>
                    <div className="ops-drawer-status">
                      <span className={`label ${providerStatusClass(resolvedDetail.providerStatus)}`}>
                        <span className="label-dot" />
                        {providerStatusText(resolvedDetail.providerStatus)}
                      </span>
                    </div>
                  </div>
                  <div className="box-body">
                    <div className="template-detail-meta-grid">
                      <MetaField label="템플릿 코드" value={resolvedDetail.templateCode || resolvedDetail.kakaoTemplateCode || "—"} mono />
                      <MetaField label="출처" value={sourceText(resolvedDetail.source)} />
                      <MetaField label="채널" value={resolvedDetail.ownerLabel} />
                      <MetaField label="메시지 유형" value={messageTypeText(resolvedDetail.messageType)} />
                    </div>
                    <div className="template-detail-meta-grid template-detail-meta-grid-tight">
                      <MetaField label="강조 유형" value={emphasizeTypeText(resolvedDetail.emphasizeType)} />
                      <MetaField label="보안 템플릿" value={resolvedDetail.securityFlag ? "사용" : "사용 안 함"} />
                      <MetaField label="등록일" value={formatShortDateTime(resolvedDetail.createdAt)} />
                      <MetaField label="변경일" value={formatShortDateTime(resolvedDetail.updatedAt)} />
                    </div>
                    {resolvedDetail.providerStatusName ? (
                      <div className="template-detail-section">
                        <div className="template-detail-section-title">상태 설명</div>
                        <div className="ops-detail-note">{resolvedDetail.providerStatusName}</div>
                      </div>
                    ) : null}
                    <div className="template-detail-section">
                      <div className="template-detail-section-title">필수 변수</div>
                      {resolvedDetail.requiredVariables.length > 0 ? (
                        <div className="template-detail-chip-list">
                          {resolvedDetail.requiredVariables.map((value) => (
                            <span key={value} className="template-detail-chip">
                              #{`{${value}}`}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="template-detail-empty-inline">필수 변수 없음</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="box">
                  <div className="box-header">
                    <div className="box-title">메시지 미리보기</div>
                  </div>
                  <div className="box-body">
                    <div className="template-detail-preview-wrap">
                      <div className="kakao-phone">
                        <div className="kakao-phone-topbar">
                          <span />
                          <div className="kakao-phone-topbar-title">알림톡</div>
                          <span />
                        </div>
                        <div className="kakao-chat-area">
                          <div className="kakao-chat-header">
                            <span className="kakao-chat-header-badge">{resolvedDetail.ownerLabel}</span>
                          </div>
                          <div className="kakao-msg-row">
                            <div className="kakao-avatar">톡</div>
                            <div className="kakao-bubble-wrap">
                              <div className="kakao-sender-name">{resolvedDetail.ownerLabel}</div>
                              <div className="kakao-bubble">
                                {resolvedDetail.imageUrl ? (
                                  <div className="kakao-bubble-img">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={resolvedDetail.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                  </div>
                                ) : null}
                                {resolvedDetail.title ? <div className="kakao-bubble-title">{resolvedDetail.title}</div> : null}
                                {resolvedDetail.subtitle ? <div className="kakao-bubble-subtitle">{resolvedDetail.subtitle}</div> : null}
                                <div className="kakao-bubble-content">{resolvedDetail.body}</div>
                                {resolvedDetail.extra ? <div className="kakao-bubble-extra">{resolvedDetail.extra}</div> : null}
                                {resolvedDetail.buttons.length > 0 ? (
                                  <div className="kakao-btn-area">
                                    {resolvedDetail.buttons.map((button) => (
                                      <div key={`${button.ordering}-${button.type}-${button.name || "button"}`} className="kakao-btn-item">
                                        {button.name || button.type}
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                                {resolvedDetail.quickReplies.length > 0 ? (
                                  <div className="kakao-quick-area">
                                    {resolvedDetail.quickReplies.map((quickReply) => (
                                      <div
                                        key={`${quickReply.ordering}-${quickReply.type}-${quickReply.name || "quick"}`}
                                        className="kakao-quick-item"
                                      >
                                        {quickReply.name || quickReply.type}
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {resolvedDetail.comment ? (
                  <div className="box">
                    <div className="box-header">
                      <div className="box-title">검수 메모</div>
                    </div>
                    <div className="box-body">
                      <div className="ops-detail-note">{resolvedDetail.comment}</div>
                    </div>
                  </div>
                ) : null}

                {resolvedDetail.buttons.length > 0 ? (
                  <ActionListBox title="버튼" items={resolvedDetail.buttons} />
                ) : null}

                {resolvedDetail.quickReplies.length > 0 ? (
                  <ActionListBox title="바로연결" items={resolvedDetail.quickReplies} />
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger";
}) {
  return (
    <div className="ops-summary-cell">
      <div className="stat-label-t">{label}</div>
      <div className={`ops-summary-value${tone ? ` ${tone}` : ""}`}>{value}</div>
    </div>
  );
}

function MetaField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="template-detail-meta-field">
      <div className="template-detail-meta-label">{label}</div>
      <div className={`template-detail-meta-value${mono ? " mono" : ""}`}>{value}</div>
    </div>
  );
}

function ActionListBox({
  title,
  items,
}: {
  title: string;
  items: Array<{
    ordering: number;
    type: string;
    name?: string;
    linkMo?: string;
    linkPc?: string;
    schemeIos?: string;
    schemeAndroid?: string;
    bizFormId?: number;
    pluginId?: string;
    telNumber?: string;
  }>;
}) {
  return (
    <div className="box">
      <div className="box-header">
        <div className="box-title">{title}</div>
      </div>
      <div className="template-action-list">
        {items.map((item) => (
          <div key={`${item.ordering}-${item.type}-${item.name || "action"}`} className="box-row template-action-row">
            <div className="box-row-content">
              <div className="box-row-title">{item.name || actionTypeText(item.type)}</div>
              <div className="box-row-desc">{actionTypeText(item.type)}</div>
              <div className="template-action-links">
                {item.linkMo ? <ActionMeta label="Mobile URL" value={item.linkMo} /> : null}
                {item.linkPc ? <ActionMeta label="PC URL" value={item.linkPc} /> : null}
                {item.schemeIos ? <ActionMeta label="iOS Scheme" value={item.schemeIos} /> : null}
                {item.schemeAndroid ? <ActionMeta label="Android Scheme" value={item.schemeAndroid} /> : null}
                {item.telNumber ? <ActionMeta label="전화번호" value={item.telNumber} /> : null}
                {item.bizFormId ? <ActionMeta label="폼 ID" value={String(item.bizFormId)} mono /> : null}
                {item.pluginId ? <ActionMeta label="플러그인 ID" value={item.pluginId} mono /> : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionMeta({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="template-action-meta">
      <span className="template-action-meta-label">{label}</span>
      <span className={`template-action-meta-value${mono ? " mono" : ""}`}>{value}</span>
    </div>
  );
}

function sourceText(value: "DEFAULT_GROUP" | "SENDER_PROFILE") {
  return value === "DEFAULT_GROUP" ? "기본 그룹" : "연결 채널";
}

function actionTypeText(value: string) {
  if (value === "WL") return "웹 링크";
  if (value === "AL") return "앱 링크";
  if (value === "DS") return "배송 조회";
  if (value === "BK") return "봇 키워드";
  if (value === "MD") return "메시지 전달";
  if (value === "BT") return "상담톡 전환";
  if (value === "BF") return "비즈니스폼";
  if (value === "AC") return "채널 추가";
  if (value === "P1") return "개인화 플러그인";
  return value || "액션";
}

function providerStatusText(value: "APR" | "REQ" | "REJ") {
  if (value === "APR") {
    return "승인됨";
  }

  if (value === "REJ") {
    return "반려";
  }

  return "검토 중";
}

function providerStatusClass(value: "APR" | "REQ" | "REJ") {
  if (value === "APR") {
    return "label-green";
  }

  if (value === "REJ") {
    return "label-red";
  }

  return "label-blue";
}

function messageTypeText(value: string | null) {
  if (value === "BA") {
    return "기본";
  }

  if (value === "AD") {
    return "광고";
  }

  if (value === "EX") {
    return "복합";
  }

  if (value === "MI") {
    return "강조";
  }

  return value || "—";
}

function emphasizeTypeText(value: string | null) {
  if (value === "TEXT") {
    return "텍스트 강조";
  }

  if (value === "IMAGE") {
    return "이미지 강조";
  }

  if (value === "NONE") {
    return "기본";
  }

  return value || "—";
}

function formatShortDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function formatShortDateTime(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
