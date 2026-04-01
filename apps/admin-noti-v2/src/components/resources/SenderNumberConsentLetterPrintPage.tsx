"use client";

import { AppIcon } from "@/components/icons/AppIcon";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";
import { type ConsentLetterDraft } from "@/lib/resources/sender-number-consent-letter";
import { SenderNumberConsentLetterDocument } from "@/components/resources/SenderNumberConsentLetterDocument";

export function SenderNumberConsentLetterPrintPage({ draft }: { draft: ConsentLetterDraft }) {
  useMountEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        window.print();
      } catch {
        // Let the user print manually if the browser blocks automatic printing.
      }
    }, 180);

    return () => window.clearTimeout(timeoutId);
  });

  return (
    <main className="sender-letter-print-page">
      <div className="sender-letter-print-toolbar">
        <div className="sender-letter-print-toolbar-copy">
          새 탭에서 문서를 열었습니다. 자동으로 인쇄 창이 열리지 않으면 아래 버튼이나 브라우저 인쇄 기능을 사용해 주세요.
        </div>
        <div className="form-row-inline">
          <button type="button" className="btn btn-default" onClick={() => window.close()}>
            닫기
          </button>
          <button type="button" className="btn btn-accent" onClick={() => window.print()}>
            <AppIcon name="download" className="icon icon-14" />
            인쇄/PDF 저장
          </button>
        </div>
      </div>
      <div className="sender-letter-print-sheet">
        <SenderNumberConsentLetterDocument draft={draft} />
      </div>
    </main>
  );
}
