"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppIcon } from "@/components/icons/AppIcon";
import { ManualRecipientListInput } from "@/components/recipients/ManualRecipientListInput";
import { RecipientSelectPanel } from "@/components/recipients/RecipientSelectPanel";
import { FormSelect } from "@/components/ui/FormSelect";
import { normalizeSmsAttachmentImage, readFileAsDataUrl } from "@/lib/image/sms-image-normalizer";
import { useRouteNavigate } from "@/lib/hooks/use-route-navigate";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";
import {
  MANUAL_MESSAGE_RECIPIENT_LIMIT,
  formatRecipientCountText,
  formatRecipientPhonesInput,
  parseRecipientPhonesInput,
} from "@/lib/recipient-phone-list";
import {
  createV2SmsRequest,
  fetchV2SmsSendOptions,
  fetchV2SmsSendReadiness,
  type V2SmsSendOptionsResponse,
  type V2SmsSendReadinessResponse,
} from "@/lib/api/v2";
import { useAppStore } from "@/lib/store/app-store";
import type { SmsImage } from "@/lib/store/types";
import {
  formatSmsAdvertisementPreview,
  getApprovedSms080Service,
  SmsAdvertisementControls,
  SmsAdvertisementSetupDialog,
  type SmsAdvertisementSetupStatus,
  useSmsAdvertisement080State,
} from "./SmsAdvertisementControls";

const smsSendPageCache: {
  readiness: V2SmsSendReadinessResponse | null;
  options: V2SmsSendOptionsResponse | null;
} = {
  readiness: null,
  options: null,
};

const MMS_ALLOWED_IMAGE_MIME = "image/jpeg";
const MMS_ALLOWED_IMAGE_NAME = /\.jpe?g$/i;
const MMS_MAX_IMAGE_BYTES = 300 * 1024;

function getByteLength(text: string) {
  return new Blob([text]).size;
}

function isAllowedMmsImageFile(file: File) {
  return file.type === MMS_ALLOWED_IMAGE_MIME && MMS_ALLOWED_IMAGE_NAME.test(file.name);
}

function getSmsType(body: string, images: SmsImage[]) {
  if (images.length > 0) return "mms" as const;
  return getByteLength(body) > 90 ? "lms" as const : "sms" as const;
}

