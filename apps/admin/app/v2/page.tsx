'use client';

import Link from 'next/link';
import {
  Bell,
  CircleCheckBig,
  KeyRound,
  MessageCircle,
  MessageSquare,
  TriangleAlert,
  Zap
} from 'lucide-react';
import { notices, setupItems } from '@/components/v2/data';
import {
  V2Box,
  V2Button,
  V2Flash,
  V2Label,
  V2LinkButton,
  V2PageHeader,
  V2Progress,
  V2StatGrid
} from '@/components/v2/ui';

function ChecklistBadge() {
  const completed = setupItems.filter((item) => item.status === 'active').length;
  return <span className='rounded-full border border-[#f5d76e] bg-[#fff8c5] px-2 py-0.5 text-xs font-semibold text-[#9a6700]'>{completed} / 2 완료</span>;
}

function ChecklistItem(props: {
  title: string;
  description: string;
  status: 'done' | 'active' | 'todo';
  action?: React.ReactNode;
}) {
  return (
    <div className={props.status === 'todo' ? 'flex gap-3 border-t border-[#eaeef2] px-4 py-4 opacity-45' : 'flex gap-3 border-t border-[#eaeef2] px-4 py-4'}>
      <div
        className={
          props.status === 'done'
            ? 'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1f883d] text-white'
            : props.status === 'active'
              ? 'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-[#bf8700] bg-[#fff8c5] text-[#9a6700]'
              : 'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-[#d0d7de] bg-white text-[#818f9a]'
        }
      >
        {props.status === 'done' ? <CircleCheckBig className='h-3.5 w-3.5' /> : <span className='text-[10px] font-semibold'>{props.status === 'active' ? '!' : ''}</span>}
      </div>
      <div className='min-w-0 flex-1'>
        <div className='flex flex-wrap items-center gap-2'>
          <div className='text-sm font-semibold text-[#1f2328]'>{props.title}</div>
          {props.status === 'done' ? <V2Label tone='green'>완료</V2Label> : props.status === 'active' ? <V2Label tone='yellow'>확인 필요</V2Label> : null}
        </div>
        <p className='mt-1 text-sm leading-6 text-[#636c76]'>{props.description}</p>
        {props.action ? <div className='mt-3'>{props.action}</div> : null}
      </div>
    </div>
  );
}

function QuickActionCard(props: { title: string; description: string; href: string; icon: React.ComponentType<{ className?: string }>; cta: string }) {
  const Icon = props.icon;
  return (
    <div className='flex flex-col items-center justify-center border-r border-[#eaeef2] px-5 py-7 text-center last:border-r-0'>
      <Icon className='mb-3 h-6 w-6 text-[#0969da]' />
      <div className='text-sm font-medium text-[#1f2328]'>{props.title}</div>
      <div className='mt-1 text-xs text-[#636c76]'>{props.description}</div>
      <Link href={props.href} className='mt-3 inline-flex rounded-md bg-[#0969da] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0860ca]'>
        {props.cta}
      </Link>
    </div>
  );
}

