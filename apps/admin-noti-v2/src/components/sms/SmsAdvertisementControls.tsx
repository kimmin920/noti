"use client";

import { Banner, Button, Text, ThemeProvider } from "@primer/react";
import { Dialog } from "@primer/react/experimental";
import { PlusCircleIcon } from "@primer/octicons-react";
import { useMemo, useState, type RefObject } from "react";
import {
  fetchV2Sms080Resources,
  type V2Sms080ResourcesResponse,
  type V2Sms080ServiceItem,
} from "@/lib/api/v2";

export type SmsAdvertisementSetupStatus = "registered" | "signup" | null;

const SMS_ADVERTISEMENT_PREFIX = "(광고)";
const SMS_ADVERTISEMENT_FALLBACK_OPT_OUT_NUMBER = "080-500-4233";
const SMS_ADVERTISEMENT_OPT_OUT_PREFIX = "무료수신거부";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripLeadingAdvertisementPrefix(body: string, serviceName: string) {
  let next = body.trimStart();

  if (serviceName) {
    next = next.replace(
      new RegExp(`^${escapeRegex(SMS_ADVERTISEMENT_PREFIX)}\\s*${escapeRegex(serviceName)}\\s*`, "u"),
      "",
    );
  }

  return next.replace(/^\(광고\)\s*/u, "").trimStart();
}

export function formatSmsAdvertisementPreview(
  body: string,
  options: { isAdvertisement?: boolean; advertisingServiceName?: string | null; optOutNumber?: string | null },
) {
  const normalizedBody = body.replace(/\r\n?/g, "\n").trim();

  if (!options.isAdvertisement) {
    return normalizedBody;
  }

  const serviceName = String(options.advertisingServiceName ?? "").trim().replace(/\s+/g, " ");
  const optOutText = formatSmsAdvertisementOptOutText(options.optOutNumber);
  const content = stripLeadingAdvertisementPrefix(
    normalizedBody
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line) => !isSmsAdvertisementOptOutLine(line.trim()))
      .join("\n")
      .trim(),
    serviceName,
  );
  const prefix = `${SMS_ADVERTISEMENT_PREFIX}${serviceName}`;

  return [prefix, content, optOutText].filter(Boolean).join("\n");
}

export function getSmsAdvertisementSetupStatusLabel(status: SmsAdvertisementSetupStatus) {
  if (status === "registered") return "이미 가입되어 있음";
  if (status === "signup") return "신규 가입 원함";
  return null;
}

