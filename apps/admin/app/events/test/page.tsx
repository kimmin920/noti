'use client';

import { FlaskConical, Workflow } from 'lucide-react';
import { LoginRequiredState, SessionPendingState, TenantAdminRequiredState } from '@/components/access-state';
import { EventTestRunnerCard } from '@/components/event-api-sections';
import { EventPageShell } from '@/components/event-page-shell';
import { useAdminDashboard } from '@/hooks/use-admin-dashboard';

export default function EventTestPage() {
  const {
    me,
    error,
    loading,
    selectedEventTestKey,
    setSelectedEventTestKey,
    selectedEventTestRule,
    eventTestRecipientPhone,
    setEventTestRecipientPhone,
    eventTestRecipientUserId,
    setEventTestRecipientUserId,
    eventTestVariables,
    updateEventTestVariable,
    eventTestRequestExample,
    sendingEventTest,
    executeEventTest,
    eventRules
  } = useAdminDashboard();

  if (loading && !me) {
    return (
      <SessionPendingState
        title="이벤트 테스트"
        description="테스트 가능한 이벤트 규칙과 현재 세션 권한을 확인하고 있습니다."
      />
    );
  }

  if (!me) {
    return (
      <LoginRequiredState
        title="이벤트 테스트"
        description="API 요청 예시와 테스트 발송은 사업자 계정 로그인 후 사용할 수 있습니다."
        nextPath="/events/test"
        error={error}
      />
    );
  }

  if (me.role === 'OPERATOR') {
    return (
      <TenantAdminRequiredState
        title="사업자 계정이 필요합니다"
        description="운영자 계정은 내부 심사 도구 전용입니다. 이벤트 테스트는 `TENANT_ADMIN` 세션에서만 허용됩니다."
        message="로그인 페이지에서 사업자 계정으로 다시 인증한 뒤 이벤트 테스트를 진행하세요."
        nextPath="/events/test"
      />
    );
  }

  const activeRuleCount = eventRules.filter((rule) => rule.enabled).length;

  return (
    <EventPageShell
      icon={FlaskConical}
      badge="Event API Runner"
      title="이벤트 테스트"
      description="저장된 이벤트를 선택해 수신자와 변수만 바꾸며 반복 검증합니다. 외부 연동자가 보는 요청 예시와 실제 테스트 실행 흐름을 동일한 화면에서 맞춥니다."
      stats={[
        {
          label: '테스트 가능',
          value: `${activeRuleCount}개`,
          hint: '활성 상태 이벤트 규칙'
        },
        {
          label: '선택 이벤트',
          value: selectedEventTestRule?.displayName || '미선택',
          hint: selectedEventTestRule?.eventKey || '먼저 이벤트를 고르세요'
        },
        {
          label: '엔드포인트',
          value: 'POST',
          hint: '/v1/message-requests'
        }
      ]}
      quickLinks={[
        {
          label: '이벤트 만들기',
          href: '/events/create',
          description: '새 이벤트를 만들거나 채널 전략을 수정합니다.'
        },
        {
          label: 'SMS 보내기',
          href: '/send/sms/single',
          description: '직접 발송 화면에서 실제 템플릿 결과를 확인합니다.'
        },
        {
          label: '알림톡 보내기',
          href: '/send/alimtalk/single',
          description: '알림톡 템플릿과 변수 적용 상태를 실제 발송 흐름으로 점검합니다.'
        },
        {
          label: '대시보드',
          href: '/',
          description: '발송 워크스페이스와 운영 현황으로 돌아갑니다.'
        }
      ]}
    >
      {error && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-primary/10 bg-primary/5 px-5 py-4 text-sm text-muted-foreground">
        <div className="flex items-start gap-3">
          <Workflow className="mt-0.5 h-4 w-4 text-primary" />
          <div>
            테스트는 항상 저장된 규칙을 기준으로만 실행됩니다. 이벤트 키를 먼저 만들고 나서, 이 페이지에서 수신자와 변수만 바꿔 반복 검증하는 흐름을 권장합니다.
          </div>
        </div>
      </div>

      <EventTestRunnerCard
        selectedEventTestKey={selectedEventTestKey}
        setSelectedEventTestKey={setSelectedEventTestKey}
        selectedEventTestRule={selectedEventTestRule}
        eventTestRecipientPhone={eventTestRecipientPhone}
        setEventTestRecipientPhone={setEventTestRecipientPhone}
        eventTestRecipientUserId={eventTestRecipientUserId}
        setEventTestRecipientUserId={setEventTestRecipientUserId}
        eventTestVariables={eventTestVariables}
        updateEventTestVariable={updateEventTestVariable}
        eventTestRequestExample={eventTestRequestExample}
        sendingEventTest={sendingEventTest}
        executeEventTest={executeEventTest}
        eventRules={eventRules}
      />
    </EventPageShell>
  );
}
