'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    CheckCircle2,
    Clock,
    MoreHorizontal,
    Smartphone,
    UserCircle2,
    XCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { statusVariant } from '@/lib/status';
import type { MessageLog } from '@/types/admin';

interface SenderSectionProps {
    logs: MessageLog[];
}

type LogFilter = 'ALL' | 'SUCCESS' | 'FAILURE' | 'RESERVED' | 'BULK';

const PAGE_SIZE = 10;
const SUCCESS_STATUSES = new Set(['SENT_TO_PROVIDER', 'DELIVERED']);
const FAILURE_STATUSES = new Set(['DELIVERY_FAILED', 'SEND_FAILED', 'CANCELED', 'DEAD', 'FAILED', 'PARTIAL_FAILED']);

function isScheduledReservationPending(log: MessageLog) {
    return log.scheduledAt ? new Date(log.scheduledAt).getTime() > Date.now() && !FAILURE_STATUSES.has(log.status) : false;
}

function matchesFilter(log: MessageLog, filter: LogFilter) {
    if (filter === 'SUCCESS') {
        return SUCCESS_STATUSES.has(log.status);
    }

    if (filter === 'FAILURE') {
        return FAILURE_STATUSES.has(log.status);
    }

    if (filter === 'RESERVED') {
        return isScheduledReservationPending(log);
    }

    if (filter === 'BULK') {
        return log.source === 'BULK_SMS' || log.source === 'BULK_ALIMTALK';
    }

    return true;
}

function getEmptyMessage(filter: LogFilter) {
    if (filter === 'SUCCESS') {
        return '성공한 발송 로그가 없습니다.';
    }

    if (filter === 'FAILURE') {
        return '실패한 발송 로그가 없습니다.';
    }

    if (filter === 'RESERVED') {
        return '예약된 발송 로그가 없습니다.';
    }

    if (filter === 'BULK') {
        return '대량 발송 로그가 없습니다.';
    }

    return '최근 발송 데이터가 없습니다.';
}

function getSourceLabel(log: MessageLog) {
    if (log.source === 'BULK_SMS') {
        return '대량 SMS';
    }

    if (log.source === 'BULK_ALIMTALK') {
        return '대량 알림톡';
    }

    return '단건';
}

export function SenderSection({
    logs
}: SenderSectionProps) {
    const [filter, setFilter] = useState<LogFilter>('ALL');
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    const filteredLogs = useMemo(
        () => logs.filter((log) => matchesFilter(log, filter)),
        [filter, logs]
    );
    const visibleLogs = useMemo(
        () => filteredLogs.slice(0, visibleCount),
        [filteredLogs, visibleCount]
    );

    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [filter, logs.length]);

    const filterOptions: Array<{ key: LogFilter; label: string; count: number }> = [
        { key: 'ALL', label: '전체', count: logs.length },
        { key: 'SUCCESS', label: '성공', count: logs.filter((log) => matchesFilter(log, 'SUCCESS')).length },
        { key: 'FAILURE', label: '실패', count: logs.filter((log) => matchesFilter(log, 'FAILURE')).length },
        { key: 'RESERVED', label: '예약', count: logs.filter((log) => matchesFilter(log, 'RESERVED')).length },
        { key: 'BULK', label: '대량', count: logs.filter((log) => matchesFilter(log, 'BULK')).length }
    ];

    return (
        <Card className="glass">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>최근 메시지 발송 로그</CardTitle>
                    <CardDescription>모든 채널의 메시지 처리 및 전송 결과를 확인합니다.</CardDescription>
                </div>
                <div className="flex flex-wrap rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                    {filterOptions.map((option) => (
                        <Button
                            key={option.key}
                            variant={filter === option.key ? 'secondary' : 'ghost'}
                            size="sm"
                            className={`h-7 px-3 text-[11px] ${filter === option.key ? 'font-bold' : ''}`}
                            onClick={() => setFilter(option.key)}
                            aria-pressed={filter === option.key}
                        >
                            {option.label}
                            <span className="ml-1 text-[10px] opacity-70">{option.count}</span>
                        </Button>
                    ))}
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-hidden rounded-xl border">
                    <Table>
                        <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                            <TableRow>
                                <TableHead className="w-[180px]">일시</TableHead>
                                <TableHead>발송</TableHead>
                                <TableHead>채널</TableHead>
                                <TableHead>수신번호</TableHead>
                                <TableHead>상태</TableHead>
                                <TableHead className="max-w-[200px]">메모</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {visibleLogs.length > 0 ? (
                                visibleLogs.map((log) => {
                                    const scheduledReservationPending = isScheduledReservationPending(log);

                                    return (
                                    <TableRow key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                                        <TableCell className="text-[11px] font-medium text-muted-foreground">
                                            <div>{new Date(log.createdAt).toLocaleString('ko-KR')}</div>
                                            {log.scheduledAt ? (
                                                <div className="mt-1 text-[10px] text-primary">
                                                    예약 {new Date(log.scheduledAt).toLocaleString('ko-KR')}
                                                </div>
                                            ) : null}
                                        </TableCell>
                                        <TableCell>
                                            <div className="space-y-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-semibold text-xs">{log.title}</span>
                                                    <Badge variant="outline" className="h-5 text-[10px]">
                                                        {getSourceLabel(log)}
                                                    </Badge>
                                                </div>
                                                {log.nhnRequestId ? (
                                                    <div className="text-[10px] text-muted-foreground">
                                                        NHN 요청 ID {log.nhnRequestId}
                                                    </div>
                                                ) : null}
                                            </div>
                                        </TableCell>
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
                                        <TableCell className={`text-xs ${log.source === 'MESSAGE_REQUEST' ? 'font-mono' : 'font-medium'}`}>
                                            {log.recipientPhone}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge variant={statusVariant(log.status)} className="h-5 text-[10px]">
                                                    {log.status === 'DELIVERED' ? (
                                                        <CheckCircle2 className="mr-1 h-3 w-3" />
                                                    ) : log.status === 'DELIVERY_FAILED' ? (
                                                        <XCircle className="mr-1 h-3 w-3" />
                                                    ) : (
                                                        <Clock className="mr-1 h-3 w-3" />
                                                    )}
                                                    {log.status}
                                                </Badge>
                                                {scheduledReservationPending ? (
                                                    <Badge variant="outline" className="h-5 text-[10px]">
                                                        예약 등록
                                                    </Badge>
                                                ) : null}
                                            </div>
                                        </TableCell>
                                        <TableCell className="max-w-[200px] truncate text-[11px] text-muted-foreground">
                                            {log.lastErrorMessage || '-'}
                                        </TableCell>
                                    </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                                        {getEmptyMessage(filter)}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                {filteredLogs.length > visibleCount && (
                    <div className="mt-4 flex justify-center">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground hover:bg-transparent hover:text-primary"
                            onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
                        >
                            <MoreHorizontal className="mr-2 h-4 w-4" />
                            로그 더 보기
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
