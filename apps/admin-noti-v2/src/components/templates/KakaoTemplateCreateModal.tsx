"use client";

import { useEffectEvent, useId, useState } from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import {
  createV2KakaoTemplate,
  uploadV2KakaoTemplateImage,
  type V2CreateKakaoTemplatePayload,
  type V2CreateKakaoTemplateResponse,
  type V2KakaoTemplateCategoryGroup,
  type V2KakaoTemplateRegistrationTarget,
} from "@/lib/api/v2";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";

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

type TooltipState = {
  text: string;
  top: number;
  left: number;
  dir: "up" | "down";
} | null;

type KakaoTemplateCreateModalProps = {
  open: boolean;
  registrationTargets: V2KakaoTemplateRegistrationTarget[];
  categories: V2KakaoTemplateCategoryGroup[];
  onClose: () => void;
  onCreated: (response: V2CreateKakaoTemplateResponse) => void;
};

const MSG_TYPE_LABELS: Record<string, string> = {
  AD: "채널 추가형",
  BA: "기본형",
  EX: "부가 정보형",
  MI: "복합형",
};

const EMPHASIZE_LABELS: Record<string, string> = {
  NONE: "없음",
  TEXT: "강조 표기형",
  IMAGE: "이미지형",
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
  type: "WL",
  name: "",
  linkMo: "",
  linkPc: "",
  schemeIos: "",
  schemeAndroid: "",
  bizFormId: "",
  pluginId: "",
  telNumber: "",
});

