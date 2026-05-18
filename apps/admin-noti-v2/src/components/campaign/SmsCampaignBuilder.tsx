"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppIcon } from "@/components/icons/AppIcon";
import {
  CampaignRecipientSelector,
  type RecipientSearchStatus,
} from "@/components/campaign/CampaignRecipientSelector";
import {
  SkeletonTableBox,
  SkeletonToolbarBox,
} from "@/components/loading/PageSkeleton";
import {
  formatSmsAdvertisementPreview,
  formatSms080Number,
  getApprovedSms080Service,
  getSmsAdvertisementSetupStatusLabel,
  SmsAdvertisementControls,
  SmsAdvertisementSetupDialog,
  type SmsAdvertisementSetupStatus,
  useSmsAdvertisement080State,
} from "@/components/sms/SmsAdvertisementControls";
import { FormSelect } from "@/components/ui/FormSelect";
import {
  createV2SmsCampaign,
  fetchV2SmsCampaignBootstrap,
  searchV2CampaignRecipients,
  type V2CampaignRecipientSearchResponse,
  type V2SmsCampaignBootstrapResponse,
} from "@/lib/api/v2";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";
import { formatRecipientSource } from "@/lib/recipient-source";
import { useAppStore } from "@/lib/store/app-store";

type CampaignRecipientItem = V2CampaignRecipientSearchResponse["items"][number];

const SEARCH_LIMIT = 20;
const UNMAPPED_FIELD = "__unmapped__";
const EMPTY_RECIPIENT_ITEMS: V2CampaignRecipientSearchResponse["items"] = [];

