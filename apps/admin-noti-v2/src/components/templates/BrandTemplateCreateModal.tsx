"use client";

import { useEffectEvent, useState } from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import { KakaoTemplateImageEditorModal } from "@/components/templates/KakaoTemplateImageEditorModal";
import { FormSelect } from "@/components/ui/FormSelect";
import {
  createV2BrandTemplate,
  updateV2BrandTemplate,
  uploadV2BrandTemplateImage,
  type V2BrandTemplateButton,
  type V2BrandTemplateCarouselHead,
  type V2BrandTemplateCarouselTail,
  type V2BrandTemplateCommerce,
  type V2BrandTemplateCoupon,
  type V2BrandTemplateImage,
  type V2BrandTemplateVideo,
  type V2BrandTemplateWideItem,
  type V2BrandTemplatesResponse,
  type V2CreateBrandTemplatePayload,
  type V2CreateBrandTemplateResponse,
  type V2UpdateBrandTemplateResponse,
} from "@/lib/api/v2";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";
import type { TemplateImageCropConfig } from "@/lib/image/template-image-editor";
import { BrandTemplatePreview } from "./BrandTemplatePreview";

type BrandTemplateType =
  | "TEXT"
  | "IMAGE"
  | "WIDE"
  | "WIDE_ITEM_LIST"
  | "PREMIUM_VIDEO"
  | "COMMERCE"
  | "CAROUSEL_FEED"
  | "CAROUSEL_COMMERCE";

type BrandButtonDraft = V2BrandTemplateButton & { id: string };
type WideItemDraft = V2BrandTemplateWideItem & { id: string; imageName?: string };
type CarouselItemDraft = {
  id: string;
  header?: string;
  message?: string;
  additionalContent?: string;
  imageUrl: string;
  imageName?: string;
  imageLink?: string;
  buttons: BrandButtonDraft[];
  coupon?: V2BrandTemplateCoupon | null;
  commerce?: V2BrandTemplateCommerce | null;
};

type BrandTemplateImageType =
  | "IMAGE"
  | "WIDE_IMAGE"
  | "MAIN_WIDE_ITEMLIST_IMAGE"
  | "NORMAL_WIDE_ITEMLIST_IMAGE"
  | "CAROUSEL_FEED_IMAGE"
  | "CAROUSEL_COMMERCE_IMAGE";

type BrandImageTarget =
  | { kind: "main-image" }
  | { kind: "wide-item"; itemId: string }
  | { kind: "carousel-item"; itemId: string };

type PendingBrandImageEditorState = {
  sourceUrl: string;
  fileName: string;
  imageType: BrandTemplateImageType;
  target: BrandImageTarget;
};

type BrandTemplateEditorDraft = {
  senderProfileId: string;
  templateName: string;
  chatBubbleType: BrandTemplateType;
  adult: boolean;
  content: string;
  header: string;
  additionalContent: string;
  image: (V2BrandTemplateImage & { imageName?: string }) | null;
  buttons: BrandButtonDraft[];
  wideItems: WideItemDraft[];
  couponEnabled: boolean;
  coupon: V2BrandTemplateCoupon;
  commerce: V2BrandTemplateCommerce;
  video: V2BrandTemplateVideo;
  carouselHead: V2BrandTemplateCarouselHead | null;
  carouselTail: V2BrandTemplateCarouselTail | null;
  carouselItems: CarouselItemDraft[];
};

type ValidationIssue = {
  key:
    | "senderProfileId"
    | "templateName"
    | "content"
    | "mainImage"
    | "header"
    | "wideItems"
    | "videoUrl"
    | "commerce"
    | "coupon"
    | "carousel";
  message: string;
  focusId?: string;
};

const BRAND_TEMPLATE_TYPES: Array<{ value: BrandTemplateType; label: string }> = [
  { value: "TEXT", label: "텍스트형" },
  { value: "IMAGE", label: "이미지형" },
  { value: "WIDE", label: "와이드 이미지형" },
  { value: "WIDE_ITEM_LIST", label: "와이드 아이템리스트형" },
  { value: "PREMIUM_VIDEO", label: "프리미엄 동영상형" },
  { value: "COMMERCE", label: "커머스형" },
  { value: "CAROUSEL_FEED", label: "캐러셀 피드형" },
  { value: "CAROUSEL_COMMERCE", label: "캐러셀 커머스형" },
];

const BRAND_BUTTON_TYPES = [
  { value: "WL", label: "웹 링크" },
  { value: "AL", label: "앱 링크" },
  { value: "BK", label: "봇 키워드" },
  { value: "MD", label: "메시지 전달" },
];

const EMPTY_COMMERCE: V2BrandTemplateCommerce = {
  title: "",
  regularPrice: undefined,
  discountPrice: undefined,
  discountRate: undefined,
  discountFixed: undefined,
};

const EMPTY_COUPON: V2BrandTemplateCoupon = {
  title: "",
  description: "",
  linkMo: "",
  linkPc: "",
  schemeAndroid: "",
  schemeIos: "",
};

const BRAND_IMAGE_CROP_CONFIGS: Record<BrandTemplateImageType, TemplateImageCropConfig> = {
  IMAGE: {
    viewport: { width: 520, height: 260 },
    output: { width: 800, height: 400 },
  },
  WIDE_IMAGE: {
    viewport: { width: 520, height: 390 },
    output: { width: 800, height: 600 },
  },
  MAIN_WIDE_ITEMLIST_IMAGE: {
    viewport: { width: 520, height: 260 },
    output: { width: 800, height: 400 },
  },
  NORMAL_WIDE_ITEMLIST_IMAGE: {
    viewport: { width: 360, height: 360 },
    output: { width: 800, height: 800 },
  },
  CAROUSEL_FEED_IMAGE: {
    viewport: { width: 520, height: 390 },
    output: { width: 800, height: 600 },
  },
  CAROUSEL_COMMERCE_IMAGE: {
    viewport: { width: 520, height: 390 },
    output: { width: 800, height: 600 },
  },
};

function createDraftId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createButtonDraft(): BrandButtonDraft {
  return {
    id: createDraftId("brand-btn"),
    type: "WL",
    name: "",
    linkMo: "",
    linkPc: "",
    schemeAndroid: "",
    schemeIos: "",
    chatExtra: "",
  };
}

function createButtonDraftForType(type: BrandButtonDraft["type"]): BrandButtonDraft {
  const next = {
    ...createButtonDraft(),
    type,
  };

  if (type === "BK") {
    next.name = "챗봇 연결";
  } else if (type === "MD") {
    next.name = "메시지 전달";
  }

  return next;
}

function brandButtonTypeLabel(type: BrandButtonDraft["type"]) {
  return BRAND_BUTTON_TYPES.find((option) => option.value === type)?.label ?? "새 버튼";
}

function createWideItemDraft(): WideItemDraft {
  return {
    id: createDraftId("wide-item"),
    title: "",
    imageUrl: "",
    imageName: "",
    linkMo: "",
    linkPc: "",
    schemeAndroid: "",
    schemeIos: "",
  };
}

function createCarouselItemDraft(type: BrandTemplateType): CarouselItemDraft {
  return {
    id: createDraftId("carousel-item"),
    header: "",
    message: "",
    additionalContent: "",
    imageUrl: "",
    imageName: "",
    imageLink: "",
    buttons: type === "CAROUSEL_FEED" ? [createButtonDraft()] : [],
    coupon: null,
    commerce: type === "CAROUSEL_COMMERCE" ? { ...EMPTY_COMMERCE } : null,
  };
}

function resolveBrandTemplateType(value: string | null | undefined): BrandTemplateType {
  if (
    value === "TEXT" ||
    value === "IMAGE" ||
    value === "WIDE" ||
    value === "WIDE_ITEM_LIST" ||
    value === "PREMIUM_VIDEO" ||
    value === "COMMERCE" ||
    value === "CAROUSEL_FEED" ||
    value === "CAROUSEL_COMMERCE"
  ) {
    return value;
  }

  return "TEXT";
}

