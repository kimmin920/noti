'use client';

import { useState } from 'react';
import { MessageCircle, MessageSquare, Upload, Users } from 'lucide-react';
import {
  V2CharacterCounter,
  V2Field,
  V2InfoList,
  V2MessageSummaryCard,
  V2OptionCard,
  V2ReviewNotice,
  V2StepIndicator
} from '@/components/v2/patterns';
import { V2Box, V2Button, V2PageHeader, V2Select, V2Tabs, V2Textarea, V2Input, V2Chip } from '@/components/v2/ui';

export default function V2CampaignNewPage() {
  const [step, setStep] = useState(1);
  const [channel, setChannel] = useState<'sms' | 'kakao'>('sms');
  const [campaignName, setCampaignName] = useState('7월 프로모션 안내');
  const [scheduleType, setScheduleType] = useState<'now' | 'later'>('now');
  const [recipientMode, setRecipientMode] = useState<'upload' | 'segment' | 'manual'>('upload');
  const [messageBody, setMessageBody] = useState('#{name}님, 안녕하세요. ACME Corp입니다.');

  const byteLength = new TextEncoder().encode(messageBody).length;

  return (
    <div>
      <V2PageHeader title='캠페인 만들기' description='대량 메시지 발송 캠페인을 설정합니다.' />

      <V2StepIndicator
        activeStep={step}
        className='mb-4'
        steps={['기본 설정', '수신자 설정', '메시지 작성', '검토 및 발송']}
      />

      {step === 1 ? (
        <>
          <V2Box title='기본 정보'>
            <div className='space-y-5'>
              <V2Field label='캠페인명' required hint='내부 관리용 이름으로, 수신자에게 노출되지 않습니다.'>
                <V2Input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} className='max-w-[400px]' />
              </V2Field>

              <V2Field label='발송 채널' required>
                <div className='grid max-w-[420px] gap-3 sm:grid-cols-2'>
                  <V2OptionCard
                    icon={MessageSquare}
                    title='SMS'
                    description='문자 메시지'
                    selected={channel === 'sms'}
                    onClick={() => setChannel('sms')}
                  />
                  <V2OptionCard
                    icon={MessageCircle}
                    title='알림톡'
                    description='카카오 비즈메시지'
                    tone='kakao'
                    selected={channel === 'kakao'}
                    onClick={() => setChannel('kakao')}
                  />
                </div>
              </V2Field>

              <V2Field label='발송 시간' required>
                <div className='grid max-w-[420px] gap-2 sm:grid-cols-2'>
                  <label className='flex items-center gap-2 rounded-md border border-[#d0d7de] px-4 py-3 text-sm text-[#1f2328]'>
                    <input
                      type='radio'
                      checked={scheduleType === 'now'}
                      onChange={() => setScheduleType('now')}
                      className='accent-[#0969da]'
                    />
                    즉시 발송
                  </label>
                  <label className='flex items-center gap-2 rounded-md border border-[#d0d7de] px-4 py-3 text-sm text-[#1f2328]'>
                    <input
                      type='radio'
                      checked={scheduleType === 'later'}
                      onChange={() => setScheduleType('later')}
                      className='accent-[#0969da]'
                    />
                    예약 발송
                  </label>
                </div>
              </V2Field>
            </div>
          </V2Box>

          <div className='flex justify-end gap-2'>
            <V2Button>취소</V2Button>
            <V2Button variant='accent' onClick={() => setStep(2)}>다음 단계</V2Button>
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <V2Box title='수신자 설정'>
            <V2Field label='수신자 추가 방법'>
              <V2Tabs
                tabs={[
                  { key: 'upload', label: 'CSV 업로드' },
                  { key: 'segment', label: '세그먼트 선택' },
                  { key: 'manual', label: '직접 입력' }
                ]}
                active={recipientMode}
                onChange={(value) => setRecipientMode(value as 'upload' | 'segment' | 'manual')}
                className='mb-0'
              />
            </V2Field>

            {recipientMode === 'upload' ? (
              <div className='rounded-md border-2 border-dashed border-[#d8dee4] bg-[#f6f8fa] px-6 py-10 text-center'>
                <Upload className='mx-auto mb-3 h-6 w-6 text-[#818f9a]' />
                <div className='text-sm font-medium text-[#1f2328]'>CSV 파일을 끌어다 놓거나 클릭하여 업로드</div>
                <div className='mt-2 text-xs text-[#636c76]'>필수 컬럼: phone / 선택 컬럼: name, custom_1, custom_2</div>
                <div className='mt-4'>
                  <V2Button size='sm'>템플릿 다운로드</V2Button>
                </div>
              </div>
            ) : null}

            {recipientMode === 'segment' ? (
              <div className='rounded-md border border-[#d8dee4] px-6 py-10 text-center'>
                <Users className='mx-auto mb-3 h-8 w-8 text-[#d0d7de]' />
                <div className='text-base font-semibold text-[#1f2328]'>저장된 세그먼트가 없습니다</div>
                <div className='mt-2 text-sm text-[#636c76]'>수신자 관리에서 세그먼트를 먼저 생성해 주세요.</div>
                <div className='mt-4'>
                  <V2Button>수신자 관리</V2Button>
                </div>
              </div>
            ) : null}

            {recipientMode === 'manual' ? (
              <div>
                <V2Textarea
                  placeholder={'수신번호를 한 줄에 하나씩 입력하세요\n010-1234-5678\n010-9876-5432'}
                  className='min-h-[140px] font-mono text-xs'
                />
                <p className='mt-2 text-xs text-[#636c76]'>최대 10,000건까지 직접 입력 가능합니다.</p>
              </div>
            ) : null}
          </V2Box>

          <div className='flex justify-end gap-2'>
            <V2Button onClick={() => setStep(1)}>이전</V2Button>
            <V2Button variant='accent' onClick={() => setStep(3)}>다음 단계</V2Button>
          </div>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <V2Box title='메시지 작성'>
            <div className='space-y-4'>
              <V2Field label='템플릿 불러오기'>
                <div className='flex flex-col gap-2 sm:flex-row'>
                  <V2Select className='max-w-[320px]'>
                    <option value=''>직접 작성</option>
                    <option>회원가입 인증번호</option>
                    <option>배송 출발 알림</option>
                  </V2Select>
                  <V2Button>불러오기</V2Button>
                </div>
              </V2Field>

              <V2Field label='본문' required>
                <V2Textarea
                  value={messageBody}
                  onChange={(event) => setMessageBody(event.target.value)}
                  className='min-h-[140px]'
                />
              </V2Field>

              <V2CharacterCounter
                type={channel === 'sms' ? 'SMS' : '알림톡'}
                reason='#{name} 등 변수는 수신자별로 자동 치환됩니다.'
                countText={`${byteLength} / 90 byte`}
              />
            </div>
          </V2Box>

          <div className='flex justify-end gap-2'>
            <V2Button onClick={() => setStep(2)}>이전</V2Button>
            <V2Button variant='accent' onClick={() => setStep(4)}>다음 단계</V2Button>
          </div>
        </>
      ) : null}

      {step === 4 ? (
        <>
          <V2ReviewNotice />
          <div className='grid gap-4 lg:grid-cols-2'>
            <V2Box title='발송 요약'>
              <V2InfoList
                items={[
                  { label: '캠페인명', value: campaignName },
                  { label: '채널', value: <V2Chip tone={channel === 'sms' ? 'sms' : 'kakao'}>{channel === 'sms' ? 'SMS' : '알림톡'}</V2Chip> },
                  { label: '수신자', value: recipientMode === 'upload' ? '파일 업로드 필요' : recipientMode === 'segment' ? '세그먼트 미선택' : '직접 입력 사용' },
                  { label: '발송 시간', value: scheduleType === 'now' ? '즉시 발송' : '예약 발송' }
                ]}
              />
            </V2Box>

            <V2MessageSummaryCard
              title='메시지 미리보기'
              body={messageBody}
              footer={<div className='text-xs text-[#636c76]'>수신자별 변수 치환 전 원문입니다.</div>}
            />
          </div>

          <div className='mt-4 flex justify-end gap-2'>
            <V2Button onClick={() => setStep(3)}>이전</V2Button>
            <V2Button variant='success'>캠페인 발송</V2Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
