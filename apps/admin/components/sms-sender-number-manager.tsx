'use client';

import { Download, ExternalLink, FileBadge2, ShieldCheck, UploadCloud } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { statusVariant } from '@/lib/status';
import {
  getSenderNumberTypeLabel,
  isThirdPartyBusinessType,
  SMS_SENDER_NUMBER_GUIDE_URL,
  SENDER_NUMBER_ALLOWED_EXTENSIONS,
  SENDER_NUMBER_TYPE_OPTIONS
} from '@/lib/sender-number';

interface SmsSenderNumberManagerProps {
  senderNumbers: Array<{
    id: string;
    phoneNumber: string;
    type: 'COMPANY' | 'EMPLOYEE';
    status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
    reviewMemo?: string | null;
    updatedAt?: string;
  }>;
  nhnRegisteredSenders: Array<{
    sendNo: string;
    useYn: 'Y' | 'N';
    blockYn: 'Y' | 'N';
    createDate?: string | null;
    updateDate?: string | null;
  }>;
  syncApprovedNumbers: () => void;
  senderForm: {
    phoneNumber: string;
    type: 'COMPANY' | 'EMPLOYEE';
  };
  setSenderForm: (updater: any) => void;
  setTelecomFile: (file: File | null) => void;
  setConsentFile: (file: File | null) => void;
  setThirdPartyBusinessRegistrationFile: (file: File | null) => void;
  setRelationshipProofFile: (file: File | null) => void;
  setAdditionalDocumentFile: (file: File | null) => void;
  applySenderNumber: () => void;
}

const fileInputClassName = 'bg-white text-[11px]';
const sharedExtensionHint = `허용 형식: ${SENDER_NUMBER_ALLOWED_EXTENSIONS}`;
const sharedZipHint = '관련 서류를 더 첨부해야 한다면 ZIP 파일로 압축해서 업로드해 주세요.';
const phoneNumberRules = [
  '유선 전화번호: 02-YYY-YYYY 형태로, 지역번호를 포함해 등록해 주세요.',
  '이동통신 전화번호: 010-ABYY-YYYY 형태로 등록할 수 있습니다.',
  '공통 서비스 식별번호: 0N0 계열 번호를 사용할 수 있으며, 번호 앞에 지역번호를 붙이면 안 됩니다.',
  '발신번호는 최소 8자리에서 최대 11자리까지 입력할 수 있습니다.',
  '존재하지 않는 번호 대역으로는 메시지를 보낼 수 없습니다. 예: 070-0YYY, 070-1YYY, 010-0YYY, 010-1YYY'
];

