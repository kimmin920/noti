"use client";

import { useMemo, useState } from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import { SmsRecipientDialSheet } from "@/components/sms/SmsRecipientDialSheet";

type ActiveField = "sender" | "recipient" | null;

function toDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function formatPhoneNumber(value: string) {
  const digits = toDigits(value);

  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

function getByteLength(text: string) {
  return new Blob([text]).size;
}

function getSmsType(body: string) {
  return getByteLength(body) > 90 ? "lms" as const : "sms" as const;
}

export function MockSmsPage() {
  const [senderPhone, setSenderPhone] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("");
  const [scheduleType, setScheduleType] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [activeField, setActiveField] = useState<ActiveField>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const currentDialValue = useMemo(() => {
    if (activeField === "sender") return senderPhone;
    if (activeField === "recipient") return recipientPhone;
    return "";
  }, [activeField, recipientPhone, senderPhone]);

  const byteCount = useMemo(() => getByteLength(body), [body]);
  const smsType = useMemo(() => getSmsType(body), [body]);
  const maxBytes = smsType === "sms" ? 90 : 2000;

  const typeMeta = {
    sms: {
      badgeClass: "chip chip-sms",
      label: "SMS",
      reason: `${byteCount} byte · 90 이하 · 이미지 없음`,
    },
    lms: {
      badgeClass: "chip chip-event",
      label: "LMS",
      reason: `${byteCount} byte · 90 초과 → LMS 전환`,
    },
  }[smsType];

  const handleDialChange = (next: string) => {
    if (activeField === "sender") {
      setSenderPhone(next);
      return;
    }

    if (activeField === "recipient") {
      setRecipientPhone(next);
    }
  };

  const handleSend = () => {
    setResultMessage("SMS 발송 요청이 접수되었습니다.");
  };

  const handleReset = () => {
    setSenderPhone("");
    setRecipientPhone("");
    setBody("");
    setSubject("");
    setScheduleType("now");
    setScheduledAt("");
    setResultMessage(null);
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <div className="page-title">SMS 발송</div>
            <div className="page-desc">문자 메시지를 단건으로 발송합니다</div>
          </div>
        </div>
      </div>

      {resultMessage ? (
        <div className="flash flash-success">
          <AppIcon name="check" className="icon icon-16 flash-icon" />
          <div className="flash-body">{resultMessage}</div>
        </div>
      ) : null}

      <div className="sms-layout mock-sms-page">
        <div>
          <div className="box">
            <div className="box-header"><div className="box-title">발신 정보</div></div>
            <div className="box-body">
              <div className="form-group">
                <label className="form-label">발신번호 <span className="text-danger">*</span></label>
                <button
                  type="button"
                  className={`form-control sms-dial-trigger${senderPhone ? "" : " empty"}`}
                  onClick={() => setActiveField("sender")}
                >
                  {senderPhone ? formatPhoneNumber(senderPhone) : "발신번호를 입력하세요"}
                </button>
                <p className="form-hint">발신번호를 입력해 주세요.</p>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">수신번호 <span className="text-danger">*</span></label>
                <button
                  type="button"
                  className={`form-control sms-dial-trigger${recipientPhone ? "" : " empty"}`}
                  onClick={() => setActiveField("recipient")}
                >
                  {recipientPhone ? formatPhoneNumber(recipientPhone) : "수신번호를 입력하세요"}
                </button>
                <p className="form-hint">수신번호를 입력해 주세요.</p>
              </div>
            </div>
          </div>

          <div className="box">
            <div className="box-header"><div className="box-title">메시지 내용</div></div>
            <div className="box-body">
              {smsType !== "sms" ? (
                <div style={{ marginBottom: 14 }}>
                  <label className="form-label">
                    제목
                    <span style={{ fontSize: 11, fontWeight: 400, color: "var(--fg-muted)", marginLeft: 6 }}>
                      LMS 전환 시 포함됩니다
                    </span>
                  </label>
                  <input
                    className="form-control"
                    placeholder="메시지 제목 (선택)"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                  />
                </div>
              ) : null}

              <div style={{ marginBottom: 6 }}>
                <label className="form-label">본문 <span className="text-danger">*</span></label>
                <textarea
                  className="form-control"
                  placeholder="메시지 내용을 입력하세요."
                  style={{ minHeight: 120, resize: "vertical" }}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                />
              </div>

              <div className="sms-type-bar">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className={typeMeta.badgeClass + " draft-chip-sm"}>{typeMeta.label}</span>
                  <span className="sms-type-reason">{typeMeta.reason}</span>
                </div>
                <span className="sms-char-count">{byteCount} / {maxBytes} byte</span>
              </div>
            </div>
          </div>

          <div className="box">
            <div className="box-header"><div className="box-title">발송 시간</div></div>
            <div className="box-body">
              <div className="sms-schedule-options">
                <label className="sms-schedule-option">
                  <input
                    type="radio"
                    name="mockSchedType"
                    checked={scheduleType === "now"}
                    onChange={() => setScheduleType("now")}
                  />
                  즉시 발송
                </label>
                <label className="sms-schedule-option">
                  <input
                    type="radio"
                    name="mockSchedType"
                    checked={scheduleType === "later"}
                    onChange={() => setScheduleType("later")}
                  />
                  예약 발송
                </label>
              </div>
              {scheduleType === "later" ? (
                <div>
                  <input
                    type="datetime-local"
                    className="form-control field-width-md"
                    value={scheduledAt}
                    onChange={(event) => setScheduledAt(event.target.value)}
                  />
                  <p className="form-hint">야간 발송 제한: 오후 9시 ~ 오전 8시 사이 예약 불가</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="sms-action-bar">
            <button className="btn btn-default" onClick={handleReset}>
              <AppIcon name="inbox" className="icon icon-14" />
              초기화
            </button>
            <button className="btn btn-accent" onClick={handleSend}>
              <AppIcon name="send" className="icon icon-14" />
              발송하기
            </button>
          </div>
        </div>

        <div className="sms-side-column">
          <div className="box" style={{ marginBottom: 0 }}>
            <div className="box-header"><div className="box-title">미리보기</div></div>
            <div className="box-body-tight">
              <div className="sms-preview-phone">
                <div className="sms-preview-time">오늘 오후 2:30</div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div className="sms-preview-bubble">
                    {body.trim() ? body : <span className="sms-preview-placeholder">내용을 입력하면 표시됩니다</span>}
                  </div>
                </div>
                <div className="sms-preview-sender">{senderPhone || "발신번호 없음"}</div>
              </div>
            </div>
          </div>

          <div className="box" style={{ marginBottom: 0 }}>
            <div className="box-header"><div className="box-title">발송 체크리스트</div></div>
            <div className="box-section-tight">
              <div className="box-row sms-check-row">
                <div className="box-row-title text-small">발신번호</div>
                <span className={`label ${senderPhone ? "label-green" : "label-yellow"} status-label-sm`}>
                  <span className="label-dot" />
                  {senderPhone ? "입력됨" : "미입력"}
                </span>
              </div>
              <div className="box-row sms-check-row">
                <div className="box-row-title text-small">수신번호</div>
                <span className={`label ${recipientPhone ? "label-green" : "label-yellow"} status-label-sm`}>
                  <span className="label-dot" />
                  {recipientPhone ? "입력됨" : "미입력"}
                </span>
              </div>
              <div className="box-row sms-check-row">
                <div className="box-row-title text-small">본문</div>
                <span className={`label ${body.trim() ? "label-green" : "label-yellow"} status-label-sm`}>
                  <span className="label-dot" />
                  {body.trim() ? "입력됨" : "미입력"}
                </span>
              </div>
              <div className="box-row sms-check-row" style={{ borderBottom: "none" }}>
                <div className="box-row-title text-small">전송</div>
                <span className={`label ${resultMessage ? "label-green" : "label-gray"} status-label-sm`}>
                  <span className="label-dot" />
                  {resultMessage ? "OK" : "대기"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SmsRecipientDialSheet
        open={activeField !== null}
        value={currentDialValue}
        onChange={handleDialChange}
        onClose={() => setActiveField(null)}
        title={activeField === "sender" ? "발신번호 입력" : "수신번호 입력"}
        subtitle={activeField === "sender" ? "다이얼을 돌려 발신번호를 입력하세요." : "다이얼을 돌려 수신번호를 입력하세요."}
      />
    </>
  );
}
