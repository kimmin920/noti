"use client";

import { useState, useEffectEvent } from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import { SkeletonStatGrid, SkeletonTableBox } from "@/components/loading/PageSkeleton";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";
import { useAppStore } from "@/lib/store/app-store";
import {
  approveV2OpsSenderNumberApplication,
  buildV2OpsSenderNumberAttachmentUrl,
  fetchV2OpsSenderNumberApplications,
  rejectV2OpsSenderNumberApplication,
  requestSupplementV2OpsSenderNumberApplication,
  type V2OpsSenderNumberApplicationsResponse,
  type V2OpsSenderNumberAttachmentKind,
} from "@/lib/api/v2";

const ATTACHMENT_ORDER: Array<{
  kind: V2OpsSenderNumberAttachmentKind;
  label: string;
}> = [
  { kind: "telecom", label: "통신사 증빙" },
  { kind: "consent", label: "이용승낙서" },
  { kind: "idCardCopy", label: "신분증 사본" },
  { kind: "personalInfoConsent", label: "개인정보 동의서(구 양식)" },
  { kind: "businessRegistration", label: "사업자등록증" },
  { kind: "relationshipProof", label: "관계 증빙" },
  { kind: "additional", label: "추가 서류" },
  { kind: "employment", label: "재직증명서" },
];

type SenderNumberOpsItem = V2OpsSenderNumberApplicationsResponse["items"][number];

