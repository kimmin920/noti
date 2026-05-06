"use client";

import { ActionList, ActionMenu, ThemeProvider } from "@primer/react";
import { useEffect, useState } from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import { SkeletonStatGrid, SkeletonTableBox } from "@/components/loading/PageSkeleton";
import { KakaoTemplateCreateModal } from "@/components/templates/KakaoTemplateCreateModal";
import { FormSelect } from "@/components/ui/FormSelect";
import { NodeLinkCanvas, type NodeLinkEdge, type NodeLinkNode } from "@/components/ui/NodeLinkCanvas";
import {
  fetchV2Events,
  fetchV2KakaoTemplates,
  fetchV2PublEvents,
  type V2CreateKakaoTemplateResponse,
  type V2EventsResponse,
  type V2KakaoTemplatesResponse,
  type V2PublEventItem,
  upsertV2PublEventKakaoBinding,
} from "@/lib/api/v2";
import { useAppStore } from "@/lib/store/app-store";

type EventsPageProps = {
  canManageEvents: boolean;
  canManagePublEvents: boolean;
  data: V2EventsResponse | null;
  loading?: boolean;
  error?: string | null;
};

type EventRuleItem = V2EventsResponse["items"][number];
type KakaoCatalogTemplateOption = V2KakaoTemplatesResponse["items"][number];
type KakaoSenderProfileOption = V2EventsResponse["options"]["kakaoSenderProfiles"][number];