export function SmsCampaignBuilder({
  onSubmitted,
}: {
  onSubmitted: (campaignId: string) => void;
}) {
  const setCampaign = useAppStore((state) => state.setCampaign);
  const showDraftToast = useAppStore((state) => state.showDraftToast);
  const router = useRouter();
  const sms080State = useSmsAdvertisement080State();
  const advertisementCheckboxRef = useRef<HTMLElement | null>(null);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [bootstrap, setBootstrap] = useState<V2SmsCampaignBootstrapResponse | null>(null);
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
  const [selectedSenderNumberId, setSelectedSenderNumberId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [manualBody, setManualBody] = useState("");
  const [isAdvertisement, setIsAdvertisement] = useState(false);
  const [advertisingServiceName, setAdvertisingServiceName] = useState("");
  const [advertisementSetupStatus, setAdvertisementSetupStatus] = useState<SmsAdvertisementSetupStatus>(null);
  const [advertisementDialogOpen, setAdvertisementDialogOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [templateVariableMappings, setTemplateVariableMappings] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const senderNumbers = bootstrap?.senderNumbers ?? [];
  const templates = bootstrap?.templates ?? [];
  const recipientFields = bootstrap?.recipientFields ?? [];
  const recipientItems = recipients?.items ?? EMPTY_RECIPIENT_ITEMS;
  const selectedTemplate =
    selectedTemplateId ? templates.find((item) => item.id === selectedTemplateId) ?? null : null;
  const resolvedBody = selectedTemplate?.body ?? manualBody;
  const templateVariables = useMemo(() => {
    if (!selectedTemplate) {
      return extractTemplateVariables(resolvedBody);
    }

    const explicitVariables = toStringArray(selectedTemplate.requiredVariables);
    return explicitVariables.length > 0 ? explicitVariables : extractTemplateVariables(selectedTemplate.body);
  }, [resolvedBody, selectedTemplate]);
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

  function showActionError(message: string) {
    showDraftToast(message, { tone: "error" });
  }

  async function handleAdvertisementCheckedChange(nextChecked: boolean) {
    if (!nextChecked) {
      setIsAdvertisement(false);
      setAdvertisementSetupStatus(null);
      return;
    }

    const resources = await sms080State.loadResources();
    const approvedService = getApprovedSms080Service(resources);

    if (approvedService) {
      setIsAdvertisement(true);
      setAdvertisementSetupStatus("registered");
      setAdvertisementDialogOpen(false);
      return;
    }

    if (!resources) {
      showActionError("080 번호 상태를 확인하지 못했습니다.");
      return;
    }

    setIsAdvertisement(false);
    setAdvertisementSetupStatus(null);
    setAdvertisementDialogOpen(true);
  }

  function openSms080Settings() {
    setAdvertisementDialogOpen(false);
    router.push("/settings?tab=080");
  }

  const previewBody = useMemo(() => {
    const rendered = renderTemplatePreview(resolvedBody, previewVariables);
    return formatSmsAdvertisementPreview(rendered, {
      isAdvertisement,
      advertisingServiceName,
      optOutNumber: sms080State.approvedService?.unsubscribeNumber,
    });
  }, [advertisingServiceName, isAdvertisement, previewVariables, resolvedBody, sms080State.approvedService?.unsubscribeNumber]);
  const showInitialLoading = Boolean(
    (bootstrapLoading && !bootstrap) || (recipientsLoading && !recipients),
  );

  async function loadBootstrap() {
    setBootstrapLoading(true);
    setBootstrapError(null);

    try {
      const response = await fetchV2SmsCampaignBootstrap();
      setBootstrap(response);
      if (!selectedSenderNumberId && response.senderNumbers[0]) {
        setSelectedSenderNumberId(response.senderNumbers[0].id);
      }
    } catch (error) {
      setBootstrapError(
        error instanceof Error ? error.message : "대량 SMS 화면 준비 정보를 불러오지 못했습니다.",
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

  function goNextFromStep1() {
    if (scheduleType === "later" && !scheduledAt) {
      showActionError("예약 발송 시각을 입력해 주세요.");
      return;
    }

    if (scheduleType === "later") {
      const candidate = new Date(scheduledAt);
      if (Number.isNaN(candidate.getTime()) || candidate.getTime() <= Date.now()) {
        showActionError("예약 발송 시각은 현재 시각보다 이후여야 합니다.");
        return;
      }
    }

    setStep(2);
  }

  function goNextFromStep2() {
    if (selectedUserIds.length === 0) {
      showActionError("수신자를 최소 한 명 이상 선택해 주세요.");
      return;
    }

    if (selectedContactableUsers.length === 0) {
      showActionError("전화번호가 있는 수신자를 최소 한 명 이상 선택해 주세요.");
      return;
    }

    if (selectedContactableUsers.length > (bootstrap?.limits.maxUserCount ?? 1000)) {
      showActionError(`한 번에 최대 ${formatCount(bootstrap?.limits.maxUserCount ?? 1000)}명까지 선택할 수 있습니다.`);
      return;
    }

    setStep(3);
  }

  function goNextFromStep3() {
    if (!selectedSenderNumberId) {
      showActionError("발신번호를 선택해 주세요.");
      return;
    }

    if (!resolvedBody.trim()) {
      showActionError("본문을 입력하거나 템플릿을 선택해 주세요.");
      return;
    }

    const unmappedVariables = variableRows.filter((row) => !row.fieldKey).map((row) => row.variable);
    if (unmappedVariables.length > 0) {
      showActionError(`다음 변수의 컬럼 매핑이 필요합니다: ${unmappedVariables.join(", ")}`);
      return;
    }

    const invalidVariables = variableRows.filter((row) => row.fieldKey && row.missingCount > 0);
    if (invalidVariables.length > 0) {
      showActionError(
        invalidVariables
          .map((row) => `${row.variable}(${row.missingCount}명 값 없음)`)
          .join(", ") + " 값을 먼저 채우거나 다른 컬럼으로 매핑해 주세요.",
      );
      return;
    }

    setStep(4);
  }

  async function handleSubmit() {
    setSubmitting(true);

    try {
      const response = await createV2SmsCampaign({
        title: title.trim() || undefined,
        senderNumberId: selectedSenderNumberId,
        templateId: selectedTemplate?.id,
        body: selectedTemplate ? undefined : manualBody.trim(),
        isAdvertisement,
        advertisingServiceName: advertisingServiceName.trim() || undefined,
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
        error instanceof Error ? error.message : "대량 SMS 발송 요청을 접수하지 못했습니다.",
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
            <div className="campaign-page-heading">
              <button className="btn btn-default btn-sm campaign-back-button" onClick={() => setCampaign({ mode: "list", step: 1 })}>
                <AppIcon name="chevron-right" className="icon icon-14 campaign-back-icon" />
              </button>
              <div>
                <div className="page-title">캠페인 만들기</div>
                <div className="page-desc">대량 SMS 발송 준비 정보를 불러오고 있습니다</div>
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
    <>
      <div className="page-header">
        <div className="page-header-row">
          <div className="campaign-page-heading">
            <button className="btn btn-default btn-sm campaign-back-button" onClick={() => setCampaign({ mode: "list", step: 1 })}>
              <AppIcon name="chevron-right" className="icon icon-14 campaign-back-icon" />
            </button>
            <div>
              <div className="page-title">SMS 캠페인 만들기</div>
              <div className="page-desc">관리 중인 수신자를 선택해 대량 SMS를 발송합니다</div>
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
            새로고침
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
        <div className="flash flash-attention">
          <AppIcon name="warn" className="icon icon-16 flash-icon" />
          <div className="flash-body">
            {bootstrap.readiness.blockers[0]?.message ?? "발송 준비가 필요합니다."}
          </div>
        </div>
      ) : null}

      <div className="box mb-16 campaign-step-box">
        <div className="box-body">
          <div className="steps">
            <div className="step">{renderCampaignStepCircle(step, 1)}<div className={`step-label${step === 1 ? " active" : step > 1 ? " done" : ""}`}>기본 설정</div></div>
            <div className="step">{renderCampaignStepCircle(step, 2)}<div className={`step-label${step === 2 ? " active" : step > 2 ? " done" : ""}`}>수신자 선택</div></div>
            <div className="step">{renderCampaignStepCircle(step, 3)}<div className={`step-label${step === 3 ? " active" : step > 3 ? " done" : ""}`}>메시지 작성</div></div>
            <div className="step">{renderCampaignStepCircle(step, 4)}<div className={`step-label${step === 4 ? " active" : ""}`}>검토 및 발송</div></div>
          </div>
        </div>
      </div>

      {step === 1 ? (
        <>
          <div className="box">
            <div className="box-header"><div className="box-title">기본 정보</div></div>
            <div className="box-body">
              <div className="form-group">
                <label className="form-label">캠페인명</label>
                <input
                  className="form-control campaign-form-field"
                  placeholder="예: 4월 신규 가입자 안내"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
                <p className="form-hint">내부 관리용 이름으로, 수신자에게 직접 노출되지는 않습니다.</p>
              </div>
              <div className="form-group">
                <label className="form-label">발송 채널</label>
                <div className="campaign-channel-grid">
                  <div className="campaign-channel-card selected">
                    <div className="campaign-channel-title">SMS</div>
                    <div className="table-subtext">이번 단계에서 우선 지원합니다</div>
                  </div>
                  <div className="campaign-channel-card campaign-channel-card-muted" aria-disabled="true">
                    <div className="campaign-channel-title">알림톡</div>
                    <div className="table-subtext">다음 단계에서 이어서 지원 예정</div>
                  </div>
                </div>
              </div>
              <div className="form-group form-group-flush">
                <label className="form-label">발송 시간</label>
                <div className="sms-schedule-options campaign-schedule-options">
                  <label className="sms-schedule-option">
                    <input
                      type="radio"
                      name="bulkSched"
                      checked={scheduleType === "now"}
                      onChange={() => setScheduleType("now")}
                    />
                    즉시 발송
                  </label>
                  <label className="sms-schedule-option">
                    <input
                      type="radio"
                      name="bulkSched"
                      checked={scheduleType === "later"}
                      onChange={() => setScheduleType("later")}
                    />
                    예약 발송
                  </label>
                </div>
                {scheduleType === "later" ? (
                  <input
                    className="form-control"
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(event) => setScheduledAt(event.target.value)}
                  />
                ) : null}
              </div>
            </div>
          </div>
          <div className="campaign-action-bar">
            <button className="btn btn-default" onClick={() => setCampaign({ mode: "list", step: 1 })}>취소</button>
            <button className="btn btn-accent" onClick={goNextFromStep1}>다음 단계 <AppIcon name="chevron-right" className="icon icon-14" /></button>
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
            searchInputId="bulk-sms-recipient-search"
            statusSelectId="bulk-sms-recipient-status"
            tableCaptionId="bulk-sms-recipient-table-caption"
            onSearchInputChange={setSearchInput}
            onSearchStatusChange={setSearchStatus}
            onShowOnlyContactableChange={setShowOnlyContactable}
            onSearch={(params) => void loadRecipients(params)}
            onSelectedUserIdsChange={setSelectedUserIds}
          />

          <div className="campaign-action-bar">
            <button className="btn btn-default" onClick={() => setStep(1)}>이전</button>
            <button className="btn btn-accent" onClick={goNextFromStep2}>다음 단계 <AppIcon name="chevron-right" className="icon icon-14" /></button>
          </div>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <div className="campaign-compose-grid">
            <div>
              <div className="box">
                <div className="box-header"><div className="box-title">메시지 작성</div></div>
                <div className="box-body">
                  <div className="form-group">
                    <label className="form-label">발신번호</label>
                    <FormSelect
                      className="form-control campaign-template-variable-field"
                      value={selectedSenderNumberId}
                      onChange={(event) => setSelectedSenderNumberId(event.target.value)}
                    >
                      <option value="">발신번호를 선택해 주세요</option>
                      {senderNumbers.map((sender) => (
                        <option key={sender.id} value={sender.id}>
                          {sender.phoneNumber}
                        </option>
                      ))}
                    </FormSelect>
                  </div>
                  <div className="form-group">
                    <label className="form-label">SMS 템플릿</label>
                    <FormSelect
                      className="form-control campaign-form-field"
                      value={selectedTemplateId || "__manual__"}
                      onChange={(event) => setSelectedTemplateId(event.target.value === "__manual__" ? "" : event.target.value)}
                    >
                      <option value="__manual__">직접 작성</option>
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </FormSelect>
                    {selectedTemplate ? (
                      <div className="campaign-template-note">
                        <div className="table-title-text">{selectedTemplate.name}</div>
                        <div className="box-row-desc campaign-template-preview-body">{selectedTemplate.body}</div>
                      </div>
                    ) : null}
                  </div>
                  <div className="form-group">
                    <label className="form-label">본문</label>
                    <textarea
                      className="form-control campaign-message-textarea"
                      value={resolvedBody}
                      readOnly={Boolean(selectedTemplate)}
                      onChange={(event) => setManualBody(event.target.value)}
                      placeholder="모든 수신자에게 보낼 내용을 입력해 주세요."
                    />
                    <div className="campaign-field-help">
                      <span>{templateVariables.length > 0 ? `감지된 변수 ${templateVariables.length}개` : "변수 없음"}</span>
                      <span>{formatCount(getByteLength(previewBody))} byte</span>
                    </div>
                  </div>
                  <SmsAdvertisementControls
                    id="campaign-sms-advertisement"
                    checked={isAdvertisement}
                    serviceName={advertisingServiceName}
                    setupStatus={advertisementSetupStatus}
                    approved080Service={sms080State.approvedService}
                    checking080={sms080State.loading}
                    checkboxRef={(node) => {
                      advertisementCheckboxRef.current = node;
                    }}
                    onCheckedChange={handleAdvertisementCheckedChange}
                    onServiceNameChange={setAdvertisingServiceName}
                  />
                </div>
              </div>

              {templateVariables.length > 0 ? (
                <div className="box">
                  <div className="box-header">
                    <div>
                      <div className="box-title">변수 매핑</div>
                      <div className="box-subtitle">각 변수가 어떤 수신자 컬럼을 읽을지 선택합니다</div>
                    </div>
                  </div>
                  <div className="box-section-tight">
                    {variableRows.map((row, index) => (
                      <div
                        className={`box-row${index === variableRows.length - 1 ? " box-row-last" : ""}`}
                        key={row.variable}
                      >
                        <div className="campaign-variable-grid">
                          <div>
                            <div className="table-kind-text">변수</div>
                            <div className="text-mono">{row.variable}</div>
                          </div>
                          <div>
                            <div className="table-kind-text">수신자 컬럼</div>
                            <FormSelect
                              className="form-control"
                              value={row.fieldKey || UNMAPPED_FIELD}
                              onChange={(event) =>
                                setTemplateVariableMappings((current) => ({
                                  ...current,
                                  [row.variable]:
                                    event.target.value === UNMAPPED_FIELD ? "" : event.target.value,
                                }))
                              }
                            >
                              <option value={UNMAPPED_FIELD}>컬럼 선택</option>
                              {recipientFields.map((field) => (
                                <option key={field.key} value={field.key}>
                                  {field.label}
                                </option>
                              ))}
                            </FormSelect>
                          </div>
                          <div>
                            <div className="table-kind-text">샘플 값</div>
                            <div className="td-muted">
                              {row.sampleValue || "—"}
                              {row.missingCount > 0 ? ` · ${row.missingCount}명 비어 있음` : ""}
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
                <div className="box-header"><div className="box-title">발송 미리보기</div></div>
                <div className="box-body">
                  <div className="sms-preview-phone">
                    <div className="sms-preview-time">
                      {scheduleType === "later" && scheduledAt ? formatScheduleLabel(scheduledAt) : "지금"}
                    </div>
                    <div className="sms-preview-media-row">
                      <div className="sms-preview-bubble">
                        {previewBody || <span className="sms-preview-placeholder">본문을 입력하면 여기에서 확인할 수 있습니다.</span>}
                      </div>
                    </div>
                    <div className="sms-preview-sender">
                      {previewUser ? `${previewUser.name} 미리보기` : "선택된 수신자 없음"}
                    </div>
                  </div>
                </div>
              </div>
              <div className="box">
                <div className="box-header"><div className="box-title">현재 구성</div></div>
                <div className="box-section-tight">
                  <div className="box-row"><div className="box-row-content"><div className="table-kind-text">수신자</div><div className="table-title-text">{formatCount(selectedContactableUsers.length)}명</div></div></div>
                  <div className="box-row"><div className="box-row-content"><div className="table-kind-text">발신번호</div><div className="table-title-text">{senderNumbers.find((item) => item.id === selectedSenderNumberId)?.phoneNumber || "미선택"}</div></div></div>
                  <div className="box-row box-row-last"><div className="box-row-content"><div className="table-kind-text">템플릿</div><div className="table-title-text">{selectedTemplate?.name || "직접 작성"}</div></div></div>
                </div>
              </div>
            </div>
          </div>

          <div className="campaign-action-bar">
            <button className="btn btn-default" onClick={() => setStep(2)}>이전</button>
            <button className="btn btn-accent" onClick={goNextFromStep3}>다음 단계 <AppIcon name="chevron-right" className="icon icon-14" /></button>
          </div>
        </>
      ) : null}

      {step === 4 ? (
        <>
          <div className="flash flash-info">
            <div className="flash-body">발송 전 최종 확인 단계입니다. 접수 후에는 즉시 처리되거나 예약 대기 상태로 전환됩니다.</div>
          </div>
          <div className="campaign-detail-grid">
            <div className="box">
              <div className="box-header"><div className="box-title">발송 요약</div></div>
              <div className="box-section-tight">
                <div className="box-row"><div className="box-row-content"><div className="table-kind-text">캠페인명</div><div className="table-title-text">{title.trim() || "이름 미입력"}</div></div></div>
                <div className="box-row"><div className="box-row-content"><div className="table-kind-text">채널</div><div><span className="chip chip-sms">SMS</span></div></div></div>
                <div className="box-row"><div className="box-row-content"><div className="table-kind-text">발신번호</div><div className="text-mono">{senderNumbers.find((item) => item.id === selectedSenderNumberId)?.phoneNumber || "미선택"}</div></div></div>
                <div className="box-row"><div className="box-row-content"><div className="table-kind-text">수신자</div><div className="table-title-text">{formatCount(selectedContactableUsers.length)}명</div></div></div>
                <div className="box-row"><div className="box-row-content"><div className="table-kind-text">발송 시간</div><div className="table-title-text">{scheduleType === "later" && scheduledAt ? formatScheduleLabel(scheduledAt) : "즉시 발송"}</div></div></div>
                <div className="box-row box-row-last"><div className="box-row-content"><div className="table-kind-text">메시지</div><div className="box-row-desc campaign-message-preview-desc">{previewBody || "본문 없음"}</div></div></div>
              </div>
            </div>
            <div className="box">
              <div className="box-header"><div className="box-title">발송 전 체크</div></div>
              <div className="box-section-tight">
                <div className="box-row"><div className="box-row-content"><div className="table-kind-text">발송 가능 수신자</div><div className="table-title-text">{formatCount(selectedContactableUsers.length)}명</div></div></div>
                <div className="box-row"><div className="box-row-content"><div className="table-kind-text">변수 매핑</div><div className="table-title-text">{templateVariables.length === 0 ? "필요 없음" : `${variableRows.filter((row) => row.fieldKey).length} / ${variableRows.length}`}</div></div></div>
                <div className="box-row box-row-last">
                  <div className="box-row-content">
                    <div className="table-kind-text">광고 여부</div>
                    <div className="table-title-text">{isAdvertisement ? "광고" : "일반"}</div>
                    {isAdvertisement && advertisementSetupStatus ? (
                      <div className="box-row-desc campaign-ad-preview-desc">
                        {sms080State.approvedService?.unsubscribeNumber
                          ? `080수신 거부 번호: ${formatSms080Number(sms080State.approvedService.unsubscribeNumber)}`
                          : `080수신 거부 서비스: ${getSmsAdvertisementSetupStatusLabel(advertisementSetupStatus)}`}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="campaign-action-bar campaign-action-bar-spacious">
            <button className="btn btn-default" onClick={() => setStep(3)} disabled={submitting}>이전</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
              <AppIcon name="send" className="icon icon-14" />
              {submitting ? "접수 중..." : "캠페인 발송"}
            </button>
          </div>
        </>
      ) : null}

      <SmsAdvertisementSetupDialog
        open={advertisementDialogOpen}
        pendingCount={sms080State.pendingCount}
        returnFocusRef={advertisementCheckboxRef}
        onManage080={openSms080Settings}
        onClose={() => setAdvertisementDialogOpen(false)}
      />
    </>
  );
}

function renderCampaignStepCircle(currentStep: 1 | 2 | 3 | 4, step: 1 | 2 | 3 | 4) {
  const done = step < currentStep;
  const active = step === currentStep;

  return (
    <div className={`step-circle${done ? " done" : active ? " active" : ""}`}>
      {done ? <AppIcon name="check" className="icon icon-14" /> : step}
    </div>
  );
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
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getByteLength(text: string) {
  return new Blob([text]).size;
}
