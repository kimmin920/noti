'use client';

import { useState } from 'react';
import { Check, CircleCheckBig, MessageCircle, Plus, Smartphone, Trash2 } from 'lucide-react';
import { v2ButtonClass, V2Label, V2PageHeader, V2Tabs } from '@/components/v2/ui';

function SmsResourcePanel() {
  const steps = ['신청 완료', '서류 검토', '발송 활성화'];

  return (
    <div>
      <div className='flex items-center gap-8 mb-16'>
        <h3 style={{ fontSize: 15, fontWeight: 600 }}>등록된 발신번호</h3>
      </div>

      <div className='flash flash-success'>
        <CircleCheckBig className='icon icon-16 flash-icon' />
        <div className='flash-body'>
          <strong>발신번호가 등록되었습니다.</strong> SMS 발송이 가능합니다.
        </div>
        <div className='flash-actions'>
          <button className={v2ButtonClass('default', 'sm')}>
            <Plus className='icon icon-14' />
            번호 추가
          </button>
        </div>
      </div>

      <div className='box'>
        <div className='box-header'>
          <div>
            <div className='box-title'>010-1234-5678</div>
            <div className='box-subtitle'>일반 번호 · 등록일: 2025-06-18</div>
          </div>
          <V2Label tone='green'>활성</V2Label>
        </div>
        <div className='box-body'>
          <div className='steps'>
            {steps.map((step) => (
              <div key={step} className='step'>
                <div className='step-circle done'>
                  <Check className='icon icon-14' />
                </div>
                <div className='step-label done'>{step}</div>
              </div>
            ))}
          </div>
        </div>
        <div className='box-footer'>
          <span className='text-small'>SMS 단건 발송 및 대량 발송에 사용할 수 있습니다.</span>
          <button className={v2ButtonClass('default', 'sm')}>
            <Trash2 className='icon icon-14' />
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

function KakaoResourcePanel() {
  return (
    <div>
      <div className='flex items-center gap-8 mb-16'>
        <h3 style={{ fontSize: 15, fontWeight: 600 }}>카카오 발신프로필 (채널)</h3>
        <span className='ml-auto' />
        <button className={v2ButtonClass('default', 'sm')}>
          <Plus className='icon icon-14' />
          채널 추가
        </button>
      </div>

      <div className='flash flash-success'>
        <CircleCheckBig className='icon icon-16 flash-icon' />
        <div className='flash-body'>
          <strong>카카오채널이 연결되었습니다.</strong> 알림톡 발송이 가능합니다.
        </div>
      </div>

      <div className='box'>
        <div className='box-header'>
          <div>
            <div className='box-title'>@acme-brand</div>
            <div className='box-subtitle'>브랜드 채널 · 연결일: 2025-06-18</div>
          </div>
          <V2Label tone='green'>활성</V2Label>
        </div>
        <div className='box-body'>
          <div className='grid gap-4 md:grid-cols-3'>
            <div style={{ fontSize: 12 }}>
              <div className='text-muted' style={{ marginBottom: 2 }}>
                발신프로필 키
              </div>
              <div className='text-mono'>KA01···b2f8</div>
            </div>
            <div style={{ fontSize: 12 }}>
              <div className='text-muted' style={{ marginBottom: 2 }}>
                채널 ID
              </div>
              <div className='text-mono'>@acme-brand</div>
            </div>
            <div style={{ fontSize: 12 }}>
              <div className='text-muted' style={{ marginBottom: 2 }}>
                알림톡 템플릿
              </div>
              <div style={{ fontWeight: 500 }}>
                0개{' '}
                <button className={v2ButtonClass('default', 'sm')} style={{ marginLeft: 6 }}>
                  동기화
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className='box-footer'>
          <span className='text-small'>알림톡 단건 발송 및 이벤트 자동 발송에 사용할 수 있습니다.</span>
          <button className={v2ButtonClass('default', 'sm')}>
            <Trash2 className='icon icon-14' />
            연결 해제
          </button>
        </div>
      </div>
    </div>
  );
}

export default function V2ResourcesPage() {
  const [tab, setTab] = useState<'sms' | 'kakao'>('sms');

  return (
    <div>
      <V2PageHeader title='발신 자원 관리' description='SMS 발신번호와 카카오 채널을 등록·관리합니다' />
      <V2Tabs
        tabs={[
          { key: 'sms', label: 'SMS 발신번호', icon: Smartphone },
          { key: 'kakao', label: '카카오 채널', icon: MessageCircle }
        ]}
        active={tab}
        onChange={(value) => setTab(value as 'sms' | 'kakao')}
      />
      {tab === 'sms' ? <SmsResourcePanel /> : <KakaoResourcePanel />}
    </div>
  );
}