export function SmsSendPage({
  initialData,
}: {
  initialData?: {
    readiness: V2SmsSendReadinessResponse | null;
    options: V2SmsSendOptionsResponse | null;
  };
}) {
  const composer = useAppStore((state) => state.smsComposer);
  const setSmsComposer = useAppStore((state) => state.setSmsComposer);
  const addSmsImage = useAppStore((state) => state.addSmsImage);
  const removeSmsImage = useAppStore((state) => state.removeSmsImage);
  const saveSmsDraft = useAppStore((state) => state.saveSmsDraft);
  const resetSmsComposer = useAppStore((state) => state.resetSmsComposer);
  const showDraftToast = useAppStore((state) => state.showDraftToast);
  const navigate = useRouteNavigate();
  const router = useRouter();
  const sms080State = useSmsAdvertisement080State();
  const imageIdRef = useRef(1);
  const advertisementCheckboxRef = useRef<HTMLElement | null>(null);
  const [readiness, setReadiness] = useState<V2SmsSendReadinessResponse | null>(() => initialData?.readiness ?? smsSendPageCache.readiness);
  const [options, setOptions] = useState<V2SmsSendOptionsResponse | null>(() => initialData?.options ?? smsSendPageCache.options);
  const [loading, setLoading] = useState(() => !(initialData?.readiness ?? smsSendPageCache.readiness));
  const [error, setError] = useState<string | null>(null);
  const [selectedSenderNumberId, setSelectedSenderNumberId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [isAdvertisement, setIsAdvertisement] = useState(false);
  const [advertisingServiceName, setAdvertisingServiceName] = useState("");
  const [advertisementSetupStatus, setAdvertisementSetupStatus] = useState<SmsAdvertisementSetupStatus>(null);
  const [advertisementDialogOpen, setAdvertisementDialogOpen] = useState(false);
  const [recipientSelectOpen, setRecipientSelectOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const previewBody = useMemo(
    () =>
      formatSmsAdvertisementPreview(composer.body, {
        isAdvertisement,
        advertisingServiceName,
        optOutNumber: sms080State.approvedService?.unsubscribeNumber,
      }),
    [advertisingServiceName, composer.body, isAdvertisement, sms080State.approvedService?.unsubscribeNumber],
  );
  const byteCount = useMemo(() => getByteLength(previewBody), [previewBody]);
  const smsType = useMemo(() => getSmsType(previewBody, composer.images), [composer.images, previewBody]);
  const maxBytes = smsType === "sms" ? 90 : 2000;
  const selectedSenderNumber =
    options?.senderNumbers.find((item) => item.id === selectedSenderNumberId) ?? options?.senderNumbers[0] ?? null;
  const recipientPhones = useMemo(() => parseRecipientPhonesInput(composer.to), [composer.to]);

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
      showDraftToast(sms080State.error || "080 번호 상태를 확인하지 못했습니다.", { tone: "error" });
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

  useMountEffect(() => {
    if (initialData?.readiness) {
      smsSendPageCache.readiness = initialData.readiness;
      smsSendPageCache.options = initialData.options ?? null;
      setReadiness(initialData.readiness);
      setOptions(initialData.options ?? null);
      setSelectedSenderNumberId((current) => current || initialData.options?.senderNumbers[0]?.id || "");
      setLoading(false);
      return;
    }

    let cancelled = false;
    const hasCachedData = Boolean(smsSendPageCache.readiness);

    const load = async () => {
      if (!hasCachedData) {
        setLoading(true);
      }
      setError(null);

      try {
        const nextReadiness = await fetchV2SmsSendReadiness();
        if (cancelled) return;

        smsSendPageCache.readiness = nextReadiness;
        setReadiness(nextReadiness);

        if (!nextReadiness.ready) {
          smsSendPageCache.options = null;
          setOptions(null);
          return;
        }

        const nextOptions = await fetchV2SmsSendOptions();
        if (cancelled) return;

        smsSendPageCache.options = nextOptions;
        setOptions(nextOptions);
        setSelectedSenderNumberId((current) => current || nextOptions.senderNumbers[0]?.id || "");
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "SMS 발송 정보를 불러오지 못했습니다.");
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

  const typeMeta = {
    sms: {
      badgeClass: "chip chip-sms",
      label: "SMS",
      reason: `${byteCount} byte · 90 이하 · 이미지 없음`,
    },
    lms: {
      badgeClass: "chip chip-event",
      label: "LMS",
      reason: `${byteCount} byte · 90 초과 → LMS 전환`,
    },
    mms: {
      badgeClass: "chip chip-kakao",
      label: "MMS",
      reason: `이미지 ${composer.images.length}개 첨부 → MMS 전환`,
    },
  }[smsType];

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const remaining = 3 - composer.images.length;
    const toAdd = files.slice(0, remaining);
    let convertedCount = 0;

    for (const file of toAdd) {
      if (!file.type.startsWith("image/")) {
        showDraftToast("이미지 파일만 첨부할 수 있습니다.", { tone: "error" });
        continue;
      }

      try {
        const normalizedFile =
          isAllowedMmsImageFile(file) && file.size <= MMS_MAX_IMAGE_BYTES
            ? file
            : await normalizeSmsAttachmentImage(file);
        const src = await readFileAsDataUrl(normalizedFile);

        if (
          normalizedFile.type !== file.type ||
          normalizedFile.name !== file.name ||
          normalizedFile.size !== file.size
        ) {
          convertedCount += 1;
        }

        addSmsImage({
          id: imageIdRef.current++,
          src,
          name: normalizedFile.name,
          size: normalizedFile.size,
          source: "local",
        });
      } catch (uploadError) {
        showDraftToast(
          uploadError instanceof Error ? uploadError.message : "이미지를 첨부하지 못했습니다.",
          { tone: "error" },
        );
      }
    }

    if (convertedCount > 0) {
      showDraftToast("이미지를 MMS용 JPG로 자동 변환했습니다.", { tone: "success" });
    }

    event.target.value = "";
  };

  const applyTemplate = () => {
    const selectedTemplate = options?.templates.find((item) => item.id === selectedTemplateId);
    if (!selectedTemplate) return;
    const templateImages = selectedTemplate.attachments.map((attachment) => ({
      id: imageIdRef.current++,
      src:
        attachment.previewDataUrl ||
        buildTemplateAttachmentPreviewDataUrl(attachment.fileName || `mms-image-${attachment.fileId}.jpg`),
      name: attachment.fileName || `mms-image-${attachment.fileId}.jpg`,
      size: attachment.size ?? 0,
      fileId: attachment.fileId,
      filePath: attachment.filePath,
      source: "template" as const,
    }));

    setSmsComposer({
      body: selectedTemplate.body,
      subject: composer.subject || selectedTemplate.title || selectedTemplate.name,
      images: templateImages,
    });

    if (templateImages.length > 0) {
      showDraftToast(`템플릿 이미지 ${templateImages.length}개를 불러왔습니다.`, { tone: "success" });
    }
  };

  const handleSubmit = async () => {
    if (!selectedSenderNumber) {
      showDraftToast("발신번호를 선택해 주세요.", { tone: "error" });
      return;
    }

    if (recipientPhones.length === 0) {
      showDraftToast("수신번호를 입력해 주세요.", { tone: "error" });
      return;
    }

    if (recipientPhones.length > MANUAL_MESSAGE_RECIPIENT_LIMIT) {
      showDraftToast(`수신자는 최대 ${MANUAL_MESSAGE_RECIPIENT_LIMIT}명까지 입력할 수 있습니다.`, { tone: "error" });
      return;
    }

    if (!composer.body.trim()) {
      showDraftToast("본문을 입력해 주세요.", { tone: "error" });
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("senderNumberId", selectedSenderNumber.id);
      formData.append("recipientPhone", recipientPhones[0]!);
      formData.append("recipientPhones", JSON.stringify(recipientPhones));
      formData.append("body", composer.body);

      if (isAdvertisement) {
        formData.append("isAdvertisement", "true");
        if (advertisingServiceName.trim()) {
          formData.append("advertisingServiceName", advertisingServiceName.trim());
        }
      }

      if (composer.subject.trim()) {
        formData.append("mmsTitle", composer.subject.trim());
      }

      if (composer.scheduleType === "later" && composer.scheduledAt) {
        formData.append("scheduledAt", new Date(composer.scheduledAt).toISOString());
      }

      const templateAttachmentFileIds: number[] = [];
      for (const image of composer.images) {
        if (image.fileId) {
          templateAttachmentFileIds.push(image.fileId);
          continue;
        }

        const rawFile = dataUrlToFile(image);
        const file =
          isAllowedMmsImageFile(rawFile) && rawFile.size <= MMS_MAX_IMAGE_BYTES
            ? rawFile
            : await normalizeSmsAttachmentImage(rawFile);
        formData.append("attachments", file);
      }

      if (templateAttachmentFileIds.length > 0) {
        formData.append("templateAttachmentFileIds", JSON.stringify(templateAttachmentFileIds));
      }

      const response = await createV2SmsRequest(formData);
      resetSmsComposer();
      setIsAdvertisement(false);
      setAdvertisingServiceName("");
      setAdvertisementSetupStatus(null);
      showDraftToast(`${formatRecipientCountText(response.acceptedCount ?? recipientPhones.length)}에게 SMS 발송 요청이 접수되었습니다. (${response.requestId.slice(0, 8)})`, {
        tone: "success",
      });
      navigate("logs");
    } catch (submitError) {
      showDraftToast(
        submitError instanceof Error ? submitError.message : "SMS 발송 요청 접수에 실패했습니다.",
        { tone: "error" },
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return (
      <div>
        <SmsSendHeader description="문자 메시지를 단건으로 발송합니다" />
        <div className="flash flash-attention">
          <AppIcon name="warn" className="icon icon-16 flash-icon" />
          <div className="flash-body">{error}</div>
        </div>
      </div>
    );
  }

  if (loading && !readiness) {
    return (
      <div>
        <SmsSendHeader description="문자 메시지를 단건으로 발송합니다" />
        <div className="sms-layout">
          <div className="loading-disabled-box">
            <div className="box">
              <div className="box-header"><div className="box-title">발신 및 수신</div></div>
              <div className="box-body">
                <div className="form-group">
                  <label className="form-label">발신번호</label>
                  <input className="form-control field-width-md" value="승인된 발신번호 확인 중" disabled readOnly />
                </div>
                <div className="form-group form-group-flush">
                  <label className="form-label">수신번호</label>
                  <input className="form-control field-width-md" value="" placeholder="010-0000-0000" disabled readOnly />
                </div>
              </div>
            </div>
            <div className="box">
              <div className="box-header"><div className="box-title">메시지 작성</div></div>
              <div className="box-body">
                <div className="form-group">
                  <label className="form-label">템플릿 선택</label>
                  <input className="form-control" value="승인된 템플릿 확인 중" disabled readOnly />
                </div>
                <div className="form-group form-group-flush">
                  <label className="form-label">메시지 내용</label>
                  <textarea className="form-control" placeholder="내용을 확인 중입니다" disabled readOnly />
                </div>
              </div>
            </div>
          </div>
          <div className="loading-disabled-box">
            <div className="box">
              <div className="box-header"><div className="box-title">미리보기</div></div>
              <div className="box-body">
                <div className="preview-empty-text">발신 준비 상태를 확인한 뒤 미리보기를 활성화합니다.</div>
              </div>
              <div className="box-footer">
                <span className="text-small">준비 중</span>
                <button className="btn btn-accent" disabled>발송하기</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (readiness && !readiness.ready) {
    return (
      <div>
        <SmsSendHeader description="문자 메시지를 단건으로 발송합니다" />
        <div className="flash flash-attention">
          <AppIcon name="warn" className="icon icon-16 flash-icon" />
          <div className="flash-body">{readiness.blockers[0]?.message || "SMS 발송 준비가 완료되지 않았습니다."}</div>
        </div>
        <div className="box">
          <div className="empty-state">
            <div className="empty-icon">
              <AppIcon name="phone" className="icon icon-40" />
            </div>
            <div className="empty-title">승인된 발신번호가 필요합니다</div>
            <div className="empty-desc">발신 자원 관리에서 발신번호를 등록하고 심사가 완료되면 이 화면에서 바로 발송할 수 있습니다.</div>
            <div className="empty-actions">
              <button className="btn btn-accent" onClick={() => navigate("resources")}>
                <AppIcon name="key" className="icon icon-14" />
                발신 자원 관리
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SmsSendHeader
        description="문자 메시지를 단건으로 발송합니다 · 내용에 따라 SMS / LMS / MMS 자동 전환"
        onGoLogs={() => navigate("logs")}
      />

      <div className="sms-layout">
        <div>
          <div className="box">
            <div className="box-header"><div className="box-title">발신 및 수신</div></div>
            <div className="box-body">
              <div className="form-group">
                <label className="form-label">발신번호 <span className="text-danger">*</span></label>
                <FormSelect
                  className="form-control field-width-md"
                  value={selectedSenderNumber?.id ?? ""}
                  onChange={(event) => setSelectedSenderNumberId(event.target.value)}
                >
                  {(options?.senderNumbers ?? []).map((item, index) => (
                    <option key={item.id} value={item.id}>
                      {item.phoneNumber} {index === 0 ? "(기본)" : ""}
                    </option>
                  ))}
                </FormSelect>
                <p className="form-hint">발신 자원 관리에서 등록한 번호만 사용할 수 있습니다.</p>
              </div>
              <div className="form-group form-group-flush">
                <label className="form-label">수신번호 <span className="text-danger">*</span></label>
                <ManualRecipientListInput
                  phones={recipientPhones}
                  onChange={(phones) => setSmsComposer({ to: formatRecipientPhonesInput(phones) })}
                  onOpenSelect={() => setRecipientSelectOpen(true)}
                  selectOpen={recipientSelectOpen}
                />
              </div>
            </div>
          </div>

          <div className="box">
            <div className="box-header">
              <div className="box-title">메시지 작성</div>
              <div className="flex gap-8">
                <FormSelect
                  className="form-control toolbar-select narrow compact"
                  value={selectedTemplateId}
                  onChange={(event) => setSelectedTemplateId(event.target.value)}
                >
                  <option value="">템플릿 선택</option>
                  {(options?.templates ?? []).map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </FormSelect>
                <button className="btn btn-default btn-sm" onClick={applyTemplate} disabled={!selectedTemplateId}>
                  <AppIcon name="copy" className="icon icon-14" />
                  불러오기
                </button>
              </div>
            </div>
            <div className="box-body">
              {smsType !== "sms" ? (
                <div className="sms-subject-field">
                  <label className="form-label">
                    제목
                    <span className="sms-field-label-note">
                      LMS / MMS 전환 시 포함됩니다
                    </span>
                  </label>
                  <input
                    className="form-control"
                    placeholder="메시지 제목 (선택)"
                    value={composer.subject}
                    onChange={(event) => setSmsComposer({ subject: event.target.value })}
                  />
                </div>
              ) : null}

              <div className="sms-body-field">
                <label className="form-label">본문 <span className="text-danger">*</span></label>
                <textarea
                  className="form-control sms-compose-textarea"
                  placeholder={"메시지 내용을 입력하세요.\n#{변수명} 형식으로 수신자별 값을 치환할 수 있습니다."}
                  value={composer.body}
                  onChange={(event) => setSmsComposer({ body: event.target.value })}
                />
              </div>

              <div className="sms-type-bar">
                <div className="sms-type-meta">
                  <span className={typeMeta.badgeClass + " draft-chip-sm"}>{typeMeta.label}</span>
                  <span className="sms-type-reason">{typeMeta.reason}</span>
                </div>
                <span className="sms-char-count">{byteCount} / {maxBytes} byte</span>
              </div>

              <SmsAdvertisementControls
                id="manual-sms-advertisement"
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

              <div className="sms-upload-section">
                <div className="sms-upload-head">
                  <span className="form-label sms-upload-label">
                    <AppIcon name="upload" className="icon icon-14 sms-upload-icon" />
                    이미지 첨부
                    <span className="sms-upload-help">선택 · 최대 3개 · 이미지 추가 시 MMS 자동 전환</span>
                  </span>
                  <span className="sms-upload-count">{composer.images.length} / 3</span>
                </div>

                <div className="sms-img-grid">
                  {composer.images.map((image, index) => (
                    <div className="sms-img-card" key={image.id}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.src} alt={image.name} />
                      <div className="sms-img-order">{index + 1}</div>
                      <button className="sms-img-remove" onClick={() => removeSmsImage(image.id)}>×</button>
                      <div className="sms-img-name">{image.name}</div>
                    </div>
                  ))}
                </div>

                {composer.images.length < 3 ? (
                  <div>
                    <label className="sms-img-add-label">
                      <AppIcon name="plus" className="icon icon-16" />
                      이미지 추가
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="sms-file-input"
                        onChange={handleImageUpload}
                      />
                    </label>
                    <p className="sms-img-hint">이미지 첨부 시 MMS 규격의 JPG로 자동 변환됩니다 · 각 300KB 이하</p>
                  </div>
                ) : null}

                {composer.images.length > 0 ? (
                  <div className="sms-mms-toast">
                    <AppIcon name="info" className="icon icon-14" />
                    이미지가 첨부되어 <strong className="sms-mms-type-label">MMS</strong>로 자동 전환되었습니다.
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="box">
            <div className="box-header"><div className="box-title">발송 시간</div></div>
            <div className="box-body">
              <div className="sms-schedule-options">
                <label className="sms-schedule-option">
                  <input
                    type="radio"
                    name="schedType"
                    checked={composer.scheduleType === "now"}
                    onChange={() => setSmsComposer({ scheduleType: "now" })}
                  />
                  즉시 발송
                </label>
                <label className="sms-schedule-option">
                  <input
                    type="radio"
                    name="schedType"
                    checked={composer.scheduleType === "later"}
                    onChange={() => setSmsComposer({ scheduleType: "later" })}
                  />
                  예약 발송
                </label>
              </div>
              {composer.scheduleType === "later" ? (
                <div>
                <input
                  type="datetime-local"
                  className="form-control field-width-md"
                  value={composer.scheduledAt}
                  onChange={(event) => setSmsComposer({ scheduledAt: event.target.value })}
                />
                  <p className="form-hint">야간 발송 제한: 오후 9시 ~ 오전 8시 사이 예약 불가</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="sms-action-bar">
            <button className="btn btn-default" onClick={saveSmsDraft}>
              <AppIcon name="inbox" className="icon icon-14" />
              임시 저장
            </button>
            <button className="btn btn-accent" onClick={handleSubmit} disabled={submitting}>
              <AppIcon name="send" className="icon icon-14" />
              {submitting ? "접수 중..." : "발송하기"}
            </button>
          </div>
        </div>

        <div className="sms-side-column">
          <div className="box box-no-margin">
            <div className="box-header"><div className="box-title">미리보기</div></div>
            <div className="box-body-tight">
              <div className="sms-preview-phone">
                <div className="sms-preview-time">오늘 오후 2:30</div>
                <div className="sms-preview-images">
                  {composer.images.map((image) => (
                    <div className="sms-preview-media-row" key={image.id}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.src} alt={image.name} />
                    </div>
                  ))}
                </div>
                <div className="sms-preview-media-row">
                  <div className="sms-preview-bubble">
                    {previewBody.trim() ? previewBody : <span className="sms-preview-placeholder">내용을 입력하면 표시됩니다</span>}
                  </div>
                </div>
                <div className="sms-preview-sender">{selectedSenderNumber?.phoneNumber || "발신번호 없음"}</div>
              </div>
            </div>
          </div>

          <div className="box box-no-margin">
            <div className="box-header"><div className="box-title">발송 체크리스트</div></div>
            <div className="box-section-tight">
              <div className="box-row sms-check-row">
                <div className="box-row-title text-small">발신번호</div>
                <span className={`label ${selectedSenderNumber ? "label-green" : "label-yellow"} status-label-sm`}><span className="label-dot" />{selectedSenderNumber ? "설정됨" : "미선택"}</span>
              </div>
              <div className="box-row sms-check-row">
                <div className="box-row-title text-small">수신번호</div>
                <span className={`label ${recipientPhones.length > 0 ? "label-green" : "label-yellow"} status-label-sm`}>
                  <span className="label-dot" />
                  {recipientPhones.length > 0 ? `${recipientPhones.length}명` : "미입력"}
                </span>
              </div>
              <div className="box-row sms-check-row">
                <div className="box-row-title text-small">본문</div>
                <span className={`label ${composer.body.trim() ? "label-green" : "label-yellow"} status-label-sm`}>
                  <span className="label-dot" />
                  {composer.body.trim() ? "입력됨" : "미입력"}
                </span>
              </div>
              <div className="box-row sms-check-row sms-check-row-last">
                <div className="box-row-title text-small">이미지</div>
                <span className={`label ${composer.images.length > 0 ? "label-blue" : "label-gray"} status-label-sm`}>
                  <span className="label-dot" />
                  {composer.images.length > 0 ? `${composer.images.length}개 첨부` : "없음 (선택)"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SmsAdvertisementSetupDialog
        open={advertisementDialogOpen}
        pendingCount={sms080State.pendingCount}
        returnFocusRef={advertisementCheckboxRef}
        onManage080={openSms080Settings}
        onClose={() => setAdvertisementDialogOpen(false)}
      />

      <RecipientSelectPanel
        open={recipientSelectOpen}
        value={recipientPhones}
        onApply={(phones) => setSmsComposer({ to: formatRecipientPhonesInput(phones) })}
        onClose={() => setRecipientSelectOpen(false)}
      />

    </div>
  );
}

function SmsSendHeader({
  description,
  onGoLogs,
}: {
  description: string;
  onGoLogs?: () => void;
}) {
  return (
    <div className="page-header">
      <div className="page-header-row">
        <div>
          <div className="page-title">SMS 발송</div>
          <div className="page-desc">{description}</div>
        </div>
        {onGoLogs ? (
          <button className="btn btn-default" onClick={onGoLogs}>
            발송 이력
          </button>
        ) : null}
      </div>
    </div>
  );
}

function dataUrlToFile(image: SmsImage) {
  const [meta, base64] = image.src.split(",");
  const mimeMatch = meta.match(/data:(.*?);base64/);
  const mimeType = mimeMatch?.[1] || "image/png";
  const binary = atob(base64 || "");
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  return new File([bytes], image.name, { type: mimeType });
}

function buildTemplateAttachmentPreviewDataUrl(fileName: string) {
  const label = escapeSvgText(fileName.length > 24 ? `${fileName.slice(0, 21)}...` : fileName);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="220" viewBox="0 0 320 220">
      <rect width="320" height="220" fill="#f6f8fa"/>
      <rect x="94" y="48" width="132" height="92" rx="10" fill="#ffffff" stroke="#d0d7de"/>
      <path d="M116 116l34-34 26 26 14-14 44 44H116z" fill="#0969da" opacity="0.22"/>
      <circle cx="204" cy="76" r="12" fill="#0969da" opacity="0.28"/>
      <text x="160" y="164" text-anchor="middle" font-family="system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="16" font-weight="700" fill="#24292f">MMS 이미지</text>
      <text x="160" y="188" text-anchor="middle" font-family="system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="12" fill="#57606a">${label}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
