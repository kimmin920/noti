"use client";

import { Button, ConfirmationDialog, FormControl, TextInput, ThemeProvider } from "@primer/react";
import { Dialog } from "@primer/react/experimental";
import { PlusIcon } from "@primer/octicons-react";
import { type FormEvent, useMemo, useRef, useState } from "react";
import { FormSelect } from "@/components/ui/FormSelect";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";
import { useAppStore } from "@/lib/store/app-store";
import {
  createV2Sms080Application,
  fetchV2Sms080Resources,
  type V2Sms080ResourcesResponse,
  type V2Sms080ServiceItem,
  type V2Sms080ServiceStatus,
  type V2Sms080ServiceType,
} from "@/lib/api/v2";

type Sms080Service = {
  id: string;
  unsubscribeNo: string;
  rawUnsubscribeNumber: string | null;
  businessName: string;
  providerName: string;
  type: V2Sms080ServiceType;
  status: V2Sms080ServiceStatus;
  requestedAt: string;
  startsAt: string;
  syncAvailable: boolean;
  reviewMemo: string | null;
};

type External080Error = {
  field: "number" | "business";
  message: string;
} | null;

const MONTHLY_PRICE_TEXT = "33,000원(부가세 포함)";

export function Sms080SettingsPanel({ serviceName }: { serviceName: string }) {
  const showDraftToast = useAppStore((state) => state.showDraftToast);
  const externalDialogTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [data, setData] = useState<V2Sms080ResourcesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [requestConfirmOpen, setRequestConfirmOpen] = useState(false);
  const [externalDialogOpen, setExternalDialogOpen] = useState(false);
  const [externalNumber, setExternalNumber] = useState("");
  const [externalBusinessName, setExternalBusinessName] = useState(serviceName);
  const [externalProviderName, setExternalProviderName] = useState("");
  const [externalError, setExternalError] = useState<External080Error>(null);
  const [recipientNoQuery, setRecipientNoQuery] = useState("");
  const [startRequestDate, setStartRequestDate] = useState("");
  const [endRequestDate, setEndRequestDate] = useState("");
  const [submitting, setSubmitting] = useState<"managed" | "external" | null>(null);

  const loadResources = async (options?: { background?: boolean; preferredServiceId?: string }) => {
    if (options?.background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const next = await fetchV2Sms080Resources();
      setData(next);

      const preferredServiceId = options?.preferredServiceId || selectedServiceId;
      const nextSelectedId = next.items.some((item) => item.id === preferredServiceId)
        ? preferredServiceId
        : next.items[0]?.id ?? "";
      setSelectedServiceId(nextSelectedId);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "080 번호 정보를 불러오지 못했습니다.";
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
    void loadResources();
  });

  const services = useMemo(() => (data?.items ?? []).map(toServiceView), [data]);
  const selectedService = services.find((item) => item.id === selectedServiceId) ?? services[0] ?? null;
  const effectiveSelectedServiceId = selectedService?.id ?? "";
  const hasPendingManagedService = services.some((item) => item.type === "NHN_MANAGED" && item.status === "SUBMITTED");
  const optOutRecipients = useMemo(() => data?.optOutRecipients ?? [], [data]);

  const visibleRecipients = useMemo(() => {
    if (!selectedService || !selectedService.syncAvailable) {
      return [];
    }

    const normalizedQuery = normalizePhoneNumber(recipientNoQuery);

    return optOutRecipients.filter((item) => {
      if (item.serviceId !== selectedService.id) return false;
      if (normalizedQuery && !normalizePhoneNumber(item.recipientNo).includes(normalizedQuery)) return false;
      if (startRequestDate && item.requestedAt.slice(0, 10) < startRequestDate) return false;
      if (endRequestDate && item.requestedAt.slice(0, 10) > endRequestDate) return false;
      return true;
    });
  }, [endRequestDate, optOutRecipients, recipientNoQuery, selectedService, startRequestDate]);

  async function handleConfirmManagedRequest() {
    if (submitting) {
      return;
    }

    setSubmitting("managed");

    try {
      const created = await createV2Sms080Application({
        type: "NHN_MANAGED",
        businessName: serviceName,
      });
      showDraftToast("080 신규 신청이 접수되었습니다. 내부 승인 후 번호가 배정됩니다.");
      await loadResources({ background: true, preferredServiceId: created.id });
      setRequestConfirmOpen(false);
    } catch (requestError) {
      showDraftToast(requestError instanceof Error ? requestError.message : "080 신규 신청에 실패했습니다.");
    } finally {
      setSubmitting(null);
    }
  }

  function resetExternalDraft() {
    setExternalNumber("");
    setExternalBusinessName(serviceName);
    setExternalProviderName("");
    setExternalError(null);
  }

  function handleCancelExternalNumber() {
    resetExternalDraft();
    setExternalDialogOpen(false);
  }

  async function handleSaveExternalNumber(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (submitting) {
      return;
    }

    const normalizedNumber = normalizePhoneNumber(externalNumber);
    const businessName = externalBusinessName.trim();
    const providerName = externalProviderName.trim();

    if (!/^080\d{7,8}$/.test(normalizedNumber)) {
      setExternalError({ field: "number", message: "080으로 시작하는 수신거부 번호를 입력해 주세요." });
      return;
    }

    if (!businessName) {
      setExternalError({ field: "business", message: "업체명을 입력해 주세요." });
      return;
    }

    if (services.some((item) => item.rawUnsubscribeNumber === normalizedNumber && item.status !== "REJECTED")) {
      setExternalError({ field: "number", message: "이미 등록되었거나 심사 중인 080 번호입니다." });
      return;
    }

    setSubmitting("external");

    try {
      const created = await createV2Sms080Application({
        type: "EXTERNAL",
        unsubscribeNumber: normalizedNumber,
        businessName,
        providerName: providerName || undefined,
      });
      showDraftToast("보유 080 번호 등록 신청이 접수되었습니다. 내부 승인 후 사용할 수 있습니다.");
      await loadResources({ background: true, preferredServiceId: created.id });
      resetExternalDraft();
      setExternalDialogOpen(false);
    } catch (requestError) {
      showDraftToast(requestError instanceof Error ? requestError.message : "보유 080 번호 등록에 실패했습니다.");
    } finally {
      setSubmitting(null);
    }
  }

  function resetRecipientFilters() {
    setRecipientNoQuery("");
    setStartRequestDate("");
    setEndRequestDate("");
  }

  return (
    <ThemeProvider colorMode="light" dayScheme="light" preventSSRMismatch>
      <div className="settings-080-stack">
        <div className="box">
          <div className="box-header">
            <div>
              <div className="box-title">080 번호 관리</div>
              <div className="box-subtitle">광고 문자 발송에 사용할 수신거부 번호를 관리합니다</div>
            </div>
            <Button size="small" onClick={() => void loadResources({ background: true })} disabled={refreshing}>
              {refreshing ? "새로고침 중" : "새로고침"}
            </Button>
          </div>
          <div className="box-section-tight">
            <div className="box-row settings-080-action-row">
              <div className="box-row-content">
                <div className="box-row-title">080 번호 신청</div>
                <div className="box-row-desc">
                  신청 비용은 {MONTHLY_PRICE_TEXT}이며, 보통 영업일 기준 3~4일 후 개통됩니다. 등록 예약 상태에서는 개통을 취소할 수 없습니다.
                </div>
              </div>
              <Button
                variant="primary"
                leadingVisual={PlusIcon}
                onClick={() => setRequestConfirmOpen(true)}
                disabled={hasPendingManagedService || submitting === "managed"}
              >
                {hasPendingManagedService ? "승인 대기 중" : submitting === "managed" ? "신청 중" : "080 번호 신청하기"}
              </Button>
            </div>

            <div className="box-row settings-080-external-row">
              <div className="box-row-content">
                <div className="box-row-title">이미 보유한 080 번호 등록</div>
                <div className="box-row-desc">
                  외부 업체에서 관리 중인 080 번호를 광고 문구에 사용할 수 있도록 심사를 요청합니다. 승인 후 사용할 수 있으며, 수신거부 목록은 이 서비스에서 동기화할 수 없습니다.
                </div>
              </div>
              <Button
                ref={externalDialogTriggerRef}
                onClick={() => {
                  setExternalError(null);
                  setExternalDialogOpen(true);
                }}
              >
                보유 080 번호 등록
              </Button>
            </div>
          </div>
        </div>

        {error ? (
          <div className="flash flash-attention">
            <div className="flash-body">{error}</div>
          </div>
        ) : null}

        <div className="box">
          <div className="box-header">
            <div>
              <div className="box-title">등록된 080 번호</div>
              <div className="box-subtitle">번호 상태와 수신거부 목록 동기화 가능 여부</div>
            </div>
          </div>
          <div className="table-scroll settings-080-table-scroll">
            <table className="data-table settings-080-service-table">
              <thead>
                <tr>
                  <th scope="col">080 번호</th>
                  <th scope="col">제공 업체</th>
                  <th scope="col">업체명</th>
                  <th scope="col">신청/등록 일시</th>
                  <th scope="col">사용 시작</th>
                  <th scope="col">상태</th>
                  <th scope="col">목록 동기화</th>
                </tr>
              </thead>
              <tbody>
                {services.length > 0 ? (
                  services.map((service) => (
                    <tr key={service.id}>
                      <th scope="row" className="text-mono">{service.unsubscribeNo}</th>
                      <td>{service.providerName}</td>
                      <td>{service.businessName}</td>
                      <td>{service.requestedAt}</td>
                      <td>{service.startsAt}</td>
                      <td>
                        <span className={`label ${serviceStatusClass(service.status)}`}>
                          <span className="label-dot" />
                          {serviceStatusText(service.status)}
                        </span>
                        {service.reviewMemo && service.status === "REJECTED" ? (
                          <div className="table-subtext">사유: {service.reviewMemo}</div>
                        ) : null}
                      </td>
                      <td>{service.syncAvailable ? "가능" : "불가"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7}>
                      <div className="settings-080-table-empty">
                        {loading ? "080 번호 정보를 불러오는 중입니다." : "신청했거나 등록한 080 번호가 없습니다."}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="box">
          <div className="box-header settings-080-list-header">
            <div>
              <div className="box-title">수신거부 목록</div>
              <div className="box-subtitle">NHN Cloud 080 번호로 접수된 수신거부 대상자를 조회합니다</div>
            </div>
          </div>
          <div className="box-body settings-080-filter-body">
            <div className="settings-080-filter-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="opt-out-service-id">
                  080 번호
                </label>
                <FormSelect
                  id="opt-out-service-id"
                  className="form-control"
                  value={effectiveSelectedServiceId}
                  onChange={(event) => setSelectedServiceId(event.target.value)}
                  disabled={services.length === 0}
                >
                  {services.length === 0 ? <option value="">등록된 번호 없음</option> : null}
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.unsubscribeNo} · {service.providerName}
                    </option>
                  ))}
                </FormSelect>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="opt-out-start-date">
                  시작일
                </label>
                <input
                  id="opt-out-start-date"
                  className="form-control"
                  type="date"
                  value={startRequestDate}
                  onChange={(event) => setStartRequestDate(event.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="opt-out-end-date">
                  종료일
                </label>
                <input
                  id="opt-out-end-date"
                  className="form-control"
                  type="date"
                  value={endRequestDate}
                  onChange={(event) => setEndRequestDate(event.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="opt-out-recipient-no">
                  수신 번호
                </label>
                <input
                  id="opt-out-recipient-no"
                  className="form-control"
                  value={recipientNoQuery}
                  placeholder="01000000000"
                  onChange={(event) => setRecipientNoQuery(event.target.value)}
                />
              </div>
            </div>
            <div className="settings-080-filter-actions">
              <Button onClick={resetRecipientFilters}>초기화</Button>
              <Button>검색</Button>
            </div>
          </div>

          {selectedService && recipientUnavailableMessage(selectedService) ? (
            <div className="settings-080-list-message">{recipientUnavailableMessage(selectedService)}</div>
          ) : null}

          <div className="table-scroll settings-080-table-scroll">
            <table className="data-table settings-080-recipient-table">
              <thead>
                <tr>
                  <th scope="col">수신 번호</th>
                  <th scope="col">080 번호</th>
                  <th scope="col">요청 일시</th>
                  <th scope="col">출처</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecipients.length > 0 && selectedService ? (
                  visibleRecipients.map((recipient) => (
                    <tr key={recipient.id}>
                      <th scope="row" className="text-mono">{recipient.recipientNo}</th>
                      <td className="text-mono">{selectedService.unsubscribeNo}</td>
                      <td>{formatDateTime(recipient.requestedAt)}</td>
                      <td>NHN API</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>
                      <div className="settings-080-table-empty">
                        {selectedService
                          ? "조회 가능한 수신거부 대상자가 없습니다."
                          : "080 번호를 신청하거나 외부 번호를 등록하면 조회 조건을 선택할 수 있습니다."}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {requestConfirmOpen ? (
        <ConfirmationDialog
          title="080 번호 개통 예약 신청"
          confirmButtonContent={submitting === "managed" ? "신청 중" : "개통 예약 신청"}
          cancelButtonContent="취소"
          onClose={(gesture) => {
            if (gesture === "confirm") {
              void handleConfirmManagedRequest();
              return;
            }
            setRequestConfirmOpen(false);
          }}
        >
          {`신청 비용은 ${MONTHLY_PRICE_TEXT}이며, 등록 예약 상태가 되면 개통을 취소할 수 없습니다. 계속 진행할까요?`}
        </ConfirmationDialog>
      ) : null}

      {externalDialogOpen ? (
        <Dialog
          title="보유 080 번호 등록"
          subtitle="외부 업체에서 관리 중인 080 번호"
          onClose={handleCancelExternalNumber}
          returnFocusRef={externalDialogTriggerRef}
          position={{ narrow: "fullscreen", regular: "center" }}
          width="medium"
          className="settings-080-external-dialog"
        >
          <form className="settings-080-dialog-form" onSubmit={handleSaveExternalNumber}>
            <p className="settings-080-dialog-copy">
              등록 신청은 내부 운영 승인 후 사용할 수 있습니다. 단, 외부 080 번호의 수신거부 목록은 이 서비스에서 동기화할 수 없습니다.
            </p>

            <FormControl required>
              <FormControl.Label>080 번호</FormControl.Label>
              <TextInput
                block
                value={externalNumber}
                placeholder="080-0000-0000"
                validationStatus={externalError?.field === "number" ? "error" : undefined}
                onChange={(event) => {
                  setExternalNumber(event.target.value);
                  if (externalError?.field === "number") {
                    setExternalError(null);
                  }
                }}
              />
              <FormControl.Caption>하이픈 없이 입력해도 됩니다.</FormControl.Caption>
              {externalError?.field === "number" ? (
                <FormControl.Validation variant="error">{externalError.message}</FormControl.Validation>
              ) : null}
            </FormControl>

            <FormControl>
              <FormControl.Label>080 제공 업체</FormControl.Label>
              <TextInput
                block
                value={externalProviderName}
                placeholder="업체명 또는 서비스명"
                onChange={(event) => setExternalProviderName(event.target.value)}
              />
              <FormControl.Caption>수신거부 목록을 확인할 관리자나 서비스명을 입력합니다.</FormControl.Caption>
            </FormControl>

            <FormControl required>
              <FormControl.Label>업체명</FormControl.Label>
              <TextInput
                block
                value={externalBusinessName}
                validationStatus={externalError?.field === "business" ? "error" : undefined}
                onChange={(event) => {
                  setExternalBusinessName(event.target.value);
                  if (externalError?.field === "business") {
                    setExternalError(null);
                  }
                }}
              />
              {externalError?.field === "business" ? (
                <FormControl.Validation variant="error">{externalError.message}</FormControl.Validation>
              ) : null}
            </FormControl>

            <div className="settings-080-dialog-footer">
              <Button type="button" onClick={handleCancelExternalNumber}>취소</Button>
              <Button type="submit" variant="primary" disabled={submitting === "external"}>
                {submitting === "external" ? "접수 중" : "등록 신청"}
              </Button>
            </div>
          </form>
        </Dialog>
      ) : null}
    </ThemeProvider>
  );
}

function toServiceView(item: V2Sms080ServiceItem): Sms080Service {
  return {
    id: item.id,
    unsubscribeNo: item.unsubscribeNumber ? format080Number(item.unsubscribeNumber) : "승인 후 배정",
    rawUnsubscribeNumber: item.unsubscribeNumber,
    businessName: item.businessName,
    providerName: item.providerName || (item.type === "NHN_MANAGED" ? "NHN Cloud" : "외부 080 제공 업체"),
    type: item.type,
    status: item.status,
    requestedAt: formatDateTime(item.createdAt),
    startsAt: serviceStartText(item),
    syncAvailable: item.syncAvailable,
    reviewMemo: item.reviewMemo,
  };
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

function formatDateTime(value: string | Date | null) {
  if (!value) {
    return "—";
  }

  const date = value instanceof Date ? value : new Date(value);

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

function serviceStartText(item: V2Sms080ServiceItem) {
  if (item.status === "APPROVED") {
    return item.approvedAt ? formatDateTime(item.approvedAt) : "승인 완료";
  }

  if (item.status === "REJECTED") {
    return "사용 불가";
  }

  if (item.type === "NHN_MANAGED") {
    return "승인 후 개통 예약";
  }

  return "승인 후 사용";
}

function serviceStatusText(status: V2Sms080ServiceStatus) {
  if (status === "SUBMITTED") return "승인 대기";
  if (status === "APPROVED") return "사용 중";
  return "반려";
}

function serviceStatusClass(status: V2Sms080ServiceStatus) {
  if (status === "SUBMITTED") return "label-blue";
  if (status === "APPROVED") return "label-green";
  return "label-red";
}

function recipientUnavailableMessage(service: Sms080Service) {
  if (service.status === "SUBMITTED") {
    return "승인 대기 중인 080 번호는 아직 수신거부 목록을 조회할 수 없습니다.";
  }

  if (service.status === "REJECTED") {
    return "반려된 080 번호는 수신거부 목록을 조회할 수 없습니다.";
  }

  if (!service.syncAvailable) {
    return "외부 080 번호의 수신거부 목록은 여기서 조회할 수 없습니다. 해당 번호를 신청한 업체에서 목록을 확인하거나 파일로 내려받아 별도로 관리해야 합니다.";
  }

  return "";
}
