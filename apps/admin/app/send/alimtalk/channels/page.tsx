'use client';

import { MessageSquareText } from 'lucide-react';
import { LoginRequiredState, SessionPendingState, TenantAdminRequiredState } from '@/components/access-state';
import { SendPageShell } from '@/components/send-page-shell';
import { SenderProfileManager } from '@/components/sender-profile-manager';
import { useAdminDashboard } from '@/hooks/use-admin-dashboard';

export default function AlimtalkChannelsPage() {
  const {
    me,
    error,
    loading,
    activeSenderProfiles,
    pendingSenderProfiles,
    blockedSenderProfiles,
    senderProfileForm,
    setSenderProfileForm,
    senderProfileCategoryOptions,
    applyingSenderProfile,
    applySenderProfile,
    senderProfileTokenForm,
    setSenderProfileTokenForm,
    verifyingSenderProfile,
    verifySenderProfileToken
  } = useAdminDashboard();

  if (loading && !me) {
    return (
      <SessionPendingState
        title="카카오 채널 (발신프로필)"
        description="카카오 메세지 발송용 채널 연결 상태와 현재 세션 권한을 확인하고 있습니다."
      />
    );
  }

  if (!me) {
    return (
      <LoginRequiredState
        title="카카오 채널 (발신프로필)"
        description="카카오 채널 연동과 인증 토큰 확인을 진행하는 전용 화면입니다."
        nextPath="/send/alimtalk/channels"
        error={error}
      />
    );
  }

  if (me.role === 'OPERATOR') {
    return (
      <TenantAdminRequiredState
        title="사업자 계정이 필요합니다"
        description="운영자 계정은 내부 심사 전용입니다. 카카오 채널 관리는 `USER` 세션에서만 사용할 수 있습니다."
        message="로그인 페이지에서 사업자 계정으로 다시 인증한 뒤 이 페이지를 사용하세요."
        nextPath="/send/alimtalk/channels"
      />
    );
  }

  return (
    <SendPageShell
      icon={MessageSquareText}
      badge="Kakao Channel Setup"
      title="카카오 채널 (발신프로필)"
      description="카카오 메세지 발송에 연결할 채널을 등록하고, 인증 토큰으로 상태를 확인하는 전용 화면입니다."
      stats={[
        {
          label: '활성 채널',
          value: `${activeSenderProfiles.length}개`,
          hint: '즉시 발송 가능한 채널'
        },
        {
          label: '심사 중',
          value: `${pendingSenderProfiles.length}개`,
          hint: '추가 확인이 진행 중인 채널'
        },
        {
          label: '차단/제한',
          value: `${blockedSenderProfiles.length}개`,
          hint: '재검토가 필요한 채널'
        }
      ]}
      quickLinks={[
        {
          label: '단일 알림톡 보내기',
          href: '/send/alimtalk/single',
          description: '연동된 채널로 한 명에게 즉시 알림톡을 보냅니다.'
        },
        {
          label: '대량 알림톡 보내기',
          href: '/send/alimtalk/bulk',
          description: '유저를 선택해 승인된 템플릿으로 대량 발송합니다.'
        },
        {
          label: '알림톡 템플릿',
          href: '/send/alimtalk/templates',
          description: '템플릿 승인 상태와 본문을 함께 관리합니다.'
        },
        {
          label: '대시보드',
          href: '/',
          description: '전체 발송 현황과 운영 로그로 돌아갑니다.'
        }
      ]}
    >
      <SenderProfileManager
        activeSenderProfiles={activeSenderProfiles}
        pendingSenderProfiles={pendingSenderProfiles}
        blockedSenderProfiles={blockedSenderProfiles}
        errorMessage={error}
        senderProfileForm={senderProfileForm}
        setSenderProfileForm={setSenderProfileForm}
        senderProfileCategoryOptions={senderProfileCategoryOptions}
        applyingSenderProfile={applyingSenderProfile}
        applySenderProfile={applySenderProfile}
        senderProfileTokenForm={senderProfileTokenForm}
        setSenderProfileTokenForm={setSenderProfileTokenForm}
        verifyingSenderProfile={verifyingSenderProfile}
        verifySenderProfileToken={verifySenderProfileToken}
      />
    </SendPageShell>
  );
}
