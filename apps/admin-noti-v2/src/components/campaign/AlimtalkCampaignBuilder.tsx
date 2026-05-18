"use client";

import { useMemo, useState } from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import {
  KakaoActionDetails,
  KakaoPreviewActions,
  renderKakaoPreviewText,
} from "@/components/kakao/KakaoAlimtalkPreview";
import {
  CampaignRecipientSelector,
  type RecipientSearchStatus,
} from "@/components/campaign/CampaignRecipientSelector";
import {
  SkeletonTableBox,
  SkeletonToolbarBox,
} from "@/components/loading/PageSkeleton";
import { FormSelect } from "@/components/ui/FormSelect";
import {
  createV2KakaoCampaign,
  fetchV2KakaoCampaignBootstrap,
  searchV2CampaignRecipients,
  type V2CampaignRecipientSearchResponse,
  type V2KakaoCampaignBootstrapResponse,
} from "@/lib/api/v2";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";
import { formatRecipientSource } from "@/lib/recipient-source";
import { useAppStore } from "@/lib/store/app-store";

type CampaignRecipientItem = V2CampaignRecipientSearchResponse["items"][number];
type CampaignStep = 1 | 2 | 3 | 4;
type CampaignFormError = {
  message: string;
  step: CampaignStep;
  targetId?: string;
} | null;

const SEARCH_LIMIT = 20;
const UNMAPPED_FIELD = "__unmapped__";
const EMPTY_KAKAO_TEMPLATES: V2KakaoCampaignBootstrapResponse["templates"] = [];
const EMPTY_RECIPIENT_ITEMS: V2CampaignRecipientSearchResponse["items"] = [];
const CAMPAIGN_STEPS: Array<{ id: CampaignStep; label: string }> = [
  { id: 1, label: "기본 설정" },
  { id: 2, label: "수신자 선택" },
  { id: 3, label: "템플릿 선택" },
  { id: 4, label: "검토 및 발송" },
];

const FIELD_IDS = {
  senderProfile: "bulk-kakao-sender-profile",
  scheduledAt: "bulk-kakao-scheduled-at",
  recipientSearch: "bulk-kakao-recipient-search",
  recipientTable: "bulk-kakao-recipient-table",
  template: "bulk-kakao-template",
  formError: "alimtalk-campaign-form-error",
};

