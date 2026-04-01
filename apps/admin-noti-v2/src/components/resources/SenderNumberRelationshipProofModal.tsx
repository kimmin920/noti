"use client";

import { useRef, useState } from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import { SenderNumberRelationshipProofDocument } from "@/components/resources/SenderNumberRelationshipProofDocument";
import { SenderLetterStampUploadModal } from "@/components/resources/SenderLetterStampUploadModal";
import { downloadElementAsPdf } from "@/lib/export-pdf";
import {
  buildInitialRelationshipProofDraft,
  type RelationshipProofDraft,
} from "@/lib/resources/sender-number-relationship-proof";

type SenderNumberRelationshipProofModalProps = {
  open: boolean;
  initialPhoneNumber: string;
  onClose: () => void;
};

export function SenderNumberRelationshipProofModal({
  open,
  initialPhoneNumber,
  onClose,
}: SenderNumberRelationshipProofModalProps) {
  const [draft, setDraft] = useState<RelationshipProofDraft>(() =>
    buildInitialRelationshipProofDraft(initialPhoneNumber),
  );
  const [error, setError] = useState<string | null>(null);
  const [savingPdf, setSavingPdf] = useState(false);
  const [stampModalOpen, setStampModalOpen] = useState(false);
  const pdfRef = useRef<HTMLDivElement | null>(null);

  if (!open) {
    return null;
  }

  const updateField = <K extends keyof RelationshipProofDraft>(
    key: K,
    value: RelationshipProofDraft[K],
  ) => {
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
        `발신번호_관계확인서_${(draft.targetPhoneNumber || "draft").replace(/[^\dA-Za-z_-]/g, "")}.pdf`,
      );
    } catch (printError) {
      setError(printError instanceof Error ? printError.message : "PDF 저장에 실패했습니다.");
    } finally {
      setSavingPdf(false);
    }
  };

  const hasUploadedOwnerStamp = Boolean(draft.ownerStamp?.dataUrl);

  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div className="modal modal-xl sender-letter-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header" style={{ padding: "14px 20px" }}>
          <div className="modal-title">
            <AppIcon name="template" className="icon icon-18" />
            사업자 관계 확인서 작성
          </div>
          <button className="modal-close" onClick={onClose} aria-label="관계 확인서 작성 닫기">
            <AppIcon name="x" className="icon icon-18" />
          </button>
        </div>
        <div className="modal-body">
          <div className="sender-letter-editor-shell">
            <div className="flash flash-attention">
              <AppIcon name="warn" className="icon icon-16 flash-icon" />
              <div className="flash-body">
                이 문서는 관계 증빙용 초안입니다. 문서 안에서 직접 내용을 수정하고, 번호 명의 사업자 인감이 필요하면 별도 파일을 올려 `(인)` 위치에 배치할 수 있습니다. 비주오 인감은 기본으로 적용되어 있습니다.
              </div>
            </div>

            <div className="sender-letter-preview sender-letter-preview-standalone">
              <SenderNumberRelationshipProofDocument draft={draft} editable onChange={updateField} />
            </div>
          </div>
        </div>
        <div className="modal-footer" style={{ justifyContent: "space-between" }}>
          <div className="text-small" style={{ color: "var(--fg-muted)" }}>
            관계 확인 문서를 PDF로 저장한 뒤, 필요한 확인 절차를 완료한 후 업로드해 주세요.
          </div>
          <div className="form-row-inline">
            {error ? <span className="text-small text-danger">{error}</span> : null}
            <button className="btn btn-default" type="button" onClick={onClose}>
              닫기
            </button>
            <button className="btn btn-default" type="button" onClick={() => setStampModalOpen(true)}>
              <AppIcon name="upload" className="icon icon-14" />
              {hasUploadedOwnerStamp ? "인감 파일 관리" : "인감 파일 업로드"}
            </button>
            <button className="btn btn-accent" type="button" onClick={() => void handleDownloadPdf()} disabled={savingPdf}>
              <AppIcon name="download" className="icon icon-14" />
              {savingPdf ? "PDF 저장 중..." : "PDF 저장"}
            </button>
          </div>
        </div>
        <div className="sender-letter-pdf-hidden" aria-hidden="true">
          <div ref={pdfRef} className="sender-letter-pdf-surface">
            <SenderNumberRelationshipProofDocument draft={draft} />
          </div>
        </div>
        <SenderLetterStampUploadModal
          open={stampModalOpen}
          title="인감 파일 업로드"
          onClose={() => setStampModalOpen(false)}
          targets={[
            {
              key: "ownerStamp",
              label: "번호 명의 사업자 인감",
              description: "번호 명의 사업자의 인감 파일을 올립니다.",
              stamp: draft.ownerStamp,
              onChange: (stamp) => updateField("ownerStamp", stamp),
            },
          ]}
        />
      </div>
    </div>
  );
}
