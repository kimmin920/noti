"use client";

import { Button, FormControl, Select, Textarea, TextInput, ThemeProvider } from "@primer/react";
import { Dialog } from "@primer/react/experimental";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import {
  createV2SmsTemplate,
  updateV2SmsTemplate,
  uploadV2SmsTemplateImage,
  type V2CreateSmsTemplatePayload,
  type V2CreateSmsTemplateResponse,
  type V2SmsTemplateDetailResponse,
  type V2SmsTemplateSendType,
  type V2SmsTemplatesResponse,
  type V2UpdateSmsTemplateResponse,
} from "@/lib/api/v2";
import { normalizeSmsAttachmentImage, readFileAsDataUrl } from "@/lib/image/sms-image-normalizer";

const SMS_STANDARD_BYTES = 90;
const LMS_STANDARD_BYTES = 2000;
const MMS_MAX_IMAGE_COUNT = 3;
const MMS_TOTAL_BYTES_FOR_THREE = 800 * 1024;
const MMS_ALLOWED_IMAGE_MIME = "image/jpeg";
const MMS_ALLOWED_IMAGE_NAME = /\.jpe?g$/i;

type SmsTemplateFormDraft = {
  senderNumberId: string;
  categoryId: string;
  name: string;
  description: string;
  title: string;
  body: string;
};

type SmsTemplateField = keyof SmsTemplateFormDraft;
type EffectiveSmsTemplateType = V2SmsTemplateSendType | "OVER_LIMIT";

type SmsTemplateValidationIssue = {
  field: SmsTemplateField;
  message: string;
};

type SmsTemplateImage = {
  id: number;
  fileId: number;
  name: string;
  size: number;
  filePath: string | null;
  src: string | null;
};

type SmsTemplateCreateModalProps = {
  open: boolean;
  registrationTargets: V2SmsTemplatesResponse["registrationTargets"];
  categories: V2SmsTemplatesResponse["categories"];
  mode?: "create" | "edit";
  initialTemplate?: V2SmsTemplateDetailResponse["template"] | null;
  onClose: () => void;
  onSaved: (response: V2CreateSmsTemplateResponse | V2UpdateSmsTemplateResponse, mode: "create" | "edit") => void;
};

function createInitialDraft(
  registrationTargets: V2SmsTemplatesResponse["registrationTargets"],
  categories: V2SmsTemplatesResponse["categories"],
  initialTemplate: V2SmsTemplateDetailResponse["template"] | null | undefined
): SmsTemplateFormDraft {
  return {
    senderNumberId: initialTemplate?.senderNumberId ?? registrationTargets[0]?.id ?? "",
    categoryId: initialTemplate?.categoryId ? String(initialTemplate.categoryId) : categories[0]?.categoryId ? String(categories[0].categoryId) : "",
    name: initialTemplate?.name ?? "",
    description: initialTemplate?.description ?? "",
    title: initialTemplate?.title ?? "",
    body: initialTemplate?.body ?? "",
  };
}

function createInitialImages(initialTemplate: V2SmsTemplateDetailResponse["template"] | null | undefined): SmsTemplateImage[] {
  return (initialTemplate?.attachments ?? []).map((attachment, index) => ({
    id: index + 1,
    fileId: attachment.fileId,
    name: attachment.fileName || `mms-image-${attachment.fileId}.jpg`,
    size: attachment.size ?? 0,
    filePath: attachment.filePath,
    src: null,
  }));
}

