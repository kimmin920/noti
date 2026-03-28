'use client';

import { useState } from 'react';
import { History, MessageCircle, Users } from 'lucide-react';
import {
  V2ChecklistPanel,
  V2Field,
  V2KakaoPreview,
  V2OptionCard,
  V2RightRail
} from '@/components/v2/patterns';
import { V2Box, V2Button, V2Flash, V2Input, V2LinkButton, V2PageHeader, V2Select, V2Textarea } from '@/components/v2/ui';

const kakaoTemplateOptions = {
  order_complete: {
    label: '주문 완료 알림',
    code: 'order_complete',
    body: '#{name}님, 주문이 완료되었습니다.\n주문번호: #{orderNo}\n주문 상세를 확인해 주세요.',
    variables: ['name', 'orderNo'],
    buttons: ['주문 상세 보기']
  },
  delivery_start: {
    label: '배송 시작 알림',
    code: 'delivery_start',
    body: '#{name}님의 주문이 배송을 시작했습니다.\n송장번호: #{trackingNo}',
    variables: ['name', 'trackingNo'],
    buttons: ['배송 조회']
  },
  delivery_done: {
    label: '배송 완료 알림',
    code: 'delivery_done',
    body: '#{name}님의 상품이 배송 완료되었습니다.\n문 앞에 안전하게 두었습니다.',
    variables: ['name'],
    buttons: ['리뷰 작성']
  },
  payment_done: {
    label: '결제 완료',
    code: 'payment_done',
    body: '#{name}님, 결제가 완료되었습니다.\n결제 금액: #{amount}',
    variables: ['name', 'amount'],
    buttons: ['결제 내역 보기']
  }
} as const;

type KakaoTemplateKey = keyof typeof kakaoTemplateOptions;

