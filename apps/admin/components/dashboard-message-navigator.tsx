'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type MessagePurpose = 'INFORMATIONAL' | 'ADVERTISING';
type MessageChannel = 'SMS' | 'KAKAO';
type MessageAudience = 'SINGLE' | 'BULK';
type MessageTiming = 'NOW' | 'SCHEDULED';

type NavigatorOption<T extends string> = {
  value: T;
  label: string;
};

const PURPOSE_OPTIONS: NavigatorOption<MessagePurpose>[] = [
  { value: 'INFORMATIONAL', label: '정보성' },
  { value: 'ADVERTISING', label: '광고성' }
];

const CHANNEL_OPTIONS: NavigatorOption<MessageChannel>[] = [
  { value: 'SMS', label: '문자' },
  { value: 'KAKAO', label: '카카오 메시지' }
];

const AUDIENCE_OPTIONS: NavigatorOption<MessageAudience>[] = [
  { value: 'SINGLE', label: '한명' },
  { value: 'BULK', label: '여러명' }
];

const TIMING_OPTIONS: NavigatorOption<MessageTiming>[] = [
  { value: 'NOW', label: '지금 바로' },
  { value: 'SCHEDULED', label: '예약 발송' }
];

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className
}: {
  value: T;
  options: NavigatorOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border border-slate-200/80 bg-white/88 p-1 shadow-[0_16px_35px_rgba(148,163,184,0.14)] backdrop-blur',
        className
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={selected}
            className={cn(
              'rounded-full px-5 py-3 text-lg font-bold tracking-tight transition duration-200 sm:px-7',
              selected
                ? 'bg-[linear-gradient(135deg,#1d4ed8,#312e81)] text-white shadow-[0_10px_22px_rgba(49,46,129,0.34)]'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

interface DashboardMessageNavigatorProps {
  approvedSenderNumberCount: number;
  readySenderProfileCount: number;
  approvedAlimtalkTemplateCount: number;
}

export function DashboardMessageNavigator({
  approvedSenderNumberCount,
  readySenderProfileCount,
  approvedAlimtalkTemplateCount
}: DashboardMessageNavigatorProps) {
  const [purpose, setPurpose] = useState<MessagePurpose>('INFORMATIONAL');
  const [channel, setChannel] = useState<MessageChannel>('SMS');
  const [audience, setAudience] = useState<MessageAudience>('SINGLE');
  const [timing, setTiming] = useState<MessageTiming>('NOW');

  const shortcut = useMemo(() => {
    const params = new URLSearchParams();
    params.set('purpose', purpose === 'ADVERTISING' ? 'advertising' : 'informational');
    if (timing === 'SCHEDULED') {
      params.set('timing', 'scheduled');
    }

    if (channel === 'SMS') {
      if (approvedSenderNumberCount === 0) {
        return {
          href: '/send/sms/sender-numbers',
          label: 'SMS 발신번호 등록하기'
        };
      }

      const path = audience === 'SINGLE' ? '/send/sms/single' : '/send/sms/bulk';
      return {
        href: `${path}?${params.toString()}`,
        label:
          audience === 'SINGLE'
            ? timing === 'SCHEDULED'
              ? '문자 예약 발송 바로가기'
              : '문자 발송 바로가기'
            : timing === 'SCHEDULED'
              ? '대량 문자 예약 바로가기'
              : '대량 문자 바로가기'
      };
    }

    if (readySenderProfileCount === 0) {
      return {
        href: '/send/alimtalk/channels',
        label: '카카오 채널 연결하기'
      };
    }

    if (approvedAlimtalkTemplateCount === 0) {
      return {
        href: '/send/alimtalk/templates',
        label: '알림톡 템플릿 준비하기'
      };
    }

    const path = audience === 'SINGLE' ? '/send/alimtalk/single' : '/send/alimtalk/bulk';
    return {
      href: `${path}?${params.toString()}`,
      label:
        audience === 'SINGLE'
          ? timing === 'SCHEDULED'
            ? '카카오 예약 발송 바로가기'
            : '카카오 발송 바로가기'
          : timing === 'SCHEDULED'
            ? '대량 카카오 예약 바로가기'
            : '대량 카카오 바로가기'
    };
  }, [
    approvedAlimtalkTemplateCount,
    approvedSenderNumberCount,
    audience,
    channel,
    purpose,
    readySenderProfileCount,
    timing
  ]);

  return (
    <section className="relative overflow-hidden rounded-[2.25rem] border border-white/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.9),rgba(242,246,255,0.96))] px-6 py-8 shadow-[0_28px_90px_rgba(148,163,184,0.18)] backdrop-blur md:px-10 md:py-10">
      <div className="absolute inset-y-0 right-0 w-64 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.16),transparent_62%)]" />
      <div className="absolute bottom-0 left-0 h-40 w-56 bg-[radial-gradient(circle_at_bottom_left,rgba(79,70,229,0.1),transparent_70%)]" />

      <div className="relative space-y-8">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            Sentence Navigator
          </div>
        </div>

        <div className="space-y-4 text-[clamp(2.2rem,5vw,4.25rem)] font-black leading-[0.95] tracking-[-0.05em] text-slate-900">
          <div className="flex flex-wrap items-center gap-4">
            <span>저는</span>
            <SegmentedControl value={purpose} options={PURPOSE_OPTIONS} onChange={setPurpose} />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <SegmentedControl
              value={channel}
              options={CHANNEL_OPTIONS}
              onChange={setChannel}
              className="max-w-full"
            />
            <span>를</span>
            <SegmentedControl value={audience} options={AUDIENCE_OPTIONS} onChange={setAudience} />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <span>에게</span>
            <SegmentedControl value={timing} options={TIMING_OPTIONS} onChange={setTiming} />
            <span>하고 싶어요.</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/80 pt-2">
          <div className="text-sm font-medium text-slate-500">
            대시보드에서 바로 원하는 발송 흐름으로 이동할 수 있습니다.
          </div>
          <Link
            href={shortcut.href}
            className={cn(
              buttonVariants(),
              'h-12 rounded-full px-6 text-sm font-semibold shadow-[0_16px_30px_rgba(49,46,129,0.22)]'
            )}
          >
            {shortcut.label}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
