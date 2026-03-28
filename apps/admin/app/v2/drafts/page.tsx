'use client';

import { Trash2 } from 'lucide-react';
import { draftMessages } from '@/components/v2/data';
import { V2Box, V2Button, V2Chip, V2PageHeader } from '@/components/v2/ui';

export default function V2DraftsPage() {
  return (
    <div>
      <V2PageHeader
        title='임시저장함'
        description='작성 중 저장된 메시지 초안입니다. 이어서 발송하거나 삭제할 수 있습니다.'
        actions={<V2Button variant='danger' size='sm' icon={Trash2}>전체 삭제</V2Button>}
      />

      <V2Box>
        <div className='space-y-3'>
          {draftMessages.map((draft) => (
            <div key={draft.id} className='rounded-md border border-[#d8dee4] px-4 py-4'>
              <div className='flex flex-col gap-3 md:flex-row md:items-start md:justify-between'>
                <div className='min-w-0'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <div className='text-sm font-semibold text-[#1f2328]'>{draft.title}</div>
                    <V2Chip tone={draft.channel === 'SMS' ? 'sms' : 'kakao'}>{draft.channel}</V2Chip>
                  </div>
                  <p className='mt-2 text-sm text-[#636c76]'>{draft.body}</p>
                  <div className='mt-2 text-xs text-[#818f9a]'>마지막 저장: {draft.updatedAt}</div>
                </div>
                <div className='flex gap-2'>
                  <V2Button size='sm'>이어서 작성</V2Button>
                  <V2Button size='sm' variant='danger'>삭제</V2Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </V2Box>
    </div>
  );
}
