"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type SyntheticEvent as ReactSyntheticEvent,
  type UIEvent as ReactUIEvent,
} from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import { KakaoTemplateImageEditorModal } from "@/components/templates/KakaoTemplateImageEditorModal";
import { FormSelect } from "@/components/ui/FormSelect";
import {
  createV2KakaoTemplate,
  saveV2KakaoTemplateDraft,
  updateV2KakaoTemplate,
  uploadV2KakaoTemplateImage,
  type V2CreateKakaoTemplatePayload,
  type V2CreateKakaoTemplateResponse,
  type V2KakaoTemplateDetailResponse,
  type V2KakaoTemplateDraftItem,
  type V2SaveKakaoTemplateDraftPayload,
  type V2SaveKakaoTemplateDraftResponse,
  type V2KakaoTemplateCategoryGroup,
  type V2KakaoTemplateRegistrationTarget,
  type V2PublEventItem,
  type V2PublEventProp,
  type V2UpdateKakaoTemplateResponse,
} from "@/lib/api/v2";

type KakaoTemplateAction = {
  type: string;
  name: string;
  linkMo: string;
  linkPc: string;
  schemeIos: string;
  schemeAndroid: string;
  bizFormId: string;
  pluginId: string;
  telNumber: string;
};

type KakaoTemplateLinkField = "linkMo" | "linkPc" | "schemeIos" | "schemeAndroid";
type KakaoTemplateMessageType = "AD" | "BA" | "EX" | "MI";
type KakaoTemplateEmphasizeType = "NONE" | "TEXT" | "IMAGE";

type TemplateVariableTarget =
  | { kind: "body"; start: number; end: number }
  | { kind: "button" | "quickReply"; index: number; field: KakaoTemplateLinkField; start: number; end: number };

type TooltipState = {
  text: string;
  top: number;
  left: number;
  dir: "up" | "down";
} | null;

type PendingImageEditorState = {
  sourceUrl: string;
  fileName: string;
};

type EventTemplateVariable = {
  key: string;
  label: string;
  rawPath: string;
  sample: string | null;
  required: boolean;
  type: string;
};

function normalizeTooltipText(text: string) {
  return text.replace(/\/n/g, "\n").replace(/\\n/g, "\n");
}

type KakaoTemplateCreateModalProps = {
  open: boolean;
  registrationTargets: V2KakaoTemplateRegistrationTarget[];
  categories: V2KakaoTemplateCategoryGroup[];
  mode?: "create" | "edit";
  initialTemplate?: V2KakaoTemplateDetailResponse["template"] | null;
  initialDraft?: V2KakaoTemplateDraftItem | null;
  sourceEvent?: V2PublEventItem | null;
  onClose: () => void;
  onCreated: (response: V2CreateKakaoTemplateResponse) => void;
  onUpdated?: (response: V2UpdateKakaoTemplateResponse) => void;
  onDraftSaved?: (response: V2SaveKakaoTemplateDraftResponse) => void;
};

const BUTTON_TYPES = [
  { value: "DS", label: "배송 조회" },
  { value: "WL", label: "웹 링크" },
  { value: "AL", label: "앱 링크" },
  { value: "BK", label: "봇 키워드" },
  { value: "MD", label: "메시지 전달" },
  { value: "BC", label: "상담톡 전환" },
  { value: "BT", label: "봇 전환" },
  { value: "AC", label: "채널 추가" },
  { value: "TN", label: "전화하기" },
  { value: "BF", label: "비즈니스폼" },
];

const QUICK_REPLY_TYPES = [
  { value: "WL", label: "웹 링크" },
  { value: "AL", label: "앱 링크" },
  { value: "BK", label: "봇 키워드" },
  { value: "BC", label: "상담톡 전환" },
  { value: "BT", label: "봇 전환" },
  { value: "BF", label: "비즈니스폼" },
];

const EMPTY_ACTION = (): KakaoTemplateAction => ({
  type: "",
  name: "",
  linkMo: "",
  linkPc: "",
  schemeIos: "",
  schemeAndroid: "",
  bizFormId: "",
  pluginId: "",
  telNumber: "",
});

