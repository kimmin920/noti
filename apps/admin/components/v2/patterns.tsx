import Link from 'next/link';
import { Check, ChevronRight, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { V2Box, V2Button, V2Chip, V2Label, V2LinkButton, V2Textarea } from './ui';

export function V2Field(props: {
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('form-group', props.className)}>
      <div className='flex items-center justify-between gap-3'>
        <label className='form-label'>
          {props.label}
          {props.required ? <span className='ml-1 text-[#d1242f]'>*</span> : null}
        </label>
        {props.action}
      </div>
      {props.children}
      {props.hint ? <p className='form-hint'>{props.hint}</p> : null}
    </div>
  );
}

export function V2ChecklistPanel(props: {
  title?: string;
  items: Array<{
    label: string;
    state: 'done' | 'pending' | 'optional';
    value: string;
  }>;
}) {
  return (
    <V2Box title={props.title ?? '발송 체크리스트'} bodyClassName='p-0'>
      {props.items.map((item, index) => (
        <div key={item.label} className={cn('flex items-center justify-between gap-4 px-4 py-2', index < props.items.length - 1 && 'border-b border-[#eaeef2]')}>
          <div className='text-[12px] text-[var(--fg-default)]'>{item.label}</div>
          <V2Label tone={item.state === 'done' ? 'green' : item.state === 'pending' ? 'yellow' : 'gray'}>{item.value}</V2Label>
        </div>
      ))}
    </V2Box>
  );
}

export function V2SmsPreview(props: {
  sender: string;
  body: string;
  subject?: string;
  attachments?: string[];
  messageType: 'SMS' | 'LMS' | 'MMS';
}) {
  const hasMessage = props.body.trim().length > 0;

  return (
    <V2Box title='미리보기'>
      <div className='rounded-[14px] bg-[#f2f2f7] p-3'>
        <div className='mb-3 text-center text-[10px] text-[#8e8e93]'>오늘 오후 2:30</div>
        {props.attachments && props.attachments.length > 0 ? (
          <div className='mb-2 flex flex-col items-end gap-2'>
            {props.attachments.map((attachment) => (
              <div key={attachment} className='w-[136px] rounded-[10px] border border-[rgba(10,132,255,0.15)] bg-[var(--canvas-default)] px-3 py-2 text-[11px] text-[var(--fg-muted)] shadow-sm'>
                {attachment}
              </div>
            ))}
          </div>
        ) : null}
        <div className='flex justify-end'>
          <div className='max-w-[195px] rounded-[16px_16px_3px_16px] bg-[#0a84ff] px-3 py-2.5 text-[12px] leading-[1.55] text-white'>
            {props.subject ? <div className='mb-1 border-b border-white/20 pb-1 text-[11px] font-semibold'>{props.subject}</div> : null}
            {hasMessage ? props.body : <span className='text-[rgba(255,255,255,0.55)]'>내용을 입력하면 표시됩니다</span>}
          </div>
        </div>
        <div className='mt-1.5 flex items-center justify-end gap-2 text-right text-[10px] text-[#8e8e93]'>
          <span>{props.sender}</span>
          <V2Chip tone='sms' className='border-transparent bg-white/70 text-[#0969da]'>
            {props.messageType}
          </V2Chip>
        </div>
      </div>
    </V2Box>
  );
}

