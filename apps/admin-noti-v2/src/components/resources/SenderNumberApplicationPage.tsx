"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppIcon } from "@/components/icons/AppIcon";
import { createV2SenderNumberApplication } from "@/lib/api/v2";
import { useEffectEvent } from "react";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";
import { buildResourcesTabPath } from "@/lib/routes";
import { SenderNumberConsentLetterModal } from "@/components/resources/SenderNumberConsentLetterModal";
import { SenderNumberRelationshipProofModal } from "@/components/resources/SenderNumberRelationshipProofModal";

type SenderNumberType = "COMPANY" | "EMPLOYEE";
type SenderDocKey =
  | "telecomCertificate"
  | "consentDocument"
  | "personalInfoConsent"
  | "thirdPartyBusinessRegistration"
  | "relationshipProof";

type DocConfig = {
  key: SenderDocKey;
  title: string;
  description: string;
  helpTitle: string;
  helpLines: string[];
};

const ACCEPTED_FILE_TYPES = ".pdf,.jpg,.jpeg,.png";

const COMMON_DOCS: DocConfig[] = [
  {
    key: "telecomCertificate",
    title: "통신서비스 이용증명원",
    description: "번호 이용 사실과 가입자 정보를 확인할 수 있는 문서를 업로드하세요.",
    helpTitle: "어떤 문서인가요?",
    helpLines: [
      "통신사마다 문서 이름이 조금 다를 수 있습니다.",
      "통신서비스 이용증명원, 가입사실확인서, 서비스 이용증명서처럼 표시될 수 있습니다.",
      "현재 번호의 이용 사실과 가입자 정보를 확인할 수 있는 문서를 준비해 주세요.",
    ],
  },
  {
    key: "consentDocument",
    title: "이용승낙서",
    description: "발신번호 사용에 대한 동의 내용을 확인할 수 있는 문서를 업로드하세요.",
    helpTitle: "무엇을 확인하나요?",
    helpLines: [
      "번호 사용에 대한 동의를 확인하는 문서입니다.",
      "번호 명의자와 실제 이용 주체가 다를 때 특히 중요합니다.",
      "서명 또는 날인이 필요한 양식을 사용 중이라면 서명 완료본을 업로드해 주세요.",
    ],
  },
];

const EMPLOYEE_DOCS: DocConfig[] = [
  {
    key: "personalInfoConsent",
    title: "개인정보 수집·이용 동의서",
    description: "위임인이 개인(발신번호 소유자)인 경우 개인정보 처리 동의 문서를 업로드하세요.",
    helpTitle: "왜 필요한가요?",
    helpLines: [
      "개인 명의 번호 신청 시 위임인의 이름, 주소, 생년월일, 연락처 같은 개인정보가 포함될 수 있습니다.",
      "로그인한 신청자와 번호 소유자가 다를 수 있어, 개인정보를 받아 검토하고 제출하는 근거가 필요합니다.",
      "위임인이 개인인 경우 작성된 동의서를 함께 제출해 주세요.",
    ],
  },
];

const COMPANY_DOCS: DocConfig[] = [
  {
    key: "thirdPartyBusinessRegistration",
    title: "타사 사업자등록증",
    description: "발신번호 명의 사업자의 사업자등록증을 업로드하세요.",
    helpTitle: "왜 필요한가요?",
    helpLines: [
      "현재 신청 사업자가 아닌, 번호 명의 기준의 사업자등록증이 필요할 수 있습니다.",
      "발신번호 명의자가 실제로 존재하는 사업자인지 확인하기 위한 문서입니다.",
    ],
  },
  {
    key: "relationshipProof",
    title: "사업자와 타사 간 관계 확인 문서",
    description: "계약서 또는 확인서처럼 관계를 증빙할 수 있는 문서를 업로드하세요.",
    helpTitle: "어떤 문서가 가능한가요?",
    helpLines: [
      "번호 명의자와 현재 신청 사업자의 관계를 확인할 수 있는 문서가 필요합니다.",
      "계약서, 위수탁 확인서, 관계 확인서 등 관계와 사용 목적이 드러나는 문서를 제출해 주세요.",
    ],
  },
];

function normalizePhoneNumber(value: string) {
  return value.replace(/[^\d]/g, "");
}

