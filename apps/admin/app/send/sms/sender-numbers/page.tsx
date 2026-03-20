'use client';

import { FileBadge2 } from 'lucide-react';
import { LoginRequiredState, SessionPendingState, TenantAdminRequiredState } from '@/components/access-state';
import { SendPageShell } from '@/components/send-page-shell';
import { SmsSenderNumberManager } from '@/components/sms-sender-number-manager';
import { useAdminDashboard } from '@/hooks/use-admin-dashboard';

export default function SmsSenderNumbersPage() {
  const {
    me,
    error,
    loading,
    senderNumbers,
    nhnRegisteredSenders,
    syncApprovedNumbers,
    senderForm,
    setSenderForm,
    setTelecomFile,
    setConsentFile,
    setThirdPartyBusinessRegistrationFile,
    setRelationshipProofFile,
    setAdditionalDocumentFile,
    applySenderNumber
  } = useAdminDashboard();

  if (loading && !me) {
    return (
      <SessionPendingState
        title="SMS 발신번호 관리"
        description="발신번호 신청 이력과 제출 가능한 서류 구성을 불러오고 있습니다."
      />
    );
  }

  if (!me) {
    return (
      <LoginRequiredState
        title="SMS 발신번호 관리"
        description="발신번호 신청과 서류 제출은 사업자 계정 로그인 후 사용할 수 있습니다."
        nextPath="/send/sms/sender-numbers"
        error={error}
      />
    );
  }

  if (me.role === 'OPERATOR') {
    return (
      <TenantAdminRequiredState
        title="사업자 계정이 필요합니다"
        description="운영자 계정은 내부 심사 도구 전용입니다. SMS 발신번호 신청은 `TENANT_ADMIN` 세션에서만 허용됩니다."
        message="로그인 페이지에서 사업자 계정으로 다시 인증한 뒤 SMS 발신번호 관리 화면을 사용하세요."
        nextPath="/send/sms/sender-numbers"
      />
    );
  }

  const approvedCount = senderNumbers.filter((senderNumber) => senderNumber.status === 'APPROVED').length;
  const submittedCount = senderNumbers.filter((senderNumber) => senderNumber.status === 'SUBMITTED').length;

  return (
    <SendPageShell
      icon={FileBadge2}
      badge="Sender Documents"
      title="SMS 발신번호 관리"
      description="번호 명의 형태에 따라 필요한 서류를 정리해서 제출하는 전용 화면입니다. 사업자 명의 번호와 개인 명의 번호를 구분해 필요한 문서를 바로 확인할 수 있게 풀어썼습니다."
      stats={[
        {
          label: '전체 신청',
          value: `${senderNumbers.length}건`,
          hint: '현재 사업자 계정 신청 이력'
        },
        {
          label: '승인 완료',
          value: `${approvedCount}건`,
          hint: '즉시 발송에 쓸 수 있는 번호'
        },
        {
          label: '심사 중',
          value: `${submittedCount}건`,
          hint: '운영자 검토 대기 상태'
        }
      ]}
      quickLinks={[
        {
          label: 'SMS 보내기',
          href: '/send/sms/single',
          description: '승인된 발신번호로 단건 문자를 보냅니다.'
        },
        {
          label: '대량메세지 보내기',
          href: '/send/sms/bulk',
          description: '실제 유저 목록 기준으로 bulk SMS를 발송합니다.'
        },
        {
          label: 'SMS 템플릿',
          href: '/send/sms/templates',
          description: '발신번호 승인 후 연결할 템플릿 상태를 점검합니다.'
        },
        {
          label: '대시보드',
          href: '/',
          description: '카카오 채널과 전체 운영 현황으로 돌아갑니다.'
        }
      ]}
    >
      {error && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <SmsSenderNumberManager
        senderNumbers={senderNumbers}
        nhnRegisteredSenders={nhnRegisteredSenders}
        syncApprovedNumbers={syncApprovedNumbers}
        senderForm={senderForm}
        setSenderForm={setSenderForm}
        setTelecomFile={setTelecomFile}
        setConsentFile={setConsentFile}
        setThirdPartyBusinessRegistrationFile={setThirdPartyBusinessRegistrationFile}
        setRelationshipProofFile={setRelationshipProofFile}
        setAdditionalDocumentFile={setAdditionalDocumentFile}
        applySenderNumber={applySenderNumber}
      />
    </SendPageShell>
  );
}