export default function V2DashboardPage() {
  return (
    <div>
      <V2PageHeader title='대시보드' description='ACME Corp 워크스페이스 운영 현황' />

      <V2Flash
        tone='success'
        icon={CircleCheckBig}
        title='모든 발송 채널이 활성화되어 있습니다.'
        actions={<V2LinkButton href='/v2/resources' size='sm'>자원 관리</V2LinkButton>}
      >
        SMS와 알림톡 발송이 가능합니다.
      </V2Flash>

      <V2StatGrid
        className='mb-4'
        items={[
          { label: '오늘 발송 요청', value: '24', sublabel: '정상 처리' },
          { label: '이번 달 SMS', value: '1,280', sublabel: '한도 50,000건' },
          { label: '이번 달 알림톡', value: '864', sublabel: '한도 30,000건' },
          { label: '이벤트 규칙', value: '3', sublabel: '활성 중', accent: '#0969da' }
        ]}
      />

      <div className='mb-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]'>
        <V2Box
          title='시작하기'
          subtitle='아래 단계를 완료하면 각 메시지 발송이 활성화됩니다'
          actions={<ChecklistBadge />}
          className='overflow-hidden'
          bodyClassName='px-0 py-0'
        >
          <ChecklistItem
            title='SMS 발신번호 등록'
            description='문자 발송에 사용할 번호 등록이 완료되었습니다.'
            status='done'
            action={<V2LinkButton href='/v2/send/sms' size='sm' icon={MessageSquare}>SMS 발송하기</V2LinkButton>}
          />
          <ChecklistItem
            title='카카오채널 연결'
            description='알림톡 발송에 사용할 카카오 비즈니스 채널이 연결되었습니다.'
            status='done'
            action={<V2LinkButton href='/v2/templates' size='sm' icon={MessageCircle}>알림톡 템플릿 보기</V2LinkButton>}
          />
          <ChecklistItem
            title='템플릿 작성'
            description='SMS 및 알림톡 템플릿을 작성하고 발행합니다.'
            status='done'
            action={<V2LinkButton href='/v2/templates' size='sm'>템플릿 관리</V2LinkButton>}
          />
          <ChecklistItem
            title='이벤트 규칙 설정'
            description='외부 이벤트와 발송 채널을 연결하는 규칙을 관리합니다.'
            status='done'
            action={<V2LinkButton href='/v2/events' size='sm' icon={Zap}>규칙 관리</V2LinkButton>}
          />
        </V2Box>

        <div className='space-y-4'>
          <V2Box title='채널 상태' bodyClassName='px-0 py-0'>
            {[
              { label: '메시지 큐', tone: 'green' as const, value: '정상' },
              { label: 'SMS 발신번호', tone: 'green' as const, value: '활성' },
              { label: '카카오채널', tone: 'green' as const, value: '활성' }
            ].map((item, index) => (
              <div key={item.label} className={index === 2 ? 'flex items-center justify-between px-4 py-3' : 'flex items-center justify-between border-b border-[#eaeef2] px-4 py-3'}>
                <span className='text-sm text-[#1f2328]'>{item.label}</span>
                <span className='inline-flex items-center gap-2 text-xs font-medium text-[#1a7f37]'>
                  <span className='h-2 w-2 rounded-full bg-[#1f883d] shadow-[0_0_0_3px_rgba(31,136,61,0.15)]' />
                  {item.value}
                </span>
              </div>
            ))}
          </V2Box>

          <V2Box
            title='공지사항'
            actions={<V2Button size='sm'>전체 보기</V2Button>}
          >
            <div className='space-y-3'>
              {notices.map((notice) => (
                <div key={notice.title} className='flex gap-3 border-b border-[#eaeef2] pb-3 last:border-b-0 last:pb-0'>
                  <span className={notice.type === 'notice' ? 'inline-flex h-5 items-center rounded-full border border-[#f5d76e] bg-[#fff8c5] px-2 text-[10px] font-semibold text-[#9a6700]' : 'inline-flex h-5 items-center rounded-full border border-[rgba(31,136,61,0.2)] bg-[#dafbe1] px-2 text-[10px] font-semibold text-[#1a7f37]'}>
                    {notice.type.toUpperCase()}
                  </span>
                  <div>
                    <div className='text-sm text-[#1f2328]'>{notice.title}</div>
                    <div className='mt-1 text-xs text-[#818f9a]'>{notice.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </V2Box>
        </div>
      </div>

      <V2Box title='빠른 실행' className='mb-4' bodyClassName='p-0'>
        <div className='grid grid-cols-1 divide-y divide-[#eaeef2] md:grid-cols-3 md:divide-x md:divide-y-0'>
          <QuickActionCard title='SMS 발송' description='단건 전송 · MMS 지원' href='/v2/send/sms' icon={MessageSquare} cta='발송 열기' />
          <QuickActionCard title='알림톡 발송' description='카카오 비즈메시지' href='/v2/send/kakao' icon={MessageCircle} cta='발송 열기' />
          <QuickActionCard title='이벤트 규칙' description='자동 발송 설정' href='/v2/events' icon={Zap} cta='규칙 관리' />
        </div>
      </V2Box>

      <V2Box
        title='월간 쿼터 현황'
        actions={<span className='text-xs text-[#636c76]'>리셋: 2026-04-01</span>}
      >
        <div className='space-y-4'>
          <div>
            <div className='mb-1.5 flex items-center gap-2 text-sm font-medium text-[#1f2328]'>
              <MessageSquare className='h-4 w-4 text-[#0969da]' />
              SMS 발송
              <span className='ml-auto font-mono text-xs text-[#636c76]'>1,280 / 50,000 건</span>
            </div>
            <V2Progress value={2.56} />
          </div>
          <div>
            <div className='mb-1.5 flex items-center gap-2 text-sm font-medium text-[#1f2328]'>
              <MessageCircle className='h-4 w-4 text-[#9a6700]' />
              알림톡 발송
              <span className='ml-auto font-mono text-xs text-[#636c76]'>864 / 30,000 건</span>
            </div>
            <V2Progress value={2.88} tone='kakao' />
          </div>
          <div>
            <div className='mb-1.5 flex items-center gap-2 text-sm font-medium text-[#1f2328]'>
              <Zap className='h-4 w-4 text-[#1a7f37]' />
              이벤트 처리
              <span className='ml-auto font-mono text-xs text-[#636c76]'>208 / 100,000 건</span>
            </div>
            <V2Progress value={0.21} tone='green' />
          </div>
        </div>
      </V2Box>
    </div>
  );
}
