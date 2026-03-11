'use client';

import { CheckCircle2, Info, Send } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

interface DirectSendSectionProps {
    approvedSenderNumbers: any[];
    manualSmsForm: any;
    setManualSmsForm: (val: any) => void;
    sendingManualSms: boolean;
    sendDirectSms: () => void;
    readySenderProfiles: any[];
    manualAlimtalkForm: any;
    setManualAlimtalkForm: (val: any) => void;
    directAlimtalkTemplateOptions: any[];
    selectedDirectAlimtalkTemplate: any | null;
    manualAlimtalkVariables: Record<string, string>;
    setManualAlimtalkVariables: (val: any) => void;
    sendingManualAlimtalk: boolean;
    sendDirectAlimtalk: () => void;
}

export function DirectSendSection({
    approvedSenderNumbers,
    manualSmsForm,
    setManualSmsForm,
    sendingManualSms,
    sendDirectSms,
    readySenderProfiles,
    manualAlimtalkForm,
    setManualAlimtalkForm,
    directAlimtalkTemplateOptions,
    selectedDirectAlimtalkTemplate,
    manualAlimtalkVariables,
    setManualAlimtalkVariables,
    sendingManualAlimtalk,
    sendDirectAlimtalk
}: DirectSendSectionProps) {
    return (
        <div className="grid gap-6 xl:grid-cols-2">
            <Card className="glass">
                <CardHeader>
                    <CardTitle>직접 SMS 발송</CardTitle>
                    <CardDescription>승인된 번호로 즉시 문자를 발송합니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="rounded-2xl border bg-slate-50 p-4 dark:bg-slate-900/50">
                        <div className="flex items-center justify-between mb-4">
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
                                        {approvedSenderNumbers.map((s) => (
                                            <SelectItem key={s.id} value={s.id}>{s.phoneNumber}</SelectItem>
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

                            <div className="space-y-2">
                                <Label>메시지 본문</Label>
                                <Textarea
                                    placeholder="전송할 내용을 입력하세요..."
                                    value={manualSmsForm.body}
                                    onChange={(e) => setManualSmsForm((p: any) => ({ ...p, body: e.target.value }))}
                                    className="bg-white min-h-[120px] resize-none"
                                />
                            </div>

                            <Button
                                onClick={sendDirectSms}
                                disabled={sendingManualSms}
                                className="w-full shadow-lg shadow-primary/20"
                            >
                                {sendingManualSms ? '발송 중...' : 'SMS 즉시 발송'}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="glass">
                <CardHeader>
                    <CardTitle>직접 알림톡 발송</CardTitle>
                    <CardDescription>연동된 카카오 채널과 템플릿으로 발송합니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="rounded-2xl border bg-slate-50 p-4 dark:bg-slate-900/50">
                        <div className="flex items-center justify-between mb-4">
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
                                        {readySenderProfiles.map((p) => (
                                            <SelectItem key={p.localSenderProfileId} value={p.localSenderProfileId || ''}>{p.plusFriendId}</SelectItem>
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
                                        {directAlimtalkTemplateOptions.map((o) => (
                                            <SelectItem key={o.selectionKey} value={o.selectionKey}>{o.templateName}</SelectItem>
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

                            {selectedDirectAlimtalkTemplate && selectedDirectAlimtalkTemplate.requiredVariables.length > 0 && (
                                <div className="space-y-3 pt-2">
                                    <Label className="text-xs font-bold text-primary">템플릿 변수 입력</Label>
                                    <div className="grid gap-3 p-3 rounded-xl border bg-white dark:bg-slate-950">
                                        {selectedDirectAlimtalkTemplate.requiredVariables.map((v: string) => (
                                            <div key={v} className="flex items-center gap-3">
                                                <span className="text-xs font-medium min-w-[80px]">{v}</span>
                                                <Input
                                                    placeholder={`${v} 값 입력`}
                                                    value={manualAlimtalkVariables[v] || ''}
                                                    onChange={(e) => setManualAlimtalkVariables((p: any) => ({ ...p, [v]: e.target.value }))}
                                                    className="h-8 text-xs h-9"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <Button
                                onClick={sendDirectAlimtalk}
                                disabled={sendingManualAlimtalk}
                                className="w-full shadow-lg shadow-primary/20"
                            >
                                {sendingManualAlimtalk ? '발송 중...' : '알림톡 즉시 발송'}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
