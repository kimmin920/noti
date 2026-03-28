'use client';

import { AlertTriangle, Copy } from 'lucide-react';
import { V2Box, V2Button, V2Input, V2PageHeader } from '@/components/v2/ui';

export default function V2SettingsPage() {
  return (
    <div>
      <V2PageHeader title='운영 설정' description='워크스페이스 설정을 관리합니다' />

      <div className='space-y-4'>
        <V2Box
          title='테넌트 정보'
          footer={
            <>
              <span>변경 사항은 즉시 적용됩니다.</span>
              <V2Button variant='success'>변경 사항 저장</V2Button>
            </>
          }
        >
          <div className='space-y-4'>
            <div>
              <label className='mb-1.5 block text-sm font-semibold text-[#1f2328]'>테넌트명</label>
              <V2Input defaultValue='ACME Corp' className='max-w-[320px]' />
              <p className='mt-1 text-xs text-[#636c76]'>워크스페이스 표시 이름입니다.</p>
            </div>
            <div>
              <label className='mb-1.5 block text-sm font-semibold text-[#1f2328]'>플랜</label>
              <V2Input defaultValue='Business Plan' readOnly className='max-w-[320px] bg-[#f6f8fa] text-[#636c76]' />
            </div>
          </div>
        </V2Box>

        <V2Box
          title='Webhook 설정'
          footer={
            <>
              <span />
              <V2Button variant='success'>변경 사항 저장</V2Button>
            </>
          }
        >
          <div className='space-y-4'>
            <div>
              <label className='mb-1.5 block text-sm font-semibold text-[#1f2328]'>발송 결과 콜백 URL</label>
              <V2Input placeholder='https://your-server.com/webhook/result' className='max-w-[480px]' />
              <p className='mt-1 text-xs text-[#636c76]'>발송 성공·실패 결과를 이 URL로 POST 요청으로 전송합니다.</p>
            </div>
            <div>
              <label className='mb-1.5 block text-sm font-semibold text-[#1f2328]'>이벤트 수신 엔드포인트 (읽기 전용)</label>
              <div className='flex max-w-[480px] gap-2'>
                <V2Input readOnly defaultValue='https://api.messageops.io/events/acme-corp' className='bg-[#f6f8fa] text-[#636c76]' />
                <V2Button icon={Copy}>복사</V2Button>
              </div>
              <p className='mt-1 text-xs text-[#636c76]'>외부 서비스에서 이 URL로 이벤트를 전송하면 자동 발송 규칙이 실행됩니다.</p>
            </div>
          </div>
        </V2Box>

        <V2Box
          title='위험 구역'
          subtitle='아래 작업은 되돌릴 수 없습니다.'
          className='border-[#d1242f]'
          footer={null}
        >
          <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
            <div>
              <div className='text-sm font-semibold text-[#1f2328]'>워크스페이스 초기화</div>
              <div className='mt-1 text-sm text-[#636c76]'>모든 템플릿, 규칙, 로그 데이터가 삭제됩니다.</div>
            </div>
            <V2Button variant='danger' icon={AlertTriangle}>초기화</V2Button>
          </div>
        </V2Box>
      </div>
    </div>
  );
}
