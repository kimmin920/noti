"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffectEvent } from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import { SenderNumberConsentLetterModal } from "@/components/resources/SenderNumberConsentLetterModal";
import { SenderNumberRelationshipProofModal } from "@/components/resources/SenderNumberRelationshipProofModal";
import { FormSelect } from "@/components/ui/FormSelect";
import {
  createV2SenderNumberApplication,
  fetchV2SenderNumberApplicationDetail,
  type V2SenderNumberApplicationDetailResponse,
} from "@/lib/api/v2";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";
import {
  buildResourcesTabPath,
  SENDER_NUMBER_APPLICATION_EDIT_QUERY,
} from "@/lib/routes";

type SenderNumberType = "COMPANY" | "EMPLOYEE";
type SenderDocKey =
  | "telecomCertificate"
  | "consentDocument"
  | "idCardCopy"
  | "thirdPartyBusinessRegistration"
  | "relationshipProof"
  | "additionalDocument";

type DocConfig = {
  key: SenderDocKey;
  title: string;
  description: string;
  helpTitle: string;
  helpLines: string[];
};

type ExistingAttachmentState = Record<SenderDocKey, boolean>;
type FileState = Record<SenderDocKey, File | null>;

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
    key: "idCardCopy",
    title: "신분증 사본",
    description: "번호 소유자의 신분증 사본을 업로드하세요. 주민등록번호 뒷자리는 반드시 가려 주세요.",
    helpTitle: "제출 시 주의사항",
    helpLines: [
      "번호 소유자가 타인인 경우 본인 확인을 위해 신분증 사본이 필요합니다.",
      "주민등록번호 뒷자리는 반드시 마스킹된 상태여야 합니다.",
      "이름과 생년월일 앞자리 등 필요한 정보만 보이도록 편집한 뒤 제출해 주세요.",
    ],
  },
];

