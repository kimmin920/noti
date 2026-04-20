'use client';

import { FileText } from 'lucide-react';
import { LoginRequiredState, SessionPendingState, TenantAdminRequiredState } from '@/components/access-state';
import { SendPageShell } from '@/components/send-page-shell';
import { TemplateSection } from '@/components/template-section';
import { useAdminDashboard } from '@/hooks/use-admin-dashboard';

export default function AlimtalkTemplatesPage() {
  const {
    me,
    error,
    loading,
    templates,
    alimtalkTemplateLibrary,
    defaultGroupTemplates,
    filteredAlimtalkTemplateLibrary,
    templateLibrarySearch,
    setTemplateLibrarySearch,
    selectedTemplateLibraryKey,
    setSelectedTemplateLibraryKey,
    selectedAlimtalkTemplate,
    showTemplateComposer,
    setShowTemplateComposer,
    templateForm,
    setTemplateForm,
    createTemplate,
    updateTemplate,
    previewTemplate,
    syncTemplate
  } = useAdminDashboard();

  const localAlimtalkTemplates = templates.filter((template) => template.channel === 'ALIMTALK');
  const approvedAlimtalkTemplates = localAlimtalkTemplates.filter((template) =>
    template.providerTemplates?.some((providerTemplate) => providerTemplate.providerStatus === 'APR')
  );

  if (loading && !me) {
    return (
      <SessionPendingState
        title="알림톡 템플릿"
        description="알림톡 템플릿 라이브러리와 현재 세션 권한을 확인하고 있습니다."
      />
    );
  }

  if (!me) {
    return (
      <LoginRequiredState
        title="알림톡 템플릿"
        description="승인된 알림톡 템플릿과 기본 그룹 템플릿을 관리하는 전용 페이지입니다."
        nextPath="/send/alimtalk/templates"
        error={error}
      />
    );
  }

  if (me.role === 'OPERATOR') {
    return (
      <TenantAdminRequiredState
        title="사업자 계정이 필요합니다"
        description="운영자 계정은 내부 심사 도구 전용입니다. 알림톡 템플릿 관리는 `USER` 세션에서만 사용할 수 있습니다."
        message="로그인 페이지에서 사업자 계정으로 다시 인증한 뒤 이 페이지를 사용하세요."
        nextPath="/send/alimtalk/templates"
      />
    );
  }

  return (
    <SendPageShell
      icon={FileText}
      badge="AlimTalk Template Library"
      title="알림톡 템플릿"
      description="개별 채널 템플릿과 기본 그룹 템플릿을 한 화면에서 보고, 승인 상태를 점검하고, 새 알림톡 템플릿을 등록합니다."
      stats={[
        {
          label: '전체 템플릿',
          value: `${alimtalkTemplateLibrary.length}개`,
          hint: '개별 + 기본 그룹 템플릿'
        },
        {
          label: '개별 템플릿',
          value: `${localAlimtalkTemplates.length}개`,
          hint: '현재 테넌트에 등록된 알림톡 템플릿'
        },
        {
          label: 'APR 승인',
          value: `${approvedAlimtalkTemplates.length}개`,
          hint: '직접 발송에 바로 사용할 수 있는 승인 템플릿'
        }
      ]}
      quickLinks={[
        {
          label: '단일 알림톡 보내기',
          href: '/send/alimtalk/single',
          description: '한 명에게 즉시 보내는 알림톡 발송 화면입니다.'
        },
        {
          label: '대량 알림톡 보내기',
          href: '/send/alimtalk/bulk',
          description: '유저를 선택해 승인된 템플릿으로 한 번에 발송합니다.'
        },
        {
          label: '카카오 채널 관리',
          href: '/send/alimtalk/channels',
          description: '카카오 채널 상태와 기본 그룹 동기화 여부를 확인합니다.'
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

      <TemplateSection
        alimtalkTemplateLibrary={alimtalkTemplateLibrary}
        defaultGroupTemplates={defaultGroupTemplates}
        templates={templates}
        filteredAlimtalkTemplateLibrary={filteredAlimtalkTemplateLibrary}
        templateLibrarySearch={templateLibrarySearch}
        setTemplateLibrarySearch={setTemplateLibrarySearch}
        selectedTemplateLibraryKey={selectedTemplateLibraryKey}
        setSelectedTemplateLibraryKey={setSelectedTemplateLibraryKey}
        selectedAlimtalkTemplate={selectedAlimtalkTemplate}
        showTemplateComposer={showTemplateComposer}
        setShowTemplateComposer={setShowTemplateComposer}
        templateForm={templateForm}
        setTemplateForm={setTemplateForm}
        createTemplate={createTemplate}
        updateTemplate={updateTemplate}
        previewTemplate={previewTemplate}
        syncTemplate={syncTemplate}
      />
    </SendPageShell>
  );
}
