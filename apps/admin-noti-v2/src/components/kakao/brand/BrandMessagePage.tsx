"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import { FormSelect } from "@/components/ui/FormSelect";
import {
  createV2BrandMessageRequest,
  fetchV2BrandMessageOptions,
  fetchV2BrandMessageReadiness,
  fetchV2BrandTemplates,
  uploadV2BrandMessageImage,
  type V2BrandTemplatesResponse,
  type V2BrandMessageOptionsResponse,
  type V2BrandMessageReadinessResponse,
} from "@/lib/api/v2";
import {
  getBrandMessageNightWindowText,
  isBrandMessageImmediateRestricted,
  isBrandMessageScheduleRestricted,
} from "@/lib/brand-message-night-window";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";
import { useRouteNavigate } from "@/lib/hooks/use-route-navigate";
import { useAppStore } from "@/lib/store/app-store";

const brandMessagePageCache: {
  readiness: V2BrandMessageReadinessResponse | null;
  options: V2BrandMessageOptionsResponse | null;
  templates: V2BrandTemplatesResponse["items"] | null;
} = {
  readiness: null,
  options: null,
  templates: null,
};

type BrandButtonDraft = {
  id: string;
  type: "WL" | "AL" | "BK" | "MD";
  name: string;
  linkMo: string;
  linkPc: string;
  schemeIos: string;
  schemeAndroid: string;
};

