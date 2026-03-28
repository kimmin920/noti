'use client';

import { Activity, LucideIcon, Shield, Webhook, Zap } from 'lucide-react';
import { eventRules } from '@/components/v2/data';
import { V2Box, V2Button, V2Chip, V2Label, V2PageHeader } from '@/components/v2/ui';

function SummaryCard(props: { icon: LucideIcon; label: string; title: string; subtitle: string; color: string }) {
  const Icon = props.icon;
  return (
    <V2Box className='mb-0'>
      <div className='mb-1 flex items-center gap-2 text-xs text-[#636c76]'>
        <Icon className='h-4 w-4' style={{ color: props.color }} />
        {props.label}
      </div>
      <div className='text-sm font-semibold text-[#1f2328]'>{props.title}</div>
      <div className='mt-2 text-xs text-[#636c76]'>{props.subtitle}</div>
    </V2Box>
  );
}

export default function V2EventsPage() {
  return (
    <div>
      <V2PageHeader
        title='이벤트 규칙'
        description='외부 이벤트에 따라 자동으로 메시지를 발송하는 규칙을 관리합니다'
        actions={<V2Button variant='accent' icon={Zap}>규칙 만들기</V2Button>}
      />

      <div className='mb-4 grid gap-4 md:grid-cols-3'>
        <SummaryCard icon={Shield} label='Idempotency' title='중복 발송 방지 활성' subtitle='동일 key 재요청 시 무시됩니다' color='#0969da' />
        <SummaryCard icon={Activity} label='Queue' title='비동기 처리' subtitle='이벤트 수신 후 큐에서 순차 처리' color='#1f883d' />
        <SummaryCard icon={Webhook} label='Webhook' title='결과 콜백 지원' subtitle='발송 결과를 외부 URL로 전송' color='#8250df' />
      </div>

      <V2Box title='활성 이벤트 규칙'>
        <div className='overflow-x-auto'>
          <table className='w-full border-collapse text-left'>
            <thead>
              <tr className='bg-[#f6f8fa]'>
                {['이벤트 키', '전략', '채널 순서', '연결 템플릿', '상태', '처리 건수', ''].map((head) => (
                  <th key={head} className='whitespace-nowrap border-b border-[#d0d7de] px-3 py-2 text-xs font-semibold text-[#636c76]'>
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {eventRules.map((rule) => (
                <tr key={rule.key} className='border-b border-[#eaeef2] last:border-b-0'>
                  <td className='px-3 py-3 font-mono text-xs text-[#1f2328]'>{rule.key}</td>
                  <td className='px-3 py-3 text-sm text-[#636c76]'>{rule.strategy}</td>
                  <td className='px-3 py-3 text-sm'>
                    <div className='flex flex-wrap items-center gap-2'>
                      {rule.channels.map((channel, index) => (
                        <span key={`${rule.key}-${channel}-${index}`} className='inline-flex items-center gap-2'>
                          <V2Chip tone={channel.includes('알림톡') ? 'kakao' : 'sms'}>{channel}</V2Chip>
                          {index < rule.channels.length - 1 ? <span className='text-[#818f9a]'>→</span> : null}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className='px-3 py-3 font-mono text-xs text-[#636c76]'>{rule.template}</td>
                  <td className='px-3 py-3 text-sm'><V2Label tone={rule.status === '활성' ? 'green' : 'yellow'}>{rule.status}</V2Label></td>
                  <td className='px-3 py-3 font-mono text-xs text-[#636c76]'>{rule.processed}</td>
                  <td className='px-3 py-3'><V2Button size='sm'>편집</V2Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </V2Box>
    </div>
  );
}
