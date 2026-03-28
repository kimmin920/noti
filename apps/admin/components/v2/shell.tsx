'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Bell,
  CircleCheckBig,
  FileText,
  Inbox,
  KeyRound,
  LayoutDashboard,
  Lock,
  LucideIcon,
  MessageCircle,
  MessageSquare,
  Send,
  Settings,
  Users,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { canSendCampaign, canSendKakao, canSendSms, draftMessages, setupItems, workspaceName } from './data';

function SetupBox() {
  const allDone = setupItems.every((item) => item.status === 'active');
  const SetupIcon = allDone ? CircleCheckBig : Bell;

  return (
    <div className={cn('setup-box', allDone && 'all-done')}>
      <div className='setup-box-title'>
        <SetupIcon className='icon icon-14' />
        {allDone ? '모든 발신 자원 준비 완료' : '초기 설정이 필요합니다'}
      </div>
      <div>
        {setupItems.map((item) => (
          <div key={item.key} className='setup-row'>
            <span className={cn('dot', item.status === 'active' && 'done', item.status !== 'active' && 'pending')} />
            {item.description}
          </div>
        ))}
      </div>
      <Link
        href='/v2/resources'
        className={cn('setup-cta', allDone && 'text-[var(--success-fg)]')}
      >
        {allDone ? '발신 자원 관리 열기' : '설정 시작하기'}
      </Link>
    </div>
  );
}

function DraftInboxWidget() {
  const count = draftMessages.length;

  return (
    <Link
      href='/v2/drafts'
      className='mb-3 flex w-full flex-col items-center gap-1 rounded-[10px] px-2 py-2 text-center transition hover:bg-[var(--canvas-inset)]'
    >
      <div className='relative h-[72px] w-[72px] overflow-visible rounded-[18px] bg-[linear-gradient(180deg,#7ab4e4_0%,#6aa8de_60%,#4d6ac8_100%)] shadow-[0_4px_14px_rgba(13,85,196,0.28),0_1px_3px_rgba(13,85,196,0.16),inset_0_1px_0_rgba(255,255,255,0.25)]'>
        <div className='absolute left-[5px] right-[5px] top-[5px] h-[65%] rounded-[13px] bg-[#0b3d4e] shadow-[inset_0_5px_12px_rgba(18,80,104,0.9),inset_0_2px_4px_rgba(0,0,0,0.45)]' />
        <div className='absolute left-[5px] right-[5px] top-[5px] h-[65%] overflow-hidden rounded-[13px]'>
          {draftMessages.slice(0, 3).map((draft, index) => (
            <div
              key={draft.id}
              className='absolute left-[2px] right-[2px] flex h-[18px] items-center gap-1 rounded bg-white px-1.5 text-[9px] shadow-[0_2px_6px_rgba(0,0,0,0.22)]'
              style={{ bottom: `${index * 10}px`, transform: `rotate(${index % 2 === 0 ? 2 : -2}deg)` }}
            >
              <span className='h-1.5 w-1.5 rounded-full bg-[#0969da]' />
              <span className='truncate'>{draft.title}</span>
            </div>
          ))}
        </div>
      </div>
      <div className='flex items-center gap-1 text-xs font-medium text-[var(--fg-default)]'>
        임시저장함
        <span className='rounded-full border border-[var(--border-muted)] bg-[var(--canvas-subtle)] px-1.5 text-[10px] font-semibold text-[var(--fg-muted)]'>{count}</span>
      </div>
    </Link>
  );
}

function SidebarLink(props: {
  href?: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  locked?: boolean;
  badge?: string;
}) {
  const content = (
    <>
      <span className='si-left'>
        <props.icon className='icon icon-16' />
        {props.label}
      </span>
      <span className='si-right'>
        {props.locked ? (
        <span className='lock-pill'>
          <Lock className='icon icon-12' />
        </span>
      ) : props.badge ? (
        <span className={cn('sidebar-badge', props.badge === 'blue' && 'blue')}>{props.badge === 'blue' ? '3' : props.badge}</span>
      ) : null}
      </span>
    </>
  );

  const className = cn(
    'sidebar-item',
    props.active && 'active',
    props.locked && 'locked'
  );

  if (props.locked || !props.href) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Link href={props.href} className={className}>
      {content}
    </Link>
  );
}

