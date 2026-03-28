'use client';

import { useState } from 'react';
import { CalendarClock, History, ImagePlus, ListChecks, MessageSquare, Users, X } from 'lucide-react';
import {
  V2CharacterCounter,
  V2ChecklistPanel,
  V2Field,
  V2RightRail,
  V2SmsPreview
} from '@/components/v2/patterns';
import { V2Box, V2Button, V2Input, V2LinkButton, V2PageHeader, V2Select, V2Textarea } from '@/components/v2/ui';

function getSmsByteLength(value: string) {
  return new TextEncoder().encode(value).length;
}

export default function V2SendSmsPage() {
  const [sender] = useState('010-1234-5678');
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [scheduleType, setScheduleType] = useState<'now' | 'later'>('now');
  const [scheduledAt, setScheduledAt] = useState('2026-03-24T09:00');
  const [attachments, setAttachments] = useState<string[]>([]);

  const byteLength = getSmsByteLength(body);
  const messageType = attachments.length > 0 ? 'MMS' : byteLength <= 90 ? 'SMS' : 'LMS';
  const messageReason =
    attachments.length > 0 ? '이미지가 첨부되어 MMS로 전환됩니다' : byteLength <= 90 ? '90 byte 이하 · 이미지 없음' : '90 byte 초과로 LMS로 전환됩니다';

  function addSampleAttachment() {
    if (attachments.length >= 3) {
      return;
    }

    setAttachments((current) => [...current, `sample-image-${current.length + 1}.png`]);
  }

  function removeAttachment(name: string) {
    setAttachments((current) => current.filter((item) => item !== name));
  }

  return (
    <div>
      <V2PageHeader
        title='SMS 발송'
        description='문자 메시지를 단건으로 발송합니다. 내용과 첨부 여부에 따라 SMS, LMS, MMS가 자동으로 결정됩니다.'
        actions={<V2LinkButton href='/v2/logs' icon={History}>발송 이력</V2LinkButton>}
      />

      <div className='grid gap-5 xl:grid-cols-[minmax(0,1fr)_308px]'>
        <div className='space-y-4'>
          <V2Box title='발신 정보'>
            <div className='space-y-4'>
              <V2Field label='발신번호' required hint='발신 자원 관리에서 등록한 번호만 사용할 수 있습니다.'>
                <V2Select className='max-w-[280px]' defaultValue={sender}>
                  <option value={sender}>{sender} (기본)</option>
                </V2Select>
              </V2Field>

              <V2Field label='수신번호' required hint='하이픈 포함 또는 미포함 모두 입력 가능합니다.'>
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
            </div>
          </V2Box>

          <V2Box
            title='메시지 내용'
            actions={<V2Button size='sm'>템플릿 불러오기</V2Button>}
          >
            <div className='space-y-4'>
              {messageType !== 'SMS' ? (
                <V2Field label='제목' hint='LMS 또는 MMS 전환 시 제목이 함께 전송됩니다.'>
                  <V2Input
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder='메시지 제목 (선택)'
                  />
                </V2Field>
              ) : null}

              <V2Field label='본문' required>
                <V2Textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder={'메시지 내용을 입력하세요.\n#{변수명} 형식으로 수신자별 값을 치환할 수 있습니다.'}
                  className='min-h-[140px]'
                />
              </V2Field>

              <V2CharacterCounter
                type={messageType}
                reason={messageReason}
                countText={`${byteLength} / 90 byte`}
              />

              <div className='border-t border-[#eaeef2] pt-4'>
                <div className='mb-3 flex items-center justify-between gap-3'>
                  <div>
                    <div className='flex items-center gap-2 text-sm font-semibold text-[#1f2328]'>
                      <ImagePlus className='h-4 w-4 text-[#636c76]' />
                      이미지 첨부
                    </div>
                    <p className='mt-1 text-xs text-[#636c76]'>선택 사항이며 최대 3개까지 첨부할 수 있습니다. 이미지가 있으면 MMS로 전환됩니다.</p>
                  </div>
                  <div className='font-mono text-xs text-[#636c76]'>{attachments.length} / 3</div>
                </div>

                {attachments.length > 0 ? (
                  <div className='mb-3 grid gap-2 sm:grid-cols-3'>
                    {attachments.map((attachment) => (
                      <div key={attachment} className='rounded-md border border-[#d8dee4] bg-[#f6f8fa] px-3 py-2'>
                        <div className='flex items-start justify-between gap-2'>
                          <div className='min-w-0'>
                            <div className='truncate text-xs font-medium text-[#1f2328]'>{attachment}</div>
                            <div className='mt-1 text-[11px] text-[#636c76]'>샘플 첨부 파일</div>
                          </div>
                          <button
                            type='button'
                            onClick={() => removeAttachment(attachment)}
                            className='rounded p-1 text-[#818f9a] transition hover:bg-white hover:text-[#1f2328]'
                            aria-label={`${attachment} 제거`}
                          >
                            <X className='h-3.5 w-3.5' />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                <V2Button onClick={addSampleAttachment} disabled={attachments.length >= 3} icon={ImagePlus}>
                  이미지 추가
                </V2Button>
              </div>
            </div>
          </V2Box>

          <V2Box title='발송 시간'>
            <div className='space-y-3'>
              <div className='grid gap-2 sm:grid-cols-2'>
                <label className='flex items-center gap-2 rounded-md border border-[#d0d7de] px-4 py-3 text-sm text-[#1f2328]'>
                  <input
                    type='radio'
                    name='scheduleType'
                    checked={scheduleType === 'now'}
                    onChange={() => setScheduleType('now')}
                    className='accent-[#0969da]'
                  />
                  즉시 발송
                </label>
                <label className='flex items-center gap-2 rounded-md border border-[#d0d7de] px-4 py-3 text-sm text-[#1f2328]'>
                  <input
                    type='radio'
                    name='scheduleType'
                    checked={scheduleType === 'later'}
                    onChange={() => setScheduleType('later')}
                    className='accent-[#0969da]'
                  />
                  예약 발송
                </label>
              </div>

              {scheduleType === 'later' ? (
                <V2Field label='예약 일시' hint='야간 발송 제한 정책에 맞는 시간만 선택해 주세요.'>
                  <V2Input type='datetime-local' value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className='max-w-[280px]' />
                </V2Field>
              ) : null}
            </div>
          </V2Box>

          <div className='flex justify-end gap-2 pb-6'>
            <V2Button>임시 저장</V2Button>
            <V2Button variant='accent' icon={MessageSquare} disabled={!recipient.trim() || !body.trim()}>
              발송하기
            </V2Button>
          </div>
        </div>

        <V2RightRail>
          <V2SmsPreview
            sender={sender}
            subject={subject}
            body={body}
            attachments={attachments}
            messageType={messageType}
          />

          <V2ChecklistPanel
            items={[
              { label: '발신번호', state: 'done', value: '설정됨' },
              { label: '수신번호', state: recipient.trim() ? 'done' : 'pending', value: recipient.trim() ? '입력됨' : '미입력' },
              { label: '본문', state: body.trim() ? 'done' : 'pending', value: body.trim() ? '입력됨' : '미입력' },
              { label: '이미지', state: attachments.length > 0 ? 'done' : 'optional', value: attachments.length > 0 ? `${attachments.length}개 첨부` : '없음 (선택)' }
            ]}
          />

          <V2Box title='발송 전에 확인해 주세요'>
            <div className='space-y-3 text-sm text-[#636c76]'>
              <div className='flex items-start gap-2'>
                <ListChecks className='mt-0.5 h-4 w-4 text-[#0969da]' />
                <p>
                  변수 치환이 필요한 경우 <code className='rounded bg-[#f6f8fa] px-1 py-0.5 text-xs text-[#1f2328]'>{'#{변수명}'}</code> 형식으로 본문을 작성해 주세요.
                </p>
              </div>
              <div className='flex items-start gap-2'>
                <CalendarClock className='mt-0.5 h-4 w-4 text-[#0969da]' />
                <p>예약 발송은 운영 정책에 따라 제한될 수 있으니 실제 전송 시간대를 미리 확인해 주세요.</p>
              </div>
            </div>
          </V2Box>
        </V2RightRail>
      </div>
    </div>
  );
}
