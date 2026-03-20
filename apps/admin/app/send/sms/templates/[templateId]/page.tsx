'use client';

import { FileText } from 'lucide-react';
import { useParams } from 'next/navigation';
import { LoginRequiredState, SessionPendingState, TenantAdminRequiredState } from '@/components/access-state';
import { SendPageShell } from '@/components/send-page-shell';
import { SmsTemplateEditorForm } from '@/components/sms-template-editor-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdminDashboard } from '@/hooks/use-admin-dashboard';

export default function SmsTemplateDetailPage() {
  const params = useParams<{ templateId: string }>();
  const {
    me,
    error,
    loading,

    templates
  } = useAdminDashboard();

  const template =
    params?.templateId
      ? templates.find((item) => item.channel === 'SMS' && item.id === params.templateId) ?? null
      : null;

  if (loading && !me) {
    return (
      <SessionPendingState
        title="SMS 템플릿 편집"
        description="편집 권한과 템플릿 정보를 확인하고 있습니다."
      />
    );
  }

  if (!me) {
    return (
      <LoginRequiredState
        title="SMS 템플릿 편집"
        description="템플릿 편집 화면입니다. 먼저 사업자 계정으로 로그인해야 템플릿을 수정할 수 있습니다."
        nextPath={params?.templateId ? `/send/sms/templates/${params.templateId}` : '/send/sms/templates'}
        error={error}
      />
    );
  }

  if (me.role === 'OPERATOR') {
    return (
      <TenantAdminRequiredState
        title="사업자 계정이 필요합니다"
        description="운영자 계정은 내부 심사 도구 전용입니다. SMS 템플릿 편집은 `TENANT_ADMIN` 세션에서만 사용할 수 있습니다."
        message="로그인 페이지에서 사업자 계정으로 다시 인증한 뒤 이 페이지를 사용하세요."
        nextPath={params?.templateId ? `/send/sms/templates/${params.templateId}` : '/send/sms/templates'}
      />
    );
  }

  if (!params?.templateId || loading) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle>템플릿 불러오는 중</CardTitle>
          <CardDescription>저장된 SMS 템플릿 정보를 가져오고 있습니다.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!template) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle>템플릿을 찾을 수 없습니다</CardTitle>
          <CardDescription>삭제되었거나 현재 tenant에서 접근할 수 없는 SMS 템플릿입니다.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <SendPageShell
      icon={FileText}
      badge="Edit SMS Template"
      title={template.name}
      description="리스트에서 선택한 SMS 템플릿을 별도 편집 화면에서 수정합니다. 제목, 본문, 변수 칩, 상태 전환을 한 곳에서 처리할 수 있습니다."
      stats={[
        {
          label: '상태',
          value: template.status,
          hint: '현재 템플릿 상태'
        },
        {
          label: '변수',
          value: `${template.requiredVariables.length}개`,
          hint: '저장된 변수 개수'
        },
        {
          label: '최근 수정',
          value: new Date(template.updatedAt).toLocaleDateString('ko-KR'),
          hint: '마지막 변경일'
        }
      ]}
      quickLinks={[
        {
          label: '템플릿 목록',
          href: '/send/sms/templates',
          description: '다른 SMS 템플릿 목록으로 돌아갑니다.'
        },
        {
          label: 'SMS 보내기',
          href: '/send/sms/single',
          description: '수동 발송 화면으로 이동합니다.'
        },
        {
          label: '이벤트 만들기',
          href: '/events/create',
          description: '게시 후 이벤트(API) 규칙 연결 상태를 확인합니다.'
        }
      ]}
    >
      <SmsTemplateEditorForm mode="edit" template={template} />
    </SendPageShell>
  );
}