export function V2KakaoPreview(props: {
  body: string;
  channelName: string;
  templateCode?: string;
}) {
  return (
    <V2Box title='미리보기' actions={<V2Chip tone='kakao'>알림톡</V2Chip>}>
      <div className='rounded-[16px] bg-[#b2c7d9] p-4'>
        <div className='mb-3 text-center text-[11px] text-[#555]'>오늘 오후 2:30</div>
        <div className='flex items-start gap-2'>
          <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f9e000] text-sm font-bold text-[#3c1e1e]'>
            {props.channelName.slice(1, 2).toUpperCase() || 'A'}
          </div>
          <div className='min-w-0 flex-1'>
            <div className='mb-1 text-[11px] font-semibold text-[#333]'>{props.channelName}</div>
            <div className='rounded-[4px_12px_12px_12px] bg-white p-3 text-[12px] leading-6 text-[#333] shadow-sm'>
              {props.body.trim().length > 0 ? props.body : '템플릿을 선택하면 미리보기가 표시됩니다'}
            </div>
            {props.templateCode ? <div className='mt-2 text-[10px] text-[#4b5563]'>템플릿 코드: {props.templateCode}</div> : null}
          </div>
        </div>
      </div>
    </V2Box>
  );
}

export function V2StepIndicator(props: {
  activeStep: number;
  steps: string[];
  className?: string;
}) {
  return (
    <V2Box className={props.className}>
      <div className='steps'>
        {props.steps.map((step, index) => {
          const stepNumber = index + 1;
          const done = stepNumber < props.activeStep;
          const active = stepNumber === props.activeStep;

          return (
            <div key={step} className='step'>
              <div
                className={cn(
                  'step-circle',
                  done && 'done',
                  active && 'active',
                  !done && !active && ''
                )}
              >
                {done ? <Check className='h-3.5 w-3.5' /> : stepNumber}
              </div>
              <div className={cn('step-label', done && 'done', active && 'active')}>{step}</div>
            </div>
          );
        })}
      </div>
    </V2Box>
  );
}