function renderPreviewText(text: string, variables: Record<string, string>) {
  return text.split(/(#[{][^}]+[}])/g).map((part, index) => {
    const match = part.match(/^#\{(.+)\}$/);
    if (!match) return <span key={`${part}-${index}`}>{part}</span>;
    const value = variables[match[1]];
    return value ? (
      <span key={`${part}-${index}`}>{value}</span>
    ) : (
      <span key={`${part}-${index}`} className="preview-rich-inline-token">
        {part}
      </span>
    );
  });
}

function extractTemplateVariables(requiredVariables: unknown, ...bodyCandidates: Array<string | null | undefined>) {
  if (Array.isArray(requiredVariables)) {
    return requiredVariables.map((item) => String(item)).filter(Boolean);
  }

  const matches = bodyCandidates.flatMap((body) =>
    body ? Array.from(body.matchAll(/#\{([^}]+)\}/g)).map((match) => match[1]) : []
  );
  return Array.from(new Set(matches.filter(Boolean)));
}

function buildTemplateVariables(
  requiredVariables: unknown,
  currentVariables: Record<string, string>,
  ...bodyCandidates: Array<string | null | undefined>
) {
  return Object.fromEntries(
    extractTemplateVariables(requiredVariables, ...bodyCandidates).map((name) => [name, currentVariables[name] || ""])
  );
}

function normalizeImageLinkInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed.replace(/^\/+/, "")}`;
}

export function BrandMessagePage({
  initialData,
  embedded = false,
}: {
  initialData?: {
    readiness: V2BrandMessageReadinessResponse | null;
    options: V2BrandMessageOptionsResponse | null;
  };
  embedded?: boolean;
}) {
  const navigate = useRouteNavigate();
  const showDraftToast = useAppStore((state) => state.showDraftToast);
  const [readiness, setReadiness] = useState<V2BrandMessageReadinessResponse | null>(
    () => initialData?.readiness ?? brandMessagePageCache.readiness
  );
  const [options, setOptions] = useState<V2BrandMessageOptionsResponse | null>(
    () => initialData?.options ?? brandMessagePageCache.options
  );
  const [templates, setTemplates] = useState<V2BrandTemplatesResponse["items"] | null>(() => brandMessagePageCache.templates);
  const [loading, setLoading] = useState(() => !(initialData?.readiness ?? brandMessagePageCache.readiness));
  const [error, setError] = useState<string | null>(null);
  const [selectedSenderProfileId, setSelectedSenderProfileId] = useState("");
  const [selectedMode, setSelectedMode] = useState<"FREESTYLE" | "TEMPLATE">("FREESTYLE");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [messageType, setMessageType] = useState<"TEXT" | "IMAGE" | "WIDE">("TEXT");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [content, setContent] = useState("");
  const [pushAlarm, setPushAlarm] = useState(true);
  const [adult, setAdult] = useState(false);
  const [scheduleType, setScheduleType] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageLink, setImageLink] = useState("");
  const [uploadedImageName, setUploadedImageName] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [buttons, setButtons] = useState<BrandButtonDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  useMountEffect(() => {
    if (initialData?.readiness) {
      brandMessagePageCache.readiness = initialData.readiness;
      brandMessagePageCache.options = initialData.options ?? null;
      setReadiness(initialData.readiness);
      setOptions(initialData.options ?? null);
      setTemplates(brandMessagePageCache.templates);
      setSelectedSenderProfileId((current) => current || initialData.options?.senderProfiles[0]?.id || "");
      setSelectedMode((current) => current || initialData.options?.supportedModes[0] || "FREESTYLE");
      if (brandMessagePageCache.templates) {
        setLoading(false);
        return;
      }
    }

    let cancelled = false;
    const hasCachedData = Boolean(brandMessagePageCache.readiness);

    const load = async () => {
      if (!hasCachedData) {
        setLoading(true);
      }
      setError(null);

      try {
        const nextReadiness = await fetchV2BrandMessageReadiness();
        if (cancelled) return;

        brandMessagePageCache.readiness = nextReadiness;
        setReadiness(nextReadiness);

        if (!nextReadiness.ready) {
          brandMessagePageCache.options = null;
          setOptions(null);
          return;
        }

        const nextOptions = await fetchV2BrandMessageOptions();
        if (cancelled) return;

        const nextTemplates = await fetchV2BrandTemplates();
        if (cancelled) return;

        brandMessagePageCache.options = nextOptions;
        brandMessagePageCache.templates = nextTemplates.items;
        setOptions(nextOptions);
        setTemplates(nextTemplates.items);
        setSelectedSenderProfileId((current) => current || nextOptions.senderProfiles[0]?.id || "");
        setSelectedMode((current) => current || nextOptions.supportedModes[0] || "FREESTYLE");
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "브랜드 메시지 발송 정보를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  });

  const selectedSenderProfile =
    options?.senderProfiles.find((item) => item.id === selectedSenderProfileId) ??
    options?.senderProfiles[0] ??
    null;
  const availableTemplates = useMemo(() => {
    if (!selectedSenderProfile) {
      return [];
    }
    return (templates ?? []).filter((item) => item.senderProfileId === selectedSenderProfile.id);
  }, [selectedSenderProfile, templates]);
  const selectedTemplate = availableTemplates.find((item) => item.id === selectedTemplateId) ?? availableTemplates[0] ?? null;
  const templateVariableNames = useMemo(
    () =>
      selectedTemplate
        ? extractTemplateVariables(
            selectedTemplate.requiredVariables,
            selectedTemplate.content,
            selectedTemplate.header,
            selectedTemplate.additionalContent
          )
        : [],
    [selectedTemplate]
  );
  const previewButtonCount = buttons.filter((item) => item.name.trim()).length;
  const previewText = content.trim() || "브랜드 메시지 본문을 입력하면 여기에서 미리볼 수 있습니다.";
  const previewTemplateText = selectedTemplate?.content?.trim() || selectedTemplate?.additionalContent?.trim() || "";
  const previewTemplateNodes = useMemo(() => {
    if (!selectedTemplate || !previewTemplateText) {
      return null;
    }
    return renderPreviewText(previewTemplateText, templateVariables);
  }, [selectedTemplate, previewTemplateText, templateVariables]);
  const showLoadingOptions = Boolean(loading && readiness?.ready && !options);
  const isTemplateMode = selectedMode === "TEMPLATE";
  const isImageMessage = !isTemplateMode && messageType !== "TEXT";
  const nightSendWindow = options?.constraints.nightSendWindow ?? { start: "20:50", end: "08:00" };
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

  useEffect(() => {
    if (immediateRestricted && scheduleType === "now") {
      setScheduleType("later");
    }
  }, [immediateRestricted, scheduleType]);

  useEffect(() => {
    if (!selectedTemplate) {
      if (selectedTemplateId) {
        setSelectedTemplateId("");
      }
      setTemplateVariables((current) => (Object.keys(current).length > 0 ? {} : current));
      return;
    }

    if (selectedTemplateId !== selectedTemplate.id) {
      setSelectedTemplateId(selectedTemplate.id);
    }

    setTemplateVariables((current) =>
      buildTemplateVariables(
        selectedTemplate.requiredVariables,
        current,
        selectedTemplate.content,
        selectedTemplate.header,
        selectedTemplate.additionalContent
      )
    );
  }, [selectedTemplate, selectedTemplateId]);

  const addButton = () => {
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
  };

  const updateButton = (buttonId: string, patch: Partial<BrandButtonDraft>) => {
    setButtons((current) => current.map((item) => (item.id === buttonId ? { ...item, ...patch } : item)));
  };

  const removeButton = (buttonId: string) => {
    setButtons((current) => current.filter((item) => item.id !== buttonId));
  };

  const handleSenderProfileChange = (senderProfileId: string) => {
    setSelectedSenderProfileId(senderProfileId);

    const nextTemplates = (templates ?? []).filter((item) => item.senderProfileId === senderProfileId);
    const nextTemplate = nextTemplates[0] ?? null;
    setSelectedTemplateId(nextTemplate?.id ?? "");
    setTemplateVariables(
      nextTemplate
        ? buildTemplateVariables(
            nextTemplate.requiredVariables,
            {},
            nextTemplate.content,
            nextTemplate.header,
            nextTemplate.additionalContent
          )
        : {}
    );
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const nextTemplate = availableTemplates.find((item) => item.id === templateId) ?? null;
    setTemplateVariables(
      nextTemplate
        ? buildTemplateVariables(
            nextTemplate.requiredVariables,
            templateVariables,
            nextTemplate.content,
            nextTemplate.header,
            nextTemplate.additionalContent
          )
        : {}
    );
  };

  const updateTemplateVariable = (name: string, value: string) => {
    setTemplateVariables((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !isImageMessage) {
      return;
    }

    setImageUploading(true);
    setError(null);
    setImageError(null);

    try {
      const uploaded = await uploadV2BrandMessageImage(file, messageType);
      setImageUrl(uploaded.imageUrl);
      setUploadedImageName(uploaded.imageName || file.name);
      setImageError(null);
      showDraftToast("이미지를 업로드했습니다.", { tone: "success" });
    } catch (uploadError) {
      setImageError(uploadError instanceof Error ? uploadError.message : "브랜드 메시지 이미지 업로드에 실패했습니다.");
    } finally {
      setImageUploading(false);
    }
  };

  const handleClearImage = () => {
    setImageUrl("");
    setUploadedImageName("");
    setImageLink("");
    setImageError(null);
  };

  const normalizeImageLinkState = () => {
    setImageLink((current) => normalizeImageLinkInput(current));
  };

  const handleSubmit = async () => {
    if (!selectedSenderProfile) {
      showDraftToast("발신 프로필을 선택해 주세요.", { tone: "error" });
      return;
    }

    if (!recipientPhone.trim()) {
      showDraftToast("수신번호를 입력해 주세요.", { tone: "error" });
      return;
    }

    if (isTemplateMode && !selectedTemplate) {
      showDraftToast("브랜드 템플릿을 선택해 주세요.", { tone: "error" });
      return;
    }

    if (!isTemplateMode && !content.trim()) {
      showDraftToast("브랜드 메시지 본문을 입력해 주세요.", { tone: "error" });
      return;
    }

    if (!isTemplateMode && messageType === "IMAGE" && content.trim().length > 400) {
      showDraftToast("이미지 메시지 본문은 최대 400자까지 입력할 수 있습니다.", { tone: "error" });
      return;
    }

    if (isImageMessage && !imageUrl.trim()) {
      setImageError("이미지를 먼저 업로드해 주세요.");
      return;
    }

    if (scheduleType === "later" && !scheduledAt) {
      showDraftToast("예약 발송 시각을 선택해 주세요.", { tone: "error" });
      return;
    }

    if (scheduleType === "now" && immediateRestricted) {
      showDraftToast(getBrandMessageNightWindowText(nightSendWindow), { tone: "error" });
      return;
    }

    if (scheduleType === "later" && scheduledRestricted) {
      showDraftToast(getBrandMessageNightWindowText(nightSendWindow), { tone: "error" });
      return;
    }

    const normalizedImageLink = normalizeImageLinkInput(imageLink);
    if (normalizedImageLink !== imageLink) {
      setImageLink(normalizedImageLink);
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await createV2BrandMessageRequest({
        senderProfileId: selectedSenderProfile.id,
        mode: selectedMode,
        targeting: "I",
        messageType: isTemplateMode
          ? ((selectedTemplate?.chatBubbleType as
              | "TEXT"
              | "IMAGE"
              | "WIDE"
              | "WIDE_ITEM_LIST"
              | "CAROUSEL_FEED"
              | "PREMIUM_VIDEO"
              | "COMMERCE"
              | "CAROUSEL_COMMERCE") ?? undefined)
          : messageType,
        recipientPhone: recipientPhone.trim(),
        templateCode: isTemplateMode ? selectedTemplate?.templateCode ?? undefined : undefined,
        templateName: isTemplateMode ? selectedTemplate?.templateName : undefined,
        templateBody: isTemplateMode ? selectedTemplate?.content ?? undefined : undefined,
        requiredVariables: isTemplateMode ? templateVariableNames : undefined,
        variables: isTemplateMode ? templateVariables : undefined,
        content: isTemplateMode ? undefined : content.trim(),
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
        scheduledAt: scheduleType === "later" ? new Date(scheduledAt).toISOString() : undefined,
      });

      showDraftToast(`브랜드 메시지 요청이 접수되었습니다. (${response.requestId.slice(0, 8)})`, {
        tone: "success",
      });
      navigate("logs");
    } catch (submitError) {
      showDraftToast(
        submitError instanceof Error ? submitError.message : "브랜드 메시지 요청 접수에 실패했습니다.",
        { tone: "error" },
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderHeader = () =>
    embedded ? null : (
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <div className="page-title">브랜드 메시지</div>
            <div className="page-desc">채널 친구를 대상으로 자유형 또는 템플릿형 브랜드 메시지를 발송합니다</div>
          </div>
        </div>
      </div>
    );

  if (error && !readiness) {
    return (
      <>
        {renderHeader()}
        <div className="flash flash-attention">
          <AppIcon name="warn" className="icon icon-16 flash-icon" />
          <div className="flash-body">{error}</div>
        </div>
      </>
    );
  }

  if (loading && !readiness) {
    return (
      <>
        {renderHeader()}
        <div className="box">
          <div className="box-body">
            <div className="text-small text-muted">브랜드 메시지 사용 가능 여부와 발신 프로필을 확인하는 중입니다.</div>
          </div>
        </div>
      </>
    );
  }

  if (readiness && !readiness.ready) {
    return (
      <>
        {renderHeader()}
        <div className="flash flash-attention">
          <AppIcon name="warn" className="icon icon-16 flash-icon" />
          <div className="flash-body">{readiness.blockers[0]?.message || "브랜드 메시지 발송 준비가 완료되지 않았습니다."}</div>
        </div>
          <div className="box">
          <div className="empty-state">
            <div className="empty-icon" style={{ color: "#c9a700" }}>
              <AppIcon name="brand" className="icon icon-40" />
            </div>
            <div className="empty-title">먼저 카카오 채널을 연결해 주세요</div>
            <div className="empty-desc">
              브랜드 메시지는 연결된 채널이 있어야 시작할 수 있습니다. 1차에서는 채널 친구 대상(I 타겟팅)만 지원합니다.
            </div>
            <div className="empty-actions">
              <button className="btn btn-kakao" onClick={() => navigate("resources")}>
                발신 자원 관리
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {renderHeader()}

      {showLoadingOptions ? (
        <div className="text-small text-muted" style={{ marginBottom: 12 }}>
          브랜드 메시지 옵션을 불러오는 중입니다.
        </div>
      ) : null}

      <div className="brand-layout">
          <div>
            <div className="box">
              <div className="box-header">
                <div>
                  <div className="box-title">발송 설정</div>
                  <div className="box-subtitle">자유형과 템플릿형 중 하나를 선택하고, 채널 친구(I) 대상으로 발송합니다.</div>
                </div>
              </div>
              <div className="box-body">
                <div className="brand-form-grid">
                  <div className="form-group">
                    <label className="form-label">발송 방식 <span className="text-danger">*</span></label>
                    <FormSelect className="form-control" value={selectedMode} onChange={(event) => setSelectedMode(event.target.value as "FREESTYLE" | "TEMPLATE")}>
                      {(options?.supportedModes ?? ["FREESTYLE"]).map((item) => (
                        <option key={item} value={item}>
                          {item === "TEMPLATE" ? "템플릿형" : "자유형"}
                        </option>
                      ))}
                    </FormSelect>
                    <p className="form-hint">
                      {selectedMode === "TEMPLATE"
                        ? "등록된 브랜드 템플릿을 선택해 발송합니다."
                        : "본문, 이미지, 버튼을 직접 입력해 자유형으로 발송합니다."}
                    </p>
                  </div>
                  <div className="form-group">
                    <label className="form-label">발신 프로필 <span className="text-danger">*</span></label>
                    <FormSelect
                      className="form-control"
                      value={selectedSenderProfile?.id ?? ""}
                      onChange={(event) => handleSenderProfileChange(event.target.value)}
                    >
                      <option value="">발신 프로필을 선택하세요</option>
                      {(options?.senderProfiles ?? []).map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.plusFriendId} ({item.senderProfileType || "채널"})
                        </option>
                      ))}
                    </FormSelect>
                  </div>
                  {!isTemplateMode ? (
                    <div className="form-group">
                      <label className="form-label">메시지 타입</label>
                      <FormSelect
                        className="form-control"
                        value={messageType}
                      onChange={(event) => {
                        setMessageType(event.target.value as "TEXT" | "IMAGE" | "WIDE");
                        setImageError(null);
                      }}
                    >
                      {(options?.supportedMessageTypes ?? ["TEXT", "IMAGE", "WIDE"]).map((item) => (
                        <option key={item} value={item}>
                          {item === "TEXT" ? "텍스트" : item === "IMAGE" ? "이미지" : "와이드 이미지"}
                        </option>
                        ))}
                      </FormSelect>
                    </div>
                  ) : (
                    <div className="form-group">
                      <label className="form-label">템플릿 유형</label>
                      <input
                        className="form-control"
                        value={selectedTemplate?.chatBubbleType || "템플릿을 선택하면 표시됩니다"}
                        readOnly
                      />
                    </div>
                  )}
                </div>

                <div className="brand-toggle-row">
                  <label className="campaign-checkbox-row">
                    <input type="checkbox" checked={pushAlarm} onChange={(event) => setPushAlarm(event.target.checked)} />
                    푸시 알람 활성화
                  </label>
                  <label className="campaign-checkbox-row">
                    <input type="checkbox" checked={adult} onChange={(event) => setAdult(event.target.checked)} />
                    성인용 메시지
                  </label>
                </div>
              </div>
            </div>

            <div className="box">
              <div className="box-header">
                <div className="box-title">{isTemplateMode ? "템플릿 선택" : "메시지 작성"}</div>
              </div>
              <div className="box-body">
                {isTemplateMode ? (
                  <>
                    <div className="form-group">
                      <label className="form-label">브랜드 템플릿 <span className="text-danger">*</span></label>
                      <FormSelect
                        className="form-control"
                        value={selectedTemplate?.id ?? ""}
                        onChange={(event) => handleTemplateChange(event.target.value)}
                        disabled={!selectedSenderProfile || availableTemplates.length === 0}
                      >
                        <option value="">템플릿을 선택하세요</option>
                        {availableTemplates.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.templateName} · {item.chatBubbleType || "유형 미확인"}
                          </option>
                        ))}
                      </FormSelect>
                      <p className="form-hint">
                        선택한 발신 프로필에 연결된 브랜드 템플릿만 표시합니다.{" "}
                        <button
                          type="button"
                          style={{ background: "none", border: "none", color: "var(--accent-fg)", cursor: "pointer", fontFamily: "inherit", fontSize: 12, padding: 0 }}
                          onClick={() => navigate("templates")}
                        >
                          템플릿 관리 →
                        </button>
                      </p>
                      {selectedSenderProfile && availableTemplates.length === 0 ? (
                        <p className="form-hint" style={{ color: "var(--attention-fg)" }}>
                          이 발신 프로필에서 사용할 수 있는 브랜드 템플릿이 없습니다.
                        </p>
                      ) : null}
                    </div>
                    {selectedTemplate ? (
                      <div className="box" style={{ marginBottom: 0 }}>
                        <div className="box-header">
                          <div className="box-title">템플릿 변수</div>
                          <span className="text-small text-muted">템플릿 안의 #{"{변수}"}를 실제 값으로 치환합니다.</span>
                        </div>
                        <div className="box-body">
                          {templateVariableNames.length > 0 ? (
                            templateVariableNames.map((variable) => (
                              <div className="form-group" style={{ marginBottom: 12 }} key={variable}>
                                <label className="form-label status-label-sm">#{"{"}{variable}{"}"}</label>
                                <input
                                  className="form-control"
                                  placeholder={`${variable} 값을 입력하세요`}
                                  value={templateVariables[variable] || ""}
                                  onChange={(event) => updateTemplateVariable(variable, event.target.value)}
                                />
                              </div>
                            ))
                          ) : (
                            <div className="text-small text-muted">이 템플릿은 별도 변수 입력 없이 바로 발송할 수 있습니다.</div>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <div className="form-group">
                      <label className="form-label">내용 <span className="text-danger">*</span></label>
                      <textarea
                        className="form-control"
                        rows={8}
                        maxLength={messageType === "TEXT" ? 1300 : messageType === "IMAGE" ? 400 : 76}
                        value={content}
                        onChange={(event) => setContent(event.target.value)}
                        placeholder="브랜드 메시지 본문을 입력하세요"
                      />
                      <div className="text-small text-muted" style={{ marginTop: 6, textAlign: "right" }}>
                        {content.length} / {messageType === "TEXT" ? 1300 : messageType === "IMAGE" ? 400 : 76}
                      </div>
                    </div>

                    {isImageMessage ? (
                  <div className="brand-form-grid">
                    <div className="form-group">
                      <label className="form-label">이미지 업로드 <span className="text-danger">*</span></label>
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
                      <div className="box-subtitle">1차에서는 웹 링크 버튼 중심으로 먼저 엽니다</div>
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

            <div className="box">
              <div className="box-header">
                <div className="box-title">수신자 및 발송 시간</div>
              </div>
              <div className="box-body">
                <div className="brand-form-grid">
                  <div className="form-group">
                    <label className="form-label">수신번호 <span className="text-danger">*</span></label>
                    <input
                      className="form-control"
                      value={recipientPhone}
                      onChange={(event) => setRecipientPhone(event.target.value)}
                      placeholder="010-0000-0000"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">타겟팅 유형</label>
                    <FormSelect className="form-control" value="I" disabled>
                      <option value="I">I - 채널 친구 대상</option>
                    </FormSelect>
                  </div>
                </div>

                <div className="sms-schedule-options" style={{ marginBottom: scheduleType === "later" ? 12 : 0 }}>
                  <label className="sms-schedule-option">
                    <input
                      type="radio"
                      name="brandSchedule"
                      checked={scheduleType === "now"}
                      onChange={() => setScheduleType("now")}
                      disabled={immediateRestricted}
                    />
                    즉시 발송
                  </label>
                  <label className="sms-schedule-option">
                    <input type="radio" name="brandSchedule" checked={scheduleType === "later"} onChange={() => setScheduleType("later")} />
                    예약 발송
                  </label>
                </div>

                {scheduleType === "later" ? (
                  <input
                    type="datetime-local"
                    className="form-control field-width-md"
                    value={scheduledAt}
                    onChange={(event) => setScheduledAt(event.target.value)}
                  />
                ) : null}
                <p className={`form-hint${scheduleRestrictionMessage ? " form-field-error" : ""}`}>
                  {scheduleRestrictionMessage ?? getBrandMessageNightWindowText(nightSendWindow)}
                </p>
              </div>
            </div>

            <div className="sms-action-bar">
              <button className="btn btn-default" onClick={() => navigate("logs")}>
                발송 이력 보기
              </button>
              <button className="btn btn-kakao" onClick={handleSubmit} disabled={submitting || Boolean(scheduleRestrictionMessage)}>
                <AppIcon name="send" className="icon icon-14" />
                {submitting ? "접수 중..." : "브랜드 메시지 접수"}
              </button>
            </div>
          </div>

          <div className="kakao-side-column">
            <div className="box" style={{ marginBottom: 12 }}>
              <div className="box-header">
                <div className="box-title">미리보기</div>
                <span className="chip chip-kakao">브랜드 메시지</span>
              </div>
              <div className="box-body-tight">
                <div className="kakao-preview-phone">
                  <div className="kakao-preview-time">오늘 오후 2:30</div>
                  <div className="kakao-preview-row">
                    <div className="kakao-preview-avatar">B</div>
                    <div className="kakao-preview-content">
                      <div className="kakao-preview-sender">{selectedSenderProfile?.plusFriendId || "발신 프로필 미선택"}</div>
                      <div className="kakao-preview-bubble">
                        {!isTemplateMode && isImageMessage && imageUrl ? (
                          <div className="brand-preview-image-wrap">
                            <img src={imageUrl} alt={uploadedImageName || "업로드 이미지"} className="brand-preview-image" />
                          </div>
                        ) : null}
                        {isTemplateMode ? (
                          <>
                            <div className="kakao-preview-text" style={{ fontWeight: 600, marginBottom: previewTemplateNodes ? 8 : 0 }}>
                              {selectedTemplate?.templateName || "템플릿 미선택"}
                            </div>
                            {previewTemplateNodes ? <div className="kakao-preview-text">{previewTemplateNodes}</div> : null}
                          </>
                        ) : (
                          <div className="kakao-preview-text">{previewText}</div>
                        )}
                        {!isTemplateMode && previewButtonCount > 0 ? (
                          <div className="kakao-preview-buttons">
                            {buttons
                              .filter((item) => item.name.trim())
                              .map((item) => (
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
              </div>
            </div>
          </div>
        </div>
    </>
  );
}