function buildBrandTemplateEditorDraft(
  template: V2BrandTemplatesResponse["items"][number] | null | undefined,
  fallbackSenderProfileId: string,
): BrandTemplateEditorDraft {
  const chatBubbleType = resolveBrandTemplateType(template?.chatBubbleType);

  return {
    senderProfileId: template?.senderProfileId || fallbackSenderProfileId,
    templateName: template?.templateName || "",
    chatBubbleType,
    adult: Boolean(template?.adult),
    content: template?.content || "",
    header: template?.header || "",
    additionalContent: template?.additionalContent || "",
    image: template?.image
      ? {
          ...template.image,
          imageName: "",
        }
      : null,
    buttons: (template?.buttons ?? []).map((button) => ({
      ...button,
      id: createDraftId("brand-btn"),
    })),
    wideItems: (template?.item?.list ?? []).map((item) => ({
      ...item,
      id: createDraftId("wide-item"),
      imageName: "",
    })),
    couponEnabled: Boolean(
      template?.coupon?.title ||
        template?.coupon?.description ||
        template?.coupon?.linkMo ||
        template?.coupon?.linkPc ||
        template?.coupon?.schemeAndroid ||
        template?.coupon?.schemeIos,
    ),
    coupon: template?.coupon
      ? { ...template.coupon }
      : { ...EMPTY_COUPON },
    commerce: template?.commerce
      ? { ...template.commerce }
      : { ...EMPTY_COMMERCE },
    video: template?.video
      ? { ...template.video }
      : { videoUrl: "", thumbnailUrl: "" },
    carouselHead: template?.carousel?.head ? { ...template.carousel.head } : null,
    carouselTail: template?.carousel?.tail ? { ...template.carousel.tail } : null,
    carouselItems: (template?.carousel?.list ?? []).map((item) => ({
      id: createDraftId("carousel-item"),
      header: item.header || "",
      message: item.message || "",
      additionalContent: item.additionalContent || "",
      imageUrl: item.imageUrl,
      imageName: "",
      imageLink: item.imageLink || "",
      buttons: (item.buttons ?? []).map((button) => ({
        ...button,
        id: createDraftId("brand-btn"),
      })),
      coupon: item.coupon ? { ...item.coupon } : null,
      commerce: item.commerce ? { ...item.commerce } : null,
    })),
  };
}

function getBrandImageTargetKey(target: BrandImageTarget) {
  switch (target.kind) {
    case "main-image":
      return "main-image";
    case "wide-item":
      return target.itemId;
    case "carousel-item":
      return target.itemId;
  }
}

function getBrandImageCropConfig(imageType: BrandTemplateImageType) {
  return BRAND_IMAGE_CROP_CONFIGS[imageType];
}

function getBrandImageEditorCopy(imageType: BrandTemplateImageType) {
  switch (imageType) {
    case "WIDE_IMAGE":
      return "와이드 이미지는 4:3 프레임에 맞춰 저장됩니다. 잘린 결과가 템플릿 대표 이미지로 사용됩니다.";
    case "NORMAL_WIDE_ITEMLIST_IMAGE":
      return "와이드 아이템리스트 이미지는 정사각형 프레임으로 저장됩니다. 목록 썸네일이므로 중심 피사체를 정가운데 두는 편이 안전합니다.";
    case "CAROUSEL_FEED_IMAGE":
      return "캐러셀 피드 이미지는 4:3 프레임으로 저장됩니다. 각 카드가 옆으로 넘겨질 때 잘리지 않도록 핵심 피사체를 중앙에 맞춰 주세요.";
    case "CAROUSEL_COMMERCE_IMAGE":
      return "캐러셀 커머스 이미지는 4:3 프레임으로 저장됩니다. 상품 썸네일이 카드 상단을 채우므로 대표 상품이 잘리지 않게 맞춰 주세요.";
    case "MAIN_WIDE_ITEMLIST_IMAGE":
    case "IMAGE":
    default:
      return "일반 이미지는 2:1 프레임에 맞춰 저장됩니다. 브랜드 메시지에서 가장 안정적으로 통과되는 비율에 맞춰 잘라 업로드합니다.";
  }
}