export function V2InfoList(props: {
  items: Array<{ label: string; value: React.ReactNode }>;
}) {
  return (
    <div className='rounded-[var(--radius)] border border-[var(--border-muted)]'>
      {props.items.map((item, index) => (
        <div key={typeof item.label === 'string' ? item.label : index} className={cn('flex items-start justify-between gap-6 px-4 py-3', index < props.items.length - 1 && 'border-b border-[#eaeef2]')}>
          <div className='text-xs text-[var(--fg-muted)]'>{item.label}</div>
          <div className='text-right text-sm text-[var(--fg-default)]'>{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export function V2OptionCard(props: {
  icon: LucideIcon;
  title: string;
  description: string;
  selected?: boolean;
  tone?: 'blue' | 'kakao';
  onClick?: () => void;
}) {
  const Icon = props.icon;
  return (
    <button
      type='button'
      onClick={props.onClick}
      className={cn(
        'flex flex-col items-center rounded-md border px-4 py-4 text-center transition',
        props.selected ? 'border-[var(--accent-emphasis)] bg-[#f5fbff] shadow-[inset_0_0_0_1px_rgba(9,105,218,0.15)]' : 'border-[var(--border-default)] bg-[var(--canvas-default)] hover:bg-[var(--canvas-subtle)]'
      )}
    >
      <Icon className={cn('mb-2 h-5 w-5', props.tone === 'kakao' ? 'text-[#7a6a00]' : 'text-[var(--accent-fg)]')} />
      <div className='text-sm font-semibold text-[var(--fg-default)]'>{props.title}</div>
      <div className='mt-1 text-xs leading-5 text-[var(--fg-muted)]'>{props.description}</div>
    </button>
  );
}

export function V2RightRail(props: { children: React.ReactNode; className?: string }) {
  return <div className={cn('space-y-3 lg:sticky lg:top-[72px]', props.className)}>{props.children}</div>;
}

export function V2EmptyResourceGuard(props: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
}) {
  const Icon = props.icon;

  return (
    <V2Box>
      <div className='px-6 py-10 text-center'>
        <Icon className='mx-auto mb-3 h-10 w-10 text-[var(--border-default)]' />
        <div className='text-base font-semibold text-[var(--fg-default)]'>{props.title}</div>
        <p className='mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--fg-muted)]'>{props.description}</p>
        <div className='mt-4'>
          <V2LinkButton href={props.actionHref} variant='accent'>
            {props.actionLabel}
          </V2LinkButton>
        </div>
      </div>
    </V2Box>
  );
}

export function V2DraftCard(props: {
  title: string;
  channel: 'SMS' | '알림톡';
  body: string;
  updatedAt: string;
}) {
  return (
    <div className='rounded-[var(--radius)] border border-[var(--border-muted)] px-4 py-4'>
      <div className='flex flex-col gap-3 md:flex-row md:items-start md:justify-between'>
        <div className='min-w-0'>
          <div className='flex flex-wrap items-center gap-2'>
            <div className='text-sm font-semibold text-[var(--fg-default)]'>{props.title}</div>
            <V2Chip tone={props.channel === 'SMS' ? 'sms' : 'kakao'}>{props.channel}</V2Chip>
          </div>
          <p className='mt-2 text-sm leading-6 text-[var(--fg-muted)]'>{props.body}</p>
          <div className='mt-2 text-xs text-[var(--fg-subtle)]'>마지막 저장: {props.updatedAt}</div>
        </div>
        <div className='flex gap-2'>
          <V2Button size='sm'>이어서 작성</V2Button>
          <V2Button size='sm' variant='danger'>
            삭제
          </V2Button>
        </div>
      </div>
    </div>
  );
}

export function V2ShortcutList(props: {
  items: Array<{ title: string; description: string; href: string }>;
}) {
  return (
    <V2Box title='바로 가기' bodyClassName='p-0'>
      {props.items.map((item, index) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn('flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-[var(--canvas-subtle)]', index < props.items.length - 1 && 'border-b border-[var(--border-subtle)]')}
        >
          <div>
            <div className='text-sm font-medium text-[var(--fg-default)]'>{item.title}</div>
            <div className='mt-1 text-xs text-[var(--fg-muted)]'>{item.description}</div>
          </div>
          <ChevronRight className='h-4 w-4 text-[var(--fg-subtle)]' />
        </Link>
      ))}
    </V2Box>
  );
}

export function V2CharacterCounter(props: {
  type: string;
  reason: string;
  countText: string;
}) {
  return (
    <div className='flex items-center justify-between rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--canvas-subtle)] px-3 py-2'>
      <div className='flex items-center gap-2'>
        <V2Chip tone='sms'>{props.type}</V2Chip>
        <span className='text-xs text-[var(--fg-muted)]'>{props.reason}</span>
      </div>
      <span className='font-mono text-xs text-[var(--fg-muted)]'>{props.countText}</span>
    </div>
  );
}

export function V2MessageSummaryCard(props: {
  title: string;
  body: string;
  footer?: React.ReactNode;
}) {
  return (
    <V2Box title={props.title}>
      <V2Textarea value={props.body} readOnly className='min-h-[120px] resize-none bg-[var(--canvas-subtle)] text-[var(--fg-muted)]' />
      {props.footer ? <div className='mt-3'>{props.footer}</div> : null}
    </V2Box>
  );
}

export function V2StatusHeader(props: {
  title: string;
  subtitle: string;
  status: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className='mb-4 flex flex-col gap-3 border-b border-[#d0d7de] pb-4 md:flex-row md:items-center md:justify-between'>
      <div>
        <div className='flex flex-wrap items-center gap-2'>
          <h1 className='text-[20px] font-semibold tracking-[-0.3px] text-[var(--fg-default)]'>{props.title}</h1>
          {props.status}
        </div>
        <p className='mt-1 text-[13px] text-[var(--fg-muted)]'>{props.subtitle}</p>
      </div>
      {props.action}
    </div>
  );
}

export function V2ReviewNotice() {
  return (
    <div className='mb-4 rounded-[var(--radius)] border border-[rgba(9,105,218,0.2)] bg-[var(--accent-subtle)] px-[14px] py-[10px] text-[13px] text-[var(--accent-fg)]'>
      발송 전 최종 확인입니다. 발송 후에는 취소가 어렵습니다.
    </div>
  );
}