export function V2Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  type NavItem = {
    href?: string;
    label: string;
    icon: LucideIcon;
    locked?: boolean;
    badge?: string;
  };

  const navSections: Array<{ title: string; items: NavItem[] }> = [
    {
      title: '대시보드',
      items: [{ href: '/v2', label: '개요', icon: LayoutDashboard }]
    },
    {
      title: '메시지 발송',
      items: [
        { href: canSendSms() ? '/v2/send/sms' : undefined, label: 'SMS 발송', icon: MessageSquare, locked: !canSendSms() },
        { href: canSendKakao() ? '/v2/send/kakao' : undefined, label: '알림톡 발송', icon: MessageCircle, locked: !canSendKakao() },
        { href: canSendCampaign() ? '/v2/campaigns' : undefined, label: '대량 발송', icon: Send, locked: !canSendCampaign() }
      ]
    },
    {
      title: '자동화',
      items: [
        { href: '/v2/events', label: '이벤트 규칙', icon: Zap, badge: 'blue' },
        { href: '/v2/templates', label: '템플릿 관리', icon: FileText }
      ]
    },
    {
      title: '운영',
      items: [
        { href: '/v2/resources', label: '발신 자원 관리', icon: KeyRound, badge: '2' },
        { href: '/v2/logs', label: '발송 로그', icon: BarChart3 },
        { href: '/v2/recipients', label: '수신자 관리', icon: Users }
      ]
    },
    {
      title: '설정',
      items: [{ href: '/v2/settings', label: '운영 설정', icon: Settings }]
    }
  ];

  return (
    <div className='v2-root min-h-screen bg-[var(--canvas-subtle)] text-[var(--fg-default)]'>
      <header className='topbar'>
        <div className='mx-auto flex h-full w-full max-w-[1280px] items-center gap-4'>
          <Link href='/v2' className='topbar-logo'>
            <div className='logo-sq'>MO</div>
            <span>MessageOps</span>
          </Link>
          <span className='topbar-sep'>/</span>
          <span className='topbar-title'>{workspaceName}</span>
          <div className='topbar-right'>
            <button className='topbar-btn'>
              <Bell className='icon icon-14' />
              공지 2
            </button>
            <div className='topbar-avatar'>
              김
            </div>
          </div>
        </div>
      </header>

      <div className='layout'>
        <aside className='sidebar hidden self-start lg:block'>
          <SetupBox />
          <nav className='space-y-3'>
            {navSections.map((section) => (
              <div key={section.title} className='sidebar-section'>
                <div className='sidebar-heading'>{section.title}</div>
                <div className='space-y-1'>
                  {section.items.map((item) => (
                    <SidebarLink
                      key={item.label}
                      href={item.href}
                      label={item.label}
                      icon={item.icon}
                      badge={item.badge}
                      locked={item.locked}
                      active={
                        item.href === '/v2'
                          ? pathname === '/v2'
                          : item.href
                            ? pathname === item.href || pathname.startsWith(`${item.href}/`)
                            : false
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <DraftInboxWidget />
        </aside>

        <main className='main'>
          <div className='mb-4 lg:hidden'>
            <SetupBox />
            <div className='flex gap-2 overflow-x-auto pb-2'>
              {navSections.flatMap((section) => section.items).map((item) => {
                const isActive =
                  item.href === '/v2'
                    ? pathname === '/v2'
                    : item.href
                      ? pathname === item.href || pathname.startsWith(`${item.href}/`)
                      : false;

                return item.locked || !item.href ? (
                  <div
                    key={item.label}
                    className='inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--canvas-default)] px-3 py-1.5 text-xs text-[var(--fg-subtle)]'
                  >
                    <item.icon className='h-3.5 w-3.5' />
                    {item.label}
                    <Lock className='h-3.5 w-3.5' />
                  </div>
                ) : (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium',
                      isActive ? 'border-[rgba(9,105,218,0.15)] bg-[var(--accent-subtle)] text-[var(--accent-fg)]' : 'border-[var(--border-default)] bg-[var(--canvas-default)] text-[var(--fg-default)]'
                    )}
                  >
                    <item.icon className='h-3.5 w-3.5' />
                    {item.label}
                  </Link>
                );
              })}
              <Link
                href='/v2/drafts'
                className={cn(
                  'inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium',
                  pathname === '/v2/drafts' ? 'border-[rgba(9,105,218,0.15)] bg-[var(--accent-subtle)] text-[var(--accent-fg)]' : 'border-[var(--border-default)] bg-[var(--canvas-default)] text-[var(--fg-default)]'
                )}
              >
                <Inbox className='h-3.5 w-3.5' />
                임시저장함
              </Link>
            </div>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
