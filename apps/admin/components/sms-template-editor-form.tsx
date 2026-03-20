'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Archive, CheckCircle2, RotateCcw, Save, Sparkles } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import {
  DEFAULT_SMS_TEMPLATE_VARIABLES,
  extractHashTemplateVariables,
  mergeTemplateVariables
} from '@/lib/template-variables';
import { cn } from '@/lib/utils';
import type { Template } from '@/types/admin';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TemplateChipEditor } from '@/components/template-chip-editor';

type EditorMode = 'create' | 'edit';
type SubmitAction = 'save' | 'publish' | 'archive' | 'restore' | null;

interface SmsTemplateEditorFormProps {
  mode: EditorMode;
  template?: Template | null;
}

export function SmsTemplateEditorForm({ mode, template = null }: SmsTemplateEditorFormProps) {
  const router = useRouter();
  const [name, setName] = useState(template?.name ?? '');
  const [body, setBody] = useState(template?.body ?? '');
  const [customVariables, setCustomVariables] = useState<string[]>(extractHashTemplateVariables(template?.body ?? ''));
  const [error, setError] = useState('');
  const [submitAction, setSubmitAction] = useState<SubmitAction>(null);

  const availableVariables = useMemo(
    () =>
      mergeTemplateVariables(
        [...DEFAULT_SMS_TEMPLATE_VARIABLES],
        customVariables,
        extractHashTemplateVariables(body)
      ),
    [body, customVariables]
  );

  function addVariable(nameToAdd: string) {
    setCustomVariables((current) => mergeTemplateVariables(current, [nameToAdd]));
  }

  function validate() {
    if (!name.trim()) {
      throw new Error('템플릿 제목은 필수입니다.');
    }

    if (!body.trim()) {
      throw new Error('템플릿 본문을 입력하세요.');
    }
  }

  async function save(target: 'keep' | 'publish') {
    try {
      validate();
      setError('');
      setSubmitAction(target === 'publish' ? 'publish' : 'save');

      const payload = {
        channel: 'SMS' as const,
        name: name.trim(),
        body
      };

      const saved =
        mode === 'create'
          ? await apiFetch<Template>('/v1/templates', {
              method: 'POST',
              body: JSON.stringify(payload)
            })
          : await apiFetch<Template>(`/v1/templates/${template!.id}`, {
              method: 'PUT',
              body: JSON.stringify(payload)
            });

      const finalTemplate =
        target === 'publish'
          ? await apiFetch<Template>(`/v1/templates/${saved.id}/publish`, {
              method: 'POST'
            })
          : saved;

      router.push(`/send/sms/templates/${finalTemplate.id}`);
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'SMS 템플릿 저장에 실패했습니다.');
    } finally {
      setSubmitAction(null);
    }
  }

  async function archive() {
    if (!template) {
      return;
    }

    if (!window.confirm(`"${template.name}" 템플릿을 삭제(보관)할까요?`)) {
      return;
    }

    try {
      setError('');
      setSubmitAction('archive');
      await apiFetch(`/v1/templates/${template.id}/archive`, { method: 'POST' });
      router.push('/send/sms/templates');
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '템플릿 보관에 실패했습니다.');
    } finally {
      setSubmitAction(null);
    }
  }

  async function restore() {
    if (!template) {
      return;
    }

    try {
      setError('');
      setSubmitAction('restore');
      await apiFetch(`/v1/templates/${template.id}/publish`, { method: 'POST' });
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '템플릿 복구에 실패했습니다.');
    } finally {
      setSubmitAction(null);
    }
  }

  const archived = template?.status === 'ARCHIVED';

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="border-border/80 bg-card/95">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                {mode === 'create' ? 'Create Template' : 'Edit Template'}
              </div>
              <div>
                <CardTitle className="text-2xl">
                  {mode === 'create' ? '새 SMS 템플릿 작성' : template?.name || 'SMS 템플릿 편집'}
                </CardTitle>
                <CardDescription>
                  제목은 필수입니다. 본문에 `#&#123;이름&#125;`을 직접 입력하거나 변수 칩을 눌러 삽입하세요.
                </CardDescription>
              </div>
            </div>
            <Link
              href="/send/sms/templates"
              className={cn(buttonVariants({ variant: 'outline' }))}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              목록으로
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="sms-template-name">템플릿 제목</Label>
            <Input
              id="sms-template-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="예: 결제 완료 안내"
            />
          </div>

          <TemplateChipEditor
            value={body}
            variables={availableVariables}
            onChange={setBody}
            onAddVariable={addVariable}
          />

          {error ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {archived ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              이 템플릿은 보관 상태입니다. 수정 후 다시 쓰려면 `복구 후 게시`를 누르세요.
            </div>
          ) : null}

          <div className="flex flex-wrap justify-between gap-3 border-t border-border/60 pt-5">
            <div className="flex flex-wrap gap-2">
              {mode === 'edit' && template && !archived ? (
                <Button type="button" variant="outline" onClick={archive} disabled={submitAction !== null}>
                  <Archive className="mr-2 h-4 w-4" />
                  {submitAction === 'archive' ? '보관 중...' : '삭제(보관)'}
                </Button>
              ) : null}
              {mode === 'edit' && template && archived ? (
                <Button type="button" variant="outline" onClick={restore} disabled={submitAction !== null}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {submitAction === 'restore' ? '복구 중...' : '복구 후 게시'}
                </Button>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => save('keep')} disabled={submitAction !== null}>
                <Save className="mr-2 h-4 w-4" />
                {submitAction === 'save' ? '저장 중...' : '저장'}
              </Button>
              <Button type="button" onClick={() => save('publish')} disabled={submitAction !== null} className="shadow-lg shadow-primary/20">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {submitAction === 'publish' ? '게시 중...' : '저장 후 게시'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <aside className="space-y-6">
        <Card className="glass">
          <CardHeader>
            <CardTitle>작성 규칙</CardTitle>
            <CardDescription>이벤트 규칙에 연결하기 전에 확인할 기준입니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-2xl border bg-background/80 px-4 py-3">
              제목은 운영자가 목록에서 바로 구분할 수 있게 업무 단위로 짓는 편이 좋습니다.
            </div>
            <div className="rounded-2xl border bg-background/80 px-4 py-3">
              `#{'{변수}'}` 저장 포맷을 사용하며, 발송 시 실제 값으로 치환됩니다.
            </div>
            <div className="rounded-2xl border bg-background/80 px-4 py-3">
              이벤트 규칙에 연결하려면 최종 상태가 `PUBLISHED`여야 합니다.
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>저장 미리보기</CardTitle>
            <CardDescription>현재 본문이 실제로 저장되는 형태입니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap break-words rounded-2xl border bg-background/85 px-4 py-4 text-xs leading-6 text-muted-foreground">
              {body || '본문을 입력하면 여기에 저장 포맷이 표시됩니다.'}
            </pre>
            <div className="mt-4 flex flex-wrap gap-2">
              {availableVariables.map((variable) => (
                <div
                  key={variable}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/15 bg-primary/5 px-2 py-1 text-[11px] font-semibold text-primary"
                >
                  <span className="rounded-full bg-primary px-1 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-primary-foreground">
                    변수
                  </span>
                  <span>{variable}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {template ? (
          <Card className="glass">
            <CardHeader>
              <CardTitle>현재 상태</CardTitle>
              <CardDescription>이 템플릿의 메타 정보입니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-2xl border bg-background/80 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Status</div>
                <div className="mt-2 font-medium">{template.status}</div>
              </div>
              <div className="rounded-2xl border bg-background/80 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Updated</div>
                <div className="mt-2 font-medium">{new Date(template.updatedAt).toLocaleString('ko-KR')}</div>
              </div>
              <div className="rounded-2xl border bg-background/80 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Template ID</div>
                <div className="mt-2 break-all font-medium">{template.id}</div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </aside>
    </div>
  );
}
