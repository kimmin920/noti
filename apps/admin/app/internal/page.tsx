'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Building2, Download, FileSearch, RefreshCw, ShieldCheck, ShieldX } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getApiBase } from '@/lib/api-base';
import { statusVariant } from '@/lib/status';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProfileCard, type ViewerProfile } from '@/components/profile-card';
import { getSenderNumberTypeLabel, isThirdPartyBusinessType } from '@/lib/sender-number';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

type AuthMe = ViewerProfile;

type InternalSenderApplication = {
  id: string;
  phoneNumber: string;
  type: 'COMPANY' | 'EMPLOYEE';
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  telecomCertificatePath: string | null;
  consentDocumentPath: string | null;
  thirdPartyBusinessRegistrationPath: string | null;
  relationshipProofPath: string | null;
  additionalDocumentPath: string | null;
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

type InternalDashboardNotice = {
  id: string;
  title: string;
  body: string;
  isPinned: boolean;
  createdBy: string | null;
  createdByEmail: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function InternalSenderReviewPage() {
  const apiBase = getApiBase();
  const [me, setMe] = useState<AuthMe | null>(null);
  const [rows, setRows] = useState<InternalSenderApplication[]>([]);
  const [nhnRows, setNhnRows] = useState<InternalNhnRegisteredSender[]>([]);
  const [notices, setNotices] = useState<InternalDashboardNotice[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewingIds, setReviewingIds] = useState<string[]>([]);
  const [archivingNoticeIds, setArchivingNoticeIds] = useState<string[]>([]);
  const [creatingNotice, setCreatingNotice] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | InternalSenderApplication['status']>('ALL');
  const [noticeForm, setNoticeForm] = useState({
    title: '',
    body: '',
    isPinned: false
  });

  const submittedCount = useMemo(() => rows.filter((row) => row.status === 'SUBMITTED').length, [rows]);
  const approvedCount = useMemo(() => rows.filter((row) => row.status === 'APPROVED').length, [rows]);
  const rejectedCount = useMemo(() => rows.filter((row) => row.status === 'REJECTED').length, [rows]);
  const nhnRowsByPhoneNumber = useMemo(() => new Map(nhnRows.map((row) => [row.sendNo, row])), [nhnRows]);
  const rowsByPhoneNumber = useMemo(() => {
    const grouped = new Map<string, InternalSenderApplication[]>();

    for (const row of rows) {
      const current = grouped.get(row.phoneNumber) ?? [];
      current.push(row);
      grouped.set(row.phoneNumber, current);
    }

    return grouped;
  }, [rows]);

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
        setNotices([]);
        return;
      }

      const [applications, nhnRegistered, noticeRows] = await Promise.all([
        apiFetch<InternalSenderApplication[]>('/v1/internal/sender-number-applications'),
        apiFetch<InternalNhnRegisteredSender[]>('/v1/internal/nhn-registered-sender-numbers'),
        apiFetch<InternalDashboardNotice[]>('/v1/internal/dashboard-notices')
      ]);
      setRows(applications);
      setNhnRows(nhnRegistered);
      setNotices(noticeRows);
    } catch (e) {
      setMe(null);
      setRows([]);
      setNhnRows([]);
      setNotices([]);
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll().catch(() => undefined);
  }, []);

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
    kind: 'telecom' | 'consent' | 'businessRegistration' | 'relationshipProof' | 'additional' | 'employment'
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

  async function createNotice() {
    if (!noticeForm.title.trim() || !noticeForm.body.trim()) {
      setError('공지 제목과 본문을 입력하세요.');
      return;
    }

    try {
      setCreatingNotice(true);
      setError('');
      const created = await apiFetch<InternalDashboardNotice>('/v1/internal/dashboard-notices', {
        method: 'POST',
        body: JSON.stringify({
          title: noticeForm.title,
          body: noticeForm.body,
          isPinned: noticeForm.isPinned
        })
      });
      setNotices((current) => [created, ...current]);
      setNoticeForm({
        title: '',
        body: '',
        isPinned: false
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : '공지 작성 실패');
    } finally {
      setCreatingNotice(false);
    }
  }

  async function archiveNotice(id: string) {
    try {
      setArchivingNoticeIds((current) => [...current, id]);
      setError('');
      await apiFetch(`/v1/internal/dashboard-notices/${id}/archive`, {
        method: 'POST'
      });
      setNotices((current) => current.filter((notice) => notice.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : '공지 보관 실패');
    } finally {
      setArchivingNoticeIds((current) => current.filter((noticeId) => noticeId !== id));
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
                모든 사업자 신청 건을 한 화면에서 훑고, 첨부된 심사 서류를 바로 내려받고, 상태를 정리하는 전용 콘솔입니다.
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
              {me ? `${me.providerUserId} / ${me.role}` : '미인증'}
            </Badge>
            <span className='text-muted-foreground'>
              {me ? `tenant=${me.tenantId}` : 'Google 로그인 또는 내부 SSO 세션이 필요합니다.'}
            </span>
          </div>
          {!me ? (
            <Link href="/login?next=%2Finternal" className={buttonVariants()}>
              로그인 페이지 열기
            </Link>
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
              <CardTitle>공지사항 작성</CardTitle>
              <CardDescription>여기서 작성한 공지는 모든 테넌트 대시보드의 공지사항 카드에 즉시 노출됩니다.</CardDescription>
            </CardHeader>
            <CardContent className='grid gap-5 lg:grid-cols-[1.15fr_0.85fr]'>
              <div className='space-y-4'>
                <Input
                  value={noticeForm.title}
                  onChange={(event) => setNoticeForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder='공지 제목'
                />
                <Textarea
                  value={noticeForm.body}
                  onChange={(event) => setNoticeForm((current) => ({ ...current, body: event.target.value }))}
                  placeholder='테넌트 대시보드에 보여줄 공지 본문을 입력하세요.'
                  className='min-h-36'
                />
                <label className='flex items-center gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm'>
                  <input
                    type='checkbox'
                    checked={noticeForm.isPinned}
                    onChange={(event) => setNoticeForm((current) => ({ ...current, isPinned: event.target.checked }))}
                    className='h-4 w-4 rounded border-border'
                  />
                  상단 고정 공지로 등록
                </label>
                <Button onClick={() => void createNotice()} disabled={creatingNotice}>
                  {creatingNotice ? '작성 중...' : '공지 등록'}
                </Button>
              </div>

              <div className='space-y-3 rounded-3xl border border-border/70 bg-muted/15 p-4'>
                <div>
                  <div className='text-sm font-semibold text-foreground'>현재 노출 중인 공지</div>
                  <div className='mt-1 text-xs text-muted-foreground'>최신순으로 최대 12건까지 관리합니다.</div>
                </div>
                <div className='space-y-3'>
                  {notices.length > 0 ? (
                    notices.map((notice) => (
                      <div key={notice.id} className='rounded-2xl border border-border/70 bg-white/90 p-4'>
                        <div className='flex items-start justify-between gap-3'>
                          <div>
                            <div className='flex items-center gap-2'>
                              <div className='font-medium'>{notice.title}</div>
                              {notice.isPinned ? <Badge variant='warning'>고정</Badge> : null}
                            </div>
                            <div className='mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground'>{notice.body}</div>
                          </div>
                          <Button
                            variant='outline'
                            size='sm'
                            disabled={archivingNoticeIds.includes(notice.id)}
                            onClick={() => void archiveNotice(notice.id)}
                          >
                            보관
                          </Button>
                        </div>
                        <div className='mt-3 text-xs text-muted-foreground'>
                          {new Date(notice.createdAt).toLocaleString('ko-KR')}
                          {notice.createdByEmail ? ` · ${notice.createdByEmail}` : ''}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className='rounded-2xl border border-dashed border-border/70 bg-background/70 p-4 text-sm text-muted-foreground'>
                      현재 공개 중인 공지가 없습니다.
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

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
                총 {rows.length}건 중 {filteredRows.length}건 표시. NHN 사용 가능 여부와 다른 테넌트의 중복 신청/승인 이력을 함께 확인하세요.
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
                    <TableHead>중복 / 등록</TableHead>
                    <TableHead>첨부파일</TableHead>
                    <TableHead>메모</TableHead>
                    <TableHead>처리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
	                  {filteredRows.map((row) => {
	                    const nhnRow = nhnRowsByPhoneNumber.get(row.phoneNumber);
	                    const isRegisteredInNhn = Boolean(nhnRow);
	                    const isApprovedInNhn = nhnRow?.useYn === 'Y' && nhnRow?.blockYn === 'N';
	                    const isApproved = row.status === 'APPROVED';
	                    const isReviewing = reviewingIds.includes(row.id);
	                    const duplicateRows = (rowsByPhoneNumber.get(row.phoneNumber) ?? []).filter((candidate) => candidate.id !== row.id);
	                    const duplicateApprovedRows = duplicateRows.filter((candidate) => candidate.status === 'APPROVED');
	                    const approveDisabled = !isApprovedInNhn || isApproved || isReviewing;
	                    const approveLabel = isApproved ? '승인 완료' : isApprovedInNhn ? '승인' : 'NHN 미승인';
                        const attachmentButtons = [
                          {
                            key: 'telecom',
                            label: '통신증명원',
                            available: Boolean(row.telecomCertificatePath)
                          },
                          {
                            key: 'consent',
                            label: '이용승낙서',
                            available: Boolean(row.consentDocumentPath)
                          },
                          ...(row.additionalDocumentPath
                            ? [
                                {
                                  key: 'additional',
                                  label: '기타 서류',
                                  available: true
                                }
                              ]
                            : []),
                          ...(isThirdPartyBusinessType(row.type)
                            ? [
                                {
                                  key: 'businessRegistration',
                                  label: '명의 사업자등록증',
                                  available: Boolean(row.thirdPartyBusinessRegistrationPath)
                                },
                                {
                                  key: 'relationshipProof',
                                  label: '관계 확인 문서',
                                  available: Boolean(row.relationshipProofPath)
                                }
                              ]
                            : []),
                          ...(row.employmentCertificatePath
                            ? [
                                {
                                  key: 'employment',
                                  label: '구 재직증명',
                                  available: true
                                }
                              ]
                            : [])
                        ] as Array<{
                          key: 'telecom' | 'consent' | 'businessRegistration' | 'relationshipProof' | 'additional' | 'employment';
                          label: string;
                          available: boolean;
                        }>;

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
	                        <TableCell>{getSenderNumberTypeLabel(row.type)}</TableCell>
	                        <TableCell>
	                          <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
	                        </TableCell>
	                        <TableCell>
	                          <div className='flex max-w-64 flex-col gap-2'>
	                            <Badge variant={isApprovedInNhn ? 'success' : isRegisteredInNhn ? 'warning' : 'outline'} className='w-fit'>
	                              {isApprovedInNhn ? 'NHN 사용 가능' : isRegisteredInNhn ? 'NHN 등록됨' : 'NHN 미등록'}
	                            </Badge>
	                            <Badge
	                              variant={duplicateRows.length === 0 ? 'outline' : duplicateApprovedRows.length > 0 ? 'danger' : 'warning'}
	                              className='w-fit'
	                            >
	                              {duplicateRows.length === 0 ? '중복 신청 없음' : `중복 신청 ${duplicateRows.length}건`}
	                            </Badge>
	                            {duplicateApprovedRows.length > 0 ? (
	                              <Badge variant='danger' className='w-fit'>
	                                다른 테넌트 승인 있음
	                              </Badge>
	                            ) : null}
	                            <div className='text-xs leading-5 text-muted-foreground'>
	                              {duplicateRows.length > 0
	                                ? duplicateRows.map((candidate) => `${candidate.tenant.name} · ${candidate.status}`).join(' / ')
	                                : '현재 번호로 접수된 다른 테넌트 신청이 없습니다.'}
	                            </div>
	                          </div>
	                        </TableCell>
	                        <TableCell>
	                          <div className='flex flex-col gap-2'>
                                {attachmentButtons.map((attachment) => (
	                              <Button
                                    key={attachment.key}
	                                size='sm'
	                                variant='outline'
                                    disabled={!attachment.available}
	                                onClick={() => downloadAttachment(row.id, attachment.key)}
	                              >
	                                <Download className='mr-2 h-4 w-4' />
	                                {attachment.label}
	                              </Button>
                                ))}
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
                      <TableCell colSpan={8} className='py-10 text-center text-muted-foreground'>
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
              <CardTitle>등록 완료 발신번호</CardTitle>
              <CardDescription>`sendNos` 조회 결과입니다. 여기서 번호가 보여도 내부 승인 상태는 별도로 유지됩니다.</CardDescription>
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
                        등록 완료 발신번호가 없습니다.
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