function FileHint({ lines }: { lines: string[] }) {
  return (
    <div className="space-y-1 text-[11px] leading-5 text-muted-foreground">
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}

export function SmsSenderNumberManager({
  senderNumbers,
  nhnRegisteredSenders,
  syncApprovedNumbers,
  senderForm,
  setSenderForm,
  setTelecomFile,
  setConsentFile,
  setThirdPartyBusinessRegistrationFile,
  setRelationshipProofFile,
  setAdditionalDocumentFile,
  applySenderNumber
}: SmsSenderNumberManagerProps) {
  const selectedType = senderForm.type;
  const selectedTypeOption = SENDER_NUMBER_TYPE_OPTIONS.find((option) => option.apiType === selectedType) ?? SENDER_NUMBER_TYPE_OPTIONS[0];
  const requiresBusinessAttachments = isThirdPartyBusinessType(selectedType);
  const nhnStatusByPhone = new Map(nhnRegisteredSenders.map((item) => [item.sendNo, item]));

  return (
    <div className="space-y-6">
      <Card className="glass overflow-hidden">
        <CardHeader className="relative">
          <div className="absolute inset-y-0 right-0 w-44 bg-[radial-gradient(circle_at_top_right,rgba(14,116,144,0.18),transparent_60%)]" />
          <div className="relative space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              서류 제출 가이드
            </div>
            <div>
              <CardTitle>SMS 발신번호 관리</CardTitle>
              <CardDescription>
                서비스에서 등록하는 발신번호는 번호 명의 형태에 따라 필요한 서류가 달라집니다. 아래에서 상황에 맞는 유형을 선택하면
                필요한 문서만 바로 확인할 수 있습니다.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-2">
            {SENDER_NUMBER_TYPE_OPTIONS.map((option) => {
              const isSelected = option.apiType === selectedType;

              return (
                <button
                  key={option.apiType}
                  type="button"
                  onClick={() => setSenderForm((current: any) => ({ ...current, type: option.apiType }))}
                  className={`rounded-2xl border px-5 py-4 text-left transition ${
                    isSelected
                      ? 'border-primary/40 bg-primary/5 shadow-sm'
                      : 'border-border/70 bg-background/80 hover:border-primary/25 hover:bg-primary/5'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{option.label}</div>
                      <div className="mt-1 text-xs leading-5 text-muted-foreground">{option.description}</div>
                    </div>
                    <Badge variant={isSelected ? 'secondary' : 'outline'}>{option.requiredDocuments.length}종</Badge>
                  </div>
                  <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                    {option.requiredDocuments.map((documentLabel) => (
                      <div key={documentLabel} className="rounded-xl border bg-background/80 px-3 py-2">
                        {documentLabel}
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-950">
            <div className="font-semibold">제출 전에 꼭 확인해 주세요</div>
            <div className="mt-2 space-y-1">
              <p>`통신서비스 이용증명원`은 마스킹 처리 없이 최근 3개월 이내 발급된 서류만 등록할 수 있습니다.</p>
              <p>{sharedExtensionHint}</p>
              <p>{sharedZipHint}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={SMS_SENDER_NUMBER_GUIDE_URL}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                등록 기준 안내 보기
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
              <a
                href="/downloads/phone-number-consent-form.docx"
                download
                className={buttonVariants({ size: 'sm' })}
              >
                이용승낙서 양식 다운로드 (.docx)
                <Download className="ml-2 h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm leading-6 text-sky-950">
            <div className="font-semibold">발신번호 형식 안내</div>
            <div className="mt-3 grid gap-2">
              {phoneNumberRules.map((rule) => (
                <div key={rule} className="rounded-xl border border-sky-200/80 bg-white/70 px-3 py-2 text-xs leading-5 text-sky-950">
                  {rule}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>신청 현황</CardTitle>
            <CardDescription>
              현재 사업자 계정으로 등록한 발신번호 신청 상태와 최근 검토 메모를 확인합니다. NHN 등록 상태는 참고용이며, 최종 승인은 내부 운영자 심사에서만 처리됩니다.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={syncApprovedNumbers}>
            NHN 등록 재확인
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                <TableRow>
                  <TableHead>번호</TableHead>
                  <TableHead>구분</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>NHN 상태</TableHead>
                  <TableHead>메모</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {senderNumbers.length > 0 ? (
                  senderNumbers.map((senderNumber) => {
                    const nhnStatus = nhnStatusByPhone.get(senderNumber.phoneNumber);
                    const nhnBadgeLabel = !nhnStatus
                      ? '미등록'
                      : nhnStatus.useYn === 'Y' && nhnStatus.blockYn === 'N'
                        ? '사용 가능'
                        : '등록됨';
                    const nhnBadgeVariant = !nhnStatus
                      ? 'outline'
                      : nhnStatus.useYn === 'Y' && nhnStatus.blockYn === 'N'
                        ? 'success'
                        : 'warning';

                    return (
                      <TableRow key={senderNumber.id}>
                        <TableCell className="font-medium">{senderNumber.phoneNumber}</TableCell>
                        <TableCell className="text-xs">{getSenderNumberTypeLabel(senderNumber.type)}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(senderNumber.status)} className="text-[10px]">
                            {senderNumber.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div className="flex flex-col gap-1">
                            <Badge variant={nhnBadgeVariant} className="w-fit text-[10px]">
                              {nhnBadgeLabel}
                            </Badge>
                            <span>
                              {nhnStatus?.createDate
                                ? `NHN 등록 ${new Date(nhnStatus.createDate).toLocaleString('ko-KR')}`
                                : '내부 승인과 별개'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[240px] text-xs text-muted-foreground">
                          {senderNumber.reviewMemo || '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      아직 제출된 발신번호 신청이 없습니다.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>새 발신번호 신청</CardTitle>
          <CardDescription>
            현재 선택은 <span className="font-semibold text-foreground">{selectedTypeOption.label}</span> 기준입니다. 선택한 유형에 따라 꼭 필요한
            서류만 아래에 표시됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>휴대폰 번호</Label>
              <Input
                placeholder="0212345678 또는 01012345678"
                value={senderForm.phoneNumber}
                onChange={(event) => setSenderForm((current: any) => ({ ...current, phoneNumber: event.target.value }))}
                className="bg-white"
              />
              <div className="text-[11px] leading-5 text-muted-foreground">
                숫자만 입력해 주세요. 8자리~11자리까지 가능하며, 없는 번호 대역이나 잘못된 지역번호/식별번호 조합은 사용할 수 없습니다.
              </div>
            </div>
            <div className="space-y-2">
              <Label>번호 명의 형태</Label>
              <Select
                value={selectedType}
                onValueChange={(value) => setSenderForm((current: any) => ({ ...current, type: value as 'COMPANY' | 'EMPLOYEE' }))}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SENDER_NUMBER_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.apiType} value={option.apiType}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-2xl border bg-slate-50 p-5 dark:bg-slate-900/40">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <UploadCloud className="h-4 w-4 text-primary" />
              제출 서류 업로드
            </div>
            <div className="mt-2 text-xs leading-5 text-muted-foreground">
              아래 문구는 실제 제출 조건을 쉽게 풀어쓴 버전입니다. 서류가 더 많다면 ZIP으로 묶어서 함께 업로드할 수 있습니다.
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-[11px]">통신서비스 이용증명원 (필수)</Label>
                <Input
                  type="file"
                  onChange={(event) => setTelecomFile(event.target.files?.[0] || null)}
                  className={fileInputClassName}
                />
                <FileHint
                  lines={[
                    sharedExtensionHint,
                    sharedZipHint,
                    '마스킹된 부분이 없어야 하며, 최근 3개월 이내 발급된 서류만 등록할 수 있습니다.'
                  ]}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[11px]">이용승낙서 (필수)</Label>
                <Input
                  type="file"
                  onChange={(event) => setConsentFile(event.target.files?.[0] || null)}
                  className={fileInputClassName}
                />
                <FileHint lines={[sharedExtensionHint, sharedZipHint]} />
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <a
                    href="/downloads/phone-number-consent-form.docx"
                    download
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    이용승낙서 양식 다운로드
                    <Download className="h-3 w-3" />
                  </a>
                </div>
              </div>

              {requiresBusinessAttachments ? (
                <>
                  <div className="space-y-2">
                    <Label className="text-[11px]">명의 사업자등록증 (필수)</Label>
                    <Input
                      type="file"
                      onChange={(event) => setThirdPartyBusinessRegistrationFile(event.target.files?.[0] || null)}
                      className={fileInputClassName}
                    />
                    <FileHint lines={[sharedExtensionHint, sharedZipHint]} />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[11px]">관계 확인 문서 (필수)</Label>
                    <Input
                      type="file"
                      onChange={(event) => setRelationshipProofFile(event.target.files?.[0] || null)}
                      className={fileInputClassName}
                    />
                    <FileHint
                      lines={[
                        '업무위수탁 계약서, 본점-지점 증빙 서류 등 두 사업자 간 관계를 확인할 수 있는 문서를 올려 주세요.',
                        sharedExtensionHint,
                        sharedZipHint
                      ]}
                    />
                  </div>
                </>
              ) : null}

              <div className="space-y-2">
                <Label className="text-[11px]">기타 서류 (선택)</Label>
                <Input
                  type="file"
                  onChange={(event) => setAdditionalDocumentFile(event.target.files?.[0] || null)}
                  className={fileInputClassName}
                />
                <FileHint lines={[sharedExtensionHint, sharedZipHint]} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-dashed bg-background/80 p-5">
            <div className="text-sm font-semibold">제출 체크리스트</div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border px-4 py-3 text-xs leading-5 text-muted-foreground">
                사업자 명의 번호를 선택했다면, 통신서비스 이용증명원과 이용승낙서 외에 사업자등록증과 관계 확인 문서까지 함께 필요합니다.
              </div>
              <div className="rounded-xl border px-4 py-3 text-xs leading-5 text-muted-foreground">
                개인 명의 번호를 선택했다면 통신서비스 이용증명원과 이용승낙서를 함께 제출해 주세요. 추가 설명이 필요하면 기타 서류를 함께 올릴 수 있습니다.
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={applySenderNumber} className="min-w-[220px]">
              <FileBadge2 className="mr-2 h-4 w-4" />
              발신번호 신청 제출
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
