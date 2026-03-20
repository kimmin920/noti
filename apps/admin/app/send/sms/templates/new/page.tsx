'use client';

import { FilePlus2 } from 'lucide-react';
import { LoginRequiredState, SessionPendingState, TenantAdminRequiredState } from '@/components/access-state';
import { SendPageShell } from '@/components/send-page-shell';
import { SmsTemplateEditorForm } from '@/components/sms-template-editor-form';
import { useAdminDashboard } from '@/hooks/use-admin-dashboard';

export default function NewSmsTemplatePage() {
  const {
    me,
    error,
    loading
  } = useAdminDashboard();

  if (loading && !me) {
    return (
      <SessionPendingState
        title="새 SMS 템플릿"
        description="템플릿 작성 권한과 현재 세션을 확인하고 있습니다."
      />
    );
  }

  if (!me) {
    return (
      <LoginRequiredState
        title="새 SMS 템플릿"
        description="템플릿 작성 화면입니다. 먼저 사업자 계정으로 로그인해야 템플릿을 만들 수 있습니다."
        nextPath="/send/sms/templates/new"
        error={error}
      />
    );
  }

  if (me.role === 'OPERATOR') {
    return (
      <TenantAdminRequiredState
        title="사업자 계정이 필요합니다"
        description="운영자 계정은 내부 심사 도구 전용입니다. SMS 템플릿 작성은 `TENANT_ADMIN` 세션에서만 사용할 수 있습니다."
        message="로그인 페이지에서 사업자 계정으로 다시 인증한 뒤 이 페이지를 사용하세요."
        nextPath="/send/sms/templates/new"
      />
    );
  }

  return (
    <SendPageShell
      icon={FilePlus2}
      badge="New SMS Template"
      title="새 SMS 템플릿"
      description="목록 화면에서 분리된 전용 작성 화면입니다. 제목, 변수 칩, 본문을 한 번에 구성하고 저장 또는 게시까지 끝낼 수 있습니다."
      stats={[
        {
          label: '작성 모드',
          value: 'Create',
          hint: '새 템플릿 생성'
        },
        {
          label: '저장 형식',
          value: '#{...}',
          hint: '변수 토큰 저장 포맷'
        },
        {
          label: '연결 대상',
          value: 'SMS',
          hint: '문자 발송 전용 템플릿'
        }
      ]}
      quickLinks={[
        {
          label: '템플릿 목록',
          href: '/send/sms/templates',
          description: '기존 SMS 템플릿 목록과 상태를 확인합니다.'
        },
        {
          label: 'SMS 보내기',
          href: '/send/sms/single',
          description: '수동 발송 화면으로 돌아갑니다.'
        },
        {
          label: '이벤트 만들기',
          href: '/events/create',
          description: '게시 후 이벤트(API) 규칙에 연결할 수 있습니다.'
        }
      ]}
    >
      <SmsTemplateEditorForm mode="create" />
    </SendPageShell>
  );
}
