'use client';

import {
    Building2,
    CheckCircle2,
    Clock,
    FileText,
    History,
    MoreHorizontal,
    ShieldAlert,
    Smartphone,
    UserCircle2,
    UploadCloud,
    XCircle,
    AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { statusVariant } from '@/lib/status';

interface SenderSectionProps {
    senderNumbers: any[];
    nhnRegisteredSenders: any[];
    syncApprovedNumbers: () => void;
    senderForm: any;
    setSenderForm: (val: any) => void;
    setTelecomFile: (file: File | null) => void;
    setEmploymentFile: (file: File | null) => void;
    applySenderNumber: () => void;
    activeSenderProfiles: any[];
    pendingSenderProfiles: any[];
    blockedSenderProfiles: any[];
    senderProfileForm: any;
    setSenderProfileForm: (val: any) => void;
    senderProfileCategoryOptions: any[];
    applyingSenderProfile: boolean;
    applySenderProfile: () => void;
    senderProfileTokenForm: any;
    setSenderProfileTokenForm: (val: any) => void;
    verifyingSenderProfile: boolean;
    verifySenderProfileToken: () => void;
    syncingGroupSenderKeys: string[];
    syncSenderToDefaultGroup: (key: string) => void;
    logs: any[];
}

export function SenderSection({
    senderNumbers,
    nhnRegisteredSenders,
    syncApprovedNumbers,
    senderForm,
    setSenderForm,
    setTelecomFile,
    setEmploymentFile,
    applySenderNumber,
    activeSenderProfiles,
    pendingSenderProfiles,
    blockedSenderProfiles,
    senderProfileForm,
    setSenderProfileForm,
    senderProfileCategoryOptions,
    applyingSenderProfile,
    applySenderProfile,
    senderProfileTokenForm,
    setSenderProfileTokenForm,
    verifyingSenderProfile,
    verifySenderProfileToken,
    syncingGroupSenderKeys,
    syncSenderToDefaultGroup,
    logs
}: SenderSectionProps) {
    return (
        <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
                <Card className="glass">
                    <CardHeader>
                        <CardTitle>SMS 발신번호 관리</CardTitle>
                        <CardDescription>발신번호 신청 및 승인 상태를 관리합니다.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="font-bold text-sm">신청 현황</h4>
                            <Button variant="outline" size="sm" onClick={syncApprovedNumbers}>상태 동기화</Button>
                        </div>

                        <div className="rounded-xl border overflow-hidden max-h-[300px] overflow-y-auto">
                            <Table>
                                <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                                    <TableRow>
                                        <TableHead>번호</TableHead>
                                        <TableHead>유형</TableHead>
                                        <TableHead>상태</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {senderNumbers.map((s) => (
                                        <TableRow key={s.id}>
                                            <TableCell className="font-medium">{s.phoneNumber}</TableCell>
                                            <TableCell className="text-xs">{s.type}</TableCell>
                                            <TableCell>
                                                <Badge variant={statusVariant(s.status)} className="text-[10px]">{s.status}</Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="rounded-2xl border bg-slate-50 p-6 dark:bg-slate-900/50 space-y-4">
                            <h4 className="font-bold text-sm">새 발신번호 신청</h4>
                            <div className="grid gap-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>휴대폰 번호</Label>
                                        <Input
                                            placeholder="01012345678"
                                            value={senderForm.phoneNumber}
                                            onChange={(e) => setSenderForm((p: any) => ({ ...p, phoneNumber: e.target.value }))}
                                            className="bg-white"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>유형</Label>
                                        <Select
                                            value={senderForm.type}
                                            onValueChange={(v) => setSenderForm((p: any) => ({ ...p, type: v as any }))}
                                        >
                                            <SelectTrigger className="bg-white">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="COMPANY">법인</SelectItem>
                                                <SelectItem value="EMPLOYEE">직원</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[11px]">통신서비스 가입증명</Label>
                                        <Input type="file" onChange={(e) => setTelecomFile(e.target.files?.[0] || null)} className="bg-white text-[10px]" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[11px]">재직증명 (직원일 경우)</Label>
                                        <Input type="file" onChange={(e) => setEmploymentFile(e.target.files?.[0] || null)} className="bg-white text-[10px]" />
                                    </div>
                                </div>

                                <Button onClick={applySenderNumber} size="sm" className="w-full">발신번호 신청 제출</Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="glass h-full">
                    <CardHeader>
                        <CardTitle>카카오 채널 (발신프로필)</CardTitle>
                        <CardDescription>알림톡 발송을 위한 카카오 채널을 연동합니다.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-3 gap-3">
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

                        <div className="rounded-2xl border bg-slate-50 p-6 dark:bg-slate-900/50 space-y-4">
                            <h4 className="font-bold text-sm">카카오 채널 연동하기</h4>
                            <p className="text-[11px] text-muted-foreground italic">
                                채널 정보를 입력하면 관리자 폰으로 인증 토큰이 발송됩니다.
                            </p>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
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
                            </div>

                            <div className="pt-4 border-t space-y-3">
                                <h5 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">토큰 인증</h5>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="인증 토큰(숫자)"
                                        value={senderProfileTokenForm.token}
                                        onChange={(e) => setSenderProfileTokenForm((p: any) => ({ ...p, token: e.target.value }))}
                                        className="bg-white h-9"
                                    />
                                    <Button variant="secondary" onClick={verifySenderProfileToken} disabled={verifyingSenderProfile} className="h-9">
                                        {verifyingSenderProfile ? '인증 중' : '인증 완료'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="glass">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>최근 메시지 발송 로그</CardTitle>
                        <CardDescription>모든 채널의 메시지 처리 및 전송 결과를 확인합니다.</CardDescription>
                    </div>
                    <div className="flex bg-slate-100 rounded-lg p-1 dark:bg-slate-800">
                        <Button variant="ghost" size="sm" className="h-7 px-3 text-[11px] font-bold">전체</Button>
                        <Button variant="ghost" size="sm" className="h-7 px-3 text-[11px]">성공</Button>
                        <Button variant="ghost" size="sm" className="h-7 px-3 text-[11px]">실패</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-xl border overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                                <TableRow>
                                    <TableHead className="w-[180px]">일시</TableHead>
                                    <TableHead>이벤트</TableHead>
                                    <TableHead>채널</TableHead>
                                    <TableHead>수신번호</TableHead>
                                    <TableHead>상태</TableHead>
                                    <TableHead className="max-w-[200px]">메모</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logs.length > 0 ? (
                                    logs.slice(0, 10).map((log) => (
                                        <TableRow key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                                            <TableCell className="text-[11px] font-medium text-muted-foreground">
                                                {new Date(log.createdAt).toLocaleString('ko-KR')}
                                            </TableCell>
                                            <TableCell className="font-semibold text-xs">{log.eventKey}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5">
                                                    {log.resolvedChannel === 'SMS' ? (
                                                        <Smartphone className="h-3 w-3 text-slate-400" />
                                                    ) : (
                                                        <UserCircle2 className="h-3 w-3 text-amber-500" />
                                                    )}
                                                    <span className="text-xs font-bold">{log.resolvedChannel || '-'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs font-mono">{log.recipientPhone}</TableCell>
                                            <TableCell>
                                                <Badge variant={statusVariant(log.status)} className="text-[10px] h-5">
                                                    {log.status === 'DELIVERED' ? (
                                                        <CheckCircle2 className="mr-1 h-3 w-3" />
                                                    ) : log.status === 'DELIVERY_FAILED' ? (
                                                        <XCircle className="mr-1 h-3 w-3" />
                                                    ) : (
                                                        <Clock className="mr-1 h-3 w-3" />
                                                    )}
                                                    {log.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                                                {log.lastErrorMessage || '-'}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                                            최근 발송 데이터가 없습니다.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    {logs.length > 10 && (
                        <div className="mt-4 flex justify-center">
                            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:bg-transparent hover:text-primary">
                                <MoreHorizontal className="mr-2 h-4 w-4" />
                                로그 더 보기
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