function FileUploadRow({
  config,
  required,
  file,
  helpOpen,
  composeEnabled,
  onChange,
  onToggleHelp,
  onCompose,
}: {
  config: DocConfig;
  required: boolean;
  file: File | null;
  helpOpen: boolean;
  composeEnabled?: boolean;
  onChange: (file: File | null) => void;
  onToggleHelp: (key: SenderDocKey) => void;
  onCompose?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.files?.[0] ?? null);
  };

  const handleClear = () => {
    if (inputRef.current) {
      inputRef.current.value = "";
    }

    onChange(null);
  };

  return (
    <div className="sender-doc-row">
      <div className="sender-doc-main">
        <div className="sender-doc-title-row">
          <div className="sender-doc-title">
            {config.title}
            {required ? <span className="text-danger"> *</span> : null}
          </div>
          <div className="sender-doc-help" data-sender-doc-help>
            <button type="button" className="sender-doc-help-trigger" onClick={() => onToggleHelp(config.key)}>
              <AppIcon name="info" className="icon icon-12" />
              도움말
            </button>
            <div className={`sender-doc-help-popover${helpOpen ? " open" : ""}`}>
              <div className="sender-doc-help-title">{config.helpTitle}</div>
              <div className="sender-doc-help-lines">
                {config.helpLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="sender-doc-desc">{config.description}</div>
        {composeEnabled ? (
          <div className="sender-doc-secondary">웹에서 초안을 작성한 뒤 PDF로 저장하고 인감 날인 후 업로드할 수 있습니다.</div>
        ) : null}
        <div className="sender-doc-meta">
          {file ? (
            <span className="label label-green">
              <span className="label-dot" />
              {file.name}
            </span>
          ) : (
            <span className={`label ${required ? "label-yellow" : "label-gray"}`}>
              <span className="label-dot" />
              {required ? "필수 서류" : "선택 서류"}
            </span>
          )}
        </div>
      </div>
      <div className="sender-doc-actions">
        {composeEnabled && onCompose ? (
          <button type="button" className="btn btn-default btn-sm" onClick={onCompose}>
            <AppIcon name="template" className="icon icon-14" />
            웹에서 작성
          </button>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
        <button type="button" className="btn btn-default btn-sm" onClick={() => inputRef.current?.click()}>
          <AppIcon name="upload" className="icon icon-14" />
          {file ? "파일 교체" : "파일 업로드"}
        </button>
        {file ? (
          <button type="button" className="btn btn-default btn-sm" onClick={handleClear}>
            제거
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function SenderNumberApplicationPage() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [type, setType] = useState<SenderNumberType>("COMPANY");
  const [consentLetterOpen, setConsentLetterOpen] = useState(false);
  const [relationshipProofOpen, setRelationshipProofOpen] = useState(false);
  const [openHelpKey, setOpenHelpKey] = useState<SenderDocKey | null>(null);
  const [files, setFiles] = useState<Record<SenderDocKey, File | null>>({
    telecomCertificate: null,
    consentDocument: null,
    personalInfoConsent: null,
    thirdPartyBusinessRegistration: null,
    relationshipProof: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiredDocs =
    type === "COMPANY"
      ? [...COMMON_DOCS, ...COMPANY_DOCS]
      : [...COMMON_DOCS, ...EMPLOYEE_DOCS];

  const completedRequiredCount = requiredDocs.filter((doc) => files[doc.key]).length;
  const allRequiredReady = completedRequiredCount === requiredDocs.length;

  const updateFile = (key: SenderDocKey, file: File | null) => {
    setFiles((current) => ({ ...current, [key]: file }));
  };

  const toggleHelp = (key: SenderDocKey) => {
    setOpenHelpKey((current) => (current === key ? null : key));
  };

  const handleDocumentClick = useEffectEvent((event: MouseEvent) => {
    const target = event.target as HTMLElement | null;

    if (!target?.closest("[data-sender-doc-help]")) {
      setOpenHelpKey(null);
    }
  });

  useMountEffect(() => {
    const onClick = (event: MouseEvent) => handleDocumentClick(event);
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);

    if (!normalizedPhoneNumber) {
      setError("발신번호를 입력해 주세요.");
      return;
    }

    for (const doc of requiredDocs) {
      if (!files[doc.key]) {
        setError(`${doc.title}을(를) 첨부해 주세요.`);
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("phoneNumber", normalizedPhoneNumber);
      formData.append("type", type);

      if (files.telecomCertificate) {
        formData.append("telecomCertificate", files.telecomCertificate);
      }
      if (files.consentDocument) {
        formData.append("consentDocument", files.consentDocument);
      }
      if (files.personalInfoConsent) {
        formData.append("personalInfoConsent", files.personalInfoConsent);
      }
      if (files.thirdPartyBusinessRegistration) {
        formData.append("thirdPartyBusinessRegistration", files.thirdPartyBusinessRegistration);
      }
      if (files.relationshipProof) {
        formData.append("relationshipProof", files.relationshipProof);
      }

      await createV2SenderNumberApplication(formData);
      router.push(buildResourcesTabPath("tab-sms"));
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "발신번호 신청에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <div className="page-title">발신번호 신청</div>
            <div className="page-desc">발신번호 정보와 증빙 서류를 제출합니다.</div>
          </div>
          <div className="page-actions">
            <a className="btn btn-default btn-sm" href={buildResourcesTabPath("tab-sms")}>
              신청 현황 보기
            </a>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="sender-application-layout">
        <section className="box">
          <div className="box-header">
            <div>
              <div className="box-title">기본 정보</div>
              <div className="box-subtitle">등록할 발신번호와 번호 유형을 선택하세요.</div>
            </div>
          </div>
          <div className="box-body">
            <div className="form-row-inline align-start sender-application-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="sender-number-phone">
                  발신번호 <span className="text-danger">*</span>
                </label>
                <input
                  id="sender-number-phone"
                  className="form-control field-width-md"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  placeholder="예: 0212345678"
                  inputMode="numeric"
                />
                <div className="form-hint">하이픈 포함 또는 미포함 모두 입력 가능합니다.</div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="sender-number-type">
                  번호 유형 <span className="text-danger">*</span>
                </label>
                <select
                  id="sender-number-type"
                  className="form-control field-width-sm"
                  value={type}
                  onChange={(event) => setType(event.target.value as SenderNumberType)}
                >
                  <option value="COMPANY">회사 번호</option>
                  <option value="EMPLOYEE">개인 번호</option>
                </select>
                <div className="form-hint">
                  회사 번호는 타사 사업자등록증과 관계 확인 문서가, 개인 번호는 개인정보 수집·이용 동의서가 추가로 필요합니다.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="box">
          <div className="box-header">
            <div>
              <div className="box-title">제출 서류</div>
              <div className="box-subtitle">번호 유형에 맞는 필수 서류를 첨부해 주세요.</div>
            </div>
            <span className={`label ${allRequiredReady ? "label-green" : "label-blue"}`}>
              <span className="label-dot" />
              {completedRequiredCount} / {requiredDocs.length} 준비됨
            </span>
          </div>
          <div className="box-body">
            {requiredDocs.map((doc, index) => (
              <div key={doc.key} className={index > 0 ? "sender-doc-divider" : undefined}>
                <FileUploadRow
                  config={doc}
                  required
                  file={files[doc.key]}
                  helpOpen={openHelpKey === doc.key}
                  composeEnabled={doc.key === "consentDocument" || doc.key === "relationshipProof"}
                  onChange={(file) => updateFile(doc.key, file)}
                  onToggleHelp={toggleHelp}
                  onCompose={
                    doc.key === "consentDocument"
                      ? () => setConsentLetterOpen(true)
                      : doc.key === "relationshipProof"
                        ? () => setRelationshipProofOpen(true)
                        : undefined
                  }
                />
              </div>
            ))}
          </div>
        </section>

        <section className="box">
          <div className="box-header">
            <div>
              <div className="box-title">제출 전 확인</div>
              <div className="box-subtitle">서류 조건을 확인한 뒤 신청을 제출하세요.</div>
            </div>
          </div>
          <div className="box-body">
            <div className="box-row">
              <div className="box-row-content">
                <div className="box-row-title">현재 제출 기준</div>
                <div className="box-row-desc">
                  {type === "COMPANY"
                    ? "회사 번호는 통신서비스 이용증명원, 이용승낙서, 타사 사업자등록증, 관계 확인 문서가 필요합니다."
                    : "개인 번호는 통신서비스 이용증명원, 이용승낙서, 개인정보 수집·이용 동의서가 필요합니다."}
                </div>
              </div>
            </div>
            <div className="box-row" style={{ borderBottom: "none" }}>
              <div className="box-row-content">
                <div className="box-row-title">검토 안내</div>
                <div className="box-row-desc">서류 접수 후 검토 상태는 발신 자원 관리에서 확인할 수 있습니다.</div>
              </div>
            </div>

            {error ? (
              <div className="flash flash-danger" style={{ marginTop: 16, marginBottom: 0 }}>
                <AppIcon name="warn" className="icon icon-16 flash-icon" />
                <div className="flash-body">{error}</div>
              </div>
            ) : null}
          </div>
          <div className="box-footer">
            <span className="text-small">이용승낙서는 웹에서 초안을 작성한 뒤 PDF 저장 후 업로드할 수 있습니다.</span>
            <div className="form-row-inline">
              <a className="btn btn-default btn-sm" href={buildResourcesTabPath("tab-sms")}>
                취소
              </a>
              <button className="btn btn-accent btn-sm" type="submit" disabled={submitting}>
                <AppIcon name="upload" className="icon icon-14" />
                {submitting ? "신청 제출 중..." : "신청 제출"}
              </button>
            </div>
          </div>
        </section>
      </form>
      <SenderNumberConsentLetterModal
        open={consentLetterOpen}
        initialPhoneNumber={phoneNumber}
        onClose={() => setConsentLetterOpen(false)}
      />
      <SenderNumberRelationshipProofModal
        open={relationshipProofOpen}
        initialPhoneNumber={phoneNumber}
        onClose={() => setRelationshipProofOpen(false)}
      />
    </>
  );
}