export function SenderNumberOpsTab() {
  const showDraftToast = useAppStore((state) => state.showDraftToast);
  const [data, setData] = useState<V2OpsSenderNumberApplicationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewMemo, setReviewMemo] = useState("");
  const [submittingAction, setSubmittingAction] = useState<"approve" | "supplement" | "reject" | null>(null);

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedId(null);
    setReviewMemo("");
    setSubmittingAction(null);
  };

  const loadApplications = async (options?: {
    background?: boolean;
    preserveSelection?: boolean;
    keepDraftMemo?: boolean;
  }) => {
    const preserveSelection = options?.preserveSelection ?? false;
    const keepDraftMemo = options?.keepDraftMemo ?? false;
    const currentSelectedId = selectedId;
    const currentReviewMemo = reviewMemo;

    if (options?.background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const next = await fetchV2OpsSenderNumberApplications();
      setData(next);

      if (preserveSelection && currentSelectedId) {
        const nextSelected = next.items.find((item) => item.id === currentSelectedId) ?? null;

        if (nextSelected) {
          setSelectedId(nextSelected.id);
          setDrawerOpen(true);
          setReviewMemo(keepDraftMemo ? currentReviewMemo : nextSelected.reviewMemo || "");
        } else {
          closeDrawer();
        }
      }
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "발신번호 신청 목록을 불러오지 못했습니다.";
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

  const openDrawer = (item: SenderNumberOpsItem) => {
    setSelectedId(item.id);
    setReviewMemo(item.reviewMemo || "");
    setDrawerOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedItem || submittingAction) {
      return;
    }

    setSubmittingAction("approve");
    try {
      await approveV2OpsSenderNumberApplication(selectedItem.id, reviewMemo.trim() || undefined);
      showDraftToast("발신번호를 내부 승인 처리했습니다.");
      await loadApplications({ background: true, preserveSelection: true, keepDraftMemo: false });
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
      await rejectV2OpsSenderNumberApplication(selectedItem.id, reviewMemo.trim() || undefined);
      showDraftToast("발신번호를 내부 거절 처리했습니다.");
      await loadApplications({ background: true, preserveSelection: true, keepDraftMemo: false });
    } catch (actionError) {
      showDraftToast(actionError instanceof Error ? actionError.message : "거절 처리에 실패했습니다.");
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleRequestSupplement = async () => {
    if (!selectedItem || submittingAction) {
      return;
    }

    setSubmittingAction("supplement");
    try {
      await requestSupplementV2OpsSenderNumberApplication(selectedItem.id, reviewMemo.trim() || undefined);
      showDraftToast("발신번호를 서류 보완 요청 상태로 변경했습니다.");
      await loadApplications({ background: true, preserveSelection: true, keepDraftMemo: false });
    } catch (actionError) {
      showDraftToast(actionError instanceof Error ? actionError.message : "보완 요청 처리에 실패했습니다.");
    } finally {
      setSubmittingAction(null);
    }
  };

  return (
    <>
      {loading && !hasData ? (
        <>
          <SkeletonStatGrid columns={6} />
          <SkeletonTableBox titleWidth={140} rows={6} columns={["1.2fr", "1fr", "0.9fr", "0.95fr", "0.8fr", "0.9fr", "90px"]} />
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
                <div className="box-title">발신번호 신청 현황</div>
                <div className="box-subtitle">신청 정보와 외부 등록 상태를 함께 확인하고 내부 승인·거절을 처리합니다.</div>
              </div>
              <button
                className="btn btn-default btn-sm"
                onClick={() => void loadApplications({ background: true, preserveSelection: drawerOpen, keepDraftMemo: true })}
              >
                <AppIcon name="refresh" className={`icon icon-14${refreshing ? " spin" : ""}`} />
                새로고침
              </button>
            </div>
            <div className="box-body" style={{ padding: 0 }}>
              <div className="ops-summary-grid">
                <SummaryStat label="전체 신청" value={String(resolvedData.summary.totalCount)} />
                <SummaryStat label="접수됨" value={String(resolvedData.summary.submittedCount)} />
                <SummaryStat label="보완 요청" value={String(resolvedData.summary.supplementRequestedCount)} />
                <SummaryStat label="내부 승인" value={String(resolvedData.summary.approvedCount)} />
                <SummaryStat label="내부 거절" value={String(resolvedData.summary.rejectedCount)} />
                <SummaryStat label="외부 승인" value={String(resolvedData.summary.providerApprovedCount)} tone="success" />
                <SummaryStat label="외부 차단" value={String(resolvedData.summary.providerBlockedCount)} tone="danger" />
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
                    <th>발신번호</th>
                    <th>테넌트</th>
                    <th>내부 상태</th>
                    <th>외부 상태</th>
                    <th>첨부</th>
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
                          <div className="empty-title">발신번호 신청이 없습니다</div>
                          <div className="empty-desc">아직 접수된 발신번호 신청 건이 없어 운영 검수 목록이 비어 있습니다.</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    resolvedData.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="table-title-text td-mono">{formatPhone(item.phoneNumber)}</div>
                          <div className="table-subtext">{senderNumberTypeText(item.type)}</div>
                        </td>
                        <td>
                          <div className="table-title-text">{item.tenantName}</div>
                          <div className="table-subtext td-mono">{item.tenantId.slice(0, 8)}</div>
                        </td>
                        <td>
                          <span className={`label ${internalStatusClass(item.status)}`}>
                            <span className="label-dot" />
                            {internalStatusText(item.status)}
                          </span>
                        </td>
                        <td>
                          <span className={`label ${providerStatusClass(item.providerStatus)}`}>
                            <span className="label-dot" />
                            {providerStatusText(item.providerStatus)}
                          </span>
                          {item.providerStatus.blockReason ? <div className="table-subtext">사유: {item.providerStatus.blockReason}</div> : null}
                        </td>
                        <td>
                          <div className="table-title-text">{attachmentCount(item.attachments)}개</div>
                          <div className="table-subtext">{attachmentPreviewText(item.attachments)}</div>
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

      <SenderNumberOpsDrawer
        open={drawerOpen}
        item={selectedItem}
        reviewMemo={reviewMemo}
        submittingAction={submittingAction}
        onChangeReviewMemo={setReviewMemo}
        onApprove={handleApprove}
        onRequestSupplement={handleRequestSupplement}
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

function SenderNumberOpsDrawer({
  open,
  item,
  reviewMemo,
  submittingAction,
  onChangeReviewMemo,
  onApprove,
  onRequestSupplement,
  onReject,
  onClose,
}: {
  open: boolean;
  item: SenderNumberOpsItem | null;
  reviewMemo: string;
  submittingAction: "approve" | "supplement" | "reject" | null;
  onChangeReviewMemo: (value: string) => void;
  onApprove: () => void;
  onRequestSupplement: () => void;
  onReject: () => void;
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

  const downloadableKinds = ATTACHMENT_ORDER.filter(({ kind }) => item.attachments[kind]);
  const canApprove = item.providerStatus.approved && item.status !== "APPROVED";
  const canRequestSupplement = item.status !== "APPROVED";
  const canReject = item.status !== "REJECTED";
  const reviewedAt = resolveInternalReviewedAt(item);

  return (
    <div className="template-detail-backdrop" onClick={onClose}>
      <aside className="template-detail-drawer" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="발신번호 신청 보기">
        <div className="template-detail-header">
          <div>
            <div className="template-detail-eyebrow">발신번호 신청</div>
            <div className="template-detail-title">{formatPhone(item.phoneNumber)}</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="발신번호 신청 보기 닫기">
            <AppIcon name="x" className="icon icon-18" />
          </button>
        </div>

        <div className="template-detail-body">
          <div className="template-detail-stack">
            <div className="box">
              <div className="box-header">
                <div>
                  <div className="box-title">{item.tenantName}</div>
                  <div className="box-subtitle">신청 기본 정보와 현재 검수 상태입니다.</div>
                </div>
                <div className="ops-drawer-status">
                  <span className={`label ${internalStatusClass(item.status)}`}>
                    <span className="label-dot" />
                    {internalStatusText(item.status)}
                  </span>
                  <span className={`label ${providerStatusClass(item.providerStatus)}`}>
                    <span className="label-dot" />
                    {providerStatusText(item.providerStatus)}
                  </span>
                </div>
              </div>
              <div className="box-body">
                <div className="template-detail-meta-grid">
                  <MetaField label="발신번호" value={formatPhone(item.phoneNumber)} mono />
                  <MetaField label="번호 유형" value={senderNumberTypeText(item.type)} />
                  <MetaField label="신청일" value={formatShortDateTime(item.createdAt)} />
                  <MetaField label="최근 변경일" value={formatShortDateTime(item.updatedAt)} />
                </div>
                <div className="template-detail-meta-grid template-detail-meta-grid-tight">
                  <MetaField label="내부 검토자" value={item.reviewedBy || "—"} mono />
                  <MetaField
                    label={internalReviewedAtLabel(item.status)}
                    value={reviewedAt ? formatShortDateTime(reviewedAt) : "—"}
                  />
                  <MetaField label="외부 등록일" value={item.providerStatus.createdAt ? formatShortDateTime(item.providerStatus.createdAt) : "—"} />
                  <MetaField label="외부 변경일" value={item.providerStatus.updatedAt ? formatShortDateTime(item.providerStatus.updatedAt) : "—"} />
                </div>
                {item.providerStatus.blockReason ? (
                  <div className="template-detail-section">
                    <div className="template-detail-section-title">외부 차단 사유</div>
                    <div className="ops-detail-note ops-detail-note-danger">{item.providerStatus.blockReason}</div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="box">
              <div className="box-header">
                <div>
                  <div className="box-title">첨부 파일</div>
                  <div className="box-subtitle">신청 시 업로드된 서류를 내려받을 수 있습니다.</div>
                </div>
              </div>
              <div className="box-body">
                {downloadableKinds.length > 0 ? (
                  <div className="ops-attachment-list">
                    {downloadableKinds.map(({ kind, label }) => (
                      <a
                        key={kind}
                        className="ops-attachment-link"
                        href={buildV2OpsSenderNumberAttachmentUrl(item.id, kind)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <AppIcon name="download" className="icon icon-14" />
                        {label}
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="template-detail-empty-inline">첨부된 파일이 없습니다.</div>
                )}
              </div>
            </div>

            <div className="box">
              <div className="box-header">
                <div>
                  <div className="box-title">내부 검토 처리</div>
                  <div className="box-subtitle">승인, 보완 요청, 거절 처리와 함께 내부 메모를 남길 수 있습니다.</div>
                </div>
              </div>
              <div className="box-body">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="ops-review-memo">
                    검토 메모
                  </label>
                  <textarea
                    id="ops-review-memo"
                    className="form-control"
                    value={reviewMemo}
                    onChange={(event) => onChangeReviewMemo(event.target.value)}
                    placeholder="보완 요청 사유 또는 내부 검토 메모를 남겨 주세요."
                  />
                  <div className="form-hint">
                    외부 승인 상태가 확인된 번호는 내부 승인할 수 있습니다. 보완 요청 또는 거절 처리 시에는 이 메모가 유저에게 표시됩니다.
                  </div>
                </div>
                <div className="ops-review-actions">
                  <button className="btn btn-danger" onClick={onReject} disabled={!canReject || Boolean(submittingAction)}>
                    <AppIcon name="x-circle" className="icon icon-14" />
                    {submittingAction === "reject" ? "거절 중..." : "거절"}
                  </button>
                  <button className="btn btn-default" onClick={onRequestSupplement} disabled={!canRequestSupplement || Boolean(submittingAction)}>
                    <AppIcon name="warn" className="icon icon-14" />
                    {submittingAction === "supplement" ? "요청 중..." : "보완 요청"}
                  </button>
                  <button className="btn btn-primary" onClick={onApprove} disabled={!canApprove || Boolean(submittingAction)}>
                    <AppIcon name="check-circle" className="icon icon-14" />
                    {submittingAction === "approve" ? "승인 중..." : "승인"}
                  </button>
                </div>
                {!canApprove ? (
                  <div className="ops-detail-inline-note">외부 승인 상태가 확인된 번호만 내부 승인할 수 있습니다.</div>
                ) : null}
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

function attachmentCount(attachments: SenderNumberOpsItem["attachments"]) {
  return ATTACHMENT_ORDER.filter(({ kind }) => attachments[kind]).length;
}

function attachmentPreviewText(attachments: SenderNumberOpsItem["attachments"]) {
  const labels = ATTACHMENT_ORDER.filter(({ kind }) => attachments[kind]).map(({ label }) => label);

  if (labels.length === 0) {
    return "없음";
  }

  return labels.slice(0, 2).join(", ");
}

function senderNumberTypeText(value: string) {
  if (value === "COMPANY") {
    return "사업자 명의";
  }

  if (value === "EMPLOYEE") {
    return "타인 번호";
  }

  return value;
}

function internalStatusText(value: string) {
  if (value === "SUBMITTED") {
    return "접수됨";
  }

  if (value === "SUPPLEMENT_REQUESTED") {
    return "보완 요청";
  }

  if (value === "APPROVED") {
    return "내부 승인";
  }

  if (value === "REJECTED") {
    return "내부 거절";
  }

  if (value === "DRAFT") {
    return "임시 저장";
  }

  return value;
}

function internalStatusClass(value: string) {
  if (value === "APPROVED") {
    return "label-green";
  }

  if (value === "SUPPLEMENT_REQUESTED") {
    return "label-yellow";
  }

  if (value === "REJECTED") {
    return "label-red";
  }

  if (value === "SUBMITTED") {
    return "label-blue";
  }

  return "label-gray";
}

function providerStatusText(status: SenderNumberOpsItem["providerStatus"]) {
  if (status.approved) {
    return "외부 승인";
  }

  if (status.blocked) {
    return "외부 차단";
  }

  if (status.registered) {
    return "외부 등록";
  }

  return "미등록";
}

function providerStatusClass(status: SenderNumberOpsItem["providerStatus"]) {
  if (status.approved) {
    return "label-green";
  }

  if (status.blocked) {
    return "label-red";
  }

  if (status.registered) {
    return "label-blue";
  }

  return "label-gray";
}

function internalReviewedAtLabel(status: SenderNumberOpsItem["status"]) {
  if (status === "APPROVED") {
    return "내부 승인 시각";
  }

  if (status === "SUPPLEMENT_REQUESTED") {
    return "보완 요청 시각";
  }

  if (status === "REJECTED") {
    return "내부 거절 시각";
  }

  return "내부 처리 시각";
}

function resolveInternalReviewedAt(item: SenderNumberOpsItem) {
  if (item.status === "APPROVED") {
    return item.approvedAt;
  }

  if ((item.status === "SUPPLEMENT_REQUESTED" || item.status === "REJECTED") && item.reviewedBy) {
    return item.updatedAt;
  }

  return null;
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 8) {
    return digits.replace(/(\d{4})(\d{4})/, "$1-$2");
  }

  if (digits.length === 9) {
    return digits.replace(/(\d{2})(\d{3})(\d{4})/, "$1-$2-$3");
  }

  if (digits.length === 10) {
    if (digits.startsWith("02")) {
      return digits.replace(/(\d{2})(\d{4})(\d{4})/, "$1-$2-$3");
    }

    return digits.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
  }

  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
  }

  return value;
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function formatShortDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