const COMPANY_DOCS: DocConfig[] = [
  {
    key: "thirdPartyBusinessRegistration",
    title: "번호 명의 사업자등록증",
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

const ADDITIONAL_DOC: DocConfig = {
  key: "additionalDocument",
  title: "기타 서류 제출",
  description: "보완 요청 또는 반려 사유에 대응하기 위한 추가 서류가 있다면 함께 업로드하세요.",
  helpTitle: "언제 활용하나요?",
  helpLines: [
    "운영자 메모에서 별도 보완 요청을 받은 경우 추가 서류를 첨부할 수 있습니다.",
    "필수 서류 외 참고 자료가 있다면 이 항목에 함께 제출해 주세요.",
  ],
};

const INITIAL_FILES: FileState = {
  telecomCertificate: null,
  consentDocument: null,
  idCardCopy: null,
  thirdPartyBusinessRegistration: null,
  relationshipProof: null,
  additionalDocument: null,
};

const INITIAL_EXISTING_ATTACHMENTS: ExistingAttachmentState = {
  telecomCertificate: false,
  consentDocument: false,
  idCardCopy: false,
  thirdPartyBusinessRegistration: false,
  relationshipProof: false,
  additionalDocument: false,
};

function normalizePhoneNumber(value: string) {
  return value.replace(/[^\d]/g, "");
}

function isEditableStatus(status: string | null | undefined) {
  return status === "REJECTED" || status === "SUPPLEMENT_REQUESTED" || status === "DRAFT";
}

function mapExistingAttachments(detail: V2SenderNumberApplicationDetailResponse | null): ExistingAttachmentState {
  if (!detail) {
    return INITIAL_EXISTING_ATTACHMENTS;
  }

  return {
    telecomCertificate: detail.attachments.telecom,
    consentDocument: detail.attachments.consent,
    idCardCopy: detail.attachments.idCardCopy,
    thirdPartyBusinessRegistration: detail.attachments.businessRegistration,
    relationshipProof: detail.attachments.relationshipProof,
    additionalDocument: detail.attachments.additional,
  };
}

function FileUploadRow({
  config,
  required,
  file,
  hasExistingFile,
  helpOpen,
  composeEnabled,
  disabled,
  onChange,
  onToggleHelp,
  onCompose,
}: {
  config: DocConfig;
  required: boolean;
  file: File | null;
  hasExistingFile: boolean;
  helpOpen: boolean;
  composeEnabled?: boolean;
  disabled?: boolean;
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
          ) : hasExistingFile ? (
            <span className="label label-blue">
              <span className="label-dot" />
              기존 제출본 있음
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
          <button type="button" className="btn btn-default btn-sm" onClick={onCompose} disabled={disabled}>
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
          disabled={disabled}
        />
        <button type="button" className="btn btn-default btn-sm" onClick={() => inputRef.current?.click()} disabled={disabled}>
          <AppIcon name="upload" className="icon icon-14" />
          {file || hasExistingFile ? "파일 교체" : "파일 업로드"}
        </button>
        {file ? (
          <button type="button" className="btn btn-default btn-sm" onClick={handleClear} disabled={disabled}>
            선택 취소
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function SenderNumberApplicationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editApplicationId = searchParams.get(SENDER_NUMBER_APPLICATION_EDIT_QUERY);
  const isEditMode = Boolean(editApplicationId);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [type, setType] = useState<SenderNumberType>("COMPANY");
  const [consentLetterOpen, setConsentLetterOpen] = useState(false);
  const [relationshipProofOpen, setRelationshipProofOpen] = useState(false);
  const [openHelpKey, setOpenHelpKey] = useState<SenderDocKey | null>(null);
  const [files, setFiles] = useState<FileState>(INITIAL_FILES);
  const [existingAttachments, setExistingAttachments] = useState<ExistingAttachmentState>(INITIAL_EXISTING_ATTACHMENTS);
  const [existingApplication, setExistingApplication] = useState<V2SenderNumberApplicationDetailResponse | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(isEditMode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editApplicationId) {
      setExistingApplication(null);
      setExistingAttachments(INITIAL_EXISTING_ATTACHMENTS);
      setLoadingExisting(false);
      return;
    }

    let cancelled = false;
    setLoadingExisting(true);
    setError(null);

    void fetchV2SenderNumberApplicationDetail(editApplicationId)
      .then((detail) => {
        if (cancelled) {
          return;
        }

        setExistingApplication(detail);
        setPhoneNumber(detail.phoneNumber);
        setType(detail.type);
        setFiles(INITIAL_FILES);
        setExistingAttachments(mapExistingAttachments(detail));
      })
      .catch((fetchError) => {
        if (cancelled) {
          return;
        }

        setError(fetchError instanceof Error ? fetchError.message : "기존 발신번호 신청서를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingExisting(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [editApplicationId]);

  const requiredDocs = type === "COMPANY" ? [...COMMON_DOCS, ...COMPANY_DOCS] : [...COMMON_DOCS, ...EMPLOYEE_DOCS];
  const completedRequiredCount = requiredDocs.filter((doc) => files[doc.key] || existingAttachments[doc.key]).length;
  const allRequiredReady = completedRequiredCount === requiredDocs.length;
  const editableExistingApplication = !isEditMode || isEditableStatus(existingApplication?.status);
  const pageTitle = isEditMode ? "발신번호 신청서 수정" : "발신번호 신청";
  const pageDesc = isEditMode
    ? "기존 신청서의 서류를 수정하거나 추가한 뒤 다시 제출합니다."
    : "발신번호 정보와 증빙 서류를 제출합니다.";

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

    if (loadingExisting) {
      return;
    }

    if (!editableExistingApplication) {
      setError("현재 상태의 신청서는 수정 제출할 수 없습니다. 신청 현황을 확인해 주세요.");
      return;
    }

    const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);

    if (!normalizedPhoneNumber) {
      setError("발신번호를 입력해 주세요.");
      return;
    }

    for (const doc of requiredDocs) {
      if (!files[doc.key] && !existingAttachments[doc.key]) {
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
      if (files.idCardCopy) {
        formData.append("idCardCopy", files.idCardCopy);
      }
      if (files.thirdPartyBusinessRegistration) {
        formData.append("thirdPartyBusinessRegistration", files.thirdPartyBusinessRegistration);
      }
      if (files.relationshipProof) {
        formData.append("relationshipProof", files.relationshipProof);
      }
      if (files.additionalDocument) {
        formData.append("additionalDocument", files.additionalDocument);
      }

      await createV2SenderNumberApplication(formData);
      router.push(buildResourcesTabPath("tab-sms"));
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "발신번호 신청서 제출에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <div className="page-title">{pageTitle}</div>
            <div className="page-desc">{pageDesc}</div>
          </div>
          <div className="page-actions">
            <a className="btn btn-default btn-sm" href={buildResourcesTabPath("tab-sms")}>
              신청 현황 보기
            </a>
          </div>
        </div>
      </div>

      {loadingExisting ? (
        <div className="box">
          <div className="empty-state" style={{ padding: "40px 16px" }}>
            <div className="empty-title">기존 신청서를 불러오는 중입니다</div>
            <div className="empty-desc">수정 가능한 서류 상태를 확인하고 있습니다.</div>
          </div>
        </div>
      ) : null}

      {!loadingExisting && existingApplication && isEditMode ? (
        <>
          {existingApplication.status === "SUPPLEMENT_REQUESTED" ? (
            <div className="flash flash-attention">
              <AppIcon name="warn" className="icon icon-16 flash-icon" />
              <div className="flash-body">
                <strong>서류 보완 요청이 있습니다.</strong>{" "}
                {existingApplication.reviewMemo || "기존 제출본은 유지되며, 필요한 서류만 수정하거나 추가해 다시 제출할 수 있습니다."}
              </div>
            </div>
          ) : null}

          {existingApplication.status === "REJECTED" ? (
            <div className="flash flash-attention">
              <AppIcon name="warn" className="icon icon-16 flash-icon" />
              <div className="flash-body">
                <strong>반려된 신청서입니다.</strong>{" "}
                {existingApplication.reviewMemo || "기존 신청서를 수정한 뒤 다시 제출해 주세요."}
              </div>
            </div>
          ) : null}

          {!editableExistingApplication ? (
            <div className="flash flash-info">
              <AppIcon name="info" className="icon icon-16 flash-icon" />
              <div className="flash-body">현재 상태의 신청서는 수정 제출 대상이 아닙니다. 신청 현황에서 상태를 먼저 확인해 주세요.</div>
            </div>
          ) : (
            <div className="flash flash-info">
              <AppIcon name="info" className="icon icon-16 flash-icon" />
              <div className="flash-body">이미 제출한 파일은 그대로 유지되며, 필요한 서류만 교체하거나 추가하면 됩니다.</div>
            </div>
          )}
        </>
      ) : null}

      <form onSubmit={handleSubmit} className="sender-application-layout">
        <section className="box">
          <div className="box-header">
            <div>
              <div className="box-title">기본 정보</div>
              <div className="box-subtitle">등록할 발신번호와 번호 유형을 확인하세요.</div>
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
                  disabled={isEditMode}
                />
                <div className="form-hint">
                  {isEditMode ? "기존 신청서 수정 중에는 발신번호를 변경할 수 없습니다." : "하이픈 포함 또는 미포함 모두 입력 가능합니다."}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="sender-number-type">
                  번호 유형 <span className="text-danger">*</span>
                </label>
                <FormSelect
                  id="sender-number-type"
                  className="form-control field-width-sm"
                  value={type}
                  onChange={(event) => setType(event.target.value as SenderNumberType)}
                  disabled={isEditMode}
                >
                  <option value="COMPANY">회사 번호</option>
                  <option value="EMPLOYEE">타인 번호</option>
                </FormSelect>
                <div className="form-hint">
                  {type === "COMPANY"
                    ? "회사 번호는 번호 명의 사업자등록증과 관계 확인 문서가 추가로 필요합니다."
                    : "타인 번호는 번호 소유자의 신분증 사본(주민등록번호 뒷자리 마스킹)이 추가로 필요합니다."}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="box">
          <div className="box-header">
            <div>
              <div className="box-title">제출 서류</div>
              <div className="box-subtitle">번호 유형에 맞는 필수 서류를 준비해 주세요.</div>
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
                  hasExistingFile={existingAttachments[doc.key]}
                  helpOpen={openHelpKey === doc.key}
                  composeEnabled={doc.key === "consentDocument" || doc.key === "relationshipProof"}
                  disabled={loadingExisting || !editableExistingApplication}
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

            <div className={requiredDocs.length > 0 ? "sender-doc-divider" : undefined}>
              <FileUploadRow
                config={ADDITIONAL_DOC}
                required={false}
                file={files.additionalDocument}
                hasExistingFile={existingAttachments.additionalDocument}
                helpOpen={openHelpKey === ADDITIONAL_DOC.key}
                disabled={loadingExisting || !editableExistingApplication}
                onChange={(file) => updateFile(ADDITIONAL_DOC.key, file)}
                onToggleHelp={toggleHelp}
              />
            </div>
          </div>
        </section>

        <section className="box">
          <div className="box-header">
            <div>
              <div className="box-title">제출 전 확인</div>
              <div className="box-subtitle">서류 조건을 확인한 뒤 신청서를 제출하세요.</div>
            </div>
          </div>
          <div className="box-body">
            <div className="box-row">
              <div className="box-row-content">
                <div className="box-row-title">현재 제출 기준</div>
                <div className="box-row-desc">
                  {type === "COMPANY"
                    ? "회사 번호는 통신서비스 이용증명원, 이용승낙서, 번호 명의 사업자등록증, 관계 확인 문서가 필요합니다."
                    : "타인 번호는 통신서비스 이용증명원, 이용승낙서, 신분증 사본이 필요합니다."}
                </div>
              </div>
            </div>
            <div className="box-row" style={{ borderBottom: "none" }}>
              <div className="box-row-content">
                <div className="box-row-title">검토 안내</div>
                <div className="box-row-desc">신청 후 검토 상태와 보완 요청 여부는 발신 자원 관리에서 확인할 수 있습니다.</div>
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
            <span className="text-small">이용승낙서와 관계 확인 문서는 웹에서 초안을 작성한 뒤 PDF로 저장해 첨부할 수 있습니다.</span>
            <div className="form-row-inline">
              <a className="btn btn-default btn-sm" href={buildResourcesTabPath("tab-sms")}>
                취소
              </a>
              <button className="btn btn-accent btn-sm" type="submit" disabled={submitting || loadingExisting || !editableExistingApplication}>
                <AppIcon name="upload" className="icon icon-14" />
                {submitting ? "제출 중..." : isEditMode ? "수정 내용 제출" : "신청 제출"}
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