export function BrandTemplateCreateModal({
  open,
  registrationTargets,
  mode = "create",
  initialTemplate = null,
  onClose,
  onSaved,
}: {
  open: boolean;
  registrationTargets: V2BrandTemplatesResponse["registrationTargets"];
  mode?: "create" | "edit";
  initialTemplate?: V2BrandTemplatesResponse["items"][number] | null;
  onClose: () => void;
  onSaved: (response: V2CreateBrandTemplateResponse | V2UpdateBrandTemplateResponse) => void;
}) {
  const initialDraft = buildBrandTemplateEditorDraft(initialTemplate, registrationTargets[0]?.id ?? "");
  const [senderProfileId, setSenderProfileId] = useState(() => initialDraft.senderProfileId);
  const [templateName, setTemplateName] = useState(() => initialDraft.templateName);
  const [chatBubbleType, setChatBubbleType] = useState<BrandTemplateType>(() => initialDraft.chatBubbleType);
  const [adult, setAdult] = useState(() => initialDraft.adult);
  const [content, setContent] = useState(() => initialDraft.content);
  const [header, setHeader] = useState(() => initialDraft.header);
  const [additionalContent, setAdditionalContent] = useState(() => initialDraft.additionalContent);
  const [image, setImage] = useState<(V2BrandTemplateImage & { imageName?: string }) | null>(() => initialDraft.image);
  const [buttons, setButtons] = useState<BrandButtonDraft[]>(() => initialDraft.buttons);
  const [wideItems, setWideItems] = useState<WideItemDraft[]>(() => initialDraft.wideItems);
  const [couponEnabled, setCouponEnabled] = useState(() => initialDraft.couponEnabled);
  const [coupon, setCoupon] = useState<V2BrandTemplateCoupon>(() => initialDraft.coupon);
  const [commerce, setCommerce] = useState<V2BrandTemplateCommerce>(() => initialDraft.commerce);
  const [video, setVideo] = useState<V2BrandTemplateVideo>(() => initialDraft.video);
  const [carouselHead] = useState<V2BrandTemplateCarouselHead | null>(() => initialDraft.carouselHead);
  const [carouselTail] = useState<V2BrandTemplateCarouselTail | null>(() => initialDraft.carouselTail);
  const [carouselItems, setCarouselItems] = useState<CarouselItemDraft[]>(() => initialDraft.carouselItems);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [imageEditor, setImageEditor] = useState<PendingBrandImageEditorState | null>(null);
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [validationIssue, setValidationIssue] = useState<ValidationIssue | null>(null);
  const [flashError, setFlashError] = useState<string | null>(null);

  const handleEscape = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape" && !submitting && !uploadingKey) {
      if (imageEditor) {
        closeImageEditor();
        return;
      }
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

  const selectedTarget = registrationTargets.find((item) => item.id === senderProfileId) ?? registrationTargets[0] ?? null;

  const handleClose = () => {
    if (submitting || uploadingKey) {
      return;
    }
    if (imageEditor) {
      closeImageEditor();
      return;
    }
    onClose();
  };

  const handleTypeChange = (value: BrandTemplateType) => {
    setChatBubbleType(value);
    setFlashError(null);
    setValidationIssue(null);
    if (value === "CAROUSEL_FEED" || value === "CAROUSEL_COMMERCE") {
      setCarouselItems((current) => (current.length > 0 ? current : [createCarouselItemDraft(value)]));
    }
    if (value === "WIDE_ITEM_LIST") {
      setWideItems((current) => (current.length > 0 ? current : [createWideItemDraft()]));
    }
    if (value !== "CAROUSEL_FEED" && value !== "CAROUSEL_COMMERCE") {
      setCarouselItems([]);
    }
    if (value !== "WIDE_ITEM_LIST") {
      setWideItems([]);
    }
    if (value !== "COMMERCE") {
      setCommerce({ ...EMPTY_COMMERCE });
    }
    if (value !== "PREMIUM_VIDEO") {
      setVideo({ videoUrl: "", thumbnailUrl: "" });
    }
  };

  const closeImageEditor = () => {
    if (imageEditor) {
      URL.revokeObjectURL(imageEditor.sourceUrl);
    }
    setImageEditor(null);
  };

  const applyUploadedImage = (
    target: BrandImageTarget,
    uploaded: { imageUrl: string; imageName: string | null }
  ) => {
    if (target.kind === "main-image") {
      setImage((current) => ({
        imageUrl: uploaded.imageUrl,
        imageName: uploaded.imageName || "",
        imageLink: current?.imageLink || "",
      }));
      return;
    }

    if (target.kind === "wide-item") {
      setWideItems((current) =>
        current.map((entry) =>
          entry.id === target.itemId
            ? { ...entry, imageUrl: uploaded.imageUrl, imageName: uploaded.imageName || "" }
            : entry
        )
      );
      return;
    }

    setCarouselItems((current) =>
      current.map((entry) =>
        entry.id === target.itemId
          ? { ...entry, imageUrl: uploaded.imageUrl, imageName: uploaded.imageName || "" }
          : entry
      )
    );
  };

  const openImageEditor = (
    file: File | null,
    imageType: BrandTemplateImageType,
    target: BrandImageTarget,
  ) => {
    if (!file) {
      return;
    }

    const key = getBrandImageTargetKey(target);
    setUploadErrors((current) => {
      if (!current[key]) {
        return current;
      }
      const next = { ...current };
      delete next[key];
      return next;
    });

    if (imageEditor) {
      URL.revokeObjectURL(imageEditor.sourceUrl);
    }

    setImageEditor({
      sourceUrl: URL.createObjectURL(file),
      fileName: file.name,
      imageType,
      target,
    });
  };

  const handleEditedImageApply = async (file: File) => {
    if (!imageEditor) {
      return;
    }

    const targetKey = getBrandImageTargetKey(imageEditor.target);
    setUploadingKey(targetKey);

    try {
      const uploaded = await uploadV2BrandTemplateImage(file, imageEditor.imageType);
      applyUploadedImage(imageEditor.target, uploaded);
      setUploadErrors((current) => {
        if (!current[targetKey]) {
          return current;
        }
        const next = { ...current };
        delete next[targetKey];
        return next;
      });
      closeImageEditor();
    } catch (error) {
      setUploadErrors((current) => ({
        ...current,
        [targetKey]: error instanceof Error ? error.message : "브랜드 템플릿 이미지 업로드에 실패했습니다.",
      }));
      throw (error instanceof Error ? error : new Error("브랜드 템플릿 이미지 업로드에 실패했습니다."));
    } finally {
      setUploadingKey((current) => (current === targetKey ? null : current));
    }
  };

  const validate = (): ValidationIssue | null => {
    if (!selectedTarget) {
      return { key: "senderProfileId", message: "발신 프로필을 선택해 주세요.", focusId: "brand-template-sender-profile" };
    }
    if (!templateName.trim()) {
      return { key: "templateName", message: "템플릿 이름을 입력해 주세요.", focusId: "brand-template-name" };
    }
    if (requiresContent(chatBubbleType) && !content.trim()) {
      return { key: "content", message: "내용을 입력해 주세요.", focusId: "brand-template-content" };
    }
    if (requiresMainImage(chatBubbleType) && !image?.imageUrl) {
      return { key: "mainImage", message: "이미지형 템플릿은 이미지를 먼저 업로드해 주세요." };
    }
    if (chatBubbleType === "WIDE_ITEM_LIST" && !header.trim()) {
      return { key: "header", message: "와이드 아이템리스트형은 header가 필요합니다.", focusId: "brand-template-header" };
    }
    if (chatBubbleType === "WIDE_ITEM_LIST" && wideItems.length === 0) {
      return { key: "wideItems", message: "와이드 아이템을 하나 이상 추가해 주세요." };
    }
    if (chatBubbleType === "WIDE_ITEM_LIST" && wideItems.some((item) => !item.imageUrl)) {
      return { key: "wideItems", message: "와이드 아이템리스트의 모든 항목에 이미지를 넣어 주세요." };
    }
    if (chatBubbleType === "PREMIUM_VIDEO" && !video.videoUrl?.trim()) {
      return { key: "videoUrl", message: "프리미엄 동영상형은 Video URL이 필요합니다.", focusId: "brand-template-video-url" };
    }
    if (chatBubbleType === "COMMERCE" && !commerce.title?.trim()) {
      return { key: "commerce", message: "커머스형은 상품명을 입력해 주세요.", focusId: "brand-template-commerce-title" };
    }
    if (couponEnabled) {
      const couponTitleError = validateCouponTitle(coupon.title || "");
      if (couponTitleError) {
        return { key: "coupon", message: couponTitleError };
      }
      if (!coupon.description?.trim()) {
        return { key: "coupon", message: "쿠폰 사용 시 설명을 입력해 주세요." };
      }
      if (!validateCouponLinkPolicy(coupon)) {
        return { key: "coupon", message: "쿠폰 링크는 Mobile 링크를 쓰거나, Android/iOS 중 하나에 alimtalk=coupon:// 링크를 넣어야 합니다." };
      }
    }
    if (chatBubbleType === "CAROUSEL_FEED" && carouselItems.some((item) => !item.header?.trim() || !item.message?.trim())) {
      return { key: "carousel", message: "캐러셀 피드형은 각 아이템의 header와 message가 필요합니다." };
    }
    if ((chatBubbleType === "CAROUSEL_FEED" || chatBubbleType === "CAROUSEL_COMMERCE") && carouselItems.length === 0) {
      return { key: "carousel", message: "캐러셀 아이템을 하나 이상 추가해 주세요." };
    }
    if (
      (chatBubbleType === "CAROUSEL_FEED" || chatBubbleType === "CAROUSEL_COMMERCE") &&
      carouselItems.some((item) => !item.imageUrl)
    ) {
      return { key: "carousel", message: "캐러셀 아이템 이미지가 비어 있습니다." };
    }
    if (
      chatBubbleType === "CAROUSEL_COMMERCE" &&
      carouselItems.some((item) => !item.commerce?.title?.trim())
    ) {
      return { key: "carousel", message: "캐러셀 커머스형은 각 아이템의 상품명을 입력해 주세요." };
    }
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setValidationIssue(validationError);
      setFlashError(null);
      if (validationError.focusId) {
        requestAnimationFrame(() => {
          document.getElementById(validationError.focusId || "")?.focus();
        });
      }
      return;
    }

    const payload: V2CreateBrandTemplatePayload = {
      senderProfileId: selectedTarget!.id,
      templateName: templateName.trim(),
      chatBubbleType,
      adult,
      ...(allowsContent(chatBubbleType) && content.trim() ? { content: content.trim() } : {}),
      ...(allowsHeader(chatBubbleType) && header.trim() ? { header: header.trim() } : {}),
      ...(allowsAdditionalContent(chatBubbleType) && additionalContent.trim() ? { additionalContent: additionalContent.trim() } : {}),
      ...(image?.imageUrl ? { image: { imageUrl: image.imageUrl, ...(image.imageLink?.trim() ? { imageLink: image.imageLink.trim() } : {}) } } : {}),
      ...(buttons.length > 0 ? { buttons: sanitizeButtons(buttons) } : {}),
      ...(chatBubbleType === "WIDE_ITEM_LIST"
        ? {
            item: {
              list: wideItems.map((item) => ({
                ...(item.title?.trim() ? { title: item.title.trim() } : {}),
                imageUrl: item.imageUrl,
                ...(item.linkMo?.trim() ? { linkMo: item.linkMo.trim() } : {}),
                ...(item.linkPc?.trim() ? { linkPc: item.linkPc.trim() } : {}),
                ...(item.schemeAndroid?.trim() ? { schemeAndroid: item.schemeAndroid.trim() } : {}),
                ...(item.schemeIos?.trim() ? { schemeIos: item.schemeIos.trim() } : {}),
              })),
            },
          }
        : {}),
      ...(couponEnabled && coupon.title?.trim() ? { coupon: sanitizeCoupon(coupon) } : {}),
      ...(chatBubbleType === "COMMERCE" && commerce.title?.trim() ? { commerce: sanitizeCommerce(commerce) } : {}),
      ...(chatBubbleType === "PREMIUM_VIDEO" && video.videoUrl?.trim()
        ? {
            video: {
              videoUrl: video.videoUrl.trim(),
              ...(video.thumbnailUrl?.trim() ? { thumbnailUrl: video.thumbnailUrl.trim() } : {}),
            },
          }
        : {}),
      ...(chatBubbleType === "CAROUSEL_FEED" || chatBubbleType === "CAROUSEL_COMMERCE"
        ? {
            carousel: {
              ...(carouselHead ? { head: carouselHead } : {}),
              list: carouselItems.map((item) => ({
                ...(chatBubbleType === "CAROUSEL_FEED" && item.header?.trim() ? { header: item.header.trim() } : {}),
                ...(chatBubbleType === "CAROUSEL_FEED" && item.message?.trim() ? { message: item.message.trim() } : {}),
                ...(chatBubbleType === "CAROUSEL_COMMERCE" && item.additionalContent?.trim() ? { additionalContent: item.additionalContent.trim() } : {}),
                imageUrl: item.imageUrl,
                ...(item.imageLink?.trim() ? { imageLink: item.imageLink.trim() } : {}),
                ...(item.buttons.length > 0 ? { buttons: sanitizeButtons(item.buttons) } : {}),
                ...(item.coupon?.title?.trim() ? { coupon: sanitizeCoupon(item.coupon) } : {}),
                ...(item.commerce?.title?.trim() ? { commerce: sanitizeCommerce(item.commerce) } : {}),
              })),
              ...(carouselTail ? { tail: carouselTail } : {}),
            },
          }
        : {}),
    };

    setSubmitting(true);
    setValidationIssue(null);
    setFlashError(null);
    try {
      const response =
        mode === "edit" && initialTemplate?.templateCode
          ? await updateV2BrandTemplate(initialTemplate.templateCode, payload)
          : await createV2BrandTemplate(payload);
      onSaved(response);
    } catch (error) {
      setFlashError(
        error instanceof Error
          ? error.message
          : mode === "edit"
            ? "브랜드 템플릿 수정에 실패했습니다."
            : "브랜드 템플릿 등록에 실패했습니다."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const previewModel = {
    ownerLabel: selectedTarget?.label || "@brand",
    chatBubbleType,
    ...(allowsContent(chatBubbleType) ? { content } : {}),
    ...(allowsHeader(chatBubbleType) ? { header } : {}),
    ...(allowsAdditionalContent(chatBubbleType) ? { additionalContent } : {}),
    ...(allowsMainImage(chatBubbleType) ? { image } : {}),
    buttons: sanitizeButtons(buttons),
    item: wideItems.length > 0 ? { list: wideItems.map(stripIdFromWideItem) } : null,
    coupon: couponEnabled && coupon.title ? sanitizeCoupon(coupon) : null,
    commerce: commerce.title ? sanitizeCommerce(commerce) : null,
    video: video.videoUrl || video.thumbnailUrl ? { ...video } : null,
    carousel:
      chatBubbleType === "CAROUSEL_FEED" || chatBubbleType === "CAROUSEL_COMMERCE"
        ? {
            ...(carouselHead ? { head: carouselHead } : {}),
            list: carouselItems.map((item) => ({
              ...(chatBubbleType === "CAROUSEL_FEED" && item.header ? { header: item.header } : {}),
              ...(chatBubbleType === "CAROUSEL_FEED" && item.message ? { message: item.message } : {}),
              ...(chatBubbleType === "CAROUSEL_COMMERCE" && item.additionalContent ? { additionalContent: item.additionalContent } : {}),
              imageUrl: item.imageUrl,
              ...(item.imageLink ? { imageLink: item.imageLink } : {}),
              ...(item.buttons.length > 0 ? { buttons: sanitizeButtons(item.buttons) } : {}),
              ...(item.coupon?.title ? { coupon: sanitizeCoupon(item.coupon) } : {}),
              ...(item.commerce?.title ? { commerce: sanitizeCommerce(item.commerce) } : {}),
            })),
            ...(carouselTail ? { tail: carouselTail } : {}),
          }
        : null,
    adult,
  } as const;

  return (
    <>
      <div className="modal-backdrop open" onClick={handleClose}>
        <div className="tmpl-modal-stack" onClick={(event) => event.stopPropagation()}>
          <div className="modal modal-xl">
          <div className="modal-header" style={{ padding: "14px 20px" }}>
            <div className="modal-title">
              <AppIcon name="brand" className="icon icon-18" />
              {mode === "edit" ? "브랜드 메시지 템플릿 수정" : "브랜드 메시지 템플릿 만들기"}
            </div>
            <button className="modal-close" onClick={handleClose}>
              <AppIcon name="x" className="icon icon-18" />
            </button>
          </div>

          <div className="modal-body">
            <div className="tmpl-form-col">
              {flashError ? (
                <div className="brand-template-error-summary" role="alert">
                  <div className="brand-template-error-summary-title">저장할 수 없습니다</div>
                  <div className="brand-template-error-summary-copy">{flashError}</div>
                </div>
              ) : null}
              {validationIssue ? (
                <div className="brand-template-error-summary" role="alert">
                  <div className="brand-template-error-summary-title">입력한 내용을 확인해 주세요</div>
                  <div className="brand-template-error-summary-copy">{validationIssue.message}</div>
                </div>
              ) : null}

              <section className="brand-template-section">
                <div className="brand-template-section-header brand-template-section-header-block">
                  <div>
                    <div className="brand-template-section-title">기본 정보</div>
                    <p className="brand-template-section-copy">발신 채널과 템플릿 성격을 먼저 정하면 아래 입력 항목이 필요한 만큼만 열립니다.</p>
                  </div>
                </div>
                <div className="brand-template-form-grid">
                <div className="form-group">
                  <label className="form-label" htmlFor="brand-template-sender-profile">발신 프로필 <span style={{ color: "var(--danger-fg)" }} aria-hidden="true">*</span></label>
                  <FormSelect id="brand-template-sender-profile" required aria-invalid={validationIssue?.key === "senderProfileId"} className="form-control" value={senderProfileId} onChange={(event) => setSenderProfileId(event.target.value)} disabled={submitting || mode === "edit"}>
                    {registrationTargets.map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.label}
                      </option>
                    ))}
                  </FormSelect>
                  {validationIssue?.key === "senderProfileId" ? (
                    <div className="tmpl-field-error show">{validationIssue.message}</div>
                  ) : mode === "edit" ? (
                    <div className="form-hint">기존 템플릿이 연결된 발신 프로필은 수정 단계에서 바꾸지 않습니다.</div>
                  ) : null}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="brand-template-name">템플릿 이름 <span style={{ color: "var(--danger-fg)" }} aria-hidden="true">*</span></label>
                  <input id="brand-template-name" required aria-invalid={validationIssue?.key === "templateName"} className="form-control" maxLength={150} value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="예: 4월 주말 프로모션" />
                  {validationIssue?.key === "templateName" ? <div className="tmpl-field-error show">{validationIssue.message}</div> : <div className="form-hint">운영 중 찾기 쉬운 이름으로 작성해 주세요. 최대 150자까지 입력할 수 있습니다.</div>}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="brand-template-type">메시지 유형 <span style={{ color: "var(--danger-fg)" }} aria-hidden="true">*</span></label>
                  <FormSelect id="brand-template-type" className="form-control" value={chatBubbleType} onChange={(event) => handleTypeChange(event.target.value as BrandTemplateType)} disabled={submitting}>
                    {BRAND_TEMPLATE_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </FormSelect>
                  <div className="form-hint">유형에 따라 필요한 이미지, 상품 정보, 캐러셀 입력이 아래에 순서대로 열립니다.</div>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="brand-template-adult">성인용 메시지 여부</label>
                  <FormSelect id="brand-template-adult" className="form-control" value={adult ? "y" : "n"} onChange={(event) => setAdult(event.target.value === "y")} disabled={submitting}>
                    <option value="n">성인용 메시지 아님</option>
                    <option value="y">성인용 메시지</option>
                  </FormSelect>
                  <div className="form-hint">성인용 여부는 미리보기와 실제 템플릿 속성에 함께 반영됩니다.</div>
                </div>
              </div>
              </section>

              {showsHeaderField(chatBubbleType) || showsContentField(chatBubbleType) || showsAdditionalContentField(chatBubbleType) || showsMainImageField(chatBubbleType) ? (
                <section className="brand-template-section">
                  <div className="brand-template-section-header brand-template-section-header-block">
                    <div>
                      <div className="brand-template-section-title">메시지 구성</div>
                      <p className="brand-template-section-copy">실제 말풍선에 들어갈 텍스트와 이미지 요소를 위에서 아래 순서대로 입력합니다.</p>
                    </div>
                  </div>
                  {showsHeaderField(chatBubbleType) ? (
                    <div className="form-group">
                      <label className="form-label" htmlFor="brand-template-header">header {chatBubbleType === "WIDE_ITEM_LIST" ? <span style={{ color: "var(--danger-fg)" }} aria-hidden="true">*</span> : null}</label>
                      <input id="brand-template-header" required={chatBubbleType === "WIDE_ITEM_LIST"} aria-invalid={validationIssue?.key === "header"} className="form-control" maxLength={20} value={header} onChange={(event) => setHeader(event.target.value)} placeholder="최대 20자" />
                      {validationIssue?.key === "header" ? <div className="tmpl-field-error show">{validationIssue.message}</div> : <div className="form-hint">와이드 아이템리스트 상단에 고정으로 보여줄 짧은 제목입니다.</div>}
                    </div>
                  ) : null}

                  {showsContentField(chatBubbleType) ? (
                    <div className="form-group">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label className="form-label" htmlFor="brand-template-content" style={{ margin: 0 }}>내용 {requiresContent(chatBubbleType) ? <span style={{ color: "var(--danger-fg)" }} aria-hidden="true">*</span> : null}</label>
                    <span className="td-muted text-small">{content.length}자</span>
                  </div>
                  <textarea id="brand-template-content" required={requiresContent(chatBubbleType)} aria-invalid={validationIssue?.key === "content"} className="form-control" rows={5} value={content} onChange={(event) => setContent(event.target.value)} style={{ resize: "vertical" }} placeholder="브랜드 메시지 내용을 입력하세요." />
                  {validationIssue?.key === "content" ? <div className="tmpl-field-error show">{validationIssue.message}</div> : <div className="form-hint">실제 사용자에게 보여줄 본문입니다. 줄바꿈과 길이를 미리보기에서 함께 확인해 주세요.</div>}
                </div>
                  ) : null}

                  {showsAdditionalContentField(chatBubbleType) ? (
                    <div className="form-group">
                      <label className="form-label" htmlFor="brand-template-additional-content">부가정보</label>
                      <textarea id="brand-template-additional-content" className="form-control" rows={2} value={additionalContent} onChange={(event) => setAdditionalContent(event.target.value)} style={{ resize: "vertical" }} placeholder="필요할 때만 입력하세요." />
                      <div className="form-hint">상품 설명이나 보조 문구처럼, 본문보다 한 단계 약한 정보를 넣을 때 사용합니다.</div>
                    </div>
                  ) : null}

                  {showsMainImageField(chatBubbleType) ? (
                    <div className="form-group">
                  <label className="form-label">이미지 {requiresMainImage(chatBubbleType) ? <span style={{ color: "var(--danger-fg)" }}>*</span> : null}</label>
                  <ImageUploadField
                    imageUrl={image?.imageUrl || ""}
                    imageName={image?.imageName || ""}
                    uploading={uploadingKey === "main-image"}
                    error={uploadErrors["main-image"] || null}
                    note={chatBubbleType === "WIDE" ? "권장 800x600 비율" : "권장 800x400 비율"}
                    onClear={() => {
                      setImage(null);
                      setUploadErrors((current) => {
                        if (!current["main-image"]) {
                          return current;
                        }
                        const next = { ...current };
                        delete next["main-image"];
                        return next;
                      });
                    }}
                    onUploaded={(file) =>
                      openImageEditor(file, chatBubbleType === "WIDE" ? "WIDE_IMAGE" : "IMAGE", {
                        kind: "main-image",
                      })
                    }
                  />
                  {validationIssue?.key === "mainImage" ? <div className="tmpl-field-error show">{validationIssue.message}</div> : null}
                  <input className="form-control" value={image?.imageLink || ""} onChange={(event) => setImage((current) => ({ imageUrl: current?.imageUrl || "", imageName: current?.imageName || "", imageLink: event.target.value }))} placeholder="이미지 링크 URL (선택)" style={{ marginTop: 8 }} />
                  <div className="form-hint">업로드 오류는 이 입력 아래에 표시됩니다. 등록 시 허용 비율과 타입 조건을 함께 확인합니다.</div>
                </div>
                  ) : null}
                </section>
              ) : null}

              {chatBubbleType === "PREMIUM_VIDEO" ? (
                <div className="brand-template-section">
                  <div className="brand-template-section-header brand-template-section-header-block">
                    <div>
                      <div className="brand-template-section-title">프리미엄 동영상</div>
                      <p className="brand-template-section-copy">비디오 URL은 필수입니다. 썸네일은 없으면 기본 플레이스홀더가 보입니다.</p>
                    </div>
                  </div>
                  <div className="brand-template-form-grid">
                    <div className="form-group">
                      <label className="form-label" htmlFor="brand-template-video-url">Video URL <span style={{ color: "var(--danger-fg)" }} aria-hidden="true">*</span></label>
                      <input id="brand-template-video-url" required aria-invalid={validationIssue?.key === "videoUrl"} className="form-control" value={video.videoUrl || ""} onChange={(event) => setVideo((current) => ({ ...current, videoUrl: event.target.value }))} placeholder="https://..." />
                      {validationIssue?.key === "videoUrl" ? <div className="tmpl-field-error show">{validationIssue.message}</div> : null}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Thumbnail URL</label>
                      <input className="form-control" value={video.thumbnailUrl || ""} onChange={(event) => setVideo((current) => ({ ...current, thumbnailUrl: event.target.value }))} placeholder="https://..." />
                    </div>
                  </div>
                </div>
              ) : null}

              {chatBubbleType === "COMMERCE" ? (
                <div className="brand-template-section">
                  <div className="brand-template-section-header brand-template-section-header-block">
                    <div>
                      <div className="brand-template-section-title">커머스 정보</div>
                      <p className="brand-template-section-copy">상품명과 가격 정보는 카드 본문에 바로 노출됩니다. 값이 없으면 미리보기에도 빈 상태로 남습니다.</p>
                    </div>
                  </div>
                  {validationIssue?.key === "commerce" ? <div className="tmpl-field-error show" style={{ marginBottom: 12 }}>{validationIssue.message}</div> : null}
                  <CommerceEditor commerce={commerce} onChange={setCommerce} />
                </div>
              ) : null}

              {chatBubbleType === "WIDE_ITEM_LIST" ? (
                <div className="brand-template-section">
                  <div className="brand-template-section-header">
                    <div>
                      <div className="brand-template-section-title">와이드 아이템리스트</div>
                      <p className="brand-template-section-copy">대표 카드와 보조 카드가 위에서 아래로 이어집니다. 모든 항목에 이미지가 필요합니다.</p>
                    </div>
                    <button className="btn btn-default btn-sm" type="button" onClick={() => setWideItems((current) => [...current, createWideItemDraft()])}>
                      <AppIcon name="plus" className="icon icon-12" /> 아이템 추가
                    </button>
                  </div>
                  {validationIssue?.key === "wideItems" ? <div className="tmpl-field-error show" style={{ marginBottom: 12 }}>{validationIssue.message}</div> : null}
                  <div className="brand-template-stack">
                    {wideItems.length > 0 ? (
                      wideItems.map((item) => (
                        <div className="brand-template-card" key={item.id}>
                          <div className="brand-template-card-top">
                            <div className="table-title-text">아이템</div>
                            <button className="btn btn-danger btn-sm" type="button" onClick={() => setWideItems((current) => current.filter((entry) => entry.id !== item.id))}>
                              삭제
                            </button>
                          </div>
                          <div className="brand-template-form-grid">
                            <div className="form-group">
                              <label className="form-label">제목</label>
                              <input className="form-control" value={item.title || ""} onChange={(event) => setWideItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, title: event.target.value } : entry))} />
                            </div>
                            <div className="form-group">
                              <label className="form-label">이미지 <span style={{ color: "var(--danger-fg)" }}>*</span></label>
                              <ImageUploadField
                                imageUrl={item.imageUrl}
                                imageName={item.imageName || ""}
                                uploading={uploadingKey === item.id}
                                error={uploadErrors[item.id] || null}
                                onClear={() => {
                                  setWideItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, imageUrl: "", imageName: "" } : entry));
                                  setUploadErrors((current) => {
                                    if (!current[item.id]) {
                                      return current;
                                    }
                                    const next = { ...current };
                                    delete next[item.id];
                                    return next;
                                  });
                                }}
                                onUploaded={(file) =>
                                  openImageEditor(file, "NORMAL_WIDE_ITEMLIST_IMAGE", {
                                    kind: "wide-item",
                                    itemId: item.id,
                                  })
                                }
                              />
                            </div>
                          </div>
                          <div className="brand-template-form-grid">
                            <div className="form-group">
                              <label className="form-label">Mobile 링크</label>
                              <input className="form-control" value={item.linkMo || ""} onChange={(event) => setWideItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, linkMo: event.target.value } : entry))} />
                            </div>
                            <div className="form-group">
                              <label className="form-label">PC 링크</label>
                              <input className="form-control" value={item.linkPc || ""} onChange={(event) => setWideItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, linkPc: event.target.value } : entry))} />
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="brand-template-empty">아이템을 추가하면 여기에서 편집할 수 있습니다.</div>
                    )}
                  </div>
                </div>
              ) : null}

              {supportsCoupon(chatBubbleType) ? (
                <div className="brand-template-section">
                  <div className="brand-template-section-header">
                    <div>
                      <div className="brand-template-section-title">쿠폰</div>
                      <p className="brand-template-section-copy">필요한 경우에만 열립니다. 제목 형식과 링크 조건은 아래에서 바로 확인할 수 있습니다.</p>
                    </div>
                    <label className="form-checkbox" style={{ margin: 0 }}>
                      <input type="checkbox" checked={couponEnabled} onChange={(event) => setCouponEnabled(event.target.checked)} />
                      <span>사용</span>
                    </label>
                  </div>
                  {validationIssue?.key === "coupon" ? <div className="tmpl-field-error show" style={{ marginBottom: 12 }}>{validationIssue.message}</div> : null}
                  {couponEnabled ? <CouponEditor coupon={coupon} onChange={setCoupon} /> : null}
                </div>
              ) : null}

              {supportsStandaloneButtons(chatBubbleType) ? (
                <div className="brand-template-section">
                  <div className="brand-template-section-header">
                    <div>
                      <div className="brand-template-section-title">버튼</div>
                      <p className="brand-template-section-copy">유형에 맞는 링크만 노출됩니다. 버튼마다 필요한 링크 입력만 순서대로 작성하세요.</p>
                    </div>
                    <button className="btn btn-default btn-sm" type="button" onClick={() => setButtons((current) => [...current, createButtonDraft()])}>
                      <AppIcon name="plus" className="icon icon-12" /> 버튼 추가
                    </button>
                  </div>
                  <ButtonEditorList buttons={buttons} onChange={setButtons} />
                </div>
              ) : null}

              {chatBubbleType === "CAROUSEL_FEED" || chatBubbleType === "CAROUSEL_COMMERCE" ? (
                <div className="brand-template-section">
                  <div className="brand-template-section-header">
                    <div>
                      <div className="brand-template-section-title">{chatBubbleType === "CAROUSEL_FEED" ? "캐러셀 피드" : "캐러셀 커머스"}</div>
                      <p className="brand-template-section-copy">슬라이드 단위로 입력합니다. 카드 수와 순서는 오른쪽 미리보기의 dot과 함께 반영됩니다.</p>
                    </div>
                    <button className="btn btn-default btn-sm" type="button" onClick={() => setCarouselItems((current) => [...current, createCarouselItemDraft(chatBubbleType)])}>
                      <AppIcon name="plus" className="icon icon-12" /> 캐러셀 추가
                    </button>
                  </div>
                  {validationIssue?.key === "carousel" ? <div className="tmpl-field-error show" style={{ marginBottom: 12 }}>{validationIssue.message}</div> : null}
                  <div className="brand-template-stack">
                    {carouselItems.length > 0 ? (
                      carouselItems.map((item, itemIndex) => (
                        <div className="brand-template-card" key={item.id}>
                          <div className="brand-template-card-top">
                            <div>
                              <div className="table-title-text">카드 {itemIndex + 1}</div>
                              <div className="brand-template-card-copy">
                                {chatBubbleType === "CAROUSEL_FEED"
                                  ? "카드 제목, 메시지, 이미지 순서로 입력하면 미리보기에 바로 반영됩니다."
                                  : "상품 정보와 이미지를 카드 단위로 입력합니다."}
                              </div>
                            </div>
                            <button className="btn btn-danger btn-sm" type="button" onClick={() => setCarouselItems((current) => current.filter((entry) => entry.id !== item.id))}>
                              삭제
                            </button>
                          </div>
                          <div className="brand-template-stack">
                            {chatBubbleType === "CAROUSEL_FEED" ? (
                              <>
                                <div className="form-group">
                                  <label className="form-label">카드 제목 <span style={{ color: "var(--danger-fg)" }} aria-hidden="true">*</span></label>
                                  <input className="form-control" value={item.header || ""} onChange={(event) => setCarouselItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, header: event.target.value } : entry))} />
                                  <div className="form-hint">캐러셀 카드 상단에 노출될 짧은 제목입니다.</div>
                                </div>
                                <div className="form-group">
                                  <label className="form-label">카드 메시지 <span style={{ color: "var(--danger-fg)" }} aria-hidden="true">*</span></label>
                                  <textarea className="form-control" rows={3} value={item.message || ""} onChange={(event) => setCarouselItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, message: event.target.value } : entry))} style={{ resize: "vertical" }} />
                                  <div className="form-hint">각 카드 본문에 표시할 설명입니다.</div>
                                </div>
                              </>
                            ) : (
                              <div className="form-group">
                                <label className="form-label">부가정보</label>
                                <input className="form-control" maxLength={34} value={item.additionalContent || ""} onChange={(event) => setCarouselItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, additionalContent: event.target.value } : entry))} />
                                <div className="form-hint">상품명과 가격 아래에 짧게 붙는 보조 문구입니다.</div>
                              </div>
                            )}
                          </div>
                          <div className="form-group">
                            <label className="form-label">이미지 <span style={{ color: "var(--danger-fg)" }}>*</span></label>
                            <ImageUploadField
                              imageUrl={item.imageUrl}
                              imageName={item.imageName || ""}
                              uploading={uploadingKey === item.id}
                              error={uploadErrors[item.id] || null}
                              onClear={() => {
                                setCarouselItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, imageUrl: "", imageName: "" } : entry));
                                setUploadErrors((current) => {
                                  if (!current[item.id]) {
                                    return current;
                                  }
                                  const next = { ...current };
                                  delete next[item.id];
                                  return next;
                                });
                              }}
                              onUploaded={(file) =>
                                openImageEditor(
                                  file,
                                  chatBubbleType === "CAROUSEL_FEED" ? "CAROUSEL_FEED_IMAGE" : "CAROUSEL_COMMERCE_IMAGE",
                                  {
                                    kind: "carousel-item",
                                    itemId: item.id,
                                  }
                                )
                              }
                            />
                            <input className="form-control" style={{ marginTop: 8 }} value={item.imageLink || ""} onChange={(event) => setCarouselItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, imageLink: event.target.value } : entry))} placeholder="이미지 링크 URL (선택)" />
                            <div className="form-hint">카드를 눌렀을 때 이동할 이미지 링크가 있으면 함께 입력합니다.</div>
                          </div>
                          {chatBubbleType === "CAROUSEL_FEED" ? (
                            <div className="brand-template-section">
                              <div className="brand-template-section-header">
                                <div>
                                  <div className="brand-template-section-title">버튼</div>
                                  <p className="brand-template-section-copy">각 카드 안에서만 보일 버튼입니다. 필요한 카드에만 추가하세요.</p>
                                </div>
                                <button className="btn btn-default btn-sm" type="button" onClick={() => setCarouselItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, buttons: [...entry.buttons, createButtonDraft()] } : entry))}>
                                  <AppIcon name="plus" className="icon icon-12" /> 버튼 추가
                                </button>
                              </div>
                              <ButtonEditorList
                                buttons={item.buttons}
                                onChange={(next) =>
                                  setCarouselItems((current) =>
                                    current.map((entry) => (entry.id === item.id ? { ...entry, buttons: next } : entry))
                                  )
                                }
                              />
                            </div>
                          ) : null}
                          {chatBubbleType === "CAROUSEL_COMMERCE" ? (
                            <div className="brand-template-section">
                              <div className="brand-template-section-header brand-template-section-header-block">
                                <div>
                                  <div className="brand-template-section-title">커머스 정보</div>
                                  <p className="brand-template-section-copy">상품명과 가격 정보를 입력하면 카드 하단 가격 영역에 표시됩니다.</p>
                                </div>
                              </div>
                              <CommerceEditor
                                commerce={item.commerce ?? { ...EMPTY_COMMERCE }}
                                onChange={(next) =>
                                  setCarouselItems((current) =>
                                    current.map((entry) => (entry.id === item.id ? { ...entry, commerce: next } : entry))
                                  )
                                }
                              />
                            </div>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <div className="brand-template-empty">캐러셀을 추가하면 여기에서 편집할 수 있습니다.</div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="tmpl-preview-col">
              <div className="tmpl-preview-label">Preview</div>
              <BrandTemplatePreview model={previewModel} />
            </div>
          </div>

          <div className="modal-footer" style={{ justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>
              {uploadingKey
                ? "이미지 업로드가 끝나면 저장할 수 있습니다."
                : mode === "edit"
                  ? "변경 내용은 NHN 브랜드 메시지 템플릿에 바로 반영됩니다."
                  : "NHN 브랜드 메시지 템플릿으로 바로 등록됩니다."}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-default" onClick={handleClose} disabled={submitting || Boolean(uploadingKey)}>
                취소
              </button>
              <button className="btn btn-kakao" onClick={handleSubmit} disabled={submitting || Boolean(uploadingKey)}>
                <AppIcon name="send" className="icon icon-14" />
                {submitting ? (mode === "edit" ? "수정 중..." : "저장 중...") : mode === "edit" ? "변경 저장" : "저장"}
              </button>
            </div>
          </div>
          </div>
        </div>
      </div>

      {imageEditor ? (
        <KakaoTemplateImageEditorModal
          open={Boolean(imageEditor)}
          fileName={imageEditor.fileName}
          sourceUrl={imageEditor.sourceUrl}
          config={getBrandImageCropConfig(imageEditor.imageType)}
          guidanceTitle="이미지를 브랜드 메시지 규격에 맞춰 잘라 주세요."
          guidanceCopy={getBrandImageEditorCopy(imageEditor.imageType)}
          onApply={handleEditedImageApply}
          onClose={closeImageEditor}
        />
      ) : null}
    </>
  );
}

function ImageUploadField({
  imageUrl,
  imageName,
  uploading,
  error,
  note,
  onUploaded,
  onClear,
}: {
  imageUrl: string;
  imageName: string;
  uploading: boolean;
  error?: string | null;
  note?: string;
  onUploaded: (file: File | null) => void;
  onClear: () => void;
}) {
  return (
    <div className="brand-template-upload">
      <label className="btn btn-default btn-sm" style={{ cursor: uploading ? "progress" : "pointer" }}>
        <AppIcon name="upload" className="icon icon-12" />
        {uploading ? "업로드 중..." : imageUrl ? "이미지 교체" : "이미지 선택"}
        <input
          type="file"
          accept="image/png,image/jpeg"
          style={{ display: "none" }}
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            onUploaded(file);
            event.currentTarget.value = "";
          }}
          disabled={uploading}
        />
      </label>
      {imageUrl ? (
        <button className="btn btn-danger btn-sm" type="button" onClick={onClear}>
          삭제
        </button>
      ) : null}
      {note ? <div className="brand-template-help">{note}</div> : null}
      <div className="form-hint">선택한 이미지는 업로드 전에 비율에 맞춰 잘라서 보낼 수 있습니다.</div>
      {error ? <div className="tmpl-field-error show">{error}</div> : null}
      {imageUrl ? (
        <div className="brand-template-upload-summary">
          <div className="brand-template-upload-thumb">
            <img src={imageUrl} alt={imageName || "업로드 이미지"} />
          </div>
          <div className="brand-template-upload-name">{imageName || "업로드된 이미지"}</div>
        </div>
      ) : null}
    </div>
  );
}

