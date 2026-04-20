"use client";

import { useEffect, useState } from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import { SkeletonStatGrid, SkeletonTableBox } from "@/components/loading/PageSkeleton";
import {
  createV2Recipient,
  fetchV2Recipients,
  type V2CreateRecipientPayload,
  type V2RecipientsResponse,
} from "@/lib/api/v2";

type RecipientStatusFilter = "ALL" | "ACTIVE" | "INACTIVE" | "DORMANT" | "BLOCKED";

const INITIAL_FORM_STATE: {
  name: string;
  phone: string;
  email: string;
  status: "ACTIVE" | "INACTIVE" | "DORMANT" | "BLOCKED";
  userType: string;
  segment: string;
  gradeOrLevel: string;
  marketingConsent: boolean;
  tags: string;
} = {
  name: "",
  phone: "",
  email: "",
  status: "ACTIVE",
  userType: "",
  segment: "",
  gradeOrLevel: "",
  marketingConsent: false,
  tags: "",
};

export function RecipientsPage() {
  const [data, setData] = useState<V2RecipientsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<RecipientStatusFilter>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState(INITIAL_FORM_STATE);

  const loadRecipients = async (background = false) => {
    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const next = await fetchV2Recipients();
      setData(next);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "수신자 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadRecipients();
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = (data?.items ?? []).filter((item) => {
    if (statusFilter !== "ALL" && item.status !== statusFilter) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const haystacks = [
      item.name,
      item.phone ?? "",
      item.email ?? "",
      item.segment ?? "",
      item.gradeOrLevel ?? "",
      item.userType ?? "",
      item.source,
    ];

    return haystacks.some((value) => value.toLowerCase().includes(normalizedQuery));
  });

  const openCreateModal = () => {
    setForm(INITIAL_FORM_STATE);
    setFormError(null);
    setCreateOpen(true);
  };

  const closeCreateModal = () => {
    if (saving) {
      return;
    }
    setCreateOpen(false);
    setFormError(null);
  };

  const handleCreateRecipient = async () => {
    const name = form.name.trim();
    const phone = form.phone.trim();

    if (!name) {
      setFormError("이름을 입력해 주세요.");
      return;
    }

    if (!phone) {
      setFormError("전화번호를 입력해 주세요.");
      return;
    }

    setSaving(true);
    setFormError(null);
    setSuccessMessage(null);

    const payload: V2CreateRecipientPayload = {
      source: "manual",
      name,
      phone,
      email: form.email.trim() || undefined,
      status: form.status,
      userType: form.userType.trim() || undefined,
      segment: form.segment.trim() || undefined,
      gradeOrLevel: form.gradeOrLevel.trim() || undefined,
      marketingConsent: form.marketingConsent,
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    };

    try {
      const result = await createV2Recipient(payload);
      await loadRecipients(true);
      setCreateOpen(false);
      setForm(INITIAL_FORM_STATE);
      setSuccessMessage(
        result.mode === "updated"
          ? `${result.user.name} 수신자 정보를 업데이트했습니다.`
          : `${result.user.name} 수신자를 추가했습니다.`
      );
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : "수신자를 추가하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) {
    return (
      <>
        <div className="page-header">
          <div className="page-header-row">
            <div>
              <div className="page-title">수신자 관리</div>
              <div className="page-desc">발송 대상 유저를 관리하고 대량 발송에 사용할 수신자를 준비합니다</div>
            </div>
          </div>
        </div>
        <SkeletonStatGrid columns={4} />
        <SkeletonTableBox titleWidth={156} rows={6} columns={["1fr", "1.1fr", "0.8fr", "0.8fr", "0.8fr", "0.9fr"]} />
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <div className="page-title">수신자 관리</div>
            <div className="page-desc">발송 대상 유저를 관리하고 대량 발송에 사용할 수신자를 준비합니다</div>
          </div>
          <div className="flex gap-8">
            <button className="btn btn-default" onClick={() => void loadRecipients(true)}>
              <AppIcon name="refresh" className={`icon icon-14${refreshing ? " spin" : ""}`} />
              새로고침
            </button>
            <button className="btn btn-accent" onClick={openCreateModal}>
              <AppIcon name="user-plus" className="icon icon-14" />
              수신자 추가
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="flash flash-attention">
          <AppIcon name="warn" className="icon icon-16 flash-icon" />
          <div className="flash-body">{error}</div>
        </div>
      ) : null}

      {successMessage ? (
        <div className="flash flash-success">
          <AppIcon name="check-circle" className="icon icon-16 flash-icon" />
          <div className="flash-body">{successMessage}</div>
          <div className="flash-actions">
            <button className="btn btn-default btn-sm" onClick={() => setSuccessMessage(null)}>
              닫기
            </button>
          </div>
        </div>
      ) : null}

      <div className="box mb-16">
        <div className="stats-grid">
          <div className="stat-cell">
            <div className="stat-label-t">전체 수신자</div>
            <div className="stat-value-t">{data?.summary.totalCount ?? 0}</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label-t">전화번호 있음</div>
            <div className="stat-value-t" style={{ color: "var(--accent-fg)" }}>{data?.summary.phoneCount ?? 0}</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label-t">마케팅 동의</div>
            <div className="stat-value-t" style={{ color: "var(--success-fg)" }}>{data?.summary.marketingConsentCount ?? 0}</div>
          </div>
          <div className="stat-cell" style={{ borderRight: "none" }}>
            <div className="stat-label-t">소스 수</div>
            <div className="stat-value-t">{data?.summary.sourceCount ?? 0}</div>
          </div>
        </div>
      </div>

      <div className="box">
        <div className="box-header">
          <div>
            <div className="box-title">수신자 목록</div>
            <div className="box-subtitle">브랜드 메시지, 알림톡, SMS 대량 발송에서 공통으로 사용하는 수신자입니다.</div>
          </div>
          <div className="recipient-toolbar">
            <div className="recipient-search">
              <AppIcon name="search" className="icon icon-14" />
              <input
                className="form-control recipient-search-input"
                placeholder="이름, 전화번호, 이메일, 세그먼트로 검색"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="form-select field-width-sm">
              <select className="form-control" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as RecipientStatusFilter)}>
                <option value="ALL">전체 상태</option>
                <option value="ACTIVE">활성</option>
                <option value="INACTIVE">비활성</option>
                <option value="DORMANT">휴면</option>
                <option value="BLOCKED">차단</option>
              </select>
            </div>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>이름</th>
                <th>연락처</th>
                <th>상태</th>
                <th>소스</th>
                <th>세그먼트</th>
                <th>최근 변경일</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">
                      <div className="empty-icon">
                        <AppIcon name="users" className="icon icon-40" />
                      </div>
                      <div className="empty-title">{data?.items.length ? "검색 결과가 없습니다" : "수신자가 없습니다"}</div>
                      <div className="empty-desc">
                        {data?.items.length
                          ? "검색어나 상태 필터를 조정해 보세요."
                          : "수신자를 추가하면 대량 발송 테스트에서 바로 선택할 수 있습니다."}
                      </div>
                      {!data?.items.length ? (
                        <div className="empty-actions">
                          <button className="btn btn-accent" onClick={openCreateModal}>
                            <AppIcon name="user-plus" className="icon icon-14" />
                            수신자 추가
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="table-title-text">{item.name}</div>
                      <div className="table-subtext">{item.userType || item.gradeOrLevel || "—"}</div>
                    </td>
                    <td className="td-muted">
                      <div>{item.phone ? formatPhone(item.phone) : "전화번호 없음"}</div>
                      <div className="table-subtext">{item.email || "이메일 없음"}</div>
                    </td>
                    <td>
                      <span className={`label ${managedUserStatusClass(item.status)}`}>
                        <span className="label-dot" />
                        {managedUserStatusText(item.status)}
                      </span>
                    </td>
                    <td className="td-muted">
                      <div>{item.source}</div>
                      {item.marketingConsent === true ? <div className="table-subtext">마케팅 동의</div> : null}
                    </td>
                    <td className="td-muted">{item.segment || "—"}</td>
                    <td className="td-muted text-small">{formatDateTime(item.updatedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {createOpen ? (
        <div className="modal-backdrop open" onClick={closeCreateModal}>
          <div className="modal recipient-create-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <AppIcon name="user-plus" className="icon icon-18" />
                수신자 추가
              </div>
              <button className="modal-close" onClick={closeCreateModal} disabled={saving} aria-label="수신자 추가 닫기">
                <AppIcon name="x" className="icon icon-18" />
              </button>
            </div>
            <div className="modal-body">
              <div className="flash flash-info">
                <AppIcon name="info" className="icon icon-16 flash-icon" />
                <div className="flash-body">이곳에서 추가한 수신자는 SMS, 알림톡, 브랜드 메시지 대량 발송 대상 검색에 바로 반영됩니다.</div>
              </div>

              <div className="recipient-form-grid">
                <div className="form-group">
                  <label className="form-label">이름</label>
                  <input
                    className="form-control"
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="예: 김민우"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">전화번호</label>
                  <input
                    className="form-control"
                    value={form.phone}
                    onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                    placeholder="숫자만 입력해도 됩니다"
                  />
                  <div className="form-hint">대량 발송 테스트를 위해 전화번호 입력을 권장합니다.</div>
                </div>
                <div className="form-group">
                  <label className="form-label">이메일</label>
                  <input
                    className="form-control"
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    placeholder="선택 입력"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">상태</label>
                  <div className="form-select">
                    <select
                      className="form-control"
                      value={form.status}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          status: event.target.value as typeof INITIAL_FORM_STATE.status,
                        }))
                      }
                    >
                      <option value="ACTIVE">활성</option>
                      <option value="INACTIVE">비활성</option>
                      <option value="DORMANT">휴면</option>
                      <option value="BLOCKED">차단</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">유형</label>
                  <input
                    className="form-control"
                    value={form.userType}
                    onChange={(event) => setForm((current) => ({ ...current, userType: event.target.value }))}
                    placeholder="예: 회원, 학생, 고객"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">세그먼트</label>
                  <input
                    className="form-control"
                    value={form.segment}
                    onChange={(event) => setForm((current) => ({ ...current, segment: event.target.value }))}
                    placeholder="예: VIP, 봄캠페인"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">등급/레벨</label>
                  <input
                    className="form-control"
                    value={form.gradeOrLevel}
                    onChange={(event) => setForm((current) => ({ ...current, gradeOrLevel: event.target.value }))}
                    placeholder="예: Gold"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">태그</label>
                  <input
                    className="form-control"
                    value={form.tags}
                    onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
                    placeholder="쉼표로 구분해 입력"
                  />
                </div>
              </div>

              <label className="recipient-checkbox-row">
                <input
                  type="checkbox"
                  checked={form.marketingConsent}
                  onChange={(event) => setForm((current) => ({ ...current, marketingConsent: event.target.checked }))}
                />
                <span>마케팅 수신 동의</span>
              </label>

              {formError ? (
                <div className="flash flash-attention" style={{ marginTop: 12, marginBottom: 0 }}>
                  <AppIcon name="warn" className="icon icon-16 flash-icon" />
                  <div className="flash-body">{formError}</div>
                </div>
              ) : null}
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={closeCreateModal} disabled={saving}>
                취소
              </button>
              <button className="btn btn-accent" onClick={() => void handleCreateRecipient()} disabled={saving}>
                <AppIcon name="user-plus" className="icon icon-14" />
                {saving ? "저장 중..." : "수신자 저장"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function managedUserStatusText(value: "ACTIVE" | "INACTIVE" | "DORMANT" | "BLOCKED") {
  if (value === "ACTIVE") {
    return "활성";
  }
  if (value === "INACTIVE") {
    return "비활성";
  }
  if (value === "DORMANT") {
    return "휴면";
  }
  return "차단";
}

function managedUserStatusClass(value: "ACTIVE" | "INACTIVE" | "DORMANT" | "BLOCKED") {
  if (value === "ACTIVE") {
    return "label-green";
  }
  if (value === "BLOCKED") {
    return "label-red";
  }
  if (value === "DORMANT") {
    return "label-yellow";
  }
  return "label-gray";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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
