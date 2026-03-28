'use client';

import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { campaignRows } from '@/components/v2/data';
import { V2Box, V2Button, V2Chip, V2Input, V2Label, V2LinkButton, V2PageHeader, V2Progress, V2Select, V2StatGrid } from '@/components/v2/ui';

export default function V2CampaignsPage() {
  return (
    <div>
      <V2PageHeader
        title='대량 발송'
        description='다수의 수신자에게 캠페인 메시지를 발송합니다.'
        actions={<V2LinkButton href='/v2/campaigns/new' variant='accent' icon={Plus}>캠페인 만들기</V2LinkButton>}
      />

      <V2StatGrid
        className='mb-4'
        items={[
          { label: '전체 캠페인', value: '4', sublabel: '전체 기간' },
          { label: '진행 중', value: '1', sublabel: '현재', accent: '#0969da' },
          { label: '총 발송 건수', value: '12,480', sublabel: '전체 기간' },
          { label: '평균 성공률', value: '97.2%', sublabel: '전체 캠페인', accent: '#1a7f37' }
        ]}
      />

      <V2Box className='mb-4'>
        <div className='flex flex-col gap-2 lg:flex-row lg:items-center'>
          <div className='relative max-w-[240px] flex-1'>
            <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#636c76]' />
            <V2Input placeholder='캠페인명 검색' className='pl-9' />
          </div>
          <V2Select className='w-full lg:w-[110px]'>
            <option>전체 채널</option>
            <option>SMS</option>
            <option>알림톡</option>
          </V2Select>
          <V2Select className='w-full lg:w-[110px]'>
            <option>전체 상태</option>
            <option>발송 완료</option>
            <option>진행 중</option>
            <option>예약됨</option>
            <option>취소됨</option>
          </V2Select>
        </div>
      </V2Box>

      <V2Box title='캠페인 목록' actions={<span className='text-xs text-[#636c76]'>총 4건</span>}>
        <div className='overflow-x-auto'>
          <table className='w-full border-collapse text-left'>
            <thead>
              <tr className='bg-[#f6f8fa]'>
                {['캠페인명', '채널', '수신자', '발송 현황', '성공률', '상태', '발송일시', ''].map((head) => (
                  <th key={head} className='whitespace-nowrap border-b border-[#d0d7de] px-3 py-2 text-xs font-semibold text-[#636c76]'>
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaignRows.map((row) => (
                <tr key={row.id} className='border-b border-[#eaeef2] last:border-b-0'>
                  <td className='px-3 py-3'>
                    <div className='text-sm font-medium text-[#1f2328]'>{row.name}</div>
                    <div className='mt-1 text-[11px] text-[#636c76]'>{row.subtitle}</div>
                  </td>
                  <td className='px-3 py-3 text-sm'>
                    <V2Chip tone={row.channel === 'SMS' ? 'sms' : 'kakao'}>{row.channel}</V2Chip>
                  </td>
                  <td className='px-3 py-3 font-mono text-xs text-[#1f2328]'>{row.recipients}</td>
                  <td className='min-w-[180px] px-3 py-3'>
                    {row.status === '예약됨' ? (
                      <div className='text-xs text-[#9a6700]'>{row.progressLabel}</div>
                    ) : (
                      <div>
                        <div className='mb-1 flex items-center gap-2'>
                          <span className='font-mono text-[11px] text-[#636c76]'>{row.progressLabel}</span>
                          <span className='ml-auto text-[11px] text-[#0969da]'>{row.progress}%</span>
                        </div>
                        <V2Progress value={row.progress} tone={row.status === '발송 완료' ? 'green' : 'blue'} className='h-1.5' />
                      </div>
                    )}
                  </td>
                  <td className='px-3 py-3 text-sm font-medium' style={row.successRate === '—' ? undefined : { color: '#1a7f37' }}>
                    {row.successRate}
                  </td>
                  <td className='px-3 py-3 text-sm'>
                    <V2Label
                      tone={
                        row.status === '진행 중'
                          ? 'blue'
                          : row.status === '발송 완료'
                            ? 'green'
                            : row.status === '예약됨'
                              ? 'yellow'
                              : 'gray'
                      }
                    >
                      {row.status}
                    </V2Label>
                  </td>
                  <td className='px-3 py-3 text-xs text-[#636c76]'>{row.scheduledAt.replace(' ', '\n')}</td>
                  <td className='px-3 py-3'>
                    <div className='flex flex-wrap gap-2'>
                      <Link href={`/v2/campaigns/${row.id}`} className='inline-flex rounded-md border border-[#d0d7de] px-2.5 py-1 text-xs font-medium text-[#1f2328] hover:bg-[#f6f8fa]'>
                        상세
                      </Link>
                      {row.status === '진행 중' ? (
                        <V2Button size='sm' variant='danger'>
                          중단
                        </V2Button>
                      ) : row.status === '예약됨' ? (
                        <V2Button size='sm' variant='danger'>
                          취소
                        </V2Button>
                      ) : null}
                    </div>
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
