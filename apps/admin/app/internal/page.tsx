'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Building2, Download, FileSearch, RefreshCw, ShieldCheck, ShieldX } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { statusVariant } from '@/lib/status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProfileCard, type ViewerProfile } from '@/components/profile-card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

type AuthMe = ViewerProfile;

type InternalSenderApplication = {
  id: string;
  phoneNumber: string;
  type: 'COMPANY' | 'EMPLOYEE';
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  telecomCertificatePath: string | null;
  employmentCertificatePath: string | null;
  reviewMemo: string | null;
  reviewedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tenant: {
    id: string;
    name: string;
  };
};

type InternalNhnRegisteredSender = {
  serviceId: number | null;
  sendNo: string;
  useYn: 'Y' | 'N';
  blockYn: 'Y' | 'N';
  blockReason: string | null;
  createDate: string | null;
  updateDate: string | null;
  linkedToTenant: boolean;
  localSenderNumberId: string | null;
  localStatus: string | null;
  localType: string | null;
};

export default function InternalSenderReviewPage() {
  const [me, setMe] = useState<AuthMe | null>(null);
  const [rows, setRows] = useState<InternalSenderApplication[]>([]);
  const [nhnRows, setNhnRows] = useState<InternalNhnRegisteredSender[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewingIds, setReviewingIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | InternalSenderApplication['status']>('ALL');

  const submittedCount = useMemo(() => rows.filter((row) => row.status === 'SUBMITTED').length, [rows]);
  const approvedCount = useMemo(() => rows.filter((row) => row.status === 'APPROVED').length, [rows]);
  const rejectedCount = useMemo(() => rows.filter((row) => row.status === 'REJECTED').length, [rows]);
  const registeredSendNoSet = useMemo(() => new Set(nhnRows.map((row) => row.sendNo)), [nhnRows]);

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesStatus = statusFilter === 'ALL' || row.status === statusFilter;
      const matchesQuery =
        !normalized ||
        row.phoneNumber.includes(normalized) ||
        row.tenant.id.toLowerCase().includes(normalized) ||
        row.tenant.name.toLowerCase().includes(normalized);

      return matchesStatus && matchesQuery;
    });
  }, [query, rows, statusFilter]);

  async function refreshAll() {
    setLoading(true);
    setError('');

    try {
      const authMe = await apiFetch<AuthMe>('/v1/auth/me');
      setMe(authMe);

      if (authMe.role !== 'OPERATOR') {
        setRows([]);
        setNhnRows([]);
        return;
      }

      const [applications, nhnRegistered] = await Promise.all([
        apiFetch<InternalSenderApplication[]>('/v1/internal/sender-number-applications'),
        apiFetch<InternalNhnRegisteredSender[]>('/v1/internal/nhn-registered-sender-numbers')
      ]);
      setRows(applications);
      setNhnRows(nhnRegistered);
    } catch (e) {
      setMe(null);
      setRows([]);
      setNhnRows([]);
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll().catch(() => undefined);
  }, []);

  function startGoogleLogin() {
    window.location.href = `${apiBase}/v1/auth/google/start`;
  }

  async function reviewApplication(id: string, action: 'approve' | 'reject') {
    const targetRow = rows.find((row) => row.id === id);

    if (!targetRow) {
      setError('대상 신청 건을 찾을 수 없습니다.');
      return;
    }

    const memo = window.prompt(
      '검수 메모',
      action === 'approve' ? '내부 심사 승인' : '반려 사유를 입력하세요.'
    );

    try {
      setReviewingIds((current) => [...current, id]);
      setError('');
      await apiFetch(`/v1/internal/sender-number-applications/${id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ memo: memo ?? '' })
      });

      const nextStatus: InternalSenderApplication['status'] = action === 'approve' ? 'APPROVED' : 'REJECTED';
      const reviewedAt = new Date().toISOString();
      const nextMemo = memo ?? '';

      setRows((current) =>
        current.map((row) =>
          row.id === id
            ? {
                ...row,
                status: nextStatus,
                reviewMemo: nextMemo,
                approvedAt: action === 'approve' ? reviewedAt : row.approvedAt,
                updatedAt: reviewedAt
              }
            : row
        )
      );
      setNhnRows((current) =>
        current.map((row) =>
          row.sendNo === targetRow.phoneNumber
            ? {
                ...row,
                linkedToTenant: true,
                localSenderNumberId: targetRow.id,
                localStatus: nextStatus,
                localType: targetRow.type
              }
            : row
        )
      );

      void refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Review action failed');
    } finally {
      setReviewingIds((current) => current.filter((reviewingId) => reviewingId !== id));
    }
  }

  async function downloadAttachment(
    senderNumberId: string,
    kind: 'telecom' | 'employment'
  ) {
    try {
      const response = await fetch(
        `${apiBase}/v1/internal/sender-number-applications/${senderNumberId}/attachments/${kind}`,
        {
          credentials: 'include'
        }
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const header = response.headers.get('content-disposition') ?? '';
      const fileNameMatch = header.match(/filename=\"?([^"]+)\"?/i);

      link.href = url;
      link.download = fileNameMatch?.[1] ?? `${senderNumberId}_${kind}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Attachment download failed');
    }
  }

  const canUseTool = me?.role === 'OPERATOR';
  const unauthorized = me && me.role !== 'OPERATOR';

  return (
    <main className='mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-8 md:px-8'>
      <header className='relative overflow-hidden rounded-[1.75rem] border border-border/80 bg-card/90 p-6 shadow-soft backdrop-blur'>
        <div className='absolute inset-y-0 right-0 w-64 bg-[radial-gradient(circle_at_top_right,rgba(17,94,89,0.2),transparent_65%)]' />
        <div className='relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between'>
          <div className='space-y-3'>
            <Badge variant='outline' className='w-fit border-secondary/30 bg-secondary/10 text-secondary'>
              Internal Operator Surface
            </Badge>
            <div>
              <h1 className='font-display text-3xl font-semibold tracking-tight'>발신번호 심사 내부 툴</h1>
              <p className='max-w-2xl text-sm text-muted-foreground'>
                모든 사업자 신청 건을 한 화면에서 훑고, 첨부된 PDF를 바로 내려받고, 상태를 정리하는 전용 콘솔입니다.
              </p>
            </div>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Link
              href='/'
              className='inline-flex h-9 items-center justify-center rounded-md border border-border bg-transparent px-4 text-sm font-medium transition hover:bg-muted'
            >
              기본 콘솔
            </Link>
            <Button variant='secondary' onClick={refreshAll} disabled={loading}>
              <RefreshCw className='mr-2 h-4 w-4' />
              새로고침
            </Button>
          </div>
        </div>
      </header>

      <section className='grid gap-4 md:grid-cols-3'>
        <Card className='border-secondary/20 bg-card/95'>
          <CardHeader>
            <CardDescription>검수 대기</CardDescription>
            <CardTitle className='text-3xl'>{submittedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className='border-emerald-200 bg-emerald-50/70'>
          <CardHeader>
            <CardDescription>승인 완료</CardDescription>
            <CardTitle className='text-3xl'>{approvedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className='border-rose-200 bg-rose-50/70'>
          <CardHeader>
            <CardDescription>반려 완료</CardDescription>
            <CardTitle className='text-3xl'>{rejectedCount}</CardTitle>
          </CardHeader>
        </Card>
      </section>

      <Card className='border-border/80 bg-card/95'>
        <CardHeader>
          <CardTitle>세션 상태</CardTitle>
          <CardDescription>내부 운영자 계정으로 로그인되어 있어야 전체 신청 목록을 볼 수 있습니다.</CardDescription>
        </CardHeader>
        <CardContent className='space-y-3'>
          <div className='flex flex-wrap items-center gap-2 text-sm'>
            <Badge variant={me?.role === 'OPERATOR' ? 'success' : 'outline'}>
              {me ? `${me.publUserId} / ${me.role}` : '미인증'}
            </Badge>
            <span className='text-muted-foreground'>
              {me ? `tenant=${me.tenantId}` : 'Google 로그인 또는 내부 SSO 세션이 필요합니다.'}
            </span>
          </div>
          {!me ? (
            <Button onClick={startGoogleLogin}>Google 로그인</Button>
          ) : null}
          {error ? <p className='text-sm text-rose-700'>{error}</p> : null}
        </CardContent>
      </Card>

      <ProfileCard profile={me} compact />

      {unauthorized ? (
        <Card className='border-amber-300 bg-amber-50/90'>
          <CardHeader>
            <CardTitle>접근 권한 없음</CardTitle>
            <CardDescription>이 페이지는 `OPERATOR` 역할의 내부 계정만 사용할 수 있습니다.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {canUseTool ? (
        <>
          <Card className='border-border/80 bg-card/95'>
            <CardHeader>
              <CardTitle>필터</CardTitle>
              <CardDescription>사업자명, tenant ID, 전화번호로 검색하고 상태별로 좁혀보세요.</CardDescription>
            </CardHeader>
            <CardContent className='grid gap-3 md:grid-cols-[1.6fr_0.8fr]'>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='사업자명 / tenant ID / 전화번호'
              />
              <Select
                value={statusFilter}
                onValueChange={(value: 'ALL' | InternalSenderApplication['status']) => setStatusFilter(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='ALL'>전체 상태</SelectItem>
                  <SelectItem value='SUBMITTED'>SUBMITTED</SelectItem>
                  <SelectItem value='APPROVED'>APPROVED</SelectItem>
                  <SelectItem value='REJECTED'>REJECTED</SelectItem>
                  <SelectItem value='DRAFT'>DRAFT</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card className='border-border/80 bg-card/95'>
            <CardHeader>
              <CardTitle>전체 신청 목록</CardTitle>
              <CardDescription>
                총 {rows.length}건 중 {filteredRows.length}건 표시
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>사업자</TableHead>
                    <TableHead>발신번호</TableHead>
                    <TableHead>유형</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>첨부파일</TableHead>
                    <TableHead>메모</TableHead>
                    <TableHead>처리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
	                  {filteredRows.map((row) => {
	                    const isRegisteredInNhn = registeredSendNoSet.has(row.phoneNumber);
	                    const isApproved = row.status === 'APPROVED';
	                    const isReviewing = reviewingIds.includes(row.id);
	                    const approveDisabled = !isRegisteredInNhn || isApproved || isReviewing;
	                    const approveLabel = isApproved ? '승인 완료' : isRegisteredInNhn ? '승인' : 'NHN 미등록';

	                    return (
	                      <TableRow key={row.id}>
	                        <TableCell>
	                          <div className='space-y-1'>
	                            <div className='flex items-center gap-2 font-medium'>
	                              <Building2 className='h-4 w-4 text-secondary' />
	                              {row.tenant.name}
	                            </div>
	                            <div className='text-xs text-muted-foreground'>{row.tenant.id}</div>
	                          </div>
	                        </TableCell>
	                        <TableCell>
	                          <div className='space-y-1'>
	                            <div className='font-medium'>{row.phoneNumber}</div>
	                            <div className='text-xs text-muted-foreground'>
	                              신청 {new Date(row.createdAt).toLocaleString('ko-KR')}
	                            </div>
	                          </div>
	                        </TableCell>
	                        <TableCell>{row.type}</TableCell>
	                        <TableCell>
	                          <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
	                        </TableCell>
	                        <TableCell>
	                          <div className='flex flex-col gap-2'>
	                            <Button
	                              size='sm'
	                              variant='outline'
	                              disabled={!row.telecomCertificatePath}
	                              onClick={() => downloadAttachment(row.id, 'telecom')}
	                            >
	                              <Download className='mr-2 h-4 w-4' />
	                              통신증명원
	                            </Button>
	                            <Button
	                              size='sm'
	                              variant='outline'
	                              disabled={!row.employmentCertificatePath}
	                              onClick={() => downloadAttachment(row.id, 'employment')}
	                            >
	                              <Download className='mr-2 h-4 w-4' />
	                              재직증명서
	                            </Button>
	                          </div>
	                        </TableCell>
	                        <TableCell>
	                          <div className='max-w-48 text-sm text-muted-foreground'>
	                            {row.reviewMemo || '메모 없음'}
	                          </div>
	                        </TableCell>
	                        <TableCell>
	                        <div className='flex flex-col gap-2'>
	                          <Button
	                            size='sm'
	                            disabled={approveDisabled}
	                            onClick={() => reviewApplication(row.id, 'approve')}
	                          >
	                            <ShieldCheck className='mr-2 h-4 w-4' />
	                            {approveLabel}
	                          </Button>
	                          <Button
	                            size='sm'
	                            variant='outline'
	                            disabled={isReviewing}
	                            onClick={() => reviewApplication(row.id, 'reject')}
	                          >
	                            <ShieldX className='mr-2 h-4 w-4' />
	                            반려
	                          </Button>
	                        </div>
	                        </TableCell>
	                      </TableRow>
	                    );
	                  })}
                  {filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className='py-10 text-center text-muted-foreground'>
                        <div className='flex flex-col items-center gap-2'>
                          <FileSearch className='h-5 w-5' />
                          조건에 맞는 신청 건이 없습니다.
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className='border-border/80 bg-card/95'>
            <CardHeader>
              <CardTitle>NHN 등록 완료 발신번호</CardTitle>
              <CardDescription>`sendNos` 조회 결과입니다. 심사중/반려 신청건은 NHN 콘솔에서 확인해야 합니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>번호</TableHead>
                    <TableHead>사용</TableHead>
                    <TableHead>차단</TableHead>
                    <TableHead>로컬 연결</TableHead>
                    <TableHead>로컬 상태</TableHead>
                    <TableHead>등록일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nhnRows.map((row) => (
                    <TableRow key={row.sendNo}>
                      <TableCell className='font-medium'>{row.sendNo}</TableCell>
                      <TableCell>
                        <Badge variant={row.useYn === 'Y' ? 'success' : 'outline'}>{row.useYn}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.blockYn === 'Y' ? 'danger' : 'success'}>{row.blockYn}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.linkedToTenant ? 'success' : 'outline'}>
                          {row.linkedToTenant ? 'LINKED' : 'UNLINKED'}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.localStatus ?? '-'}</TableCell>
                      <TableCell>{row.createDate ? new Date(row.createDate).toLocaleString('ko-KR') : '-'}</TableCell>
                    </TableRow>
                  ))}
                  {nhnRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className='py-10 text-center text-muted-foreground'>
                        NHN에서 조회된 등록 완료 발신번호가 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}
    </main>
  );
}
