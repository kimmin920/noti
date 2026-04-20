"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import {
  SkeletonTableBox,
  SkeletonToolbarBox,
} from "@/components/loading/PageSkeleton";
import { FormSelect } from "@/components/ui/FormSelect";
import {
  createV2BrandCampaign,
  fetchV2BrandCampaignBootstrap,
  fetchV2BrandTemplateDetail,
  searchV2CampaignRecipients,
  uploadV2BrandMessageImage,
  type V2BrandCampaignBootstrapResponse,
  type V2BrandTemplateDetailResponse,
  type V2CampaignRecipientSearchResponse,
} from "@/lib/api/v2";
import { applyVariablesToBrandTemplate, renderTemplateTextWithVariables } from "@/lib/brand-template-rendering";
import {
  getBrandMessageNightWindowText,
  isBrandMessageImmediateRestricted,
  isBrandMessageScheduleRestricted,
} from "@/lib/brand-message-night-window";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";
import { useAppStore } from "@/lib/store/app-store";
import { BrandTemplatePreview } from "@/components/templates/BrandTemplatePreview";

type RecipientSearchStatus = "all" | "ACTIVE" | "INACTIVE" | "DORMANT" | "BLOCKED";
type CampaignRecipientItem = V2CampaignRecipientSearchResponse["items"][number];
type BrandButtonDraft = {
  id: string;
  type: "WL" | "AL" | "BK" | "MD";
  name: string;
  linkMo: string;
  linkPc: string;
  schemeIos: string;
  schemeAndroid: string;
};

const SEARCH_LIMIT = 20;
const UNMAPPED_FIELD = "__unmapped__";

function renderCampaignStepCircle(currentStep: 1 | 2 | 3 | 4, step: 1 | 2 | 3 | 4) {
  const done = step < currentStep;
  const active = step === currentStep;

  return (
    <div className={`step-circle${done ? " done" : active ? " active" : ""}`}>
      {done ? <AppIcon name="check" className="icon icon-14" /> : step}
    </div>
  );
}

function normalizeImageLinkInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