function renderTemplateBody(templateKey: KakaoTemplateKey | '', variables: Record<string, string>) {
  if (!templateKey) {
    return '';
  }

  const template = kakaoTemplateOptions[templateKey];
  return template.body.replace(/#\{(\w+)\}/g, (_, key: string) => variables[key] || `#{${key}}`);
}

export default function V2SendKakaoPage() {
  const [channel] = useState('@acme-brand');
  const [templateKey, setTemplateKey] = useState<KakaoTemplateKey | ''>('');
  const [recipient, setRecipient] = useState('');
  const [fallbackEnabled, setFallbackEnabled] = useState(false);
  const [fallbackBody, setFallbackBody] = useState('');
  const [scheduleType, setScheduleType] = useState<'now' | 'later'>('now');
  const [variables, setVariables] = useState<Record<string, string>>({
    name: '김민우',
    orderNo: 'A-120034',
    trackingNo: '5120-1290-1234',
    amount: '32,000원'
  });

  const activeTemplate = templateKey ? kakaoTemplateOptions[templateKey] : null;
  const previewBody = renderTemplateBody(templateKey, variables);

  return (
    <div>
      <V2PageHeader
        title='알림톡 발송'
        description='카카오 비즈메시지를 단건으로 발송합니다.'
        actions={<V2LinkButton href='/v2/logs' icon={History}>발송 이력</V2LinkButton>}
      />

      <div className='grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]'>
        <div className='space-y-4'>
          <V2Box title='채널 및 템플릿'>
            <div className='space-y-4'>
              <V2Field label='발신 채널' required>
                <V2Select className='max-w-[280px]' defaultValue={channel}>
                  <option value={channel}>{channel} (브랜드 채널)</option>
                </V2Select>
              </V2Field>

              <V2Field
                label='템플릿 선택'
                required
                hint={<span>승인된 템플릿만 발송에 사용할 수 있습니다. <Linkish href='/v2/templates'>템플릿 관리</Linkish></span>}
              >
                <V2Select value={templateKey} onChange={(event) => setTemplateKey(event.target.value as KakaoTemplateKey | '')}>
                  <option value=''>템플릿을 선택하세요</option>
                  {Object.entries(kakaoTemplateOptions).map(([key, template]) => (
                    <option key={key} value={key}>
                      {template.label}
                    </option>
                  ))}
                </V2Select>
              </V2Field>
            </div>
          </V2Box>

          <V2Box title='수신자'>
            <V2Field label='수신 전화번호' required>
              <div className='flex flex-col gap-2 sm:flex-row'>
                <V2Input
                  value={recipient}
                  onChange={(event) => setRecipient(event.target.value)}
                  placeholder='010-0000-0000'
                  className='max-w-[220px]'
                />
                <V2Button icon={Users}>수신자 선택</V2Button>
              </div>
            </V2Field>
          </V2Box>

          <V2Box
            title='변수 입력'
            subtitle='템플릿의 #{변수}를 실제 값으로 치환합니다'
          >
            {activeTemplate ? (
              <div className='grid gap-4 md:grid-cols-2'>
                {activeTemplate.variables.map((variableKey) => (
                  <V2Field key={variableKey} label={variableKey}>
                    <V2Input
                      value={variables[variableKey] ?? ''}
                      onChange={(event) => setVariables((current) => ({ ...current, [variableKey]: event.target.value }))}
                    />
                  </V2Field>
                ))}
              </div>
            ) : (
              <div className='py-6 text-center text-sm text-[#636c76]'>템플릿을 선택하면 변수 입력란이 표시됩니다.</div>
            )}
          </V2Box>

          {activeTemplate ? (
            <V2Box title='버튼 설정' subtitle='템플릿에 포함된 버튼'>
              <div className='grid gap-3 md:grid-cols-2'>
                {activeTemplate.buttons.map((buttonLabel) => (
                  <div key={buttonLabel} className='rounded-md border border-[#d8dee4] px-4 py-3'>
                    <div className='text-sm font-medium text-[#1f2328]'>{buttonLabel}</div>
                    <div className='mt-1 text-xs text-[#636c76]'>실제 동작 URL은 템플릿 승인 정보와 함께 관리됩니다.</div>
                  </div>
                ))}
              </div>
            </V2Box>
          ) : null}

          <V2Box
            title='SMS Fallback'
            actions={
              <label className='flex items-center gap-2 text-sm text-[#1f2328]'>
                <input
                  type='checkbox'
                  checked={fallbackEnabled}
                  onChange={(event) => setFallbackEnabled(event.target.checked)}
                  className='accent-[#0969da]'
                />
                알림톡 실패 시 SMS로 대체 발송
              </label>
            }
          >
            {fallbackEnabled ? (
              <div className='space-y-4'>
                <V2Flash tone='info'>
                  알림톡 발송 실패 시 아래 SMS 내용으로 자동 대체 발송됩니다.
                </V2Flash>
                <V2Field label='SMS 대체 문자'>
                  <V2Textarea
                    value={fallbackBody}
                    onChange={(event) => setFallbackBody(event.target.value)}
                    placeholder='SMS Fallback 문자 내용'
                    className='min-h-[90px]'
                  />
                </V2Field>
              </div>
            ) : (
              <div className='text-sm text-[#636c76]'>필요할 때만 켜서 사용하세요. 대체 문자까지 함께 검토하면 발송 실패 상황을 더 안정적으로 대응할 수 있습니다.</div>
            )}
          </V2Box>

          <V2Box title='발송 시간'>
            <div className='grid gap-2 sm:grid-cols-2'>
              <label className='flex items-center gap-2 rounded-md border border-[#d0d7de] px-4 py-3 text-sm text-[#1f2328]'>
                <input
                  type='radio'
                  name='kakao-schedule'
                  checked={scheduleType === 'now'}
                  onChange={() => setScheduleType('now')}
                  className='accent-[#0969da]'
                />
                즉시 발송
              </label>
              <label className='flex items-center gap-2 rounded-md border border-[#d0d7de] px-4 py-3 text-sm text-[#1f2328]'>
                <input
                  type='radio'
                  name='kakao-schedule'
                  checked={scheduleType === 'later'}
                  onChange={() => setScheduleType('later')}
                  className='accent-[#0969da]'
                />
                예약 발송
              </label>
            </div>
          </V2Box>

          <div className='flex justify-end gap-2 pb-6'>
            <V2Button>임시 저장</V2Button>
            <V2Button variant='kakao' icon={MessageCircle} disabled={!templateKey || !recipient.trim()}>
              발송하기
            </V2Button>
          </div>
        </div>

        <V2RightRail>
          <V2KakaoPreview
            body={previewBody}
            channelName={channel}
            templateCode={activeTemplate?.code}
          />
          <V2ChecklistPanel
            items={[
              { label: '채널', state: 'done', value: '설정됨' },
              { label: '템플릿', state: templateKey ? 'done' : 'pending', value: templateKey ? '선택됨' : '미선택' },
              { label: '수신번호', state: recipient.trim() ? 'done' : 'pending', value: recipient.trim() ? '입력됨' : '미입력' },
              { label: 'Fallback', state: fallbackEnabled ? 'done' : 'optional', value: fallbackEnabled ? '사용' : '사용 안 함' }
            ]}
          />
          <V2Box title='템플릿 선택 가이드'>
            <div className='space-y-3 text-sm text-[#636c76]'>
              <p>알림톡은 승인된 템플릿만 발송할 수 있습니다. 버튼 유형과 변수 키는 템플릿 승인 내용과 동일해야 합니다.</p>
              <div className='grid gap-2'>
                <V2OptionCard
                  icon={MessageCircle}
                  title='알림톡 우선'
                  description='고객 접점 메시지는 알림톡으로 먼저 보내고 필요한 경우만 SMS Fallback을 사용합니다.'
                  selected
                  tone='kakao'
                />
              </div>
            </div>
          </V2Box>
        </V2RightRail>
      </div>
    </div>
  );
}

function Linkish(props: { href: string; children: React.ReactNode }) {
  return (
    <a href={props.href} className='text-[#0969da] underline underline-offset-2'>
      {props.children}
    </a>
  );
}