export function useSmsAdvertisement080State() {
  const [resources, setResources] = useState<V2Sms080ResourcesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approvedService = useMemo(() => getApprovedSms080Service(resources), [resources]);
  const pendingCount = useMemo(
    () => resources?.items.filter((item) => item.status === "SUBMITTED").length ?? 0,
    [resources],
  );

  async function loadResources() {
    setLoading(true);
    setError(null);

    try {
      const next = await fetchV2Sms080Resources();
      setResources(next);
      return next;
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "080 번호 상태를 확인하지 못했습니다.";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  return {
    resources,
    loading,
    error,
    approvedService,
    pendingCount,
    loadResources,
  };
}

export function getApprovedSms080Service(resources: V2Sms080ResourcesResponse | null) {
  return resources?.items.find((item) => item.status === "APPROVED" && item.unsubscribeNumber) ?? null;
}

export function formatSms080Number(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  return value || "";
}

export function formatSmsAdvertisementOptOutText(optOutNumber?: string | null) {
  const number = formatSms080Number(optOutNumber) || SMS_ADVERTISEMENT_FALLBACK_OPT_OUT_NUMBER;
  return `${SMS_ADVERTISEMENT_OPT_OUT_PREFIX} ${number}`;
}

function isSmsAdvertisementOptOutLine(line: string) {
  return new RegExp(`^${escapeRegex(SMS_ADVERTISEMENT_OPT_OUT_PREFIX)}\\s+080[-\\d\\s]+$`, "u").test(line);
}

export function SmsAdvertisementControls({
  id,
  checked,
  serviceName,
  setupStatus,
  approved080Service,
  checking080,
  checkboxRef,
  onCheckedChange,
  onServiceNameChange,
}: {
  id: string;
  checked: boolean;
  serviceName: string;
  setupStatus: SmsAdvertisementSetupStatus;
  approved080Service?: V2Sms080ServiceItem | null;
  checking080?: boolean;
  checkboxRef?: (node: HTMLInputElement | null) => void;
  onCheckedChange: (checked: boolean) => void;
  onServiceNameChange: (value: string) => void;
}) {
  const hintId = `${id}-hint`;
  const serviceNameId = `${id}-service-name`;
  const setupStatusLabel = getSmsAdvertisementSetupStatusLabel(setupStatus);
  const approved080Label = approved080Service?.unsubscribeNumber
    ? formatSms080Number(approved080Service.unsubscribeNumber)
    : "";

  return (
    <div className="form-group sms-ad-controls">
      <label className="form-label">광고 설정</label>
      <label className="campaign-checkbox-row sms-ad-checkbox-row">
        <input
          ref={checkboxRef}
          type="checkbox"
          checked={checked}
          disabled={checking080}
          aria-describedby={hintId}
          onChange={(event) => onCheckedChange(event.target.checked)}
        />
        {checking080 ? "080 번호 확인 중..." : "광고성 문자로 발송"}
      </label>
      <p className="form-hint" id={hintId}>
        선택하면 (광고) 표기와 무료 수신거부 문구가 발송 본문에 자동으로 포함됩니다.
      </p>

      {checked ? (
        <div className="sms-ad-settings-panel">
          <div>
            <label className="form-label" htmlFor={serviceNameId}>
              광고 서비스명
            </label>
            <input
              id={serviceNameId}
              className="form-control field-width-md"
              placeholder="서비스명 입력"
              value={serviceName}
              onChange={(event) => onServiceNameChange(event.target.value)}
            />
          </div>
          {setupStatusLabel ? (
            <div className="sms-ad-status">
              <span className="label-dot" />
              <span>
                {approved080Label ? `080수신 거부 번호: ${approved080Label}` : `080수신 거부 서비스: ${setupStatusLabel}`}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function SmsAdvertisementSetupDialog({
  open,
  pendingCount,
  returnFocusRef,
  onManage080,
  onClose,
}: {
  open: boolean;
  pendingCount?: number;
  returnFocusRef: RefObject<HTMLElement | null>;
  onManage080: () => void;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <ThemeProvider colorMode="light" dayScheme="light" preventSSRMismatch>
      <Dialog
        title="광고성 문자 설정"
        subtitle="080수신 거부 서비스 확인"
        onClose={onClose}
        returnFocusRef={returnFocusRef}
        position={{ narrow: "fullscreen", regular: "center" }}
        width="medium"
        className="sms-ad-dialog"
      >
        <div className="sms-ad-dialog-body">
          <Banner
            title="승인된 080 수신거부 번호가 필요합니다"
            description="정보통신망법의 강화에 따라 광고 문자를 발송하실 경우 080 수신거부 서비스에 의무적으로 가입해야 합니다."
            variant="warning"
          />
          <Text as="p" size="small" className="sms-ad-dialog-copy">
            설정에서 080 번호를 신규 신청하거나 이미 보유한 번호를 등록 신청해 주세요. 내부 승인 후 광고성 문자 발송을 선택할 수 있습니다.
          </Text>
          {pendingCount ? (
            <Text as="p" size="small" className="sms-ad-dialog-copy">
              현재 승인 대기 중인 080 신청이 {pendingCount}건 있습니다. 승인 상태와 반려 사유는 080 설정 탭에서 확인할 수 있습니다.
            </Text>
          ) : null}
          <div className="sms-ad-dialog-actions">
            <Button onClick={onClose}>취소</Button>
            <Button variant="primary" leadingVisual={PlusCircleIcon} onClick={onManage080}>
              080 설정으로 이동
            </Button>
          </div>
        </div>
      </Dialog>
    </ThemeProvider>
  );
}
