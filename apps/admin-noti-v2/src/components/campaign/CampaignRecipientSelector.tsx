"use client";

import { AppIcon } from "@/components/icons/AppIcon";
import { FormSelect } from "@/components/ui/FormSelect";
import type { V2CampaignRecipientSearchResponse } from "@/lib/api/v2";
import { formatRecipientSource } from "@/lib/recipient-source";

export type RecipientSearchStatus = "all" | "ACTIVE" | "INACTIVE" | "DORMANT" | "BLOCKED";

type RecipientSearchParams = {
  query?: string;
  status?: RecipientSearchStatus;
  offset?: number;
};

export function CampaignRecipientSelector({
  recipients,
  recipientsLoading,
  recipientsError,
  searchInput,
  searchStatus,
  showOnlyContactable,
  selectedUserIds,
  selectedContactableCount,
  tableId,
  searchInputId,
  statusSelectId,
  tableCaptionId,
  tableValidationMessage,
  onSearchInputChange,
  onSearchStatusChange,
  onShowOnlyContactableChange,
  onSearch,
  onSelectedUserIdsChange,
  onClearFeedback,
}: {
  recipients: V2CampaignRecipientSearchResponse | null;
  recipientsLoading: boolean;
  recipientsError: string | null;
  searchInput: string;
  searchStatus: RecipientSearchStatus;
  showOnlyContactable: boolean;
  selectedUserIds: string[];
  selectedContactableCount: number;
  tableId?: string;
  searchInputId: string;
  statusSelectId: string;
  tableCaptionId: string;
  tableValidationMessage?: string;
  onSearchInputChange: (value: string) => void;
  onSearchStatusChange: (value: RecipientSearchStatus) => void;
  onShowOnlyContactableChange: (value: boolean) => void;
  onSearch: (params?: RecipientSearchParams) => void;
  onSelectedUserIdsChange: (nextUserIds: string[]) => void;
  onClearFeedback?: () => void;
}) {
  const recipientItems = recipients?.items ?? [];
  const displayRecipientItems = showOnlyContactable
    ? recipientItems.filter((item) => item.hasPhone)
    : recipientItems;
  const selectedUserSet = new Set(selectedUserIds);
  const visibleSelectableUsers = displayRecipientItems.filter((item) => item.hasPhone);
  const allVisibleSelected =
    visibleSelectableUsers.length > 0 &&
    visibleSelectableUsers.every((item) => selectedUserSet.has(item.id));
  const selectedVisibleCount = visibleSelectableUsers.filter((item) => selectedUserSet.has(item.id)).length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;
  const validationId = tableId ? `${tableId}-error` : undefined;
  const recipientStatusMessage = recipientsLoading
    ? "수신자 목록을 불러오는 중입니다."
    : recipients
      ? `${formatCount(displayRecipientItems.length)}명 표시 중입니다. 검색 결과 ${formatCount(recipients.summary.filteredCount)}명 중 발송 가능 ${formatCount(recipients.summary.contactableCount)}명입니다.`
      : "수신자 목록을 아직 불러오지 않았습니다.";

  function clearFeedback() {
    onClearFeedback?.();
  }

  function toggleRecipient(userId: string) {
    clearFeedback();
    onSelectedUserIdsChange(
      selectedUserIds.includes(userId)
        ? selectedUserIds.filter((id) => id !== userId)
        : [...selectedUserIds, userId],
    );
  }

  function toggleVisibleRecipients() {
    clearFeedback();
    const next = new Set(selectedUserIds);

    if (allVisibleSelected) {
      visibleSelectableUsers.forEach((item) => next.delete(item.id));
    } else {
      visibleSelectableUsers.forEach((item) => next.add(item.id));
    }

    onSelectedUserIdsChange([...next]);
  }

  return (
    <>
      {recipientsError ? (
        <div className="flash flash-attention">
          <AppIcon name="warn" className="icon icon-16 flash-icon" />
          <div className="flash-body">{recipientsError}</div>
        </div>
      ) : null}

      <div className="box">
        <div className="box-header campaign-recipient-header">
          <div className="campaign-recipient-heading">
            <div className="box-title">수신자 목록</div>
            <div className="box-subtitle">전화번호가 있는 수신자만 발송 대상으로 선택할 수 있습니다.</div>
            <div className="text-small text-muted campaign-recipient-status">
              {formatCount(displayRecipientItems.length)}명 표시 · 발송 가능 {formatCount(recipients?.summary.contactableCount ?? 0)}명 · {formatCount(selectedContactableCount)}명 선택
            </div>
          </div>
        </div>
        <div className="box-body toolbar-box-body">
          <div className="toolbar-row campaign-recipient-filter-row">
            <div className="toolbar-search-wrap">
              <label className="sr-only" htmlFor={searchInputId}>수신자 검색</label>
              <AppIcon name="search" className="icon icon-14 toolbar-search-icon" />
              <input
                id={searchInputId}
                className="form-control toolbar-input-with-icon"
                placeholder="이름, 전화번호, 이메일, 외부 ID 검색"
                value={searchInput}
                onChange={(event) => {
                  clearFeedback();
                  onSearchInputChange(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onSearch({ offset: 0 });
                  }
                }}
              />
            </div>
            <div className="campaign-filter-control">
              <label className="text-small text-muted" htmlFor={statusSelectId}>상태</label>
              <FormSelect
                id={statusSelectId}
                className="form-control toolbar-select narrow"
                value={searchStatus}
                onChange={(event) => {
                  const nextStatus = event.target.value as RecipientSearchStatus;
                  clearFeedback();
                  onSearchStatusChange(nextStatus);
                  onSearch({ status: nextStatus, offset: 0 });
                }}
              >
                <option value="ACTIVE">활성</option>
                <option value="all">전체</option>
                <option value="INACTIVE">비활성</option>
                <option value="DORMANT">휴면</option>
                <option value="BLOCKED">차단</option>
              </FormSelect>
            </div>
            <label className="campaign-filter-checkbox">
              <input
                type="checkbox"
                checked={showOnlyContactable}
                onChange={(event) => {
                  clearFeedback();
                  onShowOnlyContactableChange(event.target.checked);
                }}
              />
              발송 가능만 보기
            </label>
            <button type="button" className="btn btn-default" onClick={() => onSearch({ offset: 0 })}>
              {recipientsLoading ? "검색 중" : "검색"}
            </button>
            {selectedUserIds.length > 0 ? (
              <button
                type="button"
                className="btn btn-default"
                onClick={() => {
                  clearFeedback();
                  onSelectedUserIdsChange([]);
                }}
              >
                모든 선택 해제
              </button>
            ) : null}
          </div>
          <div className="sr-only" role="status" aria-live="polite">
            {recipientStatusMessage}
          </div>
        </div>
        <div
          id={tableId}
          className="table-scroll campaign-table-scroll"
          tabIndex={tableId ? -1 : undefined}
          aria-describedby={describedBy(
            tableCaptionId,
            tableValidationMessage && validationId ? validationId : undefined,
          )}
        >
          <table className="data-table campaign-recipient-table">
            <caption id={tableCaptionId} className="sr-only">
              검색된 수신자 목록입니다. 전화번호가 있는 수신자만 선택할 수 있습니다.
            </caption>
            <thead>
              <tr>
                <th className="campaign-checkbox-cell" scope="col">
                  <input
                    type="checkbox"
                    className="campaign-row-checkbox"
                    aria-label={
                      allVisibleSelected
                        ? "현재 페이지의 발송 가능 수신자 모두 선택 해제"
                        : "현재 페이지의 발송 가능 수신자 모두 선택"
                    }
                    aria-checked={someVisibleSelected ? "mixed" : allVisibleSelected}
                    aria-describedby={tableCaptionId}
                    checked={allVisibleSelected}
                    disabled={visibleSelectableUsers.length === 0}
                    ref={(node) => {
                      if (node) {
                        node.indeterminate = someVisibleSelected;
                      }
                    }}
                    onChange={toggleVisibleRecipients}
                  />
                </th>
                <th>이름</th>
                <th>전화번호</th>
                <th>이메일</th>
                <th>상태</th>
                <th>세그먼트</th>
                <th>유형</th>
              </tr>
            </thead>
            <tbody>
              {displayRecipientItems.length > 0 ? (
                displayRecipientItems.map((recipient) => {
                  const selectable = recipient.hasPhone;
                  const selected = selectedUserSet.has(recipient.id);
                  const rowNameId = `${tableCaptionId}-${recipient.id}-name`;
                  return (
                    <tr
                      key={recipient.id}
                      aria-selected={selected || undefined}
                      data-selectable={selectable ? "true" : "false"}
                      data-selected={selected ? "true" : "false"}
                      onClick={() => {
                        if (selectable) {
                          toggleRecipient(recipient.id);
                        }
                      }}
                    >
                      <td className="campaign-checkbox-cell">
                        <input
                          type="checkbox"
                          className="campaign-row-checkbox"
                          aria-labelledby={rowNameId}
                          checked={selected}
                          disabled={!selectable}
                          onClick={(event) => event.stopPropagation()}
                          onChange={() => toggleRecipient(recipient.id)}
                        />
                      </td>
                      <th className="campaign-recipient-row-header" scope="row">
                        <div id={rowNameId} className="table-title-text">{recipient.name}</div>
                        <div className="table-subtext">{recipient.externalId || formatRecipientSource(recipient.source)}</div>
                      </th>
                      <td className="td-mono">
                        {recipient.phone ? formatPhone(recipient.phone) : <span className="td-muted">전화번호 없음</span>}
                      </td>
                      <td className="td-muted">{recipient.email || "—"}</td>
                      <td><span className={`label ${recipientStatusPillClass(recipient.status)}`}><span className="label-dot" />{recipientStatusText(recipient.status)}</span></td>
                      <td className="td-muted">{recipient.segment || "—"}</td>
                      <td className="td-muted">{recipient.userType || "—"}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state" style={{ padding: 24 }}>
                      <div className="empty-title" style={{ fontSize: 14 }}>
                        {recipientItems.length > 0 ? "발송 가능한 수신자가 없습니다" : "검색 결과가 없습니다"}
                      </div>
                      <div className="empty-desc">
                        {recipientItems.length > 0
                          ? "전화번호 없는 수신자를 포함하려면 발송 가능만 보기를 해제해 주세요."
                          : "검색어 또는 상태 필터를 바꿔 다시 확인해 주세요."}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <FieldValidationMessage id={validationId} message={tableValidationMessage} />
        <div className="box-footer">
          <span className="text-small text-muted">
            검색 조건 {formatCount(recipients?.summary.filteredCount ?? 0)}명 · 전체 {formatCount(recipients?.summary.totalCount ?? 0)}명
          </span>
          <div className="campaign-pagination-actions">
            <button
              type="button"
              className="btn btn-default btn-sm"
              onClick={() => onSearch({ offset: recipients?.page.prevOffset ?? 0 })}
              disabled={recipientsLoading || recipients?.page.prevOffset == null}
            >
              이전
            </button>
            <button
              type="button"
              className="btn btn-default btn-sm"
              onClick={() => onSearch({ offset: recipients?.page.nextOffset ?? 0 })}
              disabled={recipientsLoading || recipients?.page.nextOffset == null}
            >
              다음
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function FieldValidationMessage({
  id,
  message,
}: {
  id?: string;
  message?: string;
}) {
  if (!id || !message) {
    return null;
  }

  return (
    <div id={id} className="form-field-error" role="alert">
      {message}
    </div>
  );
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return value;
}

function recipientStatusText(status: string) {
  if (status === "ACTIVE") return "활성";
  if (status === "INACTIVE") return "비활성";
  if (status === "DORMANT") return "휴면";
  if (status === "BLOCKED") return "차단";
  return status;
}

function recipientStatusPillClass(status: string) {
  if (status === "ACTIVE") return "label-green";
  if (status === "BLOCKED") return "label-red";
  if (status === "DORMANT") return "label-yellow";
  return "label-gray";
}

function formatCount(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function describedBy(...ids: Array<string | undefined>) {
  const value = ids.filter(Boolean).join(" ");
  return value || undefined;
}
