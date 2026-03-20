'use client';

import { useMemo, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { CheckCircle2, FileText, ImagePlus, Info, Sparkles, TriangleAlert, X } from 'lucide-react';
import { statusVariant } from '@/lib/status';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { formatAttachmentSize, validateMmsAttachments } from '@/lib/mms-attachments';
import {
  buildDomesticMmsTitle,
  classifyDomesticSmsBody,
  DOMESTIC_LMS_STANDARD_BYTES,
  DOMESTIC_SMS_STANDARD_BYTES,
  getDomesticSmsByteLength
} from '@/lib/sms-message-spec';
import { cn } from '@/lib/utils';
import { SMS_ADVERTISEMENT_OPT_OUT_TEXT } from '@/lib/sms-advertisement';
import type { Template } from '@/types/admin';
import { InlineSendScheduler } from '@/components/inline-send-scheduler';

const SMS_GUIDE_LINKS = {
  international: 'https://docs.nhncloud.com/ko/Notification/SMS/ko/international-sending-policy/',
  deliveryPolicy: 'https://docs.nhncloud.com/ko/Notification/SMS/ko/sending-policy/'
} as const;

export interface DirectSendSectionProps {
  approvedSenderNumbers: any[];
  manualSmsForm: any;
  setManualSmsForm: (val: any) => void;
  directSmsTemplateOptions: Template[];
  selectedManualSmsTemplate: Template | null;
  manualSmsVariables: Record<string, string>;
  setManualSmsVariables: (val: any) => void;
  renderedManualSmsBody: string;
  formattedManualSmsBody: string;
  sendingManualSms: boolean;
  sendDirectSms: (scheduledAt?: string | null) => Promise<void>;
  readySenderProfiles: any[];
  manualAlimtalkForm: any;
  setManualAlimtalkForm: (val: any) => void;
  directAlimtalkTemplateOptions: any[];
  selectedDirectAlimtalkTemplate: any | null;
  manualAlimtalkVariables: Record<string, string>;
  setManualAlimtalkVariables: (val: any) => void;
  sendingManualAlimtalk: boolean;
  sendDirectAlimtalk: (scheduledAt?: string | null) => Promise<void>;
}

interface SmsSendCardProps {
  approvedSenderNumbers: any[];
  manualSmsForm: any;
  setManualSmsForm: (val: any) => void;
  directSmsTemplateOptions: Template[];
  selectedManualSmsTemplate: Template | null;
  manualSmsVariables: Record<string, string>;
  setManualSmsVariables: (val: any) => void;
  renderedManualSmsBody: string;
  formattedManualSmsBody: string;
  sendingManualSms: boolean;
  sendDirectSms: (scheduledAt?: string | null) => Promise<void>;
  className?: string;
}

interface AlimtalkSendCardProps {
  approvedSenderNumbers: any[];
  readySenderProfiles: any[];
  manualAlimtalkForm: any;
  setManualAlimtalkForm: (val: any) => void;
  directAlimtalkTemplateOptions: any[];
  selectedDirectAlimtalkTemplate: any | null;
  manualAlimtalkVariables: Record<string, string>;
  setManualAlimtalkVariables: (val: any) => void;
  sendingManualAlimtalk: boolean;
  sendDirectAlimtalk: (scheduledAt?: string | null) => Promise<void>;
  className?: string;
}

export function SmsSendCard({
  approvedSenderNumbers,
  manualSmsForm,
  setManualSmsForm,
  directSmsTemplateOptions,
  selectedManualSmsTemplate,
  manualSmsVariables,
  setManualSmsVariables,
  renderedManualSmsBody,
  formattedManualSmsBody,
  sendingManualSms,
  sendDirectSms,
  className
}: SmsSendCardProps) {
  const [attachmentErrorMessages, setAttachmentErrorMessages] = useState<string[]>([]);
  const usingTemplate = Boolean(selectedManualSmsTemplate);
  const templateVariableCount = selectedManualSmsTemplate?.requiredVariables.length ?? 0;
  const attachments = manualSmsForm.attachments ?? [];
  const effectiveBody = formattedManualSmsBody;
  const currentByteLength = useMemo(() => getDomesticSmsByteLength(effectiveBody), [effectiveBody]);
  const currentMessageType = useMemo(
    () =>
      classifyDomesticSmsBody(effectiveBody, {
        hasAttachments: attachments.length > 0
      }),
    [attachments.length, effectiveBody]
  );
  const currentTypeLabel = currentMessageType === 'OVER_LIMIT' ? '전송 제한 초과' : currentMessageType;
  const currentTypeDescription =
    currentMessageType === 'SMS'
      ? `현재 본문은 ${DOMESTIC_SMS_STANDARD_BYTES}byte 이내라 SMS로 발송됩니다.`
      : currentMessageType === 'LMS'
        ? `현재 본문이 ${DOMESTIC_SMS_STANDARD_BYTES}byte를 넘어 LMS로 전환됩니다.`
        : currentMessageType === 'MMS'
          ? `이미지 ${attachments.length}개가 첨부되어 MMS로 발송됩니다.`
          : `본문이 ${DOMESTIC_LMS_STANDARD_BYTES}byte를 넘어 현재 규격으로는 발송할 수 없습니다.`;
  const currentTypeBadgeClassName =
    currentMessageType === 'SMS'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : currentMessageType === 'LMS'
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : currentMessageType === 'MMS'
          ? 'border-violet-200 bg-violet-50 text-violet-700'
          : 'border-destructive/20 bg-destructive/10 text-destructive';
  const suggestedMmsTitle = useMemo(
    () => buildDomesticMmsTitle(effectiveBody, manualSmsForm.mmsTitle),
    [effectiveBody, manualSmsForm.mmsTitle]
  );
  const attachmentTotalSize = useMemo(
    () => attachments.reduce((sum: number, file: File) => sum + file.size, 0),
    [attachments]
  );
  const primaryLabel =
    currentMessageType === 'MMS'
      ? 'MMS 보내기'
      : currentMessageType === 'LMS'
        ? 'LMS 보내기'
        : 'SMS 보내기';

  async function handleAttachmentSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (files.length === 0) {
      setAttachmentErrorMessages([]);
      setManualSmsForm((previous: any) => ({
        ...previous,
        attachments: []
      }));
      return;
    }

    const result = await validateMmsAttachments(files);
    setAttachmentErrorMessages(result.errors);
    setManualSmsForm((previous: any) => ({
      ...previous,
      attachments: result.attachments.map((attachment) => attachment.file)
    }));
  }

  function removeAttachment(index: number) {
    setAttachmentErrorMessages([]);
    setManualSmsForm((previous: any) => ({
      ...previous,
      attachments: (previous.attachments ?? []).filter((_: File, fileIndex: number) => fileIndex !== index)
    }));
  }

  return (
    <Card className={cn('glass', className)}>
      <CardHeader>
        <CardTitle>직접 SMS 발송</CardTitle>
        <CardDescription>직접 작성하거나 저장된 템플릿을 불러와 변수값을 채운 뒤 보내기 버튼 옆 예약 아이콘으로 즉시 발송과 예약 발송을 모두 접수할 수 있습니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border bg-slate-50 p-4 dark:bg-slate-900/50">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-semibold">사용 가능한 번호</span>
            </div>
            <Badge variant="secondary">{approvedSenderNumbers.length}개</Badge>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>발신 번호 선택</Label>
              <Select
                value={manualSmsForm.senderNumberId}
                onValueChange={(v) => setManualSmsForm((p: any) => ({ ...p, senderNumberId: v }))}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="발신 번호 선택" />
                </SelectTrigger>
                <SelectContent>
                  {approvedSenderNumbers.map((sender) => (
                    <SelectItem key={sender.id} value={sender.id}>
                      {sender.phoneNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>수신 번호</Label>
              <Input
                placeholder="01012345678"
                value={manualSmsForm.recipientPhone}
                onChange={(e) => setManualSmsForm((p: any) => ({ ...p, recipientPhone: e.target.value }))}
                className="bg-white"
              />
            </div>

            <div className="rounded-3xl border border-primary/10 bg-white/90 p-4 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">템플릿 불러오기</span>
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    저장된 SMS 템플릿을 선택하면 필요한 변수 입력칸이 자동으로 나타납니다.
                  </p>
                </div>
                <Link
                  href="/send/sms/templates"
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0')}
                >
                  템플릿 관리
                </Link>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>SMS 템플릿 선택</Label>
                  <Select
                    value={manualSmsForm.templateId || '__manual__'}
                    onValueChange={(value) =>
                      setManualSmsForm((previous: any) => ({
                        ...previous,
                        templateId: value === '__manual__' ? '' : value
                      }))
                    }
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="템플릿을 선택하거나 직접 작성하세요." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__manual__">직접 작성</SelectItem>
                      {directSmsTemplateOptions.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name} · {template.status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {directSmsTemplateOptions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-background/70 px-4 py-3 text-xs leading-5 text-muted-foreground">
                    불러올 SMS 템플릿이 없습니다. 먼저 템플릿 관리에서 템플릿을 만들어 주세요.
                  </div>
                ) : null}

                {selectedManualSmsTemplate ? (
                  <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="font-semibold text-foreground">{selectedManualSmsTemplate.name}</span>
                          <Badge variant={statusVariant(selectedManualSmsTemplate.status)}>
                            {selectedManualSmsTemplate.status}
                          </Badge>
                        </div>
                        <p className="text-xs leading-5 text-muted-foreground">
                          본문에 들어가는 변수 {templateVariableCount}개를 채우면 최종 SMS가 아래에서 바로 렌더링됩니다.
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 whitespace-pre-wrap rounded-2xl border border-primary/10 bg-background/90 px-4 py-3 text-sm leading-6 text-muted-foreground">
                      {selectedManualSmsTemplate.body}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {selectedManualSmsTemplate && templateVariableCount > 0 ? (
              <div className="space-y-3 rounded-3xl border border-secondary/20 bg-secondary/5 p-4">
                <div className="space-y-1">
                  <Label className="text-sm font-semibold text-foreground">템플릿 변수 입력</Label>
                  <p className="text-xs leading-5 text-muted-foreground">
                    선택한 템플릿에 정의된 변수만 보여줍니다. 입력값은 아래 미리보기에 즉시 반영됩니다.
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {selectedManualSmsTemplate.requiredVariables.map((variable) => (
                    <div key={variable} className="space-y-2 rounded-2xl border bg-white/90 px-3 py-3 shadow-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.18em]">
                          변수
                        </Badge>
                        <span className="text-sm font-semibold text-foreground">{variable}</span>
                      </div>
                      <Input
                        placeholder={`${variable} 값을 입력하세요`}
                        value={manualSmsVariables[variable] || ''}
                        onChange={(event) =>
                          setManualSmsVariables((previous: any) => ({
                            ...previous,
                            [variable]: event.target.value
                          }))
                        }
                        className="bg-white"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>{usingTemplate ? '최종 발송 본문' : '메시지 본문'}</Label>
              <Textarea
                placeholder={usingTemplate ? '템플릿 변수 값을 입력하면 본문이 여기에 표시됩니다.' : '전송할 내용을 입력하세요...'}
                value={usingTemplate ? renderedManualSmsBody : manualSmsForm.body}
                readOnly={usingTemplate}
                onChange={(e) => setManualSmsForm((p: any) => ({ ...p, body: e.target.value }))}
                className={cn(
                  'min-h-[120px] resize-none bg-white',
                  usingTemplate ? 'border-primary/20 bg-primary/5 text-foreground' : ''
                )}
              />
              {usingTemplate ? (
                <p className="text-xs leading-5 text-muted-foreground">
                  템플릿을 사용 중일 때 본문은 변수값 기준으로 자동 생성됩니다. 직접 작성으로 바꾸면 자유 입력이 다시 활성화됩니다.
                </p>
              ) : null}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-sky-600" />
                    <span className="text-sm font-semibold text-foreground">SMS/LMS/MMS 자동 전환 안내</span>
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    최대 글자 수는 저장 기준입니다. 문자 잘림 방지를 위해 최대 글자 수가 아닌 표준 규격을 기준으로 작성하세요.
                  </p>
                </div>
                <Badge variant="outline" className={cn('rounded-full px-3 py-1 text-xs font-semibold', currentTypeBadgeClassName)}>
                  {currentTypeLabel}
                </Badge>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                <div className={cn('rounded-2xl border px-4 py-4', currentTypeBadgeClassName)}>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    {currentMessageType === 'OVER_LIMIT' ? (
                      <TriangleAlert className="h-4 w-4" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    현재 발송 타입
                  </div>
                  <div className="mt-2 text-2xl font-semibold">{currentTypeLabel}</div>
                  <p className="mt-2 text-xs leading-5">{currentTypeDescription}</p>
                  <div className="mt-4 rounded-2xl bg-white/70 px-3 py-3 text-xs leading-5 text-slate-700">
                    현재 본문 길이 {currentByteLength}byte
                    <br />
                    국내 SMS 표준 {DOMESTIC_SMS_STANDARD_BYTES}byte / LMS, MMS 표준 {DOMESTIC_LMS_STANDARD_BYTES}byte
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-xs leading-5 text-muted-foreground">
                  국내 SMS 90byte(한글 45자, 영문 90자), 국내 LMS 2,000byte(한글 1,000자, 영문 2,000자), 국내 MMS 2,000byte(이미지 포함 한글 1,000자, 영문 2,000자)
                  <br />
                  국제 SMS UCS-2 335자, 국제 SMS GSM-7bit 765자
                  <br />
                  국제 SMS의 경우 인코딩과 글자 수에 따라 concat됩니다.{' '}
                  <a
                    href={SMS_GUIDE_LINKS.international}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary underline underline-offset-4"
                  >
                    가이드 바로 가기
                  </a>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-xs leading-6 text-muted-foreground">
                발신 번호 차단으로 문자 전송에 실패한 경우에는 '번호 도용 문자 차단 서비스'를 확인하세요.{' '}
                <a
                  href={SMS_GUIDE_LINKS.deliveryPolicy}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary underline underline-offset-4"
                >
                  가이드 바로 가기
                </a>
                <br />
                전송 결과는 '성공'으로 표시되나 실제로 문자를 수신하지 못한 경우 '통신사 스팸 차단 서비스'를 확인하세요.{' '}
                <a
                  href={SMS_GUIDE_LINKS.deliveryPolicy}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary underline underline-offset-4"
                >
                  가이드 바로 가기
                </a>
              </div>
            </div>

            <div className="rounded-3xl border border-violet-200 bg-violet-50/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ImagePlus className="h-4 w-4 text-violet-600" />
                    <span className="text-sm font-semibold text-foreground">이미지 첨부</span>
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    이미지를 첨부하면 자동으로 MMS로 전환됩니다. 파일은 선택 즉시 규격을 검사합니다.
                  </p>
                </div>
                <Badge variant="outline" className="rounded-full border-violet-200 bg-white/80 px-3 py-1 text-violet-700">
                  {attachments.length} / 3장
                </Badge>
              </div>

              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-violet-200/80 bg-white/80 px-4 py-4">
                  <Label htmlFor="sms-mms-attachments">MMS 첨부 파일</Label>
                  <Input
                    id="sms-mms-attachments"
                    type="file"
                    accept=".jpg,.jpeg,image/jpeg"
                    multiple
                    onChange={handleAttachmentSelection}
                    className="mt-2 h-auto cursor-pointer py-2 file:mr-3 file:rounded-md file:border file:border-violet-200 file:bg-violet-50 file:px-3 file:py-1 file:text-xs file:text-violet-700"
                  />
                  <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                    MMS 최대 크기: 1000x1000 이하 파일만 첨부 가능
                    <br />
                    MMS 지원 규격: 1개당 300KB 이하, 이미지가 3개일 경우 합산 800KB 이하, .jpg/.jpeg 파일만 첨부 가능
                  </p>
                </div>

                {attachmentErrorMessages.length > 0 ? (
                  <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-xs leading-5 text-destructive">
                    {attachmentErrorMessages.map((message) => (
                      <div key={message}>{message}</div>
                    ))}
                  </div>
                ) : null}

                {attachments.length > 0 ? (
                  <div className="rounded-2xl border border-violet-200/80 bg-white px-4 py-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-foreground">첨부된 이미지</div>
                      <div className="text-[11px] text-muted-foreground">총 용량 {formatAttachmentSize(attachmentTotalSize)}</div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {attachments.map((file: File, index: number) => (
                        <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl border border-violet-100 bg-violet-50/60 px-3 py-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-foreground">{file.name}</div>
                            <div className="text-[11px] text-muted-foreground">{formatAttachmentSize(file.size)}</div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeAttachment(index)}
                            className="h-8 rounded-full border-violet-200 bg-white px-3 text-violet-700"
                          >
                            <X className="mr-1 h-3.5 w-3.5" />
                            제거
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {attachments.length > 0 ? (
                  <div className="rounded-2xl border border-violet-200/80 bg-white px-4 py-4 shadow-sm">
                    <Label>MMS 제목</Label>
                    <Input
                      placeholder={suggestedMmsTitle}
                      value={manualSmsForm.mmsTitle}
                      onChange={(event) =>
                        setManualSmsForm((previous: any) => ({
                          ...previous,
                          mmsTitle: event.target.value
                        }))
                      }
                      className="mt-2 bg-white"
                    />
                    <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                      비워두면 `{suggestedMmsTitle}` 제목으로 자동 생성됩니다.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={Boolean(manualSmsForm.isAdvertisement)}
                  onChange={(event) =>
                    setManualSmsForm((previous: any) => ({
                      ...previous,
                      isAdvertisement: event.target.checked
                    }))
                  }
                  className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-foreground">광고메시지 여부</div>
                  <div className="text-xs leading-5 text-muted-foreground">
                    광고문자를 발송하는 경우 반드시 체크합니다. 체크 시 메시지 상단에 `(광고)서비스명`, 하단에{' '}
                    <code className="rounded bg-white px-1 py-0.5 text-[11px] text-amber-900">{SMS_ADVERTISEMENT_OPT_OUT_TEXT}</code>
                    가 자동 포함됩니다.
                  </div>
                  <div className="rounded-2xl border border-amber-200/80 bg-white/80 px-3 py-3 text-[11px] leading-5 text-amber-950">
                    광고 문자임에도 광고 표기 가이드라인을 지키지 않으면 이용약관에 따라 예고 없이 계정이 차단될 수 있으며, 환불도 불가능합니다.
                  </div>
                </div>
              </label>

              {manualSmsForm.isAdvertisement ? (
                <div className="mt-4 space-y-3">
                  <div className="space-y-2">
                    <Label>광고 서비스명</Label>
                    <Input
                      placeholder="예: 비주오"
                      value={manualSmsForm.advertisingServiceName || ''}
                      onChange={(event) =>
                        setManualSmsForm((previous: any) => ({
                          ...previous,
                          advertisingServiceName: event.target.value
                        }))
                      }
                      className="bg-white"
                    />
                    <p className="text-[11px] leading-5 text-muted-foreground">
                      아직 사업자 정보 자동 채움은 연결 전이라 비워둘 수 있습니다. 비워두면 상단에는 `(광고)`만 붙습니다.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-amber-300/80 bg-white px-4 py-4 shadow-sm">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">실제 발송 미리보기</div>
                    <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
                      {formattedManualSmsBody || '본문을 입력하면 광고 표기 포함 최종 본문이 여기에 표시됩니다.'}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <InlineSendScheduler
              tone="sms"
              primaryLabel={primaryLabel}
              scheduledPrimaryLabel="지금 보내기"
              loadingLabel="발송 중..."
              loading={sendingManualSms}
              onPrimaryAction={() => sendDirectSms(null)}
              onScheduledAction={(scheduledAt) => sendDirectSms(scheduledAt)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AlimtalkSendCard({
  approvedSenderNumbers,
  readySenderProfiles,
  manualAlimtalkForm,
  setManualAlimtalkForm,
  directAlimtalkTemplateOptions,
  selectedDirectAlimtalkTemplate,
  manualAlimtalkVariables,
  setManualAlimtalkVariables,
  sendingManualAlimtalk,
  sendDirectAlimtalk,
  className
}: AlimtalkSendCardProps) {
  const hasApprovedSmsSenderNumbers = approvedSenderNumbers.length > 0;

  return (
    <Card className={cn('glass', className)}>
      <CardHeader>
        <CardTitle>직접 알림톡 발송</CardTitle>
        <CardDescription>연동된 카카오 채널과 템플릿으로 발송하고, 보내기 버튼 옆 예약 아이콘으로 같은 화면에서 예약 전송까지 바로 접수할 수 있습니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border bg-slate-50 p-4 dark:bg-slate-900/50">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-semibold">발송 설정</span>
            </div>
            <Badge variant="secondary">{readySenderProfiles.length}개 채널 연동</Badge>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>발신 채널</Label>
              <Select
                value={manualAlimtalkForm.senderProfileId}
                onValueChange={(v) => setManualAlimtalkForm((p: any) => ({ ...p, senderProfileId: v }))}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="카카오 채널 선택" />
                </SelectTrigger>
                <SelectContent>
                  {readySenderProfiles.map((profile) => (
                    <SelectItem key={profile.localSenderProfileId} value={profile.localSenderProfileId || ''}>
                      {profile.plusFriendId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>알림톡 템플릿</Label>
              <Select
                value={manualAlimtalkForm.providerTemplateId}
                onValueChange={(v) => setManualAlimtalkForm((p: any) => ({ ...p, providerTemplateId: v }))}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="승인된 템플릿 선택" />
                </SelectTrigger>
                <SelectContent>
                  {directAlimtalkTemplateOptions.map((option) => (
                    <SelectItem key={option.selectionKey} value={option.selectionKey}>
                      {option.templateName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>수신 번호</Label>
              <Input
                placeholder="01012345678"
                value={manualAlimtalkForm.recipientPhone}
                onChange={(e) => setManualAlimtalkForm((p: any) => ({ ...p, recipientPhone: e.target.value }))}
                className="bg-white"
              />
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-900/40 dark:bg-blue-950/30">
              <label
                className={cn(
                  'flex items-start gap-3',
                  hasApprovedSmsSenderNumbers ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'
                )}
              >
                <input
                  type="checkbox"
                  checked={Boolean(manualAlimtalkForm.useSmsFailover)}
                  disabled={!hasApprovedSmsSenderNumbers}
                  onChange={(e) =>
                    setManualAlimtalkForm((p: any) => ({
                      ...p,
                      useSmsFailover: hasApprovedSmsSenderNumbers ? e.target.checked : false
                    }))
                  }
                  className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-foreground">SMS 대체 발송</div>
                  <div className="text-xs leading-5 text-muted-foreground">
                    카카오톡 전달 실패 시 같은 내용을 SMS/LMS로 대체 발송합니다.
                  </div>
                </div>
              </label>

              {!hasApprovedSmsSenderNumbers && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                  승인된 SMS 발신번호가 아직 없습니다. `SMS 대체 발송`을 사용하려면 먼저 발신번호를 등록하고 승인받아야 합니다.
                  <div className="mt-3">
                    <Link
                      href="/send/sms/sender-numbers"
                      className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'border-amber-300 bg-white')}
                    >
                      발신번호 등록하러 가기
                    </Link>
                  </div>
                </div>
              )}

              {hasApprovedSmsSenderNumbers && manualAlimtalkForm.useSmsFailover && (
                <div className="mt-4 space-y-2">
                  <Label>대체 SMS 발신 번호</Label>
                  <Select
                    value={manualAlimtalkForm.fallbackSenderNumberId}
                    onValueChange={(v) =>
                      setManualAlimtalkForm((p: any) => ({ ...p, fallbackSenderNumberId: v }))
                    }
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="승인된 SMS 발신 번호 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {approvedSenderNumbers.map((sender) => (
                        <SelectItem key={sender.id} value={sender.id}>
                          {sender.phoneNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] leading-5 text-muted-foreground">
                    대체 발송 본문은 현재 알림톡 본문을 그대로 사용하고, 길이에 따라 SMS/LMS로 자동 판별합니다.
                  </p>
                </div>
              )}
            </div>

            {selectedDirectAlimtalkTemplate && selectedDirectAlimtalkTemplate.requiredVariables.length > 0 && (
              <div className="space-y-3 pt-2">
                <Label className="text-xs font-bold text-primary">템플릿 변수 입력</Label>
                <div className="grid gap-3 rounded-xl border bg-white p-3 dark:bg-slate-950">
                  {selectedDirectAlimtalkTemplate.requiredVariables.map((variable: string) => (
                    <div key={variable} className="flex items-center gap-3">
                      <span className="min-w-[80px] text-xs font-medium">{variable}</span>
                      <Input
                        placeholder={`${variable} 값 입력`}
                        value={manualAlimtalkVariables[variable] || ''}
                        onChange={(e) =>
                          setManualAlimtalkVariables((p: any) => ({ ...p, [variable]: e.target.value }))
                        }
                        className="h-9 text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <InlineSendScheduler
              tone="alimtalk"
              primaryLabel="알림톡 보내기"
              scheduledPrimaryLabel="지금 보내기"
              loadingLabel="발송 중..."
              loading={sendingManualAlimtalk}
              onPrimaryAction={() => sendDirectAlimtalk(null)}
              onScheduledAction={(scheduledAt) => sendDirectAlimtalk(scheduledAt)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DirectSendSection(props: DirectSendSectionProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <SmsSendCard
        approvedSenderNumbers={props.approvedSenderNumbers}
        manualSmsForm={props.manualSmsForm}
        setManualSmsForm={props.setManualSmsForm}
        directSmsTemplateOptions={props.directSmsTemplateOptions}
        selectedManualSmsTemplate={props.selectedManualSmsTemplate}
        manualSmsVariables={props.manualSmsVariables}
        setManualSmsVariables={props.setManualSmsVariables}
        renderedManualSmsBody={props.renderedManualSmsBody}
        formattedManualSmsBody={props.formattedManualSmsBody}
        sendingManualSms={props.sendingManualSms}
        sendDirectSms={props.sendDirectSms}
      />
      <AlimtalkSendCard
        approvedSenderNumbers={props.approvedSenderNumbers}
        readySenderProfiles={props.readySenderProfiles}
        manualAlimtalkForm={props.manualAlimtalkForm}
        setManualAlimtalkForm={props.setManualAlimtalkForm}
        directAlimtalkTemplateOptions={props.directAlimtalkTemplateOptions}
        selectedDirectAlimtalkTemplate={props.selectedDirectAlimtalkTemplate}
        manualAlimtalkVariables={props.manualAlimtalkVariables}
        setManualAlimtalkVariables={props.setManualAlimtalkVariables}
        sendingManualAlimtalk={props.sendingManualAlimtalk}
        sendDirectAlimtalk={props.sendDirectAlimtalk}
      />
    </div>
  );
}