export function AlimtalkCampaignBuilder({
  onSubmitted,
}: {
  onSubmitted: (campaignId: string) => void;
}) {
  const setCampaign = useAppStore((state) => state.setCampaign);
  const [step, setStep] = useState<CampaignStep>(1);
  const [bootstrap, setBootstrap] = useState<V2KakaoCampaignBootstrapResponse | null>(null);
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<V2CampaignRecipientSearchResponse | null>(null);
  const [recipientsLoading, setRecipientsLoading] = useState(true);
  const [recipientsError, setRecipientsError] = useState<string | null>(null);
  const [recipientCache, setRecipientCache] = useState<Record<string, CampaignRecipientItem>>({});
  const [searchInput, setSearchInput] = useState("");
  const [searchStatus, setSearchStatus] = useState<RecipientSearchStatus>("ACTIVE");
  const [showOnlyContactable, setShowOnlyContactable] = useState(true);
  const [searchOffset, setSearchOffset] = useState(0);
  const [title, setTitle] = useState("");
  const [scheduleType, setScheduleType] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [selectedSenderProfileId, setSelectedSenderProfileId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [templateVariableMappings, setTemplateVariableMappings] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<CampaignFormError>(null);

  const senderProfiles = bootstrap?.senderProfiles ?? [];
  const templates = bootstrap?.templates ?? EMPTY_KAKAO_TEMPLATES;
  const recipientFields = bootstrap?.recipientFields ?? [];
  const recipientItems = recipients?.items ?? EMPTY_RECIPIENT_ITEMS;
  const selectedSenderProfile =
    senderProfiles.find((item) => item.id === selectedSenderProfileId) ?? senderProfiles[0] ?? null;
  const availableTemplates = useMemo(() => {
    if (!selectedSenderProfile) {
      return [];
    }

    return templates.filter(
      (item) => item.source === "GROUP" || item.ownerKey === selectedSenderProfile.senderKey,
    );
  }, [selectedSenderProfile, templates]);
  const selectedTemplate =
    availableTemplates.find((item) => item.id === selectedTemplateId) ?? availableTemplates[0] ?? null;
  const selectedUsers = useMemo(
    () =>
      selectedUserIds
        .map((id) => recipientCache[id])
        .filter((item): item is CampaignRecipientItem => Boolean(item)),
    [recipientCache, selectedUserIds],
  );
  const selectedContactableUsers = useMemo(
    () => selectedUsers.filter((item) => item.hasPhone),
    [selectedUsers],
  );
  const contactableRecipientItems = useMemo(
    () => recipientItems.filter((item) => item.hasPhone),
    [recipientItems],
  );
  const previewUser = selectedContactableUsers[0] ?? contactableRecipientItems[0] ?? null;
  const templateBody = selectedTemplate?.template.body ?? "";
  const templateVariables = useMemo(() => {
    const explicitVariables = toStringArray(selectedTemplate?.template.requiredVariables);
    return explicitVariables.length > 0 ? explicitVariables : extractTemplateVariables(templateBody);
  }, [selectedTemplate?.template.requiredVariables, templateBody]);
  const variableRows = useMemo(
    () =>
      templateVariables.map((variable) => {
        const fieldKey = templateVariableMappings[variable] ?? "";
        const sampleValue =
          previewUser && fieldKey ? getRecipientFieldValue(previewUser, fieldKey) : undefined;
        const missingCount =
          fieldKey && selectedContactableUsers.length > 0
            ? selectedContactableUsers.filter((user) => !getRecipientFieldValue(user, fieldKey)).length
            : 0;

        return {
          variable,
          fieldKey,
          sampleValue,
          missingCount,
        };
      }),
    [previewUser, selectedContactableUsers, templateVariableMappings, templateVariables],
  );
  const previewVariables = useMemo(
    () =>
      Object.fromEntries(
        variableRows
          .filter((row) => row.sampleValue)
          .map((row) => [row.variable, row.sampleValue as string]),
      ),
    [variableRows],
  );

  const previewBody = useMemo(
    () => renderTemplatePreview(templateBody, previewVariables),
    [previewVariables, templateBody],
  );
  const previewNodes = useMemo(
    () => renderKakaoPreviewText(templateBody, previewVariables),
    [previewVariables, templateBody],
  );
  const previewActions = useMemo(() => {
    if (!selectedTemplate) return [];
    return [...(selectedTemplate.buttons ?? []), ...(selectedTemplate.quickReplies ?? [])];
  }, [selectedTemplate]);
  const showInitialLoading = Boolean(
    (bootstrapLoading && !bootstrap) || (recipientsLoading && !recipients),
  );
  const stepMeta = CAMPAIGN_STEPS[step - 1];
  function clearFormError() {
    if (formError) {
      setFormError(null);
    }
  }

  function focusErrorTarget(targetId?: string) {
    window.setTimeout(() => {
      const target = document.getElementById(targetId ?? FIELD_IDS.formError);
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
      target?.focus({ preventScroll: true });
    }, 0);
  }

  async function loadBootstrap() {
    setBootstrapLoading(true);
    setBootstrapError(null);

    try {
      const response = await fetchV2KakaoCampaignBootstrap();
      setBootstrap(response);
      const nextSenderProfile = response.senderProfiles[0] ?? null;
      const nextTemplates = nextSenderProfile
        ? response.templates.filter(
            (item) => item.source === "GROUP" || item.ownerKey === nextSenderProfile.senderKey,
          )
        : [];
      setSelectedSenderProfileId((current) => current || nextSenderProfile?.id || "");
      setSelectedTemplateId((current) => current || nextTemplates[0]?.id || "");
    } catch (error) {
      setBootstrapError(
        error instanceof Error ? error.message : "대량 알림톡 화면 준비 정보를 불러오지 못했습니다.",
      );
    } finally {
      setBootstrapLoading(false);
    }
  }

  async function loadRecipients(next?: {
    query?: string;
    status?: RecipientSearchStatus;
    offset?: number;
  }) {
    const query = next?.query ?? searchInput.trim();
    const status = next?.status ?? searchStatus;
    const offset = next?.offset ?? searchOffset;

    setRecipientsLoading(true);
    setRecipientsError(null);

    try {
      const response = await searchV2CampaignRecipients({
        query,
        status,
        limit: SEARCH_LIMIT,
        offset,
      });
      setRecipients(response);
      setSearchInput(query);
      setSearchStatus(status);
      setSearchOffset(offset);
      setRecipientCache((current) => {
        const merged = { ...current };
        response.items.forEach((item) => {
          merged[item.id] = item;
        });
        return merged;
      });
    } catch (error) {
      setRecipientsError(
        error instanceof Error ? error.message : "수신자 목록을 불러오지 못했습니다.",
      );
    } finally {
      setRecipientsLoading(false);
    }
  }

  useMountEffect(() => {
    void loadBootstrap();
    void loadRecipients({ query: "", status: "ACTIVE", offset: 0 });
  });

  function showActionError(message: string, targetId?: string) {
    setFormError({ message, targetId, step });
    focusErrorTarget(targetId);
  }

  function goToStep(nextStep: CampaignStep) {
    setFormError(null);
    setStep(nextStep);
  }

  function fieldError(targetId: string) {
    return formError?.step === step && formError.targetId === targetId ? formError.message : undefined;
  }

  function handleSenderProfileChange(value: string) {
    clearFormError();
    setSelectedSenderProfileId(value);
    const nextSenderProfile = senderProfiles.find((item) => item.id === value) ?? null;
    const nextTemplates = nextSenderProfile
      ? templates.filter((item) => item.source === "GROUP" || item.ownerKey === nextSenderProfile.senderKey)
      : [];
    setSelectedTemplateId(nextTemplates[0]?.id ?? "");
    setTemplateVariableMappings({});
  }

  function goNextFromStep1() {
    if (!selectedSenderProfileId) {
      showActionError("발신 프로필을 선택해 주세요.", FIELD_IDS.senderProfile);
      return;
    }

    if (scheduleType === "later" && !scheduledAt) {
      showActionError("예약 발송 시각을 입력해 주세요.", FIELD_IDS.scheduledAt);
      return;
    }

    if (scheduleType === "later") {
      const candidate = new Date(scheduledAt);
      if (Number.isNaN(candidate.getTime()) || candidate.getTime() <= Date.now()) {
        showActionError("예약 발송 시각은 현재 시각보다 이후여야 합니다.", FIELD_IDS.scheduledAt);
        return;
      }
    }

    goToStep(2);
  }

  function goNextFromStep2() {
    if (selectedUserIds.length === 0) {
      showActionError("수신자를 최소 한 명 이상 선택해 주세요.", FIELD_IDS.recipientTable);
      return;
    }

    if (selectedContactableUsers.length === 0) {
      showActionError("전화번호가 있는 수신자를 최소 한 명 이상 선택해 주세요.", FIELD_IDS.recipientTable);
      return;
    }

    if (selectedContactableUsers.length > (bootstrap?.limits.maxUserCount ?? 1000)) {
      showActionError(
        `한 번에 최대 ${formatCount(bootstrap?.limits.maxUserCount ?? 1000)}명까지 선택할 수 있습니다.`,
        FIELD_IDS.recipientTable,
      );
      return;
    }

    goToStep(3);
  }

  function goNextFromStep3() {
    if (!selectedTemplate) {
      showActionError("승인된 알림톡 템플릿을 선택해 주세요.", FIELD_IDS.template);
      return;
    }

    const unmappedVariables = variableRows.filter((row) => !row.fieldKey).map((row) => row.variable);
    if (unmappedVariables.length > 0) {
      showActionError(
        `다음 변수의 컬럼 매핑이 필요합니다: ${unmappedVariables.join(", ")}`,
        variableFieldId(unmappedVariables[0]),
      );
      return;
    }

    const invalidVariables = variableRows.filter((row) => row.fieldKey && row.missingCount > 0);
    if (invalidVariables.length > 0) {
      showActionError(
        invalidVariables
          .map((row) => `${row.variable}(${row.missingCount}명 값 없음)`)
          .join(", ") + " 값을 먼저 채우거나 다른 컬럼으로 매핑해 주세요.",
        variableFieldId(invalidVariables[0].variable),
      );
      return;
    }

    goToStep(4);
  }

  async function handleSubmit() {
    if (!selectedSenderProfile || !selectedTemplate) {
      showActionError("발신 프로필과 템플릿을 확인해 주세요.");
      return;
    }

    setFormError(null);
    setSubmitting(true);

    try {
      const response = await createV2KakaoCampaign({
        title: title.trim() || undefined,
        senderProfileId: selectedSenderProfile.id,
        providerTemplateId: selectedTemplate.source === "GROUP" ? undefined : selectedTemplate.id,
        templateSource: selectedTemplate.source === "GROUP" ? "GROUP" : undefined,
        templateCode: selectedTemplate.templateCode ?? undefined,
        templateName: selectedTemplate.template.name,
        templateBody: selectedTemplate.template.body,
        requiredVariables: templateVariables,
        userIds: selectedUserIds,
        scheduledAt:
          scheduleType === "later" && scheduledAt
            ? new Date(scheduledAt).toISOString()
            : undefined,
        templateVariableMappings: variableRows
          .filter((row) => row.fieldKey)
          .map((row) => ({
            templateVariable: row.variable,
            userFieldKey: row.fieldKey,
          })),
      });

      onSubmitted(response.campaignId);
    } catch (error) {
      showActionError(
        error instanceof Error ? error.message : "대량 알림톡 발송 요청을 접수하지 못했습니다.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (showInitialLoading) {
    return (
      <>
        <div className="page-header">
          <div className="page-header-row">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button className="btn btn-default btn-sm" onClick={() => setCampaign({ mode: "list", step: 1 })}>
                <AppIcon name="chevron-right" className="icon icon-14" style={{ transform: "rotate(180deg)" }} />
              </button>
              <div>
                <div className="page-title">알림톡 대량 발송 만들기</div>
                <div className="page-desc">대량 알림톡 발송 준비 정보를 불러오고 있습니다</div>
              </div>
            </div>
          </div>
        </div>
        <SkeletonToolbarBox />
        <SkeletonTableBox
          titleWidth={110}
          rows={5}
          columns={["42px", "1.2fr", "1fr", "120px", "120px", "84px"]}
        />
      </>
    );
  }

  return (
    <div className="campaign-builder">
      <div className="page-header">
        <div className="page-header-row">
          <div className="campaign-page-heading">
            <button
              className="btn btn-default btn-sm campaign-back-button"
              onClick={() => setCampaign({ mode: "list", step: 1 })}
              aria-label="알림톡 대량 발송 목록으로 돌아가기"
            >
              <AppIcon name="chevron-left" className="icon icon-14" />
            </button>
            <div>
              <h1 className="page-title">알림톡 대량 발송 만들기</h1>
              <div className="page-desc">관리 중인 수신자를 선택하고 승인된 알림톡 템플릿으로 대량 발송합니다</div>
            </div>
          </div>
          <button
            className="btn btn-default"
            onClick={() => {
              void loadBootstrap();
              void loadRecipients({ offset: 0 });
            }}
            disabled={bootstrapLoading || recipientsLoading}
          >
            <AppIcon name="refresh" className="icon icon-14" />
            {bootstrapLoading || recipientsLoading ? "새로고침 중" : "새로고침"}
          </button>
        </div>
      </div>

      {bootstrapError ? (
        <div className="flash flash-attention">
          <AppIcon name="warn" className="icon icon-16 flash-icon" />
          <div className="flash-body">{bootstrapError}</div>
        </div>
      ) : null}

      {bootstrap && !bootstrap.readiness.ready ? (
        <div className="flash flash-attention" role="status">
          <AppIcon name="warn" className="icon icon-16 flash-icon" />
          <div className="flash-body">
            {bootstrap.readiness.blockers[0]?.message ?? "발송 준비가 필요합니다."}
          </div>
        </div>
      ) : null}

      {formError?.step === step ? (
        <div
          id={FIELD_IDS.formError}
          className="flash flash-attention"
          role="alert"
          tabIndex={-1}
        >
          <AppIcon name="warn" className="icon icon-16 flash-icon" />
          <div className="flash-body">{formError.message}</div>
        </div>
      ) : null}

      <div className="box mb-16 campaign-step-box">
        <div className="box-body">
          <div className="campaign-step-summary" aria-live="polite">
            {step} / {CAMPAIGN_STEPS.length} · {stepMeta.label}
          </div>
          <nav aria-label="캠페인 생성 단계">
            <ol className="steps campaign-steps">
              {CAMPAIGN_STEPS.map((item) => {
                const stateClass = step === item.id ? " active" : step > item.id ? " done" : "";
                return (
                  <li
                    className="step"
                    key={item.id}
                    aria-current={step === item.id ? "step" : undefined}
                  >
                    {renderCampaignStepCircle(step, item.id)}
                    <div className={`step-label${stateClass}`}>{item.label}</div>
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>
      </div>

      {step === 1 ? (
        <>
          <div className="box">
            <div className="box-header"><div className="box-title">기본 정보</div></div>
            <div className="box-body">
              <div className="form-group campaign-form-field">
                <label className="form-label" htmlFor="bulk-kakao-title">캠페인명</label>
                <input
                  id="bulk-kakao-title"
                  className="form-control"
                  placeholder="예: 4월 회원 안내 알림톡"
                  value={title}
                  aria-describedby="bulk-kakao-title-caption"
                  onChange={(event) => {
                    clearFormError();
                    setTitle(event.target.value);
                  }}
                />
                <p id="bulk-kakao-title-caption" className="form-hint">내부 관리용 이름으로, 수신자에게 직접 노출되지는 않습니다.</p>
              </div>
              <div className="form-group campaign-form-field">
                <label className="form-label" htmlFor={FIELD_IDS.senderProfile}>발신 프로필</label>
                <FormSelect
                  id={FIELD_IDS.senderProfile}
                  className="form-control"
                  value={selectedSenderProfileId}
                  aria-invalid={Boolean(fieldError(FIELD_IDS.senderProfile)) || undefined}
                  aria-describedby={describedBy(
                    fieldError(FIELD_IDS.senderProfile) ? errorIdFor(FIELD_IDS.senderProfile) : undefined,
                  )}
                  onChange={(event) => handleSenderProfileChange(event.target.value)}
                >
                  <option value="">발신 프로필을 선택해 주세요</option>
                  {senderProfiles.map((sender) => (
                    <option key={sender.id} value={sender.id}>
                      {sender.plusFriendId}
                    </option>
                  ))}
                </FormSelect>
                <FieldValidationMessage
                  id={errorIdFor(FIELD_IDS.senderProfile)}
                  message={fieldError(FIELD_IDS.senderProfile)}
                />
              </div>
              <fieldset className="form-group campaign-form-field campaign-fieldset">
                <legend className="form-label">발송 시간</legend>
                <div className="sms-schedule-options campaign-schedule-options">
                  <label className="sms-schedule-option">
                    <input
                      type="radio"
                      name="bulkKakaoSched"
                      checked={scheduleType === "now"}
                      onChange={() => {
                        clearFormError();
                        setScheduleType("now");
                      }}
                    />
                    즉시 발송
                  </label>
                  <label className="sms-schedule-option">
                    <input
                      type="radio"
                      name="bulkKakaoSched"
                      checked={scheduleType === "later"}
                      onChange={() => {
                        clearFormError();
                        setScheduleType("later");
                      }}
                    />
                    예약 발송
                  </label>
                </div>
                {scheduleType === "later" ? (
                  <input
                    id={FIELD_IDS.scheduledAt}
                    className="form-control"
                    type="datetime-local"
                    value={scheduledAt}
                    aria-invalid={Boolean(fieldError(FIELD_IDS.scheduledAt)) || undefined}
                    aria-describedby={describedBy(
                      fieldError(FIELD_IDS.scheduledAt) ? errorIdFor(FIELD_IDS.scheduledAt) : undefined,
                    )}
                    onChange={(event) => {
                      clearFormError();
                      setScheduledAt(event.target.value);
                    }}
                  />
                ) : null}
                <FieldValidationMessage
                  id={errorIdFor(FIELD_IDS.scheduledAt)}
                  message={fieldError(FIELD_IDS.scheduledAt)}
                />
              </fieldset>
            </div>
          </div>
          <div className="campaign-action-bar">
            <button type="button" className="btn btn-default" onClick={() => setCampaign({ mode: "list", step: 1 })}>취소</button>
            <button type="button" className="btn btn-accent" onClick={goNextFromStep1}>다음 단계 <AppIcon name="chevron-right" className="icon icon-14" /></button>
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <CampaignRecipientSelector
            recipients={recipients}
            recipientsLoading={recipientsLoading}
            recipientsError={recipientsError}
            searchInput={searchInput}
            searchStatus={searchStatus}
            showOnlyContactable={showOnlyContactable}
            selectedUserIds={selectedUserIds}
            selectedContactableCount={selectedContactableUsers.length}
            tableId={FIELD_IDS.recipientTable}
            searchInputId={FIELD_IDS.recipientSearch}
            statusSelectId="bulk-kakao-recipient-status"
            tableCaptionId="bulk-kakao-recipient-table-caption"
            tableValidationMessage={fieldError(FIELD_IDS.recipientTable)}
            onSearchInputChange={setSearchInput}
            onSearchStatusChange={setSearchStatus}
            onShowOnlyContactableChange={setShowOnlyContactable}
            onSearch={(params) => void loadRecipients(params)}
            onSelectedUserIdsChange={setSelectedUserIds}
            onClearFeedback={clearFormError}
          />

          <div className="campaign-action-bar">
            <button type="button" className="btn btn-default" onClick={() => goToStep(1)}>이전</button>
            <button type="button" className="btn btn-accent" onClick={goNextFromStep2}>다음 단계 <AppIcon name="chevron-right" className="icon icon-14" /></button>
          </div>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <div className="campaign-compose-grid">
            <div>
              <div className="box">
                <div className="box-header"><div className="box-title">템플릿 선택</div></div>
                <div className="box-body">
                  <div className="form-group campaign-form-field">
                    <label className="form-label" htmlFor="bulk-kakao-template-sender-profile">발신 프로필</label>
                    <FormSelect
                      id="bulk-kakao-template-sender-profile"
                      className="form-control"
                      value={selectedSenderProfileId}
                      onChange={(event) => handleSenderProfileChange(event.target.value)}
                    >
                      <option value="">발신 프로필을 선택해 주세요</option>
                      {senderProfiles.map((sender) => (
                        <option key={sender.id} value={sender.id}>
                          {sender.plusFriendId}
                        </option>
                      ))}
                    </FormSelect>
                  </div>
                  <div className="form-group campaign-form-field">
                    <label className="form-label" htmlFor={FIELD_IDS.template}>알림톡 템플릿</label>
                    <FormSelect
                      id={FIELD_IDS.template}
                      className="form-control"
                      value={selectedTemplate?.id ?? ""}
                      aria-invalid={Boolean(fieldError(FIELD_IDS.template)) || undefined}
                      aria-describedby={describedBy(
                        fieldError(FIELD_IDS.template) ? errorIdFor(FIELD_IDS.template) : undefined,
                      )}
                      onChange={(event) => {
                        clearFormError();
                        setSelectedTemplateId(event.target.value);
                        setTemplateVariableMappings({});
                      }}
                    >
                      <option value="">템플릿을 선택해 주세요</option>
                      {availableTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          [{template.source === "GROUP" ? "그룹" : "로컬"}] {template.template.name}
                        </option>
                      ))}
                    </FormSelect>
                    {selectedTemplate ? (
                      <div className="campaign-template-note">
                        <div className="table-title-text">{selectedTemplate.template.name}</div>
                        <div className="box-row-desc" style={{ fontSize: 12 }}>{selectedTemplate.template.body}</div>
                      </div>
                    ) : null}
                    <FieldValidationMessage
                      id={errorIdFor(FIELD_IDS.template)}
                      message={fieldError(FIELD_IDS.template)}
                    />
                  </div>
                </div>
              </div>

              {templateVariables.length > 0 ? (
                <div className="box">
                  <div className="box-header">
                    <div>
                      <div className="box-title">변수 매핑</div>
                      <div className="box-subtitle">템플릿 변수와 수신자 컬럼을 연결합니다</div>
                    </div>
                  </div>
                  <div className="box-section-tight">
                    {variableRows.map((row, index) => (
                      <div
                        className="box-row"
                        key={row.variable}
                        style={index === variableRows.length - 1 ? { borderBottom: "none" } : undefined}
                      >
                        <div className="campaign-variable-grid">
                          <div>
                            <div className="table-kind-text">변수</div>
                            <div className="text-mono">{row.variable}</div>
                          </div>
                          <div>
                            <label className="table-kind-text" htmlFor={variableFieldId(row.variable)}>수신자 컬럼</label>
                            <FormSelect
                              id={variableFieldId(row.variable)}
                              className="form-control"
                              value={row.fieldKey || UNMAPPED_FIELD}
                              aria-invalid={Boolean(fieldError(variableFieldId(row.variable))) || undefined}
                              aria-describedby={describedBy(
                                fieldError(variableFieldId(row.variable))
                                  ? errorIdFor(variableFieldId(row.variable))
                                  : undefined,
                              )}
                              onChange={(event) => {
                                clearFormError();
                                setTemplateVariableMappings((current) => ({
                                  ...current,
                                  [row.variable]:
                                    event.target.value === UNMAPPED_FIELD ? "" : event.target.value,
                                }));
                              }}
                            >
                              <option value={UNMAPPED_FIELD}>컬럼 선택</option>
                              {recipientFields.map((field) => (
                                <option key={field.key} value={field.key}>
                                  {field.label}
                                </option>
                              ))}
                            </FormSelect>
                            <FieldValidationMessage
                              id={errorIdFor(variableFieldId(row.variable))}
                              message={fieldError(variableFieldId(row.variable))}
                            />
                          </div>
                          <div>
                            <div className="table-kind-text">샘플 값</div>
                            <div className="td-muted">
                              {row.sampleValue || "—"}
                              {row.missingCount > 0 ? ` · ${row.missingCount}명 값 없음` : ""}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="sms-side-column">
              <div className="box">
                <div className="box-header"><div className="box-title">발송 미리보기</div><span className="chip chip-kakao">알림톡</span></div>
                <div className="box-body-tight">
                  <div className="kakao-preview-phone">
                    <div className="kakao-preview-time">오늘 오후 2:30</div>
                    <div className="kakao-preview-row">
                      <div className="kakao-preview-avatar">A</div>
                      <div className="kakao-preview-content">
                        <div className="kakao-preview-sender">{selectedSenderProfile?.plusFriendId || "채널 미선택"}</div>
                        <div className="kakao-preview-bubble">
                          {selectedTemplate ? (
                            <>
                              <div className="kakao-preview-text">{previewNodes}</div>
                              <KakaoPreviewActions actions={previewActions} />
                            </>
                          ) : (
                            <div className="preview-empty-text">템플릿을 선택하면<br />미리보기가 표시됩니다</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <KakaoActionDetails actions={previewActions} variables={previewVariables} />
                </div>
              </div>
              <div className="box">
                <div className="box-header"><div className="box-title">현재 구성</div></div>
                <div className="box-section-tight">
                  <div className="box-row"><div className="box-row-content"><div className="table-kind-text">수신자</div><div className="table-title-text">{formatCount(selectedContactableUsers.length)}명</div></div></div>
                  <div className="box-row"><div className="box-row-content"><div className="table-kind-text">발신 프로필</div><div className="table-title-text">{selectedSenderProfile?.plusFriendId || "미선택"}</div></div></div>
                  <div className="box-row" style={{ borderBottom: "none" }}><div className="box-row-content"><div className="table-kind-text">템플릿</div><div className="table-title-text">{selectedTemplate?.template.name || "미선택"}</div></div></div>
                </div>
              </div>
            </div>
          </div>

          <div className="campaign-action-bar">
            <button type="button" className="btn btn-default" onClick={() => goToStep(2)}>이전</button>
            <button type="button" className="btn btn-accent" onClick={goNextFromStep3}>다음 단계 <AppIcon name="chevron-right" className="icon icon-14" /></button>
          </div>
        </>
      ) : null}

      {step === 4 ? (
        <>
          <div className="flash flash-info">
            <div className="flash-body">승인된 알림톡 템플릿과 수신자를 최종 확인한 뒤 발송 요청을 접수합니다.</div>
          </div>
          <div className="campaign-detail-grid">
            <div className="box">
              <div className="box-header"><div className="box-title">발송 요약</div></div>
              <div className="box-section-tight">
                <div className="box-row"><div className="box-row-content"><div className="table-kind-text">캠페인명</div><div className="table-title-text">{title.trim() || "이름 미입력"}</div></div></div>
                <div className="box-row"><div className="box-row-content"><div className="table-kind-text">채널</div><div><span className="chip chip-kakao">알림톡</span></div></div></div>
                <div className="box-row"><div className="box-row-content"><div className="table-kind-text">발신 프로필</div><div className="table-title-text">{selectedSenderProfile?.plusFriendId || "미선택"}</div></div></div>
                <div className="box-row"><div className="box-row-content"><div className="table-kind-text">템플릿</div><div className="table-title-text">{selectedTemplate?.template.name || "미선택"}</div></div></div>
                <div className="box-row"><div className="box-row-content"><div className="table-kind-text">수신자</div><div className="table-title-text">{formatCount(selectedContactableUsers.length)}명</div></div></div>
                <div className="box-row"><div className="box-row-content"><div className="table-kind-text">발송 시간</div><div className="table-title-text">{scheduleType === "later" && scheduledAt ? formatScheduleLabel(scheduledAt) : "즉시 발송"}</div></div></div>
                <div className="box-row" style={{ borderBottom: "none" }}><div className="box-row-content"><div className="table-kind-text">메시지</div><div className="box-row-desc" style={{ fontSize: 12, lineHeight: 1.6 }}>{previewBody || "본문 없음"}</div></div></div>
              </div>
            </div>
            <div className="box">
              <div className="box-header"><div className="box-title">발송 전 체크</div></div>
              <div className="box-section-tight">
                <div className="box-row"><div className="box-row-content"><div className="table-kind-text">발송 가능 수신자</div><div className="table-title-text">{formatCount(selectedContactableUsers.length)}명</div></div></div>
                <div className="box-row"><div className="box-row-content"><div className="table-kind-text">변수 매핑</div><div className="table-title-text">{templateVariables.length === 0 ? "필요 없음" : `${variableRows.filter((row) => row.fieldKey).length} / ${variableRows.length}`}</div></div></div>
                <div className="box-row" style={{ borderBottom: "none" }}><div className="box-row-content"><div className="table-kind-text">템플릿 출처</div><div className="table-title-text">{selectedTemplate?.source === "GROUP" ? "그룹 템플릿" : "로컬 템플릿"}</div></div></div>
              </div>
            </div>
          </div>
          <div className="campaign-action-bar">
            <button type="button" className="btn btn-default" onClick={() => goToStep(3)} disabled={submitting}>이전</button>
            <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
              <AppIcon name="send" className="icon icon-14" />
              {submitting ? "접수 중..." : "알림톡 캠페인 발송"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function renderCampaignStepCircle(currentStep: CampaignStep, step: CampaignStep) {
  const done = step < currentStep;
  const active = step === currentStep;

  return (
    <div className={`step-circle${done ? " done" : active ? " active" : ""}`}>
      {done ? <AppIcon name="check" className="icon icon-14" /> : step}
    </div>
  );
}

function FieldValidationMessage({ id, message }: { id: string; message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <div id={id} className="form-field-error" role="alert">
      {message}
    </div>
  );
}

function errorIdFor(fieldId: string) {
  return `${fieldId}-error`;
}

function variableFieldId(variable: string) {
  const encoded = Array.from(variable)
    .map((char) => char.codePointAt(0)?.toString(16))
    .filter(Boolean)
    .join("-");
  return `bulk-kakao-variable-${encoded || "field"}`;
}

function describedBy(...ids: Array<string | undefined>) {
  const value = ids.filter(Boolean).join(" ");
  return value || undefined;
}

function extractTemplateVariables(body: string) {
  const matches = body.matchAll(/\{\{\s*([^}]+?)\s*\}\}|#\{\s*([^}]+?)\s*\}/g);
  const set = new Set<string>();

  for (const match of matches) {
    const key = String(match[1] ?? match[2] ?? "").trim();
    if (key) {
      set.add(key);
    }
  }

  return [...set].sort((left, right) => left.localeCompare(right, "ko-KR"));
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item : ""))
    .filter(Boolean);
}

function getRecipientFieldValue(recipient: CampaignRecipientItem, fieldKey: string) {
  switch (fieldKey) {
    case "externalId":
      return recipient.externalId || undefined;
    case "name":
      return recipient.name || undefined;
    case "email":
      return recipient.email || undefined;
    case "phone":
      return recipient.phone || undefined;
    case "status":
      return recipient.status || undefined;
    case "source":
      return recipient.source ? formatRecipientSource(recipient.source) : undefined;
    case "userType":
      return recipient.userType || undefined;
    case "segment":
      return recipient.segment || undefined;
    case "gradeOrLevel":
      return recipient.gradeOrLevel || undefined;
    case "marketingConsent":
      return recipient.marketingConsent == null ? undefined : recipient.marketingConsent ? "동의" : "미동의";
    case "createdAt":
      return recipient.createdAt || undefined;
    case "updatedAt":
      return recipient.updatedAt || undefined;
    default: {
      const rawValue = recipient.customAttributes[fieldKey];
      if (rawValue == null) return undefined;
      return String(rawValue);
    }
  }
}

function renderTemplatePreview(body: string, variables: Record<string, string>) {
  return body.replace(/\{\{\s*([^}]+?)\s*\}\}|#\{\s*([^}]+?)\s*\}/g, (_match, mustacheKey, hashKey) => {
    const key = String(mustacheKey ?? hashKey ?? "").trim();
    return variables[key] ?? `#\{${key}\}`;
  });
}

function formatCount(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatScheduleLabel(value: string) {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}
