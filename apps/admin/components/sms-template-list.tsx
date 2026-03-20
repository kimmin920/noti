'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import Link from 'next/link';
import { FileSearch, PencilLine, Plus, RefreshCw, RotateCcw, Search, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { statusVariant } from '@/lib/status';
import { cn } from '@/lib/utils';
import type { Template } from '@/types/admin';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type StatusFilter = 'ALL' | Template['status'];
type RowAction = 'archive' | 'restore' | null;

interface SmsTemplateListProps {
  templates: Template[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  setGlobalError: (message: string) => void;
}

export function SmsTemplateList({
  templates,
  loading,
  onRefresh,
  setGlobalError
}: SmsTemplateListProps) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [actionTemplateId, setActionTemplateId] = useState<string | null>(null);
  const [rowAction, setRowAction] = useState<RowAction>(null);

  const deferredQuery = useDeferredValue(query);

  const smsTemplates = useMemo(
    () =>
      templates
        .filter((template) => template.channel === 'SMS')
        .sort((left, right) => Number(new Date(right.updatedAt)) - Number(new Date(left.updatedAt))),
    [templates]
  );

  const publishedCount = useMemo(
    () => smsTemplates.filter((template) => template.status === 'PUBLISHED').length,
    [smsTemplates]
  );
  const draftCount = useMemo(
    () => smsTemplates.filter((template) => template.status === 'DRAFT').length,
    [smsTemplates]
  );
  const archivedCount = useMemo(
    () => smsTemplates.filter((template) => template.status === 'ARCHIVED').length,
    [smsTemplates]
  );

  const filteredTemplates = useMemo(() => {
    const keyword = deferredQuery.trim().toLowerCase();

    return smsTemplates.filter((template) => {
      const matchesStatus = statusFilter === 'ALL' || template.status === statusFilter;
      const matchesKeyword =
        !keyword ||
        template.name.toLowerCase().includes(keyword) ||
        template.body.toLowerCase().includes(keyword) ||
        template.requiredVariables.some((variable) => variable.toLowerCase().includes(keyword));

      return matchesStatus && matchesKeyword;
    });
  }, [deferredQuery, smsTemplates, statusFilter]);

  async function archiveTemplate(template: Template) {
    if (!window.confirm(`"${template.name}" 템플릿을 삭제(보관)할까요?`)) {
      return;
    }

    try {
      setActionTemplateId(template.id);
      setRowAction('archive');
      setGlobalError('');
      await apiFetch(`/v1/templates/${template.id}/archive`, { method: 'POST' });
      await onRefresh();
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : '템플릿 보관에 실패했습니다.');
    } finally {
      setActionTemplateId(null);
      setRowAction(null);
    }
  }

  async function restoreTemplate(template: Template) {
    try {
      setActionTemplateId(template.id);
      setRowAction('restore');
      setGlobalError('');
      await apiFetch(`/v1/templates/${template.id}/publish`, { method: 'POST' });
      await onRefresh();
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : '템플릿 복구에 실패했습니다.');
    } finally {
      setActionTemplateId(null);
      setRowAction(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/80 bg-card/95">
          <CardHeader>
            <CardDescription>게시 완료</CardDescription>
            <CardTitle className="text-3xl">{publishedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-amber-200 bg-amber-50/70">
          <CardHeader>
            <CardDescription>임시저장</CardDescription>
            <CardTitle className="text-3xl">{draftCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-slate-200 bg-slate-100/80">
          <CardHeader>
            <CardDescription>보관됨</CardDescription>
            <CardTitle className="text-3xl">{archivedCount}</CardTitle>
          </CardHeader>
        </Card>
      </section>

      <Card className="border-border/80 bg-card/95">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle>필터</CardTitle>
              <CardDescription>제목, 본문, 변수명으로 검색하고 상태별로 목록을 좁혀보세요.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={onRefresh} disabled={loading}>
                <RefreshCw className="mr-2 h-4 w-4" />
                새로고침
              </Button>
              <Link
                href="/send/sms/templates/new"
                className={cn(buttonVariants(), 'shadow-lg shadow-primary/20')}
              >
                <Plus className="mr-2 h-4 w-4" />
                새 템플릿
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1.6fr_0.8fr]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="제목 / 본문 / 변수 검색"
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">전체 상태</SelectItem>
              <SelectItem value="PUBLISHED">PUBLISHED</SelectItem>
              <SelectItem value="DRAFT">DRAFT</SelectItem>
              <SelectItem value="ARCHIVED">ARCHIVED</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/95">
        <CardHeader>
          <CardTitle>SMS 템플릿 목록</CardTitle>
          <CardDescription>
            총 {smsTemplates.length}건 중 {filteredTemplates.length}건 표시
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>제목</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>본문</TableHead>
                <TableHead>최근 수정</TableHead>
                <TableHead>관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTemplates.map((template) => {
                const busy = actionTemplateId === template.id;
                return (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <Link
                          href={`/send/sms/templates/${template.id}`}
                          className="inline-flex items-center gap-2 font-medium transition hover:text-primary"
                        >
                          <PencilLine className="h-4 w-4 text-secondary" />
                          {template.name}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(template.status)}>{template.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="group relative max-w-[30rem]">
                        <div
                          className="truncate text-sm leading-6 text-muted-foreground"
                          title={template.body}
                        >
                          {template.body.replace(/\s+/g, ' ').trim()}
                        </div>
                        <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden w-[30rem] max-w-[min(30rem,calc(100vw-8rem))] rounded-2xl border border-border/80 bg-background/95 p-4 text-sm leading-6 text-foreground shadow-2xl shadow-slate-950/10 backdrop-blur-xl group-hover:block">
                          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            전체 본문
                          </div>
                          <div className="whitespace-pre-wrap break-words text-muted-foreground">
                            {template.body}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(template.updatedAt).toLocaleString('ko-KR')}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-2">
                        <Link
                          href={`/send/sms/templates/${template.id}`}
                          className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}
                        >
                          <PencilLine className="mr-2 h-4 w-4" />
                          수정
                        </Link>
                        {template.status === 'ARCHIVED' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => restoreTemplate(template)}
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            {busy && rowAction === 'restore' ? '복구 중...' : '복구'}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => archiveTemplate(template)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {busy && rowAction === 'archive' ? '보관 중...' : '삭제(보관)'}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

              {filteredTemplates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <FileSearch className="h-5 w-5" />
                      조건에 맞는 SMS 템플릿이 없습니다.
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
