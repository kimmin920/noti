"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import {
  MANUAL_MESSAGE_RECIPIENT_LIMIT,
  formatRecipientCountText,
  formatRecipientPhone,
  getRecipientPhoneKey,
} from "@/lib/recipient-phone-list";

export function ManualRecipientListInput({
  phones,
  onChange,
  onOpenSelect,
  selectOpen,
  maxCount = MANUAL_MESSAGE_RECIPIENT_LIMIT,
}: {
  phones: string[];
  onChange: (phones: string[]) => void;
  onOpenSelect: () => void;
  selectOpen: boolean;
  maxCount?: number;
}) {
  const inputId = useId();
  const statusId = useId();
  const [draftPhone, setDraftPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  const addPhone = () => {
    const value = draftPhone.trim();
    const key = getRecipientPhoneKey(value);

    if (!value) {
      setError("추가할 수신번호를 입력해 주세요.");
      return;
    }

    if (/[\n,;]/.test(value)) {
      setError("수신번호는 하나씩 추가해 주세요.");
      return;
    }

    if (!key) {
      setError("유효한 수신번호를 입력해 주세요.");
      return;
    }

    if (phones.length >= maxCount) {
      setError(`수신자는 최대 ${maxCount}명까지 추가할 수 있습니다.`);
      return;
    }

    if (phones.some((phone) => getRecipientPhoneKey(phone) === key)) {
      setError("이미 추가된 수신번호입니다.");
      return;
    }

    onChange([...phones, formatRecipientPhone(value)]);
    setDraftPhone("");
    setError(null);
  };

  const removePhone = (phoneToRemove: string) => {
    const keyToRemove = getRecipientPhoneKey(phoneToRemove);
    onChange(phones.filter((phone) => getRecipientPhoneKey(phone) !== keyToRemove));
    setError(null);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    addPhone();
  };

  return (
    <div className="manual-recipient-field">
      <div className="manual-recipient-add-row">
        <input
          id={inputId}
          className="form-control manual-recipient-number-input"
          placeholder="010-0000-0000"
          value={draftPhone}
          onChange={(event) => {
            setDraftPhone(event.target.value);
            setError(null);
          }}
          onKeyDown={handleInputKeyDown}
          aria-describedby={statusId}
        />
        <button type="button" className="btn btn-default btn-sm" onClick={addPhone}>
          <AppIcon name="plus" className="icon icon-14" />
          추가
        </button>
        <button
          type="button"
          className="btn btn-default btn-sm"
          aria-haspopup="dialog"
          aria-expanded={selectOpen}
          aria-label={phones.length > 0 ? `수신자 선택, 현재 ${phones.length}명 추가됨` : "수신자 선택"}
          onClick={onOpenSelect}
        >
          <AppIcon name="users" className="icon icon-14" />
          수신자 선택
        </button>
      </div>

      {phones.length > 0 ? (
        <ul className="manual-recipient-list" aria-label="추가된 수신번호">
          {phones.map((phone) => (
            <li className="manual-recipient-item" key={getRecipientPhoneKey(phone)}>
              <span className="manual-recipient-phone">{formatRecipientPhone(phone)}</span>
              <button
                type="button"
                className="manual-recipient-remove"
                onClick={() => removePhone(phone)}
                aria-label={`${formatRecipientPhone(phone)} 삭제`}
              >
                <AppIcon name="x" className="icon icon-12" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="manual-recipient-empty">추가된 수신번호가 없습니다.</div>
      )}

      <p id={statusId} className={`form-hint${error ? " form-field-error" : ""}`} aria-live="polite">
        {error ?? `${formatRecipientCountText(phones.length)} 추가됨 · 최대 ${maxCount}명`}
      </p>
    </div>
  );
}
