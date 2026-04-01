"use client";

import { useEffect, useMemo, useRef } from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import { RotaryDial } from "@/lib/sms/rotary-dial";

function toDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function formatPhoneNumber(value: string) {
  const digits = toDigits(value);

  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

export function SmsRecipientDialSheet({
  open,
  value,
  onChange,
  onClose,
  title = "수신번호 입력",
  subtitle = "다이얼을 돌려 번호를 입력하세요.",
}: {
  open: boolean;
  value: string;
  onChange: (next: string) => void;
  onClose: () => void;
  title?: string;
  subtitle?: string;
}) {
  const digits = useMemo(() => toDigits(value), [value]);
  const dialMountRef = useRef<HTMLDivElement | null>(null);
  const dialInstanceRef = useRef<RotaryDial | null>(null);
  const digitsRef = useRef(digits);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    digitsRef.current = digits;
  }, [digits]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !dialMountRef.current) return;

    const dialSize = window.innerWidth <= 380 ? 286 : 312;

    dialInstanceRef.current = new RotaryDial({
      mount: dialMountRef.current,
      size: dialSize,
      discFillColor: "#1f1914",
      discStrokeColor: "#4a3a2a",
      circlesFillColor: "#f1e4c8",
      circlesStrokeColor: "#3a2c20",
      circlesHighlightColor: "#e3d3b0",
      textFillColor: "#2e2418",
      textStrokeColor: "transparent",
      arrowFillColor: "#4a3b2d",
      arrowStrokeColor: "transparent",
      callback: (number) => {
        const nextDigits = `${digitsRef.current}${number}`.slice(0, 11);
        onChangeRef.current(formatPhoneNumber(nextDigits));
      },
    });

    return () => {
      dialInstanceRef.current?.destroy();
      dialInstanceRef.current = null;
    };
  }, [open]);

  const handleBackspace = () => {
    if (!digits.length) return;
    onChange(formatPhoneNumber(digits.slice(0, -1)));
  };

  const handleReset = () => {
    if (!digits.length) return;
    onChange("");
  };

  if (!open) return null;

  return (
    <div className="sms-dial-sheet-backdrop" onClick={onClose}>
      <div className="sms-dial-sheet vintage" onClick={(event) => event.stopPropagation()}>
        <div className="sms-dial-sheet-handle" />
        <div className="sms-dial-sheet-head">
          <div className="sms-dial-sheet-title-wrap">
            <div className="sms-dial-sheet-title">{title}</div>
            <div className="sms-dial-sheet-subtitle">{subtitle}</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="다이얼 입력 닫기">
            <AppIcon name="x" className="icon icon-18" />
          </button>
        </div>

        <div className="sms-dial-sheet-display">
          <span className={`sms-dial-sheet-value${digits ? "" : " placeholder"}`}>
            {digits ? formatPhoneNumber(digits) : "010-0000-0000"}
          </span>
          <span className="sms-dial-sheet-count">{digits.length} / 11</span>
        </div>

        <div className="sms-dial-stage">
          <div className="sms-dial-body-shadow" />
          <div className="sms-dial-canvas-wrap">
            <div ref={dialMountRef} className="sms-dial-canvas-host" />
          </div>
        </div>

        <div className="sms-dial-sheet-actions">
          <button className="btn btn-default" onClick={handleReset} disabled={!digits.length}>
            전체 삭제
          </button>
          <button className="btn btn-default" onClick={handleBackspace} disabled={!digits.length}>
            ← 지우기
          </button>
          <button className="btn btn-accent" onClick={onClose}>
            완료
          </button>
        </div>
      </div>
    </div>
  );
}