export function KakaoTemplateCreateModal({
  open,
  registrationTargets,
  categories,
  onClose,
  onCreated,
}: KakaoTemplateCreateModalProps) {
  const imageInputId = useId();
  const [targetId, setTargetId] = useState(() => registrationTargets[0]?.id ?? "");
  const [templateCode, setTemplateCode] = useState("");
  const [name, setName] = useState("");
  const [messageType, setMessageType] = useState<"AD" | "BA" | "EX" | "MI">("AD");
  const [emphasizeType, setEmphasizeType] = useState<"NONE" | "TEXT" | "IMAGE">("NONE");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [body, setBody] = useState("");
  const [extra, setExtra] = useState("");
  const [securityFlag, setSecurityFlag] = useState(false);
  const [categoryGroupName, setCategoryGroupName] = useState("");
  const [categoryCode, setCategoryCode] = useState("");
  const [buttons, setButtons] = useState<KakaoTemplateAction[]>([]);
  const [quickReplies, setQuickReplies] = useState<KakaoTemplateAction[]>([]);
  const [comment, setComment] = useState("");
  const [imageName, setImageName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [flashError, setFlashError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [tooltip, setTooltip] = useState<TooltipState>(null);

  const handleEscape = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape" && !submitting && !imageUploading) {
      onClose();
    }
  });

  useMountEffect(() => {
    const onKeydown = (event: KeyboardEvent) => handleEscape(event);
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

  const handleBackdropClick = () => {
    if (submitting || imageUploading) {
      return;
    }

    onClose();
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

  const handleImageUpload = async (file: File | null) => {
    if (!file) {
      return;
    }

    setImageUploading(true);
    setFlashError(null);

    try {
      const uploaded = await uploadV2KakaoTemplateImage(file);
      setImageName(uploaded.templateImageName);
      setImageUrl(uploaded.templateImageUrl);
    } catch (error) {
      setFlashError(error instanceof Error ? error.message : "이미지 업로드에 실패했습니다.");
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

    for (const action of buttons) {
      if (!action.name.trim()) {
        pushFlashError("버튼 이름을 입력해주세요.");
        break;
      }
      if (action.type === "WL" && !action.linkMo.trim()) {
        pushFlashError(`버튼 "${action.name || "웹 링크"}"의 Mobile URL을 입력해주세요.`);
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
        if (!action.name.trim()) {
          pushFlashError("바로연결 이름을 입력해주세요.");
          break;
        }
        if (action.type === "WL" && !action.linkMo.trim()) {
          pushFlashError(`바로연결 "${action.name || "웹 링크"}"의 Mobile URL을 입력해주세요.`);
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
      targetType: selectedTarget.type,
      senderProfileId: selectedTarget.senderProfileId ?? undefined,
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
      const response = await createV2KakaoTemplate(payload);
      onCreated(response);
    } catch (error) {
      setFlashError(error instanceof Error ? error.message : "알림톡 템플릿 검수 요청에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const showTooltip = (text: string, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    const tooltipWidth = 240;
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - tooltipWidth / 2, 12),
      window.innerWidth - tooltipWidth - 12
    );
    const dir = rect.top > window.innerHeight / 2 ? "up" : "down";
    const top = dir === "up" ? rect.top - 84 : rect.bottom + 10;
    setTooltip({ text, top, left, dir });
  };

  return (
    <div className="modal-backdrop open" onClick={handleBackdropClick}>
      <div className="modal modal-xl" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header" style={{ padding: "14px 20px" }}>
          <div className="modal-title">
            <AppIcon name="kakao" className="icon icon-18" style={{ color: "#c9a700" }} />
            알림톡 템플릿 만들기
          </div>
          <button className="modal-close" onClick={handleBackdropClick}>
            <AppIcon name="x" className="icon icon-18" />
          </button>
        </div>

        <div className="modal-body">
          <div className="tmpl-form-col">
            {flashError ? (
              <div className="flash flash-attention" style={{ margin: "0 0 12px" }}>
                <AppIcon name="warn" className="icon icon-16 flash-icon" />
                <div className="flash-body">{flashError}</div>
              </div>
            ) : null}

            <div className="form-group">
              <label className="form-label">발신 프로필 <span style={{ color: "var(--danger-fg)" }}>*</span></label>
              <select className="form-control" style={{ maxWidth: 300 }} value={selectedTargetId} onChange={(event) => setTargetId(event.target.value)} disabled={submitting}>
                {registrationTargets.map((item) => (
                  <option key={item.id} value={item.id}>
                    {registrationTargetLabel(item)}
                  </option>
                ))}
              </select>
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
                  disabled={submitting}
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
                    tip="• 기본형: 일반 정보성 메시지\n• 채널 추가형: 하단에 채널 추가 버튼 자동 포함\n• 부가 정보형: 본문 아래 추가 안내 영역 제공\n• 복합형: 채널 추가 + 부가 정보 모두 포함"
                    onShow={showTooltip}
                    onHide={() => setTooltip(null)}
                  />
                </label>
                <select className="form-control" value={messageType} onChange={(event) => setMessageType(event.target.value as "BA" | "AD" | "EX" | "MI")} disabled={submitting}>
                  <option value="AD">채널 추가형</option>
                  <option value="BA">기본형</option>
                  <option value="EX">부가 정보형</option>
                  <option value="MI">복합형</option>
                </select>
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
                <select className="form-control" value={emphasizeType} onChange={(event) => setEmphasizeType(event.target.value as "NONE" | "TEXT" | "IMAGE")} disabled={submitting}>
                  <option value="NONE">선택 안 함</option>
                  <option value="TEXT">강조 표기형</option>
                  <option value="IMAGE">이미지형</option>
                </select>
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
                    {imageUploading ? "업로드 중..." : "이미지 업로드"}
                  </label>
                  <input
                    id={imageInputId}
                    type="file"
                    accept="image/png,image/jpeg"
                    style={{ display: "none" }}
                    onChange={(event) => handleImageUpload(event.target.files?.[0] ?? null)}
                    disabled={imageUploading || submitting}
                  />
                  <p className="form-hint" style={{ marginTop: 4 }}>JPEG/PNG · 800×400px 권장 · 500KB 이하</p>
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
              <textarea
                className={`form-control${fieldErrors.body ? " tmpl-input-error" : body.trim() ? " tmpl-input-ok" : ""}`}
                rows={5}
                style={{ resize: "vertical" }}
                placeholder={"#{이름}님의 주문이 완료되었습니다.\n\n주문번호: #{주문번호}\n결제금액: #{금액}원"}
                maxLength={1300}
                value={body}
                onChange={(event) => {
                  setBody(event.target.value);
                  setFieldErrors((current) => ({ ...current, body: "" }));
                }}
                disabled={submitting}
              />
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
                <select className="form-control" value={String(securityFlag)} onChange={(event) => setSecurityFlag(event.target.value === "true")} disabled={submitting}>
                  <option value="false">미설정</option>
                  <option value="true">설정 (OTP 등 보안 메시지)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">
                  카테고리 <span style={{ color: "var(--danger-fg)" }}>*</span>
                  <TooltipIcon tip="기타 선택 시 검수 우선순위가 최하로 처리됩니다.\n템플릿 내용에 맞는 카테고리를 선택해주세요." onShow={showTooltip} onHide={() => setTooltip(null)} />
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <select className={`form-control${fieldErrors.category ? " tmpl-input-error" : ""}`} value={resolvedCategoryGroupName} onChange={(event) => handleCategoryGroupChange(event.target.value)} disabled={submitting}>
                    <option value="">대분류 선택</option>
                    {categories.map((group) => (
                      <option key={group.name || "none"} value={group.name || ""}>
                        {group.name || "이름 없는 분류"}
                      </option>
                    ))}
                  </select>
                  <select className={`form-control${fieldErrors.category ? " tmpl-input-error" : ""}`} value={resolvedCategoryCode} onChange={(event) => { setCategoryCode(event.target.value); setFieldErrors((current) => ({ ...current, category: "" })); }} disabled={submitting || !resolvedCategoryGroupName}>
                    <option value="">중분류 선택</option>
                    {subCategories.map((item) => (
                      <option key={item.code || item.name} value={item.code || ""}>
                        {item.name || item.code || "이름 없는 카테고리"}
                      </option>
                    ))}
                  </select>
                  <div className={`tmpl-field-error${fieldErrors.category ? " show" : ""}`}>{fieldErrors.category || "카테고리를 선택해주세요."}</div>
                </div>
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <label className="form-label" style={{ margin: 0, display: "flex", alignItems: "center", gap: 4 }}>
                  버튼
                  <TooltipIcon tip="최대 5개까지 추가 가능합니다.\n바로연결과 혼용 시 버튼은 최대 2개입니다.\n\n• 웹 링크: Mobile URL 필수\n• 앱 링크: Mobile/iOS/Android 중 2개 이상 필수\n• 전화하기: 버튼명은 전화 연결/고객센터 연결/상담원 연결 중 선택" onShow={showTooltip} onHide={() => setTooltip(null)} />
                </label>
                <div className="tmpl-add-actions">
                  <span className={`tmpl-add-status${buttonAddMessage ? " show" : ""}`}>{buttonAddMessage}</span>
                  <button className="btn btn-default btn-sm" onClick={() => setButtons((current) => (buttonAddDisabled ? current : [...current, EMPTY_ACTION()]))} disabled={buttonAddDisabled || submitting} type="button">
                    <AppIcon name="plus" className="icon icon-12" /> 버튼 추가
                  </button>
                </div>
              </div>
              {buttons.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--fg-muted)", padding: "6px 0 2px" }}>버튼이 없습니다.</div>
              ) : (
                buttons.map((action, index) => (
                  <ActionCard
                    key={`button-${index}`}
                    index={index}
                    action={action}
                    typeOptions={BUTTON_TYPES}
                    onChange={(next) => setButtons((current) => current.map((item, itemIndex) => (itemIndex === index ? next : item)))}
                    onDelete={() => setButtons((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    onShowTooltip={showTooltip}
                    onHideTooltip={() => setTooltip(null)}
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
                    onShowTooltip={showTooltip}
                    onHideTooltip={() => setTooltip(null)}
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
            <span className="tmpl-preview-label">실시간 미리보기</span>

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

            <div style={{ width: "100%", background: "var(--canvas-default)", border: "1px solid var(--border-muted)", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: "var(--fg-muted)", marginBottom: 4 }}>메시지 유형</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-default)", marginBottom: 8 }}>{MSG_TYPE_LABELS[messageType] || messageType}</div>
              <div style={{ fontSize: 11, color: "var(--fg-muted)", marginBottom: 4 }}>강조 유형</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-default)", marginBottom: 8 }}>{EMPHASIZE_LABELS[emphasizeType] || emphasizeType}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px solid var(--border-subtle)" }}>
                <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>본문 글자 수</span>
                <span style={{ fontSize: 12, fontFamily: "ui-monospace,monospace", fontWeight: 600 }}>본문 {body.length}자</span>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "var(--fg-muted)", display: "flex", alignItems: "center", gap: 5 }}>
            <AppIcon name="info" className="icon icon-12" style={{ color: "var(--attention-fg)" }} />
            제출 후 카카오 검수 절차 진행 (영업일 1–3일)
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-default" onClick={handleBackdropClick} disabled={submitting || imageUploading}>취소</button>
            <button className="btn btn-kakao" onClick={handleSubmit} disabled={submitting || imageUploading || !selectedTarget}>
              <AppIcon name="send" className="icon icon-14" /> {submitting ? "요청 중..." : "검수 요청"}
            </button>
          </div>
        </div>

        <div id="tmpl-floating-tip" className={tooltip ? "show" : ""} data-dir={tooltip?.dir ?? "down"} style={tooltip ? { top: tooltip.top, left: tooltip.left } : undefined}>
          {tooltip?.text || ""}
        </div>
      </div>
    </div>
  );
}

function ActionCard({
  index,
  action,
  typeOptions,
  onChange,
  onDelete,
  onShowTooltip,
  onHideTooltip,
}: {
  index: number;
  action: KakaoTemplateAction;
  typeOptions: Array<{ value: string; label: string }>;
  onChange: (next: KakaoTemplateAction) => void;
  onDelete: () => void;
  onShowTooltip: (text: string, target: HTMLElement) => void;
  onHideTooltip: () => void;
}) {
  const isWebLink = action.type === "WL";
  const isAppLink = action.type === "AL";
  const isCall = action.type === "TN";
  const isBizForm = action.type === "BF";
  const showLinks = isWebLink || isAppLink;

  const handleTypeChange = (value: string) => {
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

  return (
    <div className="tmpl-action-card">
      <div className="tmpl-action-card-header">
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-muted)", background: "var(--canvas-subtle)", border: "1px solid var(--border-muted)", borderRadius: 20, padding: "1px 8px", flexShrink: 0 }}>{index + 1}</span>
        <select className="form-control" style={{ width: 138, fontSize: 12 }} value={action.type} onChange={(event) => handleTypeChange(event.target.value)}>
          {typeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <input className="form-control" style={{ flex: 1, fontSize: 12 }} placeholder="버튼 이름 (최대 14자)" maxLength={14} value={action.name} onChange={(event) => onChange({ ...action, name: event.target.value })} readOnly={action.type === "AC"} />
        <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-muted)", padding: 2, display: "flex", borderRadius: 4, flexShrink: 0 }} onMouseEnter={(event) => onShowTooltip("항목을 삭제합니다.", event.currentTarget)} onMouseLeave={onHideTooltip} onClick={onDelete} type="button">
          <AppIcon name="trash" className="icon icon-14" />
        </button>
      </div>
      {showLinks ? (
        <div className="tmpl-action-card-body">
          <div className="tmpl-link-row">
            <span className="tmpl-link-label">Mobile{isWebLink ? <span className="tmpl-link-required">*</span> : null}</span>
            <input className="form-control" style={{ fontSize: 12 }} placeholder="https://example.com" value={action.linkMo} onChange={(event) => onChange({ ...action, linkMo: event.target.value })} />
          </div>
          <div className="tmpl-link-row">
            <span className="tmpl-link-label">PC</span>
            <input className="form-control" style={{ fontSize: 12 }} placeholder="https://example.com (선택)" value={action.linkPc} onChange={(event) => onChange({ ...action, linkPc: event.target.value })} />
          </div>
          {isAppLink ? (
            <>
              <div className="tmpl-link-row">
                <span className="tmpl-link-label">iOS</span>
                <input className="form-control" style={{ fontSize: 12 }} placeholder="앱 스킴 (예: myapp://...)" value={action.schemeIos} onChange={(event) => onChange({ ...action, schemeIos: event.target.value })} />
              </div>
              <div className="tmpl-link-row">
                <span className="tmpl-link-label">Android</span>
                <input className="form-control" style={{ fontSize: 12 }} placeholder="앱 스킴 (예: myapp://...)" value={action.schemeAndroid} onChange={(event) => onChange({ ...action, schemeAndroid: event.target.value })} />
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

function currentCategorySubCategories(categories: V2KakaoTemplateCategoryGroup[], groupName: string) {
  return categories.find((group) => group.name === groupName)?.subCategories ?? [];
}

function registrationTargetLabel(item: V2KakaoTemplateRegistrationTarget) {
  return item.type === "DEFAULT_GROUP" ? `${item.label} (기본 그룹)` : `${item.label} (${item.senderProfileType === "GROUP" ? "그룹 채널" : "브랜드 채널"})`;
}

function previewAvatarLabel(target: V2KakaoTemplateRegistrationTarget | null) {
  const source = target?.label?.replace(/^@/, "").trim() || "A";
  return source.slice(0, 1).toUpperCase();
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
