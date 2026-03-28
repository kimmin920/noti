import Link from 'next/link';
import { ChevronLeft, Download } from 'lucide-react';
import { campaignErrorSummary, campaignRecipients, campaignRows } from '@/components/v2/data';
import { V2Box, V2Button, V2Label, V2Progress } from '@/components/v2/ui';
import { V2InfoList, V2StatusHeader } from '@/components/v2/patterns';
import { notFound } from 'next/navigation';

export default async function V2CampaignDetailPage(props: { params: Promise<{ campaignId: string }> }) {
  const params = await props.params;
  const campaign = campaignRows.find((row) => row.id === params.campaignId);

  if (!campaign) {
    notFound();
  }

  return (
    <div>
      <V2StatusHeader
        title={campaign.name}
        subtitle={`${campaign.channel} · 생성일: 2026-03-22 · 담당: 김관리자`}
        status={<V2Label tone={campaign.status === '진행 중' ? 'blue' : campaign.status === '발송 완료' ? 'green' : 'yellow'}>{campaign.status}</V2Label>}
        action={
          <div className='flex flex-wrap gap-2'>
            <Link href='/v2/campaigns' className='inline-flex items-center gap-1 rounded-md border border-[#d0d7de] px-3 py-1.5 text-sm font-medium text-[#1f2328] hover:bg-[#f6f8fa]'>
              <ChevronLeft className='h-4 w-4' />
              캠페인 목록
            </Link>
            {campaign.status === '진행 중' ? <V2Button variant='danger'>발송 중단</V2Button> : null}
          </div>
        }
      />

      <V2Box className='mb-4'>
        <div className='grid gap-5 md:grid-cols-5'>
          <div>
            <div className='text-xs text-[#636c76]'>전체 수신자</div>
            <div className='mt-2 font-mono text-[26px] font-semibold tracking-[-0.03em] text-[#1f2328]'>5,200</div>
          </div>
          <div>
            <div className='text-xs text-[#636c76]'>발송 완료</div>
            <div className='mt-2 font-mono text-[26px] font-semibold tracking-[-0.03em] text-[#1a7f37]'>3,120</div>
            <div className='mt-1 text-xs text-[#636c76]'>60%</div>
          </div>
          <div>
            <div className='text-xs text-[#636c76]'>성공</div>
            <div className='mt-2 font-mono text-[26px] font-semibold tracking-[-0.03em] text-[#1a7f37]'>3,054</div>
            <div className='mt-1 text-xs text-[#1a7f37]'>97.8%</div>
          </div>
          <div>
            <div className='text-xs text-[#636c76]'>실패</div>
            <div className='mt-2 font-mono text-[26px] font-semibold tracking-[-0.03em] text-[#d1242f]'>66</div>
            <div className='mt-1 text-xs text-[#d1242f]'>2.1%</div>
          </div>
          <div>
            <div className='text-xs text-[#636c76]'>대기 중</div>
            <div className='mt-2 font-mono text-[26px] font-semibold tracking-[-0.03em] text-[#9a6700]'>2,080</div>
            <div className='mt-1 text-xs text-[#636c76]'>40%</div>
          </div>
        </div>
        <div className='mt-5'>
          <div className='mb-2 flex items-center gap-2 text-xs text-[#636c76]'>
            <span>진행률</span>
            <span className='ml-auto font-mono'>3,120 / 5,200건</span>
          </div>
          <V2Progress value={60} className='h-2.5' />
        </div>
      </V2Box>

      <div className='grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]'>
        <V2Box
          title='수신자별 발송 현황'
          actions={
            <div className='flex flex-wrap gap-2'>
              <select className='h-[30px] rounded-md border border-[#d0d7de] bg-white px-2 text-xs text-[#1f2328]'>
                <option>전체</option>
                <option>성공</option>
                <option>실패</option>
                <option>대기</option>
              </select>
              <V2Button size='sm'><Download className='h-4 w-4' />내보내기</V2Button>
            </div>
          }
        >
          <div className='overflow-x-auto'>
            <table className='w-full border-collapse text-left'>
              <thead>
                <tr className='bg-[#f6f8fa]'>
                  {['수신번호', '이름', '상태', '결과 코드', '처리 시각'].map((head) => (
                    <th key={head} className='whitespace-nowrap border-b border-[#d0d7de] px-3 py-2 text-xs font-semibold text-[#636c76]'>
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaignRecipients.map((recipient) => (
                  <tr key={`${recipient.phone}-${recipient.time}`} className='border-b border-[#eaeef2] last:border-b-0'>
                    <td className='px-3 py-3 font-mono text-xs text-[#1f2328]'>{recipient.phone}</td>
                    <td className='px-3 py-3 text-sm text-[#636c76]'>{recipient.name}</td>
                    <td className='px-3 py-3'>
                      <V2Label tone={recipient.status === '성공' ? 'green' : recipient.status === '실패' ? 'red' : 'yellow'}>
                        {recipient.status}
                      </V2Label>
                    </td>
                    <td className='px-3 py-3 font-mono text-xs' style={recipient.code.startsWith('E') ? { color: '#d1242f' } : { color: '#636c76' }}>
                      {recipient.code}
                    </td>
                    <td className='px-3 py-3 text-xs text-[#636c76]'>{recipient.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </V2Box>

        <div className='space-y-4'>
          <V2Box title='캠페인 정보'>
            <V2InfoList
              items={[
                { label: '채널', value: campaign.channel },
                { label: '수신자', value: '5,200명' },
                { label: '상태', value: campaign.status },
                { label: '발송 시작', value: campaign.scheduledAt },
                { label: '메시지', value: '[ACME] 여름 세일이 시작되었습니다! 지금 바로 확인하세요.' }
              ]}
            />
          </V2Box>

          <V2Box title='오류 분석'>
            <div className='space-y-0'>
              {campaignErrorSummary.map((item, index) => (
                <div key={item.code} className={index === campaignErrorSummary.length - 1 ? 'flex items-center justify-between py-3' : 'flex items-center justify-between border-b border-[#eaeef2] py-3'}>
                  <div className='text-sm text-[#1f2328]'>{item.code} · {item.label}</div>
                  <div className='font-mono text-xs text-[#d1242f]'>{item.count}건</div>
                </div>
              ))}
            </div>
          </V2Box>
        </div>
      </div>
    </div>
  );
}
