"use client";

import { ThemeProvider } from "@primer/react";
import { DataTable, Table, type Column } from "@primer/react/experimental";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import {
  buildNotionIntegrationStartUrl,
  fetchNotionDataSourcePreview,
  fetchNotionDataSources,
  fetchNotionIntegrationStatus,
  syncNotionRecipients,
  type NotionCustomMapping,
  type NotionDataSourcePreviewCell,
  type NotionDataSourcePreviewResponse,
  type NotionDataSourcePreviewRow,
  type NotionDataSource,
  type NotionIntegrationStatusResponse,
  type NotionRecipientMappings,
} from "@/lib/api/v2";

type NotionMappingField = {
  key: keyof NotionRecipientMappings;
  label: string;
  required?: boolean;
  group: "primary" | "advanced";
  description: string;
  preferredNames: string[];
  preferredTypes?: string[];
};

type NotionCustomMappingRow = NotionCustomMapping & {
  id: string;
};

type NotionImportPreviewColumn = {
  id: string;
  header: string;
  sourcePath: string;
  columnType: string;
};

const NOTION_MAPPING_FIELDS: NotionMappingField[] = [
  {
    key: "name",
    label: "이름",
    required: true,
    group: "primary",
    description: "수신자 목록의 이름으로 저장합니다.",
    preferredNames: ["이름", "성명", "고객명", "회원명", "name"],
    preferredTypes: ["title", "rich_text"],
  },
  {
    key: "phone",
    label: "전화번호",
    required: true,
    group: "primary",
    description: "문자/알림톡 발송에 사용할 필수 번호입니다.",
    preferredNames: ["전화번호", "연락처", "휴대폰", "핸드폰", "phone", "mobile"],
    preferredTypes: ["phone_number"],
  },
  {
    key: "email",
    label: "이메일",
    group: "primary",
    description: "수신자 보조 연락처로 저장합니다.",
    preferredNames: ["이메일", "email", "mail"],
    preferredTypes: ["email"],
  },
  {
    key: "status",
    label: "상태",
    group: "primary",
    description: "활성/비활성 같은 수신자 상태로 저장합니다.",
    preferredNames: ["상태", "status"],
    preferredTypes: ["status"],
  },
  {
    key: "segment",
    label: "분류",
    group: "primary",
    description: "수신자 목록의 분류 컬럼으로 저장합니다.",
    preferredNames: ["분류", "그룹", "기수", "학년", "세그먼트", "segment", "group"],
    preferredTypes: ["select", "status", "multi_select"],
  },
  {
    key: "marketingConsent",
    label: "마케팅 동의",
    group: "primary",
    description: "마케팅 수신 동의 여부로 저장합니다.",
    preferredNames: ["마케팅", "수신동의", "동의", "marketing"],
    preferredTypes: ["checkbox"],
  },
  {
    key: "userType",
    label: "유형",
    group: "advanced",
    description: "회원/고객 유형 등 보조 분류로 저장합니다.",
    preferredNames: ["유형", "타입", "고객유형", "회원유형", "usertype", "type"],
  },
  {
    key: "gradeOrLevel",
    label: "등급/레벨",
    group: "advanced",
    description: "등급, 레벨, 학년 같은 값을 저장합니다.",
    preferredNames: ["등급", "레벨", "학년", "grade", "level"],
  },
  {
    key: "tags",
    label: "태그",
    group: "advanced",
    description: "다중 선택 태그를 수신자 속성으로 저장합니다.",
    preferredNames: ["태그", "tags"],
    preferredTypes: ["multi_select"],
  },
  {
    key: "registeredAt",
    label: "가입일",
    group: "advanced",
    description: "가입일 또는 등록일로 저장합니다.",
    preferredNames: ["가입일", "등록일", "registered", "registeredat"],
    preferredTypes: ["date", "created_time"],
  },
  {
    key: "lastLoginAt",
    label: "최근 로그인",
    group: "advanced",
    description: "최근 로그인 일시로 저장합니다.",
    preferredNames: ["최근로그인", "마지막로그인", "lastlogin", "lastloginat"],
    preferredTypes: ["date", "last_edited_time"],
  },
];

const NOTION_IMPORTABLE_PROPERTY_TYPES = new Set([
  "title",
  "rich_text",
  "phone_number",
  "email",
  "url",
  "number",
  "checkbox",
  "select",
  "status",
  "multi_select",
  "date",
  "created_time",
  "last_edited_time",
  "created_by",
  "last_edited_by",
  "people",
  "files",
  "relation",
  "formula",
  "rollup",
  "unique_id",
]);

