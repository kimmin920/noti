'use client';

import { Cable, Sparkles } from 'lucide-react';
import { LoginRequiredState, SessionPendingState, TenantAdminRequiredState } from '@/components/access-state';
import { EventRuleBuilderCard } from '@/components/event-api-sections';
import { EventPageShell } from '@/components/event-page-shell';
import { useAdminDashboard } from '@/hooks/use-admin-dashboard';

export default function EventCreatePage() {
  const {
    me,
    error,
    loading,
    eventRuleForm,
    setEventRuleForm,
    setEventRuleChannelStrategy,
    selectEventRuleSmsTemplate,
    selectEventRuleAlimtalkTemplate,
    smsTemplates,
    approvedSenderNumbers,
    alimtalkProviders,
    senderProfilesWithStatus,
    focusSenderProfileCenter,
    upsertRule,
    eventRules
  } = useAdminDashboard();

  if (loading && !me) {
    return (
      <SessionPendingState
        title="이벤트(API) 만들기"
        description="이벤트 규칙, 연결 템플릿, 채널 전략을 불러오고 있습니다."
      />
    );
  }

  if (!me) {
    return (
      <LoginRequiredState
        title="이벤트(API) 만들기"
        description="이벤트 생성과 수정은 사업자 계정 로그인 후 사용할 수 있습니다."
        nextPath="/events/create"
        error={error}
      />
    );
  }

  if (me.role === 'OPERATOR') {
    return (
      <TenantAdminRequiredState
        title="사업자 계정이 필요합니다"
        description="운영자 계정은 내부 심사 도구 전용입니다. 이벤트 규칙 생성과 수정은 `USER` 세션에서만 허용됩니다."
        message="로그인 페이지에서 사업자 계정으로 다시 인증한 뒤 이벤트(API) 페이지를 사용하세요."
        nextPath="/events/create"
      />
    );
  }

  const activeRuleCount = eventRules.filter((rule) => rule.enabled).length;
  const publishedSmsCount = smsTemplates.filter((template) => template.channel === 'SMS' && template.status === 'PUBLISHED').length;
  const approvedAlimtalkCount = alimtalkProviders.filter((template) =>
    template.providerTemplates?.some((providerTemplate) => providerTemplate.providerStatus === 'APR')
  ).length;

  return (
    <EventPageShell
      icon={Cable}
      badge="Event API Builder"
      title="이벤트(API) 만들기"
      description="메시지 이벤트를 계약 단위로 정의하고, 채널 전략과 템플릿 연결까지 한 자리에서 관리합니다. 대시보드와 분리해 운영 흐름을 더 또렷하게 만든 전용 화면입니다."
      stats={[
        {
          label: '전체 이벤트',
          value: `${eventRules.length}개`,
          hint: '현재 등록된 이벤트 규칙'
        },
        {
          label: '활성 이벤트',
          value: `${activeRuleCount}개`,
          hint: '즉시 테스트 가능한 규칙'
        },
        {
          label: '연결 자산',
          value: `${publishedSmsCount + approvedAlimtalkCount}개`,
          hint: '게시된 SMS + 승인된 알림톡 템플릿'
        }
      ]}
      quickLinks={[
        {
          label: '이벤트 테스트',
          href: '/events/test',
          description: '저장된 이벤트를 payload 형태 그대로 테스트합니다.'
        },
        {
          label: 'SMS 템플릿',
          href: '/send/sms/templates',
          description: '이벤트에 연결할 게시용 SMS 템플릿을 관리합니다.'
        },
        {
          label: '알림톡 템플릿',
          href: '/send/alimtalk/templates',
          description: 'APR 승인 상태와 연결 가능한 알림톡 템플릿을 점검합니다.'
        },
        {
          label: 'SMS 발신번호 관리',
          href: '/send/sms/sender-numbers',
          description: '이벤트에 연결할 SMS 번호의 승인 상태와 제출 서류 기준을 확인합니다.'
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
          <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
          <div>
            이벤트 키는 외부 서비스가 직접 호출하는 계약 포인트입니다. 운영 중인 키를 수정하기보다는 새 키를 추가하고 전환하는 흐름이 더 안전합니다.
          </div>
        </div>
      </div>

      <EventRuleBuilderCard
        eventRuleForm={eventRuleForm}
        setEventRuleForm={setEventRuleForm}
        setEventRuleChannelStrategy={setEventRuleChannelStrategy}
        selectEventRuleSmsTemplate={selectEventRuleSmsTemplate}
        selectEventRuleAlimtalkTemplate={selectEventRuleAlimtalkTemplate}
        smsTemplates={smsTemplates}
        approvedSenderNumbers={approvedSenderNumbers}
        alimtalkProviders={alimtalkProviders}
        senderProfilesWithStatus={senderProfilesWithStatus}
        focusSenderProfileCenter={focusSenderProfileCenter}
        upsertRule={upsertRule}
        eventRules={eventRules}
      />
    </EventPageShell>
  );
}
