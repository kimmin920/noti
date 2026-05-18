"use client";

import { SenderLetterStampField } from "@/components/resources/SenderLetterStampField";
import { type ConsentLetterDraft } from "@/lib/resources/sender-number-consent-letter";

type ConsentLetterTextKey = Exclude<keyof ConsentLetterDraft, "kind" | "ownerStamp">;
const FIXED_SERVICE_NAME = "*";

const PERSONAL_ATTACHMENTS = [
  "통신서비스이용증명원(전화번호 목록 내 기재되어 있는 전화번호와 모두 일치할 것)",
];

const BUSINESS_ATTACHMENTS = [
  "통신서비스이용증명원(전화번호 목록 내 기재되어 있는 전화번호와 모두 일치할 것)",
  "사업자등록증",
  "발신번호 명의자와 계정 명의자 간 관계를 확인할 수 있는 문서(예. 업무위수탁 계약서, 본점-지점 증빙서류 등)",
  "전화번호 목록에 임직원의 번호가 포함된 경우 해당 임직원의 재직증명서",
];

export function SenderNumberConsentLetterDocument({
  draft,
  editable = false,
  onChange,
}: {
  draft: ConsentLetterDraft;
  editable?: boolean;
  onChange?: <K extends keyof ConsentLetterDraft>(key: K, value: ConsentLetterDraft[K]) => void;
}) {
  const updateField = <K extends keyof ConsentLetterDraft>(key: K, value: ConsentLetterDraft[K]) => {
    onChange?.(key, value);
  };

  const renderField = <K extends ConsentLetterTextKey>(
    key: K,
    placeholder: string,
    options: { multiline?: boolean; className?: string } = {},
  ) => {
    const className = options.className ? ` ${options.className}` : "";

    if (!editable) {
      return <span className={`sender-consent-letter-value${className}`}>{draft[key] || " "}</span>;
    }

    if (options.multiline) {
      return (
        <textarea
          className={`sender-consent-letter-inline-textarea${className}`}
          value={draft[key]}
          onChange={(event) => updateField(key, event.target.value as ConsentLetterDraft[K])}
          placeholder={placeholder}
          aria-label={placeholder}
        />
      );
    }

    return (
      <input
        className={`sender-consent-letter-inline-input${className}`}
        value={draft[key]}
        onChange={(event) => updateField(key, event.target.value as ConsentLetterDraft[K])}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    );
  };

  const attachments = draft.kind === "business" ? BUSINESS_ATTACHMENTS : PERSONAL_ATTACHMENTS;
  const typeLabel = draft.kind === "business" ? "사업자(타사 소속 임직원 포함)" : "개인";

  return (
    <div className={`sender-letter-doc sender-consent-letter-doc${editable ? " editable" : ""}`}>
      <div className="sender-consent-letter-kicker">{`<전화번호 이용 승낙서 - ${typeLabel}>`}</div>
      <div className="sender-consent-letter-frame">
        <div className="sender-consent-letter-title">전화번호 이용 승낙서</div>

        <p className="sender-consent-letter-intro">
          <span>발신번호 명의자는 [</span>
          <span className="sender-consent-letter-value sender-consent-letter-service-field">{FIXED_SERVICE_NAME}</span>
          <span>] 서비스 계정 명의자에게 발신번호 명의자의 아래와 같은 전화번호 사용을 허락함.</span>
        </p>

        <ul className="sender-consent-letter-list">
          <li>
            <span className="sender-consent-letter-label">발신번호 명의자 정보:</span>
            {renderField("ownerName", draft.kind === "business" ? "예: 주식회사 예시" : "예: 홍길동")}
          </li>
          <li>
            <span className="sender-consent-letter-label">계정 명의자 정보:</span>
            <span className="sender-consent-letter-value sender-consent-letter-account-field">
              {draft.userName || " "}
            </span>
          </li>
          <li>
            <span className="sender-consent-letter-label">목적:</span>
            {renderField("delegationPurpose", "예: 알림톡 및 문자 발송 서비스 이용", {
              className: "sender-consent-letter-purpose-field",
            })}
          </li>
          <li>
            <span className="sender-consent-letter-label">전화번호 목록:</span>
            {renderField("targetPhoneNumber", "예: 01012345678")}
          </li>
          <li className="sender-consent-letter-attachments">
            <span className="sender-consent-letter-label">별첨:</span>
            <span>아래와 같은 서류를 함께 제출할 것</span>
            <ol>
              {attachments.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </li>
        </ul>

        <div className="sender-consent-letter-sign-row">
          <span className="sender-consent-letter-sign-label">발신번호 명의자</span>
          {editable ? (
            <input
              className="sender-consent-letter-sign-input"
              value={draft.ownerName}
              onChange={(event) => updateField("ownerName", event.target.value)}
              placeholder={draft.kind === "business" ? "회사명" : "성명"}
              aria-label="발신번호 명의자"
            />
          ) : (
            <span className="sender-consent-letter-sign-name">{draft.ownerName || " "}</span>
          )}
          <SenderLetterStampField
            stamp={draft.ownerStamp}
            editable={editable}
            surfaceWidth={52}
            surfaceHeight={52}
            onChange={(nextStamp) => updateField("ownerStamp", nextStamp)}
          />
        </div>
      </div>
    </div>
  );
}
