'use client';

import { CheckCircle2, Clock, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SenderProfileManagerProps {
    activeSenderProfiles: any[];
    pendingSenderProfiles: any[];
    blockedSenderProfiles: any[];
    errorMessage?: string;
    senderProfileForm: any;
    setSenderProfileForm: (val: any) => void;
    senderProfileCategoryOptions: any[];
    applyingSenderProfile: boolean;
    applySenderProfile: () => void;
    senderProfileTokenForm: any;
    setSenderProfileTokenForm: (val: any) => void;
    verifyingSenderProfile: boolean;
    verifySenderProfileToken: () => void;
}

export function SenderProfileManager({
    activeSenderProfiles,
    pendingSenderProfiles,
    blockedSenderProfiles,
    errorMessage,
    senderProfileForm,
    setSenderProfileForm,
    senderProfileCategoryOptions,
    applyingSenderProfile,
    applySenderProfile,
    senderProfileTokenForm,
    setSenderProfileTokenForm,
    verifyingSenderProfile,
    verifySenderProfileToken
}: SenderProfileManagerProps) {
    return (
        <Card className="glass h-full">
            <CardHeader>
                <CardTitle>카카오 채널 (발신프로필)</CardTitle>
                <CardDescription>카카오 메세지 발송에 사용할 채널을 연동하고 인증 상태를 관리합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border bg-emerald-50/50 p-4 text-center dark:bg-emerald-900/10">
                        <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-500" />
                        <p className="mt-2 text-xs font-bold">활성 채널</p>
                        <p className="mt-1 text-xl font-bold">{activeSenderProfiles.length}</p>
                    </div>
                    <div className="rounded-xl border bg-amber-50/50 p-4 text-center dark:bg-amber-900/10">
                        <Clock className="mx-auto h-5 w-5 text-amber-500" />
                        <p className="mt-2 text-xs font-bold">심사 중</p>
                        <p className="mt-1 text-xl font-bold">{pendingSenderProfiles.length}</p>
                    </div>
                    <div className="rounded-xl border bg-rose-50/50 p-4 text-center dark:bg-rose-900/10">
                        <ShieldAlert className="mx-auto h-5 w-5 text-rose-500" />
                        <p className="mt-2 text-xs font-bold">차단/제한</p>
                        <p className="mt-1 text-xl font-bold">{blockedSenderProfiles.length}</p>
                    </div>
                </div>

                <div className="space-y-4 rounded-2xl border bg-slate-50 p-6 dark:bg-slate-900/50">
                    <h4 className="text-sm font-bold">카카오 채널 연동하기</h4>
                    <p className="text-[11px] italic text-muted-foreground">
                        채널 정보를 입력하면 관리자 휴대폰으로 인증 토큰이 발송됩니다.
                    </p>

                    <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label className="text-xs">카카오 채널 ID</Label>
                                <Input
                                    placeholder="@내채널ID"
                                    value={senderProfileForm.plusFriendId}
                                    onChange={(e) => setSenderProfileForm((p: any) => ({ ...p, plusFriendId: e.target.value }))}
                                    className="bg-white"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs">관리자 휴대폰</Label>
                                <Input
                                    placeholder="01012345678"
                                    value={senderProfileForm.phoneNo}
                                    onChange={(e) => setSenderProfileForm((p: any) => ({ ...p, phoneNo: e.target.value }))}
                                    className="bg-white"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs">비즈니스 카테고리</Label>
                            <Select
                                value={senderProfileForm.categoryCode}
                                onValueChange={(v) => setSenderProfileForm((p: any) => ({ ...p, categoryCode: v }))}
                            >
                                <SelectTrigger className="bg-white">
                                    <SelectValue placeholder="카테고리 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    {senderProfileCategoryOptions.map((opt) => (
                                        <SelectItem key={opt.code} value={opt.code}>{opt.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Button onClick={applySenderProfile} disabled={applyingSenderProfile} className="w-full">
                            {applyingSenderProfile ? '처리 중...' : '인증 토큰 요청'}
                        </Button>

                        {errorMessage ? (
                            <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                                {errorMessage}
                            </div>
                        ) : null}
                    </div>

                    <div className="space-y-3 border-t pt-4">
                        <h5 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">토큰 인증</h5>
                        <div className="flex gap-2">
                            <Input
                                placeholder="인증 토큰(숫자)"
                                value={senderProfileTokenForm.token}
                                onChange={(e) => setSenderProfileTokenForm((p: any) => ({ ...p, token: e.target.value }))}
                                className="h-9 bg-white"
                            />
                            <Button variant="secondary" onClick={verifySenderProfileToken} disabled={verifyingSenderProfile} className="h-9">
                                {verifyingSenderProfile ? '인증 중' : '인증 완료'}
                            </Button>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
