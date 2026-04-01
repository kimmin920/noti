"use client";

import { useRef } from "react";
import type { ChangeEvent } from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import {
  buildDefaultSenderLetterStamp,
  type SenderLetterStamp,
} from "@/lib/resources/sender-letter-stamp";

type StampTarget = {
  key: string;
  label: string;
  description?: string;
  stamp: SenderLetterStamp | null;
  onChange: (stamp: SenderLetterStamp | null) => void;
};

function readImageFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("인감 파일을 읽지 못했습니다."));
    };
    reader.onerror = () => reject(new Error("인감 파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

export function SenderLetterStampUploadModal({
  open,
  title = "인감 파일 업로드",
  targets,
  onClose,
}: {
  open: boolean;
  title?: string;
  targets: StampTarget[];
  onClose: () => void;
}) {
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  if (!open) {
    return null;
  }

  const openPicker = (key: string) => {
    inputRefs.current[key]?.click();
  };

  const handleFileChange = async (key: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const target = targets.find((item) => item.key === key);
    if (!target) {
      event.target.value = "";
      return;
    }

    try {
      const dataUrl = await readImageFile(file);
      const base = target.stamp ?? buildDefaultSenderLetterStamp();
      target.onChange({ ...base, dataUrl });
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="modal-backdrop open sender-letter-stamp-upload-backdrop" onClick={onClose}>
      <div className="modal sender-letter-stamp-upload-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <AppIcon name="upload" className="icon icon-18" />
            {title}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="인감 파일 업로드 닫기">
            <AppIcon name="x" className="icon icon-18" />
          </button>
        </div>
        <div className="modal-body">
          <div className="sender-letter-stamp-upload-copy">
            인감 파일이 있다면 업로드해서 문서의 `(인)` 위치에 배치할 수 있습니다. 인감 파일이 없다면 PDF 저장 후 문서를 출력해서 직접 인감을 찍은 뒤 업로드해도 됩니다.
          </div>
          <div className="sender-letter-stamp-upload-stack">
            {targets.map((target) => (
              <div key={target.key} className="sender-letter-stamp-upload-card">
                <div className="sender-letter-stamp-upload-head">
                  <div>
                    <div className="sender-letter-stamp-upload-title">{target.label}</div>
                    {target.description ? (
                      <div className="sender-letter-stamp-upload-desc">{target.description}</div>
                    ) : null}
                  </div>
                  <div className="sender-letter-stamp-upload-preview">
                    {target.stamp?.dataUrl ? (
                      <img src={target.stamp.dataUrl} alt={`${target.label} 인감`} />
                    ) : (
                      <span>미리보기 없음</span>
                    )}
                  </div>
                </div>
                <div className="form-row-inline">
                  <input
                    ref={(node) => {
                      inputRefs.current[target.key] = node;
                    }}
                    type="file"
                    hidden
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={(event) => void handleFileChange(target.key, event)}
                  />
                  <button type="button" className="btn btn-default" onClick={() => openPicker(target.key)}>
                    <AppIcon name="upload" className="icon icon-14" />
                    {target.stamp?.dataUrl ? "인감 파일 교체" : "인감 파일 업로드"}
                  </button>
                  {target.stamp?.dataUrl ? (
                    <button
                      type="button"
                      className="btn btn-default"
                      onClick={() => target.onChange({ ...buildDefaultSenderLetterStamp(), dataUrl: "" })}
                    >
                      제거
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <div className="text-small" style={{ color: "var(--fg-muted)" }}>
            업로드 후 문서 안에서 인감을 선택해 위치와 크기를 조절할 수 있습니다.
          </div>
          <button className="btn btn-accent" type="button" onClick={onClose}>
            완료
          </button>
        </div>
      </div>
    </div>
  );
}
