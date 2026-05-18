"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import { FormSelect } from "@/components/ui/FormSelect";
import { fetchV2Recipients, type V2RecipientsResponse } from "@/lib/api/v2";
import {
  ALL_RECIPIENT_SOURCE_FILTER,
  formatRecipientSource,
  getRecipientSourceFilterOptions,
  recipientSourceMatchesFilter,
} from "@/lib/recipient-source";
import {
  MANUAL_MESSAGE_RECIPIENT_LIMIT,
  getRecipientPhoneKey,
} from "@/lib/recipient-phone-list";

type RecipientItem = V2RecipientsResponse["items"][number];
type RecipientStatusFilter = "ALL" | RecipientItem["status"];

const ALL_FILTER = "ALL";

export function RecipientSelectPanel({
  open,
  value,
  maxSelection = MANUAL_MESSAGE_RECIPIENT_LIMIT,
  onApply,
  onClose,
}: {
  open: boolean;
  value: string[];
  maxSelection?: number;
  onApply: (phones: string[], recipients: RecipientItem[]) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const resultCountId = useId();
  const validationId = useId();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const requestedRef = useRef(false);
  const [data, setData] = useState<V2RecipientsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<RecipientStatusFilter>(ALL_FILTER);
  const [segmentFilter, setSegmentFilter] = useState(ALL_FILTER);
  const [sourceFilter, setSourceFilter] = useState(ALL_RECIPIENT_SOURCE_FILTER);
  const [pendingRecipientIds, setPendingRecipientIds] = useState<string[]>([]);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const loadRecipients = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextData = await fetchV2Recipients();
      setData(nextData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "수신자 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || requestedRef.current) {
      return;
    }

    requestedRef.current = true;
    void loadRecipients();
  }, [loadRecipients, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setQuery("");
    setStatusFilter(ALL_FILTER);
    setSegmentFilter(ALL_FILTER);
    setSourceFilter(ALL_RECIPIENT_SOURCE_FILTER);
    setValidationMessage(null);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const currentKeys = new Set(value.map((phone) => getRecipientPhoneKey(phone)).filter(Boolean));
    const currentRecipientIds =
      data && currentKeys.size > 0
        ? data.items
            .filter((item) => item.phone && currentKeys.has(getRecipientPhoneKey(item.phone)))
            .map((item) => item.id)
        : [];

    setPendingRecipientIds(currentRecipientIds);
  }, [data, open, value]);

  useEffect(() => {
    if (!open) {
      return;
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => searchInputRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleDocumentKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => document.removeEventListener("keydown", handleDocumentKeyDown);
  }, [onClose, open]);

  const recipientsWithPhone = useMemo(
    () => (data?.items ?? []).filter((recipient) => Boolean(recipient.phone?.trim())),
    [data?.items],
  );

  const segmentOptions = useMemo(
    () => getUniqueOptions(recipientsWithPhone.map((recipient) => recipient.segment)),
    [recipientsWithPhone],
  );

  const sourceFilterOptions = useMemo(
    () => getRecipientSourceFilterOptions(recipientsWithPhone.map((recipient) => recipient.source)),
    [recipientsWithPhone],
  );

  const filteredRecipients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return recipientsWithPhone.filter((recipient) => {
      if (statusFilter !== ALL_FILTER && recipient.status !== statusFilter) {
        return false;
      }

      if (segmentFilter !== ALL_FILTER && (recipient.segment || "") !== segmentFilter) {
        return false;
      }

      if (!recipientSourceMatchesFilter(recipient.source, sourceFilter)) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystacks = [
        recipient.name,
        recipient.phone ?? "",
        recipient.email ?? "",
        recipient.segment ?? "",
        recipient.userType ?? "",
        recipient.gradeOrLevel ?? "",
        recipient.source,
        formatRecipientSource(recipient.source),
        ...recipient.tags,
      ];

      return haystacks.some((item) => item.toLowerCase().includes(normalizedQuery));
    });
  }, [query, recipientsWithPhone, segmentFilter, sourceFilter, statusFilter]);

  const selectedRecipients = useMemo(
    () => {
      const selectedIds = new Set(pendingRecipientIds);
      return recipientsWithPhone.filter((recipient) => selectedIds.has(recipient.id));
    },
    [pendingRecipientIds, recipientsWithPhone],
  );

  const preservedManualPhones = useMemo(
    () => {
      const savedRecipientKeys = new Set(
        recipientsWithPhone
          .map((recipient) => (recipient.phone ? getRecipientPhoneKey(recipient.phone) : ""))
          .filter(Boolean),
      );

      return value.filter((phone) => {
        const key = getRecipientPhoneKey(phone);
        return key && !savedRecipientKeys.has(key);
      });
    },
    [recipientsWithPhone, value],
  );
  const selectedCount = preservedManualPhones.length + selectedRecipients.length;

  const resultCountText = loading
    ? "수신자 목록을 불러오는 중입니다."
    : `${formatCount(filteredRecipients.length)}명 표시 중입니다.`;

  const handleApply = () => {
    if (selectedCount === 0) {
      setValidationMessage("수신자를 1명 이상 선택해 주세요.");
      return;
    }

    if (selectedCount > maxSelection) {
      setValidationMessage(`수신자는 최대 ${formatCount(maxSelection)}명까지 선택할 수 있습니다.`);
      return;
    }

    onApply(
      mergePhoneLists(
        preservedManualPhones,
        selectedRecipients.map((recipient) => formatPhone(recipient.phone ?? "")),
      ),
      selectedRecipients,
    );
    onClose();
  };

  const toggleRecipient = (recipientId: string) => {
    setPendingRecipientIds((current) => {
      if (current.includes(recipientId)) {
        setValidationMessage(null);
        return current.filter((id) => id !== recipientId);
      }

      if (preservedManualPhones.length + current.length + 1 > maxSelection) {
        setValidationMessage(`수신자는 최대 ${formatCount(maxSelection)}명까지 선택할 수 있습니다.`);
        return current;
      }

      setValidationMessage(null);
      return [...current, recipientId];
    });
  };

  const handleRetry = () => {
    requestedRef.current = true;
    void loadRecipients();
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") {
      return;
    }

    const focusableItems = dialogRef.current
      ? Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((item) => !item.hasAttribute("aria-hidden"))
      : [];

    if (focusableItems.length === 0) {
      return;
    }

    const firstItem = focusableItems[0];
    const lastItem = focusableItems[focusableItems.length - 1];

    if (event.shiftKey && document.activeElement === firstItem) {
      event.preventDefault();
      lastItem.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === lastItem) {
      event.preventDefault();
      firstItem.focus();
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop open recipient-select-backdrop" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        className="modal recipient-select-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={handleDialogKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header recipient-select-header">
          <div>
            <div id={titleId} className="modal-title">
              <AppIcon name="users" className="icon icon-18" />
              수신자 선택
            </div>
            <div id={descriptionId} className="recipient-select-description">
              이름과 전화번호를 확인한 뒤 최대 {formatCount(maxSelection)}명까지 선택합니다.
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="수신자 선택 닫기">
            <AppIcon name="x" className="icon icon-18" />
          </button>
        </div>

        <div className="recipient-select-subheader">
          <label className="recipient-select-search">
            <span className="sr-only">수신자 검색</span>
            <AppIcon name="search" className="icon icon-14 recipient-select-search-icon" />
            <input
              ref={searchInputRef}
              className="form-control recipient-select-search-input"
              placeholder="이름, 전화번호, 이메일 검색"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setValidationMessage(null);
              }}
            />
          </label>
          <div className="recipient-select-filters" aria-label="수신자 필터">
            <label className="recipient-select-filter">
              <span>상태</span>
              <FormSelect
                className="form-control toolbar-select narrow"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as RecipientStatusFilter)}
              >
                <option value="ALL">전체 상태</option>
                <option value="ACTIVE">활성</option>
                <option value="INACTIVE">비활성</option>
                <option value="DORMANT">휴면</option>
                <option value="BLOCKED">차단</option>
              </FormSelect>
            </label>
            <label className="recipient-select-filter">
              <span>분류</span>
              <FormSelect
                className="form-control toolbar-select narrow"
                value={segmentFilter}
                onChange={(event) => setSegmentFilter(event.target.value)}
              >
                <option value="ALL">전체 분류</option>
                {segmentOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </FormSelect>
            </label>
            <label className="recipient-select-filter">
              <span>소스</span>
              <FormSelect
                className="form-control toolbar-select narrow"
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
              >
                <option value={ALL_RECIPIENT_SOURCE_FILTER}>전체 소스</option>
                {sourceFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </FormSelect>
            </label>
          </div>
          <div id={resultCountId} className="sr-only" role="status" aria-live="polite">
            {resultCountText}
          </div>
        </div>

        <div className="recipient-select-body">
          {error ? (
            <div className="recipient-select-state">
              <div className="empty-icon empty-icon-attention">
                <AppIcon name="warn" className="icon icon-32" />
              </div>
              <div className="empty-title">수신자를 불러오지 못했습니다</div>
              <div className="empty-desc">{error}</div>
              <div className="empty-actions">
                <button type="button" className="btn btn-default" onClick={handleRetry}>
                  <AppIcon name="refresh" className="icon icon-14" />
                  다시 불러오기
                </button>
              </div>
            </div>
          ) : loading ? (
            <div className="recipient-select-state">
              <div className="empty-icon">
                <AppIcon name="users" className="icon icon-32" />
              </div>
              <div className="empty-title">수신자를 불러오는 중입니다</div>
              <div className="empty-desc">이름과 전화번호를 확인하고 있습니다.</div>
            </div>
          ) : filteredRecipients.length > 0 ? (
            <div
              className="recipient-select-list"
              role="list"
              aria-label="수신자 목록"
              aria-describedby={resultCountId}
            >
              {filteredRecipients.map((recipient) => {
                const selected = pendingRecipientIds.includes(recipient.id);
                const metaItems = getRecipientMetaItems(recipient);

                return (
                  <label
                    key={recipient.id}
                    className={`recipient-select-row${selected ? " selected" : ""}`}
                  >
                    <input
                      type="checkbox"
                      className="recipient-select-radio"
                      name="recipient-select"
                      checked={selected}
                      onChange={() => toggleRecipient(recipient.id)}
                    />
                    <span className="recipient-select-row-main">
                      <span className="recipient-select-primary">
                        <span className="recipient-select-name">{recipient.name}</span>
                        <span className="recipient-select-phone">{formatPhone(recipient.phone ?? "")}</span>
                      </span>
                      <span className="recipient-select-meta">
                        {metaItems.map((item) => (
                          <span key={item}>{item}</span>
                        ))}
                      </span>
                    </span>
                    <span className={`label ${recipientStatusClass(recipient.status)} recipient-select-status`}>
                      <span className="label-dot" />
                      {recipientStatusText(recipient.status)}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="recipient-select-state">
              <div className="empty-icon">
                <AppIcon name="search" className="icon icon-32" />
              </div>
              <div className="empty-title">
                {recipientsWithPhone.length > 0 ? "검색 결과가 없습니다" : "전화번호가 있는 수신자가 없습니다"}
              </div>
              <div className="empty-desc">
                {recipientsWithPhone.length > 0
                  ? "검색어 또는 필터를 조정해 주세요."
                  : "수신자 관리에서 전화번호를 추가하면 선택할 수 있습니다."}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer recipient-select-footer">
          <span className="recipient-select-footer-meta">
            <span>{formatCount(selectedCount)}명 선택됨</span>
            <span id={validationId} className="recipient-select-validation" aria-live="polite">
              {validationMessage}
            </span>
          </span>
          <button type="button" className="btn btn-default" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="btn btn-accent"
            onClick={handleApply}
            aria-describedby={validationMessage ? validationId : undefined}
          >
            선택 적용
          </button>
        </div>
      </div>
    </div>
  );
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function mergePhoneLists(...phoneGroups: string[][]) {
  const seen = new Set<string>();
  const phones: string[] = [];

  for (const phone of phoneGroups.flat()) {
    const key = normalizePhone(phone);
    if (!phone || !key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    phones.push(phone);
  }

  return phones;
}

function getUniqueOptions(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])).sort((a, b) =>
    a.localeCompare(b, "ko-KR"),
  );
}

function getRecipientMetaItems(recipient: RecipientItem) {
  const items = [
    recipient.segment || "분류 없음",
    recipient.userType,
    recipient.gradeOrLevel,
    formatRecipientSource(recipient.source),
    recipient.marketingConsent ? "마케팅 동의" : null,
  ].filter(Boolean) as string[];

  return Array.from(new Set(items));
}

function recipientStatusText(value: RecipientItem["status"]) {
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

function recipientStatusClass(value: RecipientItem["status"]) {
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

function formatCount(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatPhone(value: string) {
  const digits = normalizePhone(value);

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
