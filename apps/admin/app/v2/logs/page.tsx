'use client';

import { Filter, RefreshCw, Search } from 'lucide-react';
import { logRows } from '@/components/v2/data';
import { V2Box, V2Button, V2Chip, V2Label, V2PageHeader, V2Input, V2Select } from '@/components/v2/ui';

export default function V2LogsPage() {
  return (
    <div>
      <V2PageHeader
        title='발송 로그'
        description='메시지 요청 이력과 배송 결과를 조회합니다'
        actions={<V2Button icon={RefreshCw}>상태 새로고침</V2Button>}
      />

      <V2Box className='mb-4'>
        <div className='flex flex-col gap-2 lg:flex-row lg:items-center'>
          <div className='relative max-w-[280px] flex-1'>
            <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#636c76]' />
            <V2Input placeholder='요청 ID 또는 수신번호 검색' className='pl-9' />
          </div>
          <V2Select className='w-full lg:w-[120px]'>
            <option>전체 채널</option>
            <option>SMS</option>
            <option>알림톡</option>
          </V2Select>
          <V2Select className='w-full lg:w-[120px]'>
            <option>전체 상태</option>
            <option>전송완료</option>
            <option>실패</option>
            <option>처리중</option>
          </V2Select>
          <V2Button icon={Filter}>검색</V2Button>
          <span className='ml-auto text-xs text-[#636c76]'>총 {logRows.length}건</span>
        </div>
      </V2Box>

      <V2Box>
        <div className='overflow-x-auto'>
          <table className='w-full border-collapse text-left'>
            <thead>
              <tr className='bg-[#f6f8fa]'>
                {['요청 ID', '채널', '수신번호', '상태', '요청 시각'].map((head) => (
                  <th key={head} className='whitespace-nowrap border-b border-[#d0d7de] px-3 py-2 text-xs font-semibold text-[#636c76]'>
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logRows.map((row) => (
                <tr key={row.requestId} className='border-b border-[#eaeef2] last:border-b-0'>
                  <td className='px-3 py-3 font-mono text-xs text-[#1f2328]'>{row.requestId}</td>
                  <td className='px-3 py-3 text-sm'>
                    <V2Chip tone={row.channel === 'SMS' ? 'sms' : 'kakao'}>{row.channel}</V2Chip>
                  </td>
                  <td className='px-3 py-3 font-mono text-xs text-[#636c76]'>{row.recipient}</td>
                  <td className='px-3 py-3 text-sm'>
                    <V2Label tone={row.status === '전송완료' ? 'green' : row.status === '실패' ? 'red' : 'blue'}>
                      {row.status}
                    </V2Label>
                  </td>
                  <td className='px-3 py-3 text-xs text-[#636c76]'>{row.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </V2Box>
    </div>
  );
}
