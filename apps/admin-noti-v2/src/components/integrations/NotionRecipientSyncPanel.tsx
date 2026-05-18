"use client";

import { useCallback, useEffect, useState } from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import {
  buildNotionIntegrationStartUrl,
  fetchNotionDataSources,
  fetchNotionIntegrationStatus,
  syncNotionRecipients,
  type NotionDataSource,
  type NotionIntegrationStatusResponse,
  type NotionRecipientMappings,
} from "@/lib/api/v2";

const NOTION_MAPPING_FIELDS: Array<{
  key: keyof NotionRecipientMappings;
  label: string;
  required?: boolean;
  preferredNames: string[];
  preferredTypes?: string[];
}> = [
  { key: "phone", label: "전화번호", required: true, preferredNames: ["전화번호", "연락처", "휴대폰", "핸드폰", "phone", "mobile"], preferredTypes: ["phone_number"] },
  { key: "name", label: "이름", preferredNames: ["이름", "성명", "고객명", "회원명", "name"], preferredTypes: ["title", "rich_text"] },
  { key: "email", label: "이메일", preferredNames: ["이메일", "email", "mail"], preferredTypes: ["email"] },
  { key: "segment", label: "분류", preferredNames: ["분류", "그룹", "기수", "세그먼트", "segment", "group"], preferredTypes: ["select", "status", "multi_select"] },
  { key: "marketingConsent", label: "마케팅 동의", preferredNames: ["마케팅", "수신동의", "동의", "marketing"], preferredTypes: ["checkbox"] },
];

