"use client";

import { SenderLetterStampField } from "@/components/resources/SenderLetterStampField";
import {
  RELATIONSHIP_TYPE_OPTIONS,
  type RelationshipProofDraft,
  formatRelationshipProofSignedDate,
} from "@/lib/resources/sender-number-relationship-proof";

export function SenderNumberRelationshipProofDocument({
  draft,
  editable = false,
  onChange,
}: {
  draft: RelationshipProofDraft;
  editable?: boolean;
  onChange?: <K extends keyof RelationshipProofDraft>(key: K, value: RelationshipProofDraft[K]) => void;
}) {
  const updateField = <K extends keyof RelationshipProofDraft>(
    key: K,
    value: RelationshipProofDraft[K],
  ) => {
    onChange?.(key, value);
  };

  type RelationshipProofTextKey = Exclude<
    keyof RelationshipProofDraft,
    "ownerStamp" | "userStamp"
  >;

  const renderField = <K extends RelationshipProofTextKey>(
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
          onChange={(event) => updateField(key, event.target.value as RelationshipProofDraft[K])}
          placeholder={placeholder}
        />
      );
    }

    return (
      <input
        className="sender-letter-inline-input"
        value={draft[key]}
        onChange={(event) => updateField(key, event.target.value as RelationshipProofDraft[K])}
        placeholder={placeholder}
      />
    );
  };

  const renderRelationshipType = () => {
    if (!editable) {
      return draft.relationshipType || " ";
    }

    return (
      <select
        className="sender-letter-inline-select"
        value={draft.relationshipType}
        onChange={(event) =>
          updateField("relationshipType", event.target.value as RelationshipProofDraft["relationshipType"])
        }
      >
        {RELATIONSHIP_TYPE_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  };

  return (
    <div className={`sender-letter-doc${editable ? " editable" : ""}`}>
      <div className="sender-letter-doc-title">관계 확인서</div>
      <div className="sender-letter-doc-subtitle">발신번호 사용 관계 확인서</div>

      <div className="sender-letter-preview-section">
        <div className="sender-letter-preview-heading">1. 번호 명의 사업자</div>
        <table className="sender-letter-table">
          <tbody>
            <tr><td>상호</td><td>{renderField("ownerCompanyName", "예: 주식회사 예시")}</td></tr>
            <tr><td>사업자등록번호</td><td>{renderField("ownerBusinessNumber", "예: 123-45-67890")}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="sender-letter-preview-section">
        <div className="sender-letter-preview-heading">2. 실제 이용 사업자(수임인)</div>
        <table className="sender-letter-table">
          <tbody>
            <tr><td>상호</td><td>비주오(VIZUO)</td></tr>
            <tr><td>사업자등록번호</td><td>519-24-02167</td></tr>
          </tbody>
        </table>
      </div>

      <div className="sender-letter-preview-section">
        <div className="sender-letter-preview-heading">3. 대상 발신번호 및 관계</div>
        <table className="sender-letter-table">
          <tbody>
            <tr><td>발신번호</td><td>{renderField("targetPhoneNumber", "예: 0212345678")}</td></tr>
            <tr><td>관계 유형</td><td>{renderRelationshipType()}</td></tr>
            <tr><td>관계 설명</td><td>{renderField("relationshipDescription", "예: 위수탁 계약에 따라 발신번호 사용을 허락합니다.", true)}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="sender-letter-preview-section">
        <div className="sender-letter-preview-heading">4. 사용 정보</div>
        <table className="sender-letter-table">
          <tbody>
            <tr><td>사용 목적</td><td>{renderField("usagePurpose", "예: 메시지 발송 서비스 이용", true)}</td></tr>
            <tr><td>사용 기간</td><td>{renderField("usagePeriod", "예: 서비스 이용 신청일부터 서비스 이용 종료일까지")}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="sender-letter-preview-note">
        번호 명의 사업자와 실제 이용 사업자는 상기와 같은 관계에 있으며, 실제 이용 사업자(수임인)는 위 발신번호를 메시지 발송 목적으로 사용할 수 있음을 확인합니다. 본 확인서는 발신번호 사용 관계를 증빙하기 위한 목적으로 작성되었습니다.
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
          formatRelationshipProofSignedDate(draft.signedDate)
        )}
      </div>
      <div className="sender-letter-proof-sign-grid">
        <div className="sender-letter-proof-sign-card">
          <div className="sender-letter-proof-sign-title">번호 명의 사업자</div>
          {editable ? (
            <input
              className="sender-letter-proof-sign-name-input"
              value={draft.ownerCompanyName}
              onChange={(event) => updateField("ownerCompanyName", event.target.value)}
              placeholder="사업자명 또는 이름"
            />
          ) : (
            <div className="sender-letter-proof-sign-name">{draft.ownerCompanyName || " "}</div>
          )}
          <div className="sender-letter-proof-sign-stamp-wrap">
            <SenderLetterStampField
              stamp={draft.ownerStamp}
              editable={editable}
              onChange={(nextStamp) => updateField("ownerStamp", nextStamp)}
            />
          </div>
        </div>
        <div className="sender-letter-proof-sign-card">
          <div className="sender-letter-proof-sign-title">실제 이용 사업자(수임인)</div>
          <div className="sender-letter-proof-sign-name">비주오(VIZUO)</div>
          <div className="sender-letter-proof-sign-stamp-wrap">
            <SenderLetterStampField
              stamp={draft.userStamp}
              editable={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