export function EventsPage({ canManageEvents, canManagePublEvents, data, loading, error }: EventsPageProps) {
  const showDraftToast = useAppStore((state) => state.showDraftToast);
  const [eventsData, setEventsData] = useState<V2EventsResponse | null>(data);
  const [publEvents, setPublEvents] = useState<V2PublEventItem[]>([]);
  const [publEventsLoading, setPublEventsLoading] = useState(false);
  const [publEventsError, setPublEventsError] = useState<string | null>(null);
  const [kakaoTemplatesData, setKakaoTemplatesData] = useState<V2KakaoTemplatesResponse | null>(null);
  const [kakaoTemplatesLoading, setKakaoTemplatesLoading] = useState(false);
  const [kakaoTemplatesError, setKakaoTemplatesError] = useState<string | null>(null);
  const [kakaoComposerOpen, setKakaoComposerOpen] = useState(false);
  const [kakaoComposerEvent, setKakaoComposerEvent] = useState<V2PublEventItem | null>(null);
  const [kakaoBindingEvent, setKakaoBindingEvent] = useState<V2PublEventItem | null>(null);
  const [kakaoBindingTemplateId, setKakaoBindingTemplateId] = useState("");
  const [kakaoBindingSenderProfileId, setKakaoBindingSenderProfileId] = useState("");
  const [kakaoBindingSubmitting, setKakaoBindingSubmitting] = useState(false);
  const [kakaoBindingError, setKakaoBindingError] = useState<string | null>(null);
  const [senderProfileSavingEventKey, setSenderProfileSavingEventKey] = useState<string | null>(null);

  useEffect(() => {
    setEventsData(data);
  }, [data]);

  useEffect(() => {
    if (!canManagePublEvents) {
      setPublEvents([]);
      setPublEventsError(null);
      return;
    }

    let cancelled = false;
    setPublEventsLoading(true);
    setPublEventsError(null);

    fetchV2PublEvents()
      .then((response) => {
        if (!cancelled) {
          setPublEvents(response.items);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setPublEventsError(caught instanceof Error ? caught.message : "Publ 이벤트를 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPublEventsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canManagePublEvents]);

  useEffect(() => {
    if (!canManagePublEvents) {
      setKakaoTemplatesData(null);
      setKakaoTemplatesError(null);
      return;
    }

    void loadKakaoTemplateOptions();
  }, [canManagePublEvents]);

  async function loadKakaoTemplateOptions() {
    setKakaoTemplatesLoading(true);
    setKakaoTemplatesError(null);
    try {
      const response = await fetchV2KakaoTemplates();
      setKakaoTemplatesData(response);
      return response;
    } catch (caught) {
      setKakaoTemplatesError(caught instanceof Error ? caught.message : "알림톡 템플릿 정보를 불러오지 못했습니다.");
      return null;
    } finally {
      setKakaoTemplatesLoading(false);
    }
  }

  async function refreshEventsData() {
    const response = await fetchV2Events();
    setEventsData(response);
    return response;
  }

  async function openKakaoTemplateCreateModal(event: V2PublEventItem) {
    if (!hasApprovedDefaultTemplateConfigured(event)) {
      showDraftToast("승인된 기본 템플릿이 있어야 자동화를 활성화할 수 있습니다.", { tone: "error" });
      return;
    }

    const templateData = kakaoTemplatesData ?? (kakaoTemplatesLoading ? null : await loadKakaoTemplateOptions());
    const automationTargets = (templateData?.registrationTargets ?? []).filter((item) => Boolean(item.senderProfileId));

    if (templateData && automationTargets.length === 0) {
      showDraftToast("이 이벤트에 연결할 수 있는 카카오 채널이 없습니다. 연결된 채널을 먼저 확인해 주세요.", {
        tone: "error",
      });
      return;
    }

    setKakaoComposerEvent(event);
    setKakaoComposerOpen(true);
  }

  function handleKakaoTemplateCreated(response: V2CreateKakaoTemplateResponse) {
    const sourceEvent = kakaoComposerEvent;
    setKakaoComposerOpen(false);
    setKakaoComposerEvent(null);
    void finalizeKakaoTemplateCreation(response, sourceEvent);
  }

  function closeKakaoTemplateCreateModal() {
    setKakaoComposerOpen(false);
    setKakaoComposerEvent(null);
  }

  async function openKakaoTemplateBindingModal(event: V2PublEventItem) {
    if (!hasApprovedDefaultTemplateConfigured(event)) {
      showDraftToast("승인된 기본 템플릿이 있어야 자동화를 활성화할 수 있습니다.", { tone: "error" });
      return;
    }

    let sourceData = eventsData;

    try {
      sourceData = await refreshEventsData();
    } catch {
      // Keep the current state if the refresh fails; the submit path will surface precise errors.
    }

    const templateData = kakaoTemplatesData ?? (await loadKakaoTemplateOptions());
    const templateOptions = getApprovedKakaoCatalogTemplateOptions(templateData);
    const senderProfileOptions = getActiveKakaoSenderProfileOptions(sourceData);
    const compatibleTemplateOptions = getCompatibleKakaoCatalogTemplateOptions(templateOptions, event);

    if (templateOptions.length === 0) {
      showDraftToast("템플릿관리에 연결할 수 있는 승인 알림톡 템플릿이 없습니다.", { tone: "error" });
      return;
    }

    if (compatibleTemplateOptions.length === 0) {
      showDraftToast("호환되는 승인 알림톡 템플릿이 없습니다. 새 템플릿을 만들어 연결해 주세요.", {
        tone: "error",
      });
      return;
    }

    if (senderProfileOptions.length === 0) {
      showDraftToast("이벤트에 연결할 수 있는 활성 카카오 채널이 없습니다.", { tone: "error" });
      return;
    }

    const linkedRule = sourceData?.items.find((item) => item.eventKey === event.eventKey) ?? null;
    const linkedTemplateId = findLinkedKakaoCatalogTemplateId(compatibleTemplateOptions, linkedRule);
    const linkedSenderProfileId = linkedRule?.kakao?.senderProfileId ?? "";

    setKakaoBindingEvent(event);
    setKakaoBindingTemplateId(
      linkedTemplateId && compatibleTemplateOptions.some((item) => item.id === linkedTemplateId)
        ? linkedTemplateId
        : compatibleTemplateOptions[0]?.id ?? ""
    );
    setKakaoBindingSenderProfileId(
      senderProfileOptions.some((item) => item.id === linkedSenderProfileId)
        ? linkedSenderProfileId
        : senderProfileOptions[0]?.id ?? ""
    );
    setKakaoBindingError(null);
  }

  function closeKakaoTemplateBindingModal() {
    if (kakaoBindingSubmitting) {
      return;
    }

    setKakaoBindingEvent(null);
    setKakaoBindingTemplateId("");
    setKakaoBindingSenderProfileId("");
    setKakaoBindingError(null);
  }

  async function changeWorkflowSenderProfile(
    event: V2PublEventItem,
    linkedRule: EventRuleItem | null,
    senderProfileId: string
  ) {
    if (!hasApprovedDefaultTemplateConfigured(event)) {
      showDraftToast("승인된 기본 템플릿이 있어야 카카오 채널을 연결할 수 있습니다.", { tone: "error" });
      return;
    }

    if (!senderProfileId) {
      showDraftToast("연결할 카카오 채널을 선택해 주세요.", { tone: "error" });
      return;
    }

    const isCustomBinding = linkedRule?.kakao?.templateBindingMode === "CUSTOM" && Boolean(linkedRule.kakao.providerTemplateId);
    setSenderProfileSavingEventKey(event.eventKey);

    try {
      const binding = await upsertV2PublEventKakaoBinding({
        eventKey: event.eventKey,
        ...(isCustomBinding
          ? { providerTemplateId: linkedRule!.kakao!.providerTemplateId! }
          : { templateBindingMode: "DEFAULT" as const }),
        senderProfileId,
      });

      setEventsData((current) => mergeEventRuleItem(current, binding.item));

      try {
        await refreshEventsData();
      } catch {
        // Keep the merged state if the background refresh fails.
      }

      showDraftToast(`${event.displayName} 이벤트의 카카오 채널을 변경했습니다.`, { tone: "success" });
    } catch (caught) {
      showDraftToast(caught instanceof Error ? caught.message : "카카오 채널 변경에 실패했습니다.", { tone: "error" });
    } finally {
      setSenderProfileSavingEventKey(null);
    }
  }

  async function submitKakaoTemplateBinding() {
    if (!kakaoBindingEvent) {
      return;
    }

    if (!kakaoBindingTemplateId || !kakaoBindingSenderProfileId) {
      setKakaoBindingError("템플릿과 카카오 채널을 선택해 주세요.");
      return;
    }

    const templateData = kakaoTemplatesData ?? (await loadKakaoTemplateOptions());
    const compatibleTemplateOptions = getCompatibleKakaoCatalogTemplateOptions(
      getApprovedKakaoCatalogTemplateOptions(templateData),
      kakaoBindingEvent
    );

    if (!compatibleTemplateOptions.some((item) => item.id === kakaoBindingTemplateId)) {
      setKakaoBindingError("호환되는 승인 템플릿을 선택해 주세요.");
      return;
    }

    setKakaoBindingSubmitting(true);
    setKakaoBindingError(null);

    try {
      const previousRule = eventsData?.items.find((item) => item.eventKey === kakaoBindingEvent.eventKey) ?? null;
      const binding = await upsertV2PublEventKakaoBinding({
        eventKey: kakaoBindingEvent.eventKey,
        kakaoTemplateCatalogId: kakaoBindingTemplateId,
        senderProfileId: kakaoBindingSenderProfileId,
      });

      setEventsData((current) => mergeEventRuleItem(current, binding.item));

      try {
        await refreshEventsData();
      } catch {
        // Keep the merged state if the background refresh fails.
      }

      showDraftToast(
        `${kakaoBindingEvent.displayName} 이벤트의 알림톡 템플릿을 ${previousRule?.kakao ? "변경했습니다" : "연결했습니다"}.`,
        { tone: "success" }
      );
      setKakaoBindingEvent(null);
      setKakaoBindingTemplateId("");
      setKakaoBindingSenderProfileId("");
    } catch (caught) {
      setKakaoBindingError(caught instanceof Error ? caught.message : "알림톡 템플릿 연결에 실패했습니다.");
    } finally {
      setKakaoBindingSubmitting(false);
    }
  }

  async function finalizeKakaoTemplateCreation(
    response: V2CreateKakaoTemplateResponse,
    sourceEvent: V2PublEventItem | null
  ) {
    await loadKakaoTemplateOptions();

    if (!sourceEvent) {
      showDraftToast(`${response.target.label} 대상으로 알림톡 템플릿 검수 요청을 보냈습니다.`, { tone: "success" });
      return;
    }

    if (!response.target.senderProfileId) {
      showDraftToast(
        `알림톡 템플릿 검수 요청은 접수했지만, ${sourceEvent.displayName} 이벤트에 연결할 카카오 채널 정보를 찾지 못했습니다.`,
        { tone: "error" }
      );
      return;
    }

    try {
      const binding = await upsertV2PublEventKakaoBinding({
        eventKey: sourceEvent.eventKey,
        providerTemplateId: response.template.providerTemplateId,
        senderProfileId: response.target.senderProfileId,
      });

      setEventsData((current) => mergeEventRuleItem(current, binding.item));

      try {
        await refreshEventsData();
      } catch {
        // Keep the merged state if the background refresh fails.
      }

      showDraftToast(
        `${sourceEvent.displayName} 이벤트에 템플릿을 연결했습니다. 현재 상태: ${connectedTemplateStatusText(binding.item.kakao?.providerStatus)}`,
        { tone: "success" }
      );
    } catch (caught) {
      showDraftToast(
        `알림톡 템플릿 검수 요청은 접수했지만 ${sourceEvent.displayName} 이벤트 연결에는 실패했습니다. ${caught instanceof Error ? caught.message : ""}`.trim(),
        { tone: "error" }
      );
    }
  }

  if (!canManageEvents) {
    return (
      <>
        <div className="page-header">
          <div className="page-header-row">
            <div>
              <div className="page-title">알림톡 자동화</div>
              <div className="page-desc">협업 운영자 전용 알림톡 자동화 설정 화면입니다</div>
            </div>
          </div>
        </div>

        <div className="box">
          <div className="empty-state">
            <div className="empty-icon">
              <AppIcon name="zap" className="icon icon-40" />
            </div>
            <div className="empty-title">접근 권한이 없습니다</div>
            <div className="empty-desc">알림톡 자동화는 협업 운영자 계정에서만 설정할 수 있습니다.</div>
          </div>
        </div>
      </>
    );
  }

  const items = eventsData?.items ?? [];
  const showLoadingNotice = Boolean(loading && !eventsData);
  const eventRuleByKey = new Map(items.map((item) => [item.eventKey, item]));
  const activePublEvents = publEvents.filter((item) => item.serviceStatus === "ACTIVE");
  const publEventByKey = new Map(publEvents.map((item) => [item.eventKey, item]));
  const eventAutomationTargets = (kakaoTemplatesData?.registrationTargets ?? []).filter((item) => Boolean(item.senderProfileId));
  const canCreateEventTemplate = kakaoTemplatesData === null || kakaoTemplatesLoading || eventAutomationTargets.length > 0;
  const approvedKakaoTemplateOptions = getApprovedKakaoCatalogTemplateOptions(kakaoTemplatesData);
  const activeKakaoSenderProfileOptions = getActiveKakaoSenderProfileOptions(eventsData);
  const compatibleKakaoBindingTemplateOptions = kakaoBindingEvent
    ? getCompatibleKakaoCatalogTemplateOptions(approvedKakaoTemplateOptions, kakaoBindingEvent)
    : [];
  const canConnectExistingKakaoTemplate = Boolean(eventsData);

  if (showLoadingNotice) {
    return (
      <>
        <div className="page-header">
          <div className="page-header-row">
            <div>
              <div className="page-title">알림톡 자동화</div>
              <div className="page-desc">이벤트 기반 알림톡 자동화와 템플릿 연결을 관리합니다</div>
            </div>
            <button className="btn btn-accent" disabled>
              <AppIcon name="plus" className="icon icon-14" />
              규칙 만들기
            </button>
          </div>
        </div>

        <div className="dash-row dash-row-3" style={{ marginBottom: 16 }}>
          <SkeletonStatGrid columns={3} />
        </div>
        <SkeletonTableBox titleWidth={110} rows={4} columns={["1.5fr", "1.2fr", "1fr", "1.6fr", "1.8fr", "90px", "64px"]} />
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <div className="page-title">알림톡 자동화</div>
            <div className="page-desc">이벤트 기반 알림톡 자동화와 템플릿 연결을 관리합니다</div>
          </div>
          <button className="btn btn-accent">
            <AppIcon name="plus" className="icon icon-14" />
            규칙 만들기
          </button>
        </div>
      </div>

      {error ? (
        <div className="flash flash-attention">
          <AppIcon name="warn" className="icon icon-16 flash-icon" />
          <div className="flash-body">{error}</div>
        </div>
      ) : null}

      {canManagePublEvents && kakaoTemplatesError ? (
        <div className="flash flash-attention">
          <AppIcon name="warn" className="icon icon-16 flash-icon" />
          <div className="flash-body">{kakaoTemplatesError}</div>
        </div>
      ) : null}

      <div className="dash-row dash-row-3" style={{ marginBottom: 16 }}>
        <div className="box" style={{ marginBottom: 0 }}>
          <div className="box-body" style={{ padding: "14px 16px" }}>
            <div className="flex items-center gap-8" style={{ marginBottom: 4 }}>
              <AppIcon name="zap" className="icon icon-16" style={{ color: "var(--accent-fg)" }} />
              <span className="text-small text-muted">Automation</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{activePublEvents.length}개 이벤트 사용 가능</div>
            <div className="text-small text-muted mt-8">전체 {eventsData?.counts.totalCount ?? 0}개 규칙</div>
          </div>
        </div>
        <div className="box" style={{ marginBottom: 0 }}>
          <div className="box-body" style={{ padding: "14px 16px" }}>
            <div className="flex items-center gap-8" style={{ marginBottom: 4 }}>
              <AppIcon name="sms" className="icon icon-16" style={{ color: "var(--success-fg)" }} />
              <span className="text-small text-muted">SMS Readiness</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{smsReadinessText(eventsData?.readiness.resourceState.sms)}</div>
            <div className="text-small text-muted mt-8">발신번호 {eventsData?.readiness.sms.approvedCount ?? 0}개 사용 가능</div>
          </div>
        </div>
        <div className="box" style={{ marginBottom: 0 }}>
          <div className="box-body" style={{ padding: "14px 16px" }}>
            <div className="flex items-center gap-8" style={{ marginBottom: 4 }}>
              <AppIcon name="kakao" className="icon icon-16" style={{ color: "var(--done-fg)" }} />
              <span className="text-small text-muted">Kakao Readiness</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{kakaoReadinessText(eventsData?.readiness.resourceState.kakao)}</div>
            <div className="text-small text-muted mt-8">채널 {eventsData?.readiness.kakao.activeCount ?? 0}개 연결됨</div>
          </div>
        </div>
      </div>

      {canManagePublEvents ? (
        <div className="box">
          <div className="box-header">
            <div>
              <div className="box-title">Publ 이벤트 연결</div>
              <div className="box-subtitle">활성 Publ 이벤트마다 이벤트 노드와 알림톡 템플릿 노드를 연결해서 봅니다</div>
            </div>
            <span className="label label-blue">{activePublEvents.length}개 활성</span>
          </div>
          <div className="box-body event-rule-workflow-body">
            {publEventsLoading ? (
              <div className="text-small text-muted">Publ 이벤트를 불러오는 중입니다.</div>
            ) : publEventsError ? (
              <div className="flash flash-attention" style={{ marginBottom: 0 }}>
                <AppIcon name="warn" className="icon icon-16 flash-icon" />
                <div className="flash-body">{publEventsError}</div>
              </div>
            ) : activePublEvents.length > 0 ? (
              <div className="event-rule-workflow-list">
                {activePublEvents.map((event) => {
                  const linkedRule = eventRuleByKey.get(event.eventKey) ?? null;

                  return (
                    <NodeLinkCanvas
                      key={event.id}
                      nodes={buildWorkflowNodes(event, linkedRule, activeKakaoSenderProfileOptions)}
                      edges={buildWorkflowEdges(linkedRule, event, activeKakaoSenderProfileOptions)}
                      height={320}
                      className="event-rule-workflow-canvas"
                      renderNode={(node) =>
                        renderWorkflowNode({
                          node,
                          event,
                          linkedRule,
                          canCreateTemplate: canCreateEventTemplate,
                          onCreateTemplate: () => void openKakaoTemplateCreateModal(event),
                          canConnectTemplate: canConnectExistingKakaoTemplate,
                          onConnectTemplate: () => void openKakaoTemplateBindingModal(event),
                          senderProfiles: activeKakaoSenderProfileOptions,
                          senderProfileSaving: senderProfileSavingEventKey === event.eventKey,
                          onSenderProfileChange: (senderProfileId) =>
                            void changeWorkflowSenderProfile(event, linkedRule, senderProfileId),
                        })
                      }
                    />
                  );
                })}
              </div>
            ) : (
              <div className="empty-state compact">
                <div className="empty-title">활성 Publ 이벤트가 없습니다</div>
                <div className="empty-desc">Publ 이벤트 카탈로그에서 활성 상태인 이벤트가 여기에 표시됩니다.</div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <div className="box">
        <div className="box-header">
          <div className="box-title">활성 알림톡 자동화</div>
        </div>
        {items.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>이벤트 키</th>
                  <th>전략</th>
                  <th>채널</th>
                  <th>기본 템플릿</th>
                  <th>연결 템플릿</th>
                  <th>업데이트</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="table-title-text">{item.displayName}</div>
                      <code className="td-mono td-muted">{item.eventKey}</code>
                    </td>
                    <td className="td-muted">
                      <span className="flex items-center gap-8">
                        <AppIcon
                          name={item.channelStrategy === "ALIMTALK_THEN_SMS" ? "merge" : "send"}
                          className="icon icon-12"
                          style={{ color: "var(--fg-muted)" }}
                        />
                        {channelStrategyText(item.channelStrategy)}
                      </span>
                    </td>
                    <td>{renderChannelOrder(item)}</td>
                    <td className="publ-default-template-cell">{defaultTemplatePreview(publEventByKey.get(item.eventKey))}</td>
                    <td className="td-muted">{connectedTemplateText(item)}</td>
                    <td className="td-muted text-small">{formatShortDateTime(item.updatedAt)}</td>
                    <td>
                      <button className="btn btn-default btn-sm">편집</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">
              <AppIcon name="zap" className="icon icon-40" />
            </div>
            <div className="empty-title">등록된 알림톡 자동화가 없습니다</div>
            <div className="empty-desc">규칙을 만들면 외부 이벤트를 받아 SMS 또는 알림톡을 자동 발송할 수 있습니다.</div>
          </div>
        )}
      </div>

      {kakaoComposerOpen ? (
        <KakaoTemplateCreateModal
          open={kakaoComposerOpen}
          registrationTargets={eventAutomationTargets}
          categories={kakaoTemplatesData?.categories ?? []}
          sourceEvent={kakaoComposerEvent}
          onClose={closeKakaoTemplateCreateModal}
          onCreated={handleKakaoTemplateCreated}
        />
      ) : null}

      {kakaoBindingEvent ? (
        <KakaoTemplateBindingModal
          event={kakaoBindingEvent}
          linkedRule={eventRuleByKey.get(kakaoBindingEvent.eventKey) ?? null}
          templates={compatibleKakaoBindingTemplateOptions}
          senderProfiles={activeKakaoSenderProfileOptions}
          selectedTemplateId={kakaoBindingTemplateId}
          selectedSenderProfileId={kakaoBindingSenderProfileId}
          submitting={kakaoBindingSubmitting}
          error={kakaoBindingError}
          onTemplateChange={(value) => {
            setKakaoBindingTemplateId(value);
            setKakaoBindingError(null);
          }}
          onSenderProfileChange={(value) => {
            setKakaoBindingSenderProfileId(value);
            setKakaoBindingError(null);
          }}
          onClose={closeKakaoTemplateBindingModal}
          onSubmit={() => void submitKakaoTemplateBinding()}
        />
      ) : null}
    </>
  );
}

function buildWorkflowNodes(
  item: V2PublEventItem,
  linkedRule: V2EventsResponse["items"][number] | null,
  senderProfiles: KakaoSenderProfileOption[]
): NodeLinkNode[] {
  const canvasHeight = 320;
  const nodeHeight = 248;
  const templateStatus = resolveWorkflowTemplateStatus(linkedRule, item, senderProfiles);
  const hasDefaultTemplate = hasApprovedDefaultTemplateConfigured(item);
  const defaultTemplateLabel = defaultTemplateText(item);
  const edgeColor = templateEdgeColor(linkedRule, item, senderProfiles);

  return [
    {
      id: "event",
      x: 16,
      y: (canvasHeight - nodeHeight) / 2,
      anchorX: "left",
      label: item.displayName,
      meta: item.eventKey,
      description: item.detailText || item.triggerText || item.category,
      status: "success",
      portRight: true,
      portRightColor: edgeColor,
      width: 380,
    },
    {
      id: "template",
      x: 16,
      y: (canvasHeight - nodeHeight) / 2,
      anchorX: "right",
      label: "알림톡 템플릿",
      meta: linkedRule?.kakao?.templateName || (hasDefaultTemplate ? defaultTemplateLabel : "") || "연결된 템플릿 없음",
      description: linkedRule?.kakao
        ? connectedTemplateStatusText(linkedRule.kakao.providerStatus, linkedRule.kakao.templateBindingMode)
        : hasDefaultTemplate
          ? "기본 템플릿 사용 가능"
          : "기본 템플릿 없음",
      status: templateStatus,
      portLeft: true,
      portLeftColor: edgeColor,
      width: 340,
    },
  ];
}

function buildWorkflowEdges(
  linkedRule: V2EventsResponse["items"][number] | null,
  event: V2PublEventItem,
  senderProfiles: KakaoSenderProfileOption[]
): NodeLinkEdge[] {
  const status = resolveWorkflowTemplateStatus(linkedRule, event, senderProfiles);
  return [
    {
      id: "event-to-template",
      source: "event",
      target: "template",
      color: templateEdgeColor(linkedRule, event, senderProfiles),
      dashed: status !== "success",
    },
  ];
}

function renderWorkflowNode({
  node,
  event,
  linkedRule,
  canCreateTemplate,
  onCreateTemplate,
  canConnectTemplate,
  onConnectTemplate,
  senderProfiles,
  senderProfileSaving,
  onSenderProfileChange,
}: {
  node: NodeLinkNode;
  event: V2PublEventItem;
  linkedRule: EventRuleItem | null;
  canCreateTemplate: boolean;
  onCreateTemplate: () => void;
  canConnectTemplate: boolean;
  onConnectTemplate: () => void;
  senderProfiles: KakaoSenderProfileOption[];
  senderProfileSaving: boolean;
  onSenderProfileChange: (senderProfileId: string) => void;
}) {
  if (node.id === "event") {
    return (
      <div className="node-link-node event-rule-graph-node event">
        <span className="event-rule-graph-main">
          <span className="event-rule-graph-title">{node.label}</span>
          <code className="event-rule-graph-key" title={typeof node.meta === "string" ? node.meta : undefined}>{node.meta}</code>
          <span className="event-rule-graph-desc">{node.description}</span>
        </span>
        <span className="event-rule-provider-logo" aria-label="Publ">
          <img src="/assets/publ-logo.png" alt="" />
        </span>
        <span className="event-rule-card-actions">
          <a className="btn btn-default btn-sm" href={`/publ-events/${encodeURIComponent(event.eventKey)}?from=events`}>상세보기</a>
        </span>
      </div>
    );
  }

  const hasLinkedKakaoTemplate = Boolean(linkedRule?.kakao);
  const hasConfiguredDefaultTemplate = hasDefaultTemplateConfigured(event);
  const hasDefaultTemplate = hasApprovedDefaultTemplateConfigured(event);
  const defaultSenderProfileId = senderProfiles.find((item) => item.isDefault)?.id ?? senderProfiles[0]?.id ?? "";
  const selectedSenderProfileId = linkedRule?.kakao?.senderProfileId ?? defaultSenderProfileId;
  const statusText = linkedRule?.kakao
    ? connectedTemplateStatusText(linkedRule.kakao.providerStatus, linkedRule.kakao.templateBindingMode)
    : isImplicitDefaultWorkflowReady(event, senderProfiles)
      ? "기본 템플릿 사용"
      : hasDefaultTemplate
        ? "발송 카카오채널 없음"
        : "기본 템플릿 없음";
  const statusClass = linkedRule?.kakao
    ? connectedTemplateStatusClass(linkedRule.kakao.providerStatus)
    : isImplicitDefaultWorkflowReady(event, senderProfiles)
      ? "label-green"
      : "label-gray";
  const senderProfileBlockedMessage = !hasDefaultTemplate
    ? "승인된 기본 템플릿이 있어야 발송 카카오채널을 선택할 수 있습니다."
    : senderProfiles.length === 0
      ? "발송 카카오채널이 연결되어 있지 않습니다."
      : null;

  return (
    <div className="node-link-node event-rule-graph-node template">
      <span className={`node-link-status ${resolveWorkflowTemplateStatus(linkedRule, event, senderProfiles)}`}>
        <AppIcon name="template" className="icon icon-14" />
      </span>
      <span className="event-rule-graph-main">
        <span className="event-rule-graph-title">{node.label}</span>
        <span className="event-rule-graph-muted" title={typeof node.meta === "string" ? node.meta : undefined}>{node.meta}</span>
        <span className={`label ${statusClass} event-rule-template-status`}>
          <span className="label-dot" />
          {statusText}
        </span>
        <KakaoSenderProfilePicker
          senderProfiles={senderProfiles}
          selectedSenderProfileId={selectedSenderProfileId}
          disabled={Boolean(senderProfileBlockedMessage)}
          blockedMessage={senderProfileBlockedMessage}
          saving={senderProfileSaving}
          onChange={onSenderProfileChange}
        />
        <span className="event-rule-template-actions">
          <button
            type="button"
            className={`btn ${hasLinkedKakaoTemplate ? "btn-default" : "btn-accent"} btn-sm`}
            onClick={onCreateTemplate}
            disabled={!canCreateTemplate || !hasDefaultTemplate}
          >
            {hasLinkedKakaoTemplate
              ? "새 템플릿 만들기"
              : hasDefaultTemplate
                ? "템플릿 만들기"
                : hasConfiguredDefaultTemplate
                  ? "승인 필요"
                  : "기본 템플릿 없음"}
          </button>
          <button
            type="button"
            className={`btn ${hasLinkedKakaoTemplate ? "btn-accent" : "btn-default"} btn-sm`}
            onClick={onConnectTemplate}
            disabled={!canConnectTemplate || !hasDefaultTemplate}
          >
            {hasLinkedKakaoTemplate ? "템플릿 변경" : hasDefaultTemplate ? "다른 템플릿 선택" : "활성화 불가"}
          </button>
        </span>
      </span>
    </div>
  );
}

function KakaoSenderProfilePicker({
  senderProfiles,
  selectedSenderProfileId,
  disabled,
  blockedMessage,
  saving,
  onChange,
}: {
  senderProfiles: KakaoSenderProfileOption[];
  selectedSenderProfileId: string;
  disabled: boolean;
  blockedMessage: string | null;
  saving: boolean;
  onChange: (senderProfileId: string) => void;
}) {
  const selectedSenderProfile = senderProfiles.find((item) => item.id === selectedSenderProfileId) ?? null;
  const buttonText = saving
    ? "변경 중..."
    : selectedSenderProfile?.plusFriendId || (senderProfiles.length > 0 ? "카카오채널 선택" : "연결된 채널 없음");
  const metaText = saving
    ? "변경 중입니다."
    : blockedMessage ||
      (senderProfiles.length === 0 ? "발송 카카오채널이 연결되어 있지 않습니다." : "");

  return (
    <div className="event-rule-channel-field">
      <span className="event-rule-channel-label">발송 카카오채널</span>
      <ThemeProvider colorMode="light" dayScheme="light" preventSSRMismatch>
        <ActionMenu>
          <ActionMenu.Button
            block
            size="small"
            alignContent="start"
            className="event-rule-channel-button"
            aria-label="발송 카카오채널 선택"
            disabled={disabled || saving}
            loading={saving}
          >
            {buttonText}
          </ActionMenu.Button>
          <ActionMenu.Overlay className="event-rule-channel-overlay" width="medium" maxHeight="small">
            <ActionList selectionVariant="single" role="menu" aria-label="발송 카카오채널">
              {senderProfiles.map((senderProfile) => {
                const selected = senderProfile.id === selectedSenderProfileId;

                return (
                  <ActionList.Item
                    key={senderProfile.id}
                    role="menuitemradio"
                    selected={selected}
                    aria-checked={selected}
                    onSelect={() => {
                      if (!selected) {
                        onChange(senderProfile.id);
                      }
                    }}
                  >
                    {senderProfile.plusFriendId}
                    {senderProfile.isDefault ? (
                      <ActionList.Description variant="block">기본 발송 카카오채널</ActionList.Description>
                    ) : null}
                  </ActionList.Item>
                );
              })}
            </ActionList>
          </ActionMenu.Overlay>
        </ActionMenu>
      </ThemeProvider>
      {metaText ? (
        <span className={`event-rule-channel-meta ${blockedMessage || !selectedSenderProfile ? "warning" : ""}`}>
          {metaText}
        </span>
      ) : null}
    </div>
  );
}

function KakaoTemplateBindingModal({
  event,
  linkedRule,
  templates,
  senderProfiles,
  selectedTemplateId,
  selectedSenderProfileId,
  submitting,
  error,
  onTemplateChange,
  onSenderProfileChange,
  onClose,
  onSubmit,
}: {
  event: V2PublEventItem;
  linkedRule: EventRuleItem | null;
  templates: KakaoCatalogTemplateOption[];
  senderProfiles: KakaoSenderProfileOption[];
  selectedTemplateId: string;
  selectedSenderProfileId: string;
  submitting: boolean;
  error: string | null;
  onTemplateChange: (value: string) => void;
  onSenderProfileChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const selectedTemplate = templates.find((item) => item.id === selectedTemplateId) ?? null;
  const selectedSenderProfile = senderProfiles.find((item) => item.id === selectedSenderProfileId) ?? null;
  const hasLinkedKakaoTemplate = Boolean(linkedRule?.kakao);
  const modalTitle = hasLinkedKakaoTemplate ? "알림톡 템플릿 변경" : "기존 알림톡 템플릿 연결";
  const primaryLabel = hasLinkedKakaoTemplate ? "변경하기" : "연결하기";

  return (
    <div className="modal-backdrop open" onClick={submitting ? undefined : onClose}>
      <div
        className="modal kakao-binding-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kakao-binding-title"
        onClick={(modalEvent) => modalEvent.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title" id="kakao-binding-title">
            <AppIcon name="kakao" className="icon icon-16" />
            {modalTitle}
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="닫기" disabled={submitting}>
            <AppIcon name="x" className="icon icon-18" />
          </button>
        </div>
        <div className="modal-body">
          <div className="flash flash-info" style={{ marginBottom: 16 }}>
            <AppIcon name="zap" className="icon icon-16 flash-icon" />
            <div className="flash-body">
              <div style={{ fontWeight: 600 }}>{event.displayName}</div>
              <code className="td-mono td-muted">{event.eventKey}</code>
            </div>
          </div>

          {error ? (
            <div className="flash flash-attention" role="alert" aria-live="polite" style={{ marginBottom: 16 }}>
              <AppIcon name="warn" className="icon icon-16 flash-icon" />
              <div className="flash-body">{error}</div>
            </div>
          ) : null}

          <div className="form-group">
            <label className="form-label" htmlFor="kakao-binding-template">
              호환되는 승인 템플릿
            </label>
            <FormSelect
              id="kakao-binding-template"
              className="form-control"
              value={selectedTemplateId}
              onChange={(selectEvent) => onTemplateChange(selectEvent.target.value)}
              disabled={submitting}
            >
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {formatKakaoTemplateOption(template)}
                </option>
              ))}
            </FormSelect>
            {selectedTemplate ? <KakaoTemplateBindingPreview template={selectedTemplate} /> : null}
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="kakao-binding-sender-profile">
              발송 카카오채널
            </label>
            <FormSelect
              id="kakao-binding-sender-profile"
              className="form-control"
              value={selectedSenderProfileId}
              onChange={(selectEvent) => onSenderProfileChange(selectEvent.target.value)}
              disabled={submitting}
            >
              {senderProfiles.map((senderProfile) => (
                <option key={senderProfile.id} value={senderProfile.id}>
                  {formatSenderProfileOption(senderProfile)}
                </option>
              ))}
            </FormSelect>
            {selectedSenderProfile?.isDefault ? <div className="form-hint">기본 발송 카카오채널</div> : null}
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-default" onClick={onClose} disabled={submitting}>
            취소
          </button>
          <button
            type="button"
            className="btn btn-accent"
            onClick={onSubmit}
            disabled={submitting || !selectedTemplateId || !selectedSenderProfileId}
          >
            {submitting ? (hasLinkedKakaoTemplate ? "변경 중..." : "연결 중...") : primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function KakaoTemplateBindingPreview({ template }: { template: KakaoCatalogTemplateOption }) {
  return (
    <div className="kakao-binding-preview" aria-label="선택한 템플릿 본문">
      <div className="kakao-binding-preview-label">본문 미리보기</div>
      <pre className="kakao-binding-preview-body">{template.body || "본문 없음"}</pre>
    </div>
  );
}

function smsReadinessText(status?: "none" | "pending" | "supplement" | "rejected" | "active") {
  if (status === "active") return "발송 가능";
  if (status === "pending") return "심사 중";
  if (status === "supplement") return "서류 보완 필요";
  if (status === "rejected") return "재신청 필요";
  return "등록 필요";
}

function kakaoReadinessText(status?: "none" | "active") {
  if (status === "active") return "발송 가능";
  return "연결 필요";
}

function getApprovedKakaoCatalogTemplateOptions(data: V2KakaoTemplatesResponse | null): KakaoCatalogTemplateOption[] {
  return (data?.items ?? []).filter((item) => item.providerStatus === "APR");
}

function getActiveKakaoSenderProfileOptions(data: V2EventsResponse | null): KakaoSenderProfileOption[] {
  return (data?.options.kakaoSenderProfiles ?? [])
    .filter((item) => item.status === "ACTIVE")
    .sort((left, right) => {
      if (left.isDefault !== right.isDefault) {
        return left.isDefault ? -1 : 1;
      }

      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });
}

function getCompatibleKakaoCatalogTemplateOptions(
  templates: KakaoCatalogTemplateOption[],
  event: V2PublEventItem
): KakaoCatalogTemplateOption[] {
  const eventVariables = getPublEventVariableSet(event);
  return templates.filter((template) =>
    getKakaoCatalogRequiredVariables(template).every((variable) => eventVariables.has(variable.trim()))
  );
}

function getPublEventVariableSet(event: V2PublEventItem) {
  const variables = new Set<string>();

  for (const prop of event.props) {
    if (!prop.enabled) {
      continue;
    }

    for (const candidate of [prop.alias, prop.labelVariable || labelToTemplateVariable(prop.label)]) {
      const normalized = candidate?.trim();
      if (normalized) {
        variables.add(normalized);
      }
    }
  }

  return variables;
}

function findLinkedKakaoCatalogTemplateId(
  templates: KakaoCatalogTemplateOption[],
  linkedRule: EventRuleItem | null
) {
  const linkedCodes = new Set(
    [linkedRule?.kakao?.kakaoTemplateCode, linkedRule?.kakao?.templateCode].filter(Boolean) as string[]
  );

  if (linkedCodes.size === 0) {
    return "";
  }

  return (
    templates.find((template) =>
      [template.kakaoTemplateCode, template.templateCode].some((code) => code && linkedCodes.has(code))
    )?.id ?? ""
  );
}

function formatKakaoTemplateOption(template: KakaoCatalogTemplateOption) {
  const code = template.kakaoTemplateCode || template.templateCode;
  const label = code ? `${template.name} (${code})` : template.name;
  return template.ownerLabel ? `${label} · ${template.ownerLabel}` : label;
}

function getKakaoCatalogRequiredVariables(template: KakaoCatalogTemplateOption) {
  if (!Array.isArray(template.requiredVariables)) {
    return [];
  }

  return template.requiredVariables.map((item) => String(item || "").trim()).filter(Boolean);
}

function formatSenderProfileOption(senderProfile: KakaoSenderProfileOption) {
  return senderProfile.isDefault ? `${senderProfile.plusFriendId} · 기본` : senderProfile.plusFriendId;
}

function labelToTemplateVariable(value: string | null | undefined) {
  return String(value || "")
    .replace(/\s+/g, "")
    .trim();
}

function channelStrategyText(strategy: string) {
  if (strategy === "ALIMTALK_THEN_SMS") return "Fallback";
  if (strategy === "ALIMTALK_ONLY") return "알림톡만";
  return "SMS만";
}

function resolveConnectedTemplateStatus(item: V2EventsResponse["items"][number] | null) {
  if (!item?.kakao) return "neutral" as const;
  if (item.kakao.providerStatus === "APR") return "success" as const;
  if (item.kakao.providerStatus === "REJ") return "danger" as const;
  return "pending" as const;
}

function resolveWorkflowTemplateStatus(
  item: V2EventsResponse["items"][number] | null,
  event: V2PublEventItem,
  senderProfiles: KakaoSenderProfileOption[]
) {
  if (item?.kakao) {
    return resolveConnectedTemplateStatus(item);
  }

  if (isImplicitDefaultWorkflowReady(event, senderProfiles)) {
    return "success" as const;
  }

  return "neutral" as const;
}

function connectedTemplateStatusText(providerStatus?: string | null, templateBindingMode?: "DEFAULT" | "CUSTOM" | null) {
  if (providerStatus === "APR") return templateBindingMode === "DEFAULT" ? "기본 템플릿 사용" : "승인됨 + 연결됨";
  if (providerStatus === "REJ") return "반려됨";
  if (providerStatus === "REQ" || providerStatus === "REG") return "검수중";
  return "연결된 템플릿 없음";
}

function connectedTemplateStatusClass(providerStatus?: string | null) {
  if (providerStatus === "APR") return "label-green";
  if (providerStatus === "REJ") return "label-red";
  if (providerStatus === "REQ" || providerStatus === "REG") return "label-blue";
  return "label-gray";
}

function templateEdgeColor(
  item: V2EventsResponse["items"][number] | null,
  event?: V2PublEventItem,
  senderProfiles: KakaoSenderProfileOption[] = []
) {
  if (!item?.kakao) {
    return event && isImplicitDefaultWorkflowReady(event, senderProfiles)
      ? "var(--success-emphasis)"
      : "var(--fg-subtle)";
  }
  if (item.kakao.providerStatus === "APR") return "var(--success-emphasis)";
  if (item.kakao.providerStatus === "REJ") return "var(--danger-emphasis)";
  return "var(--accent-emphasis)";
}

function connectedTemplateText(item: V2EventsResponse["items"][number]) {
  const tokens = [];

  if (item.kakao) {
    tokens.push(`${item.kakao.templateBindingMode === "DEFAULT" ? "기본" : "알림톡"}: ${item.kakao.templateName}`);
  }

  if (item.sms) {
    tokens.push(`SMS: ${item.sms.templateName}`);
  }

  return tokens.length > 0 ? tokens.join(" / ") : "미연결";
}

function defaultTemplateText(item?: V2PublEventItem | null) {
  if (!item || !hasDefaultTemplateConfigured(item)) {
    return "";
  }

  return item.defaultTemplateName || item.defaultTemplateCode || item.defaultKakaoTemplateCode || "기본 템플릿";
}

function defaultTemplatePreview(item?: V2PublEventItem | null) {
  if (!item || !hasDefaultTemplateConfigured(item)) {
    return <span className="td-muted">없음</span>;
  }

  const label = defaultTemplateText(item);
  return (
    <span className="publ-default-template-preview" title={item.defaultTemplateBody || label}>
      {label}
    </span>
  );
}

function hasDefaultTemplateConfigured(item: V2PublEventItem) {
  return Boolean(item.defaultTemplateName || item.defaultTemplateCode || item.defaultKakaoTemplateCode || item.defaultTemplateBody);
}

function hasApprovedDefaultTemplateConfigured(item: V2PublEventItem) {
  return hasDefaultTemplateConfigured(item) && item.defaultTemplateStatus === "APR";
}

function isImplicitDefaultWorkflowReady(event: V2PublEventItem, senderProfiles: KakaoSenderProfileOption[]) {
  return hasApprovedDefaultTemplateConfigured(event) && senderProfiles.length > 0;
}

function renderChannelOrder(item: V2EventsResponse["items"][number]) {
  if (item.kakao && item.sms && item.channelStrategy === "ALIMTALK_THEN_SMS") {
    return (
      <span className="flex items-center gap-8">
        <span className="chip chip-kakao">알림톡</span>
        <AppIcon name="chevron-right" className="icon icon-12" style={{ color: "var(--fg-subtle)" }} />
        <span className="chip chip-sms">SMS</span>
      </span>
    );
  }

  if (item.kakao) {
    return <span className="chip chip-kakao">알림톡</span>;
  }

  if (item.sms) {
    return <span className="chip chip-sms">SMS</span>;
  }

  return <span className="td-muted">—</span>;
}

function mergeEventRuleItem(
  current: V2EventsResponse | null,
  item: V2EventsResponse["items"][number]
): V2EventsResponse | null {
  if (!current) {
    return current;
  }

  const existingIndex = current.items.findIndex((entry) => entry.id === item.id || entry.eventKey === item.eventKey);
  const nextItems =
    existingIndex === -1
      ? [item, ...current.items]
      : current.items.map((entry, index) => (index === existingIndex ? item : entry));

  return {
    ...current,
    counts: {
      totalCount: nextItems.length,
      enabledCount: nextItems.filter((entry) => entry.enabled).length,
    },
    items: nextItems,
  };
}

function formatShortDateTime(value: string) {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}
