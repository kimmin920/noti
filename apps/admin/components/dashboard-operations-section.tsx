'use client';

import { BellRing, BriefcaseBusiness, Gauge, Megaphone, RefreshCw, WalletCards } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardOverview } from '@/types/admin';
import { cn } from '@/lib/utils';

type DashboardOperationsSectionProps = {
  overview: DashboardOverview | null;
  loading: boolean;
  savingKey: 'autoRechargeEnabled' | 'lowBalanceAlertEnabled' | null;
  onToggleSetting: (key: 'autoRechargeEnabled' | 'lowBalanceAlertEnabled', value: boolean) => Promise<void>;
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getLoginProviderLabel(provider: DashboardOverview['account']['loginProvider']) {
  if (provider === 'GOOGLE_OAUTH') return 'Google OAuth';
  if (provider === 'LOCAL_PASSWORD') return 'Local Password';
  return 'Publ SSO';
}

function ToggleRow(props: {
  title: string;
  description: string;
  checked: boolean;
  pending: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type='button'
      role='switch'
      aria-checked={props.checked}
      disabled={props.pending}
      onClick={props.onToggle}
      className={cn(
        'flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition',
        props.checked
          ? 'border-amber-300 bg-amber-50 shadow-[0_12px_28px_rgba(250,204,21,0.18)]'
          : 'border-border/80 bg-white hover:border-amber-200 hover:bg-amber-50/40'
      )}
    >
      <div>
        <div className='font-medium text-slate-900'>{props.title}</div>
        <div className='mt-1 text-sm text-muted-foreground'>{props.description}</div>
      </div>
      <div className='flex items-center gap-3'>
        <Badge variant={props.checked ? 'warning' : 'outline'}>{props.checked ? 'ON' : 'OFF'}</Badge>
        <div
          className={cn(
            'relative h-7 w-12 rounded-full transition',
            props.checked ? 'bg-amber-400' : 'bg-slate-200'
          )}
        >
          <span
            className={cn(
              'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition',
              props.checked ? 'left-6' : 'left-1'
            )}
          />
        </div>
      </div>
    </button>
  );
}

export function DashboardOperationsSection({
  overview,
  loading,
  savingKey,
  onToggleSetting
}: DashboardOperationsSectionProps) {
  if (!overview) {
    return (
      <Card className='border-border/80 bg-card/95'>
        <CardHeader>
          <CardTitle>운영 설정</CardTitle>
          <CardDescription>계정, 잔액 설정, 발송 한도, 공지사항을 불러오고 있습니다.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const usageRatio =
    overview.sendQuota.dailyMax > 0
      ? Math.min(100, Math.round((overview.sendQuota.todaySent / overview.sendQuota.dailyMax) * 100))
      : 0;

  return (
    <section className='grid gap-6 md:grid-cols-2'>
      <Card className='overflow-hidden border-amber-200 bg-[linear-gradient(180deg,rgba(255,247,204,0.92),rgba(255,255,255,0.98))] shadow-[0_20px_45px_rgba(250,204,21,0.12)]'>
        <CardHeader>
          <div className='flex items-center justify-between gap-3'>
            <div>
              <CardDescription className='text-slate-600'>계정 관련</CardDescription>
              <CardTitle className='mt-1 flex items-center gap-2 text-slate-900'>
                <BriefcaseBusiness className='h-5 w-5 text-amber-600' />
                {overview.account.tenantName}
              </CardTitle>
            </div>
            <Badge variant={overview.account.tenantStatus === 'ACTIVE' ? 'success' : 'warning'}>
              {overview.account.tenantStatus}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className='grid gap-3 sm:grid-cols-2'>
          <div className='rounded-2xl border border-amber-200/70 bg-white/80 p-4'>
            <div className='text-xs font-semibold uppercase tracking-[0.18em] text-amber-700'>Tenant</div>
            <div className='mt-2 text-base font-semibold text-slate-900'>{overview.account.tenantId}</div>
            <div className='mt-1 text-sm text-muted-foreground'>가입일 {formatDateTime(overview.account.tenantCreatedAt)}</div>
          </div>
          <div className='rounded-2xl border border-amber-200/70 bg-white/80 p-4'>
            <div className='text-xs font-semibold uppercase tracking-[0.18em] text-amber-700'>계정</div>
            <div className='mt-2 text-base font-semibold text-slate-900'>
              {overview.account.loginId || overview.account.email || overview.account.providerUserId}
            </div>
            <div className='mt-1 text-sm text-muted-foreground'>{getLoginProviderLabel(overview.account.loginProvider)}</div>
          </div>
          <div className='rounded-2xl border border-amber-200/70 bg-white/80 p-4'>
            <div className='text-xs font-semibold uppercase tracking-[0.18em] text-amber-700'>연락 메일</div>
            <div className='mt-2 break-all text-sm font-medium text-slate-900'>{overview.account.email || '등록된 메일 없음'}</div>
          </div>
          <div className='rounded-2xl border border-amber-200/70 bg-white/80 p-4'>
            <div className='text-xs font-semibold uppercase tracking-[0.18em] text-amber-700'>역할</div>
            <div className='mt-2 text-base font-semibold text-slate-900'>{overview.account.role}</div>
            <div className='mt-1 text-sm text-muted-foreground'>계정 생성 {formatDateTime(overview.account.joinedAt)}</div>
          </div>
        </CardContent>
      </Card>

      <Card className='border-border/80 bg-card/95'>
        <CardHeader>
          <CardDescription>잔액 관련</CardDescription>
          <CardTitle className='mt-1 flex items-center gap-2'>
            <WalletCards className='h-5 w-5 text-amber-500' />
            잔액 자동화 설정
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          <ToggleRow
            title='잔액 자동 충전'
            description='잔액이 부족해질 때 자동 충전 흐름을 사용합니다.'
            checked={overview.balance.autoRechargeEnabled}
            pending={savingKey === 'autoRechargeEnabled'}
            onToggle={() => onToggleSetting('autoRechargeEnabled', !overview.balance.autoRechargeEnabled)}
          />
          <ToggleRow
            title='잔액 소진 알림'
            description='잔액이 줄어들면 운영 메일과 대시보드에서 알림을 받습니다.'
            checked={overview.balance.lowBalanceAlertEnabled}
            pending={savingKey === 'lowBalanceAlertEnabled'}
            onToggle={() => onToggleSetting('lowBalanceAlertEnabled', !overview.balance.lowBalanceAlertEnabled)}
          />
          <div className='rounded-2xl border border-dashed border-border/80 bg-muted/25 px-4 py-3 text-sm text-muted-foreground'>
            현재 기본값은 모두 `OFF`입니다. 실제 충전/경보 자동화는 이 설정을 기준으로 후속 작업에 연결할 수 있습니다.
          </div>
        </CardContent>
      </Card>

      <Card className='border-border/80 bg-card/95'>
        <CardHeader>
          <div className='flex items-center justify-between gap-3'>
            <div>
              <CardDescription>발송량 제한</CardDescription>
              <CardTitle className='mt-1 flex items-center gap-2'>
                <Gauge className='h-5 w-5 text-emerald-500' />
                오늘 발송량
              </CardTitle>
            </div>
            <Badge variant={usageRatio >= 90 ? 'danger' : usageRatio >= 60 ? 'warning' : 'success'}>
              {usageRatio}%
            </Badge>
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid gap-3 sm:grid-cols-3'>
            <div className='rounded-2xl border border-border/70 bg-white p-4'>
              <div className='text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground'>남은 발송량</div>
              <div className='mt-2 text-3xl font-black text-slate-900'>{overview.sendQuota.remaining.toLocaleString()}</div>
            </div>
            <div className='rounded-2xl border border-border/70 bg-white p-4'>
              <div className='text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground'>오늘 발송</div>
              <div className='mt-2 text-3xl font-black text-slate-900'>{overview.sendQuota.todaySent.toLocaleString()}</div>
            </div>
            <div className='rounded-2xl border border-border/70 bg-white p-4'>
              <div className='text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground'>하루 최대</div>
              <div className='mt-2 text-3xl font-black text-slate-900'>{overview.sendQuota.dailyMax.toLocaleString()}</div>
            </div>
          </div>
          <div>
            <div className='mb-2 flex items-center justify-between text-sm text-muted-foreground'>
              <span>일일 사용률</span>
              <span>{overview.sendQuota.todaySent.toLocaleString()} / {overview.sendQuota.dailyMax.toLocaleString()}</span>
            </div>
            <div className='h-3 overflow-hidden rounded-full bg-slate-100'>
              <div
                className='h-full rounded-full bg-[linear-gradient(90deg,#facc15,#f59e0b,#10b981)] transition-all'
                style={{ width: `${Math.max(4, usageRatio)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className='border-border/80 bg-card/95'>
        <CardHeader>
          <div className='flex items-center justify-between gap-3'>
            <div>
              <CardDescription>공지사항</CardDescription>
              <CardTitle className='mt-1 flex items-center gap-2'>
                <Megaphone className='h-5 w-5 text-rose-500' />
                운영 공지
              </CardTitle>
            </div>
            {loading ? <RefreshCw className='h-4 w-4 animate-spin text-muted-foreground' /> : null}
          </div>
        </CardHeader>
        <CardContent className='space-y-3'>
          {overview.notices.length > 0 ? (
            overview.notices.map((notice) => (
              <div key={notice.id} className='rounded-2xl border border-border/70 bg-white p-4'>
                <div className='flex items-start justify-between gap-3'>
                  <div>
                    <div className='flex items-center gap-2'>
                      <div className='font-semibold text-slate-900'>{notice.title}</div>
                      {notice.isPinned ? <Badge variant='warning'>고정</Badge> : null}
                    </div>
                    <div className='mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground'>{notice.body}</div>
                  </div>
                  <BellRing className='mt-1 h-4 w-4 text-rose-400' />
                </div>
                <div className='mt-3 text-xs text-muted-foreground'>
                  {formatDateTime(notice.createdAt)}
                  {notice.createdByEmail ? ` · ${notice.createdByEmail}` : ''}
                </div>
              </div>
            ))
          ) : (
            <div className='rounded-2xl border border-dashed border-border/80 bg-muted/20 p-5 text-sm text-muted-foreground'>
              현재 노출 중인 공지사항이 없습니다.
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
