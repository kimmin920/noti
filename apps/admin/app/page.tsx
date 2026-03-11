'use client';

import { useAdminDashboard } from '@/hooks/use-admin-dashboard';
import { AuthSection } from '@/components/auth-section';
import { TemplateSection } from '@/components/template-section';
import { EventRuleSection } from '@/components/event-rule-section';
import { DirectSendSection } from '@/components/direct-send-section';
import { SenderSection } from '@/components/sender-section';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Page() {
  const {
    me,
    error,
    loading,
    refreshAll,

    // Auth
    localLoginId, setLocalLoginId,
    localPassword, setLocalPassword,
    loginWithPassword,
    ssoToken, setSsoToken,
    exchangeSso,
    startGoogleLogin,
    publServiceToken, setPublServiceToken,

    // Templates
    alimtalkTemplateLibrary,
    defaultGroupTemplates,
    templates,
    filteredAlimtalkTemplateLibrary,
    templateLibrarySearch, setTemplateLibrarySearch,
    selectedTemplateLibraryKey, setSelectedTemplateLibraryKey,
    selectedAlimtalkTemplate,
    showTemplateComposer, setShowTemplateComposer,
    templateForm, setTemplateForm,
    createTemplate,
    updateTemplate,
    previewTemplate,
    syncTemplate,

    // Event Rules
    eventRuleForm, setEventRuleForm,
    smsTemplates,
    alimtalkProviders,
    senderProfilesWithStatus,
    focusSenderProfileCenter,
    upsertRule,
    sendSample,
    eventRules,

    // Direct Send
    approvedSenderNumbers,
    manualSmsForm, setManualSmsForm,
    sendingManualSms,
    sendDirectSms,
    readySenderProfiles,
    manualAlimtalkForm, setManualAlimtalkForm,
    directAlimtalkTemplateOptions,
    selectedDirectAlimtalkTemplate,
    manualAlimtalkVariables, setManualAlimtalkVariables,
    sendingManualAlimtalk,
    sendDirectAlimtalk,

    // Senders & Logs
    senderNumbers,
    nhnRegisteredSenders,
    syncApprovedNumbers,
    senderForm, setSenderForm,
    setTelecomFile,
    setEmploymentFile,
    applySenderNumber,
    activeSenderProfiles,
    pendingSenderProfiles,
    blockedSenderProfiles,
    senderProfileForm, setSenderProfileForm,
    senderProfileCategoryOptions,
    applyingSenderProfile,
    applySenderProfile,
    senderProfileTokenForm, setSenderProfileTokenForm,
    verifyingSenderProfile,
    verifySenderProfileToken,
    syncingGroupSenderKeys,
    syncSenderToDefaultGroup,
    logs
  } = useAdminDashboard();

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">서비스 운영 현황</h1>
          <p className="text-muted-foreground mt-1">Publ 내부 머시징 서비스 통합 관리 대시보드</p>
        </div>
        <Button variant="outline" onClick={refreshAll} disabled={loading} className="rounded-xl">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          데이터 갱신
        </Button>
      </header>

      <section id="auth">
        <AuthSection
          me={me}
          error={error}
          localLoginId={localLoginId}
          setLocalLoginId={setLocalLoginId}
          localPassword={localPassword}
          setLocalPassword={setLocalPassword}
          loginWithPassword={loginWithPassword}
          ssoToken={ssoToken}
          setSsoToken={setSsoToken}
          exchangeSso={exchangeSso}
          startGoogleLogin={startGoogleLogin}
          publServiceToken={publServiceToken}
          setPublServiceToken={setPublServiceToken}
          isOperator={me?.role === 'OPERATOR'}
        />
      </section>

      {!me || me.role === 'OPERATOR' ? null : (
        <>
          <section id="templates">
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
          </section>

          <section id="event-rules">
            <EventRuleSection
              eventRuleForm={eventRuleForm}
              setEventRuleForm={setEventRuleForm}
              smsTemplates={smsTemplates}
              alimtalkProviders={alimtalkProviders}
              senderProfilesWithStatus={senderProfilesWithStatus}
              focusSenderProfileCenter={focusSenderProfileCenter}
              upsertRule={upsertRule}
              sendSample={sendSample}
              eventRules={eventRules}
            />
          </section>

          <section id="direct-send">
            <DirectSendSection
              approvedSenderNumbers={approvedSenderNumbers}
              manualSmsForm={manualSmsForm}
              setManualSmsForm={setManualSmsForm}
              sendingManualSms={sendingManualSms}
              sendDirectSms={sendDirectSms}
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
          </section>

          <section id="senders">
            <SenderSection
              senderNumbers={senderNumbers}
              nhnRegisteredSenders={nhnRegisteredSenders}
              syncApprovedNumbers={syncApprovedNumbers}
              senderForm={senderForm}
              setSenderForm={setSenderForm}
              setTelecomFile={setTelecomFile}
              setEmploymentFile={setEmploymentFile}
              applySenderNumber={applySenderNumber}
              activeSenderProfiles={activeSenderProfiles}
              pendingSenderProfiles={pendingSenderProfiles}
              blockedSenderProfiles={blockedSenderProfiles}
              senderProfileForm={senderProfileForm}
              setSenderProfileForm={setSenderProfileForm}
              senderProfileCategoryOptions={senderProfileCategoryOptions}
              applyingSenderProfile={applyingSenderProfile}
              applySenderProfile={applySenderProfile}
              senderProfileTokenForm={senderProfileTokenForm}
              setSenderProfileTokenForm={setSenderProfileTokenForm}
              verifyingSenderProfile={verifyingSenderProfile}
              verifySenderProfileToken={verifySenderProfileToken}
              syncingGroupSenderKeys={syncingGroupSenderKeys}
              syncSenderToDefaultGroup={syncSenderToDefaultGroup}
              logs={logs}
            />
          </section>

          <div id="logs" className="h-1" />
        </>
      )}
    </div>
  );
}
