'use client';

import { MessageSquareText } from 'lucide-react';
import { LoginRequiredState, SessionPendingState, TenantAdminRequiredState } from '@/components/access-state';
import { AlimtalkSendCard } from '@/components/direct-send-section';
import { ResourceRequiredDialog } from '@/components/resource-required-dialog';
import { SendPageShell } from '@/components/send-page-shell';
import { useAdminDashboard } from '@/hooks/use-admin-dashboard';

export default function AlimtalkSingleSendPage() {
  const {
    me,
    error,
    loading,

    approvedSenderNumbers,
    readySenderProfiles,
    manualAlimtalkForm,
    setManualAlimtalkForm,
    directAlimtalkTemplateOptions,
    selectedDirectAlimtalkTemplate,
    manualAlimtalkVariables,
    setManualAlimtalkVariables,
    sendingManualAlimtalk,
    sendDirectAlimtalk,
    logs
  } = useAdminDashboard();

  const alimtalkLogCount = logs.filter((log) => log.resolvedChannel === 'ALIMTALK').length;

  if (loading && !me) {
    return (
      <SessionPendingState
        title="알림톡 보내기"
        description="직접 알림톡 발송 권한과 사용 가능한 카카오 채널을 확인하고 있습니다."
      />
    );
  }

  if (!me) {
    return (
      <LoginRequiredState
        title="알림톡 보내기"
        description="직접 알림톡 발송 페이지입니다. 먼저 사업자 계정으로 로그인해야 발송 기능을 사용할 수 있습니다."
        nextPath="/send/alimtalk/single"
        error={error}
      />
    );
  }

  if (me.role === 'OPERATOR') {
    return (
      <TenantAdminRequiredState
        title="사업자 계정이 필요합니다"
        description="운영자 계정은 내부 심사 전용입니다. 직접 알림톡 발송은 `TENANT_ADMIN` 세션에서만 허용됩니다."
        message="로그인 페이지에서 사업자 계정으로 다시 인증한 뒤 이 페이지를 사용하세요."
        nextPath="/send/alimtalk/single"
      />
    );
  }

  const missingSenderProfile = !loading && readySenderProfiles.length === 0;

  return (
    <>
      <SendPageShell
        icon={MessageSquareText}
        badge="AlimTalk Workspace"
        title="알림톡 보내기"
        description="카카오 채널, 승인 템플릿, 변수 값을 한 흐름에서 점검하는 전용 화면입니다. 템플릿 변수 입력과 발송 준비 상태를 한 페이지에 모았습니다."
        stats={[
          {
            label: '채널',
            value: `${readySenderProfiles.length}개`,
            hint: '즉시 발송 가능한 카카오 채널'
          },
          {
            label: '템플릿',
            value: `${directAlimtalkTemplateOptions.length}개`,
            hint: '현재 선택 가능한 승인 템플릿'
          },
          {
            label: '최근 알림톡',
            value: `${alimtalkLogCount}건`,
            hint: '현재 대시보드에 로드된 알림톡 로그'
          }
        ]}
        quickLinks={[
          {
            label: '대량 알림톡 보내기',
            href: '/send/alimtalk/bulk',
            description: '유저를 선택해 대량 알림톡을 한 번에 발송합니다.'
          },
          {
            label: '알림톡 템플릿',
            href: '/send/alimtalk/templates',
            description: 'APR 승인 상태와 템플릿 본문을 점검합니다.'
          },
          {
            label: '카카오 채널 관리',
            href: '/send/alimtalk/channels',
            description: '카카오 채널 연동 상태와 그룹 동기화 여부를 확인합니다.'
          },
          {
            label: '대시보드',
            href: '/',
            description: '발송 워크스페이스와 전체 운영 현황으로 돌아갑니다.'
          }
        ]}
      >
        {error && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <AlimtalkSendCard
          approvedSenderNumbers={approvedSenderNumbers}
          readySenderProfiles={readySenderProfiles}
          manualAlimtalkForm={manualAlimtalkForm}
          setManualAlimtalkForm={setManualAlimtalkForm}
          directAlimtalkTemplateOptions={directAlimtalkTemplateOptions}
          selectedDirectAlimtalkTemplate={selectedDirectAlimtalkTemplate}
          manualAlimtalkVariables={manualAlimtalkVariables}
          setManualAlimtalkVariables={setManualAlimtalkVariables}
          sendingManualAlimtalk={sendingManualAlimtalk}
          sendDirectAlimtalk={sendDirectAlimtalk}
        />
      </SendPageShell>

      <ResourceRequiredDialog
        open={missingSenderProfile}
        icon={MessageSquareText}
        badge="카카오 채널 필요"
        title="등록된 카카오 채널이 아직 없습니다"
        description="알림톡 발송은 먼저 카카오 채널을 등록하고 사용 가능한 상태로 연결해야 시작할 수 있습니다. 채널 등록을 마치면 이 페이지에서 바로 발송을 이어서 진행할 수 있습니다."
        primaryHref="/send/alimtalk/channels"
        primaryLabel="채널 등록하러 가기"
      />
    </>
  );
}
