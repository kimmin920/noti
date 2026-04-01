"use client";

import { SenderLetterStampField } from "@/components/resources/SenderLetterStampField";
import {
  type ConsentLetterDraft,
  formatConsentLetterSignedDate,
} from "@/lib/resources/sender-number-consent-letter";

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

  type ConsentLetterTextKey = Exclude<keyof ConsentLetterDraft, "ownerStamp">;

  const renderField = <K extends ConsentLetterTextKey>(
    key: K,
    placeholder: string,
    multiline = false,
  ) => {
    if (!editable) {
      return draft[key] || " ";
    }

    if (multiline) {
      return (
        <textarea
          className="sender-letter-inline-textarea"
          value={draft[key]}
          onChange={(event) => updateField(key, event.target.value as ConsentLetterDraft[K])}
          placeholder={placeholder}
        />
      );
    }

    return (
      <input
        className="sender-letter-inline-input"
        value={draft[key]}
        onChange={(event) => updateField(key, event.target.value as ConsentLetterDraft[K])}
        placeholder={placeholder}
      />
    );
  };

  return (
    <div className={`sender-letter-doc${editable ? " editable" : ""}`}>
      <div className="sender-letter-doc-title">위 임 장</div>
      <div className="sender-letter-doc-subtitle">발신번호 이용 동의서</div>

      <div className="sender-letter-preview-section">
        <div className="sender-letter-preview-heading">1. 위임 내용</div>
        <table className="sender-letter-table">
          <tbody>
            <tr><td>등록 대상 발신번호</td><td>{renderField("targetPhoneNumber", "예: 0212345678")}</td></tr>
            <tr><td>위임 기간</td><td>{renderField("delegationPeriod", "예: 서비스 이용 신청일부터 종료일까지")}</td></tr>
            <tr><td>위임 목적</td><td>{renderField("delegationPurpose", "예: 알림톡 및 문자 발송 서비스 이용", true)}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="sender-letter-preview-section">
        <div className="sender-letter-preview-heading">2. 위임인 (발신번호 소유자)</div>
        <table className="sender-letter-table">
          <tbody>
            <tr><td>회사명(성명)</td><td>{renderField("ownerName", "예: 홍길동 / 주식회사 예시")}</td></tr>
            <tr><td>사업자등록번호(생년월일)</td><td>{renderField("ownerRegistrationNumber", "예: 123-45-67890")}</td></tr>
            <tr><td>주소</td><td>{renderField("ownerAddress", "예: 서울시 강남구 ...", true)}</td></tr>
            <tr><td>전화번호(휴대전화번호)</td><td>{renderField("ownerPhone", "예: 010-1234-5678")}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="sender-letter-preview-section">
        <div className="sender-letter-preview-heading">3. 수임인 (발신번호 이용자)</div>
        <table className="sender-letter-table">
          <tbody>
            <tr><td>회사명</td><td>{draft.userName || "비주오(VIZUO)"}</td></tr>
            <tr><td>사업자등록번호</td><td>{draft.userRegistrationNumber || "519-24-02167"}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="sender-letter-preview-note">
        본인(위임인)은 등록 대상 발신번호의 적법한 권리자로서 수임인(발신번호 이용자)가 메시지 발송 서비스를 이용함에 있어 발신번호 등록 및 사용에 관하여 상기와 같이 수임인에게 권리를 위임합니다. 위임 기간 중 수임인(발신번호 이용자)이 요청한 내용으로 인하여 발생하는 문제에 대하여 본인(위임인)이 모든 책임을 부담함을 확인합니다.
      </div>
      <div className="sender-letter-preview-sign-date">
        {editable ? (
          <input
            className="sender-letter-inline-date"
            type="date"
            value={draft.signedDate}
            onChange={(event) => updateField("signedDate", event.target.value)}
          />
        ) : (
          formatConsentLetterSignedDate(draft.signedDate)
        )}
      </div>
      <div className="sender-letter-preview-sign-row">
        <span className="sender-letter-preview-sign-label">위임인</span>
        {editable ? (
          <input
            className="sender-letter-preview-sign-name-input"
            value={draft.ownerName}
            onChange={(event) => updateField("ownerName", event.target.value)}
            placeholder="이름"
          />
        ) : (
          <span className="sender-letter-preview-sign-name-text">
            {draft.ownerName || " "}
          </span>
        )}
        <SenderLetterStampField
          stamp={draft.ownerStamp}
          editable={editable}
          onChange={(nextStamp) => updateField("ownerStamp", nextStamp)}
        />
      </div>
    </div>
  );
}