function isWebUrlTemplate(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

const MESSAGE_TYPE_LABELS: Record<KakaoTemplateMessageType, string> = {
  AD: "채널 추가형",
  BA: "기본형",
  EX: "부가 정보형",
  MI: "복합형",
};

export function KakaoTemplateCreateModal({
  open,
  registrationTargets,
  categories,
  mode = "create",
  initialTemplate = null,
  initialDraft = null,
  sourceEvent = null,
  onClose,
  onCreated,
  onUpdated,
  onDraftSaved,
}: KakaoTemplateCreateModalProps) {
  const imageInputId = useId();
  const bodyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const bodyTokenLayerRef = useRef<HTMLDivElement | null>(null);
  const bodyHoveredTokenRef = useRef<string | null>(null);
  const initialForm = buildInitialKakaoTemplateDraft(registrationTargets, categories, sourceEvent, initialTemplate, initialDraft, mode);
  const bodySelectionRef = useRef({ start: initialForm.body.length, end: initialForm.body.length });
  const variableInsertTargetRef = useRef<TemplateVariableTarget>({ kind: "body", start: initialForm.body.length, end: initialForm.body.length });
  const actionVariableInputRefs = useRef(new Map<string, HTMLInputElement>());
  const [draftTemplateId, setDraftTemplateId] = useState(() => initialForm.draftTemplateId);
  const [targetId, setTargetId] = useState(() => initialForm.targetId);
  const [templateCode, setTemplateCode] = useState(() => initialForm.templateCode);
  const [name, setName] = useState(() => initialForm.name);
  const [messageType, setMessageType] = useState<KakaoTemplateMessageType>(() => initialForm.messageType);
  const [emphasizeType, setEmphasizeType] = useState<KakaoTemplateEmphasizeType>(() => initialForm.emphasizeType);
  const [title, setTitle] = useState(() => initialForm.title);
  const [subtitle, setSubtitle] = useState(() => initialForm.subtitle);
  const [body, setBody] = useState(() => initialForm.body);
  const [extra, setExtra] = useState(() => initialForm.extra);
  const [securityFlag, setSecurityFlag] = useState(() => initialForm.securityFlag);
  const [categoryGroupName, setCategoryGroupName] = useState(() => initialForm.categoryGroupName);
  const [categoryCode, setCategoryCode] = useState(() => initialForm.categoryCode);
  const [buttons, setButtons] = useState<KakaoTemplateAction[]>(() => initialForm.buttons);
  const [quickReplies, setQuickReplies] = useState<KakaoTemplateAction[]>(() => initialForm.quickReplies);
  const [comment, setComment] = useState(() => initialForm.comment);
  const [imageName, setImageName] = useState(() => initialForm.imageName);
  const [imageUrl, setImageUrl] = useState(() => initialForm.imageUrl);
  const [imageEditor, setImageEditor] = useState<PendingImageEditorState | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [closePromptOpen, setClosePromptOpen] = useState(false);
  const [draftBaseline, setDraftBaseline] = useState(() => serializeDraftPayload(initialForm.payload));
  const [flashError, setFlashError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const eventVariables = useMemo(() => buildEventTemplateVariables(sourceEvent?.props ?? []), [sourceEvent?.props]);
  const eventVariableByKey = useMemo(() => new Map(eventVariables.map((variable) => [variable.key, variable])), [eventVariables]);
  const isEditMode = mode === "edit" && Boolean(initialTemplate);
  const fullscreen = Boolean(sourceEvent);
  const modalTitle = isEditMode ? "알림톡 템플릿 수정" : sourceEvent ? "이벤트 기반 알림톡 템플릿 만들기" : "알림톡 템플릿 만들기";
  const bodyPlaceholder = buildTemplateBodyPlaceholder(sourceEvent, eventVariables);
  const footerNotice = isEditMode
    ? "수정 후 카카오 검수 절차가 다시 진행됩니다."
    : sourceEvent
    ? "검수 요청 후 이 이벤트에 연결됩니다."
    : "제출 후 카카오 검수 절차 진행 (영업일 1-3일)";
  const submitLabel = isEditMode ? "수정 요청" : sourceEvent ? "검수 요청하고 연결" : "검수 요청";
  const failureTitle = isEditMode ? "수정 요청 실패" : "검수 요청 실패";

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextForm = buildInitialKakaoTemplateDraft(registrationTargets, categories, sourceEvent, initialTemplate, initialDraft, mode);
    setDraftTemplateId(nextForm.draftTemplateId);
    setTargetId(nextForm.targetId);
    setTemplateCode(nextForm.templateCode);
    setName(nextForm.name);
    setMessageType(nextForm.messageType);
    setEmphasizeType(nextForm.emphasizeType);
    setTitle(nextForm.title);
    setSubtitle(nextForm.subtitle);
    setBody(nextForm.body);
    bodySelectionRef.current = { start: nextForm.body.length, end: nextForm.body.length };
    variableInsertTargetRef.current = { kind: "body", start: nextForm.body.length, end: nextForm.body.length };
    setExtra(nextForm.extra);
    setSecurityFlag(nextForm.securityFlag);
    setCategoryGroupName(nextForm.categoryGroupName);
    setCategoryCode(nextForm.categoryCode);
    setButtons(nextForm.buttons);
    setQuickReplies(nextForm.quickReplies);
    setComment(nextForm.comment);
    setImageName(nextForm.imageName);
    setImageUrl(nextForm.imageUrl);
    setDraftBaseline(serializeDraftPayload(nextForm.payload));
    setClosePromptOpen(false);
    setFlashError(null);
    setFieldErrors({});
  }, [categories, initialDraft, initialTemplate, mode, open, registrationTargets, sourceEvent]);

  useEffect(() => {
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting && !imageUploading) {
        requestClose();
      }
    };

    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  });

  if (!open) {
    return null;
  }

  const selectedTargetId = registrationTargets.some((item) => item.id === targetId) ? targetId : registrationTargets[0]?.id ?? "";
  const selectedTarget = registrationTargets.find((item) => item.id === selectedTargetId) ?? registrationTargets[0] ?? null;
  const resolvedCategoryGroupName = categories.some((group) => group.name === categoryGroupName) ? categoryGroupName : "";
  const subCategories = currentCategorySubCategories(categories, resolvedCategoryGroupName);
  const resolvedCategoryCode = subCategories.some((item) => item.code === categoryCode) ? categoryCode : "";
  const contentCountColor =
    body.length > 1200 ? "var(--danger-fg)" : body.length > 1000 ? "var(--attention-fg)" : "var(--fg-muted)";
  const buttonMaxCount = quickReplies.length > 0 ? 2 : 5;
  const buttonAddDisabled = buttons.length >= buttonMaxCount;
  const buttonAddMessage =
    buttons.length >= buttonMaxCount
      ? quickReplies.length > 0
        ? "바로연결과 혼용 중이라 버튼은 더 추가할 수 없습니다."
        : "버튼은 최대 5개까지 추가할 수 있습니다."
      : quickReplies.length > 0
        ? "바로연결과 혼용 중이라 버튼은 최대 2개까지 가능합니다."
        : "";
  const quickReplyAddDisabled = buttons.length > 2 || quickReplies.length >= 5;
  const quickReplyAddMessage =
    buttons.length > 2
      ? "버튼이 3개 이상이면 바로연결을 추가할 수 없습니다. 버튼을 2개 이하로 줄여주세요."
      : quickReplies.length >= 5
        ? "바로연결은 최대 5개까지 추가할 수 있습니다."
        : buttons.length > 0
          ? "버튼과 혼용 중입니다. 버튼은 최대 2개까지만 유지할 수 있습니다."
          : "";
  const channelAddButtonIndex = findChannelAddButtonIndex(buttons);
  const requiresChannelAddButton = requiresChannelAddButtonForMessageType(messageType);

  const buildDraftPayload = (): V2SaveKakaoTemplateDraftPayload => ({
    draftTemplateId: draftTemplateId || undefined,
    targetType: selectedTarget?.type || initialDraft?.targetType || undefined,
    targetId: selectedTarget?.id || targetId || initialDraft?.targetId || undefined,
    senderProfileId: selectedTarget?.senderProfileId || initialDraft?.senderProfileId || undefined,
    templateCode: templateCode.trim() || undefined,
    name: name.trim() || undefined,
    body,
    messageType,
    emphasizeType,
    extra,
    title,
    subtitle,
    imageName: imageName || undefined,
    imageUrl: imageUrl || undefined,
    categoryCode: resolvedCategoryCode || categoryCode || undefined,
    securityFlag,
    buttons: buttons.map((action, index) => serializeDraftAction(action, index)),
    quickReplies: quickReplies.map((action, index) => serializeDraftAction(action, index)),
    comment,
    sourceEventKey: sourceEvent?.eventKey || initialDraft?.sourceEventKey || undefined,
  });
  const hasDraftChanges = () => serializeDraftPayload(buildDraftPayload()) !== draftBaseline;

  const requestClose = () => {
    if (submitting || imageUploading || savingDraft) {
      return;
    }

    if (!isEditMode && hasDraftChanges()) {
      setClosePromptOpen(true);
      return;
    }

    onClose();
  };

  const handleSaveDraft = async ({ closeAfterSave = false }: { closeAfterSave?: boolean } = {}) => {
    if (submitting || imageUploading || isEditMode) {
      return;
    }

    setSavingDraft(true);
    setFlashError(null);

    try {
      const payload = buildDraftPayload();
      const response = await saveV2KakaoTemplateDraft(payload);
      setDraftTemplateId(response.draft.id);
      const nextPayload = {
        ...payload,
        draftTemplateId: response.draft.id,
      };
      setDraftBaseline(serializeDraftPayload(nextPayload));
      setClosePromptOpen(false);
      onDraftSaved?.(response);

      if (closeAfterSave) {
        onClose();
      }
    } catch (error) {
      setFlashError(error instanceof Error ? error.message : "임시저장에 실패했습니다.");
    } finally {
      setSavingDraft(false);
    }
  };

  const handleBackdropClick = () => {
    if (submitting || imageUploading || savingDraft) {
      return;
    }

    requestClose();
  };

  const handleCodeChange = (value: string) => {
    const sanitized = value.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 20);
    setTemplateCode(sanitized);
    setFieldErrors((current) => ({ ...current, code: "" }));
  };

  const handleCategoryGroupChange = (value: string) => {
    setCategoryGroupName(value);
    setCategoryCode("");
    setFieldErrors((current) => ({ ...current, category: "" }));
  };

  const handleMessageTypeChange = (nextType: KakaoTemplateMessageType) => {
    setMessageType(nextType);
    setFlashError(null);

    if (!requiresChannelAddButtonForMessageType(nextType)) {
      return;
    }

    const orderedButtons = moveChannelAddButtonToFront(buttons);
    if (findChannelAddButtonIndex(orderedButtons) !== -1) {
      if (orderedButtons !== buttons) {
        setButtons(orderedButtons);
      }
      return;
    }

    if (orderedButtons.length >= buttonMaxCount) {
      setFlashError(buildChannelAddMissingMessage(nextType, true));
      return;
    }

    setButtons([createChannelAddAction(), ...orderedButtons]);
  };

  const handleButtonChange = (index: number, next: KakaoTemplateAction) => {
    setButtons((current) => {
      const updated = current.map((item, itemIndex) => (itemIndex === index ? next : item));
      return moveChannelAddButtonToFront(updated);
    });
    setFlashError(null);
  };

  const handleImageUpload = async (file: File | null) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setFlashError("이미지 파일만 업로드할 수 있습니다.");
      return;
    }

    setFlashError(null);
    if (imageEditor) {
      URL.revokeObjectURL(imageEditor.sourceUrl);
    }
    setImageEditor({
      sourceUrl: URL.createObjectURL(file),
      fileName: file.name,
    });
  };

  const closeImageEditor = () => {
    if (imageEditor) {
      URL.revokeObjectURL(imageEditor.sourceUrl);
    }
    setImageEditor(null);
  };

  const handleEditedImageApply = async (file: File) => {
    setImageUploading(true);
    setFlashError(null);

    try {
      const uploaded = await uploadV2KakaoTemplateImage(file);
      setImageName(uploaded.templateImageName);
      setImageUrl(uploaded.templateImageUrl);
      closeImageEditor();
    } catch (error) {
      throw (error instanceof Error ? error : new Error("이미지 업로드에 실패했습니다."));
    } finally {
      setImageUploading(false);
    }
  };

  const handleSubmit = async () => {
    const nextFieldErrors: Record<string, string> = {};
    let nextFlashError: string | null = null;
    const normalizedCode = templateCode.trim();
    const normalizedName = name.trim();
    const normalizedBody = body.trim();
    const normalizedCategoryCode = resolvedCategoryCode.trim();
    const normalizedTitle = title.trim();
    const normalizedSubtitle = subtitle.trim();
    const normalizedExtra = extra.trim();

    setFlashError(null);

    const pushFlashError = (message: string) => {
      if (!nextFlashError) {
        nextFlashError = message;
      }
    };

    if (!normalizedCode) {
      nextFieldErrors.code = "템플릿 코드를 입력해주세요.";
    } else if (!/^[A-Za-z0-9_-]+$/.test(normalizedCode)) {
      nextFieldErrors.code = "영문, 숫자, -, _ 만 입력 가능합니다.";
    } else if (normalizedCode.length > 20) {
      nextFieldErrors.code = "최대 20자까지 입력 가능합니다.";
    }

    if (!normalizedName) {
      nextFieldErrors.name = "템플릿 이름을 입력해주세요.";
    }

    if (!normalizedBody) {
      nextFieldErrors.body = "템플릿 내용을 입력해주세요.";
    } else if (normalizedBody.length > 1300) {
      nextFieldErrors.body = "템플릿 내용은 최대 1,300자입니다.";
    }

    if (!normalizedCategoryCode) {
      nextFieldErrors.category = "카테고리를 선택해주세요.";
    }

    if (!selectedTarget) {
      pushFlashError("발신 프로필을 선택해주세요.");
    }

    if (emphasizeType === "TEXT" && (!normalizedTitle || !normalizedSubtitle)) {
      pushFlashError("강조 제목과 강조 부제목을 입력해주세요.");
    }

    if (emphasizeType === "IMAGE" && (!imageName || !imageUrl)) {
      pushFlashError("이미지형은 먼저 이미지를 업로드해야 합니다.");
    }

    if ((messageType === "EX" || messageType === "MI") && !normalizedExtra) {
      pushFlashError("부가 정보를 입력해주세요.");
    }

    if (!nextFlashError && requiresChannelAddButton && channelAddButtonIndex === -1) {
      pushFlashError(buildChannelAddMissingMessage(messageType));
    }

    if (!nextFlashError && channelAddButtonIndex > 0) {
      pushFlashError(buildChannelAddOrderMessage());
    }

    if (!nextFlashError && !requiresChannelAddButton && channelAddButtonIndex !== -1) {
      pushFlashError(buildChannelAddTypeMismatchMessage(messageType));
    }

    for (const action of buttons) {
      if (!action.type) {
        pushFlashError("버튼 유형을 선택해주세요.");
        break;
      }
      if (!action.name.trim()) {
        pushFlashError("버튼 이름을 입력해주세요.");
        break;
      }
      if (action.type === "WL" && !action.linkMo.trim()) {
        pushFlashError(`버튼 "${action.name || "웹 링크"}"의 Mobile URL을 입력해주세요.`);
        break;
      }
      if (action.type === "WL" && !isWebUrlTemplate(action.linkMo)) {
        pushFlashError(`버튼 "${action.name || "웹 링크"}"의 Mobile URL은 http:// 또는 https://로 시작해야 합니다.`);
        break;
      }
      if ((action.type === "WL" || action.type === "AL") && action.linkPc.trim() && !isWebUrlTemplate(action.linkPc)) {
        pushFlashError(`버튼 "${action.name || "링크"}"의 PC URL은 http:// 또는 https://로 시작해야 합니다.`);
        break;
      }
      if (action.type === "AL" && action.linkMo.trim() && !isWebUrlTemplate(action.linkMo)) {
        pushFlashError(`앱 링크 버튼 "${action.name || "앱 링크"}"의 Mobile URL은 http:// 또는 https://로 시작해야 합니다.`);
        break;
      }
      if (action.type === "AL") {
        const count = [action.linkMo, action.schemeIos, action.schemeAndroid].filter((item) => item.trim()).length;
        if (count < 2) {
          pushFlashError(`앱 링크 버튼 "${action.name || "앱 링크"}"는 Mobile/iOS/Android 중 2개 이상 입력해주세요.`);
          break;
        }
      }
      if (action.type === "TN" && !action.telNumber.trim()) {
        pushFlashError(`전화하기 버튼 "${action.name || "전화하기"}"의 전화번호를 입력해주세요.`);
        break;
      }
      if (action.type === "BF" && !action.bizFormId.trim()) {
        pushFlashError(`비즈니스폼 버튼 "${action.name || "비즈니스폼"}"의 폼 ID를 입력해주세요.`);
        break;
      }
    }

    if (!nextFlashError) {
      for (const action of quickReplies) {
        if (!action.type) {
          pushFlashError("바로연결 유형을 선택해주세요.");
          break;
        }
        if (!action.name.trim()) {
          pushFlashError("바로연결 이름을 입력해주세요.");
          break;
        }
        if (action.type === "WL" && !action.linkMo.trim()) {
          pushFlashError(`바로연결 "${action.name || "웹 링크"}"의 Mobile URL을 입력해주세요.`);
          break;
        }
        if (action.type === "WL" && !isWebUrlTemplate(action.linkMo)) {
          pushFlashError(`바로연결 "${action.name || "웹 링크"}"의 Mobile URL은 http:// 또는 https://로 시작해야 합니다.`);
          break;
        }
        if ((action.type === "WL" || action.type === "AL") && action.linkPc.trim() && !isWebUrlTemplate(action.linkPc)) {
          pushFlashError(`바로연결 "${action.name || "링크"}"의 PC URL은 http:// 또는 https://로 시작해야 합니다.`);
          break;
        }
        if (action.type === "AL" && action.linkMo.trim() && !isWebUrlTemplate(action.linkMo)) {
          pushFlashError(`바로연결 "${action.name || "앱 링크"}"의 Mobile URL은 http:// 또는 https://로 시작해야 합니다.`);
          break;
        }
        if (action.type === "AL") {
          const count = [action.linkMo, action.schemeIos, action.schemeAndroid].filter((item) => item.trim()).length;
          if (count < 2) {
            pushFlashError(`바로연결 "${action.name || "앱 링크"}"는 Mobile/iOS/Android 중 2개 이상 입력해주세요.`);
            break;
          }
        }
        if (action.type === "BF" && !action.bizFormId.trim()) {
          pushFlashError(`바로연결 "${action.name || "비즈니스폼"}"의 폼 ID를 입력해주세요.`);
          break;
        }
      }
    }

    setFieldErrors(nextFieldErrors);
    setFlashError(nextFlashError);

    if (Object.keys(nextFieldErrors).length > 0 || !selectedTarget || nextFlashError) {
      return;
    }

    const payload: V2CreateKakaoTemplatePayload = {
      draftTemplateId: draftTemplateId || undefined,
      targetType: selectedTarget.type,
      targetId: selectedTarget.id,
      templateCode: normalizedCode,
      name: normalizedName,
      body: normalizedBody,
      messageType,
      emphasizeType,
      extra: normalizedExtra || undefined,
      title: normalizedTitle || undefined,
      subtitle: normalizedSubtitle || undefined,
      imageName: imageName || undefined,
      imageUrl: imageUrl || undefined,
      categoryCode: normalizedCategoryCode,
      securityFlag,
      buttons: buttons.map((action) => serializeAction(action)).filter(Boolean) as NonNullable<V2CreateKakaoTemplatePayload["buttons"]>,
      quickReplies: quickReplies
        .map((action) => serializeQuickReply(action))
        .filter(Boolean) as NonNullable<V2CreateKakaoTemplatePayload["quickReplies"]>,
      comment: comment.trim() || undefined,
    };

    setSubmitting(true);

    try {
      if (isEditMode) {
        const response = await updateV2KakaoTemplate(initialTemplate?.templateCode || initialTemplate?.kakaoTemplateCode || normalizedCode, payload);
        onUpdated?.(response);
      } else {
        const response = await createV2KakaoTemplate(payload);
        onCreated(response);
      }
    } catch (error) {
      setFlashError(
        describeTemplateCreateError(
          error instanceof Error ? error.message : "알림톡 템플릿 검수 요청에 실패했습니다.",
          {
            messageType,
            emphasizeType,
            buttons,
          }
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEventVariableInsert = (key: string) => {
    const token = `#{${key}}`;
    const target = variableInsertTargetRef.current;

    if (target.kind !== "body") {
      insertVariableIntoActionTarget(target, token);
      return;
    }

    const textarea = bodyTextareaRef.current;
    if (textarea && document.activeElement === textarea) {
      updateBodySelection(textarea);
    }

    const storedSelection = bodySelectionRef.current;
    const selectionStart = clampTextPosition(storedSelection.start, body.length);
    const selectionEnd = clampTextPosition(storedSelection.end, body.length);
    const before = body.slice(0, selectionStart);
    const after = body.slice(selectionEnd);
    const nextBody = `${before}${token}${after}`;

    if (nextBody.length > 1300) {
      setFlashError("템플릿 내용은 최대 1,300자입니다.");
      return;
    }

    setBody(nextBody);
    setFieldErrors((current) => ({ ...current, body: "" }));

    window.requestAnimationFrame(() => {
      const nextCursor = before.length + token.length;
      bodySelectionRef.current = { start: nextCursor, end: nextCursor };
      variableInsertTargetRef.current = { kind: "body", start: nextCursor, end: nextCursor };
      bodyTextareaRef.current?.focus();
      bodyTextareaRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const updateBodySelection = (textarea: HTMLTextAreaElement | null = bodyTextareaRef.current) => {
    if (!textarea) {
      return;
    }

    const nextSelection = {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    };
    bodySelectionRef.current = nextSelection;
    variableInsertTargetRef.current = { kind: "body", ...nextSelection };
  };

  const updateActionVariableTarget = (
    kind: "button" | "quickReply",
    index: number,
    field: KakaoTemplateLinkField,
    input: HTMLInputElement
  ) => {
    variableInsertTargetRef.current = {
      kind,
      index,
      field,
      start: input.selectionStart ?? input.value.length,
      end: input.selectionEnd ?? input.value.length,
    };
    actionVariableInputRefs.current.set(actionVariableTargetKey(kind, index, field), input);
  };

  const registerActionVariableInput = (
    kind: "button" | "quickReply",
    index: number,
    field: KakaoTemplateLinkField,
    input: HTMLInputElement | null
  ) => {
    const key = actionVariableTargetKey(kind, index, field);
    if (input) {
      actionVariableInputRefs.current.set(key, input);
    } else {
      actionVariableInputRefs.current.delete(key);
    }
  };

  const insertVariableIntoActionTarget = (target: Extract<TemplateVariableTarget, { kind: "button" | "quickReply" }>, token: string) => {
    const action = target.kind === "button" ? buttons[target.index] : quickReplies[target.index];
    if (!action) {
      return;
    }

    const currentValue = action[target.field] || "";
    const selectionStart = clampTextPosition(target.start, currentValue.length);
    const selectionEnd = clampTextPosition(target.end, currentValue.length);
    const before = currentValue.slice(0, selectionStart);
    const after = currentValue.slice(selectionEnd);
    const nextValue = `${before}${token}${after}`;
    const nextCursor = before.length + token.length;
    const nextTarget = { ...target, start: nextCursor, end: nextCursor };

    if (target.kind === "button") {
      setButtons((current) =>
        current.map((item, itemIndex) => (itemIndex === target.index ? { ...item, [target.field]: nextValue } : item))
      );
    } else {
      setQuickReplies((current) =>
        current.map((item, itemIndex) => (itemIndex === target.index ? { ...item, [target.field]: nextValue } : item))
      );
    }

    variableInsertTargetRef.current = nextTarget;

    window.requestAnimationFrame(() => {
      const input = actionVariableInputRefs.current.get(actionVariableTargetKey(target.kind, target.index, target.field));
      input?.focus();
      input?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const showTooltip = (text: string, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    const left = Math.min(Math.max(rect.left + rect.width / 2, 24), window.innerWidth - 24);
    const dir = rect.top > window.innerHeight / 2 ? "up" : "down";
    const top = dir === "up" ? rect.top - 84 : rect.bottom + 10;
    setTooltip({ text: normalizeTooltipText(text), top, left, dir });
  };

  const hideBodyVariableTooltip = () => {
    bodyHoveredTokenRef.current = null;
    setTooltip(null);
  };

  const handleBodyTokenLayerScroll = (event: ReactUIEvent<HTMLTextAreaElement>) => {
    const layer = bodyTokenLayerRef.current;
    if (!layer) {
      return;
    }

    layer.scrollTop = event.currentTarget.scrollTop;
    layer.scrollLeft = event.currentTarget.scrollLeft;
  };

  const handleBodyTokenHover = (event: ReactMouseEvent<HTMLTextAreaElement>) => {
    const layer = bodyTokenLayerRef.current;
    if (!layer) {
      hideBodyVariableTooltip();
      return;
    }

    const tokenElements = layer.querySelectorAll<HTMLElement>("[data-template-body-token]");
    for (const tokenElement of tokenElements) {
      const rect = tokenElement.getBoundingClientRect();
      if (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      ) {
        const key = tokenElement.dataset.templateBodyToken || "";
        const hoverId = tokenElement.dataset.templateBodyTokenId || key;
        if (bodyHoveredTokenRef.current !== hoverId) {
          bodyHoveredTokenRef.current = hoverId;
          showTooltip(formatVariableTooltip(key, eventVariableByKey.get(key)), tokenElement);
        }
        return;
      }
    }

    if (bodyHoveredTokenRef.current) {
      hideBodyVariableTooltip();
    }
  };

  return (
    <div className={`modal-backdrop open${fullscreen ? " tmpl-fullscreen-backdrop" : ""}`} onClick={handleBackdropClick}>
      <div className={`tmpl-modal-stack${fullscreen ? " tmpl-modal-stack-full" : ""}`} onClick={(event) => event.stopPropagation()}>
        {flashError ? (
          <div className="flash flash-attention tmpl-modal-floating-alert" role="alert" aria-live="polite">
            <AppIcon name="warn" className="icon icon-16 flash-icon" />
            <div className="flash-body">
              <strong>{failureTitle}</strong>
              <div style={{ marginTop: 4, whiteSpace: "pre-line" }}>{flashError}</div>
            </div>
            <button
              type="button"
              className="tmpl-modal-alert-close"
              aria-label="에러 메시지 닫기"
              onClick={() => setFlashError(null)}
            >
              <AppIcon name="x" className="icon icon-14" />
            </button>
          </div>
        ) : null}

        <div className={`modal modal-xl${fullscreen ? " tmpl-fullscreen-modal" : ""}`}>
          <div className="modal-header" style={{ padding: "14px 20px" }}>
            <div className="modal-title">
              <AppIcon name="kakao" className="icon icon-18" style={{ color: "#c9a700" }} />
              {modalTitle}
            </div>
            <button className="modal-close" onClick={handleBackdropClick}>
              <AppIcon name="x" className="icon icon-18" />
            </button>
          </div>

          <div className={`modal-body${fullscreen ? " tmpl-fullscreen-body" : ""}`}>
            {sourceEvent ? (
            <EventTemplateContextPanel
              event={sourceEvent}
              variables={eventVariables}
              onInsertVariable={handleEventVariableInsert}
            />
            ) : null}
            <div className="tmpl-form-col">
              <div className="form-group">
                <label className="form-label">발신 프로필 <span style={{ color: "var(--danger-fg)" }}>*</span></label>
                <FormSelect className="form-control" style={{ maxWidth: 300 }} value={selectedTargetId} onChange={(event) => setTargetId(event.target.value)} disabled={submitting || isEditMode}>
                  {registrationTargets.map((item) => (
                    <option key={item.id} value={item.id}>
                      {registrationTargetLabel(item)}
                    </option>
                  ))}
                </FormSelect>
                {selectedTarget?.type === "GROUP" ? (
                  <p className="form-hint" style={{ marginTop: 6 }}>
                    PUBL 공용 sender-group으로 등록합니다.
                  </p>
                ) : null}
              </div>
 
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">
                    템플릿 코드 <span style={{ color: "var(--danger-fg)" }}>*</span>
                    <TooltipIcon
                      tip="영문·대소문자, 숫자, 하이픈(-), 언더스코어(_)만 사용 가능합니다.\n최대 20자이며, 한번 등록하면 변경할 수 없습니다."
                      onShow={showTooltip}
                      onHide={() => setTooltip(null)}
                    />
                  </label>
                  <input
                    className={`form-control${fieldErrors.code ? " tmpl-input-error" : templateCode ? " tmpl-input-ok" : ""}`}
                    placeholder="예: ORDER_COMPLETE_01"
                    maxLength={20}
                    value={templateCode}
                    onChange={(event) => handleCodeChange(event.target.value)}
                    disabled={submitting || isEditMode}
                  />
                  <div className={`tmpl-field-error${fieldErrors.code ? " show" : ""}`}>{fieldErrors.code || "영문, 숫자, -, _ 만 입력 가능합니다."}</div>
                  <p className="form-hint">최대 20자 · 등록 후 변경 불가</p>
                </div>
                <div className="form-group">
                  <label className="form-label">템플릿 이름 <span style={{ color: "var(--danger-fg)" }}>*</span></label>
                  <input
                    className={`form-control${fieldErrors.name ? " tmpl-input-error" : name.trim() ? " tmpl-input-ok" : ""}`}
                    placeholder="최대 150자"
                    maxLength={150}
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      setFieldErrors((current) => ({ ...current, name: "" }));
                    }}
                    disabled={submitting}
                  />
                  <div className={`tmpl-field-error${fieldErrors.name ? " show" : ""}`}>{fieldErrors.name || "템플릿 이름을 입력해주세요."}</div>
                </div>
              </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="form-group">
                <label className="form-label">
                  메시지 유형 <span style={{ color: "var(--danger-fg)" }}>*</span>
                  <TooltipIcon
                    tip="• 기본형: 일반 정보성 메시지\n• 채널 추가형: 하단에 채널 추가 안내 문구가 들어가며, 버튼에 '채널 추가'가 필요\n• 부가 정보형: 본문 아래 추가 안내 영역 제공\n• 복합형: 채널 추가 안내 문구 + 부가 정보가 함께 들어가며, 버튼에 '채널 추가'가 필요"
                    onShow={showTooltip}
                    onHide={() => setTooltip(null)}
                  />
                </label>
                <FormSelect className="form-control" value={messageType} onChange={(event) => handleMessageTypeChange(event.target.value as KakaoTemplateMessageType)} disabled={submitting}>
                  <option value="AD">채널 추가형</option>
                  <option value="BA">기본형</option>
                  <option value="EX">부가 정보형</option>
                  <option value="MI">복합형</option>
                </FormSelect>
              </div>
              <div className="form-group">
                <label className="form-label">
                  강조 유형
                  <TooltipIcon
                    tip="• 선택 안 함: 일반 텍스트\n• 강조 표기형: 제목+부제목을 크게 표시\n• 이미지형: 메시지 상단에 이미지 삽입 (800×400px 권장)"
                    onShow={showTooltip}
                    onHide={() => setTooltip(null)}
                  />
                </label>
                <FormSelect className="form-control" value={emphasizeType} onChange={(event) => setEmphasizeType(event.target.value as "NONE" | "TEXT" | "IMAGE")} disabled={submitting}>
                  <option value="NONE">선택 안 함</option>
                  <option value="TEXT">강조 표기형</option>
                  <option value="IMAGE">이미지형</option>
                </FormSelect>
              </div>
            </div>

            <div id="tmpl-text-emph" style={{ display: emphasizeType === "TEXT" ? "block" : "none", background: "var(--canvas-subtle)", border: "1px solid var(--border-muted)", borderRadius: "var(--radius)", padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-muted)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <AppIcon name="info" className="icon icon-12" /> 강조 표기형 설정
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>강조 제목 <span style={{ color: "var(--danger-fg)" }}>*</span></label>
                  <input className="form-control" placeholder="제목 (최대 50자)" maxLength={50} value={title} onChange={(event) => setTitle(event.target.value)} disabled={submitting} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>
                    강조 부제목 <span style={{ color: "var(--danger-fg)" }}>*</span>
                    <TooltipIcon tip="부제목에는 #{치환변수} 사용이 불가합니다." onShow={showTooltip} onHide={() => setTooltip(null)} />
                  </label>
                  <input className="form-control" placeholder="부제목 — 치환변수 불가" maxLength={50} value={subtitle} onChange={(event) => setSubtitle(event.target.value)} disabled={submitting} />
                </div>
              </div>
            </div>

            <div id="tmpl-image-emph" style={{ display: emphasizeType === "IMAGE" ? "block" : "none", background: "var(--canvas-subtle)", border: "1px solid var(--border-muted)", borderRadius: "var(--radius)", padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-muted)", marginBottom: 10 }}>이미지 설정</div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 72, height: 40, borderRadius: 6, border: "1.5px dashed var(--border-muted)", background: "var(--canvas-default)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl} alt="알림톡 템플릿 이미지" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <AppIcon name="upload" className="icon icon-18" style={{ color: "var(--fg-subtle)" }} />
                  )}
                </div>
                <div>
                  <label htmlFor={imageInputId} className="btn btn-default btn-sm" style={{ cursor: imageUploading || submitting ? "not-allowed" : "pointer", opacity: imageUploading || submitting ? 0.6 : 1 }}>
                    {imageUploading ? "업로드 중..." : imageUrl ? "이미지 교체" : "이미지 업로드"}
                  </label>
                  <input
                    id={imageInputId}
                    type="file"
                    accept="image/png,image/jpeg"
                    style={{ display: "none" }}
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      void handleImageUpload(file);
                      event.currentTarget.value = "";
                    }}
                    disabled={imageUploading || submitting}
                  />
                  <p className="form-hint" style={{ marginTop: 4 }}>JPEG/PNG · 업로드 후 800×400 기준으로 조정됩니다.</p>
                  {imageName ? <p className="form-hint" style={{ marginTop: 4, color: "var(--fg-default)" }}>{imageName}</p> : null}
                </div>
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label className="form-label" style={{ margin: 0 }}>
                  템플릿 내용 <span style={{ color: "var(--danger-fg)" }}>*</span>
                  <TooltipIcon
                    tip="변수는 #{변수명} 형식으로 입력하세요.\n예) #{이름}님의 택배가 #{시간}에 배달 예정입니다.\n\n대체 발송 시 이 내용이 SMS로 발송됩니다.\n최대 1,300자 (이미지리스트형 포함 시 1,000자)"
                    onShow={showTooltip}
                    onHide={() => setTooltip(null)}
                  />
                </label>
                <span style={{ fontSize: 11, color: contentCountColor, fontFamily: "ui-monospace,monospace" }}>{body.length} / 1300</span>
              </div>
              <div className="tmpl-body-textarea-wrap">
                <div ref={bodyTokenLayerRef} className="tmpl-body-token-layer" aria-hidden="true">
                  {renderTemplateBodyTokenLayer(body)}
                </div>
                <textarea
                  ref={bodyTextareaRef}
                  className={`form-control tmpl-body-textarea${fieldErrors.body ? " tmpl-input-error" : body.trim() ? " tmpl-input-ok" : ""}`}
                  rows={5}
                  style={{ resize: "vertical" }}
                  placeholder={bodyPlaceholder}
                  maxLength={1300}
                  value={body}
                  onScroll={handleBodyTokenLayerScroll}
                  onMouseMove={handleBodyTokenHover}
                  onMouseLeave={hideBodyVariableTooltip}
                  onClick={(event) => updateBodySelection(event.currentTarget)}
                  onKeyUp={(event) => updateBodySelection(event.currentTarget)}
                  onSelect={(event) => updateBodySelection(event.currentTarget)}
                  onFocus={(event) => updateBodySelection(event.currentTarget)}
                  onChange={(event) => {
                    updateBodySelection(event.currentTarget);
                    setBody(event.target.value);
                    setFieldErrors((current) => ({ ...current, body: "" }));
                  }}
                  disabled={submitting}
                />
              </div>
              <div className={`tmpl-field-error${fieldErrors.body ? " show" : ""}`}>{fieldErrors.body || "템플릿 내용을 입력해주세요."}</div>
            </div>

            <div id="tmpl-extra-wrap" style={{ display: messageType === "EX" || messageType === "MI" ? "block" : "none" }}>
              <div className="form-group">
                <label className="form-label">
                  부가 정보 <span style={{ color: "var(--danger-fg)" }}>*</span>
                  <TooltipIcon tip="본문 아래 회색 영역에 표시됩니다.\n치환변수와 URL 사용이 불가합니다. 최대 500자" onShow={showTooltip} onHide={() => setTooltip(null)} />
                </label>
                <textarea className="form-control" rows={2} style={{ resize: "vertical" }} placeholder="치환변수·URL 사용 불가 · 최대 500자" maxLength={500} value={extra} onChange={(event) => setExtra(event.target.value)} disabled={submitting} />
              </div>
            </div>

            <div id="tmpl-ad-wrap" style={{ display: messageType === "AD" || messageType === "MI" ? "block" : "none" }}>
              <div className="form-group">
                <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  채널 추가 안내 메시지
                  <TooltipIcon tip="채널 추가형/복합형 메시지 하단에 자동으로 포함됩니다.\n이미 채널을 추가한 수신자에게는 노출되지 않습니다." onShow={showTooltip} onHide={() => setTooltip(null)} />
                </label>
                <div style={{ padding: "9px 12px", background: "var(--canvas-subtle)", border: "1px solid var(--border-muted)", borderRadius: "var(--radius)", fontSize: 12, color: "var(--fg-muted)" }}>
                  채널 추가하고 이 채널의 마케팅 메시지 등을 카카오톡으로 받기
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="form-group">
                <label className="form-label">
                  보안 템플릿 여부
                  <TooltipIcon tip="OTP 등 보안 메시지에 설정합니다.\n설정 시 발송 당시 메인 디바이스를 제외한\n모든 기기에서 메시지 본문이 표시되지 않습니다." onShow={showTooltip} onHide={() => setTooltip(null)} />
                </label>
                <FormSelect className="form-control" value={String(securityFlag)} onChange={(event) => setSecurityFlag(event.target.value === "true")} disabled={submitting}>
                  <option value="false">미설정</option>
                  <option value="true">설정 (OTP 등 보안 메시지)</option>
                </FormSelect>
              </div>
              <div className="form-group">
                <label className="form-label">
                  카테고리 <span style={{ color: "var(--danger-fg)" }}>*</span>
                  <TooltipIcon tip="기타 선택 시 검수 우선순위가 최하로 처리됩니다.\n템플릿 내용에 맞는 카테고리를 선택해주세요." onShow={showTooltip} onHide={() => setTooltip(null)} />
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <FormSelect className={`form-control${fieldErrors.category ? " tmpl-input-error" : ""}`} value={resolvedCategoryGroupName} onChange={(event) => handleCategoryGroupChange(event.target.value)} disabled={submitting}>
                    <option value="">대분류 선택</option>
                    {categories.map((group) => (
                      <option key={group.name || "none"} value={group.name || ""}>
                        {group.name || "이름 없는 분류"}
                      </option>
                    ))}
                  </FormSelect>
                  <FormSelect className={`form-control${fieldErrors.category ? " tmpl-input-error" : ""}`} value={resolvedCategoryCode} onChange={(event) => { setCategoryCode(event.target.value); setFieldErrors((current) => ({ ...current, category: "" })); }} disabled={submitting || !resolvedCategoryGroupName}>
                    <option value="">중분류 선택</option>
                    {subCategories.map((item) => (
                      <option key={item.code || item.name} value={item.code || ""}>
                        {item.name || item.code || "이름 없는 카테고리"}
                      </option>
                    ))}
                  </FormSelect>
                  <div className={`tmpl-field-error${fieldErrors.category ? " show" : ""}`}>{fieldErrors.category || "카테고리를 선택해주세요."}</div>
                </div>
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <label className="form-label" style={{ margin: 0, display: "flex", alignItems: "center", gap: 4 }}>
                  버튼
                  <TooltipIcon tip="최대 5개까지 추가 가능합니다.\n바로연결과 혼용 시 버튼은 최대 2개입니다.\n채널 추가형/복합형은 버튼에 '채널 추가'가 필요하며 첫 번째 버튼에 배치됩니다.\n\n• 웹 링크: Mobile URL 필수\n• 앱 링크: Mobile/iOS/Android 중 2개 이상 필수\n• 전화하기: 버튼명은 전화 연결/고객센터 연결/상담원 연결 중 선택" onShow={showTooltip} onHide={() => setTooltip(null)} />
                </label>
                <div className="tmpl-add-actions">
                  <span className={`tmpl-add-status${buttonAddMessage ? " show" : ""}`}>{buttonAddMessage}</span>
                  <button className="btn btn-default btn-sm" onClick={() => setButtons((current) => (buttonAddDisabled ? current : [...current, EMPTY_ACTION()]))} disabled={buttonAddDisabled || submitting} type="button">
                    <AppIcon name="plus" className="icon icon-12" /> 버튼 추가
                  </button>
                </div>
              </div>
              {requiresChannelAddButton ? (
                <p className="form-hint" style={{ marginBottom: 8 }}>
                  현재 메시지 유형은 {messageTypeLabel(messageType)}입니다. 버튼에 <strong>&apos;채널 추가&apos;</strong>가 필요하고, 있으면 항상 첫 번째 버튼으로 배치됩니다.
                </p>
              ) : null}
              {buttons.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--fg-muted)", padding: "6px 0 2px" }}>버튼이 없습니다.</div>
              ) : (
                buttons.map((action, index) => (
                  <ActionCard
                    key={`button-${index}`}
                    index={index}
                    action={action}
                    typeOptions={BUTTON_TYPES}
                    onChange={(next) => handleButtonChange(index, next)}
                    onDelete={() => setButtons((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    onLinkFieldActive={(field, input) => updateActionVariableTarget("button", index, field, input)}
                    registerLinkFieldInput={(field, input) => registerActionVariableInput("button", index, field, input)}
                  />
                ))
              )}
            </div>

            <div className="form-group">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <label className="form-label" style={{ margin: 0, display: "flex", alignItems: "center", gap: 4 }}>
                  바로연결
                  <TooltipIcon tip="최대 5개까지 추가 가능합니다.\n배송조회·플러그인 타입은 사용할 수 없습니다.\n버튼과 혼용 시 버튼은 최대 2개입니다." onShow={showTooltip} onHide={() => setTooltip(null)} />
                </label>
                <div className="tmpl-add-actions">
                  <span className={`tmpl-add-status${quickReplyAddMessage ? " show" : ""}`}>{quickReplyAddMessage}</span>
                  <button className="btn btn-default btn-sm" onClick={() => setQuickReplies((current) => (quickReplyAddDisabled ? current : [...current, EMPTY_ACTION()]))} disabled={quickReplyAddDisabled || submitting} type="button">
                    <AppIcon name="plus" className="icon icon-12" /> 바로연결 추가
                  </button>
                </div>
              </div>
              {quickReplies.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--fg-muted)", padding: "6px 0 2px" }}>바로연결이 없습니다.</div>
              ) : (
                quickReplies.map((action, index) => (
                  <ActionCard
                    key={`quick-${index}`}
                    index={index}
                    action={action}
                    typeOptions={QUICK_REPLY_TYPES}
                    onChange={(next) => setQuickReplies((current) => current.map((item, itemIndex) => (itemIndex === index ? next : item)))}
                    onDelete={() => setQuickReplies((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    onLinkFieldActive={(field, input) => updateActionVariableTarget("quickReply", index, field, input)}
                    registerLinkFieldInput={(field, input) => registerActionVariableInput("quickReply", index, field, input)}
                  />
                ))
              )}
            </div>

            <div style={{ paddingTop: 16, borderTop: "1px solid var(--border-muted)" }}>
              <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                검수 문의
                <span style={{ fontSize: 11, fontWeight: 400, color: "var(--fg-muted)" }}>선택</span>
                <TooltipIcon tip="검수 담당자에게 전달할 내용을 입력하세요.\n요청·승인 상태의 템플릿은 문의할 수 없으며,\n반려 상태의 템플릿 문의 시 검수 상태로 변경됩니다." onShow={showTooltip} onHide={() => setTooltip(null)} />
              </label>
              <textarea className="form-control" rows={2} placeholder="검수 담당자에게 문의할 내용 (최대 300자)" maxLength={300} value={comment} onChange={(event) => setComment(event.target.value)} disabled={submitting} />
            </div>
          </div>

          <div className="tmpl-preview-col">
            <div className="kakao-phone">
              <div className="kakao-phone-topbar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
                <span className="kakao-phone-topbar-title">알림톡</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>
              </div>
              <div className="kakao-chat-area">
                <div className="kakao-chat-header">
                  <span className="kakao-chat-header-badge">알림톡 서비스 안내</span>
                </div>
                <div className="kakao-msg-row">
                  <div className="kakao-avatar">{previewAvatarLabel(selectedTarget)}</div>
                  <div className="kakao-bubble-wrap">
                    <div className="kakao-sender-name">{selectedTarget?.label || "@channel"}</div>
                    <div className="kakao-bubble">
                      {emphasizeType === "IMAGE" ? (
                        <div className="kakao-bubble-img">
                          {imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={imageUrl} alt="미리보기 이미지" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <AppIcon name="upload" className="icon icon-20" style={{ color: "#aaa" }} />
                          )}
                        </div>
                      ) : null}
                      {emphasizeType === "TEXT" ? (
                        <div style={{ paddingBottom: 8, marginBottom: 8, borderBottom: "1px solid #f0f0f0" }}>
                          <div className="kakao-bubble-subtitle">{subtitle}</div>
                          <div className="kakao-bubble-title">{title}</div>
                        </div>
                      ) : null}
                      <div className="kakao-bubble-content" style={!body ? { color: "#aaa", fontSize: 11 } : undefined}>
                        {body || "내용을 입력하면 여기 표시됩니다"}
                      </div>
                      {(messageType === "EX" || messageType === "MI") && extra ? (
                        <div className="kakao-bubble-extra">{extra}</div>
                      ) : null}
                      {messageType === "AD" || messageType === "MI" ? (
                        <div className="kakao-bubble-ad">채널 추가하고 이 채널의 마케팅 메시지 등을 카카오톡으로 받기</div>
                      ) : null}
                      {buttons.length > 0 ? (
                        <div className="kakao-btn-area">
                          {buttons.map((action, index) => (
                            <div key={`prev-btn-${index}`} className="kakao-btn-item">{action.name || action.type}</div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {quickReplies.length > 0 ? (
                      <div className="kakao-quick-area">
                        {quickReplies.map((action, index) => (
                          <div key={`prev-quick-${index}`} className="kakao-quick-item">{action.name || action.type}</div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

          <div className="modal-footer" style={{ justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "var(--fg-muted)", display: "flex", alignItems: "center", gap: 5 }}>
              <AppIcon name="info" className="icon icon-12" style={{ color: "var(--attention-fg)" }} />
              {footerNotice}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              {!isEditMode ? (
                <button className="btn btn-default" onClick={() => void handleSaveDraft()} disabled={submitting || imageUploading || savingDraft} type="button">
                  {savingDraft ? "저장 중..." : "임시저장"}
                </button>
              ) : null}
              <button className="btn btn-default" onClick={handleBackdropClick} disabled={submitting || imageUploading || savingDraft}>취소</button>
              <button className="btn btn-kakao" onClick={handleSubmit} disabled={submitting || imageUploading || savingDraft || !selectedTarget}>
                <AppIcon name="send" className="icon icon-14" /> {submitting ? "요청 중..." : submitLabel}
              </button>
            </div>
          </div>

          <div id="tmpl-floating-tip" className={tooltip ? "show" : ""} data-dir={tooltip?.dir ?? "down"} style={tooltip ? { top: tooltip.top, left: tooltip.left } : undefined}>
            {tooltip?.text || ""}
          </div>
        </div>
      </div>

      {imageEditor ? (
        <KakaoTemplateImageEditorModal
          key={imageEditor.sourceUrl}
          open
          fileName={imageEditor.fileName}
          sourceUrl={imageEditor.sourceUrl}
          onClose={closeImageEditor}
          onApply={handleEditedImageApply}
        />
      ) : null}

      {closePromptOpen ? (
        <div
          className="tmpl-close-confirm-backdrop"
          role="presentation"
          onClick={(event) => {
            event.stopPropagation();
            setClosePromptOpen(false);
          }}
        >
          <div
            className="tmpl-close-confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tmpl-close-confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="tmpl-close-confirm-header">
              <div id="tmpl-close-confirm-title" className="tmpl-close-confirm-title">
                임시저장할까요?
              </div>
            </div>
            <div className="tmpl-close-confirm-body">
              작성 중인 알림톡 템플릿이 아직 저장되지 않았습니다. 임시저장하면 나중에 이어서 검수 요청할 수 있습니다.
            </div>
            <div className="tmpl-close-confirm-footer">
              <button className="btn btn-default" type="button" onClick={() => setClosePromptOpen(false)} disabled={savingDraft}>
                계속 작성
              </button>
              <button className="btn btn-default" type="button" onClick={onClose} disabled={savingDraft}>
                저장 안 함
              </button>
              <button className="btn btn-accent" type="button" onClick={() => void handleSaveDraft({ closeAfterSave: true })} disabled={savingDraft}>
                {savingDraft ? "저장 중..." : "임시저장"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EventTemplateContextPanel({
  event,
  variables,
  onInsertVariable,
}: {
  event: V2PublEventItem;
  variables: EventTemplateVariable[];
  onInsertVariable: (key: string) => void;
}) {
  return (
    <aside className="tmpl-event-col" aria-label="이벤트 템플릿 변수">
      <div className="tmpl-event-panel-head">
        <div className="tmpl-event-panel-label">선택한 이벤트</div>
        <div className="tmpl-event-title">{event.displayName}</div>
        <code className="tmpl-event-key">{event.eventKey}</code>
      </div>

      <div className="tmpl-event-meta-grid">
        <TemplateEventMeta label="상태" value={publEventStatusText(event.serviceStatus)} />
        <TemplateEventMeta label="카테고리" value={event.category} />
        <TemplateEventMeta label="pApp" value={event.pAppName || event.pAppCode} />
        <TemplateEventMeta label="Action" value={event.actionType} />
      </div>

      <div className="tmpl-event-detail-box">
        <div className="tmpl-event-detail-label">트리거</div>
        <div className="tmpl-event-detail-text">{event.triggerText || "-"}</div>
        <div className="tmpl-event-detail-label">상세</div>
        <div className="tmpl-event-detail-text">{event.detailText || "-"}</div>
      </div>

      <section className="tmpl-event-variable-section">
        <div className="tmpl-event-section-head">
          <div>
            <div className="tmpl-event-section-title">이 이벤트의 변수</div>
            <div className="tmpl-event-section-subtitle">{variables.length}개 변수</div>
          </div>
        </div>

        {variables.length > 0 ? (
          <div className="tmpl-event-variable-list">
            {variables.map((variable) => (
              <button
                key={variable.key}
                type="button"
                className="tmpl-event-variable-chip"
                aria-label={`#{${variable.key}} 변수 넣기`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onInsertVariable(variable.key)}
              >
                <span className="tmpl-event-variable-label">{variable.label}</span>
                {variable.required ? <span className="label label-yellow">필수</span> : null}
                <span
                  className="tmpl-event-variable-token"
                  title={variable.label}
                >
                  #{"{"}{variable.key}{"}"}
                </span>
                <span className="tmpl-event-variable-meta">{variable.rawPath}</span>
                <span className="tmpl-event-variable-sample">
                  {variable.sample ? variable.sample : variable.type}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="tmpl-event-empty">사용할 변수가 없습니다.</div>
        )}
      </section>
    </aside>
  );
}

function TemplateEventMeta({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="tmpl-event-meta-card">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function ActionCard({
  index,
  action,
  typeOptions,
  onChange,
  onDelete,
  onLinkFieldActive,
  registerLinkFieldInput,
}: {
  index: number;
  action: KakaoTemplateAction;
  typeOptions: Array<{ value: string; label: string }>;
  onChange: (next: KakaoTemplateAction) => void;
  onDelete: () => void;
  onLinkFieldActive: (field: KakaoTemplateLinkField, input: HTMLInputElement) => void;
  registerLinkFieldInput: (field: KakaoTemplateLinkField, input: HTMLInputElement | null) => void;
}) {
  const isWebLink = action.type === "WL";
  const isAppLink = action.type === "AL";
  const isCall = action.type === "TN";
  const isBizForm = action.type === "BF";
  const showLinks = isWebLink || isAppLink;

  const handleTypeChange = (value: string) => {
    if (!value) {
      onChange(EMPTY_ACTION());
      return;
    }

    const next = {
      ...EMPTY_ACTION(),
      type: value,
    };

    if (value === "AC") {
      next.name = "채널 추가";
    } else if (value === "DS") {
      next.name = "배송 조회하기";
    } else if (value === "TN") {
      next.name = "전화 연결";
    } else if (value === "BF") {
      next.name = "톡에서 설문하기";
    }

    onChange(next);
  };

  const linkFieldProps = (field: KakaoTemplateLinkField) => ({
    ref: (input: HTMLInputElement | null) => registerLinkFieldInput(field, input),
    onFocus: (event: ReactFocusEvent<HTMLInputElement>) => onLinkFieldActive(field, event.currentTarget),
    onClick: (event: ReactMouseEvent<HTMLInputElement>) => onLinkFieldActive(field, event.currentTarget),
    onKeyUp: (event: ReactKeyboardEvent<HTMLInputElement>) => onLinkFieldActive(field, event.currentTarget),
    onSelect: (event: ReactSyntheticEvent<HTMLInputElement>) => onLinkFieldActive(field, event.currentTarget),
  });

  const handleLinkFieldChange = (field: KakaoTemplateLinkField, value: string, input: HTMLInputElement) => {
    onLinkFieldActive(field, input);
    onChange({ ...action, [field]: value });
  };

  return (
    <div className="tmpl-action-card">
      <div className="tmpl-action-card-header">
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-muted)", background: "var(--canvas-subtle)", border: "1px solid var(--border-muted)", borderRadius: 20, padding: "1px 8px", flexShrink: 0 }}>{index + 1}</span>
        <FormSelect
          className={`form-control${!action.type ? " form-control-select-placeholder" : ""}`}
          style={{ width: 138, fontSize: 12 }}
          value={action.type}
          onChange={(event) => handleTypeChange(event.target.value)}
        >
          <option value="" disabled>
            타입 선택하기
          </option>
          {typeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </FormSelect>
        <input className="form-control" style={{ flex: 1, fontSize: 12 }} placeholder="버튼 이름 (최대 14자)" maxLength={14} value={action.name} onChange={(event) => onChange({ ...action, name: event.target.value })} readOnly={action.type === "AC"} />
        <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-muted)", padding: 2, display: "flex", borderRadius: 4, flexShrink: 0 }} onClick={onDelete} type="button">
          <AppIcon name="trash" className="icon icon-14" />
        </button>
      </div>
      {showLinks ? (
        <div className="tmpl-action-card-body">
          <div className="tmpl-link-row">
            <span className="tmpl-link-label">Mobile{isWebLink ? <span className="tmpl-link-required">*</span> : null}</span>
            <input
              {...linkFieldProps("linkMo")}
              className="form-control"
              style={{ fontSize: 12 }}
              placeholder="https://example.com"
              value={action.linkMo}
              onChange={(event) => handleLinkFieldChange("linkMo", event.target.value, event.currentTarget)}
            />
          </div>
          <div className="tmpl-link-row">
            <span className="tmpl-link-label">PC</span>
            <input
              {...linkFieldProps("linkPc")}
              className="form-control"
              style={{ fontSize: 12 }}
              placeholder="https://example.com (선택)"
              value={action.linkPc}
              onChange={(event) => handleLinkFieldChange("linkPc", event.target.value, event.currentTarget)}
            />
          </div>
          {isAppLink ? (
            <>
              <div className="tmpl-link-row">
                <span className="tmpl-link-label">iOS</span>
                <input
                  {...linkFieldProps("schemeIos")}
                  className="form-control"
                  style={{ fontSize: 12 }}
                  placeholder="앱 스킴 (예: myapp://...)"
                  value={action.schemeIos}
                  onChange={(event) => handleLinkFieldChange("schemeIos", event.target.value, event.currentTarget)}
                />
              </div>
              <div className="tmpl-link-row">
                <span className="tmpl-link-label">Android</span>
                <input
                  {...linkFieldProps("schemeAndroid")}
                  className="form-control"
                  style={{ fontSize: 12 }}
                  placeholder="앱 스킴 (예: myapp://...)"
                  value={action.schemeAndroid}
                  onChange={(event) => handleLinkFieldChange("schemeAndroid", event.target.value, event.currentTarget)}
                />
              </div>
              <p className="tmpl-app-link-hint">Mobile / iOS / Android 중 2개 이상 필수입니다.</p>
            </>
          ) : null}
        </div>
      ) : null}
      {isCall ? (
        <div className="tmpl-action-card-body">
          <div className="tmpl-link-row">
            <span className="tmpl-link-label">전화번호<span className="tmpl-link-required">*</span></span>
            <input className="form-control" style={{ fontSize: 12 }} placeholder="010-0000-0000 또는 #{변수}" value={action.telNumber} onChange={(event) => onChange({ ...action, telNumber: event.target.value })} />
          </div>
          <p style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 3 }}>버튼명: 전화 연결 / 고객센터 연결 / 상담원 연결 중 선택</p>
        </div>
      ) : null}
      {isBizForm ? (
        <div className="tmpl-action-card-body">
          <div className="tmpl-link-row">
            <span className="tmpl-link-label">폼 ID<span className="tmpl-link-required">*</span></span>
            <input className="form-control" style={{ fontSize: 12 }} placeholder="비즈니스폼 ID" value={action.bizFormId} onChange={(event) => onChange({ ...action, bizFormId: event.target.value })} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TooltipIcon({
  tip,
  onShow,
  onHide,
}: {
  tip: string;
  onShow: (text: string, target: HTMLElement) => void;
  onHide: () => void;
}) {
  return (
    <span className="tmpl-tooltip-wrap">
      <span
        className="tmpl-tooltip-icon"
        onMouseEnter={(event) => onShow(tip, event.currentTarget)}
        onMouseLeave={onHide}
        onFocus={(event) => onShow(tip, event.currentTarget)}
        onBlur={onHide}
        tabIndex={0}
      >
        ?
      </span>
    </span>
  );
}

function renderTemplateBodyTokenLayer(body: string) {
  if (!body) {
    return null;
  }

  const nodes = [];
  const tokenPattern = /#\{([^}]+)\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(body)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(body.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = match[1]?.trim() || "";
    nodes.push(
      <span
        key={`${match.index}-${token}`}
        className="tmpl-body-token-highlight"
        data-template-body-token={key}
        data-template-body-token-id={`${match.index}:${token}`}
      >
        {token}
      </span>
    );
    lastIndex = match.index + token.length;
  }

  if (lastIndex < body.length) {
    nodes.push(body.slice(lastIndex));
  }

  return nodes;
}

function clampTextPosition(position: number, maxLength: number) {
  return Math.min(Math.max(position, 0), maxLength);
}

function actionVariableTargetKey(kind: "button" | "quickReply", index: number, field: KakaoTemplateLinkField) {
  return `${kind}:${index}:${field}`;
}

function formatVariableTooltip(key: string, variable?: EventTemplateVariable) {
  return variable?.label || key;
}

function buildInitialKakaoTemplateDraft(
  registrationTargets: V2KakaoTemplateRegistrationTarget[],
  categories: V2KakaoTemplateCategoryGroup[],
  sourceEvent: V2PublEventItem | null,
  initialTemplate: V2KakaoTemplateDetailResponse["template"] | null,
  initialDraft: V2KakaoTemplateDraftItem | null,
  mode: "create" | "edit"
) {
  const isEditMode = mode === "edit" && Boolean(initialTemplate);
  const isDraftMode = !isEditMode && Boolean(initialDraft);
  const categoryCode = isEditMode ? initialTemplate?.categoryCode ?? "" : isDraftMode ? initialDraft?.categoryCode ?? "" : "";
  const targetId = isEditMode
    ? resolveTemplateTargetId(registrationTargets, initialTemplate)
    : isDraftMode
      ? resolveDraftTargetId(registrationTargets, initialDraft)
      : registrationTargets[0]?.id ?? "";
  const selectedTarget = registrationTargets.find((item) => item.id === targetId) ?? registrationTargets[0] ?? null;
  const templateCode = isEditMode
    ? initialTemplate?.templateCode || initialTemplate?.kakaoTemplateCode || ""
    : isDraftMode
      ? initialDraft?.templateCode ?? ""
      : sourceEvent
        ? suggestTemplateCode(sourceEvent.eventKey)
        : "";
  const name = isEditMode ? initialTemplate?.name ?? "" : isDraftMode ? initialDraft?.name ?? "" : sourceEvent ? `${sourceEvent.displayName} 알림톡` : "";
  const messageType = isDraftMode ? toKakaoMessageType(initialDraft?.messageType) : toKakaoMessageType(initialTemplate?.messageType);
  const emphasizeType = isDraftMode ? toKakaoEmphasizeType(initialDraft?.emphasizeType) : toKakaoEmphasizeType(initialTemplate?.emphasizeType);
  const buttons = isEditMode
    ? normalizeTemplateActions(initialTemplate?.buttons ?? [])
    : isDraftMode
      ? normalizeDraftTemplateActions(initialDraft?.buttons ?? [])
      : [];
  const quickReplies = isEditMode
    ? normalizeTemplateActions(initialTemplate?.quickReplies ?? [])
    : isDraftMode
      ? normalizeDraftTemplateActions(initialDraft?.quickReplies ?? [])
      : [];
  const result = {
    draftTemplateId: isDraftMode ? initialDraft?.id ?? "" : "",
    targetId,
    templateCode,
    name,
    messageType,
    emphasizeType,
    title: isEditMode ? initialTemplate?.title ?? "" : isDraftMode ? initialDraft?.title ?? "" : "",
    subtitle: isEditMode ? initialTemplate?.subtitle ?? "" : isDraftMode ? initialDraft?.subtitle ?? "" : "",
    body: isEditMode ? initialTemplate?.body ?? "" : isDraftMode ? initialDraft?.body ?? "" : sourceEvent?.defaultTemplateBody ?? "",
    extra: isEditMode ? initialTemplate?.extra ?? "" : isDraftMode ? initialDraft?.extra ?? "" : "",
    securityFlag: isEditMode ? Boolean(initialTemplate?.securityFlag) : isDraftMode ? Boolean(initialDraft?.securityFlag) : false,
    categoryGroupName: findCategoryGroupNameByCode(categories, categoryCode),
    categoryCode,
    buttons,
    quickReplies,
    comment: isEditMode ? initialTemplate?.comment ?? "" : isDraftMode ? initialDraft?.comment ?? "" : "",
    imageName: isEditMode ? initialTemplate?.imageName ?? "" : isDraftMode ? initialDraft?.imageName ?? "" : "",
    imageUrl: isEditMode ? initialTemplate?.imageUrl ?? "" : isDraftMode ? initialDraft?.imageUrl ?? "" : "",
  };

  return {
    ...result,
    payload: {
      draftTemplateId: result.draftTemplateId || undefined,
      targetType: selectedTarget?.type || initialDraft?.targetType || undefined,
      targetId: selectedTarget?.id || result.targetId || initialDraft?.targetId || undefined,
      senderProfileId: selectedTarget?.senderProfileId || initialDraft?.senderProfileId || undefined,
      templateCode: result.templateCode || undefined,
      name: result.name || undefined,
      body: result.body,
      messageType: result.messageType,
      emphasizeType: result.emphasizeType,
      extra: result.extra,
      title: result.title,
      subtitle: result.subtitle,
      imageName: result.imageName || undefined,
      imageUrl: result.imageUrl || undefined,
      categoryCode: result.categoryCode || undefined,
      securityFlag: result.securityFlag,
      buttons: result.buttons.map((action, index) => serializeDraftAction(action, index)),
      quickReplies: result.quickReplies.map((action, index) => serializeDraftAction(action, index)),
      comment: result.comment,
      sourceEventKey: sourceEvent?.eventKey || initialDraft?.sourceEventKey || undefined,
    } satisfies V2SaveKakaoTemplateDraftPayload,
  };
}

function resolveTemplateTargetId(
  registrationTargets: V2KakaoTemplateRegistrationTarget[],
  template: V2KakaoTemplateDetailResponse["template"] | null
) {
  if (!template) {
    return registrationTargets[0]?.id ?? "";
  }

  return (
    registrationTargets.find((target) =>
      target.senderKey === template.senderKey ||
      target.senderKey === template.ownerKey ||
      target.id === template.ownerKey
    )?.id ??
    registrationTargets[0]?.id ??
    ""
  );
}

function resolveDraftTargetId(
  registrationTargets: V2KakaoTemplateRegistrationTarget[],
  draft: V2KakaoTemplateDraftItem | null
) {
  if (!draft) {
    return registrationTargets[0]?.id ?? "";
  }

  return (
    registrationTargets.find((target) =>
      target.id === draft.targetId ||
      target.senderKey === draft.targetId ||
      target.senderProfileId === draft.senderProfileId
    )?.id ??
    registrationTargets[0]?.id ??
    draft.targetId ??
    ""
  );
}

function normalizeTemplateActions(
  actions: V2KakaoTemplateDetailResponse["template"]["buttons"] | V2KakaoTemplateDetailResponse["template"]["quickReplies"]
): KakaoTemplateAction[] {
  return [...actions]
    .sort((left, right) => (left.ordering ?? 0) - (right.ordering ?? 0))
    .map((action) => ({
      type: action.type ?? "",
      name: action.name ?? "",
      linkMo: action.linkMo ?? "",
      linkPc: action.linkPc ?? "",
      schemeIos: action.schemeIos ?? "",
      schemeAndroid: action.schemeAndroid ?? "",
      bizFormId: action.bizFormId ? String(action.bizFormId) : "",
      pluginId: action.pluginId ?? "",
      telNumber: "telNumber" in action ? action.telNumber ?? "" : "",
    }));
}

function normalizeDraftTemplateActions(actions: V2KakaoTemplateDraftItem["buttons"] | V2KakaoTemplateDraftItem["quickReplies"]): KakaoTemplateAction[] {
  return [...actions]
    .sort((left, right) => (left.ordering ?? 0) - (right.ordering ?? 0))
    .map((action) => ({
      type: action.type ?? "",
      name: action.name ?? "",
      linkMo: action.linkMo ?? "",
      linkPc: action.linkPc ?? "",
      schemeIos: action.schemeIos ?? "",
      schemeAndroid: action.schemeAndroid ?? "",
      bizFormId: action.bizFormId ? String(action.bizFormId) : "",
      pluginId: action.pluginId ?? "",
      telNumber: action.telNumber ?? "",
    }));
}

function toKakaoMessageType(value?: string | null): KakaoTemplateMessageType {
  if (value === "BA" || value === "AD" || value === "EX" || value === "MI") {
    return value;
  }

  return "AD";
}

function toKakaoEmphasizeType(value?: string | null): KakaoTemplateEmphasizeType {
  if (value === "NONE" || value === "TEXT" || value === "IMAGE") {
    return value;
  }

  return "NONE";
}

function findCategoryGroupNameByCode(categories: V2KakaoTemplateCategoryGroup[], code: string) {
  if (!code) {
    return "";
  }

  return categories.find((group) => group.subCategories.some((item) => item.code === code))?.name ?? "";
}

function currentCategorySubCategories(categories: V2KakaoTemplateCategoryGroup[], groupName: string) {
  return categories.find((group) => group.name === groupName)?.subCategories ?? [];
}

function registrationTargetLabel(item: V2KakaoTemplateRegistrationTarget) {
  return item.type === "GROUP"
    ? `${item.label} (PUBL 공용 그룹)`
    : `${item.label} (${item.senderProfileType === "GROUP" ? "그룹 채널" : "브랜드 채널"})`;
}

function previewAvatarLabel(target: V2KakaoTemplateRegistrationTarget | null) {
  const source = target?.label?.replace(/^@/, "").trim() || "A";
  return source.slice(0, 1).toUpperCase();
}

function messageTypeLabel(messageType: KakaoTemplateMessageType) {
  return MESSAGE_TYPE_LABELS[messageType];
}

function buildEventTemplateVariables(props: V2PublEventProp[]) {
  const all = new Map<string, EventTemplateVariable>();

  const addVariable = (key: string | null | undefined, prop: V2PublEventProp) => {
    const normalizedKey = key?.trim();
    if (!normalizedKey) {
      return;
    }

    all.set(normalizedKey, {
      key: normalizedKey,
      label: prop.label || prop.alias || normalizedKey,
      rawPath: prop.rawPath,
      sample: prop.sample,
      required: prop.required,
      type: prop.type || "text",
    });
  };

  for (const prop of props) {
    if (!prop.enabled) {
      continue;
    }

    addVariable(prop.alias || prop.labelVariable || labelToVariable(prop.label), prop);
  }

  return Array.from(all.values()).sort((a, b) => Number(b.required) - Number(a.required) || a.key.localeCompare(b.key));
}

function buildTemplateBodyPlaceholder(sourceEvent: V2PublEventItem | null, variables: EventTemplateVariable[]) {
  if (!sourceEvent) {
    return "#{이름}님의 주문이 완료되었습니다.\n\n주문번호: #{주문번호}\n결제금액: #{금액}원";
  }

  const selectedVariables = variables.filter((variable) => variable.required).slice(0, 4);
  const fallbackVariables = selectedVariables.length > 0 ? selectedVariables : variables.slice(0, 4);
  const variableLines = fallbackVariables.map((variable) => `${variable.label}: #{${variable.key}}`);

  return [
    `${sourceEvent.displayName} 안내입니다.`,
    ...(variableLines.length > 0 ? ["", ...variableLines] : []),
  ].join("\n");
}

function labelToVariable(label: string) {
  return label.replace(/\s+/g, "").trim();
}

function suggestTemplateCode(eventKey: string) {
  return eventKey
    .replace(/[^A-Za-z0-9_]/g, "_")
    .split("_")
    .filter(Boolean)
    .slice(-4)
    .join("_")
    .slice(0, 20);
}

function publEventStatusText(status: string) {
  if (status === "ACTIVE") return "활성";
  if (status === "INACTIVE") return "비활성";
  if (status === "DRAFT") return "초안";
  return status;
}

function createChannelAddAction(): KakaoTemplateAction {
  return {
    ...EMPTY_ACTION(),
    type: "AC",
    name: "채널 추가",
  };
}

function requiresChannelAddButtonForMessageType(messageType: KakaoTemplateMessageType) {
  return messageType === "AD" || messageType === "MI";
}

function findChannelAddButtonIndex(actions: KakaoTemplateAction[]) {
  return actions.findIndex((action) => action.type === "AC");
}

function moveChannelAddButtonToFront(actions: KakaoTemplateAction[]) {
  const index = findChannelAddButtonIndex(actions);
  if (index <= 0) {
    return actions;
  }

  const next = [...actions];
  const [channelAddAction] = next.splice(index, 1);
  next.unshift(channelAddAction);
  return next;
}

function buildChannelAddMissingMessage(messageType: KakaoTemplateMessageType, buttonLimitReached = false) {
  return [
    `현재 선택한 메시지 유형은 ${messageTypeLabel(messageType)}입니다.`,
    "이 유형은 버튼에 '채널 추가'가 꼭 필요합니다.",
    buttonLimitReached
      ? "해결 방법: 버튼 수를 줄인 뒤 '채널 추가' 버튼을 추가해 주세요."
      : "해결 방법: 버튼 -> 버튼 추가 -> 타입을 '채널 추가'로 선택해 주세요.",
  ].join("\n");
}

function buildChannelAddOrderMessage() {
  return [
    "'채널 추가' 버튼은 첫 번째 버튼이어야 합니다.",
    "해결 방법: 현재는 순서 변경 기능이 없어서, 다른 버튼을 지운 뒤 '채널 추가' 버튼을 먼저 추가해 주세요.",
  ].join("\n");
}

function buildChannelAddTypeMismatchMessage(messageType: KakaoTemplateMessageType) {
  return [
    `'채널 추가' 버튼은 채널 추가형 또는 복합형에서만 사용할 수 있습니다.`,
    `현재 선택한 메시지 유형: ${messageTypeLabel(messageType)}`,
    "해결 방법: 메시지 유형을 채널 추가형/복합형으로 바꾸거나, '채널 추가' 버튼을 삭제해 주세요.",
  ].join("\n");
}

function describeTemplateCreateError(
  message: string,
  context: {
    messageType: KakaoTemplateMessageType;
    emphasizeType: KakaoTemplateEmphasizeType;
    buttons: KakaoTemplateAction[];
  }
) {
  const normalized = message.trim();
  const code = normalized.match(/^\[(-?\d+)\]/)?.[1];

  switch (code) {
    case "-3050":
      return `[-3050] ${
        findChannelAddButtonIndex(context.buttons) > 0
          ? buildChannelAddOrderMessage()
          : buildChannelAddMissingMessage(context.messageType)
      }`;
    case "-3025":
      return `[-3025] ${buildChannelAddOrderMessage()}`;
    case "-3024":
      return `[-3024] ${buildChannelAddTypeMismatchMessage(context.messageType)}`;
    case "-3016":
      return [
        "[-3016] 강조 유형이 텍스트형이면 강조 제목과 강조 부제목이 모두 필요합니다.",
        "해결 방법: 강조 제목과 강조 부제목을 모두 입력하거나, 강조 유형을 '선택 안 함'으로 바꿔 주세요.",
      ].join("\n");
    case "-3018":
      return [
        "[-3018] 현재 선택한 메시지 유형은 부가 정보형입니다.",
        "해결 방법: '부가 정보' 칸을 입력해 주세요.",
      ].join("\n");
    case "-3020":
      return [
        "[-3020] 현재 선택한 메시지 유형은 복합형입니다.",
        "해결 방법: '부가 정보' 칸을 입력해 주세요.",
      ].join("\n");
    case "-3030":
      return [
        "[-3030] 채널 추가형에는 부가 정보를 함께 넣을 수 없습니다.",
        "해결 방법: 부가 정보를 쓰려면 메시지 유형을 복합형으로 바꾸고, 채널 추가형으로 유지하려면 부가 정보를 비워 주세요.",
      ].join("\n");
    case "-3032":
      return [
        "[-3032] 이미지형은 템플릿 이미지를 먼저 업로드해야 합니다.",
        context.emphasizeType === "IMAGE"
          ? "해결 방법: 이미지 업로드 버튼으로 이미지를 올린 뒤 다시 요청해 주세요."
          : "해결 방법: 강조 유형을 '이미지형'으로 두지 않거나, 이미지를 업로드해 주세요.",
      ].join("\n");
    case "-3001":
      return [
        "[-3001] 같은 템플릿 코드 또는 이름이 이미 있습니다.",
        "해결 방법: 템플릿 코드와 템플릿 이름을 모두 다른 값으로 바꿔 다시 등록해 주세요.",
      ].join("\n");
    default:
      return normalized;
  }
}

function serializeAction(action: KakaoTemplateAction) {
  const payload = {
    type: action.type,
    ...(trimOrUndefined(action.name) ? { name: action.name.trim() } : {}),
    ...(trimOrUndefined(action.linkMo) ? { linkMo: action.linkMo.trim() } : {}),
    ...(trimOrUndefined(action.linkPc) ? { linkPc: action.linkPc.trim() } : {}),
    ...(trimOrUndefined(action.schemeIos) ? { schemeIos: action.schemeIos.trim() } : {}),
    ...(trimOrUndefined(action.schemeAndroid) ? { schemeAndroid: action.schemeAndroid.trim() } : {}),
    ...(trimOrUndefined(action.pluginId) ? { pluginId: action.pluginId.trim() } : {}),
    ...(trimOrUndefined(action.telNumber) ? { telNumber: action.telNumber.trim() } : {}),
    ...(trimOrUndefined(action.bizFormId) ? { bizFormId: Number(action.bizFormId) } : {}),
  };

  return Object.keys(payload).length > 1 ? payload : null;
}

function serializeDraftAction(action: KakaoTemplateAction, index: number) {
  return {
    ordering: index + 1,
    type: action.type,
    name: action.name,
    linkMo: action.linkMo,
    linkPc: action.linkPc,
    schemeIos: action.schemeIos,
    schemeAndroid: action.schemeAndroid,
    pluginId: action.pluginId,
    telNumber: action.telNumber,
    ...(trimOrUndefined(action.bizFormId) ? { bizFormId: Number(action.bizFormId) } : {}),
  };
}

function serializeDraftPayload(payload: V2SaveKakaoTemplateDraftPayload) {
  return JSON.stringify(sortDraftPayloadValue(payload));
}

function sortDraftPayloadValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortDraftPayloadValue);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nestedValue]) => [key, sortDraftPayloadValue(nestedValue)])
  );
}

function serializeQuickReply(action: KakaoTemplateAction) {
  const payload = {
    type: action.type,
    ...(trimOrUndefined(action.name) ? { name: action.name.trim() } : {}),
    ...(trimOrUndefined(action.linkMo) ? { linkMo: action.linkMo.trim() } : {}),
    ...(trimOrUndefined(action.linkPc) ? { linkPc: action.linkPc.trim() } : {}),
    ...(trimOrUndefined(action.schemeIos) ? { schemeIos: action.schemeIos.trim() } : {}),
    ...(trimOrUndefined(action.schemeAndroid) ? { schemeAndroid: action.schemeAndroid.trim() } : {}),
    ...(trimOrUndefined(action.pluginId) ? { pluginId: action.pluginId.trim() } : {}),
    ...(trimOrUndefined(action.bizFormId) ? { bizFormId: Number(action.bizFormId) } : {}),
  };

  return Object.keys(payload).length > 1 ? payload : null;
}

function trimOrUndefined(value: string) {
  return value.trim() || undefined;
}
