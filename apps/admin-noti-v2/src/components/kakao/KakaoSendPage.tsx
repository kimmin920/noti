"use client";

import { useMemo, useState } from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import {
  createV2KakaoRequest,
  fetchV2KakaoSendOptions,
  fetchV2KakaoSendReadiness,
  type V2KakaoSendOptionsResponse,
  type V2KakaoSendReadinessResponse,
} from "@/lib/api/v2";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";
import { useRouteNavigate } from "@/lib/hooks/use-route-navigate";
import { useAppStore } from "@/lib/store/app-store";

const kakaoSendPageCache: {
  readiness: V2KakaoSendReadinessResponse | null;
  options: V2KakaoSendOptionsResponse | null;
} = {
  readiness: null,
  options: null,
};

function renderPreviewText(text: string, variables: Record<string, string>) {
  return text.split(/(#[{][^}]+[}])/g).map((part, index) => {
    const match = part.match(/^#\{(.+)\}$/);
    if (!match) return <span key={`${part}-${index}`}>{part}</span>;
    const value = variables[match[1]];
    return value ? (
      <span key={`${part}-${index}`}>{value}</span>
    ) : (
      <span key={`${part}-${index}`} className="preview-rich-inline-token">
        {part}
      </span>
    );
  });
}

export function KakaoSendPage({
  initialData,
}: {
  initialData?: {
    readiness: V2KakaoSendReadinessResponse | null;
    options: V2KakaoSendOptionsResponse | null;
  };
}) {
  const composer = useAppStore((state) => state.kakaoComposer);
  const setKakaoComposer = useAppStore((state) => state.setKakaoComposer);
  const saveKakaoDraft = useAppStore((state) => state.saveKakaoDraft);
  const resetKakaoComposer = useAppStore((state) => state.resetKakaoComposer);
  const showDraftToast = useAppStore((state) => state.showDraftToast);
  const navigate = useRouteNavigate();
  const [readiness, setReadiness] = useState<V2KakaoSendReadinessResponse | null>(() => initialData?.readiness ?? kakaoSendPageCache.readiness);
  const [options, setOptions] = useState<V2KakaoSendOptionsResponse | null>(() => initialData?.options ?? kakaoSendPageCache.options);
  const [loading, setLoading] = useState(() => !(initialData?.readiness ?? kakaoSendPageCache.readiness));
  const [error, setError] = useState<string | null>(null);
  const [selectedSenderProfileId, setSelectedSenderProfileId] = useState("");
  const [selectedFallbackSenderId, setSelectedFallbackSenderId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useMountEffect(() => {
    if (initialData?.readiness) {
      kakaoSendPageCache.readiness = initialData.readiness;
      kakaoSendPageCache.options = initialData.options ?? null;
      setReadiness(initialData.readiness);
      setOptions(initialData.options ?? null);

      const nextSenderProfileId = initialData.options?.senderProfiles[0]?.id ?? "";
      const nextFallbackSenderId = initialData.options?.fallbackSenderNumbers[0]?.id ?? "";
      const nextSenderProfile = initialData.options?.senderProfiles[0] ?? null;
      const nextTemplates = nextSenderProfile
        ? (initialData.options?.templates ?? []).filter(
            (item) => item.source === "DEFAULT_GROUP" || item.ownerKey === nextSenderProfile.senderKey
          )
        : [];
      const nextTemplate = nextTemplates.find((item) => item.id === composer.selectedTemplate) ?? nextTemplates[0] ?? null;

      setSelectedSenderProfileId((current) => current || nextSenderProfileId);
      setSelectedFallbackSenderId((current) => current || nextFallbackSenderId);
      setKakaoComposer({
        selectedTemplate: nextTemplate?.id ?? "",
        variables: nextTemplate
          ? buildTemplateVariables(
              nextTemplate.template.body,
              nextTemplate.template.requiredVariables,
              composer.variables,
            )
          : {},
      });
      setLoading(false);
      return;
    }

    let cancelled = false;
    const hasCachedData = Boolean(kakaoSendPageCache.readiness);

    const load = async () => {
      if (!hasCachedData) {
        setLoading(true);
      }
      setError(null);

      try {
        const nextReadiness = await fetchV2KakaoSendReadiness();
        if (cancelled) return;

        kakaoSendPageCache.readiness = nextReadiness;
        setReadiness(nextReadiness);

        if (!nextReadiness.ready) {
          kakaoSendPageCache.options = null;
          setOptions(null);
          return;
        }

        const nextOptions = await fetchV2KakaoSendOptions();
        if (cancelled) return;

        kakaoSendPageCache.options = nextOptions;
        setOptions(nextOptions);
        const nextSenderProfileId = nextOptions.senderProfiles[0]?.id ?? "";
        const nextFallbackSenderId = nextOptions.fallbackSenderNumbers[0]?.id ?? "";
        const nextSenderProfile = nextOptions.senderProfiles[0] ?? null;
        const nextTemplates = nextSenderProfile
          ? nextOptions.templates.filter(
              (item) => item.source === "DEFAULT_GROUP" || item.ownerKey === nextSenderProfile.senderKey
            )
          : [];
        const nextTemplate = nextTemplates.find((item) => item.id === composer.selectedTemplate) ?? nextTemplates[0] ?? null;

        setSelectedSenderProfileId((current) => current || nextSenderProfileId);
        setSelectedFallbackSenderId((current) => current || nextFallbackSenderId);
        setKakaoComposer({
          selectedTemplate: nextTemplate?.id ?? "",
          variables: nextTemplate
            ? buildTemplateVariables(
                nextTemplate.template.body,
                nextTemplate.template.requiredVariables,
                composer.variables,
              )
            : {},
        });
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "알림톡 발송 정보를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  });

  const selectedSenderProfile =
    options?.senderProfiles.find((item) => item.id === selectedSenderProfileId) ?? options?.senderProfiles[0] ?? null;
  const availableTemplates = useMemo(() => {
    if (!selectedSenderProfile) {
      return [];
    }

    return (options?.templates ?? []).filter(
      (item) => item.source === "DEFAULT_GROUP" || item.ownerKey === selectedSenderProfile.senderKey
    );
  }, [options?.templates, selectedSenderProfile]);
  const selectedTemplate = availableTemplates.find((item) => item.id === composer.selectedTemplate) ?? null;

  const templateVariables = selectedTemplate
    ? extractTemplateVariables(selectedTemplate.template.body, selectedTemplate.template.requiredVariables)
    : [];

  const previewNodes = useMemo(() => {
    if (!selectedTemplate) return null;
    return renderPreviewText(selectedTemplate.template.body, composer.variables);
  }, [selectedTemplate, composer.variables]);
  const showLoadingOptions = Boolean(loading && readiness?.ready && !options);

  const setTemplate = (value: string) => {
    const nextTemplate = availableTemplates.find((item) => item.id === value) ?? null;
    const nextVariables = nextTemplate
      ? buildTemplateVariables(nextTemplate.template.body, nextTemplate.template.requiredVariables, composer.variables)
      : {};

    setKakaoComposer({
      selectedTemplate: value,
      variables: nextVariables,
    });
  };

  const handleSenderProfileChange = (value: string) => {
    setSelectedSenderProfileId(value);

    const nextSenderProfile = options?.senderProfiles.find((item) => item.id === value) ?? null;
    const nextTemplates = nextSenderProfile
      ? (options?.templates ?? []).filter(
          (item) => item.source === "DEFAULT_GROUP" || item.ownerKey === nextSenderProfile.senderKey
        )
      : [];
    const nextTemplate = nextTemplates.find((item) => item.id === composer.selectedTemplate) ?? nextTemplates[0] ?? null;

    setKakaoComposer({
      selectedTemplate: nextTemplate?.id ?? "",
      variables: nextTemplate
        ? buildTemplateVariables(
            nextTemplate.template.body,
            nextTemplate.template.requiredVariables,
            composer.variables,
          )
        : {},
    });
  };

  const selectedTemplateReady = Boolean(selectedTemplate);

  const handleSubmit = async () => {
    if (!selectedSenderProfile) {
      showDraftToast("발신 채널을 선택해 주세요.");
      return;
    }

    if (!selectedTemplate) {
      showDraftToast("템플릿을 선택해 주세요.");
      return;
    }

    if (!composer.recipientPhone.trim()) {
      showDraftToast("수신번호를 입력해 주세요.");
      return;
    }

    if (composer.fallbackEnabled && !selectedFallbackSenderId) {
      showDraftToast("SMS fallback 발신번호를 선택해 주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await createV2KakaoRequest({
        senderProfileId: selectedSenderProfile.id,
        templateSource: selectedTemplate.source === "DEFAULT_GROUP" ? "GROUP" : "NHN",
        templateCode: selectedTemplate.templateCode || selectedTemplate.kakaoTemplateCode || undefined,
        templateName: selectedTemplate.template.name,
        templateBody: selectedTemplate.template.body,
        requiredVariables: extractTemplateVariables(
          selectedTemplate.template.body,
          selectedTemplate.template.requiredVariables
        ),
        recipientPhone: composer.recipientPhone.trim(),
        useSmsFailover: composer.fallbackEnabled && Boolean(selectedFallbackSenderId),
        fallbackSenderNumberId: composer.fallbackEnabled ? selectedFallbackSenderId : undefined,
        variables: composer.variables,
        scheduledAt: composer.scheduleType === "later" && composer.scheduledAt ? new Date(composer.scheduledAt).toISOString() : undefined,
      });

      resetKakaoComposer();
      showDraftToast(`알림톡 발송 요청이 접수되었습니다. (${response.requestId.slice(0, 8)})`);
      navigate("logs");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "알림톡 발송 요청 접수에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return (
      <>
        <div className="page-header">
          <div className="page-header-row">
            <div>
              <div className="page-title">알림톡 발송</div>
              <div className="page-desc">카카오 비즈메시지를 단건으로 발송합니다</div>
            </div>
          </div>
        </div>
        <div className="flash flash-attention">
          <AppIcon name="warn" className="icon icon-16 flash-icon" />
          <div className="flash-body">{error}</div>
        </div>
      </>
    );
  }

  if (loading && !readiness) {
    return (
      <>
        <div className="page-header">
          <div className="page-header-row">
            <div>
              <div className="page-title">알림톡 발송</div>
              <div className="page-desc">카카오 비즈메시지를 단건으로 발송합니다</div>
            </div>
          </div>
        </div>
        <div className="kakao-layout">
          <div className="loading-disabled-box">
            <div className="box">
              <div className="box-header"><div className="box-title">채널 및 템플릿</div></div>
              <div className="box-body">
                <div className="form-group">
                  <label className="form-label">발신 채널</label>
                  <input className="form-control field-width-md" value="승인된 채널 확인 중" disabled readOnly />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">템플릿 선택</label>
                  <input className="form-control" value="승인된 템플릿 확인 중" disabled readOnly />
                </div>
              </div>
            </div>
            <div className="box">
              <div className="box-header"><div className="box-title">수신 및 변수</div></div>
              <div className="box-body">
                <div className="form-group">
                  <label className="form-label">수신번호</label>
                  <input className="form-control field-width-md" value="" placeholder="수신번호를 입력하세요" disabled readOnly />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">템플릿 변수</label>
                  <input className="form-control" value="" placeholder="템플릿 확인 후 입력 가능" disabled readOnly />
                </div>
              </div>
            </div>
          </div>
          <div className="loading-disabled-box">
            <div className="box">
              <div className="box-header"><div className="box-title">미리보기</div></div>
              <div className="box-body">
                <div className="preview-empty-text">채널과 템플릿 확인 후 미리보기를 활성화합니다.</div>
              </div>
              <div className="box-footer">
                <span className="text-small">준비 중</span>
                <button className="btn btn-kakao" disabled>발송하기</button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (readiness && !readiness.ready) {
    return (
      <>
        <div className="page-header">
          <div className="page-header-row">
            <div>
              <div className="page-title">알림톡 발송</div>
              <div className="page-desc">카카오 비즈메시지를 단건으로 발송합니다</div>
            </div>
          </div>
        </div>
        <div className="flash flash-attention">
          <AppIcon name="warn" className="icon icon-16 flash-icon" />
          <div className="flash-body">{readiness.blockers[0]?.message || "알림톡 발송 준비가 완료되지 않았습니다."}</div>
        </div>
        <div className="box">
          <div className="empty-state">
            <div className="empty-icon" style={{ color: "#c9a700" }}>
              <AppIcon name="kakao" className="icon icon-40" />
            </div>
            <div className="empty-title">연결된 카카오 채널이 필요합니다</div>
            <div className="empty-desc">발신 자원 관리에서 카카오 채널을 연결하면 승인된 알림톡 템플릿을 선택할 수 있습니다.</div>
            <div className="empty-actions">
              <button className="btn btn-kakao" onClick={() => navigate("resources")}>
                발신 자원 관리
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <div className="page-title">알림톡 발송</div>
            <div className="page-desc">카카오 비즈메시지를 단건으로 발송합니다</div>
          </div>
          <button className="btn btn-default" onClick={() => navigate("logs")}>
            발송 이력
          </button>
        </div>
      </div>

      {showLoadingOptions ? <div className="text-small text-muted" style={{ marginBottom: 12 }}>승인된 채널과 템플릿을 불러오는 중입니다.</div> : null}

      <div className="kakao-layout">
        <div>
          <div className="box">
            <div className="box-header"><div className="box-title">채널 및 템플릿</div></div>
            <div className="box-body">
              <div className="form-group">
                <label className="form-label">발신 채널 <span className="text-danger">*</span></label>
                <select
                  className="form-control field-width-md"
                  value={selectedSenderProfile?.id ?? ""}
                  onChange={(event) => handleSenderProfileChange(event.target.value)}
                >
                  {(options?.senderProfiles ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.plusFriendId} ({item.senderProfileType || "채널"})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">템플릿 선택 <span className="text-danger">*</span></label>
                <select
                  className="form-control"
                  value={selectedTemplate?.id ?? ""}
                  onChange={(event) => setTemplate(event.target.value)}
                  disabled={!selectedSenderProfile || availableTemplates.length === 0}
                >
                  <option value="">템플릿을 선택하세요</option>
                  {availableTemplates.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.template.name} · {item.ownerLabel}
                    </option>
                  ))}
                </select>
                <p className="form-hint">
                  기본 그룹과 선택한 채널의 승인된 템플릿만 표시합니다.{" "}
                  <button
                    style={{ background: "none", border: "none", color: "var(--accent-fg)", cursor: "pointer", fontFamily: "inherit", fontSize: 12, padding: 0 }}
                    onClick={() => navigate("templates")}
                  >
                    템플릿 관리 →
                  </button>
                </p>
                {selectedSenderProfile && availableTemplates.length === 0 ? (
                  <p className="form-hint" style={{ color: "var(--attention-fg)" }}>
                    선택한 채널에서 사용할 수 있는 승인된 알림톡 템플릿이 없습니다.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="box">
            <div className="box-header"><div className="box-title">수신자</div></div>
            <div className="box-body">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">수신 전화번호 <span className="text-danger">*</span></label>
                <div className="form-row-inline">
                  <input
                    className="form-control field-width-sm"
                    placeholder="010-0000-0000"
                    value={composer.recipientPhone}
                    onChange={(event) => setKakaoComposer({ recipientPhone: event.target.value })}
                  />
                  <button className="btn btn-default btn-sm">
                    <AppIcon name="users" className="icon icon-14" />
                    수신자 선택
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="box">
            <div className="box-header">
              <div className="box-title">변수 입력</div>
              <span className="text-small text-muted">템플릿의 #{"{변수}"}를 실제 값으로 치환합니다</span>
            </div>
            <div className="box-body">
              {selectedTemplate ? (
                templateVariables.map((variable) => (
                  <div className="form-group" style={{ marginBottom: 12 }} key={variable}>
                    <label className="form-label status-label-sm">#{"{"}{variable}{"}"}</label>
                    <input
                      className="form-control"
                      placeholder={`${variable} 값 입력`}
                      value={composer.variables[variable] || ""}
                      onChange={(event) =>
                        setKakaoComposer({
                          variables: {
                            ...composer.variables,
                            [variable]: event.target.value,
                          },
                        })
                      }
                    />
                  </div>
                ))
              ) : (
                <div style={{ textAlign: "center", padding: "20px 0", color: "var(--fg-muted)", fontSize: 13 }}>
                  템플릿을 선택하면 변수 입력란이 표시됩니다
                </div>
              )}
            </div>
          </div>

          <div className="box">
            <div className="box-header">
              <div className="box-title">SMS Fallback</div>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={composer.fallbackEnabled}
                  onChange={(event) => setKakaoComposer({ fallbackEnabled: event.target.checked })}
                  style={{ accentColor: "var(--accent-emphasis)" }}
                />
                알림톡 실패 시 SMS로 대체 발송
              </label>
            </div>
            {composer.fallbackEnabled ? (
              <div className="box-body" style={{ borderTop: "1px solid var(--border-muted)" }}>
                <div className="flash flash-info" style={{ marginBottom: 12 }}>
                  <AppIcon name="info" className="icon icon-16 flash-icon" />
                  <div className="flash-body text-small">알림톡 발송 실패 시 승인된 SMS 발신번호로 대체 발송할 수 있습니다.</div>
                </div>
                <div className="form-group">
                  <label className="form-label">대체 발신번호</label>
                  <select
                    className="form-control field-width-md"
                    value={selectedFallbackSenderId || options?.fallbackSenderNumbers[0]?.id || ""}
                    onChange={(event) => setSelectedFallbackSenderId(event.target.value)}
                    disabled={(options?.fallbackSenderNumbers ?? []).length === 0}
                  >
                    {(options?.fallbackSenderNumbers ?? []).map((item) => (
                      <option key={item.id} value={item.id}>{item.phoneNumber}</option>
                    ))}
                  </select>
                  <p className="form-hint">승인된 발신번호가 있을 때만 failover를 사용할 수 있습니다.</p>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">SMS 대체 문자</label>
                  <textarea
                    className="form-control"
                    placeholder="SMS Fallback 문자 내용"
                    style={{ minHeight: 80 }}
                    value={composer.fallbackBody}
                    onChange={(event) => setKakaoComposer({ fallbackBody: event.target.value })}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="box">
            <div className="box-header"><div className="box-title">발송 시간</div></div>
            <div className="box-body">
              <div className="sms-schedule-options" style={{ marginBottom: composer.scheduleType === "later" ? 12 : 0 }}>
                <label className="sms-schedule-option">
                  <input
                    type="radio"
                    name="kakaoSched"
                    checked={composer.scheduleType === "now"}
                    onChange={() => setKakaoComposer({ scheduleType: "now" })}
                  />
                  즉시 발송
                </label>
                <label className="sms-schedule-option">
                  <input
                    type="radio"
                    name="kakaoSched"
                    checked={composer.scheduleType === "later"}
                    onChange={() => setKakaoComposer({ scheduleType: "later" })}
                  />
                  예약 발송
                </label>
              </div>
              {composer.scheduleType === "later" ? (
                <input
                  type="datetime-local"
                  className="form-control field-width-md"
                  value={composer.scheduledAt}
                  onChange={(event) => setKakaoComposer({ scheduledAt: event.target.value })}
                />
              ) : null}
            </div>
          </div>

          <div className="sms-action-bar">
            <button className="btn btn-default" onClick={saveKakaoDraft}>임시 저장</button>
            <button className="btn btn-kakao" onClick={handleSubmit} disabled={submitting}>
              <AppIcon name="send" className="icon icon-14" />
              {submitting ? "접수 중..." : "발송하기"}
            </button>
          </div>
        </div>

        <div className="kakao-side-column">
          <div className="box" style={{ marginBottom: 12 }}>
            <div className="box-header"><div className="box-title">미리보기</div><span className="chip chip-kakao">알림톡</span></div>
            <div className="box-body-tight">
              <div className="kakao-preview-phone">
                <div className="kakao-preview-time">오늘 오후 2:30</div>
                <div className="kakao-preview-row">
                  <div className="kakao-preview-avatar">A</div>
                  <div className="kakao-preview-content">
                    <div className="kakao-preview-sender">{selectedSenderProfile?.plusFriendId || "채널 미선택"}</div>
                    <div className="kakao-preview-bubble">
                      {selectedTemplate ? (
                        <div className="kakao-preview-text">{previewNodes}</div>
                      ) : (
                        <div className="preview-empty-text">템플릿을 선택하면<br />미리보기가 표시됩니다</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="box">
            <div className="box-header"><div className="box-title">발송 체크리스트</div></div>
            <div className="box-section-loose">
              <div className="box-row sms-check-row">
                <div className="box-row-title text-small">채널</div>
                <span className={`label ${selectedSenderProfile ? "label-green" : "label-yellow"} status-label-sm`}>
                  <span className="label-dot" />
                  {selectedSenderProfile ? "설정됨" : "미선택"}
                </span>
              </div>
              <div className="box-row sms-check-row">
                <div className="box-row-title text-small">템플릿</div>
                <span className={`label ${selectedTemplateReady ? "label-green" : "label-yellow"} status-label-sm`}>
                  <span className="label-dot" />
                  {selectedTemplateReady ? "선택됨" : "미선택"}
                </span>
              </div>
              <div className="box-row sms-check-row" style={{ borderBottom: "none" }}>
                <div className="box-row-title text-small">수신번호</div>
                <span className={`label ${composer.recipientPhone.trim() ? "label-green" : "label-yellow"} status-label-sm`}>
                  <span className="label-dot" />
                  {composer.recipientPhone.trim() ? "입력됨" : "미입력"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function extractTemplateVariables(body: string, requiredVariables: unknown) {
  if (Array.isArray(requiredVariables)) {
    return requiredVariables.map((item) => String(item)).filter(Boolean);
  }

  const matches = Array.from(body.matchAll(/#\{([^}]+)\}/g)).map((match) => match[1]);
  return Array.from(new Set(matches));
}

function buildTemplateVariables(body: string, requiredVariables: unknown, currentVariables: Record<string, string>) {
  return Object.fromEntries(
    extractTemplateVariables(body, requiredVariables).map((name) => [name, currentVariables[name] || ""])
  );
}