export function NotionRecipientSyncPanel() {
  const [notionStatus, setNotionStatus] = useState<NotionIntegrationStatusResponse | null>(null);
  const [notionSources, setNotionSources] = useState<NotionDataSource[]>([]);
  const [notionLoading, setNotionLoading] = useState(true);
  const [notionSourcesLoaded, setNotionSourcesLoaded] = useState(false);
  const [notionSourcesLoading, setNotionSourcesLoading] = useState(false);
  const [notionSyncing, setNotionSyncing] = useState(false);
  const [notionError, setNotionError] = useState<string | null>(null);
  const [notionMessage, setNotionMessage] = useState<string | null>(null);
  const [selectedNotionSourceId, setSelectedNotionSourceId] = useState("");
  const [notionMappings, setNotionMappings] = useState<NotionRecipientMappings>({});

  const loadNotionStatus = useCallback(async () => {
    setNotionLoading(true);
    setNotionError(null);

    try {
      const status = await fetchNotionIntegrationStatus();
      setNotionStatus(status);
      setSelectedNotionSourceId(status.connection?.selectedDataSourceId ?? "");
      setNotionMappings(status.connection?.selectedMappings ?? {});
      setNotionSourcesLoaded(false);
    } catch (fetchError) {
      setNotionError(fetchError instanceof Error ? fetchError.message : "Notion 연결 상태를 불러오지 못했습니다.");
    } finally {
      setNotionLoading(false);
    }
  }, []);

  const loadNotionSources = useCallback(async () => {
    setNotionSourcesLoading(true);
    setNotionSourcesLoaded(false);
    setNotionError(null);

    try {
      const result = await fetchNotionDataSources();
      setNotionSources(result.items);
      setNotionSourcesLoaded(true);

      const selectedSource =
        result.items.find((item) => item.id === selectedNotionSourceId) ??
        result.items.find((item) => item.id === notionStatus?.connection?.selectedDataSourceId) ??
        result.items[0];

      if (selectedSource) {
        setSelectedNotionSourceId(selectedSource.id);
        setNotionMappings((current) => ({
          ...inferNotionMappings(selectedSource, current),
          ...current,
        }));
      }
    } catch (fetchError) {
      setNotionError(fetchError instanceof Error ? fetchError.message : "Notion 데이터베이스를 불러오지 못했습니다.");
    } finally {
      setNotionSourcesLoaded(true);
      setNotionSourcesLoading(false);
    }
  }, [notionStatus?.connection?.selectedDataSourceId, selectedNotionSourceId]);

  useEffect(() => {
    void loadNotionStatus();
  }, [loadNotionStatus]);

  useEffect(() => {
    if (notionStatus?.connected && !notionSourcesLoaded && !notionSourcesLoading) {
      void loadNotionSources();
    }
  }, [loadNotionSources, notionSourcesLoaded, notionSourcesLoading, notionStatus?.connected]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);
    const result = url.searchParams.get("notion");
    if (result === "connected") {
      setNotionMessage("Notion 연결이 완료되었습니다.");
    }
    if (result === "error") {
      setNotionError("Notion 연결을 완료하지 못했습니다.");
    }
    if (result) {
      url.searchParams.delete("notion");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  const handleNotionConnect = () => {
    if (notionStatus && !notionStatus.configured) {
      setNotionError("Notion OAuth 설정이 필요합니다.");
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    window.location.href = buildNotionIntegrationStartUrl(window.location.href);
  };

  const handleNotionSourceChange = (dataSourceId: string) => {
    const source = notionSources.find((item) => item.id === dataSourceId);
    setSelectedNotionSourceId(dataSourceId);
    setNotionMappings(source ? inferNotionMappings(source, notionMappings) : {});
    setNotionError(null);
  };

  const handleNotionSync = async () => {
    if (!selectedNotionSourceId) {
      setNotionError("Notion 데이터베이스를 선택해 주세요.");
      return;
    }

    if (!notionMappings.phone) {
      setNotionError("전화번호 컬럼을 선택해 주세요.");
      return;
    }

    setNotionSyncing(true);
    setNotionError(null);
    setNotionMessage(null);

    try {
      const result = await syncNotionRecipients({
        dataSourceId: selectedNotionSourceId,
        mappings: notionMappings,
      });
      await loadNotionStatus();
      setNotionMessage(`Notion 수신자 ${result.import.created}명 추가, ${result.import.updated}명 업데이트 완료`);
    } catch (syncError) {
      setNotionError(syncError instanceof Error ? syncError.message : "Notion 동기화를 완료하지 못했습니다.");
    } finally {
      setNotionSyncing(false);
    }
  };

  return (
    <div className="box notion-sync-box" id="notion">
      <div className="box-header">
        <div>
          <div className="box-title">Notion 수신자 가져오기</div>
          <div className="box-subtitle">Notion 연결과 수신자 가져오기를 관리합니다</div>
        </div>
        <span className={`label ${notionStatus?.connected ? "label-green" : "label-gray"}`}>
          <span className="label-dot" />
          {notionLoading ? "확인 중" : notionStatus?.connected ? "연결됨" : "연결 필요"}
        </span>
      </div>
      <div className="box-body notion-sync-body">
        <div className="notion-sync-summary">
          <div className="notion-sync-summary-main">
            <div className="box-row-title">Notion 수신자 가져오기</div>
            {notionStatus?.connection ? (
              <div className="notion-sync-meta">
                {notionStatus.connection.workspaceName || "Notion 워크스페이스"}
                {notionStatus.connection.lastSyncedAt ? ` · 마지막 동기화 ${formatDateTime(notionStatus.connection.lastSyncedAt)}` : ""}
              </div>
            ) : (
              <div className="notion-sync-meta">연결 후 수신자 데이터베이스와 컬럼을 선택할 수 있습니다.</div>
            )}
          </div>
          <div className="notion-sync-controls">
            {notionStatus?.connected ? (
              <button className="btn btn-default" onClick={() => void loadNotionSources()} disabled={notionSourcesLoading || notionSyncing}>
                <AppIcon name="refresh" className={`icon icon-14${notionSourcesLoading ? " spin" : ""}`} />
                데이터베이스 새로고침
              </button>
            ) : null}
            <button className="btn btn-default" onClick={handleNotionConnect}>
              <AppIcon name="external" className="icon icon-14" />
              {notionStatus?.connected ? "다시 연결" : "Notion 연결"}
            </button>
          </div>
        </div>

        {notionError ? (
          <div className="flash flash-attention notion-sync-flash" role="alert">
            <AppIcon name="warn" className="icon icon-16 flash-icon" />
            <div className="flash-body">{notionError}</div>
          </div>
        ) : null}

        {notionMessage ? (
          <div className="flash flash-success notion-sync-flash" role="status">
            <AppIcon name="check-circle" className="icon icon-16 flash-icon" />
            <div className="flash-body">{notionMessage}</div>
          </div>
        ) : null}

        {notionStatus && !notionStatus.configured ? (
          <div className="flash flash-attention notion-sync-flash">
            <AppIcon name="warn" className="icon icon-16 flash-icon" />
            <div className="flash-body">Notion OAuth 설정이 필요합니다.</div>
          </div>
        ) : null}

        {notionStatus?.connected ? (
          <div className="notion-sync-form" aria-busy={notionSyncing ? "true" : undefined}>
            <div className="notion-sync-grid">
              <div className="form-group notion-sync-field">
                <label className="form-label" htmlFor="notion-data-source">데이터베이스</label>
                <div className="form-select">
                  <select
                    id="notion-data-source"
                    className="form-control"
                    value={selectedNotionSourceId}
                    onChange={(event) => handleNotionSourceChange(event.target.value)}
                  >
                    {notionSources.length === 0 ? <option value="">공유된 데이터베이스 없음</option> : null}
                    {notionSources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {NOTION_MAPPING_FIELDS.map((field) => (
                <div className="form-group notion-sync-field" key={field.key}>
                  <label className="form-label" htmlFor={`notion-mapping-${field.key}`}>
                    {field.label}
                    {field.required ? <span className="text-danger"> *</span> : null}
                  </label>
                  <div className="form-select">
                    <select
                      id={`notion-mapping-${field.key}`}
                      className="form-control"
                      value={notionMappings[field.key] ?? ""}
                      required={field.required}
                      onChange={(event) =>
                        setNotionMappings((current) => ({
                          ...current,
                          [field.key]: event.target.value || undefined,
                        }))
                      }
                    >
                      <option value="">선택 안 함</option>
                      {selectedNotionSourceId
                        ? notionSources
                            .find((source) => source.id === selectedNotionSourceId)
                            ?.properties.map((property) => (
                              <option key={`${field.key}-${property.id}`} value={property.name}>
                                {property.name} · {notionPropertyTypeLabel(property.type)}
                              </option>
                            ))
                        : null}
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <div className="notion-sync-actions">
              <div className="form-hint" role="status" aria-live="polite">
                {notionSyncing ? "Notion 수신자를 동기화하고 있습니다." : "전화번호 컬럼은 필수입니다."}
              </div>
              <button className="btn btn-accent" onClick={() => void handleNotionSync()} disabled={notionSyncing}>
                <AppIcon name="merge" className="icon icon-14" />
                {notionSyncing ? "동기화 중..." : "수신자 동기화"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function inferNotionMappings(source: NotionDataSource, current: NotionRecipientMappings = {}): NotionRecipientMappings {
  const next: NotionRecipientMappings = { ...current };

  for (const field of NOTION_MAPPING_FIELDS) {
    if (next[field.key]) {
      continue;
    }

    const matched = findNotionProperty(source, field.preferredNames, field.preferredTypes);
    if (matched) {
      next[field.key] = matched.name;
    }
  }

  return next;
}

function findNotionProperty(source: NotionDataSource, names: string[], types?: string[]) {
  const properties = source.properties;
  const normalizedNames = names.map(normalizeNotionPropertyName);
  const nameMatched = properties.find((property) => {
    const normalizedPropertyName = normalizeNotionPropertyName(property.name);
    return normalizedNames.some((name) => normalizedPropertyName.includes(name));
  });

  if (nameMatched) {
    return nameMatched;
  }

  return types ? properties.find((property) => types.includes(property.type)) : undefined;
}

function normalizeNotionPropertyName(value: string) {
  return value.toLowerCase().replace(/[\s_-]+/g, "");
}

function notionPropertyTypeLabel(value: string) {
  const labels: Record<string, string> = {
    title: "제목",
    rich_text: "텍스트",
    phone_number: "전화번호",
    email: "이메일",
    checkbox: "체크",
    select: "선택",
    status: "상태",
    multi_select: "다중 선택",
    date: "날짜",
    number: "숫자",
  };

  return labels[value] ?? value;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