export function NotionRecipientSyncPanel() {
  const [notionStatus, setNotionStatus] = useState<NotionIntegrationStatusResponse | null>(null);
  const [notionSources, setNotionSources] = useState<NotionDataSource[]>([]);
  const [notionLoading, setNotionLoading] = useState(true);
  const [notionSourcesLoaded, setNotionSourcesLoaded] = useState(false);
  const [notionSourcesLoading, setNotionSourcesLoading] = useState(false);
  const [notionSyncing, setNotionSyncing] = useState(false);
  const [notionError, setNotionError] = useState<string | null>(null);
  const [notionMessage, setNotionMessage] = useState<string | null>(null);
  const [notionPreview, setNotionPreview] = useState<NotionDataSourcePreviewResponse | null>(null);
  const [notionPreviewLoading, setNotionPreviewLoading] = useState(false);
  const [notionPreviewError, setNotionPreviewError] = useState<string | null>(null);
  const [notionPreviewReloadKey, setNotionPreviewReloadKey] = useState(0);
  const [selectedNotionSourceId, setSelectedNotionSourceId] = useState("");
  const [notionMappings, setNotionMappings] = useState<NotionRecipientMappings>({});
  const [notionCustomMappings, setNotionCustomMappings] = useState<NotionCustomMappingRow[]>([]);
  const [notionCustomMappingsSourceId, setNotionCustomMappingsSourceId] = useState<string | null>(null);

  const selectedNotionSource = useMemo(
    () => notionSources.find((source) => source.id === selectedNotionSourceId) ?? null,
    [notionSources, selectedNotionSourceId]
  );
  const suggestedNotionMappings = useMemo(
    () => (selectedNotionSource ? inferNotionMappings(selectedNotionSource) : {}),
    [selectedNotionSource]
  );
  const duplicateNotionMappingNames = useMemo(
    () => getDuplicateNotionMappingNames(notionMappings, notionCustomMappings),
    [notionCustomMappings, notionMappings]
  );
  const syncedCustomMappings = useMemo(
    () => notionCustomMappings.map(({ sourcePath, customLabel }) => ({ sourcePath, customLabel })),
    [notionCustomMappings]
  );
  const hasNotionMappingBlockingIssue = !notionMappings.name || !notionMappings.phone || duplicateNotionMappingNames.size > 0;
  const notionSyncHint = getNotionSyncHint(notionMappings, duplicateNotionMappingNames, notionSyncing);

  const loadNotionStatus = useCallback(async () => {
    setNotionLoading(true);
    setNotionError(null);

    try {
      const status = await fetchNotionIntegrationStatus();
      setNotionStatus(status);
      setSelectedNotionSourceId(status.connection?.selectedDataSourceId ?? "");
      setNotionMappings(status.connection?.selectedMappings ?? {});
      setNotionCustomMappings(toNotionCustomMappingRows(status.connection?.selectedCustomMappings ?? []));
      setNotionCustomMappingsSourceId(
        status.connection?.selectedCustomMappingsConfigured ? status.connection.selectedDataSourceId : null
      );
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
        const nextMappings = inferNotionMappings(selectedSource, notionMappings);
        setSelectedNotionSourceId(selectedSource.id);
        setNotionMappings(nextMappings);
        setNotionCustomMappings((current) => {
          if (notionCustomMappingsSourceId === selectedSource.id) {
            return filterCustomMappingsForSource(current, selectedSource, nextMappings);
          }

          if (
            notionStatus?.connection?.selectedCustomMappingsConfigured &&
            notionStatus.connection.selectedDataSourceId === selectedSource.id
          ) {
            return filterCustomMappingsForSource(
              toNotionCustomMappingRows(notionStatus.connection.selectedCustomMappings),
              selectedSource,
              nextMappings
            );
          }

          return buildDefaultNotionCustomMappings(selectedSource, nextMappings);
        });
        setNotionCustomMappingsSourceId(selectedSource.id);
      }
    } catch (fetchError) {
      setNotionError(fetchError instanceof Error ? fetchError.message : "Notion 데이터베이스를 불러오지 못했습니다.");
    } finally {
      setNotionSourcesLoaded(true);
      setNotionSourcesLoading(false);
    }
  }, [notionCustomMappingsSourceId, notionMappings, notionStatus?.connection, selectedNotionSourceId]);

  useEffect(() => {
    void loadNotionStatus();
  }, [loadNotionStatus]);

  useEffect(() => {
    if (notionStatus?.connected && !notionSourcesLoaded && !notionSourcesLoading) {
      void loadNotionSources();
    }
  }, [loadNotionSources, notionSourcesLoaded, notionSourcesLoading, notionStatus?.connected]);

  useEffect(() => {
    if (!notionStatus?.connected || !selectedNotionSourceId) {
      setNotionPreview(null);
      setNotionPreviewError(null);
      setNotionPreviewLoading(false);
      return;
    }

    let cancelled = false;
    setNotionPreviewLoading(true);
    setNotionPreviewError(null);

    fetchNotionDataSourcePreview(selectedNotionSourceId)
      .then((result) => {
        if (!cancelled) {
          setNotionPreview(result);
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setNotionPreview(null);
          setNotionPreviewError(fetchError instanceof Error ? fetchError.message : "Notion 미리보기를 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setNotionPreviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [notionPreviewReloadKey, notionStatus?.connected, selectedNotionSourceId]);

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
    const nextMappings = source ? inferNotionMappings(source) : {};
    setSelectedNotionSourceId(dataSourceId);
    setNotionMappings(nextMappings);
    setNotionCustomMappings(source ? buildDefaultNotionCustomMappings(source, nextMappings) : []);
    setNotionCustomMappingsSourceId(source?.id ?? null);
    setNotionPreview(null);
    setNotionPreviewError(null);
    setNotionError(null);
  };

  const handleNotionStorageChange = (sourcePath: string, storageValue: string) => {
    const property = selectedNotionSource?.properties.find((item) => item.name === sourcePath);
    if (!property) {
      return;
    }

    const systemField = parseNotionSystemStorageValue(storageValue);

    setNotionMappings((current) => {
      const next = removeNotionPropertyFromSystemMappings(current, property.name);
      if (systemField) {
        next[systemField.key] = property.name;
      }
      return next;
    });
    setNotionCustomMappings((current) => {
      const withoutCurrentProperty = current.filter((item) => item.sourcePath !== property.name);
      if (storageValue !== "custom") {
        return withoutCurrentProperty;
      }
      return [
        ...withoutCurrentProperty,
        {
          id: buildNotionCustomMappingId(property.name),
          sourcePath: property.name,
          customLabel: property.name,
        },
      ];
    });
    setNotionError(null);
    setNotionMessage(null);
  };

  const handleNotionSync = async () => {
    if (!selectedNotionSourceId) {
      setNotionError("Notion 데이터베이스를 선택해 주세요.");
      return;
    }

    if (!notionMappings.name) {
      setNotionError("이름 컬럼을 선택해 주세요.");
      return;
    }

    if (!notionMappings.phone) {
      setNotionError("전화번호 컬럼을 선택해 주세요.");
      return;
    }

    if (duplicateNotionMappingNames.size > 0) {
      const [duplicateName] = duplicateNotionMappingNames;
      setNotionError(`"${duplicateName}" 컬럼이 여러 필드에 연결되어 있습니다.`);
      return;
    }

    setNotionSyncing(true);
    setNotionError(null);
    setNotionMessage(null);

    try {
      const result = await syncNotionRecipients({
        dataSourceId: selectedNotionSourceId,
        mappings: notionMappings,
        customMappings: syncedCustomMappings,
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
            </div>

            <NotionMappingTable
              source={selectedNotionSource}
              preview={notionPreview}
              previewLoading={notionPreviewLoading}
              previewError={notionPreviewError}
              mappings={notionMappings}
              customMappings={notionCustomMappings}
              suggestedMappings={suggestedNotionMappings}
              duplicateNames={duplicateNotionMappingNames}
              onStorageChange={handleNotionStorageChange}
            />

            <NotionPreviewTable
              source={selectedNotionSource}
              preview={notionPreview}
              mappings={notionMappings}
              customMappings={notionCustomMappings}
              loading={notionPreviewLoading}
              error={notionPreviewError}
              onRefresh={() => setNotionPreviewReloadKey((value) => value + 1)}
            />

            <div className="notion-sync-actions">
              <div className="form-hint" role="status" aria-live="polite">
                {notionSyncHint}
              </div>
              <button className="btn btn-accent" onClick={() => void handleNotionSync()} disabled={notionSyncing || hasNotionMappingBlockingIssue}>
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

function NotionMappingTable({
  source,
  preview,
  previewLoading,
  previewError,
  mappings,
  customMappings,
  suggestedMappings,
  duplicateNames,
  onStorageChange,
}: {
  source: NotionDataSource | null;
  preview: NotionDataSourcePreviewResponse | null;
  previewLoading: boolean;
  previewError: string | null;
  mappings: NotionRecipientMappings;
  customMappings: NotionCustomMappingRow[];
  suggestedMappings: NotionRecipientMappings;
  duplicateNames: Set<string>;
  onStorageChange: (sourcePath: string, storageValue: string) => void;
}) {
  const sourceProperties = useMemo(() => source?.properties ?? [], [source]);
  const sortedSourceProperties = useMemo(
    () => sortNotionPropertiesForMapping(sourceProperties, mappings, suggestedMappings),
    [mappings, sourceProperties, suggestedMappings]
  );
  const mappedCount = getNotionMappedPropertyCount(sourceProperties, mappings, customMappings);
  const hasDuplicate = duplicateNames.size > 0;
  const hasRows = sourceProperties.length > 0;
  const summary = getNotionMappingSummary(source, sourceProperties.length, mappedCount, previewLoading, previewError);

  return (
    <div className="notion-mapping-surface">
      <div className="notion-mapping-header">
        <div className="notion-mapping-heading">
          <div className="box-row-title">컬럼 연결</div>
          <div className="notion-sync-meta">{summary}</div>
        </div>
        <div className="notion-mapping-summary" aria-label="컬럼 연결 상태">
          <span className={`notion-mapping-summary-pill ${mappings.name ? "success" : "danger"}`}>
            이름 {mappings.name ? "연결됨" : "필수"}
          </span>
          <span className={`notion-mapping-summary-pill ${mappings.phone ? "success" : "danger"}`}>
            전화번호 {mappings.phone ? "연결됨" : "필수"}
          </span>
          {hasDuplicate ? (
            <span className="notion-mapping-summary-pill danger">중복 {duplicateNames.size}개</span>
          ) : null}
        </div>
      </div>

      <div className="notion-mapping-table-scroll">
        <ThemeProvider colorMode="light" dayScheme="light" preventSSRMismatch>
          <table className="notion-mapping-table">
            <colgroup>
              <col className="notion-mapping-col-notion" />
              <col className="notion-mapping-col-sample" />
              <col className="notion-mapping-col-storage" />
            </colgroup>
            <thead>
              <tr>
                <th>Notion 컬럼</th>
                <th>샘플 값</th>
                <th>저장 방식</th>
              </tr>
            </thead>
            <tbody>
              {!hasRows ? (
                <tr>
                  <td className="notion-mapping-empty" colSpan={3}>
                    선택한 데이터베이스에 컬럼이 없습니다.
                  </td>
                </tr>
              ) : null}
              {sortedSourceProperties.map((property) => (
                <NotionPropertyMappingRow
                  key={property.id}
                  property={property}
                  preview={preview}
                  mappings={mappings}
                  customMappings={customMappings}
                  suggestedMappings={suggestedMappings}
                  duplicateNames={duplicateNames}
                  onStorageChange={onStorageChange}
                />
              ))}
            </tbody>
          </table>
        </ThemeProvider>
      </div>
    </div>
  );
}

function NotionPropertyMappingRow({
  property,
  preview,
  mappings,
  customMappings,
  suggestedMappings,
  duplicateNames,
  onStorageChange,
}: {
  property: NotionDataSource["properties"][number];
  preview: NotionDataSourcePreviewResponse | null;
  mappings: NotionRecipientMappings;
  customMappings: NotionCustomMappingRow[];
  suggestedMappings: NotionRecipientMappings;
  duplicateNames: Set<string>;
  onStorageChange: (sourcePath: string, storageValue: string) => void;
}) {
  const currentSystemField = getNotionSystemFieldForProperty(mappings, property.name);
  const suggestedField = getSuggestedNotionFieldForProperty(suggestedMappings, property.name);
  const customMapping = customMappings.find((mapping) => mapping.sourcePath === property.name);
  const storageValue = currentSystemField ? `system:${currentSystemField.key}` : customMapping ? "custom" : "skip";
  const sample = getNotionPreviewSample(preview, property.name);
  const isDuplicate = duplicateNames.has(property.name);
  const isImportable = NOTION_IMPORTABLE_PROPERTY_TYPES.has(property.type);
  const showCustomOption = Boolean(customMapping) || !NOTION_MAPPING_FIELDS.some((field) => field.label === property.name);
  const otherSystemFields = NOTION_MAPPING_FIELDS.filter((field) => field.key !== suggestedField?.key);

  return (
    <tr className={`notion-mapping-row${isDuplicate ? " duplicate" : ""}`}>
      <th scope="row">
        <span className="notion-mapping-option-title">
          <span className="notion-mapping-option-name">{property.name}</span>
          <span className="notion-mapping-type-badge">{notionPropertyTypeLabel(property.type)}</span>
        </span>
      </th>
      <td>
        <span className="notion-mapping-sample" title={sample || undefined}>
          {sample || "—"}
        </span>
      </td>
      <td className="notion-mapping-storage-cell">
        <div className="form-select notion-mapping-storage-select">
          <select
            className="form-control"
            value={storageValue}
            disabled={!isImportable}
            aria-label={`${property.name} 저장 방식`}
            onChange={(event) => onStorageChange(property.name, event.target.value)}
          >
            {isImportable ? (
              <>
                <option value="skip">가져오지 않음</option>
                {suggestedField ? (
                  <option value={`system:${suggestedField.key}`}>{suggestedField.label} 필드로 저장</option>
                ) : null}
                {showCustomOption ? (
                  <option value="custom">{`Notion 그대로 "${property.name}" 필드로 저장`}</option>
                ) : null}
                {otherSystemFields.length > 0 ? (
                  <optgroup label={suggestedField ? "다른 필드로 저장" : "필드로 저장"}>
                    {otherSystemFields.map((field) => (
                      <option key={field.key} value={`system:${field.key}`}>
                        {field.label} 필드로 저장
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </>
            ) : (
              <option value="skip">지원하지 않는 형식</option>
            )}
          </select>
        </div>
      </td>
    </tr>
  );
}

function NotionPreviewTable({
  source,
  preview,
  mappings,
  customMappings,
  loading,
  error,
  onRefresh,
}: {
  source: NotionDataSource | null;
  preview: NotionDataSourcePreviewResponse | null;
  mappings: NotionRecipientMappings;
  customMappings: NotionCustomMappingRow[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  const importColumns = useMemo(
    () => buildNotionImportPreviewColumns(source, mappings, customMappings),
    [customMappings, mappings, source]
  );
  const columns = useMemo<Array<Column<NotionDataSourcePreviewRow>>>(
    () => buildNotionPreviewDataTableColumns(importColumns),
    [importColumns]
  );
  const description = getNotionPreviewTableDescription(preview, importColumns.length, loading);

  return (
    <div className="notion-preview-surface" aria-busy={loading ? "true" : undefined}>
      <div className="notion-preview-header">
        <div className="notion-preview-heading">
          <div className="box-row-title" id="notion-preview-table-title">가져올 데이터 미리보기</div>
          <div className="notion-sync-meta" id="notion-preview-table-desc">{description}</div>
        </div>
        <button className="btn btn-default btn-sm" type="button" onClick={onRefresh} disabled={loading || !source}>
          <AppIcon name="refresh" className={`icon icon-14${loading ? " spin" : ""}`} />
          미리보기 새로고침
        </button>
      </div>

      {error ? (
        <div className="flash flash-attention notion-preview-flash" role="alert">
          <AppIcon name="warn" className="icon icon-16 flash-icon" />
          <div className="flash-body">{error}</div>
        </div>
      ) : null}

      {loading && !preview ? (
        <NotionPreviewSkeleton />
      ) : preview && preview.rows.length > 0 && importColumns.length > 0 ? (
        <div className="notion-preview-table-scroll" tabIndex={0} aria-label="가져올 데이터 미리보기 표 가로 스크롤">
          <ThemeProvider colorMode="light" dayScheme="light" preventSSRMismatch>
            <Table.Container className="notion-preview-table-container">
              <DataTable
                aria-labelledby="notion-preview-table-title"
                aria-describedby="notion-preview-table-desc"
                cellPadding="condensed"
                data={preview.rows}
                columns={columns}
                getRowId={(row) => row.id}
              />
            </Table.Container>
          </ThemeProvider>
        </div>
      ) : (
        <div className="notion-preview-empty">
          <div className="empty-title">{importColumns.length === 0 ? "가져올 컬럼이 없습니다" : "미리볼 데이터가 없습니다"}</div>
          <div className="empty-desc">
            {importColumns.length === 0
              ? "컬럼 연결에서 저장 방식을 선택하면 데이터 미리보기가 표시됩니다."
              : "선택한 Notion 데이터베이스에 표시할 행이 없습니다."}
          </div>
        </div>
      )}
    </div>
  );
}

function NotionPreviewSkeleton() {
  return (
    <div className="notion-preview-skeleton" role="status" aria-live="polite">
      <span className="sr-only">Notion 미리보기를 불러오는 중입니다.</span>
      {Array.from({ length: 4 }).map((_, rowIndex) => (
        <div className="notion-preview-skeleton-row" key={rowIndex}>
          {Array.from({ length: 5 }).map((__, cellIndex) => (
            <span className="notion-preview-skeleton-cell" key={cellIndex} />
          ))}
        </div>
      ))}
    </div>
  );
}

function buildNotionImportPreviewColumns(
  source: NotionDataSource | null,
  mappings: NotionRecipientMappings,
  customMappings: NotionCustomMappingRow[]
): NotionImportPreviewColumn[] {
  const sourceProperties = source?.properties ?? [];
  const columns: Array<NotionImportPreviewColumn & { sourceIndex: number; requiredOrder: number }> = [];
  const customMappingBySourcePath = new Map(customMappings.map((mapping) => [mapping.sourcePath, mapping]));

  for (const [sourceIndex, property] of sourceProperties.entries()) {
    const systemField = getNotionSystemFieldForProperty(mappings, property.name);
    if (systemField) {
      columns.push({
        id: `system-${systemField.key}-${property.name}`,
        header: systemField.label,
        sourcePath: property.name,
        columnType: property.type,
        sourceIndex,
        requiredOrder: getRequiredNotionFieldOrder(systemField),
      });
      continue;
    }

    const customMapping = customMappingBySourcePath.get(property.name);
    if (customMapping) {
      columns.push({
        id: `custom-${customMapping.id}-${property.name}`,
        header: customMapping.customLabel || property.name,
        sourcePath: property.name,
        columnType: property.type,
        sourceIndex,
        requiredOrder: Number.POSITIVE_INFINITY,
      });
    }
  }

  return columns
    .sort((left, right) => left.requiredOrder - right.requiredOrder || left.sourceIndex - right.sourceIndex)
    .map((column) => ({
      id: column.id,
      header: column.header,
      sourcePath: column.sourcePath,
      columnType: column.columnType,
    }));
}

function buildNotionPreviewDataTableColumns(
  importColumns: NotionImportPreviewColumn[]
): Array<Column<NotionDataSourcePreviewRow>> {
  return importColumns.map((column, index) => ({
    id: column.id,
    header: column.header,
    rowHeader: index === 0,
    align: column.columnType === "number" ? "end" : "start",
    width: notionPreviewColumnWidth(column.columnType, index),
    renderCell: (row) => (
      <NotionPreviewCellValue
        cell={row.cells[column.sourcePath]}
        columnType={column.columnType}
      />
    ),
  }));
}

function getNotionPreviewTableDescription(
  preview: NotionDataSourcePreviewResponse | null,
  columnCount: number,
  loading: boolean
) {
  if (loading && !preview) {
    return "Notion 데이터를 읽는 중입니다.";
  }
  if (!preview) {
    return "선택한 데이터베이스의 가져올 데이터를 표시합니다.";
  }
  return `${columnCount}개 컬럼 · ${preview.rows.length}개 행 미리보기${preview.hasMore ? " · 추가 행 있음" : ""}`;
}

function notionPreviewColumnWidth(type: string, index: number) {
  if (index === 0) return "minmax(180px, 1fr)";
  if (type === "checkbox") return "92px";
  if (type === "number") return "112px";
  if (type === "date" || type === "created_time" || type === "last_edited_time") return "164px";
  if (type === "phone_number" || type === "email" || type === "url") return "180px";
  if (type === "select" || type === "status" || type === "multi_select") return "156px";
  return "minmax(140px, 1fr)";
}

function NotionPreviewCellValue({
  cell,
  columnType,
}: {
  cell: NotionDataSourcePreviewCell | undefined;
  columnType: string;
}) {
  if (!cell || cell.kind === "empty") {
    return null;
  }

  if (cell.kind === "checkbox") {
    return (
      <span
        className={`notion-preview-checkbox${cell.checked ? " checked" : ""}`}
        role="img"
        aria-label={cell.checked ? "체크됨" : "체크 안 됨"}
      >
        {cell.checked ? <AppIcon name="check" className="icon icon-12" /> : null}
      </span>
    );
  }

  if (cell.kind === "labels" && cell.labels) {
    return (
      <span className="notion-preview-token-list" title={cell.text}>
        {cell.labels.map((label) => (
          <span className={`notion-preview-token notion-preview-token-${normalizeNotionColor(label.color)}`} key={`${label.name}-${label.color}`}>
            {label.name}
          </span>
        ))}
      </span>
    );
  }

  if (cell.kind === "url" && cell.href) {
    return (
      <a className="notion-preview-link" href={cell.href} target="_blank" rel="noreferrer" title={cell.text}>
        {cell.text}
      </a>
    );
  }

  return (
    <span
      className={`notion-preview-cell-text${cell.kind === "number" || columnType === "number" ? " notion-preview-number" : ""}`}
      title={cell.text}
    >
      {cell.text}
    </span>
  );
}

function normalizeNotionColor(value: string | null) {
  const color = value ?? "default";
  if (["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"].includes(color)) {
    return color;
  }
  return "default";
}

function getDuplicateNotionMappingNames(
  mappings: NotionRecipientMappings,
  customMappings: NotionCustomMappingRow[]
) {
  const counts = new Map<string, number>();

  for (const value of [
    ...Object.values(mappings),
    ...customMappings.map((mapping) => mapping.sourcePath),
  ]) {
    if (!value) {
      continue;
    }
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return new Set(
    Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .map(([name]) => name)
  );
}

function getNotionMappingSummary(
  source: NotionDataSource | null,
  columnCount: number,
  mappedCount: number,
  previewLoading: boolean,
  previewError: string | null
) {
  if (!source) {
    return "데이터베이스를 선택하면 컬럼을 연결할 수 있습니다.";
  }

  const sampleStatus = previewLoading
    ? "샘플 값을 불러오는 중입니다."
    : previewError
      ? "샘플 값을 불러오지 못했습니다."
      : "샘플 값을 함께 확인할 수 있습니다.";

  return `${columnCount}개 Notion 컬럼 중 ${mappedCount}개를 가져옵니다. ${sampleStatus}`;
}

function getNotionSyncHint(
  mappings: NotionRecipientMappings,
  duplicateNames: Set<string>,
  syncing: boolean
) {
  if (syncing) {
    return "Notion 수신자를 동기화하고 있습니다.";
  }
  if (!mappings.name) {
    return "이름 컬럼을 연결해야 동기화할 수 있습니다.";
  }
  if (!mappings.phone) {
    return "전화번호 컬럼을 연결해야 동기화할 수 있습니다.";
  }
  if (duplicateNames.size > 0) {
    const [duplicateName] = duplicateNames;
    return `"${duplicateName}" 컬럼이 중복 연결되어 있습니다.`;
  }
  return "매핑과 미리보기를 확인한 뒤 수신자를 동기화합니다.";
}

function getNotionPreviewSample(
  preview: NotionDataSourcePreviewResponse | null,
  propertyName: string
) {
  for (const row of preview?.rows ?? []) {
    const text = row.cells[propertyName]?.text.trim();
    if (text) {
      return text;
    }
  }
  return "";
}

function getNotionSystemFieldForProperty(
  mappings: NotionRecipientMappings,
  propertyName: string
) {
  return NOTION_MAPPING_FIELDS.find((field) => mappings[field.key] === propertyName);
}

function getSuggestedNotionFieldForProperty(
  suggestedMappings: NotionRecipientMappings,
  propertyName: string
) {
  return NOTION_MAPPING_FIELDS.find((field) => suggestedMappings[field.key] === propertyName);
}

function getRequiredNotionFieldOrder(field?: NotionMappingField) {
  if (field?.key === "name") {
    return 0;
  }
  if (field?.key === "phone") {
    return 1;
  }
  return Number.POSITIVE_INFINITY;
}

function sortNotionPropertiesForMapping(
  properties: NotionDataSource["properties"],
  mappings: NotionRecipientMappings,
  suggestedMappings: NotionRecipientMappings
) {
  return properties
    .map((property, index) => {
      const currentField = getNotionSystemFieldForProperty(mappings, property.name);
      const suggestedField = getSuggestedNotionFieldForProperty(suggestedMappings, property.name);
      return {
        property,
        index,
        requiredOrder: getRequiredNotionFieldOrder(currentField ?? suggestedField),
      };
    })
    .sort((left, right) => left.requiredOrder - right.requiredOrder || left.index - right.index)
    .map((item) => item.property);
}

function parseNotionSystemStorageValue(value: string) {
  if (!value.startsWith("system:")) {
    return undefined;
  }
  const fieldKey = value.slice("system:".length) as keyof NotionRecipientMappings;
  return NOTION_MAPPING_FIELDS.find((field) => field.key === fieldKey);
}

function removeNotionPropertyFromSystemMappings(
  mappings: NotionRecipientMappings,
  propertyName: string
) {
  const next = { ...mappings };
  for (const field of NOTION_MAPPING_FIELDS) {
    if (next[field.key] === propertyName) {
      delete next[field.key];
    }
  }
  return next;
}

function getNotionMappedPropertyCount(
  properties: NotionDataSource["properties"],
  mappings: NotionRecipientMappings,
  customMappings: NotionCustomMappingRow[]
) {
  const customSourcePaths = new Set(customMappings.map((mapping) => mapping.sourcePath));
  return properties.filter((property) =>
    Boolean(getNotionSystemFieldForProperty(mappings, property.name) || customSourcePaths.has(property.name))
  ).length;
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
    created_time: "생성일",
    last_edited_time: "수정일",
    created_by: "생성자",
    last_edited_by: "수정자",
    number: "숫자",
    url: "URL",
    people: "사용자",
    files: "파일",
    relation: "관계",
    formula: "수식",
    rollup: "롤업",
    unique_id: "고유 ID",
  };

  return labels[value] ?? value;
}

function toNotionCustomMappingRows(mappings: NotionCustomMapping[]) {
  return mappings.map((mapping) => ({
    id: buildNotionCustomMappingId(mapping.sourcePath),
    sourcePath: mapping.sourcePath,
    customLabel: mapping.customLabel || mapping.sourcePath,
  }));
}

function filterCustomMappingsForSource(
  mappings: NotionCustomMappingRow[],
  source: NotionDataSource,
  systemMappings: NotionRecipientMappings
) {
  const importableProperties = new Map(
    source.properties
      .filter((property) => NOTION_IMPORTABLE_PROPERTY_TYPES.has(property.type))
      .map((property) => [property.name, property])
  );
  const systemSourcePaths = new Set(Object.values(systemMappings).filter(Boolean));
  const used = new Set<string>();

  return mappings.filter((mapping) => {
    if (!importableProperties.has(mapping.sourcePath) || systemSourcePaths.has(mapping.sourcePath) || used.has(mapping.sourcePath)) {
      return false;
    }
    used.add(mapping.sourcePath);
    return true;
  });
}

function buildDefaultNotionCustomMappings(
  source: NotionDataSource,
  systemMappings: NotionRecipientMappings
): NotionCustomMappingRow[] {
  const systemSourcePaths = new Set(Object.values(systemMappings).filter(Boolean));
  const used = new Set<string>();
  const mappings: NotionCustomMappingRow[] = [];

  for (const property of source.properties) {
    if (systemSourcePaths.has(property.name) || used.has(property.name) || !NOTION_IMPORTABLE_PROPERTY_TYPES.has(property.type)) {
      continue;
    }

    used.add(property.name);
    mappings.push({
      id: buildNotionCustomMappingId(property.name),
      sourcePath: property.name,
      customLabel: property.name,
    });
  }

  return mappings;
}

function buildNotionCustomMappingId(sourcePath: string) {
  return `custom-${sourcePath}`;
}

function inferNotionMappings(source: NotionDataSource, current: NotionRecipientMappings = {}): NotionRecipientMappings {
  const propertyNames = new Set(source.properties.map((property) => property.name));
  const usedPropertyNames = new Set<string>();
  const next: NotionRecipientMappings = {};

  for (const field of NOTION_MAPPING_FIELDS) {
    const currentValue = current[field.key];
    if (currentValue && propertyNames.has(currentValue) && !usedPropertyNames.has(currentValue)) {
      next[field.key] = currentValue;
      usedPropertyNames.add(currentValue);
    }
  }

  for (const field of NOTION_MAPPING_FIELDS) {
    if (next[field.key]) {
      continue;
    }

    const matched = findNotionProperty(source, field.preferredNames, field.preferredTypes, usedPropertyNames);
    if (matched) {
      next[field.key] = matched.name;
      usedPropertyNames.add(matched.name);
    }
  }

  return next;
}

function findNotionProperty(
  source: NotionDataSource,
  names: string[],
  types?: string[],
  excludedNames = new Set<string>()
) {
  const properties = source.properties;
  const normalizedNames = names.map(normalizeNotionPropertyName);
  const nameMatched = properties.find((property) => {
    if (excludedNames.has(property.name)) {
      return false;
    }
    const normalizedPropertyName = normalizeNotionPropertyName(property.name);
    return normalizedNames.some((name) => normalizedPropertyName.includes(name));
  });

  if (nameMatched) {
    return nameMatched;
  }

  return types ? properties.find((property) => !excludedNames.has(property.name) && types.includes(property.type)) : undefined;
}

function normalizeNotionPropertyName(value: string) {
  return value.toLowerCase().replace(/[\s_-]+/g, "");
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
