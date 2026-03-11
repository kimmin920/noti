'use client';

import { Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface EventRuleSectionProps {
    eventRuleForm: any;
    setEventRuleForm: (val: any) => void;
    smsTemplates: any[];
    alimtalkProviders: any[];
    senderProfilesWithStatus: any[];
    focusSenderProfileCenter: () => void;
    upsertRule: () => void;
    sendSample: (key: any) => void;
    eventRules: any[];
}

export function EventRuleSection({
    eventRuleForm,
    setEventRuleForm,
    smsTemplates,
    alimtalkProviders,
    senderProfilesWithStatus,
    focusSenderProfileCenter,
    upsertRule,
    sendSample,
    eventRules
}: EventRuleSectionProps) {
    return (
        <Card className="glass">
            <CardHeader>
                <CardTitle>이벤트 규칙 및 테스트</CardTitle>
                <CardDescription>
                    특정 이벤트 발생 시 메시지 발송 전략을 설정하고 테스트합니다.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-6 rounded-2xl bg-slate-50 p-6 dark:bg-slate-900/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>이벤트 키 (Event Key)</Label>
                            <Input
                                placeholder="예: PUBL_USER_SIGNUP"
                                value={eventRuleForm.eventKey}
                                onChange={(e) => setEventRuleForm((p: any) => ({ ...p, eventKey: e.target.value }))}
                                className="bg-white"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>표시 이름</Label>
                            <Input
                                placeholder="예: 회원가입 환영"
                                value={eventRuleForm.displayName}
                                onChange={(e) => setEventRuleForm((p: any) => ({ ...p, displayName: e.target.value }))}
                                className="bg-white"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>채널 전략</Label>
                            <Select
                                value={eventRuleForm.channelStrategy}
                                onValueChange={(v) => setEventRuleForm((p: any) => ({ ...p, channelStrategy: v }))}
                            >
                                <SelectTrigger className="bg-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="SMS_ONLY">SMS 전용</SelectItem>
                                    <SelectItem value="ALIMTALK_ONLY">알림톡 전용</SelectItem>
                                    <SelectItem value="ALIMTALK_THEN_SMS">알림톡 우선 (실패 시 SMS)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>필수 변수 (쉼표 구분)</Label>
                            <Input
                                placeholder="username, date, amount"
                                value={eventRuleForm.requiredVariables}
                                onChange={(e) => setEventRuleForm((p: any) => ({ ...p, requiredVariables: e.target.value }))}
                                className="bg-white"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>SMS 템플릿</Label>
                            <Select
                                value={eventRuleForm.smsTemplateId}
                                onValueChange={(v) => setEventRuleForm((p: any) => ({ ...p, smsTemplateId: v }))}
                            >
                                <SelectTrigger className="bg-white">
                                    <SelectValue placeholder="선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    {smsTemplates.map((t) => (
                                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>알림톡 템플릿 (승인됨)</Label>
                            <Select
                                value={eventRuleForm.alimtalkTemplateId}
                                onValueChange={(v) => setEventRuleForm((p: any) => ({ ...p, alimtalkTemplateId: v }))}
                            >
                                <SelectTrigger className="bg-white">
                                    <SelectValue placeholder="APR 템플릿만" />
                                </SelectTrigger>
                                <SelectContent>
                                    {alimtalkProviders.map((t) => (
                                        <SelectItem key={t.id} value={t.providerTemplates?.[0]?.id || ''}>{t.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>카카오 채널</Label>
                            <div className="flex gap-2">
                                <Select
                                    value={eventRuleForm.alimtalkSenderProfileId}
                                    onValueChange={(v) => setEventRuleForm((p: any) => ({ ...p, alimtalkSenderProfileId: v }))}
                                >
                                    <SelectTrigger className="bg-white flex-1">
                                        <SelectValue placeholder="채널 선택" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {senderProfilesWithStatus.map((profile) => (
                                            <SelectItem key={profile.localSenderProfileId} value={profile.localSenderProfileId || profile.senderKey}>
                                                {profile.plusFriendId}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button variant="outline" size="sm" onClick={focusSenderProfileCenter}>채널 관리</Button>
                            </div>
                        </div>
                    </div>

                    <Button onClick={upsertRule} className="w-full shadow-lg shadow-primary/20">규칙 저장 및 업데이트</Button>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="font-bold">테스트 발송</h4>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => sendSample('PUBL_USER_SIGNUP')}>
                                <Send className="mr-2 h-3 w-3" /> SIGNUP
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => sendSample('PUBL_TICKET_PURCHASED')}>
                                <Send className="mr-2 h-3 w-3" /> TICKETING
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => sendSample('PUBL_PAYMENT_COMPLETED')}>
                                <Send className="mr-2 h-3 w-3" /> PAYMENT
                            </Button>
                        </div>
                    </div>

                    <div className="rounded-xl border overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                                <TableRow>
                                    <TableHead className="font-bold">이벤트 키</TableHead>
                                    <TableHead className="font-bold">전략</TableHead>
                                    <TableHead className="font-bold">필수 변수</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {eventRules.length > 0 ? (
                                    eventRules.map((rule) => (
                                        <TableRow key={rule.id}>
                                            <TableCell className="font-medium">{rule.eventKey}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-[10px]">{rule.channelStrategy}</Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {rule.requiredVariables.join(', ')}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">
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
