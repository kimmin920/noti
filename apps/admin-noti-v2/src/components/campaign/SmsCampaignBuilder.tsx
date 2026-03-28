"use client";

import { useMemo, useState } from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import {
  SkeletonTableBox,
  SkeletonToolbarBox,
} from "@/components/loading/PageSkeleton";
import {
  createV2SmsCampaign,
  fetchV2SmsCampaignBootstrap,
  searchV2CampaignRecipients,
  type V2CampaignRecipientSearchResponse,
  type V2RecipientFieldDefinition,
  type V2SmsCampaignBootstrapResponse,
} from "@/lib/api/v2";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";
import { useAppStore } from "@/lib/store/app-store";

type RecipientSearchStatus = "all" | "ACTIVE" | "INACTIVE" | "DORMANT" | "BLOCKED";
type CampaignRecipientItem = V2CampaignRecipientSearchResponse["items"][number];

const SEARCH_LIMIT = 20;
const UNMAPPED_FIELD = "__unmapped__";
const AD_PREFIX = "(광고)";
const AD_OPT_OUT_TEXT = "무료수신거부 080-500-4233";

export function SmsCampaignBuilder({
  onSubmitted,
}: {
  onSubmitted: (campaignId: string) => void;
}) {
  const setCampaign = useAppStore((state) => state.setCampaign);
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
  const [searchOffset, setSearchOffset] = useState(0);
  const [title, setTitle] = useState("");
  const [scheduleType, setScheduleType] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [selectedSenderNumberId, setSelectedSenderNumberId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [manualBody, setManualBody] = useState("");
  const [isAdvertisement, setIsAdvertisement] = useState(false);
  const [advertisingServiceName, setAdvertisingServiceName] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [templateVariableMappings, setTemplateVariableMappings] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const senderNumbers = bootstrap?.senderNumbers ?? [];
  const templates = bootstrap?.templates ?? [];
  const recipientFields = bootstrap?.recipientFields ?? [];
  const recipientItems = recipients?.items ?? [];
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
  const selectedUserSet = useMemo(() => new Set(selectedUserIds), [selectedUserIds]);
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
  const visibleSelectableUsers = useMemo(
    () => recipientItems.filter((item) => item.hasPhone),
    [recipientItems],
  );
  const allVisibleSelected =
    visibleSelectableUsers.length > 0 &&
    visibleSelectableUsers.every((item) => selectedUserSet.has(item.id));
  const previewUser = selectedContactableUsers[0] ?? visibleSelectableUsers[0] ?? null;
  const fieldLabelMap = useMemo(
    () => new Map(recipientFields.map((field) => [field.key, field.label])),
    [recipientFields],
  );
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
  const previewBody = useMemo(() => {
    const rendered = renderTemplatePreview(resolvedBody, previewVariables);
    return formatAdvertisementPreview(rendered, {
      isAdvertisement,
      advertisingServiceName,
    });
  }, [advertisingServiceName, isAdvertisement, previewVariables, resolvedBody]);
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

  function toggleRecipient(userId: string) {
    setSelectedUserIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );
  }

  function toggleVisibleRecipients() {
    setSelectedUserIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        visibleSelectableUsers.forEach((item) => next.delete(item.id));
      } else {
        visibleSelectableUsers.forEach((item) => next.add(item.id));
      }
      return [...next];
    });
  }

  function goNextFromStep1() {
    setSubmitError(null);

    if (scheduleType === "later" && !scheduledAt) {
      setSubmitError("예약 발송 시각을 입력해 주세요.");
      return;
    }

    if (scheduleType === "later") {
      const candidate = new Date(scheduledAt);
      if (Number.isNaN(candidate.getTime()) || candidate.getTime() <= Date.now()) {
        setSubmitError("예약 발송 시각은 현재 시각보다 이후여야 합니다.");
        return;
      }
    }

    setStep(2);
  }

  function goNextFromStep2() {
    setSubmitError(null);

    if (selectedUserIds.length === 0) {
      setSubmitError("수신자를 최소 한 명 이상 선택해 주세요.");
      return;
    }

    if (selectedContactableUsers.length === 0) {
      setSubmitError("전화번호가 있는 수신자를 최소 한 명 이상 선택해 주세요.");
      return;
    }

    if (selectedContactableUsers.length > (bootstrap?.limits.maxUserCount ?? 1000)) {
      setSubmitError(`한 번에 최대 ${formatCount(bootstrap?.limits.maxUserCount ?? 1000)}명까지 선택할 수 있습니다.`);
      return;
    }

    setStep(3);
  }

  function goNextFromStep3() {
    setSubmitError(null);

    if (!selectedSenderNumberId) {
      setSubmitError("발신번호를 선택해 주세요.");
      return;
    }

    if (!resolvedBody.trim()) {
      setSubmitError("본문을 입력하거나 템플릿을 선택해 주세요.");
      return;
    }

    const unmappedVariables = variableRows.filter((row) => !row.fieldKey).map((row) => row.variable);
    if (unmappedVariables.length > 0) {
      setSubmitError(`다음 변수의 컬럼 매핑이 필요합니다: ${unmappedVariables.join(", ")}`);
      return;
    }

    const invalidVariables = variableRows.filter((row) => row.fieldKey && row.missingCount > 0);
    if (invalidVariables.length > 0) {
      setSubmitError(
        invalidVariables
          .map((row) => `${row.variable}(${row.missingCount}명 값 없음)`)
          .join(", ") + " 값을 먼저 채우거나 다른 컬럼으로 매핑해 주세요.",
      );
      return;
    }

    setStep(4);
  }

  async function handleSubmit() {
    setSubmitError(null);
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
      setSubmitError(
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
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button className="btn btn-default btn-sm" onClick={() => setCampaign({ mode: "list", step: 1 })}>
                <AppIcon name="chevron-right" className="icon icon-14" style={{ transform: "rotate(180deg)" }} />
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
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="btn btn-default btn-sm" onClick={() => setCampaign({ mode: "list", step: 1 })}>
              <AppIcon name="chevron-right" className="icon icon-14" style={{ transform: "rotate(180deg)" }} />
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

      {submitError ? (
        <div className="flash flash-attention">
          <AppIcon name="warn" className="icon icon-16 flash-icon" />
          <div className="flash-body">{submitError}</div>
        </div>
      ) : null}

      <div className="box mb-16">
        <div className="box-body" style={{ padding: "16px 24px" }}>
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
                  className="form-control"
                  placeholder="예: 4월 신규 가입자 안내"
                  style={{ maxWidth: 420 }}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
                <p className="form-hint">내부 관리용 이름으로, 수신자에게 직접 노출되지는 않습니다.</p>
              </div>
              <div className="form-group">
                <label className="form-label">발송 채널</label>
                <div style={{ display: "flex", gap: 10, maxWidth: 420 }}>
                  <div
                    className="campaign-channel-card"
                    style={{
                      borderColor: "var(--accent-emphasis)",
                      background: "var(--accent-subtle)",
                    }}
                  >
                    <div className="campaign-channel-title">SMS</div>
                    <div className="table-subtext">이번 단계에서 우선 지원합니다</div>
                  </div>
                  <div className="campaign-channel-card campaign-channel-card-muted" aria-disabled="true">
                    <div className="campaign-channel-title">알림톡</div>
                    <div className="table-subtext">다음 단계에서 이어서 지원 예정</div>
                  </div>
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">발송 시간</label>
                <div className="sms-schedule-options" style={{ maxWidth: 420 }}>
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
                    style={{ maxWidth: 260 }}
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
          <div className="box mb-16">
            <div className="box-header">
              <div>
                <div className="box-title">수신자 선택</div>
                <div className="box-subtitle">
                  관리 중인 수신자만 선택할 수 있습니다. 전화번호가 없는 대상은 선택되지 않습니다.
                </div>
              </div>
              <span className="text-small text-muted">
                현재 선택 {formatCount(selectedContactableUsers.length)}명
              </span>
            </div>
            <div className="box-body toolbar-box-body">
              <div className="toolbar-row">
                <div className="toolbar-search-wrap">
                  <AppIcon name="search" className="icon icon-14 toolbar-search-icon" />
                  <input
                    className="form-control toolbar-input-with-icon"
                    placeholder="이름, 전화번호, 이메일, 외부 ID 검색"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void loadRecipients({ offset: 0 });
                      }
                    }}
                  />
                </div>
                <select
                  className="form-control toolbar-select narrow"
                  value={searchStatus}
                  onChange={(event) => setSearchStatus(event.target.value as RecipientSearchStatus)}
                >
                  <option value="ACTIVE">활성만</option>
                  <option value="all">전체 상태</option>
                  <option value="INACTIVE">비활성</option>
                  <option value="DORMANT">휴면</option>
                  <option value="BLOCKED">차단</option>
                </select>
                <button className="btn btn-default" onClick={() => void loadRecipients({ offset: 0 })}>
                  검색
                </button>
                <button
                  className="btn btn-default"
                  onClick={() => setSelectedUserIds([])}
                  disabled={selectedUserIds.length === 0}
                >
                  선택 해제
                </button>
              </div>
            </div>
          </div>

          {recipientsError ? (
            <div className="flash flash-attention">
              <AppIcon name="warn" className="icon icon-16 flash-icon" />
              <div className="flash-body">{recipientsError}</div>
            </div>
          ) : null}

          <div className="box mb-16">
            <div className="box-body campaign-selection-summary">
              <div className="campaign-summary-chip">
                <span className="campaign-summary-label">검색 결과</span>
                <span className="campaign-summary-value">{formatCount(recipients?.summary.filteredCount ?? 0)}명</span>
              </div>
              <div className="campaign-summary-chip">
                <span className="campaign-summary-label">발송 가능</span>
                <span className="campaign-summary-value">{formatCount(recipients?.summary.contactableCount ?? 0)}명</span>
              </div>
              <div className="campaign-summary-chip">
                <span className="campaign-summary-label">선택 완료</span>
                <span className="campaign-summary-value">{formatCount(selectedContactableUsers.length)}명</span>
              </div>
            </div>
          </div>

          <div className="box">
            <div className="box-header">
              <div className="box-title">수신자 목록</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-default btn-sm" onClick={toggleVisibleRecipients} disabled={visibleSelectableUsers.length === 0}>
                  {allVisibleSelected ? "현재 목록 해제" : "현재 목록 선택"}
                </button>
              </div>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 44 }} />
                    <th>이름</th>
                    <th>전화번호</th>
                    <th>이메일</th>
                    <th>상태</th>
                    <th>세그먼트</th>
                    <th>유형</th>
                  </tr>
                </thead>
                <tbody>
                  {recipientItems.length > 0 ? (
                    recipientItems.map((recipient) => {
                      const selectable = recipient.hasPhone;
                      return (
                        <tr key={recipient.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedUserSet.has(recipient.id)}
                              disabled={!selectable}
                              onChange={() => toggleRecipient(recipient.id)}
                            />
                          </td>
                          <td>
                            <div className="table-title-text">{recipient.name}</div>
                            <div className="table-subtext">{recipient.externalId || recipient.source}</div>
                          </td>
                          <td className="td-mono">
                            {recipient.phone ? formatPhone(recipient.phone) : <span className="td-muted">전화번호 없음</span>}
                          </td>
                          <td className="td-muted">{recipient.email || "—"}</td>
                          <td><span className={`label ${recipientStatusPillClass(recipient.status)}`}><span className="label-dot" />{recipientStatusText(recipient.status)}</span></td>
                          <td className="td-muted">{recipient.segment || "—"}</td>
                          <td className="td-muted">{recipient.userType || "—"}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7}>
                        <div className="empty-state" style={{ padding: 24 }}>
                          <div className="empty-title" style={{ fontSize: 14 }}>검색 결과가 없습니다</div>
                          <div className="empty-desc">검색어 또는 상태 필터를 바꿔 다시 확인해 주세요.</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="box-footer">
              <span className="text-small text-muted">
                총 {formatCount(recipients?.summary.totalCount ?? 0)}명 중 현재 조건 {formatCount(recipients?.summary.filteredCount ?? 0)}명
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn btn-default btn-sm"
                  onClick={() => void loadRecipients({ offset: recipients?.page.prevOffset ?? 0 })}
                  disabled={recipientsLoading || recipients?.page.prevOffset == null}
                >
                  이전
                </button>
                <button
                  className="btn btn-default btn-sm"
                  onClick={() => void loadRecipients({ offset: recipients?.page.nextOffset ?? 0 })}
                  disabled={recipientsLoading || recipients?.page.nextOffset == null}
                >
                  다음
                </button>
              </div>
            </div>
          </div>

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
                    <select
                      className="form-control"
                      style={{ maxWidth: 320 }}
                      value={selectedSenderNumberId}
                      onChange={(event) => setSelectedSenderNumberId(event.target.value)}
                    >
                      <option value="">발신번호를 선택해 주세요</option>
                      {senderNumbers.map((sender) => (
                        <option key={sender.id} value={sender.id}>
                          {sender.phoneNumber}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">SMS 템플릿</label>
                    <select
                      className="form-control"
                      style={{ maxWidth: 360 }}
                      value={selectedTemplateId || "__manual__"}
                      onChange={(event) => setSelectedTemplateId(event.target.value === "__manual__" ? "" : event.target.value)}
                    >
                      <option value="__manual__">직접 작성</option>
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                    {selectedTemplate ? (
                      <div className="campaign-template-note">
                        <div className="table-title-text">{selectedTemplate.name}</div>
                        <div className="box-row-desc" style={{ fontSize: 12 }}>{selectedTemplate.body}</div>
                      </div>
                    ) : null}
                  </div>
                  <div className="form-group">
                    <label className="form-label">본문</label>
                    <textarea
                      className="form-control"
                      style={{ minHeight: 160 }}
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
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">광고 설정</label>
                    <label className="campaign-checkbox-row">
                      <input
                        type="checkbox"
                        checked={isAdvertisement}
                        onChange={(event) => setIsAdvertisement(event.target.checked)}
                      />
                      광고 메시지로 발송
                    </label>
                    {isAdvertisement ? (
                      <input
                        className="form-control"
                        style={{ maxWidth: 260, marginTop: 8 }}
                        placeholder="서비스명 입력"
                        value={advertisingServiceName}
                        onChange={(event) => setAdvertisingServiceName(event.target.value)}
                      />
                    ) : null}
                  </div>
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
                            <div className="table-kind-text">수신자 컬럼</div>
                            <select
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
                            </select>
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
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
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
                  <div className="box-row" style={{ borderBottom: "none" }}><div className="box-row-content"><div className="table-kind-text">템플릿</div><div className="table-title-text">{selectedTemplate?.name || "직접 작성"}</div></div></div>
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
                <div className="box-row" style={{ borderBottom: "none" }}><div className="box-row-content"><div className="table-kind-text">메시지</div><div className="box-row-desc" style={{ fontSize: 12, lineHeight: 1.6 }}>{previewBody || "본문 없음"}</div></div></div>
              </div>
            </div>
            <div className="box">
              <div className="box-header"><div className="box-title">발송 전 체크</div></div>
              <div className="box-section-tight">
                <div className="box-row"><div className="box-row-content"><div className="table-kind-text">발송 가능 수신자</div><div className="table-title-text">{formatCount(selectedContactableUsers.length)}명</div></div></div>
                <div className="box-row"><div className="box-row-content"><div className="table-kind-text">변수 매핑</div><div className="table-title-text">{templateVariables.length === 0 ? "필요 없음" : `${variableRows.filter((row) => row.fieldKey).length} / ${variableRows.length}`}</div></div></div>
                <div className="box-row" style={{ borderBottom: "none" }}><div className="box-row-content"><div className="table-kind-text">광고 여부</div><div className="table-title-text">{isAdvertisement ? "광고" : "일반"}</div></div></div>
              </div>
            </div>
          </div>
          <div className="campaign-action-bar" style={{ paddingBottom: 24 }}>
            <button className="btn btn-default" onClick={() => setStep(3)} disabled={submitting}>이전</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
              <AppIcon name="send" className="icon icon-14" />
              {submitting ? "접수 중..." : "캠페인 발송"}
            </button>
          </div>
        </>
      ) : null}
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
      return recipient.source || undefined;
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

function formatAdvertisementPreview(
  body: string,
  options: { isAdvertisement?: boolean; advertisingServiceName?: string | null },
) {
  const normalizedBody = body.replace(/\r\n?/g, "\n").trim();

  if (!options.isAdvertisement) {
    return normalizedBody;
  }

  const serviceName = String(options.advertisingServiceName ?? "").trim().replace(/\s+/g, " ");
  const prefix = `${AD_PREFIX}${serviceName}`;
  const content = normalizedBody
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== AD_OPT_OUT_TEXT)
    .join("\n")
    .replace(/^\(광고\)\s*/u, "")
    .trim();

  return [prefix, content, AD_OPT_OUT_TEXT].filter(Boolean).join("\n");
}

function recipientStatusText(status: RecipientSearchStatus | string) {
  if (status === "ACTIVE") return "활성";
  if (status === "INACTIVE") return "비활성";
  if (status === "DORMANT") return "휴면";
  if (status === "BLOCKED") return "차단";
  return status;
}

function recipientStatusPillClass(status: string) {
  if (status === "ACTIVE") return "label-green";
  if (status === "DORMANT") return "label-yellow";
  if (status === "BLOCKED") return "label-red";
  return "label-gray";
}

function formatPhone(value: string) {
  if (value.length === 11) {
    return `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7)}`;
  }

  if (value.length === 10) {
    return `${value.slice(0, 3)}-${value.slice(3, 6)}-${value.slice(6)}`;
  }

  return value;
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
