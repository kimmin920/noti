'use client';

import { useState } from 'react';
import { FilePlus2, TriangleAlert } from 'lucide-react';
import { kakaoTemplates, smsTemplates } from '@/components/v2/data';
import { V2Box, V2Button, V2Chip, V2Flash, V2Label, V2PageHeader, V2Tabs } from '@/components/v2/ui';

export default function V2TemplatesPage() {
  const [tab, setTab] = useState<'sms' | 'kakao'>('sms');

  return (
    <div>
      <V2PageHeader
        title='템플릿 관리'
        description='SMS 및 알림톡 발송 템플릿을 관리합니다'
        actions={<V2Button variant='accent' icon={FilePlus2}>템플릿 만들기</V2Button>}
      />

      <V2Tabs
        tabs={[
          { key: 'sms', label: 'SMS 템플릿', count: String(smsTemplates.length) },
          { key: 'kakao', label: '알림톡 템플릿', count: String(kakaoTemplates.length) }
        ]}
        active={tab}
        onChange={(value) => setTab(value as 'sms' | 'kakao')}
      />

      {tab === 'sms' ? (
        <V2Box>
          <div className='overflow-x-auto'>
            <table className='w-full border-collapse text-left'>
              <thead>
                <tr className='bg-[#f6f8fa]'>
                  {['템플릿명', '채널', '내용 미리보기', '버전', '상태', '수정일', ''].map((head) => (
                    <th key={head} className='whitespace-nowrap border-b border-[#d0d7de] px-3 py-2 text-xs font-semibold text-[#636c76]'>
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {smsTemplates.map((template) => (
                  <tr key={template.name} className='border-b border-[#eaeef2] last:border-b-0'>
                    <td className='px-3 py-3 text-sm font-medium text-[#1f2328]'>{template.name}</td>
                    <td className='px-3 py-3 text-sm'><V2Chip tone='sms'>SMS</V2Chip></td>
                    <td className='max-w-[220px] truncate px-3 py-3 text-sm text-[#636c76]'>{template.preview}</td>
                    <td className='px-3 py-3 font-mono text-xs text-[#636c76]'>{template.version}</td>
                    <td className='px-3 py-3 text-sm'>
                      <V2Label tone={template.status === '발행됨' ? 'green' : template.status === '초안' ? 'blue' : 'gray'}>{template.status}</V2Label>
                    </td>
                    <td className='px-3 py-3 text-xs text-[#636c76]'>{template.updatedAt}</td>
                    <td className='px-3 py-3'><V2Button size='sm'>편집</V2Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </V2Box>
      ) : (
        <div className='space-y-4'>
          <V2Flash tone='info' icon={TriangleAlert}>
            카카오 채널과 동기화된 승인 템플릿만 발송에 사용할 수 있습니다.
          </V2Flash>
          <V2Box>
            <div className='overflow-x-auto'>
              <table className='w-full border-collapse text-left'>
                <thead>
                  <tr className='bg-[#f6f8fa]'>
                    {['템플릿명', '채널', '내용 미리보기', '상태', '수정일', ''].map((head) => (
                      <th key={head} className='whitespace-nowrap border-b border-[#d0d7de] px-3 py-2 text-xs font-semibold text-[#636c76]'>
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {kakaoTemplates.map((template) => (
                    <tr key={template.name} className='border-b border-[#eaeef2] last:border-b-0'>
                      <td className='px-3 py-3 text-sm font-medium text-[#1f2328]'>{template.name}</td>
                      <td className='px-3 py-3 text-sm text-[#636c76]'>{template.channel}</td>
                      <td className='max-w-[260px] truncate px-3 py-3 text-sm text-[#636c76]'>{template.preview}</td>
                      <td className='px-3 py-3 text-sm'><V2Label tone='green'>{template.status}</V2Label></td>
                      <td className='px-3 py-3 text-xs text-[#636c76]'>{template.updatedAt}</td>
                      <td className='px-3 py-3'><V2Button size='sm'>편집</V2Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </V2Box>
        </div>
      )}
    </div>
  );
}