function ButtonEditorList({
  buttons,
  onChange,
}: {
  buttons: BrandButtonDraft[];
  onChange: (next: BrandButtonDraft[]) => void;
}) {
  if (buttons.length === 0) {
    return <div className="brand-template-empty">버튼을 추가하면 여기에 표시됩니다.</div>;
  }

  return (
    <div className="brand-template-stack">
      {buttons.map((button, index) => {
        const isWebLink = button.type === "WL";
        const isAppLink = button.type === "AL";
        const isBotKeyword = button.type === "BK";
        const isMessageDelivery = button.type === "MD";

        const handleTypeChange = (value: string) => {
          onChange(
            buttons.map((entry) =>
              entry.id === button.id ? createButtonDraftForType(value as BrandButtonDraft["type"]) : entry
            )
          );
        };

        return (
          <div className="tmpl-action-card" key={button.id}>
            <div className="tmpl-action-card-header tmpl-action-card-header-block">
              <div>
                <div className="tmpl-action-card-title">버튼 {index + 1}</div>
                <div className="tmpl-action-card-copy">버튼 유형을 선택하면 필요한 링크 입력만 아래에 표시됩니다.</div>
              </div>
              <button className="btn btn-danger btn-sm" onClick={() => onChange(buttons.filter((entry) => entry.id !== button.id))} type="button">
                삭제
              </button>
            </div>

            <div className="tmpl-action-card-body">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">버튼 유형</label>
                <FormSelect
                  className="form-control"
                  value={button.type}
                  onChange={(event) => handleTypeChange(event.target.value)}
                >
                  {BRAND_BUTTON_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </FormSelect>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">버튼 이름</label>
                <input
                  className="form-control"
                  placeholder="최대 14자"
                  maxLength={14}
                  value={button.name}
                  onChange={(event) =>
                    onChange(
                      buttons.map((entry) =>
                        entry.id === button.id ? { ...entry, name: event.target.value } : entry
                      )
                    )
                  }
                />
              </div>

            {isWebLink ? (
              <>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Mobile 링크 <span className="tmpl-link-required" aria-hidden="true">*</span></label>
                  <input
                    className="form-control"
                    placeholder="https://example.com"
                    value={button.linkMo || ""}
                    onChange={(event) =>
                      onChange(
                        buttons.map((entry) =>
                          entry.id === button.id ? { ...entry, linkMo: event.target.value } : entry
                        )
                      )
                    }
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">PC 링크</label>
                  <input
                    className="form-control"
                    placeholder="https://example.com (선택)"
                    value={button.linkPc || ""}
                    onChange={(event) =>
                      onChange(
                        buttons.map((entry) =>
                          entry.id === button.id ? { ...entry, linkPc: event.target.value } : entry
                        )
                      )
                    }
                  />
                </div>
              </>
            ) : null}

            {isAppLink ? (
              <>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Mobile 링크</label>
                  <input
                    className="form-control"
                    placeholder="https://example.com"
                    value={button.linkMo || ""}
                    onChange={(event) =>
                      onChange(
                        buttons.map((entry) =>
                          entry.id === button.id ? { ...entry, linkMo: event.target.value } : entry
                        )
                      )
                    }
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">PC 링크</label>
                  <input
                    className="form-control"
                    placeholder="https://example.com (선택)"
                    value={button.linkPc || ""}
                    onChange={(event) =>
                      onChange(
                        buttons.map((entry) =>
                          entry.id === button.id ? { ...entry, linkPc: event.target.value } : entry
                        )
                      )
                    }
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">iOS 스킴</label>
                  <input
                    className="form-control"
                    placeholder="앱 스킴 (예: myapp://...)"
                    value={button.schemeIos || ""}
                    onChange={(event) =>
                      onChange(
                        buttons.map((entry) =>
                          entry.id === button.id ? { ...entry, schemeIos: event.target.value } : entry
                        )
                      )
                    }
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Android 스킴</label>
                  <input
                    className="form-control"
                    placeholder="앱 스킴 (예: myapp://...)"
                    value={button.schemeAndroid || ""}
                    onChange={(event) =>
                      onChange(
                        buttons.map((entry) =>
                          entry.id === button.id ? { ...entry, schemeAndroid: event.target.value } : entry
                        )
                      )
                    }
                  />
                </div>
                <p className="tmpl-app-link-hint">Mobile / iOS / Android 중 2개 이상 입력하는 쪽이 안전합니다.</p>
              </>
            ) : null}

            {isBotKeyword ? (
              <>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">챗봇 키워드 <span className="tmpl-link-required" aria-hidden="true">*</span></label>
                  <input
                    className="form-control"
                    placeholder="챗봇 키워드"
                    value={button.chatExtra || ""}
                    onChange={(event) =>
                      onChange(
                        buttons.map((entry) =>
                          entry.id === button.id ? { ...entry, chatExtra: event.target.value } : entry
                        )
                      )
                    }
                  />
                </div>
                <p className="form-hint">버튼을 눌렀을 때 전달할 챗봇 키워드를 입력합니다.</p>
              </>
            ) : null}

            {isMessageDelivery ? (
              <>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">전달값 <span className="tmpl-link-required" aria-hidden="true">*</span></label>
                  <input
                    className="form-control"
                    placeholder="전달할 메시지"
                    value={button.chatExtra || ""}
                    onChange={(event) =>
                      onChange(
                        buttons.map((entry) =>
                          entry.id === button.id ? { ...entry, chatExtra: event.target.value } : entry
                        )
                      )
                    }
                  />
                </div>
                <p className="form-hint">메시지 전달형은 링크 대신 전달할 텍스트를 사용합니다.</p>
              </>
            ) : null}

            {!isWebLink && !isAppLink && !isBotKeyword && !isMessageDelivery ? (
              <p className="form-hint">{brandButtonTypeLabel(button.type)} 설정을 입력해 주세요.</p>
            ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CouponEditor({
  coupon,
  onChange,
}: {
  coupon: V2BrandTemplateCoupon;
  onChange: (next: V2BrandTemplateCoupon) => void;
}) {
  const titleError = validateCouponTitle(coupon.title || "");
  const linkValid = validateCouponLinkPolicy(coupon);

  return (
    <div className="brand-template-stack">
      <div className="tmpl-action-card">
        <div className="tmpl-action-card-header">
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--fg-muted)",
              background: "var(--canvas-subtle)",
              border: "1px solid var(--border-muted)",
              borderRadius: 20,
              padding: "1px 8px",
              flexShrink: 0,
            }}
          >
            쿠폰
          </span>
          <div className="table-title-text">기본 정보</div>
        </div>
        <div className="tmpl-action-card-body">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">쿠폰 제목</label>
            <input
              className={`form-control${coupon.title && titleError ? " tmpl-input-error" : coupon.title && !titleError ? " tmpl-input-ok" : ""}`}
              maxLength={20}
              value={coupon.title || ""}
              onChange={(event) => onChange({ ...coupon, title: event.target.value })}
              placeholder="예: 1000원 할인 쿠폰"
            />
            {coupon.title ? (
              <div className={`tmpl-field-error${titleError ? " show" : ""}`}>
                {titleError || " "}
              </div>
            ) : null}
            {!titleError ? (
              <div className="form-hint">
                허용 형식: <code>{"{숫자}원 할인 쿠폰"}</code>, <code>{"{숫자}% 할인 쿠폰"}</code>, <code>배송비 할인 쿠폰</code>, <code>{"{7자 이내} 무료 쿠폰"}</code>, <code>{"{7자 이내} UP 쿠폰"}</code>
              </div>
            ) : null}
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">쿠폰 설명</label>
            <input
              className="form-control"
              value={coupon.description || ""}
              onChange={(event) => onChange({ ...coupon, description: event.target.value })}
              placeholder="쿠폰 설명"
            />
            <div className="form-hint">텍스트형/이미지형은 12자, 와이드 이미지/아이템리스트형은 18자 안쪽으로 보는 게 안전합니다.</div>
          </div>
        </div>
      </div>

      <div className="tmpl-action-card">
        <div className="tmpl-action-card-header">
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--fg-muted)",
              background: "var(--canvas-subtle)",
              border: "1px solid var(--border-muted)",
              borderRadius: 20,
              padding: "1px 8px",
              flexShrink: 0,
            }}
          >
            링크
          </span>
          <div className="table-title-text">링크 설정</div>
        </div>
        <div className="tmpl-action-card-body">
          <div className="tmpl-link-row">
            <span className="tmpl-link-label">Mobile</span>
            <input
              className="form-control"
              style={{ fontSize: 12 }}
              value={coupon.linkMo || ""}
              onChange={(event) => onChange({ ...coupon, linkMo: event.target.value })}
              placeholder="https://..."
            />
          </div>
          <div className="tmpl-link-row">
            <span className="tmpl-link-label">PC</span>
            <input
              className="form-control"
              style={{ fontSize: 12 }}
              value={coupon.linkPc || ""}
              onChange={(event) => onChange({ ...coupon, linkPc: event.target.value })}
              placeholder="https://... (선택)"
            />
          </div>
          <div className="tmpl-link-row">
            <span className="tmpl-link-label">Android</span>
            <input
              className="form-control"
              style={{ fontSize: 12 }}
              value={coupon.schemeAndroid || ""}
              onChange={(event) => onChange({ ...coupon, schemeAndroid: event.target.value })}
              placeholder="alimtalk=coupon:// 또는 app://..."
            />
          </div>
          <div className="tmpl-link-row">
            <span className="tmpl-link-label">iOS</span>
            <input
              className="form-control"
              style={{ fontSize: 12 }}
              value={coupon.schemeIos || ""}
              onChange={(event) => onChange({ ...coupon, schemeIos: event.target.value })}
              placeholder="alimtalk=coupon:// 또는 app://..."
            />
          </div>
          {linkValid ? (
            <div className="form-hint">쿠폰 링크 조건이 충족되었습니다.</div>
          ) : (
            <div className="tmpl-field-error show">
              Mobile 링크를 사용하거나 Android/iOS 중 하나에 <code>alimtalk=coupon://</code> 링크를 넣어 주세요.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CommerceEditor({
  commerce,
  onChange,
}: {
  commerce: V2BrandTemplateCommerce;
  onChange: (next: V2BrandTemplateCommerce) => void;
}) {
  return (
    <div className="brand-template-form-grid">
      <div className="form-group">
        <label className="form-label" htmlFor="brand-template-commerce-title">상품명</label>
        <input id="brand-template-commerce-title" className="form-control" value={commerce.title || ""} onChange={(event) => onChange({ ...commerce, title: event.target.value })} />
        <div className="form-hint">미리보기와 실제 카드 본문에 그대로 노출됩니다.</div>
      </div>
      <div className="form-group">
        <label className="form-label">정가</label>
        <input className="form-control" type="number" value={commerce.regularPrice ?? ""} onChange={(event) => onChange({ ...commerce, regularPrice: event.target.value ? Number(event.target.value) : undefined })} />
      </div>
      <div className="form-group">
        <label className="form-label">할인가</label>
        <input className="form-control" type="number" value={commerce.discountPrice ?? ""} onChange={(event) => onChange({ ...commerce, discountPrice: event.target.value ? Number(event.target.value) : undefined })} />
      </div>
      <div className="form-group">
        <label className="form-label">할인율(%)</label>
        <input className="form-control" type="number" value={commerce.discountRate ?? ""} onChange={(event) => onChange({ ...commerce, discountRate: event.target.value ? Number(event.target.value) : undefined })} />
      </div>
    </div>
  );
}

function sanitizeButtons(buttons: BrandButtonDraft[]): V2BrandTemplateButton[] {
  return buttons
    .filter((button) => button.name.trim())
    .map(({ id: _id, ...button }) => ({
      ...button,
      name: button.name.trim(),
      ...(button.linkMo?.trim() ? { linkMo: button.linkMo.trim() } : {}),
      ...(button.linkPc?.trim() ? { linkPc: button.linkPc.trim() } : {}),
      ...(button.schemeAndroid?.trim() ? { schemeAndroid: button.schemeAndroid.trim() } : {}),
      ...(button.schemeIos?.trim() ? { schemeIos: button.schemeIos.trim() } : {}),
      ...(button.chatExtra?.trim() ? { chatExtra: button.chatExtra.trim() } : {}),
      ...(button.chatEvent?.trim() ? { chatEvent: button.chatEvent.trim() } : {}),
      ...(button.bizFormKey?.trim() ? { bizFormKey: button.bizFormKey.trim() } : {}),
    }));
}

function sanitizeCoupon(coupon: V2BrandTemplateCoupon): V2BrandTemplateCoupon {
  return {
    title: coupon.title.trim(),
    ...(coupon.description?.trim() ? { description: coupon.description.trim() } : {}),
    ...(coupon.linkMo?.trim() ? { linkMo: coupon.linkMo.trim() } : {}),
    ...(coupon.linkPc?.trim() ? { linkPc: coupon.linkPc.trim() } : {}),
    ...(coupon.schemeAndroid?.trim() ? { schemeAndroid: coupon.schemeAndroid.trim() } : {}),
    ...(coupon.schemeIos?.trim() ? { schemeIos: coupon.schemeIos.trim() } : {}),
  };
}

function validateCouponTitle(title: string) {
  const value = title.trim();
  if (!value) {
    return "쿠폰 title을 입력해 주세요.";
  }

  const wonMatch = value.match(/^(\d{1,8})원 할인 쿠폰$/);
  if (wonMatch) {
    const amount = Number(wonMatch[1]);
    return amount >= 1 && amount <= 99999999 ? null : "원 할인 쿠폰 숫자는 1 이상 99,999,999 이하만 가능합니다.";
  }

  const percentMatch = value.match(/^(\d{1,3})% 할인 쿠폰$/);
  if (percentMatch) {
    const amount = Number(percentMatch[1]);
    return amount >= 1 && amount <= 100 ? null : "% 할인 쿠폰 숫자는 1 이상 100 이하만 가능합니다.";
  }

  if (value === "배송비 할인 쿠폰") {
    return null;
  }

  const freeMatch = value.match(/^(.{1,7}) 무료 쿠폰$/);
  if (freeMatch) {
    return freeMatch[1].trim().length > 0 ? null : "무료 쿠폰 형식의 접두어를 입력해 주세요.";
  }

  const upMatch = value.match(/^(.{1,7}) UP 쿠폰$/);
  if (upMatch) {
    return upMatch[1].trim().length > 0 ? null : "UP 쿠폰 형식의 접두어를 입력해 주세요.";
  }

  return "허용된 title 형식이 아닙니다. 예시 형식 중 하나로 입력해 주세요.";
}

function validateCouponLinkPolicy(coupon: V2BrandTemplateCoupon) {
  if (coupon.linkMo?.trim()) {
    return true;
  }

  const hasCouponScheme =
    coupon.schemeAndroid?.includes("alimtalk=coupon://") || coupon.schemeIos?.includes("alimtalk=coupon://");

  return Boolean(hasCouponScheme);
}

function sanitizeCommerce(commerce: V2BrandTemplateCommerce): V2BrandTemplateCommerce {
  return {
    title: commerce.title.trim(),
    ...(commerce.regularPrice !== undefined ? { regularPrice: commerce.regularPrice } : {}),
    ...(commerce.discountPrice !== undefined ? { discountPrice: commerce.discountPrice } : {}),
    ...(commerce.discountRate !== undefined ? { discountRate: commerce.discountRate } : {}),
    ...(commerce.discountFixed !== undefined ? { discountFixed: commerce.discountFixed } : {}),
  };
}

function stripIdFromWideItem(item: WideItemDraft): V2BrandTemplateWideItem {
  return {
    ...(item.title?.trim() ? { title: item.title.trim() } : {}),
    imageUrl: item.imageUrl,
    ...(item.linkMo?.trim() ? { linkMo: item.linkMo.trim() } : {}),
    ...(item.linkPc?.trim() ? { linkPc: item.linkPc.trim() } : {}),
    ...(item.schemeAndroid?.trim() ? { schemeAndroid: item.schemeAndroid.trim() } : {}),
    ...(item.schemeIos?.trim() ? { schemeIos: item.schemeIos.trim() } : {}),
  };
}

function showsHeaderField(type: BrandTemplateType) {
  return type === "WIDE_ITEM_LIST";
}

function showsContentField(type: BrandTemplateType) {
  return allowsContent(type);
}

function requiresContent(type: BrandTemplateType) {
  return type === "TEXT" || type === "IMAGE" || type === "WIDE";
}

function showsAdditionalContentField(type: BrandTemplateType) {
  return allowsAdditionalContent(type);
}

function showsMainImageField(type: BrandTemplateType) {
  return allowsMainImage(type);
}

function requiresMainImage(type: BrandTemplateType) {
  return type === "IMAGE" || type === "WIDE" || type === "COMMERCE";
}

function supportsStandaloneButtons(type: BrandTemplateType) {
  return type === "TEXT" || type === "IMAGE" || type === "WIDE" || type === "PREMIUM_VIDEO" || type === "COMMERCE";
}

function supportsCoupon(type: BrandTemplateType) {
  return type === "TEXT" || type === "IMAGE" || type === "WIDE" || type === "COMMERCE";
}

function allowsContent(type: BrandTemplateType) {
  return type === "TEXT" || type === "IMAGE" || type === "WIDE" || type === "PREMIUM_VIDEO";
}

function allowsHeader(type: BrandTemplateType) {
  return type === "WIDE_ITEM_LIST" || type === "PREMIUM_VIDEO";
}

function allowsAdditionalContent(type: BrandTemplateType) {
  return type === "COMMERCE";
}

function allowsMainImage(type: BrandTemplateType) {
  return type === "IMAGE" || type === "WIDE" || type === "COMMERCE";
}
