"use client";

import { useEffect, useState } from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import { SkeletonStatGrid, SkeletonTableBox } from "@/components/loading/PageSkeleton";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";
import { useAppStore } from "@/lib/store/app-store";
import {
  approveV2OpsSms080Application,
  fetchV2OpsSms080Applications,
  rejectV2OpsSms080Application,
  type V2OpsSms080ApplicationsResponse,
} from "@/lib/api/v2";

type Sms080OpsItem = V2OpsSms080ApplicationsResponse["items"][number];

export function Sms080OpsTab() {
  const showDraftToast = useAppStore((state) => state.showDraftToast);
  const [data, setData] = useState<V2OpsSms080ApplicationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewMemo, setReviewMemo] = useState("");
  const [approveNumber, setApproveNumber] = useState("");
  const [submittingAction, setSubmittingAction] = useState<"approve" | "reject" | null>(null);

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedId(null);
    setReviewMemo("");
    setApproveNumber("");
    setSubmittingAction(null);
  };

  const loadApplications = async (options?: {
    background?: boolean;
    preserveSelection?: boolean;
    keepDraft?: boolean;
  }) => {
    const preserveSelection = options?.preserveSelection ?? false;
    const keepDraft = options?.keepDraft ?? false;
    const currentSelectedId = selectedId;
    const currentReviewMemo = reviewMemo;
    const currentApproveNumber = approveNumber;

    if (options?.background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const next = await fetchV2OpsSms080Applications();
      setData(next);

      if (preserveSelection && currentSelectedId) {
        const nextSelected = next.items.find((item) => item.id === currentSelectedId) ?? null;

        if (nextSelected) {
          setSelectedId(nextSelected.id);
          setDrawerOpen(true);
          setReviewMemo(keepDraft ? currentReviewMemo : nextSelected.reviewMemo || "");
          setApproveNumber(keepDraft ? currentApproveNumber : nextSelected.unsubscribeNumber ? format080Number(nextSelected.unsubscribeNumber) : "");
        } else {
          closeDrawer();
        }
      }
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "080 신청 목록을 불러오지 못했습니다.";
      setError(message);
      if (options?.background) {
        showDraftToast(message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useMountEffect(() => {
    void loadApplications();
  });

  const selectedItem = data?.items.find((item) => item.id === selectedId) ?? null;
  const hasData = Boolean(data);
  const resolvedData = data;

  const openDrawer = (item: Sms080OpsItem) => {
    setSelectedId(item.id);
    setReviewMemo(item.reviewMemo || "");
    setApproveNumber(item.unsubscribeNumber ? format080Number(item.unsubscribeNumber) : "");
    setDrawerOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedItem || submittingAction) {
      return;
    }

    const normalizedApproveNumber = normalizePhoneNumber(approveNumber);

    if (selectedItem.type === "NHN_MANAGED" && !/^080\d{7,8}$/.test(normalizedApproveNumber)) {
      showDraftToast("승인할 080 번호를 입력해 주세요.");
      return;
    }

    setSubmittingAction("approve");

    try {
      await approveV2OpsSms080Application(selectedItem.id, {
        memo: reviewMemo.trim() || undefined,
        unsubscribeNumber: normalizedApproveNumber || undefined,
      });
      showDraftToast("080 신청을 승인 처리했습니다.");
      await loadApplications({ background: true, preserveSelection: true, keepDraft: false });
    } catch (actionError) {
      showDraftToast(actionError instanceof Error ? actionError.message : "승인 처리에 실패했습니다.");
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleReject = async () => {
    if (!selectedItem || submittingAction) {
      return;
    }

    setSubmittingAction("reject");

    try {
      await rejectV2OpsSms080Application(selectedItem.id, reviewMemo.trim() || undefined);
      showDraftToast("080 신청을 거절 처리했습니다.");
      await loadApplications({ background: true, preserveSelection: true, keepDraft: false });
    } catch (actionError) {
      showDraftToast(actionError instanceof Error ? actionError.message : "거절 처리에 실패했습니다.");
    } finally {
      setSubmittingAction(null);
    }
  };

  return (
    <>
      {loading && !hasData ? (
        <>
          <SkeletonStatGrid columns={6} />
          <SkeletonTableBox titleWidth={140} rows={6} columns={["1fr", "0.9fr", "1.1fr", "1fr", "0.8fr", "0.9fr", "80px"]} />
        </>
      ) : null}

      {!loading && error && !hasData ? (
        <div className="flash flash-attention">
          <AppIcon name="warn" className="icon icon-16 flash-icon" />
          <div className="flash-body">{error}</div>
          <div className="flash-actions">
            <button className="btn btn-default btn-sm" onClick={() => void loadApplications()}>
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
                <div className="box-title">080 수신거부 신청 현황</div>
                <div className="box-subtitle">신규 신청과 보유 번호 등록 요청을 검수하고, 승인 시 번호를 사용자에게 귀속합니다.</div>
              </div>
              <button
                className="btn btn-default btn-sm"
                onClick={() => void loadApplications({ background: true, preserveSelection: drawerOpen, keepDraft: true })}
              >
                <AppIcon name="refresh" className={`icon icon-14${refreshing ? " spin" : ""}`} />
                새로고침
              </button>
            </div>
            <div className="box-body" style={{ padding: 0 }}>
              <div className="ops-summary-grid">
                <SummaryStat label="전체 신청" value={String(resolvedData.summary.totalCount)} />
                <SummaryStat label="접수됨" value={String(resolvedData.summary.submittedCount)} />
                <SummaryStat label="내부 승인" value={String(resolvedData.summary.approvedCount)} tone="success" />
                <SummaryStat label="내부 거절" value={String(resolvedData.summary.rejectedCount)} tone="danger" />
                <SummaryStat label="신규 신청" value={String(resolvedData.summary.managedCount)} />
                <SummaryStat label="보유 번호" value={String(resolvedData.summary.externalCount)} />
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
                    <th>080 번호</th>
                    <th>신청 유형</th>
                    <th>소속 계정</th>
                    <th>업체명</th>
                    <th>상태</th>
                    <th>신청일</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {resolvedData.items.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="empty-state">
                          <div className="empty-icon">
                            <AppIcon name="phone" className="icon icon-40" />
                          </div>
                          <div className="empty-title">080 신청이 없습니다</div>
                          <div className="empty-desc">아직 접수된 신규 신청 또는 보유 번호 등록 요청이 없습니다.</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    resolvedData.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="table-title-text td-mono">
                            {item.unsubscribeNumber ? format080Number(item.unsubscribeNumber) : "승인 후 배정"}
                          </div>
                          <div className="table-subtext">{item.providerName || providerFallbackText(item.type)}</div>
                        </td>
                        <td>{serviceTypeText(item.type)}</td>
                        <td>
                          <div className="table-title-text">{item.userLabel}</div>
                          <div className="table-subtext">등록 사용자</div>
                        </td>
                        <td>{item.businessName}</td>
                        <td>
                          <span className={`label ${serviceStatusClass(item.status)}`}>
                            <span className="label-dot" />
                            {serviceStatusText(item.status)}
                          </span>
                        </td>
                        <td className="td-muted text-small">{formatShortDate(item.createdAt)}</td>
                        <td>
                          <button className="btn btn-default btn-sm" onClick={() => openDrawer(item)}>
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

      <Sms080OpsDrawer
        open={drawerOpen}
        item={selectedItem}
        reviewMemo={reviewMemo}
        approveNumber={approveNumber}
        submittingAction={submittingAction}
        onChangeReviewMemo={setReviewMemo}
        onChangeApproveNumber={setApproveNumber}
        onApprove={handleApprove}
        onReject={handleReject}
        onClose={closeDrawer}
      />
    </>
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

function Sms080OpsDrawer({
  open,
  item,
  reviewMemo,
  approveNumber,
  submittingAction,
  onChangeReviewMemo,
  onChangeApproveNumber,
  onApprove,
  onReject,
  onClose,
}: {
  open: boolean;
  item: Sms080OpsItem | null;
  reviewMemo: string;
  approveNumber: string;
  submittingAction: "approve" | "reject" | null;
  onChangeReviewMemo: (value: string) => void;
  onChangeApproveNumber: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, [onClose, open]);

  if (!open || !item) {
    return null;
  }

  const canApprove = item.status !== "APPROVED";
  const canReject = item.status !== "REJECTED";
  const reviewedAt = resolveReviewedAt(item);

  return (
    <div className="template-detail-backdrop" onClick={onClose}>
      <aside className="template-detail-drawer" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="080 신청 보기">
        <div className="template-detail-header">
          <div>
            <div className="template-detail-eyebrow">080 수신거부 신청</div>
            <div className="template-detail-title">{item.unsubscribeNumber ? format080Number(item.unsubscribeNumber) : "신규 번호 신청"}</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="080 신청 보기 닫기">
            <AppIcon name="x" className="icon icon-18" />
          </button>
        </div>

        <div className="template-detail-body">
          <div className="template-detail-stack">
            <div className="box">
              <div className="box-header">
                <div>
                  <div className="box-title">{item.userLabel}</div>
                  <div className="box-subtitle">신청 기본 정보와 현재 검수 상태입니다.</div>
                </div>
                <div className="ops-drawer-status">
                  <span className={`label ${serviceStatusClass(item.status)}`}>
                    <span className="label-dot" />
                    {serviceStatusText(item.status)}
                  </span>
                </div>
              </div>
              <div className="box-body">
                <div className="template-detail-meta-grid">
                  <MetaField label="신청 유형" value={serviceTypeText(item.type)} />
                  <MetaField label="080 번호" value={item.unsubscribeNumber ? format080Number(item.unsubscribeNumber) : "승인 후 배정"} mono />
                  <MetaField label="업체명" value={item.businessName} />
                  <MetaField label="제공 업체" value={item.providerName || providerFallbackText(item.type)} />
                </div>
                <div className="template-detail-meta-grid template-detail-meta-grid-tight">
                  <MetaField label="신청일" value={formatShortDateTime(item.createdAt)} />
                  <MetaField label="최근 변경일" value={formatShortDateTime(item.updatedAt)} />
                  <MetaField label="내부 검토자" value={item.reviewedBy || "—"} mono />
                  <MetaField label={reviewedAtLabel(item.status)} value={reviewedAt ? formatShortDateTime(reviewedAt) : "—"} />
                </div>
                {item.status === "REJECTED" && item.reviewMemo ? (
                  <div className="template-detail-section">
                    <div className="template-detail-section-title">거절 사유</div>
                    <div className="ops-detail-note ops-detail-note-danger">{item.reviewMemo}</div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="box">
              <div className="box-header">
                <div>
                  <div className="box-title">내부 검토 처리</div>
                  <div className="box-subtitle">신규 신청은 승인 시 080 번호를 배정하고, 보유 번호는 제출된 번호를 확인 후 승인합니다.</div>
                </div>
              </div>
              <div className="box-body">
                {item.type === "NHN_MANAGED" ? (
                  <div className="form-group">
                    <label className="form-label" htmlFor="ops-sms080-approve-number">
                      배정할 080 번호
                    </label>
                    <input
                      id="ops-sms080-approve-number"
                      className="form-control"
                      value={approveNumber}
                      placeholder="080-0000-0000"
                      onChange={(event) => onChangeApproveNumber(event.target.value)}
                      disabled={item.status === "APPROVED"}
                    />
                    <div className="form-hint">승인 처리하면 이 번호가 사용자 080 번호로 귀속됩니다.</div>
                  </div>
                ) : (
                  <div className="ops-detail-note">
                    보유 080 번호는 승인 후 광고 문자 문구에 사용할 수 있지만, 수신거부 목록은 외부 제공 업체에서 직접 확인해야 합니다.
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="ops-sms080-review-memo">
                    검토 메모
                  </label>
                  <textarea
                    id="ops-sms080-review-memo"
                    className="form-control"
                    value={reviewMemo}
                    onChange={(event) => onChangeReviewMemo(event.target.value)}
                    placeholder="거절 사유 또는 내부 검토 메모를 남겨 주세요."
                  />
                  <div className="form-hint">거절 처리 시 이 메모가 유저에게 표시됩니다.</div>
                </div>

                <div className="ops-review-actions">
                  <button className="btn btn-danger" onClick={onReject} disabled={!canReject || Boolean(submittingAction)}>
                    <AppIcon name="x-circle" className="icon icon-14" />
                    {submittingAction === "reject" ? "거절 중..." : "거절"}
                  </button>
                  <button className="btn btn-primary" onClick={onApprove} disabled={!canApprove || Boolean(submittingAction)}>
                    <AppIcon name="check-circle" className="icon icon-14" />
                    {submittingAction === "approve" ? "승인 중..." : "승인"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
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

function serviceTypeText(value: string) {
  if (value === "NHN_MANAGED") {
    return "080 신규 신청";
  }

  if (value === "EXTERNAL") {
    return "보유 번호 등록";
  }

  return value;
}

function providerFallbackText(value: string) {
  if (value === "NHN_MANAGED") {
    return "NHN Cloud";
  }

  return "외부 080 제공 업체";
}

function serviceStatusText(value: string) {
  if (value === "SUBMITTED") {
    return "접수됨";
  }

  if (value === "APPROVED") {
    return "내부 승인";
  }

  if (value === "REJECTED") {
    return "내부 거절";
  }

  return value;
}

function serviceStatusClass(value: string) {
  if (value === "APPROVED") {
    return "label-green";
  }

  if (value === "REJECTED") {
    return "label-red";
  }

  if (value === "SUBMITTED") {
    return "label-blue";
  }

  return "label-gray";
}

function normalizePhoneNumber(value: string) {
  return value.replace(/\D/g, "");
}

function format080Number(value: string) {
  const digits = normalizePhoneNumber(value);

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  return value;
}

function formatShortDate(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatShortDateTime(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function reviewedAtLabel(status: Sms080OpsItem["status"]) {
  if (status === "APPROVED") {
    return "승인일";
  }

  if (status === "REJECTED") {
    return "거절일";
  }

  return "검토일";
}

function resolveReviewedAt(item: Sms080OpsItem) {
  if (item.status === "APPROVED") {
    return item.approvedAt;
  }

  if (item.reviewedBy) {
    return item.updatedAt;
  }

  return null;
}
