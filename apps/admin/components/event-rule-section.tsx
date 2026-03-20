'use client';

import { Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { EventRule, SenderNumber, SenderProfile, Template } from '@/types/admin';

type EventRuleRequestExample = {
    endpoint: string;
    idempotencyKey: string;
    payload: Record<string, unknown>;
};

interface EventRuleSectionProps {
    eventRuleForm: any;
    setEventRuleForm: (val: any) => void;
    setEventRuleChannelStrategy: (value: 'SMS_ONLY' | 'ALIMTALK_ONLY' | 'ALIMTALK_THEN_SMS') => void;
    selectEventRuleSmsTemplate: (templateId: string) => void;
    selectEventRuleAlimtalkTemplate: (providerTemplateId: string) => void;
    selectedEventTestKey: string;
    setSelectedEventTestKey: (value: string) => void;
    selectedEventTestRule: EventRule | null;
    eventTestRecipientPhone: string;
    setEventTestRecipientPhone: (value: string) => void;
    eventTestRecipientUserId: string;
    setEventTestRecipientUserId: (value: string) => void;
    eventTestVariables: Record<string, string>;
    updateEventTestVariable: (variableName: string, value: string) => void;
    eventTestRequestExample: EventRuleRequestExample | null;
    smsTemplates: Template[];
    approvedSenderNumbers: SenderNumber[];
    alimtalkProviders: Template[];
    senderProfilesWithStatus: SenderProfile[];
    focusSenderProfileCenter: () => void;
    upsertRule: () => void;
    sendingEventTest: boolean;
    executeEventTest: () => void;
    eventRules: EventRule[];
}

export function EventRuleSection({
    eventRuleForm,
    setEventRuleForm,
    setEventRuleChannelStrategy,
    selectEventRuleSmsTemplate,
    selectEventRuleAlimtalkTemplate,
    selectedEventTestKey,
    setSelectedEventTestKey,
    selectedEventTestRule,
    eventTestRecipientPhone,
    setEventTestRecipientPhone,
    eventTestRecipientUserId,
    setEventTestRecipientUserId,
    eventTestVariables,
    updateEventTestVariable,
    eventTestRequestExample,
    smsTemplates,
    approvedSenderNumbers,
    alimtalkProviders,
    senderProfilesWithStatus,
    focusSenderProfileCenter,
    upsertRule,
    sendingEventTest,
    executeEventTest,
    eventRules
}: EventRuleSectionProps) {
    const showSmsConfig = eventRuleForm.channelStrategy !== 'ALIMTALK_ONLY';
    const showAlimtalkConfig = eventRuleForm.channelStrategy !== 'SMS_ONLY';
    const publishedSmsTemplates = smsTemplates.filter((template) => template.status === 'PUBLISHED');
    const approvedAlimtalkTemplates = alimtalkProviders.filter((template) =>
        template.providerTemplates?.some((providerTemplate) => providerTemplate.providerStatus === 'APR')
    );

    return (
        <Card className="glass">
            <CardHeader>
                <CardTitle>이벤트 규칙 및 테스트</CardTitle>
                <CardDescription>
                    이벤트 규칙을 저장하고, 등록된 이벤트를 API 문서 형식으로 확인한 뒤 직접 실행합니다.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-6 rounded-2xl bg-slate-50 p-6 dark:bg-slate-900/50">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>이벤트 키 (Event Key)</Label>
                            <Input
                                placeholder="예: PUBL_USER_SIGNUP"
                                value={eventRuleForm.eventKey}
                                onChange={(event) => setEventRuleForm((current: any) => ({ ...current, eventKey: event.target.value }))}
                                className="bg-white"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>표시 이름</Label>
                            <Input
                                placeholder="예: 회원가입 환영"
                                value={eventRuleForm.displayName}
                                onChange={(event) => setEventRuleForm((current: any) => ({ ...current, displayName: event.target.value }))}
                                className="bg-white"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>채널 전략</Label>
                            <Select value={eventRuleForm.channelStrategy} onValueChange={setEventRuleChannelStrategy}>
                                <SelectTrigger className="bg-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="SMS_ONLY">SMS 전용</SelectItem>
                                    <SelectItem value="ALIMTALK_ONLY">알림톡 전용</SelectItem>
                                    <SelectItem value="ALIMTALK_THEN_SMS">알림톡 우선 후 SMS</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>필수 변수 (쉼표 구분)</Label>
                            <Input
                                placeholder="username, date, amount"
                                value={eventRuleForm.requiredVariables}
                                onChange={(event) => setEventRuleForm((current: any) => ({ ...current, requiredVariables: event.target.value }))}
                                className="bg-white"
                            />
                        </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                        {showSmsConfig ? (
                            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-semibold">SMS 구성</div>
                                        <div className="text-xs text-muted-foreground">SMS 전송에 필요한 템플릿과 발신번호입니다.</div>
                                    </div>
                                    <Badge variant="outline">SMS</Badge>
                                </div>
                                <div className="mt-4 grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>SMS 템플릿</Label>
                                        <Select value={eventRuleForm.smsTemplateId} onValueChange={selectEventRuleSmsTemplate}>
                                            <SelectTrigger className="bg-white">
                                                <SelectValue placeholder="게시된 템플릿 선택" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {publishedSmsTemplates.map((template) => (
                                                    <SelectItem key={template.id} value={template.id}>
                                                        {template.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>SMS 발신번호</Label>
                                        <Select
                                            value={eventRuleForm.smsSenderNumberId}
                                            onValueChange={(value) =>
                                                setEventRuleForm((current: any) => ({ ...current, smsSenderNumberId: value }))
                                            }
                                        >
                                            <SelectTrigger className="bg-white">
                                                <SelectValue placeholder="승인된 번호 선택" />
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
                                </div>
                            </div>
                        ) : (
                            <HiddenChannelHint label="SMS 설정 숨김" description="알림톡 전용 전략이라 SMS 입력은 보이지 않습니다." />
                        )}

                        {showAlimtalkConfig ? (
                            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-semibold">알림톡 구성</div>
                                        <div className="text-xs text-muted-foreground">APR 승인 템플릿과 카카오 채널을 연결합니다.</div>
                                    </div>
                                    <Badge variant="outline">ALIMTALK</Badge>
                                </div>
                                <div className="mt-4 grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>알림톡 템플릿 (승인됨)</Label>
                                        <Select value={eventRuleForm.alimtalkTemplateId} onValueChange={selectEventRuleAlimtalkTemplate}>
                                            <SelectTrigger className="bg-white">
                                                <SelectValue placeholder="APR 템플릿만" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {approvedAlimtalkTemplates.map((template) => (
                                                    <SelectItem
                                                        key={template.id}
                                                        value={template.providerTemplates?.find((providerTemplate) => providerTemplate.providerStatus === 'APR')?.id || ''}
                                                    >
                                                        {template.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>카카오 채널</Label>
                                        <div className="flex gap-2">
                                            <Select
                                                value={eventRuleForm.alimtalkSenderProfileId}
                                                onValueChange={(value) =>
                                                    setEventRuleForm((current: any) => ({ ...current, alimtalkSenderProfileId: value }))
                                                }
                                            >
                                                <SelectTrigger className="bg-white flex-1">
                                                    <SelectValue placeholder="채널 선택" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {senderProfilesWithStatus.map((profile) => (
                                                        <SelectItem
                                                            key={profile.localSenderProfileId || profile.senderKey}
                                                            value={profile.localSenderProfileId || profile.senderKey}
                                                        >
                                                            {profile.plusFriendId}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Button variant="outline" size="sm" onClick={focusSenderProfileCenter}>채널 관리</Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <HiddenChannelHint label="알림톡 설정 숨김" description="SMS 전용 전략이라 알림톡 입력은 보이지 않습니다." />
                        )}
                    </div>

                    <Button onClick={upsertRule} className="w-full shadow-lg shadow-primary/20">규칙 저장 및 업데이트</Button>
                </div>

                <div className="space-y-4 rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
                    <div className="flex flex-col gap-2">
                        <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">Event Test Runner</div>
                        <div className="text-lg font-semibold">등록된 이벤트 선택 후 API 요청 형식 그대로 테스트</div>
                        <div className="text-sm text-muted-foreground">
                            외부 서버 개발자가 볼 수 있도록 요청 스펙과 실행 폼을 같은 자리에서 보여줍니다.
                        </div>
                    </div>

                    {eventRules.length > 0 ? (
                        <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
                            <div className="space-y-5">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>등록된 이벤트</Label>
                                        <Select value={selectedEventTestKey} onValueChange={setSelectedEventTestKey}>
                                            <SelectTrigger className="bg-white">
                                                <SelectValue placeholder="이벤트 선택" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {eventRules.map((rule) => (
                                                    <SelectItem key={rule.id} value={rule.eventKey}>
                                                        {rule.displayName} ({rule.eventKey})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>선택된 전략</Label>
                                        <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-800 dark:bg-slate-900/60">
                                            <Badge variant="outline">{selectedEventTestRule?.channelStrategy || '미선택'}</Badge>
                                            {selectedEventTestRule && (
                                                <Badge variant={selectedEventTestRule.enabled ? 'secondary' : 'danger'}>
                                                    {selectedEventTestRule.enabled ? '활성' : '비활성'}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="event-test-recipient-phone">수신번호</Label>
                                        <Input
                                            id="event-test-recipient-phone"
                                            placeholder="예: 01012345678"
                                            value={eventTestRecipientPhone}
                                            onChange={(event) => setEventTestRecipientPhone(event.target.value)}
                                            className="bg-white"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="event-test-recipient-user-id">수신 유저 ID (선택)</Label>
                                        <Input
                                            id="event-test-recipient-user-id"
                                            placeholder="예: publ_user_1"
                                            value={eventTestRecipientUserId}
                                            onChange={(event) => setEventTestRecipientUserId(event.target.value)}
                                            className="bg-white"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-sm font-semibold">Variables</div>
                                            <div className="text-xs text-muted-foreground">선택한 이벤트 규칙의 필수 변수만 입력합니다.</div>
                                        </div>
                                        <Badge variant="outline">
                                            {selectedEventTestRule?.requiredVariables.length ?? 0}개
                                        </Badge>
                                    </div>

                                    {selectedEventTestRule && selectedEventTestRule.requiredVariables.length > 0 ? (
                                        <div className="grid gap-3 md:grid-cols-2">
                                            {selectedEventTestRule.requiredVariables.map((variableName) => (
                                                <div key={variableName} className="space-y-2">
                                                    <Label>{variableName}</Label>
                                                    <Input
                                                        value={eventTestVariables[variableName] ?? ''}
                                                        onChange={(event) => updateEventTestVariable(variableName, event.target.value)}
                                                        placeholder={`값 입력: ${variableName}`}
                                                        className="bg-white"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-sm text-muted-foreground dark:border-slate-800">
                                            필수 변수 없는 이벤트이거나 아직 이벤트가 선택되지 않았습니다.
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-end">
                                    <Button
                                        onClick={executeEventTest}
                                        disabled={!selectedEventTestRule || sendingEventTest || !selectedEventTestRule.enabled}
                                        className="min-w-[180px]"
                                    >
                                        <Send className="mr-2 h-4 w-4" />
                                        {sendingEventTest ? '실행 중...' : '이벤트 실행하기'}
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">API Request</div>
                                            <div className="mt-2 font-mono text-sm text-slate-950 dark:text-slate-100">
                                                POST {eventTestRequestExample?.endpoint || '<api_base>/v1/message-requests'}
                                            </div>
                                        </div>
                                        <Badge variant="outline" className="font-mono">202 Accepted</Badge>
                                    </div>

                                    <div className="mt-5 space-y-3">
                                        <div>
                                            <div className="text-xs font-semibold text-slate-500">Headers</div>
                                            <div className="mt-2 rounded-xl bg-slate-50 p-3 font-mono text-xs leading-6 text-slate-700 dark:bg-slate-900/80 dark:text-slate-300">
                                                <div>Content-Type: application/json</div>
                                                <div>Idempotency-Key: {eventTestRequestExample?.idempotencyKey || 'evt_example_001'}</div>
                                                <div>Authorization: Bearer &lt;publ_service_token&gt; <span className="text-slate-400">(설정 시)</span></div>
                                            </div>
                                        </div>

                                        <div>
                                            <div className="text-xs font-semibold text-slate-500">Required Payload</div>
                                            <div className="mt-2 rounded-xl border border-dashed border-slate-200 px-3 py-3 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:text-slate-300">
                                                <div><code>tenantId</code>, <code>eventKey</code>, <code>recipient.phone</code>, <code>variables</code> 가 핵심입니다.</div>
                                                <div><code>recipient.userId</code> 와 <code>metadata</code> 는 함께 보내면 추적이 더 편합니다.</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-slate-100 shadow-sm dark:border-slate-800">
                                    <div className="flex items-center justify-between">
                                        <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Payload</div>
                                        <Badge variant="secondary" className="font-mono">JSON</Badge>
                                    </div>
                                    <pre className="mt-4 overflow-x-auto rounded-xl bg-black/30 p-4 font-mono text-xs leading-6 text-slate-100">
{JSON.stringify(eventTestRequestExample?.payload ?? { eventKey: '<select_event_first>' }, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-muted-foreground dark:border-slate-800">
                            등록된 이벤트 규칙이 없어 테스트 실행 폼을 만들 수 없습니다.
                        </div>
                    )}

                    <div className="rounded-xl border overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                                <TableRow>
                                    <TableHead className="font-bold">이벤트 키</TableHead>
                                    <TableHead className="font-bold">표시 이름</TableHead>
                                    <TableHead className="font-bold">전략</TableHead>
                                    <TableHead className="font-bold">필수 변수</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {eventRules.length > 0 ? (
                                    eventRules.map((rule) => (
                                        <TableRow key={rule.id}>
                                            <TableCell className="font-medium">{rule.eventKey}</TableCell>
                                            <TableCell>{rule.displayName}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-[10px]">{rule.channelStrategy}</Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {rule.requiredVariables.join(', ') || '-'}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                                            등록된 규칙이 없습니다.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function HiddenChannelHint({ label, description }: { label: string; description: string }) {
    return (
        <div className="flex min-h-[154px] flex-col justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-100/70 p-4 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="text-sm font-semibold">{label}</div>
            <div className="mt-1 text-xs leading-6 text-muted-foreground">{description}</div>
        </div>
    );
}
