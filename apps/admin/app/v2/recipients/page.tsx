'use client';

import { Download, UserPlus, Users } from 'lucide-react';
import { recipients } from '@/components/v2/data';
import { V2Box, V2Button, V2Label, V2PageHeader, V2StatGrid } from '@/components/v2/ui';

export default function V2RecipientsPage() {
  return (
    <div>
      <V2PageHeader
        title='수신자 관리'
        description='발송 대상 유저와 세그먼트를 관리합니다'
        actions={
          <>
            <V2Button icon={Download}>CSV Import</V2Button>
            <V2Button variant='accent' icon={UserPlus}>수신자 추가</V2Button>
          </>
        }
      />

      <V2StatGrid
        className='mb-4'
        items={[
          { label: '전체 수신자', value: '3' },
          { label: '마케팅 동의', value: '2', accent: '#1a7f37' },
          { label: '세그먼트', value: '3' },
          { label: '수신 거부', value: '1', accent: '#d1242f' }
        ]}
      />

      <V2Box title='수신자 목록'>
        <div className='overflow-x-auto'>
          <table className='w-full border-collapse text-left'>
            <thead>
              <tr className='bg-[#f6f8fa]'>
                {['이름', '전화번호', '세그먼트', '마케팅 동의', '상태'].map((head) => (
                  <th key={head} className='whitespace-nowrap border-b border-[#d0d7de] px-3 py-2 text-xs font-semibold text-[#636c76]'>
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recipients.map((recipient) => (
                <tr key={recipient.phone} className='border-b border-[#eaeef2] last:border-b-0'>
                  <td className='px-3 py-3 text-sm font-medium text-[#1f2328]'>{recipient.name}</td>
                  <td className='px-3 py-3 font-mono text-xs text-[#636c76]'>{recipient.phone}</td>
                  <td className='px-3 py-3 text-sm text-[#636c76]'>{recipient.segment}</td>
                  <td className='px-3 py-3 text-sm'>
                    <V2Label tone={recipient.consent === '동의' ? 'green' : 'red'}>{recipient.consent}</V2Label>
                  </td>
                  <td className='px-3 py-3 text-sm'>
                    <V2Label tone={recipient.status === '활성' ? 'green' : 'gray'}>{recipient.status}</V2Label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </V2Box>
    </div>
  );
}