export function SmsTemplateCreateModal({
  open,
  registrationTargets,
  categories,
  mode = "create",
  initialTemplate = null,
  onClose,
  onSaved,
}: SmsTemplateCreateModalProps) {
  const [draft, setDraft] = useState<SmsTemplateFormDraft>(() => createInitialDraft(registrationTargets, categories, initialTemplate));
  const [images, setImages] = useState<SmsTemplateImage[]>(() => createInitialImages(initialTemplate));
  const [validationIssue, setValidationIssue] = useState<SmsTemplateValidationIssue | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const senderRef = useRef<HTMLSelectElement | null>(null);
  const categoryRef = useRef<HTMLSelectElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const imageIdRef = useRef(1);
  const isEditMode = mode === "edit" && Boolean(initialTemplate?.id);
  const availableCategories = buildCategoryOptions(categories, initialTemplate?.categoryId, initialTemplate?.categoryName);
  const bodyByteCount = useMemo(() => getByteLength(draft.body), [draft.body]);
  const effectiveType = useMemo(() => getSmsTemplateType(draft.body, images), [draft.body, images]);
  const maxBytes = effectiveType === "SMS" ? SMS_STANDARD_BYTES : LMS_STANDARD_BYTES;
  const typeMeta = getTypeMeta(effectiveType, bodyByteCount, images.length);
  const selectedSenderNumber = registrationTargets.find((item) => item.id === draft.senderNumberId) ?? null;
  const titleRequired = effectiveType !== "SMS" && effectiveType !== "OVER_LIMIT";

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextImages = createInitialImages(initialTemplate);
    imageIdRef.current = nextImages.length + 1;
    setDraft(createInitialDraft(registrationTargets, categories, initialTemplate));
    setImages(nextImages);
    setValidationIssue(null);
    setImageError(null);
    setImageUploading(false);
    setSubmitting(false);
  }, [categories, initialTemplate, open, registrationTargets]);

  if (!open) {
    return null;
  }

  const updateDraft = (patch: Partial<SmsTemplateFormDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    if (validationIssue && patch[validationIssue.field] !== undefined) {
      setValidationIssue(null);
    }
  };

  const focusField = (field: SmsTemplateField) => {
    const refByField: Partial<Record<SmsTemplateField, { current: HTMLElement | null }>> = {
      senderNumberId: senderRef,
      categoryId: categoryRef,
      name: nameRef,
      title: titleRef,
      body: bodyRef,
    };
    refByField[field]?.current?.focus();
  };

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (selectedFiles.length === 0) {
      return;
    }

    setImageError(null);

    const availableSlots = MMS_MAX_IMAGE_COUNT - images.length;
    if (availableSlots <= 0) {
      setImageError(`MMS 이미지는 최대 ${MMS_MAX_IMAGE_COUNT}개까지 첨부할 수 있습니다.`);
      return;
    }

    const files = selectedFiles.slice(0, availableSlots);
    if (selectedFiles.length > availableSlots) {
      setImageError(`최대 ${MMS_MAX_IMAGE_COUNT}개까지만 첨부됩니다. 초과 파일은 제외했습니다.`);
    }

    setImageUploading(true);
    try {
      const preparedImages: Array<{ file: File; src: string }> = [];

      for (const file of files) {
        if (!isAllowedMmsImageFile(file)) {
          throw new Error("MMS 이미지는 jpg/jpeg 형식만 첨부할 수 있습니다.");
        }

        const normalizedFile = await normalizeSmsAttachmentImage(file);
        const src = await readFileAsDataUrl(normalizedFile);
        preparedImages.push({ file: normalizedFile, src });
      }

      const nextTotalSize =
        images.reduce((sum, image) => sum + image.size, 0) + preparedImages.reduce((sum, item) => sum + item.file.size, 0);
      const nextCount = images.length + preparedImages.length;
      if (nextCount === MMS_MAX_IMAGE_COUNT && nextTotalSize > MMS_TOTAL_BYTES_FOR_THREE) {
        throw new Error("MMS 이미지는 3개 첨부 시 총 800KB 이하로 첨부할 수 있습니다.");
      }

      const uploadedImages: SmsTemplateImage[] = [];
      for (const item of preparedImages) {
        const uploaded = await uploadV2SmsTemplateImage(item.file);
        uploadedImages.push({
          id: imageIdRef.current++,
          fileId: uploaded.fileId,
          name: uploaded.fileName || item.file.name,
          size: uploaded.size ?? item.file.size,
          filePath: uploaded.filePath,
          src: item.src,
        });
      }

      setImages((current) => [...current, ...uploadedImages].slice(0, MMS_MAX_IMAGE_COUNT));
      setValidationIssue(null);
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "MMS 이미지를 첨부하지 못했습니다.");
    } finally {
      setImageUploading(false);
    }
  };

  const removeImage = (imageId: number) => {
    setImages((current) => current.filter((image) => image.id !== imageId));
    setImageError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const issue = validateDraft(draft, isEditMode, effectiveType, images);
    if (issue) {
      setValidationIssue(issue);
      focusField(issue.field);
      return;
    }

    const payload: V2CreateSmsTemplatePayload = {
      senderNumberId: draft.senderNumberId,
      categoryId: Number(draft.categoryId),
      sendType: effectiveType as V2SmsTemplateSendType,
      name: draft.name.trim(),
      body: draft.body.trim(),
      attachments: images.map((image) => ({
        fileId: image.fileId,
        fileName: image.name,
        size: image.size,
        ...(image.src ? { previewDataUrl: image.src } : {}),
      })),
      ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
      ...(draft.title.trim() ? { title: draft.title.trim() } : {}),
    };

    setSubmitting(true);
    try {
      const response = isEditMode && initialTemplate?.id
        ? await updateV2SmsTemplate(initialTemplate.id, payload)
        : await createV2SmsTemplate(payload);
      onSaved(response, isEditMode ? "edit" : "create");
    } catch (error) {
      setValidationIssue({
        field: "body",
        message: error instanceof Error ? error.message : "SMS 템플릿을 저장하지 못했습니다.",
      });
      bodyRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  const categoryDisabled = isEditMode || availableCategories.length === 0;
  const controlsDisabled = submitting || imageUploading;

  return (
    <ThemeProvider colorMode="light" dayScheme="light" preventSSRMismatch>
      <Dialog
        title={isEditMode ? "SMS 템플릿 수정" : "SMS 템플릿 등록"}
        subtitle="NHN SMS 템플릿으로 저장합니다"
        onClose={onClose}
        position={{ narrow: "fullscreen", regular: "center" }}
        width="xlarge"
        className="sms-template-dialog"
      >
        <form className="sms-template-dialog-form" onSubmit={handleSubmit}>
          <div className="sms-template-dialog-grid">
            <div className="sms-template-dialog-fields">
              <FormControl required>
                <FormControl.Label>발신번호</FormControl.Label>
                <Select
                  ref={senderRef}
                  block
                  value={draft.senderNumberId}
                  validationStatus={validationIssue?.field === "senderNumberId" ? "error" : undefined}
                  onChange={(event) => updateDraft({ senderNumberId: event.target.value })}
                >
                  {registrationTargets.length === 0 ? <Select.Option value="">승인된 발신번호 없음</Select.Option> : null}
                  {registrationTargets.map((item) => (
                    <Select.Option key={item.id} value={item.id}>{item.phoneNumber}</Select.Option>
                  ))}
                </Select>
                {validationIssue?.field === "senderNumberId" ? (
                  <FormControl.Validation variant="error">{validationIssue.message}</FormControl.Validation>
                ) : null}
              </FormControl>

              <FormControl required>
                <FormControl.Label>카테고리</FormControl.Label>
                <Select
                  ref={categoryRef}
                  block
                  value={draft.categoryId}
                  disabled={categoryDisabled}
                  validationStatus={validationIssue?.field === "categoryId" ? "error" : undefined}
                  onChange={(event) => updateDraft({ categoryId: event.target.value })}
                >
                  {availableCategories.length === 0 ? <Select.Option value="">카테고리 없음</Select.Option> : null}
                  {availableCategories.map((item) => (
                    <Select.Option key={item.categoryId} value={String(item.categoryId)}>
                      {item.categoryName}
                    </Select.Option>
                  ))}
                </Select>
                <FormControl.Caption>{isEditMode ? "NHN SMS 템플릿 카테고리는 등록 후 바꿀 수 없습니다." : "NHN 콘솔에 등록된 카테고리입니다."}</FormControl.Caption>
                {validationIssue?.field === "categoryId" ? (
                  <FormControl.Validation variant="error">{validationIssue.message}</FormControl.Validation>
                ) : null}
              </FormControl>

              <FormControl required>
                <FormControl.Label>템플릿명</FormControl.Label>
                <TextInput
                  ref={nameRef}
                  block
                  value={draft.name}
                  maxLength={50}
                  validationStatus={validationIssue?.field === "name" ? "error" : undefined}
                  onChange={(event) => updateDraft({ name: event.target.value })}
                />
                {validationIssue?.field === "name" ? (
                  <FormControl.Validation variant="error">{validationIssue.message}</FormControl.Validation>
                ) : null}
              </FormControl>

              <FormControl>
                <FormControl.Label>설명</FormControl.Label>
                <TextInput
                  block
                  value={draft.description}
                  maxLength={100}
                  onChange={(event) => updateDraft({ description: event.target.value })}
                />
              </FormControl>

              <FormControl required={titleRequired}>
                <FormControl.Label>제목</FormControl.Label>
                <TextInput
                  ref={titleRef}
                  block
                  value={draft.title}
                  maxLength={120}
                  validationStatus={validationIssue?.field === "title" ? "error" : undefined}
                  onChange={(event) => updateDraft({ title: event.target.value })}
                />
                <FormControl.Caption>LMS / MMS 전환 시 포함됩니다.</FormControl.Caption>
                {validationIssue?.field === "title" ? (
                  <FormControl.Validation variant="error">{validationIssue.message}</FormControl.Validation>
                ) : null}
              </FormControl>

              <FormControl required>
                <FormControl.Label>본문</FormControl.Label>
                <Textarea
                  ref={bodyRef}
                  block
                  rows={8}
                  resize="vertical"
                  value={draft.body}
                  maxLength={4000}
                  validationStatus={validationIssue?.field === "body" ? "error" : undefined}
                  onChange={(event) => updateDraft({ body: event.target.value })}
                />
                <FormControl.Caption>변수는 #{`{name}`} 형식으로 입력합니다.</FormControl.Caption>
                {validationIssue?.field === "body" ? (
                  <FormControl.Validation variant="error">{validationIssue.message}</FormControl.Validation>
                ) : null}
              </FormControl>

              <div className="sms-type-bar sms-template-type-bar">
                <div className="sms-type-meta">
                  <span className={typeMeta.badgeClass + " draft-chip-sm"}>{typeMeta.label}</span>
                  <span className="sms-type-reason">{typeMeta.reason}</span>
                </div>
                <span className="sms-char-count">{bodyByteCount} / {maxBytes} byte</span>
              </div>

              <div className="sms-upload-section">
                <div className="sms-upload-head">
                  <span className="form-label sms-upload-label">
                    <AppIcon name="upload" className="icon icon-14 sms-upload-icon" />
                    이미지 첨부
                    <span className="sms-upload-help">선택 · 최대 3개 · 추가 시 MMS 자동 전환</span>
                  </span>
                  <span className="sms-upload-count">{images.length} / {MMS_MAX_IMAGE_COUNT}</span>
                </div>

                {images.length > 0 ? (
                  <div className="sms-img-grid">
                    {images.map((image, index) => (
                      <div className="sms-img-card" key={image.id}>
                        {image.src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={image.src} alt={image.name} />
                        ) : (
                          <div className="sms-template-img-placeholder">
                            <AppIcon name="upload" className="icon icon-16" />
                          </div>
                        )}
                        <div className="sms-img-order">{index + 1}</div>
                        <button
                          className="sms-img-remove"
                          type="button"
                          disabled={controlsDisabled}
                          aria-label={`${image.name} 제거`}
                          onClick={() => removeImage(image.id)}
                        >
                          <AppIcon name="x" className="icon icon-12" />
                        </button>
                        <div className="sms-img-name">{image.name}</div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {images.length < MMS_MAX_IMAGE_COUNT ? (
                  <div>
                    <label className="sms-img-add-label">
                      <AppIcon name="plus" className="icon icon-16" />
                      {imageUploading ? "업로드 중" : "이미지 추가"}
                      <input
                        type="file"
                        accept="image/jpeg,.jpg,.jpeg"
                        multiple
                        disabled={controlsDisabled}
                        className="sms-file-input"
                        onChange={handleImageUpload}
                      />
                    </label>
                    <p className="sms-img-hint">jpg/jpeg · 각 300KB 이하 · 3개 첨부 시 총 800KB 이하</p>
                  </div>
                ) : null}

                {imageError ? <p className="sms-template-image-error">{imageError}</p> : null}

                {images.length > 0 ? (
                  <div className="sms-mms-toast">
                    <AppIcon name="info" className="icon icon-14" />
                    이미지가 첨부되어 <strong className="sms-mms-type-label">MMS</strong>로 자동 전환되었습니다.
                  </div>
                ) : null}
              </div>
            </div>

            <aside className="sms-template-preview-column" aria-label="SMS 템플릿 미리보기">
              <div className="sms-template-preview-header">
                <span className="sms-template-preview-title">미리보기</span>
                <span className={typeMeta.badgeClass + " draft-chip-sm"}>{typeMeta.label}</span>
              </div>
              <div className="sms-preview-phone">
                <div className="sms-preview-time">오늘 오후 2:30</div>
                {images.length > 0 ? (
                  <div className="sms-preview-images">
                    {images.map((image) =>
                      image.src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={image.id} src={image.src} alt={image.name} />
                      ) : (
                        <div className="sms-template-preview-image-placeholder" key={image.id}>
                          {image.name}
                        </div>
                      )
                    )}
                  </div>
                ) : null}
                <div className="sms-preview-media-row">
                  <div className="sms-preview-bubble">
                    {draft.body.trim() ? draft.body : <span className="sms-preview-placeholder">메시지 본문</span>}
                  </div>
                </div>
                <div className="sms-preview-sender">{selectedSenderNumber?.phoneNumber ?? "발신번호 없음"}</div>
              </div>
            </aside>
          </div>

          <div className="sms-template-dialog-actions">
            <Button type="button" onClick={onClose} disabled={controlsDisabled}>취소</Button>
            <Button type="submit" variant="primary" disabled={controlsDisabled || effectiveType === "OVER_LIMIT"}>
              {submitting ? "저장 중" : imageUploading ? "업로드 중" : isEditMode ? "수정" : "등록"}
            </Button>
          </div>
        </form>
      </Dialog>
    </ThemeProvider>
  );
}

function validateDraft(
  draft: SmsTemplateFormDraft,
  isEditMode: boolean,
  effectiveType: EffectiveSmsTemplateType,
  images: SmsTemplateImage[]
): SmsTemplateValidationIssue | null {
  if (!draft.senderNumberId) {
    return { field: "senderNumberId", message: "승인된 발신번호를 선택해 주세요." };
  }

  if (!isEditMode && !Number.isInteger(Number(draft.categoryId))) {
    return { field: "categoryId", message: "SMS 템플릿 카테고리를 선택해 주세요." };
  }

  if (!draft.name.trim()) {
    return { field: "name", message: "템플릿명을 입력해 주세요." };
  }

  if (!draft.body.trim()) {
    return { field: "body", message: "본문을 입력해 주세요." };
  }

  if (effectiveType === "OVER_LIMIT") {
    return {
      field: "body",
      message: images.length > 0 ? "이미지를 첨부한 MMS 본문은 2,000byte 이하로 입력하세요." : "본문이 SMS/LMS 표준 규격 2,000byte를 초과했습니다.",
    };
  }

  if (effectiveType !== "SMS" && !draft.title.trim()) {
    return { field: "title", message: "LMS/MMS 템플릿 제목을 입력해 주세요." };
  }

  if (images.length > MMS_MAX_IMAGE_COUNT) {
    return { field: "body", message: `MMS 이미지는 최대 ${MMS_MAX_IMAGE_COUNT}개까지 첨부할 수 있습니다.` };
  }

  if (images.length === MMS_MAX_IMAGE_COUNT) {
    const totalSize = images.reduce((sum, image) => sum + image.size, 0);
    if (totalSize > MMS_TOTAL_BYTES_FOR_THREE) {
      return { field: "body", message: "MMS 이미지는 3개 첨부 시 총 800KB 이하로 첨부할 수 있습니다." };
    }
  }

  return null;
}

function buildCategoryOptions(
  categories: V2SmsTemplatesResponse["categories"],
  initialCategoryId: number | null | undefined,
  initialCategoryName: string | null | undefined
) {
  if (!initialCategoryId || categories.some((item) => item.categoryId === initialCategoryId)) {
    return categories;
  }

  return [
    {
      categoryId: initialCategoryId,
      categoryParentId: null,
      depth: null,
      categoryName: initialCategoryName || String(initialCategoryId),
      categoryDesc: null,
    },
    ...categories,
  ];
}

function getByteLength(text: string) {
  let total = 0;

  for (const character of String(text ?? "").replace(/\r\n?/g, "\n")) {
    total += (character.codePointAt(0) ?? 0) <= 0x7f ? 1 : 2;
  }

  return total;
}

function isAllowedMmsImageFile(file: File) {
  return file.type === MMS_ALLOWED_IMAGE_MIME && MMS_ALLOWED_IMAGE_NAME.test(file.name);
}

function getSmsTemplateType(body: string, images: SmsTemplateImage[]): EffectiveSmsTemplateType {
  const byteCount = getByteLength(body);

  if (byteCount > LMS_STANDARD_BYTES) {
    return "OVER_LIMIT";
  }

  if (images.length > 0) {
    return "MMS";
  }

  return byteCount > SMS_STANDARD_BYTES ? "LMS" : "SMS";
}

function getTypeMeta(type: EffectiveSmsTemplateType, byteCount: number, imageCount: number) {
  if (type === "SMS") {
    return {
      badgeClass: "chip chip-sms",
      label: "SMS",
      reason: `${byteCount} byte · 90 이하 · 이미지 없음`,
    };
  }

  if (type === "MMS") {
    return {
      badgeClass: "chip chip-kakao",
      label: "MMS",
      reason: `이미지 ${imageCount}개 첨부 → MMS 전환`,
    };
  }

  if (type === "OVER_LIMIT") {
    return {
      badgeClass: "chip chip-neutral",
      label: "초과",
      reason: `${byteCount} byte · 2,000 초과`,
    };
  }

  return {
    badgeClass: "chip chip-event",
    label: "LMS",
    reason: `${byteCount} byte · 90 초과 → LMS 전환`,
  };
}
