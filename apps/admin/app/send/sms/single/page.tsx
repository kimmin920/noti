'use client';

import { Smartphone } from 'lucide-react';
import { LoginRequiredState, SessionPendingState, TenantAdminRequiredState } from '@/components/access-state';
import { SmsSendCard } from '@/components/direct-send-section';
import { ResourceRequiredDialog } from '@/components/resource-required-dialog';
import { SendPageShell } from '@/components/send-page-shell';
import { useAdminDashboard } from '@/hooks/use-admin-dashboard';

export default function SmsSingleSendPage() {
  const {
    me,
    error,
    loading,

    approvedSenderNumbers,
    manualSmsForm,
    setManualSmsForm,
    directSmsTemplateOptions,
    selectedManualSmsTemplate,
    manualSmsVariables,
    setManualSmsVariables,
    renderedManualSmsBody,
    formattedManualSmsBody,
    sendingManualSms,
    sendDirectSms,
    logs
  } = useAdminDashboard();

  const smsLogCount = logs.filter((log) => log.resolvedChannel === 'SMS').length;

  if (loading && !me) {
    return (
      <SessionPendingState
        title="SMS 보내기"
        description="직접 SMS 발송 권한과 사용 가능한 발신번호를 확인하고 있습니다."
      />
    );
  }

  if (!me) {
    return (
      <LoginRequiredState
        title="SMS 보내기"
        description="직접 발송 페이지입니다. 먼저 사업자 계정으로 로그인해야 발송 기능을 사용할 수 있습니다."
        nextPath="/send/sms/single"
        error={error}
      />
    );
  }

  if (me.role === 'OPERATOR') {
    return (
      <TenantAdminRequiredState
        title="사업자 계정이 필요합니다"
        description="운영자 계정은 내부 심사 도구 전용입니다. 직접 SMS 발송은 `USER` 세션에서만 허용됩니다."
        message="로그인 페이지에서 사업자 계정으로 다시 인증한 뒤 이 페이지를 사용하세요."
        nextPath="/send/sms/single"
      />
    );
  }

  const missingSenderNumber = !loading && approvedSenderNumbers.length === 0;

  return (
    <>
      <SendPageShell
        icon={Smartphone}
        badge="SMS Workspace"
        title="SMS 보내기"
        description="발신번호를 선택하고 본문을 바로 전송하는 전용 화면입니다. 승인된 번호 상태와 최근 SMS 흐름만 따로 보도록 분리했습니다."
        stats={[
          {
            label: '발신번호',
            value: `${approvedSenderNumbers.length}개`,
            hint: '즉시 사용 가능한 승인 번호'
          },
          {
            label: '최근 SMS',
            value: `${smsLogCount}건`,
            hint: '현재 대시보드에 로드된 SMS 로그'
          },
          {
            label: '전송 UI',
            value: '즉시 / 예약',
            hint: '예약 시각 접수 후 실제 큐 발송'
          }
        ]}
        quickLinks={[
          {
            label: '대량메세지 보내기',
            href: '/send/sms/bulk',
            description: '유저를 선택해 대량 SMS를 한 번에 발송합니다.'
          },
          {
            label: 'SMS 템플릿',
            href: '/send/sms/templates',
            description: '제목과 변수 칩을 관리하는 전용 템플릿 화면입니다.'
          },
          {
            label: '발송 로그 보기',
            href: '/#logs',
            description: '실패 코드와 최종 상태는 로그에서 바로 확인할 수 있습니다.'
          },
          {
            label: 'SMS 발신번호 관리',
            href: '/send/sms/sender-numbers',
            description: '발신번호 승인 상태와 필요한 제출 서류를 확인합니다.'
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

        <SmsSendCard
          approvedSenderNumbers={approvedSenderNumbers}
          manualSmsForm={manualSmsForm}
          setManualSmsForm={setManualSmsForm}
          directSmsTemplateOptions={directSmsTemplateOptions}
          selectedManualSmsTemplate={selectedManualSmsTemplate}
          manualSmsVariables={manualSmsVariables}
          setManualSmsVariables={setManualSmsVariables}
          renderedManualSmsBody={renderedManualSmsBody}
          formattedManualSmsBody={formattedManualSmsBody}
          sendingManualSms={sendingManualSms}
          sendDirectSms={sendDirectSms}
        />
      </SendPageShell>

      <ResourceRequiredDialog
        open={missingSenderNumber}
        icon={Smartphone}
        badge="발신번호 필요"
        title="사용 가능한 SMS 발신번호가 없습니다"
        description="SMS 발송은 먼저 승인된 발신번호가 있어야 시작할 수 있습니다. 발신번호를 등록하고 승인 상태를 확인하면 이 페이지에서 바로 발송을 이어갈 수 있습니다."
        primaryHref="/send/sms/sender-numbers"
        primaryLabel="발신번호 등록하러 가기"
      />
    </>
  );
}