export function BrandCampaignBuilder({
  onSubmitted,
}: {
  onSubmitted: (campaignId: string) => void;
}) {
  const setCampaign = useAppStore((state) => state.setCampaign);
  const showDraftToast = useAppStore((state) => state.showDraftToast);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [bootstrap, setBootstrap] = useState<V2BrandCampaignBootstrapResponse | null>(null);
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
  const [selectedSenderProfileId, setSelectedSenderProfileId] = useState("");
  const [selectedMode, setSelectedMode] = useState<"FREESTYLE" | "TEMPLATE">("FREESTYLE");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateVariableMappings, setTemplateVariableMappings] = useState<Record<string, string>>({});
  const [selectedTemplateDetail, setSelectedTemplateDetail] = useState<V2BrandTemplateDetailResponse | null>(null);
  const [selectedTemplateDetailLoading, setSelectedTemplateDetailLoading] = useState(false);
  const [messageType, setMessageType] = useState<"TEXT" | "IMAGE" | "WIDE">("TEXT");
  const [content, setContent] = useState("");
  const [pushAlarm, setPushAlarm] = useState(true);
  const [adult, setAdult] = useState(false);
  const [scheduleType, setScheduleType] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [buttons, setButtons] = useState<BrandButtonDraft[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [imageLink, setImageLink] = useState("");
  const [uploadedImageName, setUploadedImageName] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const senderProfiles = bootstrap?.senderProfiles ?? [];
  const templates = bootstrap?.templates ?? [];
  const recipientFields = bootstrap?.recipientFields ?? [];
  const selectedSenderProfile =
    senderProfiles.find((item) => item.id === selectedSenderProfileId) ?? senderProfiles[0] ?? null;
  const availableTemplates = useMemo(() => {
    if (!selectedSenderProfile) {
      return [];
    }

    return templates.filter(
      (item) => item.senderProfileId === selectedSenderProfile.id && item.providerStatus === "APR",
    );
  }, [selectedSenderProfile, templates]);
  const selectedTemplate =
    availableTemplates.find((item) => item.id === selectedTemplateId) ?? availableTemplates[0] ?? null;
  const recipientItems = recipients?.items ?? [];
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
  const previewUser = selectedContactableUsers[0] ?? visibleSelectableUsers[0] ?? null;
  const templateVariables = useMemo(() => {
    const explicitVariables = toStringArray(selectedTemplate?.requiredVariables);
    return explicitVariables.length > 0
      ? explicitVariables
      : extractTemplateVariables(selectedTemplate?.content || "");
  }, [selectedTemplate?.content, selectedTemplate?.requiredVariables]);
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
  const previewTemplateVariables = useMemo(
    () =>
      Object.fromEntries(
        variableRows
          .filter((row) => row.sampleValue)
          .map((row) => [row.variable, row.sampleValue as string]),
      ),
    [variableRows],
  );
  const allVisibleSelected =
    visibleSelectableUsers.length > 0 &&
    visibleSelectableUsers.every((item) => selectedUserSet.has(item.id));
  const showInitialLoading = Boolean(
    (bootstrapLoading && !bootstrap) || (recipientsLoading && !recipients),
  );
  const isImageMessage = messageType !== "TEXT";
  const previewButtonCount = buttons.filter((item) => item.name.trim()).length;
  const isTemplateMode = selectedMode === "TEMPLATE";
  const nightSendWindow = bootstrap?.constraints.nightSendWindow ?? { start: "20:50", end: "08:00" };
  const immediateRestricted = isBrandMessageImmediateRestricted(nightSendWindow);
  const scheduledRestricted = scheduleType === "later" && isBrandMessageScheduleRestricted(scheduledAt, nightSendWindow);
  const scheduleRestrictionMessage =
    scheduleType === "now"
      ? immediateRestricted
        ? getBrandMessageNightWindowText(nightSendWindow)
        : null
      : scheduledRestricted
        ? getBrandMessageNightWindowText(nightSendWindow)
        : null;
  const previewBody = useMemo(
    () =>
      isTemplateMode
        ? renderTemplateTextWithVariables(selectedTemplate?.content || selectedTemplate?.templateName || "", previewTemplateVariables)
        : content.trim() || "브랜드 메시지 본문을 입력하면 여기에서 미리볼 수 있습니다.",
    [content, isTemplateMode, previewTemplateVariables, selectedTemplate?.content, selectedTemplate?.templateName],
  );
  const previewTemplateModel = useMemo(() => {
    if (!isTemplateMode || !selectedTemplateDetail?.template) {
      return null;
    }

    return applyVariablesToBrandTemplate(selectedTemplateDetail.template, previewTemplateVariables);
  }, [isTemplateMode, previewTemplateVariables, selectedTemplateDetail]);

  useEffect(() => {
    if (immediateRestricted && scheduleType === "now") {
      setScheduleType("later");
    }
  }, [immediateRestricted, scheduleType]);

  async function loadBootstrap() {
    setBootstrapLoading(true);
    setBootstrapError(null);

    try {
      const response = await fetchV2BrandCampaignBootstrap();
      setBootstrap(response);
      const nextSenderProfile = response.senderProfiles[0] ?? null;
      const nextTemplates = nextSenderProfile
        ? response.templates.filter((item) => item.senderProfileId === nextSenderProfile.id)
        : [];
      setSelectedSenderProfileId((current) => current || nextSenderProfile?.id || "");
      setSelectedTemplateId((current) => current || nextTemplates[0]?.id || "");
    } catch (error) {
      setBootstrapError(
        error instanceof Error ? error.message : "브랜드 메시지 대량 발송 준비 정보를 불러오지 못했습니다.",
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

  useEffect(() => {
    let cancelled = false;
    const templateCode = selectedTemplate?.templateCode;
    const senderProfileId = selectedTemplate?.senderProfileId;

    if (!isTemplateMode || !templateCode || !senderProfileId) {
      setSelectedTemplateDetail(null);
      setSelectedTemplateDetailLoading(false);
      return;
    }

    const loadTemplateDetail = async () => {
      setSelectedTemplateDetailLoading(true);

      try {
        const response = await fetchV2BrandTemplateDetail({
          senderProfileId,
          templateCode,
        });

        if (cancelled) return;
        setSelectedTemplateDetail(response);
      } catch {
        if (cancelled) return;
        setSelectedTemplateDetail(null);
      } finally {
        if (!cancelled) {
          setSelectedTemplateDetailLoading(false);
        }
      }
    };

    void loadTemplateDetail();

    return () => {
      cancelled = true;
    };
  }, [isTemplateMode, selectedTemplate?.senderProfileId, selectedTemplate?.templateCode]);

  function toggleRecipient(userId: string) {
    setSelectedUserIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );
  }

  function handleSenderProfileChange(value: string) {
    setSelectedSenderProfileId(value);
    const nextSenderProfile = senderProfiles.find((item) => item.id === value) ?? null;
    const nextTemplates = nextSenderProfile
      ? templates.filter((item) => item.senderProfileId === nextSenderProfile.id)
      : [];
    setSelectedTemplateId(nextTemplates[0]?.id ?? "");
    setTemplateVariableMappings({});
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

  function addButton() {
    setButtons((current) => [
      ...current,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: "WL",
        name: "",
        linkMo: "",
        linkPc: "",
        schemeIos: "",
        schemeAndroid: "",
      },
    ]);
  }

  function updateButton(buttonId: string, patch: Partial<BrandButtonDraft>) {
    setButtons((current) => current.map((item) => (item.id === buttonId ? { ...item, ...patch } : item)));
  }

  function removeButton(buttonId: string) {
    setButtons((current) => current.filter((item) => item.id !== buttonId));
  }

  function handleClearImage() {
    setImageUrl("");
    setUploadedImageName("");
    setImageLink("");
    setImageError(null);
  }

  function normalizeImageLinkState() {
    setImageLink((current) => normalizeImageLinkInput(current));
  }

  function showActionError(message: string) {
    showDraftToast(message, { tone: "error" });
  }

  async function handleImageFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !isImageMessage) {
      return;
    }

    const uploadMessageType = messageType === "WIDE" ? "WIDE" : "IMAGE";

    setImageUploading(true);
    setImageError(null);

    try {
      const uploaded = await uploadV2BrandMessageImage(file, uploadMessageType);
      setImageUrl(uploaded.imageUrl);
      setUploadedImageName(uploaded.imageName || file.name);
      setImageError(null);
      showDraftToast("이미지를 업로드했습니다.", { tone: "success" });
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "브랜드 메시지 이미지 업로드에 실패했습니다.");
    } finally {
      setImageUploading(false);
    }
  }

  function goNextFromStep1() {
    if (!selectedSenderProfileId) {
      showActionError("발신 프로필을 선택해 주세요.");
      return;
    }

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

    if (scheduleType === "now" && immediateRestricted) {
      showActionError(getBrandMessageNightWindowText(nightSendWindow));
      return;
    }

    if (scheduleType === "later" && scheduledRestricted) {
      showActionError(getBrandMessageNightWindowText(nightSendWindow));
      return;
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
    if (isTemplateMode) {
      if (!selectedTemplate) {
        showActionError("브랜드 템플릿을 선택해 주세요.");
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
      return;
    }

    if (!content.trim()) {
      showActionError("브랜드 메시지 본문을 입력해 주세요.");
      return;
    }

    if (messageType === "IMAGE" && content.trim().length > 400) {
      showActionError("이미지 메시지 본문은 최대 400자까지 입력할 수 있습니다.");
      return;
    }

    if (messageType === "WIDE" && content.trim().length > 76) {
      showActionError("와이드 메시지 본문은 최대 76자까지 입력할 수 있습니다.");
      return;
    }

    const buttonLimit = messageType === "WIDE" ? 2 : 5;
    const activeButtons = buttons.filter((item) => item.name.trim());
    if (activeButtons.length > buttonLimit) {
      showActionError(
        messageType === "WIDE"
          ? "와이드 메시지 버튼은 최대 2개까지 추가할 수 있습니다."
          : "버튼은 최대 5개까지 추가할 수 있습니다.",
      );
      return;
    }

    if (isImageMessage && !imageUrl.trim()) {
      setImageError("이미지를 먼저 업로드해 주세요.");
      return;
    }

    setStep(4);
  }

  async function handleSubmit() {
    if (!selectedSenderProfile) {
      showActionError("발신 프로필을 선택해 주세요.");
      return;
    }

    if (scheduleType === "now" && immediateRestricted) {
      showActionError(getBrandMessageNightWindowText(nightSendWindow));
      return;
    }

    if (scheduleType === "later" && scheduledRestricted) {
      showActionError(getBrandMessageNightWindowText(nightSendWindow));
      return;
    }

    setSubmitting(true);

    try {
      const normalizedImageLink = normalizeImageLinkInput(imageLink);
      if (normalizedImageLink !== imageLink) {
        setImageLink(normalizedImageLink);
      }

      const response = await createV2BrandCampaign({
        title: title.trim() || undefined,
        senderProfileId: selectedSenderProfile.id,
        mode: selectedMode,
        messageType: isTemplateMode
          ? (selectedTemplate?.chatBubbleType as
              | "TEXT"
              | "IMAGE"
              | "WIDE"
              | "WIDE_ITEM_LIST"
              | "CAROUSEL_FEED"
              | "PREMIUM_VIDEO"
              | "COMMERCE"
              | "CAROUSEL_COMMERCE"
              | undefined)
          : messageType,
        content: isTemplateMode ? undefined : content.trim(),
        templateCode: isTemplateMode ? selectedTemplate?.templateCode ?? undefined : undefined,
        templateName: isTemplateMode ? selectedTemplate?.templateName : undefined,
        templateBody: isTemplateMode ? selectedTemplate?.content ?? undefined : undefined,
        requiredVariables: isTemplateMode ? templateVariables : undefined,
        pushAlarm,
        adult,
        buttons: isTemplateMode
          ? undefined
          : buttons
              .filter((item) => item.name.trim())
              .map((item) => ({
                type: item.type,
                name: item.name.trim(),
                linkMo: item.linkMo.trim() || undefined,
                linkPc: item.linkPc.trim() || undefined,
                schemeIos: item.schemeIos.trim() || undefined,
                schemeAndroid: item.schemeAndroid.trim() || undefined,
              })),
        image:
          isTemplateMode || messageType === "TEXT"
            ? undefined
            : {
                imageUrl: imageUrl.trim() || undefined,
                imageLink: normalizedImageLink || undefined,
              },
        userIds: selectedUserIds,
        templateVariableMappings: isTemplateMode
          ? variableRows
              .filter((row) => row.fieldKey)
              .map((row) => ({
                templateVariable: row.variable,
                userFieldKey: row.fieldKey,
              }))
          : undefined,
        scheduledAt:
          scheduleType === "later" && scheduledAt
            ? new Date(scheduledAt).toISOString()
            : undefined,
      });

      onSubmitted(response.campaignId);
    } catch (error) {
      showActionError(
        error instanceof Error ? error.message : "브랜드 메시지 대량 발송 요청을 접수하지 못했습니다.",
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
                <div className="page-title">브랜드 메시지 대량 발송 만들기</div>
                <div className="page-desc">브랜드 메시지 대량 발송 준비 정보를 불러오고 있습니다</div>
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
                <div className="page-title">브랜드 메시지 대량 발송 만들기</div>
                <div className="page-desc">채널 친구를 대상으로 자유형 또는 템플릿형 브랜드 메시지를 대량 발송합니다</div>
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
              <div className="brand-form-grid">
                <div className="form-group">
                  <label className="form-label">캠페인명</label>
                  <input
                    className="form-control"
                    placeholder="예: 4월 친구 대상 혜택 안내"
                    style={{ maxWidth: 420 }}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                  <p className="form-hint">내부 관리용 이름으로, 수신자에게 직접 노출되지는 않습니다.</p>
                </div>
                <div className="form-group">
                  <label className="form-label">발신 프로필</label>
                  <FormSelect
                    className="form-control"
                    style={{ maxWidth: 420 }}
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
                <div className="form-group">
                  <label className="form-label">발송 방식</label>
                  <FormSelect
                    className="form-control"
                    style={{ maxWidth: 240 }}
                    value={selectedMode}
                    onChange={(event) => {
                      const nextMode = event.target.value as "FREESTYLE" | "TEMPLATE";
                      setSelectedMode(nextMode);
                      setTemplateVariableMappings({});
                      setImageError(null);
                    }}
                  >
                    <option value="FREESTYLE">자유형</option>
                    <option value="TEMPLATE">템플릿형</option>
                  </FormSelect>
                  <p className="form-hint">템플릿형은 NHN에 등록된 브랜드 템플릿을 그대로 사용합니다.</p>
                </div>
                {selectedMode === "FREESTYLE" ? (
                  <div className="form-group">
                    <label className="form-label">메시지 타입</label>
                    <FormSelect
                      className="form-control"
                      style={{ maxWidth: 240 }}
                      value={messageType}
                      onChange={(event) => {
                        setMessageType(event.target.value as "TEXT" | "IMAGE" | "WIDE");
                        setImageError(null);
                      }}
                    >
                      {(bootstrap?.supportedMessageTypes ?? ["TEXT", "IMAGE", "WIDE"]).map((type) => (
                        <option key={type} value={type}>
                          {type === "TEXT" ? "텍스트" : type === "IMAGE" ? "이미지" : "와이드 이미지"}
                        </option>
                      ))}
                    </FormSelect>
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label">브랜드 템플릿</label>
                    <FormSelect
                      className="form-control"
                      style={{ maxWidth: 420 }}
                      value={selectedTemplateId}
                      onChange={(event) => {
                        setSelectedTemplateId(event.target.value);
                        setTemplateVariableMappings({});
                      }}
                    >
                      <option value="">브랜드 템플릿을 선택해 주세요</option>
                      {availableTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.templateName}
                        </option>
                      ))}
                    </FormSelect>
                    <p className="form-hint">
                      {selectedSenderProfile
                        ? `선택한 발신 프로필에 연결된 템플릿 ${formatCount(availableTemplates.length)}개`
                        : "먼저 발신 프로필을 선택해 주세요."}
                    </p>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">타겟팅 유형</label>
                  <FormSelect className="form-control" style={{ maxWidth: 240 }} value="I" disabled>
                    <option value="I">I - 채널 친구 대상</option>
                  </FormSelect>
                </div>
              </div>

              <div className="brand-toggle-row" style={{ marginBottom: 16 }}>
                <label className="campaign-checkbox-row">
                  <input type="checkbox" checked={pushAlarm} onChange={(event) => setPushAlarm(event.target.checked)} />
                  푸시 알람 활성화
                </label>
                <label className="campaign-checkbox-row">
                  <input type="checkbox" checked={adult} onChange={(event) => setAdult(event.target.checked)} />
                  성인용 메시지
                </label>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">발송 시간</label>
                <div className="sms-schedule-options" style={{ maxWidth: 420 }}>
                  <label className="sms-schedule-option">
                    <input
                      type="radio"
                      name="bulkBrandSched"
                      checked={scheduleType === "now"}
                      onChange={() => setScheduleType("now")}
                      disabled={immediateRestricted}
                    />
                    즉시 발송
                  </label>
                  <label className="sms-schedule-option">
                    <input
                      type="radio"
                      name="bulkBrandSched"
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
                <p className={`form-hint${scheduleRestrictionMessage ? " form-field-error" : ""}`}>
                  {scheduleRestrictionMessage ?? getBrandMessageNightWindowText(nightSendWindow)}
                </p>
              </div>
            </div>
          </div>
          <div className="campaign-action-bar">
            <button className="btn btn-default" onClick={() => setCampaign({ mode: "list", step: 1 })}>취소</button>
            <button className="btn btn-accent" onClick={goNextFromStep1} disabled={Boolean(scheduleRestrictionMessage)}>다음 단계 <AppIcon name="chevron-right" className="icon icon-14" /></button>
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
                  채널 친구 대상 대량 발송을 위해 관리 중인 수신자를 선택합니다. 전화번호가 없는 대상은 제외됩니다.
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
                <FormSelect
                  className="form-control toolbar-select narrow"
                  value={searchStatus}
                  onChange={(event) => setSearchStatus(event.target.value as RecipientSearchStatus)}
                >
                  <option value="ACTIVE">활성만</option>
                  <option value="all">전체 상태</option>
                  <option value="INACTIVE">비활성</option>
                  <option value="DORMANT">휴면</option>
                  <option value="BLOCKED">차단</option>
                </FormSelect>
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
                          <td className="td-mono">{recipient.phone || "전화번호 없음"}</td>
                          <td className="td-muted">{recipient.email || "—"}</td>
                          <td>
                            <span className={`label ${recipientStatusClass(recipient.status)}`} style={{ fontSize: 11 }}>
                              <span className="label-dot" />
                              {recipientStatusText(recipient.status)}
                            </span>
                          </td>
                          <td className="td-muted">{recipient.segment || "—"}</td>
                          <td className="td-muted">{recipient.userType || "—"}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="td-muted" style={{ textAlign: "center", padding: "24px 0" }}>
                        {recipientsLoading ? "수신자 목록을 불러오는 중입니다." : "검색 조건에 맞는 수신자가 없습니다."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="box-footer">
              <span className="text-small text-muted">
                {recipients ? `${formatCount(recipients.page.offset + 1)}-${formatCount(recipients.page.offset + recipientItems.length)} / ${formatCount(recipients.summary.filteredCount)}명` : "검색 결과 없음"}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn btn-default btn-sm"
                  disabled={!recipients?.page.prevOffset && recipients?.page.prevOffset !== 0}
                  onClick={() => void loadRecipients({ offset: recipients?.page.prevOffset ?? 0 })}
                >
                  이전
                </button>
                <button
                  className="btn btn-default btn-sm"
                  disabled={!recipients?.page.hasNext}
                  onClick={() => void loadRecipients({ offset: recipients?.page.nextOffset ?? 0 })}
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
                <div className="box-header">
                  <div className="box-title">{isTemplateMode ? "템플릿 선택 및 변수 연결" : "메시지 작성"}</div>
                </div>
                <div className="box-body">
                  {isTemplateMode ? (
                    <>
                      <div className="form-group">
                        <label className="form-label">브랜드 템플릿</label>
                        <FormSelect
                          className="form-control"
                          value={selectedTemplateId}
                          onChange={(event) => {
                            setSelectedTemplateId(event.target.value);
                            setTemplateVariableMappings({});
                          }}
                        >
                          <option value="">브랜드 템플릿을 선택해 주세요</option>
                          {availableTemplates.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.templateName}
                            </option>
                          ))}
                        </FormSelect>
                        <p className="form-hint">
                          발신 프로필에 연결된 NHN 브랜드 템플릿만 표시됩니다.
                        </p>
                      </div>

                      {selectedTemplate ? (
                        <div className="box" style={{ marginBottom: 16 }}>
                          <div className="box-section-tight">
                            <div className="box-row">
                              <div className="box-row-content">
                                <div className="table-kind-text">템플릿명</div>
                                <div className="table-title-text">{selectedTemplate.templateName}</div>
                              </div>
                            </div>
                            <div className="box-row">
                              <div className="box-row-content">
                                <div className="table-kind-text">템플릿 코드</div>
                                <div className="text-mono">{selectedTemplate.templateCode || "—"}</div>
                              </div>
                            </div>
                            <div className="box-row" style={{ borderBottom: "none" }}>
                              <div className="box-row-content">
                                <div className="table-kind-text">말풍선 유형</div>
                                <div className="table-title-text">{selectedTemplate.chatBubbleType || "—"}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <div className="box">
                        <div className="box-header">
                          <div className="box-title">변수 매핑</div>
                          <div className="box-subtitle">템플릿 변수마다 수신자 컬럼을 연결해 주세요.</div>
                        </div>
                        <div className="box-body">
                          {templateVariables.length === 0 ? (
                            <div className="brand-button-empty">이 템플릿은 변수 매핑이 필요하지 않습니다.</div>
                          ) : (
                            <div className="brand-button-list">
                              {variableRows.map((row) => (
                                <div className="brand-button-card" key={row.variable}>
                                  <div className="brand-button-card-top">
                                    <strong>#{`{${row.variable}}`}</strong>
                                  </div>
                                  <div className="brand-form-grid">
                                    <div className="form-group">
                                      <label className="form-label">수신자 컬럼</label>
                                      <FormSelect
                                        className="form-control"
                                        value={row.fieldKey || ""}
                                        onChange={(event) =>
                                          setTemplateVariableMappings((current) => ({
                                            ...current,
                                            [row.variable]:
                                              event.target.value === UNMAPPED_FIELD ? "" : event.target.value,
                                          }))
                                        }
                                      >
                                        <option value="">컬럼을 선택해 주세요</option>
                                        <option value={UNMAPPED_FIELD}>매핑 해제</option>
                                        {recipientFields.map((field) => (
                                          <option key={field.key} value={field.key}>
                                            {field.label}
                                          </option>
                                        ))}
                                      </FormSelect>
                                    </div>
                                    <div className="form-group">
                                      <label className="form-label">샘플 값</label>
                                      <input
                                        className="form-control"
                                        value={row.sampleValue || ""}
                                        readOnly
                                        placeholder="선택된 수신자 기준 샘플 값"
                                      />
                                      {row.fieldKey && row.missingCount > 0 ? (
                                        <div className="form-field-error">
                                          선택한 수신자 중 {formatCount(row.missingCount)}명은 이 값이 비어 있습니다.
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {selectedTemplate ? (
                        <div className="box" style={{ marginTop: 16 }}>
                          <div className="box-header">
                            <div className="box-title">적용 결과 미리보기</div>
                            <div className="box-subtitle">첫 번째 발송 가능 수신자 기준으로 변수 값을 채워 보여줍니다.</div>
                          </div>
                          <div className="box-body">
                            {selectedTemplateDetailLoading ? (
                              <div className="brand-template-empty">템플릿 구조를 불러오는 중입니다.</div>
                            ) : previewTemplateModel ? (
                              <div className="campaign-brand-template-preview-wrap">
                                <BrandTemplatePreview model={previewTemplateModel} compact />
                              </div>
                            ) : (
                              <div className="brand-template-empty">템플릿 구조를 불러오지 못했습니다.</div>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <div className="form-group">
                        <label className="form-label">내용</label>
                        <textarea
                          className="form-control"
                          rows={8}
                          maxLength={messageType === "TEXT" ? 1300 : messageType === "IMAGE" ? 400 : 76}
                          value={content}
                          onChange={(event) => setContent(event.target.value)}
                          placeholder="브랜드 메시지 본문을 입력하세요"
                        />
                        <div className="campaign-field-help">
                          <span>{messageType === "TEXT" ? "텍스트형 최대 1300자" : messageType === "IMAGE" ? "이미지형 최대 400자" : "와이드형 최대 76자"}</span>
                          <span>{content.length} / {messageType === "TEXT" ? 1300 : messageType === "IMAGE" ? 400 : 76}</span>
                        </div>
                      </div>

                      {isImageMessage ? (
                        <div className="brand-form-grid">
                          <div className="form-group">
                            <label className="form-label">이미지 업로드</label>
                            <input
                              ref={imageInputRef}
                              type="file"
                              accept="image/png,image/jpeg"
                              onChange={handleImageFileChange}
                              style={{ display: "none" }}
                            />
                            <div className="brand-upload-actions">
                              <button
                                type="button"
                                className="btn btn-default btn-sm"
                                onClick={() => imageInputRef.current?.click()}
                                disabled={imageUploading || submitting}
                              >
                                <AppIcon name="upload" className="icon icon-14" />
                                {imageUploading ? "업로드 중..." : imageUrl ? "이미지 교체" : "이미지 업로드"}
                              </button>
                              {imageUrl ? (
                                <button
                                  type="button"
                                  className="btn btn-default btn-sm"
                                  onClick={handleClearImage}
                                  disabled={imageUploading || submitting}
                                >
                                  <AppIcon name="x" className="icon icon-14" />
                                  제거
                                </button>
                              ) : null}
                            </div>
                            <div className="brand-upload-note">JPG/PNG, 최대 5MB. 업로드 후 발송용 이미지 URL이 자동으로 연결됩니다.</div>
                            {imageError ? <div className="form-field-error">{imageError}</div> : null}
                            {imageUrl ? (
                              <div className="brand-upload-summary">
                                <div className="brand-upload-thumb-wrap">
                                  <img src={imageUrl} alt={uploadedImageName || "업로드 이미지"} className="brand-upload-thumb" />
                                </div>
                                <div className="brand-upload-meta">
                                  <div className="brand-upload-name">{uploadedImageName || "업로드된 이미지"}</div>
                                  <input className="form-control" value={imageUrl} readOnly />
                                </div>
                              </div>
                            ) : null}
                          </div>
                          <div className="form-group">
                            <label className="form-label">이미지 링크</label>
                            <input
                              className="form-control"
                              value={imageLink}
                              onChange={(event) => setImageLink(event.target.value)}
                              onBlur={normalizeImageLinkState}
                              placeholder="선택 사항, 입력 시 https://가 자동으로 붙습니다"
                            />
                            <div className="brand-upload-note">비워두면 카카오 기본 이미지 뷰어가 열립니다.</div>
                          </div>
                        </div>
                      ) : null}

                      <div className="brand-button-editor">
                        <div className="brand-button-editor-top">
                          <div>
                            <div className="box-title" style={{ fontSize: 14 }}>버튼</div>
                            <div className="box-subtitle">와이드형은 최대 2개, 그 외 타입은 최대 5개까지 추가할 수 있습니다</div>
                          </div>
                          <button type="button" className="btn btn-default btn-sm" onClick={addButton}>
                            <AppIcon name="plus" className="icon icon-14" />
                            버튼 추가
                          </button>
                        </div>

                        {buttons.length === 0 ? (
                          <div className="brand-button-empty">버튼을 사용하려면 [버튼 추가]를 눌러 주세요.</div>
                        ) : (
                          <div className="brand-button-list">
                            {buttons.map((button, index) => (
                              <div className="brand-button-card" key={button.id}>
                                <div className="brand-button-card-top">
                                  <strong>버튼 {index + 1}</strong>
                                  <button type="button" className="btn btn-default btn-sm" onClick={() => removeButton(button.id)}>
                                    <AppIcon name="trash" className="icon icon-14" />
                                  </button>
                                </div>
                                <div className="brand-form-grid">
                                  <div className="form-group">
                                    <label className="form-label">타입</label>
                                    <FormSelect
                                      className="form-control"
                                      value={button.type}
                                      onChange={(event) =>
                                        updateButton(button.id, {
                                          type: event.target.value as BrandButtonDraft["type"],
                                        })
                                      }
                                    >
                                      <option value="WL">웹 링크</option>
                                      <option value="AL">앱 링크</option>
                                      <option value="BK">봇 키워드</option>
                                      <option value="MD">메시지 전달</option>
                                    </FormSelect>
                                  </div>
                                  <div className="form-group">
                                    <label className="form-label">버튼 이름</label>
                                    <input
                                      className="form-control"
                                      maxLength={14}
                                      value={button.name}
                                      onChange={(event) => updateButton(button.id, { name: event.target.value })}
                                      placeholder="최대 14자"
                                    />
                                  </div>
                                  <div className="form-group">
                                    <label className="form-label">모바일 링크</label>
                                    <input
                                      className="form-control"
                                      value={button.linkMo}
                                      onChange={(event) => updateButton(button.id, { linkMo: event.target.value })}
                                      placeholder="https://"
                                    />
                                  </div>
                                  <div className="form-group">
                                    <label className="form-label">PC 링크</label>
                                    <input
                                      className="form-control"
                                      value={button.linkPc}
                                      onChange={(event) => updateButton(button.id, { linkPc: event.target.value })}
                                      placeholder="https://"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div>
              <div className="box" style={{ marginBottom: 12 }}>
                <div className="box-header">
                  <div className="box-title">미리보기</div>
                  <span className="chip chip-brand">브랜드</span>
                </div>
                <div className="box-body-tight">
                  {isTemplateMode ? (
                    selectedTemplateDetailLoading ? (
                      <div className="brand-template-empty" style={{ padding: 16 }}>템플릿 구조를 불러오는 중입니다.</div>
                    ) : previewTemplateModel ? (
                      <div className="campaign-brand-template-preview-wrap">
                        <BrandTemplatePreview model={previewTemplateModel} compact />
                      </div>
                    ) : (
                      <div className="brand-template-empty" style={{ padding: 16 }}>템플릿을 선택하면 실제 구조 미리보기가 표시됩니다.</div>
                    )
                  ) : (
                    <div className="kakao-preview-phone">
                      <div className="kakao-preview-time">오늘 오후 2:30</div>
                      <div className="kakao-preview-row">
                        <div className="kakao-preview-avatar">B</div>
                        <div className="kakao-preview-content">
                          <div className="kakao-preview-sender">{selectedSenderProfile?.plusFriendId || "발신 프로필 미선택"}</div>
                          <div className="kakao-preview-bubble">
                            {isImageMessage && imageUrl ? (
                              <div className="brand-preview-image-wrap">
                                <img src={imageUrl} alt={uploadedImageName || "업로드 이미지"} className="brand-preview-image" />
                              </div>
                            ) : null}
                            <div className="kakao-preview-text">{previewBody}</div>
                            {previewButtonCount > 0 ? (
                              <div className="kakao-preview-buttons">
                                {buttons.filter((item) => item.name.trim()).map((item) => (
                                  <div className="kakao-preview-button" key={item.id}>
                                    {item.name}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="box">
                <div className="box-header">
                  <div className="box-title">현재 설정</div>
                </div>
                <div className="box-section-loose">
                  <div className="brand-feature-list">
                    <span className="brand-feature-pill">대상 {formatCount(selectedContactableUsers.length)}명</span>
                    <span className="brand-feature-pill">{isTemplateMode ? "TEMPLATE" : messageType}</span>
                    {isTemplateMode && selectedTemplate?.chatBubbleType ? (
                      <span className="brand-feature-pill">{selectedTemplate.chatBubbleType}</span>
                    ) : null}
                    <span className="brand-feature-pill">{pushAlarm ? "푸시 알람" : "푸시 없음"}</span>
                    <span className="brand-feature-pill">{adult ? "성인용" : "일반용"}</span>
                  </div>
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
          <div className="box">
            <div className="box-header">
              <div className="box-title">검토 및 발송</div>
            </div>
            <div className="box-body">
              <div className="brand-form-grid">
                <div>
                  <div className="box-title" style={{ fontSize: 14, marginBottom: 12 }}>발송 설정</div>
                  <div className="box-section-tight" style={{ padding: 0 }}>
                    <div className="box-row"><div className="box-row-content"><div className="table-kind-text">캠페인명</div><div className="table-title-text">{title.trim() || "제목 없음"}</div></div></div>
                    <div className="box-row"><div className="box-row-content"><div className="table-kind-text">발신 프로필</div><div className="text-mono">{selectedSenderProfile?.plusFriendId || "—"}</div></div></div>
                    <div className="box-row"><div className="box-row-content"><div className="table-kind-text">발송 방식</div><div className="table-title-text">{isTemplateMode ? "템플릿형" : "자유형"}</div></div></div>
                    <div className="box-row"><div className="box-row-content"><div className="table-kind-text">메시지 타입</div><div className="table-title-text">{isTemplateMode ? selectedTemplate?.chatBubbleType || "—" : messageType}</div></div></div>
                    {isTemplateMode ? (
                      <div className="box-row"><div className="box-row-content"><div className="table-kind-text">템플릿</div><div className="table-title-text">{selectedTemplate?.templateName || "미선택"}</div></div></div>
                    ) : null}
                    {isTemplateMode && selectedTemplate?.templateCode ? (
                      <div className="box-row"><div className="box-row-content"><div className="table-kind-text">템플릿 코드</div><div className="text-mono">{selectedTemplate.templateCode}</div></div></div>
                    ) : null}
                    <div className="box-row"><div className="box-row-content"><div className="table-kind-text">대상 수</div><div className="table-title-text">{formatCount(selectedContactableUsers.length)}명</div></div></div>
                    <div className="box-row"><div className="box-row-content"><div className="table-kind-text">발송 시간</div><div className="table-title-text">{scheduleType === "later" && scheduledAt ? formatDateTimeText(new Date(scheduledAt).toISOString()) : "즉시 발송"}</div></div></div>
                    <div className="box-row" style={{ borderBottom: "none" }}><div className="box-row-content"><div className="table-kind-text">메시지</div><div className="box-row-desc" style={{ fontSize: 12, lineHeight: 1.5 }}>{previewBody}</div></div></div>
                  </div>
                </div>

                <div>
                  <div className="box-title" style={{ fontSize: 14, marginBottom: 12 }}>체크포인트</div>
                  <div className="campaign-template-note">
                    <ul className="brand-next-list">
                      <li>채널 친구(I 타겟팅) 대상으로만 발송됩니다.</li>
                      <li>중복 번호와 전화번호 없는 수신자는 자동 제외됩니다.</li>
                      {!isTemplateMode && isImageMessage ? <li>이미지 메시지는 업로드된 발송용 이미지 URL 기준으로 전송됩니다.</li> : null}
                    {isTemplateMode && templateVariables.length > 0 ? (
                        <li>템플릿 변수 매핑 {variableRows.filter((row) => row.fieldKey).length} / {variableRows.length}개가 적용됩니다.</li>
                      ) : null}
                    </ul>
                    {isTemplateMode && variableRows.length > 0 ? (
                      <div className="campaign-template-variable-list">
                        {variableRows.map((row) => (
                          <div className="campaign-template-variable-row" key={row.variable}>
                            <div className="campaign-template-variable-token">#{`{${row.variable}}`}</div>
                            <div className="campaign-template-variable-field">{recipientFields.find((field) => field.key === row.fieldKey)?.label || "미매핑"}</div>
                            <div className="campaign-template-variable-sample">{row.sampleValue || "샘플 값 없음"}</div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {scheduleRestrictionMessage ? (
                      <div className="form-field-error" style={{ marginTop: 10 }}>
                        {scheduleRestrictionMessage}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="campaign-action-bar">
            <button className="btn btn-default" onClick={() => setStep(3)}>이전</button>
            <button className="btn btn-kakao" onClick={handleSubmit} disabled={submitting || Boolean(scheduleRestrictionMessage)}>
              <AppIcon name="send" className="icon icon-14" />
              {submitting ? "접수 중..." : "브랜드 대량 발송 접수"}
            </button>
          </div>
        </>
      ) : null}
    </>
  );
}

function formatCount(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatDateTimeText(value: string) {
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

function recipientStatusText(status: string) {
  if (status === "ACTIVE") return "활성";
  if (status === "INACTIVE") return "비활성";
  if (status === "DORMANT") return "휴면";
  if (status === "BLOCKED") return "차단";
  return status;
}

function recipientStatusClass(status: string) {
  if (status === "ACTIVE") return "label-green";
  if (status === "INACTIVE") return "label-gray";
  if (status === "DORMANT") return "label-yellow";
  if (status === "BLOCKED") return "label-red";
  return "label-gray";
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
