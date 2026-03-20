'use client';

import { FileText } from 'lucide-react';
import { LoginRequiredState, SessionPendingState, TenantAdminRequiredState } from '@/components/access-state';
import { SendPageShell } from '@/components/send-page-shell';
import { SmsTemplateList } from '@/components/sms-template-list';
import { useAdminDashboard } from '@/hooks/use-admin-dashboard';

export default function SmsTemplatesPage() {
  const {
    me,
    error,
    setError,
    refreshAll,
    loading,

    templates
  } = useAdminDashboard();

  const smsTemplates = templates.filter((template) => template.channel === 'SMS');
  const publishedCount = smsTemplates.filter((template) => template.status === 'PUBLISHED').length;
  const archivedCount = smsTemplates.filter((template) => template.status === 'ARCHIVED').length;

  if (loading && !me) {
    return (
      <SessionPendingState
        title="SMS 템플릿"
        description="템플릿 스튜디오 접근 권한과 저장된 SMS 템플릿을 확인하고 있습니다."
      />
    );
  }

  if (!me) {
    return (
      <LoginRequiredState
        title="SMS 템플릿"
        description="SMS 템플릿 관리 페이지입니다. 먼저 사업자 계정으로 로그인해야 템플릿을 편집할 수 있습니다."
        nextPath="/send/sms/templates"
        error={error}
      />
    );
  }

  if (me.role === 'OPERATOR') {
    return (
      <TenantAdminRequiredState
        title="사업자 계정이 필요합니다"
        description="운영자 계정은 내부 심사 도구 전용입니다. SMS 템플릿 관리는 `TENANT_ADMIN` 세션에서만 사용할 수 있습니다."
        message="로그인 페이지에서 사업자 계정으로 다시 인증한 뒤 이 페이지를 사용하세요."
        nextPath="/send/sms/templates"
      />
    );
  }

  return (
    <SendPageShell
      icon={FileText}
      badge="SMS Template Studio"
      title="SMS 템플릿"
      description="제목이 있는 SMS 템플릿을 전용 에디터에서 관리합니다. `#{변수}`를 본문에서 바로 칩으로 다루고, 저장과 게시를 한 흐름에서 처리할 수 있습니다."
      stats={[
        {
          label: '전체 템플릿',
          value: `${smsTemplates.length}개`,
          hint: '등록된 SMS 템플릿 총량'
        },
        {
          label: '게시됨',
          value: `${publishedCount}개`,
          hint: '이벤트 규칙에 바로 연결 가능한 상태'
        },
        {
          label: '보관됨',
          value: `${archivedCount}개`,
          hint: '삭제 대신 보관 처리된 템플릿'
        }
      ]}
      quickLinks={[
        {
          label: 'SMS 보내기',
          href: '/send/sms/single',
          description: '직접 발송 화면으로 돌아가 발신번호와 수신번호를 입력합니다.'
        },
        {
          label: '이벤트 만들기',
          href: '/events/create',
          description: '게시된 SMS 템플릿을 이벤트(API) 규칙에 연결합니다.'
        },
        {
          label: 'SMS 발신번호 관리',
          href: '/send/sms/sender-numbers',
          description: '실제 발송에 사용할 승인된 SMS 발신번호를 점검합니다.'
        }
      ]}
    >
      {error && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <SmsTemplateList
        templates={templates}
        loading={loading}
        onRefresh={refreshAll}
        setGlobalError={setError}
      />
    </SendPageShell>
  );
}
