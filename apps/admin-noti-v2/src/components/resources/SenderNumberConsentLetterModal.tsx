"use client";

import { useRef, useState } from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import { SenderNumberConsentLetterDocument } from "@/components/resources/SenderNumberConsentLetterDocument";
import { SenderLetterStampUploadModal } from "@/components/resources/SenderLetterStampUploadModal";
import { downloadElementAsPdf } from "@/lib/export-pdf";
import {
  buildInitialConsentLetterDraft,
  type ConsentLetterDraft,
} from "@/lib/resources/sender-number-consent-letter";

type SenderNumberConsentLetterModalProps = {
  open: boolean;
  initialPhoneNumber: string;
  onClose: () => void;
};

export function SenderNumberConsentLetterModal({
  open,
  initialPhoneNumber,
  onClose,
}: SenderNumberConsentLetterModalProps) {
  const [draft, setDraft] = useState<ConsentLetterDraft>(() => buildInitialConsentLetterDraft(initialPhoneNumber));
  const [error, setError] = useState<string | null>(null);
  const [savingPdf, setSavingPdf] = useState(false);
  const [stampModalOpen, setStampModalOpen] = useState(false);
  const pdfRef = useRef<HTMLDivElement | null>(null);

  if (!open) {
    return null;
  }

  const updateField = <K extends keyof ConsentLetterDraft>(key: K, value: ConsentLetterDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleDownloadPdf = async () => {
    try {
      setError(null);
      if (!pdfRef.current) {
        throw new Error("PDF로 저장할 문서를 찾지 못했습니다.");
      }
      setSavingPdf(true);
      await downloadElementAsPdf(
        pdfRef.current,
        `발신번호_이용승낙서_${(draft.targetPhoneNumber || "draft").replace(/[^\dA-Za-z_-]/g, "")}.pdf`,
      );
    } catch (printError) {
      setError(printError instanceof Error ? printError.message : "PDF 저장에 실패했습니다.");
    } finally {
      setSavingPdf(false);
    }
  };

  const hasUploadedStamp = Boolean(draft.ownerStamp?.dataUrl);

  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div className="modal modal-xl sender-letter-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header" style={{ padding: "14px 20px" }}>
          <div className="modal-title">
            <AppIcon name="template" className="icon icon-18" />
            발신번호 이용 위임장 작성
          </div>
          <button className="modal-close" onClick={onClose} aria-label="위임장 작성 닫기">
            <AppIcon name="x" className="icon icon-18" />
          </button>
        </div>
        <div className="modal-body">
          <div className="sender-letter-editor-shell">
            <div className="flash flash-attention">
              <AppIcon name="warn" className="icon icon-16 flash-icon" />
              <div className="flash-body">
                이 문서는 초안 작성용입니다. 문서 안에서 직접 내용을 수정하고, 필요하면 별도의 인감 파일을 올려 `(인)` 위치에 배치할 수 있습니다. PDF 저장 후 <strong>인감 날인</strong>을 완료한 문서를 업로드해 주세요.
              </div>
            </div>

            <div className="sender-letter-preview sender-letter-preview-standalone">
              <SenderNumberConsentLetterDocument draft={draft} editable onChange={updateField} />
            </div>
          </div>
        </div>
        <div className="modal-footer" style={{ justifyContent: "space-between" }}>
          <div className="text-small" style={{ color: "var(--fg-muted)" }}>
            인감 날인 필수, 서명 불가. PDF로 저장한 뒤 인감 날인 후 업로드해 주세요.
          </div>
          <div className="form-row-inline">
            {error ? <span className="text-small text-danger">{error}</span> : null}
            <button className="btn btn-default" type="button" onClick={onClose}>
              닫기
            </button>
            <button className="btn btn-default" type="button" onClick={() => setStampModalOpen(true)}>
              <AppIcon name="upload" className="icon icon-14" />
              {hasUploadedStamp ? "인감 파일 관리" : "인감 파일 업로드"}
            </button>
            <button className="btn btn-accent" type="button" onClick={() => void handleDownloadPdf()} disabled={savingPdf}>
              <AppIcon name="download" className="icon icon-14" />
              {savingPdf ? "PDF 저장 중..." : "PDF 저장"}
            </button>
          </div>
        </div>
        <div className="sender-letter-pdf-hidden" aria-hidden="true">
          <div ref={pdfRef} className="sender-letter-pdf-surface">
            <SenderNumberConsentLetterDocument draft={draft} />
          </div>
        </div>
        <SenderLetterStampUploadModal
          open={stampModalOpen}
          title="인감 파일 업로드"
          onClose={() => setStampModalOpen(false)}
          targets={[
            {
              key: "ownerStamp",
              label: "위임인(발신번호 소유자) 인감",
              description: "파일을 올린 뒤 문서 안의 (인) 위치에서 드래그하거나 크기를 조절할 수 있습니다.",
              stamp: draft.ownerStamp,
              onChange: (stamp) => updateField("ownerStamp", stamp),
            },
          ]}
        />
      </div>
    </div>
  );
}
