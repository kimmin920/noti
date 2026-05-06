"use client";

import {
  Banner,
  Button,
  Checkbox,
  CounterLabel,
  FormControl,
  Heading,
  Label,
  PageHeader,
  Select,
  Spinner,
  Text,
  Textarea,
  TextInput,
  ThemeProvider,
} from "@primer/react";
import { Blankslate, DataTable, Table, type Column } from "@primer/react/experimental";
import {
  AlertIcon,
  ArrowLeftIcon,
  CheckIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  WebhookIcon,
} from "@primer/octicons-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AppIcon } from "@/components/icons/AppIcon";
import {
  createV2PublEvent,
  fetchV2PublEvents,
  updateV2PublEvent,
  type V2PublEventItem,
  type V2PublEventProp,
  type V2PublEventsResponse,
  type V2UpsertPublEventPayload,
} from "@/lib/api/v2";

type PublEventsPageProps = {
  canManagePublEvents: boolean;
};

type PublRouteMode =
  | { kind: "list" }
  | { kind: "new" }
  | { kind: "detail"; eventKey: string }
  | { kind: "edit"; eventKey: string };

type PropDraft = Omit<V2PublEventProp, "id" | "parserPipeline" | "type"> & {
  id?: string;
  type: V2UpsertPublEventPayload["props"][number]["type"];
  parserPipelineText: string;
};

type EventDraft = Omit<V2PublEventItem, "id" | "catalogKey" | "createdAt" | "updatedAt" | "props" | "serviceStatus"> & {
  id?: string;
  catalogKey?: string | null;
  serviceStatus: "ACTIVE" | "INACTIVE" | "DRAFT";
  props: PropDraft[];
};

type ParserPreset =
  | "none"
  | "fallback"
  | "kstDateTime"
  | "join"
  | "mapTemplateJoin"
  | "firstItem"
  | "currencyKo"
  | "phoneFormat"
  | "truncate"
  | "replace"
  | "unsupported";
type SelectableParserPreset = Exclude<ParserPreset, "unsupported">;

const PROP_TYPES: Array<PropDraft["type"]> = ["text", "number", "datetime", "boolean", "enum", "object", "array"];

const PARSER_PRESETS: Array<{ value: SelectableParserPreset; label: string; hint: string }> = [
  { value: "none", label: "가공 없음", hint: "Publ에서 들어온 값을 그대로 템플릿 변수에 사용합니다." },
  { value: "fallback", label: "중간 결과가 비면 대체값", hint: "여러 포맷 단계 중 값이 비면 지정한 값을 사용합니다." },
  { value: "kstDateTime", label: "날짜 표시", hint: "날짜/시간 값을 지정한 타임존과 형식으로 표시합니다." },
  { value: "join", label: "여러 값을 합치기", hint: "배열 값을 지정한 구분자로 이어 붙입니다." },
  { value: "mapTemplateJoin", label: "항목 문구 만들기", hint: "배열 항목마다 문구를 만들고 구분자로 합칩니다." },
  { value: "firstItem", label: "첫 번째 값만 사용", hint: "배열 값이 들어올 때 첫 번째 항목만 사용합니다." },
  { value: "currencyKo", label: "금액 표시", hint: "숫자 금액을 ko-KR 기준 금액 형태로 표시합니다." },
  { value: "phoneFormat", label: "전화번호 표시", hint: "전화번호를 읽기 쉬운 형태로 정리합니다." },
  { value: "truncate", label: "글자 수 자르기", hint: "문자열을 지정한 글자 수까지만 사용합니다." },
  { value: "replace", label: "문구 바꾸기", hint: "문자열 안의 특정 문구를 다른 문구로 바꿉니다." },
];

const publPropColumns: Array<Column<V2PublEventProp>> = [
  {
    header: "rawPath",
    field: "rawPath",
    rowHeader: true,
    width: "minmax(220px, 1.2fr)",
    renderCell: (prop) => <code className="publ-primer-code-cell">{prop.rawPath}</code>,
  },
  {
    header: "변수",
    id: "variables",
    width: "minmax(180px, 1fr)",
    renderCell: (prop) => <PropVariableCell prop={prop} />,
  },
  {
    header: "Label",
    field: "label",
    width: "minmax(132px, .8fr)",
    renderCell: (prop) => <PropTextCell value={prop.label} />,
  },
  {
    header: "Type",
    field: "type",
    width: "96px",
    renderCell: (prop) => <PropTextCell value={prop.type} />,
  },
  {
    header: "필수",
    field: "required",
    width: "88px",
    sortBy: sortByRequiredStatus,
    renderCell: (prop) => prop.required ? <Label variant="attention">필수</Label> : <Label>선택</Label>,
  },
  {
    header: "Sample",
    field: "sample",
    width: "minmax(132px, 1fr)",
    renderCell: (prop) => <PropTextCell value={prop.sample} />,
  },
  {
    header: "값 가공",
    id: "parser",
    width: "minmax(180px, 1fr)",
    renderCell: (prop) => formatParserSummary(prop),
  },
];

function sortByRequiredStatus(a: V2PublEventProp, b: V2PublEventProp) {
  return Number(b.required) - Number(a.required);
}

function propFromItem(prop: V2PublEventProp): PropDraft {
  return {
    ...prop,
    type: normalizePropType(prop.type),
    parserPipelineText: prop.parserPipeline ? JSON.stringify(prop.parserPipeline, null, 2) : "",
  };
}

function draftFromItem(item: V2PublEventItem): EventDraft {
  return {
    id: item.id,
    catalogKey: item.catalogKey,
    eventKey: item.eventKey,
    displayName: item.displayName,
    category: item.category,
    pAppCode: item.pAppCode,
    pAppName: item.pAppName,
    triggerText: item.triggerText,
    detailText: item.detailText,
    serviceStatus: normalizeStatus(item.serviceStatus),
    locationType: item.locationType,
    locationId: item.locationId,
    sourceType: item.sourceType,
    actionType: item.actionType,
    docsVersion: item.docsVersion,
    editable: item.editable,
    props: item.props.map(propFromItem),
  };
}

function createEmptyDraft(): EventDraft {
  return {
    eventKey: "",
    displayName: "",
    category: "커스텀",
    pAppCode: "",
    pAppName: "",
    triggerText: "",
    detailText: "",
    serviceStatus: "DRAFT",
    locationType: "",
    locationId: "",
    sourceType: "",
    actionType: "",
    docsVersion: "custom",
    editable: true,
    props: [
      {
        rawPath: "targetPhoneNumber",
        alias: "targetPhoneNumber",
        label: "수신자 전화번호",
        labelVariable: "수신자전화번호",
        type: "text",
        required: true,
        sample: "010-1234-1234",
        description: "",
        fallback: "",
        parserPipelineText: "",
        enabled: true,
        sortOrder: 0,
      },
    ],
  };
}

function createEmptyProp(sortOrder: number): PropDraft {
  return {
    rawPath: "",
    alias: "",
    label: "",
    labelVariable: "",
    type: "text",
    required: false,
    sample: "",
    description: "",
    fallback: "",
    parserPipelineText: "",
    enabled: true,
    sortOrder,
  };
}

export function PublEventsPage({ canManagePublEvents }: PublEventsPageProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = useMemo(() => parsePublRouteMode(pathname ?? "/publ-events"), [pathname]);
  const backPath = searchParams?.get("from") === "events" ? "/events" : "/publ-events";
  const backLabel = backPath === "/events" ? "알림톡 자동화" : "목록";

  const [data, setData] = useState<V2PublEventsResponse | null>(null);
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const currentItem = useMemo(() => {
    if (mode.kind !== "detail" && mode.kind !== "edit") {
      return null;
    }

    return data?.items.find((item) => item.eventKey === mode.eventKey) ?? null;
  }, [data?.items, mode]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.items ?? []).filter((item) => {
      const matchesQuery = !query ||
        item.displayName.toLowerCase().includes(query) ||
        item.eventKey.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        (item.pAppCode ?? "").toLowerCase().includes(query);
      const matchesCategory = categoryFilter === "ALL" || item.category === categoryFilter;
      const matchesStatus = statusFilter === "ALL" || item.serviceStatus === statusFilter;

      return matchesQuery && matchesCategory && matchesStatus;
    });
  }, [categoryFilter, data?.items, search, statusFilter]);

  useEffect(() => {
    if (!canManagePublEvents) {
      return;
    }

    void loadCatalog();
  }, [canManagePublEvents]);

  useEffect(() => {
    if (mode.kind === "list") {
      setDraft(null);
      return;
    }

    if (mode.kind === "new") {
      setDraft(createEmptyDraft());
    }
  }, [mode]);

  useEffect(() => {
    if (mode.kind !== "detail" && mode.kind !== "edit") {
      return;
    }

    if (!data) {
      return;
    }

    if (!currentItem) {
      setDraft(null);
      return;
    }

    const nextDraft = draftFromItem(currentItem);
    setDraft(nextDraft);
  }, [currentItem, data, mode]);

  if (!canManagePublEvents) {
    return <PublEventsAccessDenied />;
  }

  async function loadCatalog() {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchV2PublEvents();
      setData(next);
      return next;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Publ 이벤트를 불러오지 못했습니다.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  function updateDraftField<K extends keyof EventDraft>(field: K, value: EventDraft[K]) {
    setDraft((current) => current ? { ...current, [field]: value } : current);
  }

  function updateProp(index: number, patch: Partial<PropDraft>) {
    setDraft((current) => {
      if (!current) return current;
      const props = current.props.map((prop, propIndex) => {
        if (propIndex !== index) return prop;
        const next = { ...prop, ...patch };
        return {
          ...next,
          labelVariable: labelToVariable(next.label),
        };
      });
      return { ...current, props };
    });
  }

  function addProp() {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        props: [...current.props, createEmptyProp(current.props.length)],
      };
    });
  }

  function removeProp(index: number) {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        props: current.props.filter((_, propIndex) => propIndex !== index).map((prop, propIndex) => ({
          ...prop,
          sortOrder: propIndex,
        })),
      };
    });
  }

  async function saveDraft() {
    if (!draft) {
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const payload = buildPayload(draft);
      const response = draft.id
        ? await updateV2PublEvent(draft.id, payload)
        : await createV2PublEvent(payload);

      setNotice("Publ 이벤트가 저장되었습니다.");
      setDraft(draftFromItem(response.item));
      await loadCatalog();
      router.push(buildPublEventPath(response.item.eventKey));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Publ 이벤트 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }


  const pageTitle = getPageTitle(mode, currentItem);
  const pageDesc = getPageDescription(mode);

  return (
    <>
      {mode.kind === "detail" ? (
        <ThemeProvider colorMode="light" dayScheme="light" preventSSRMismatch>
          <PublEventDetailPageHeader
            item={currentItem}
            eventKey={mode.eventKey}
            description={pageDesc}
            backLabel={backLabel}
            backHref={backPath}
            onBack={() => router.push(backPath)}
            onEdit={(eventKey) => router.push(`${buildPublEventPath(eventKey)}/edit`)}
          />
        </ThemeProvider>
      ) : mode.kind === "new" || mode.kind === "edit" ? (
        <ThemeProvider colorMode="light" dayScheme="light" preventSSRMismatch>
          <PublEventFormPageHeader
            mode={mode.kind}
            draft={draft}
            eventKey={mode.kind === "edit" ? mode.eventKey : draft?.eventKey}
            backLabel={backLabel}
            backHref={backPath}
            saving={saving}
            onBack={() => router.push(backPath)}
            onSave={() => void saveDraft()}
          />
        </ThemeProvider>
      ) : (
        <div className="page-header">
          <div className="page-header-row">
            <div>
              <div className="page-title">{pageTitle}</div>
              <div className="page-desc">{pageDesc}</div>
            </div>
            <div className="flex items-center gap-8">
              {mode.kind !== "list" ? (
                <button className="btn btn-default" onClick={() => router.push(backPath)}>
                  <AppIcon name="chevron-left" className="icon icon-14" />
                  {backLabel}
                </button>
              ) : null}
              {mode.kind === "list" ? (
                <>
                  <button className="btn btn-default" onClick={() => void loadCatalog()} disabled={loading}>
                    <AppIcon name="refresh" className="icon icon-14" />
                    새로고침
                  </button>
                  <button className="btn btn-accent" onClick={() => router.push("/publ-events/new")}>
                    <AppIcon name="plus" className="icon icon-14" />
                    이벤트 추가
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {error ? (
        <ThemeProvider colorMode="light" dayScheme="light" preventSSRMismatch>
          <Banner title="오류" description={error} variant="warning" />
        </ThemeProvider>
      ) : null}

      {notice ? (
        <ThemeProvider colorMode="light" dayScheme="light" preventSSRMismatch>
          <Banner title="완료" description={notice} variant="success" />
        </ThemeProvider>
      ) : null}

      {mode.kind === "list" ? (
        <PublEventsListView
          data={data}
          filteredItems={filteredItems}
          loading={loading}
          search={search}
          categoryFilter={categoryFilter}
          statusFilter={statusFilter}
          onSearchChange={setSearch}
          onCategoryChange={setCategoryFilter}
          onStatusChange={setStatusFilter}
          onOpenEvent={(eventKey) => router.push(buildPublEventPath(eventKey))}
        />
      ) : null}

      {mode.kind === "detail" ? (
        <ThemeProvider colorMode="light" dayScheme="light" preventSSRMismatch>
          <PublEventDetailView
            item={currentItem}
            loading={loading}
            backLabel={backLabel}
            onBack={() => router.push(backPath)}
          />
        </ThemeProvider>
      ) : null}

      {mode.kind === "new" || mode.kind === "edit" ? (
        <ThemeProvider colorMode="light" dayScheme="light" preventSSRMismatch>
          <PublEventFormView
            draft={draft}
            loading={loading}
            onFieldChange={updateDraftField}
            onAddProp={addProp}
            onRemoveProp={removeProp}
            onChangeProp={updateProp}
          />
        </ThemeProvider>
      ) : null}
    </>
  );
}

function PublEventDetailPageHeader({
  item,
  eventKey,
  description,
  backLabel,
  backHref,
  onBack,
  onEdit,
}: {
  item: V2PublEventItem | null;
  eventKey: string;
  description: string;
  backLabel: string;
  backHref: string;
  onBack: () => void;
  onEdit: (eventKey: string) => void;
}) {
  const title = item?.displayName ?? "Publ 이벤트 상세";
  const resolvedEventKey = item?.eventKey ?? eventKey;

  return (
    <PageHeader className="publ-primer-page-header" aria-label={title} hasBorder>
      <PageHeader.ContextArea>
        <PageHeader.ParentLink href={backHref}>{backLabel}</PageHeader.ParentLink>
      </PageHeader.ContextArea>
      <PageHeader.TitleArea>
        <PageHeader.LeadingVisual>
          <WebhookIcon />
        </PageHeader.LeadingVisual>
        <PageHeader.Title as="h1">{title}</PageHeader.Title>
        {item ? (
          <PageHeader.TrailingVisual>
            <PublStatusLabel status={item.serviceStatus} />
          </PageHeader.TrailingVisual>
        ) : null}
      </PageHeader.TitleArea>
      <PageHeader.Description>
        <span className="publ-primer-header-description">
          <code>{resolvedEventKey}</code>
          <span>{description}</span>
        </span>
      </PageHeader.Description>
      <PageHeader.Actions>
        <Button leadingVisual={ArrowLeftIcon} onClick={onBack}>
          {backLabel}
        </Button>
        {item ? (
          <Button variant="primary" leadingVisual={PencilIcon} onClick={() => onEdit(item.eventKey)}>
            수정
          </Button>
        ) : null}
      </PageHeader.Actions>
    </PageHeader>
  );
}

function PublEventFormPageHeader({
  mode,
  draft,
  eventKey,
  backLabel,
  backHref,
  saving,
  onBack,
  onSave,
}: {
  mode: "new" | "edit";
  draft: EventDraft | null;
  eventKey?: string;
  backLabel: string;
  backHref: string;
  saving: boolean;
  onBack: () => void;
  onSave: () => void;
}) {
  const title = mode === "new" ? "Publ 이벤트 추가" : "Publ 이벤트 수정";
  const description = mode === "new"
    ? "새 이벤트와 알림톡 변수로 사용할 prop을 정의합니다."
    : "이벤트 정보와 알림톡 변수 prop을 수정합니다.";

  return (
    <PageHeader className="publ-primer-page-header" aria-label={title} hasBorder>
      <PageHeader.ContextArea>
        <PageHeader.ParentLink href={backHref}>{backLabel}</PageHeader.ParentLink>
      </PageHeader.ContextArea>
      <PageHeader.TitleArea>
        <PageHeader.LeadingVisual>
          <WebhookIcon />
        </PageHeader.LeadingVisual>
        <PageHeader.Title as="h1">{title}</PageHeader.Title>
        {draft ? (
          <PageHeader.TrailingVisual>
            <PublStatusLabel status={draft.serviceStatus} />
          </PageHeader.TrailingVisual>
        ) : null}
      </PageHeader.TitleArea>
      <PageHeader.Description>
        <span className="publ-primer-header-description">
          {eventKey ? <code>{eventKey}</code> : null}
          <span>{description}</span>
        </span>
      </PageHeader.Description>
      <PageHeader.Actions>
        <Button leadingVisual={ArrowLeftIcon} onClick={onBack}>
          {backLabel}
        </Button>
        <Button variant="primary" leadingVisual={CheckIcon} loading={saving} loadingAnnouncement="Publ 이벤트 저장 중" onClick={onSave}>
          {saving ? "저장 중" : "저장"}
        </Button>
      </PageHeader.Actions>
    </PageHeader>
  );
}

function PublEventsAccessDenied() {
  return (
    <ThemeProvider colorMode="light" dayScheme="light" preventSSRMismatch>
      <PageHeader className="publ-primer-page-header" aria-label="Publ 이벤트" hasBorder>
        <PageHeader.TitleArea>
          <PageHeader.LeadingVisual>
            <WebhookIcon />
          </PageHeader.LeadingVisual>
          <PageHeader.Title as="h1">Publ 이벤트</PageHeader.Title>
        </PageHeader.TitleArea>
        <PageHeader.Description>Publ 이벤트 카탈로그와 알림톡 변수를 관리합니다</PageHeader.Description>
      </PageHeader>
      <Blankslate border spacious className="publ-primer-blankslate">
        <Blankslate.Visual>
          <AlertIcon size={32} />
        </Blankslate.Visual>
        <Blankslate.Heading as="h2">접근 권한이 없습니다</Blankslate.Heading>
        <Blankslate.Description>
          Publ 협업 운영자 계정에서만 이벤트 카탈로그를 관리할 수 있습니다.
        </Blankslate.Description>
      </Blankslate>
    </ThemeProvider>
  );
}

function PublEventsListView({
  data,
  filteredItems,
  loading,
  search,
  categoryFilter,
  statusFilter,
  onSearchChange,
  onCategoryChange,
  onStatusChange,
  onOpenEvent,
}: {
  data: V2PublEventsResponse | null;
  filteredItems: V2PublEventItem[];
  loading: boolean;
  search: string;
  categoryFilter: string;
  statusFilter: string;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onOpenEvent: (eventKey: string) => void;
}) {
  return (
    <>
      <div className="dash-row dash-row-3 publ-event-stats">
        <StatBox icon="webhook" label="Catalog" value={`${data?.counts.totalCount ?? 0}개 이벤트`} hint="PDF 기본 카탈로그 + 추가 이벤트" />
        <StatBox icon="check-circle" label="Active" value={`${data?.counts.activeCount ?? 0}개 활성`} hint="제공 중 이벤트" />
        <StatBox icon="clock" label="Inactive" value={`${data?.counts.inactiveCount ?? 0}개 비활성`} hint="제공 예정 또는 대기" />
      </div>

      <section className="box publ-events-list-page" aria-labelledby="publ-events-list-title">
        <div className="box-header">
          <div>
            <div id="publ-events-list-title" className="box-title">이벤트 카탈로그</div>
            <div className="box-subtitle">목록에서 이벤트를 선택하면 상세 화면으로 이동합니다</div>
          </div>
        </div>
        <div className="box-body publ-events-filter-row">
          <div className="input-group publ-events-search">
            <input
              className="form-control"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="이벤트명, key, pApp 검색"
            />
            <button className="btn btn-default" type="button" aria-label="검색">
              <AppIcon name="search" className="icon icon-14" />
            </button>
          </div>
          <label className="form-select publ-events-filter-select">
            <select className="form-control" value={categoryFilter} onChange={(event) => onCategoryChange(event.target.value)}>
              <option value="ALL">전체 카테고리</option>
              {(data?.categories ?? []).map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
          <label className="form-select publ-events-filter-select">
            <select className="form-control" value={statusFilter} onChange={(event) => onStatusChange(event.target.value)}>
              <option value="ALL">전체 상태</option>
              <option value="ACTIVE">활성</option>
              <option value="INACTIVE">비활성</option>
              <option value="DRAFT">초안</option>
            </select>
          </label>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>이벤트</th>
                <th>상태</th>
                <th>카테고리</th>
                <th>pApp</th>
                <th>location</th>
                <th>source/action</th>
                <th>Prop</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data ? (
                Array.from({ length: 8 }).map((_, index) => (
                  <tr key={index}>
                    <td className="td-muted">Loading</td>
                    <td className="td-muted">Loading</td>
                    <td className="td-muted">Loading</td>
                    <td className="td-muted">Loading</td>
                    <td className="td-muted">Loading</td>
                    <td className="td-muted">Loading</td>
                    <td className="td-muted">Loading</td>
                  </tr>
                ))
              ) : filteredItems.length > 0 ? (
                filteredItems.map((item) => (
                  <tr key={item.id} className="publ-events-click-row" onClick={() => onOpenEvent(item.eventKey)}>
                    <td>
                      <div className="table-title-text">{item.displayName}</div>
                      <code className="td-mono td-muted">{item.eventKey}</code>
                    </td>
                    <td>{renderStatus(item.serviceStatus)}</td>
                    <td className="td-muted">{item.category}</td>
                    <td className="td-muted">{item.pAppCode || item.pAppName || "-"}</td>
                    <td className="td-muted">{[item.locationType, item.locationId].filter(Boolean).join(" / ") || "GENERAL"}</td>
                    <td className="td-muted">{[item.sourceType, item.actionType].filter(Boolean).join(" / ") || "-"}</td>
                    <td className="td-muted">{item.props.length}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state compact">
                      <div className="empty-title">조건에 맞는 이벤트가 없습니다</div>
                      <div className="empty-desc">검색어 또는 필터를 조정해 주세요.</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function PublEventDetailView({
  item,
  loading,
  backLabel,
  onBack,
}: {
  item: V2PublEventItem | null;
  loading: boolean;
  backLabel: string;
  onBack: () => void;
}) {
  if (loading && !item) {
    return (
      <div className="publ-primer-loading" role="status" aria-live="polite">
        <Spinner size="medium" srText="Publ 이벤트 상세 불러오는 중" />
        <Text size="small" weight="medium">Publ 이벤트를 불러오는 중입니다.</Text>
      </div>
    );
  }

  if (!item) {
    return (
      <Blankslate border spacious className="publ-primer-blankslate">
        <Blankslate.Visual>
          <AlertIcon size={32} />
        </Blankslate.Visual>
        <Blankslate.Heading as="h2">이벤트를 찾을 수 없습니다</Blankslate.Heading>
        <Blankslate.Description>
          목록으로 돌아가 현재 등록된 이벤트를 다시 선택해 주세요.
        </Blankslate.Description>
        <Blankslate.PrimaryAction onClick={onBack}>{backLabel}으로</Blankslate.PrimaryAction>
      </Blankslate>
    );
  }

  const variables = buildVariablesFromProps(item.props);
  const overviewItems = [
    { label: "이벤트명", value: item.displayName },
    { label: "Event key", value: item.eventKey, mono: true },
    { label: "상태", value: <PublStatusLabel status={item.serviceStatus} /> },
    { label: "카테고리", value: item.category },
    { label: "pApp", value: [item.pAppCode, item.pAppName].filter(Boolean).join(" / ") },
    { label: "문서 버전", value: item.docsVersion },
  ];
  const technicalItems = [
    { label: "Location", value: [item.locationType, item.locationId].filter(Boolean).join(" / ") },
    { label: "Source / action", value: [item.sourceType, item.actionType].filter(Boolean).join(" / ") },
    { label: "Props", value: `${item.props.length}개` },
    { label: "Variables", value: `${variables.length}개` },
  ];

  return (
    <div className="publ-primer-detail-layout">
      <div className="publ-primer-detail-top">
        <section className="publ-primer-section" aria-labelledby="publ-detail-overview-title">
          <div className="publ-primer-section-header">
            <div>
              <Heading as="h2" id="publ-detail-overview-title" className="publ-primer-section-title">
                이벤트 정보
              </Heading>
              <Text as="p" size="small" className="publ-primer-section-description">
                자동 발송 연결에 쓰이는 이벤트 정의입니다.
              </Text>
            </div>
          </div>
          <div className="publ-primer-section-body">
            <DetailMetaList items={overviewItems} />
            <div className="publ-primer-text-stack">
              <DetailTextBlock title="트리거" value={item.triggerText} />
              <DetailTextBlock title="상세 내용" value={item.detailText} />
            </div>
          </div>
        </section>

        <aside className="publ-primer-detail-pane" aria-labelledby="publ-detail-summary-title">
          <div className="publ-primer-section publ-primer-pane-section">
            <div className="publ-primer-section-header">
              <div>
                <Heading as="h2" id="publ-detail-summary-title" className="publ-primer-section-title">
                  요약
                </Heading>
                <Text as="p" size="small" className="publ-primer-section-description">
                  연결 판단에 필요한 메타 정보입니다.
                </Text>
              </div>
            </div>
            <div className="publ-primer-section-body">
              <DetailMetaList items={technicalItems} compact />
            </div>
          </div>
        </aside>
      </div>

      <section className="publ-primer-section" aria-labelledby="publ-detail-props-title">
        <div className="publ-primer-section-header">
          <div>
            <Heading as="h2" id="publ-detail-props-title" className="publ-primer-section-title">
              Prop 정의
            </Heading>
            <Text as="p" size="small" className="publ-primer-section-description">
              외부 이벤트 payload에서 변수로 변환할 값입니다.
            </Text>
          </div>
          <Label>{item.props.length}개</Label>
        </div>
        <ReadonlyPropsTable props={item.props} />
      </section>

      <section className="publ-primer-section" aria-labelledby="publ-detail-variables-title">
        <div className="publ-primer-section-header">
          <div>
            <Heading as="h2" id="publ-detail-variables-title" className="publ-primer-section-title">
              템플릿 변수
            </Heading>
            <Text as="p" size="small" className="publ-primer-section-description">
              승인 알림톡 템플릿 본문에서 사용할 수 있는 치환 변수입니다.
            </Text>
          </div>
          <Label>{variables.length}개</Label>
        </div>
        <div className="publ-primer-section-body">
          <VariableReadOnlyList variables={variables} />
        </div>
      </section>
    </div>
  );
}

function PublEventFormView({
  draft,
  loading,
  onFieldChange,
  onAddProp,
  onRemoveProp,
  onChangeProp,
}: {
  draft: EventDraft | null;
  loading: boolean;
  onFieldChange: <K extends keyof EventDraft>(field: K, value: EventDraft[K]) => void;
  onAddProp: () => void;
  onRemoveProp: (index: number) => void;
  onChangeProp: (index: number, patch: Partial<PropDraft>) => void;
}) {
  if (loading && !draft) {
    return (
      <div className="publ-primer-loading" role="status" aria-live="polite">
        <Spinner size="small" />
        <Text size="small">Publ 이벤트를 불러오는 중입니다.</Text>
      </div>
    );
  }

  if (!draft) {
    return (
      <Blankslate border spacious className="publ-primer-blankslate">
        <Blankslate.Visual>
          <AlertIcon size="medium" />
        </Blankslate.Visual>
        <Blankslate.Heading as="h2">편집할 이벤트를 찾을 수 없습니다</Blankslate.Heading>
        <Blankslate.Description>목록에서 이벤트를 다시 선택해 주세요.</Blankslate.Description>
      </Blankslate>
    );
  }

  return (
    <div className="publ-detail-stack">
      <EventEditor
        draft={draft}
        onFieldChange={onFieldChange}
      />
      <PropEditor
        props={draft.props}
        onAdd={onAddProp}
        onRemove={onRemoveProp}
        onChange={onChangeProp}
      />
    </div>
  );
}

function EventEditor({
  draft,
  onFieldChange,
}: {
  draft: EventDraft;
  onFieldChange: <K extends keyof EventDraft>(field: K, value: EventDraft[K]) => void;
}) {
  return (
    <section className="publ-primer-section" aria-labelledby="publ-edit-overview-title">
      <div className="publ-primer-section-header">
        <div>
          <Heading as="h2" id="publ-edit-overview-title" className="publ-primer-section-title">
            이벤트 정보
          </Heading>
          <Text as="p" size="small" className="publ-primer-section-description">
            변경 사항은 상단 저장 버튼을 눌러 반영됩니다.
          </Text>
        </div>
      </div>
      <div className="publ-primer-section-body">
        <div className="publ-primer-form-grid">
          <PrimerTextField label="이벤트명" value={draft.displayName} onChange={(value) => onFieldChange("displayName", value)} required />
          <PrimerTextField label="eventKey" value={draft.eventKey} onChange={(value) => onFieldChange("eventKey", value)} monospace required />
          <FormControl>
            <FormControl.Label>상태</FormControl.Label>
            <Select block value={draft.serviceStatus} onChange={(event) => onFieldChange("serviceStatus", event.target.value as EventDraft["serviceStatus"])}>
              <Select.Option value="ACTIVE">활성</Select.Option>
              <Select.Option value="INACTIVE">비활성</Select.Option>
              <Select.Option value="DRAFT">초안</Select.Option>
            </Select>
          </FormControl>
          <PrimerTextField label="카테고리" value={draft.category} onChange={(value) => onFieldChange("category", value)} />
          <PrimerTextField label="pApp 코드" value={draft.pAppCode ?? ""} onChange={(value) => onFieldChange("pAppCode", value)} />
          <PrimerTextField label="pApp 이름" value={draft.pAppName ?? ""} onChange={(value) => onFieldChange("pAppName", value)} />
          <PrimerTextField label="locationType" value={draft.locationType ?? ""} onChange={(value) => onFieldChange("locationType", value)} />
          <PrimerTextField label="locationId" value={draft.locationId ?? ""} onChange={(value) => onFieldChange("locationId", value)} />
          <PrimerTextField label="sourceType" value={draft.sourceType ?? ""} onChange={(value) => onFieldChange("sourceType", value)} />
          <PrimerTextField label="actionType" value={draft.actionType ?? ""} onChange={(value) => onFieldChange("actionType", value)} />
          <PrimerTextField label="문서 버전" value={draft.docsVersion ?? ""} onChange={(value) => onFieldChange("docsVersion", value)} />
          <PrimerTextareaField label="트리거" value={draft.triggerText ?? ""} onChange={(value) => onFieldChange("triggerText", value)} span />
          <PrimerTextareaField label="상세 내용" value={draft.detailText ?? ""} onChange={(value) => onFieldChange("detailText", value)} span />
        </div>
      </div>
    </section>
  );
}

function PropEditor({
  props,
  onAdd,
  onRemove,
  onChange,
}: {
  props: PropDraft[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (index: number, patch: Partial<PropDraft>) => void;
}) {
  return (
    <section className="publ-primer-section" aria-labelledby="publ-edit-props-title">
      <div className="publ-primer-section-header">
        <div>
          <Heading as="h2" id="publ-edit-props-title" className="publ-primer-section-title">
            Prop 정의
          </Heading>
          <Text as="p" size="small" className="publ-primer-section-description">
            rawPath에서 값을 꺼내 alias와 label 변수로 제공합니다.
          </Text>
        </div>
        <Button leadingVisual={PlusIcon} onClick={onAdd}>
          Prop 추가
        </Button>
      </div>
      <div className="publ-primer-section-body">
        {props.length === 0 ? (
          <Blankslate border className="publ-primer-blankslate" size="small">
            <Blankslate.Heading as="h3">등록된 Prop이 없습니다</Blankslate.Heading>
            <Blankslate.Description>
              Prop 추가를 눌러 알림톡 변수로 사용할 payload 경로를 정의하세요.
            </Blankslate.Description>
          </Blankslate>
        ) : (
          <div className="publ-primer-prop-editor-list">
            {props.map((prop, index) => (
              <section key={`${prop.rawPath || "prop"}-${index}`} className="publ-primer-prop-editor-row" aria-label={prop.label || prop.rawPath || `Prop ${index + 1}`}>
                <div className="publ-primer-prop-editor-row-header">
                  <div className="publ-primer-prop-editor-row-title">
                    <Heading as="h3" className="publ-primer-subsection-title">
                      {prop.label || prop.rawPath || `Prop ${index + 1}`}
                    </Heading>
                    <Text as="p" size="small" className="publ-primer-prop-editor-row-desc">
                      {prop.alias ? `#{${prop.alias}}` : "alias 미설정"}
                    </Text>
                  </div>
                  <Button variant="danger" size="small" leadingVisual={TrashIcon} onClick={() => onRemove(index)}>
                    삭제
                  </Button>
                </div>
                <div className="publ-primer-prop-editor-grid">
                  <PrimerTextField label="rawPath" value={prop.rawPath} onChange={(value) => onChange(index, { rawPath: value })} monospace required />
                  <PrimerTextField label="alias" value={prop.alias} onChange={(value) => onChange(index, { alias: value })} monospace />
                  <PrimerTextField
                    label="label"
                    value={prop.label}
                    onChange={(value) => onChange(index, { label: value })}
                    caption={`템플릿 변수: #{${labelToVariable(prop.label) || "변수명"}}`}
                  />
                  <FormControl>
                    <FormControl.Label>type</FormControl.Label>
                    <Select block value={prop.type} onChange={(event) => onChange(index, { type: normalizePropType(event.target.value) })}>
                      {PROP_TYPES.map((type) => (
                        <Select.Option key={type} value={type}>{type}</Select.Option>
                      ))}
                    </Select>
                  </FormControl>
                  <PrimerTextField label="샘플 값" value={prop.sample ?? ""} onChange={(value) => onChange(index, { sample: value })} />
                  <PrimerTextField
                    label="대체값"
                    value={prop.fallback ?? ""}
                    onChange={(value) => onChange(index, { fallback: value })}
                    caption="payload 값이 비어 있을 때 사용할 값입니다."
                  />
                  <div className="publ-primer-prop-editor-checks" role="group" aria-label="Prop 설정">
                    <FormControl layout="horizontal">
                      <Checkbox checked={prop.required} onChange={(event) => onChange(index, { required: event.target.checked })} />
                      <FormControl.Label>필수</FormControl.Label>
                      <FormControl.Caption>이 값이 없으면 템플릿 치환에 실패할 수 있습니다.</FormControl.Caption>
                    </FormControl>
                    <FormControl layout="horizontal">
                      <Checkbox checked={prop.enabled} onChange={(event) => onChange(index, { enabled: event.target.checked })} />
                      <FormControl.Label>사용</FormControl.Label>
                      <FormControl.Caption>꺼두면 템플릿 변수 목록에서 제외됩니다.</FormControl.Caption>
                    </FormControl>
                  </div>
                  <PropFormatGroup prop={prop} onChange={(patch) => onChange(index, patch)} />
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function PropFormatGroup({
  prop,
  onChange,
}: {
  prop: PropDraft;
  onChange: (patch: Partial<PropDraft>) => void;
}) {
  const preset = getParserPreset(prop.parserPipelineText);

  return (
    <fieldset className="publ-primer-format-group">
      <legend>포맷</legend>
      <div className="publ-primer-format-group-body">
        <FormControl>
          <FormControl.Label>방식</FormControl.Label>
          <Select
            block
            value={preset}
            onChange={(event) => onChange({ parserPipelineText: parserPresetToText(event.target.value as SelectableParserPreset, prop) })}
          >
            {preset === "unsupported" ? (
              <Select.Option value="unsupported" disabled>기존 고급 포맷</Select.Option>
            ) : null}
            {PARSER_PRESETS.map((item) => (
              <Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>
            ))}
          </Select>
          <FormControl.Caption>{getParserPresetHint(preset)}</FormControl.Caption>
        </FormControl>
        <PropFormatOptions prop={prop} preset={preset} onChange={onChange} />
        <PropFormatPreview prop={prop} />
      </div>
    </fieldset>
  );
}

function PropFormatOptions({
  prop,
  preset,
  onChange,
}: {
  prop: PropDraft;
  preset: ParserPreset;
  onChange: (patch: Partial<PropDraft>) => void;
}) {
  if (preset === "fallback") {
    const value = getFallbackConfig(prop.parserPipelineText, prop.fallback);
    return (
      <PrimerTextField
        label="중간 대체값"
        value={value}
        onChange={(next) => onChange({ parserPipelineText: fallbackPresetToText(next) })}
        caption="일반적인 값 없음 처리는 위 대체값을 사용하세요."
      />
    );
  }

  if (preset === "kstDateTime") {
    const config = getDateFormatConfig(prop.parserPipelineText);
    return (
      <div className="publ-primer-format-options-grid">
        <PrimerTextField
          label="타임존"
          value={config.timezone}
          onChange={(timezone) => onChange({ parserPipelineText: dateFormatPresetToText({ ...config, timezone }) })}
        />
        <PrimerTextField
          label="표시 형식"
          value={config.format}
          onChange={(format) => onChange({ parserPipelineText: dateFormatPresetToText({ ...config, format }) })}
          monospace
        />
      </div>
    );
  }

  if (preset === "join") {
    const separator = getJoinSeparator(prop.parserPipelineText, ", ");
    return (
      <PrimerTextField
        label="구분자"
        value={separator}
        onChange={(next) => onChange({ parserPipelineText: joinPresetToText(next) })}
        caption="예: 쉼표와 공백은 ', '로 입력합니다."
      />
    );
  }

  if (preset === "mapTemplateJoin") {
    const config = getMapTemplateJoinConfig(prop.parserPipelineText);
    return (
      <div className="publ-primer-format-options-stack">
        <PrimerTextareaField
          label="항목 문구"
          value={config.template}
          onChange={(template) => onChange({ parserPipelineText: mapTemplateJoinPresetToText({ ...config, template }) })}
          placeholder="#{productName} #{qty}개"
          caption="배열 항목의 필드는 #{field} 또는 {{field}}로 넣습니다."
        />
        <PrimerTextField
          label="구분자"
          value={config.separator}
          onChange={(separator) => onChange({ parserPipelineText: mapTemplateJoinPresetToText({ ...config, separator }) })}
        />
      </div>
    );
  }

  if (preset === "currencyKo") {
    const config = getCurrencyFormatConfig(prop.parserPipelineText, prop.rawPath);
    return (
      <div className="publ-primer-format-options-grid">
        <PrimerTextField
          label="통화 경로"
          value={config.currencyPath}
          onChange={(currencyPath) => onChange({ parserPipelineText: currencyPresetToText({ ...config, currencyPath }) })}
          monospace
        />
        <PrimerTextField
          label="locale"
          value={config.locale}
          onChange={(locale) => onChange({ parserPipelineText: currencyPresetToText({ ...config, locale }) })}
          monospace
        />
      </div>
    );
  }

  if (preset === "truncate") {
    const length = getTruncateLength(prop.parserPipelineText);
    return (
      <PrimerTextField
        label="최대 글자 수"
        value={length}
        onChange={(next) => onChange({ parserPipelineText: truncatePresetToText(next.replace(/\D/g, "")) })}
      />
    );
  }

  if (preset === "replace") {
    const config = getReplaceConfig(prop.parserPipelineText);
    return (
      <div className="publ-primer-format-options-grid">
        <PrimerTextField
          label="찾을 문구"
          value={config.from}
          onChange={(from) => onChange({ parserPipelineText: replacePresetToText({ ...config, from }) })}
        />
        <PrimerTextField
          label="바꿀 문구"
          value={config.to}
          onChange={(to) => onChange({ parserPipelineText: replacePresetToText({ ...config, to }) })}
        />
      </div>
    );
  }

  if (preset === "unsupported") {
    return (
      <Text as="p" size="small" className="publ-primer-format-preview-note">
        이 이벤트에는 여러 단계가 조합된 기존 포맷이 있습니다. 지원되는 방식 중 하나로 다시 선택하면 UI에서 관리할 수 있습니다.
      </Text>
    );
  }

  return null;
}

function PropFormatPreview({ prop }: { prop: PropDraft }) {
  const preview = buildPropFormatPreview(prop);

  return (
    <div className="publ-primer-format-preview" aria-label="포맷 미리보기">
      <div className="publ-primer-format-preview-head">
        <Heading as="h4" className="publ-primer-subsection-title">포맷 미리보기</Heading>
        {preview.fallbackUsed ? <Label variant="secondary">대체값 적용</Label> : null}
        {preview.error ? <Label variant="attention">확인 필요</Label> : null}
      </div>
      <div className="publ-primer-format-preview-flow">
        <div className="publ-primer-format-preview-item">
          <span>샘플 값</span>
          <code>{preview.source}</code>
        </div>
        <div className="publ-primer-format-preview-arrow" aria-hidden="true">→</div>
        <div className="publ-primer-format-preview-item">
          <span>결과</span>
          <code>{preview.result}</code>
        </div>
      </div>
      {preview.error ? (
        <Text as="p" size="small" className="publ-primer-format-preview-note">
          {preview.error}
        </Text>
      ) : null}
    </div>
  );
}

function PropVariableCell({ prop }: { prop: V2PublEventProp }) {
  const labelVariable = labelToVariable(prop.label);

  return (
    <div className="publ-primer-prop-variable-cell">
      {prop.alias ? <code>#{prop.alias}</code> : null}
      {labelVariable ? <code>#{labelVariable}</code> : null}
    </div>
  );
}

function PropTextCell({ value }: { value?: string | null }) {
  if (!value) {
    return "";
  }

  return <span className="publ-primer-cell-text">{value}</span>;
}

function ReadonlyPropsTable({ props }: { props: V2PublEventProp[] }) {
  if (props.length === 0) {
    return (
      <div className="publ-primer-section-body">
        <Blankslate border className="publ-primer-blankslate" size="small">
          <Blankslate.Heading as="h3">등록된 Prop이 없습니다</Blankslate.Heading>
          <Blankslate.Description>
            이 이벤트에서 알림톡 변수로 사용할 payload 경로가 아직 정의되지 않았습니다.
          </Blankslate.Description>
        </Blankslate>
      </div>
    );
  }

  return (
    <Table.Container className="publ-primer-prop-table">
      <DataTable
        aria-labelledby="publ-detail-props-title"
        cellPadding="normal"
        data={props}
        columns={publPropColumns}
      />
    </Table.Container>
  );
}

function formatParserSummary(prop: V2PublEventProp) {
  if (hasParserPipeline(prop.parserPipeline)) {
    return <ParserPipelineCell pipeline={prop.parserPipeline} />;
  }

  if (prop.fallback) {
    return <PropTextCell value={`fallback: ${prop.fallback}`} />;
  }

  return "";
}

function ParserPipelineCell({ pipeline }: { pipeline: unknown }) {
  return (
    <details className="publ-primer-parser-details">
      <summary>{describeParserPipeline(pipeline)}</summary>
      <pre className="publ-primer-parser-json">{formatJsonValue(pipeline)}</pre>
    </details>
  );
}

function hasParserPipeline(value: unknown) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return value !== null && value !== undefined && value !== "";
}

function describeParserPipeline(value: unknown) {
  if (!Array.isArray(value)) {
    return "저장된 포맷";
  }

  const labels = value.map((step, index) => describeParserStep(step, index));
  return labels.join(" -> ");
}

function describeParserStep(step: unknown, index: number) {
  if (!isPlainObject(step)) {
    return `${index + 1}단계`;
  }

  const type = typeof step.type === "string" ? step.type : "parser";
  if (type === "dateFormat") {
    return ["dateFormat", stringifySummaryPart(step.timezone), stringifySummaryPart(step.format)].filter(Boolean).join(" · ");
  }

  if (type === "currencyFormat") {
    return ["currencyFormat", stringifySummaryPart(step.currencyPath), stringifySummaryPart(step.locale)].filter(Boolean).join(" · ");
  }

  if (type === "join") {
    return ["join", stringifySummaryPart(step.separator)].filter(Boolean).join(" · ");
  }

  if (type === "mapTemplate") {
    return "mapTemplate";
  }

  if (type === "firstItem") {
    return "firstItem";
  }

  if (type === "phoneFormat") {
    return ["phoneFormat", stringifySummaryPart(step.country)].filter(Boolean).join(" · ");
  }

  return type;
}

function stringifySummaryPart(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
}

function formatJsonValue(value: unknown) {
  const json = JSON.stringify(value, null, 2);
  return json ?? String(value);
}

function DetailMetaList({
  items,
  compact,
}: {
  items: Array<{ label: string; value?: ReactNode; mono?: boolean }>;
  compact?: boolean;
}) {
  return (
    <dl className={compact ? "publ-primer-meta-list compact" : "publ-primer-meta-list"}>
      {items.map((item) => (
        <div key={item.label} className="publ-primer-meta-item">
          <dt>{item.label}</dt>
          <dd className={item.mono ? "mono" : undefined}>{renderDetailValue(item.value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function renderDetailValue(value: ReactNode) {
  if (value === null || value === undefined || value === "") {
    return <span className="publ-primer-empty-text">등록되지 않음</span>;
  }

  if (typeof value === "string" && !value.trim()) {
    return <span className="publ-primer-empty-text">등록되지 않음</span>;
  }

  return value;
}

function DetailTextBlock({ title, value }: { title: string; value?: string | null }) {
  return (
    <section className="publ-primer-text-block" aria-label={title}>
      <Heading as="h3" className="publ-primer-subsection-title">{title}</Heading>
      <Text as="p" size="small" className="publ-primer-long-text">
        {value?.trim() || "등록되지 않음"}
      </Text>
    </section>
  );
}

function PrimerTextField({
  label,
  value,
  onChange,
  caption,
  placeholder,
  monospace,
  required,
  span,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  caption?: string;
  placeholder?: string;
  monospace?: boolean;
  required?: boolean;
  span?: boolean;
}) {
  return (
    <FormControl required={required} className={span ? "publ-primer-form-span" : undefined}>
      <FormControl.Label>{label}</FormControl.Label>
      <TextInput
        block
        monospace={monospace}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      {caption ? <FormControl.Caption>{caption}</FormControl.Caption> : null}
    </FormControl>
  );
}

function PrimerTextareaField({
  label,
  value,
  onChange,
  caption,
  placeholder,
  monospace,
  span,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  caption?: string;
  placeholder?: string;
  monospace?: boolean;
  span?: boolean;
}) {
  return (
    <FormControl className={span ? "publ-primer-form-span" : undefined}>
      <FormControl.Label>{label}</FormControl.Label>
      <Textarea
        block
        resize="vertical"
        minHeight={96}
        className={monospace ? "publ-primer-textarea-mono" : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      {caption ? <FormControl.Caption>{caption}</FormControl.Caption> : null}
    </FormControl>
  );
}

type TemplateVariable = { key: string; label: string; rawPath: string; required: boolean };

function VariableReadOnlyList({
  variables,
}: {
  variables: TemplateVariable[];
}) {
  if (variables.length === 0) {
    return <Text as="p" size="small" className="publ-primer-empty-text">사용 가능한 템플릿 변수가 없습니다.</Text>;
  }

  const requiredVariables = variables.filter((variable) => variable.required);
  const optionalVariables = variables.filter((variable) => !variable.required);

  return (
    <div className="publ-primer-variable-groups">
      {requiredVariables.length > 0 ? (
        <VariableReadOnlyGroup title="필수 변수" variables={requiredVariables} />
      ) : null}
      {optionalVariables.length > 0 ? (
        <VariableReadOnlyGroup title="선택 변수" variables={optionalVariables} />
      ) : null}
    </div>
  );
}

function VariableReadOnlyGroup({
  title,
  variables,
}: {
  title: string;
  variables: TemplateVariable[];
}) {
  return (
    <section className="publ-primer-variable-group" aria-label={title}>
      <div className="publ-primer-variable-group-header">
        <Heading as="h3" className="publ-primer-variable-group-title">
          {title}
        </Heading>
        <CounterLabel>{variables.length}</CounterLabel>
      </div>
      <div className="publ-primer-variable-list">
        {variables.map((variable) => (
          <div key={variable.key} className="publ-primer-variable-token">
            <code>#{variable.key}</code>
            <span>{variable.label} · {variable.rawPath}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatBox({ icon, label, value, hint }: { icon: "webhook" | "check-circle" | "clock"; label: string; value: string; hint: string }) {
  return (
    <div className="box box-no-margin">
      <div className="box-body" style={{ padding: "14px 16px" }}>
        <div className="flex items-center gap-8" style={{ marginBottom: 4 }}>
          <AppIcon name={icon} className="icon icon-16" style={{ color: "var(--accent-fg)" }} />
          <span className="text-small text-muted">{label}</span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{value}</div>
        <div className="text-small text-muted mt-8">{hint}</div>
      </div>
    </div>
  );
}

function renderStatus(status: string) {
  return <PublStatusLabel status={status} />;
}

function PublStatusLabel({ status }: { status: string }) {
  if (status === "ACTIVE") {
    return <Label variant="success">활성</Label>;
  }

  if (status === "INACTIVE") {
    return <Label variant="secondary">비활성</Label>;
  }

  return <Label variant="attention">초안</Label>;
}

function buildPayload(draft: EventDraft): V2UpsertPublEventPayload {
  return {
    eventKey: draft.eventKey,
    displayName: draft.displayName,
    category: draft.category,
    pAppCode: draft.pAppCode ?? undefined,
    pAppName: draft.pAppName ?? undefined,
    triggerText: draft.triggerText ?? undefined,
    detailText: draft.detailText ?? undefined,
    serviceStatus: draft.serviceStatus,
    locationType: draft.locationType ?? undefined,
    locationId: draft.locationId ?? undefined,
    sourceType: draft.sourceType ?? undefined,
    actionType: draft.actionType ?? undefined,
    docsVersion: draft.docsVersion ?? undefined,
    props: draft.props.map((prop, index) => ({
      id: prop.id,
      rawPath: prop.rawPath,
      alias: prop.alias,
      label: prop.label,
      type: prop.type,
      required: prop.required,
      sample: prop.sample ?? undefined,
      description: prop.description ?? undefined,
      fallback: prop.fallback ?? undefined,
      parserPipeline: parseParserPipeline(prop.parserPipelineText),
      enabled: prop.enabled,
      sortOrder: index,
    })),
  };
}

function parseParserPipeline(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    throw new Error("parserPipeline JSON 형식을 확인해 주세요.");
  }
}

function getParserPreset(value: string): ParserPreset {
  const trimmed = value.trim();
  if (!trimmed) {
    return "none";
  }

  const steps = parseParserSteps(trimmed);
  if (!steps) {
    return "unsupported";
  }

  if (steps.length === 0) {
    return "none";
  }

  if (steps.length === 2 && steps[0]?.type === "mapTemplate" && steps[1]?.type === "join") {
    return "mapTemplateJoin";
  }

  if (steps.length !== 1) {
    return "unsupported";
  }

  const [step] = steps;
  if (step.type === "fallback") return "fallback";
  if (step.type === "dateFormat") return "kstDateTime";
  if (step.type === "join") return "join";
  if (step.type === "firstItem") return "firstItem";
  if (step.type === "currencyFormat") return "currencyKo";
  if (step.type === "phoneFormat") return "phoneFormat";
  if (step.type === "truncate") return "truncate";
  if (step.type === "replace") return "replace";

  return "unsupported";
}

function parserPresetToText(preset: SelectableParserPreset, prop: PropDraft) {
  switch (preset) {
    case "none":
      return "";
    case "fallback":
      return fallbackPresetToText(getFallbackConfig(prop.parserPipelineText, prop.fallback));
    case "kstDateTime":
      return dateFormatPresetToText(getDateFormatConfig(prop.parserPipelineText));
    case "join":
      return joinPresetToText(getJoinSeparator(prop.parserPipelineText, ", "));
    case "mapTemplateJoin":
      return mapTemplateJoinPresetToText(getMapTemplateJoinConfig(prop.parserPipelineText));
    case "firstItem":
      return formatPipelineText([{ type: "firstItem" }]);
    case "currencyKo":
      return currencyPresetToText(getCurrencyFormatConfig(prop.parserPipelineText, prop.rawPath));
    case "phoneFormat":
      return formatPipelineText([{ type: "phoneFormat", country: "KR" }]);
    case "truncate":
      return truncatePresetToText(getTruncateLength(prop.parserPipelineText));
    case "replace":
      return replacePresetToText(getReplaceConfig(prop.parserPipelineText));
  }
}

function getParserPresetHint(preset: ParserPreset) {
  if (preset === "unsupported") {
    return "기존에 저장된 고급 포맷입니다. 지원되는 방식 중 하나로 다시 선택하면 UI에서 관리됩니다.";
  }

  return PARSER_PRESETS.find((item) => item.value === preset)?.hint ?? "";
}

function parseParserSteps(value: string): Array<Record<string, unknown>> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed) || parsed.some((step) => !isPlainObject(step))) {
      return null;
    }

    return parsed as Array<Record<string, unknown>>;
  } catch {
    return null;
  }
}

function formatPipelineText(steps: Array<Record<string, unknown>>) {
  return steps.length > 0 ? JSON.stringify(steps, null, 2) : "";
}

function getFallbackConfig(parserPipelineText: string, propFallback?: string | null) {
  const step = getSingleParserStep(parserPipelineText, "fallback");
  const value = step?.value ?? step?.fallback ?? step?.defaultValue;
  return typeof value === "string" ? value : propFallback ?? "";
}

function fallbackPresetToText(value: string) {
  return formatPipelineText([{ type: "fallback", value }]);
}

function getDateFormatConfig(parserPipelineText: string) {
  const step = getSingleParserStep(parserPipelineText, "dateFormat");
  return {
    timezone: typeof step?.timezone === "string" ? step.timezone : "Asia/Seoul",
    format: typeof step?.format === "string" ? step.format : "yyyy년 M월 d일 HH:mm",
  };
}

function dateFormatPresetToText(config: { timezone: string; format: string }) {
  return formatPipelineText([{ type: "dateFormat", timezone: config.timezone || "Asia/Seoul", format: config.format || "yyyy년 M월 d일 HH:mm" }]);
}

function getJoinSeparator(parserPipelineText: string, fallback: string) {
  const step = getSingleParserStep(parserPipelineText, "join") ?? getMapTemplateJoinStep(parserPipelineText);
  return typeof step?.separator === "string" ? step.separator : fallback;
}

function joinPresetToText(separator: string) {
  return formatPipelineText([{ type: "join", separator }]);
}

function getMapTemplateJoinConfig(parserPipelineText: string) {
  const steps = parseParserSteps(parserPipelineText.trim());
  const mapStep = steps?.find((step) => step.type === "mapTemplate");
  const joinStep = steps?.find((step) => step.type === "join");
  return {
    template: typeof mapStep?.template === "string" ? mapStep.template : "#{name}",
    separator: typeof joinStep?.separator === "string" ? joinStep.separator : ", ",
  };
}

function mapTemplateJoinPresetToText(config: { template: string; separator: string }) {
  return formatPipelineText([
    { type: "mapTemplate", template: config.template || "#{name}" },
    { type: "join", separator: config.separator },
  ]);
}

function getCurrencyFormatConfig(parserPipelineText: string, rawPath: string) {
  const step = getSingleParserStep(parserPipelineText, "currencyFormat");
  return {
    currencyPath: typeof step?.currencyPath === "string" ? step.currencyPath : inferCurrencyPath(rawPath),
    locale: typeof step?.locale === "string" ? step.locale : "ko-KR",
  };
}

function currencyPresetToText(config: { currencyPath: string; locale: string }) {
  return formatPipelineText([{ type: "currencyFormat", currencyPath: config.currencyPath || "currency", locale: config.locale || "ko-KR" }]);
}

function getTruncateLength(parserPipelineText: string) {
  const step = getSingleParserStep(parserPipelineText, "truncate");
  const length = step?.maxLength ?? step?.length;
  return typeof length === "number" && Number.isFinite(length) ? String(length) : "20";
}

function truncatePresetToText(lengthText: string) {
  const length = Number(lengthText || "0");
  return formatPipelineText([{ type: "truncate", length: Number.isFinite(length) ? length : 0 }]);
}

function getReplaceConfig(parserPipelineText: string) {
  const step = getSingleParserStep(parserPipelineText, "replace");
  return {
    from: typeof step?.from === "string" ? step.from : "",
    to: typeof step?.to === "string" ? step.to : "",
  };
}

function replacePresetToText(config: { from: string; to: string }) {
  return formatPipelineText([{ type: "replace", from: config.from, to: config.to }]);
}

function getSingleParserStep(parserPipelineText: string, type: string) {
  const steps = parseParserSteps(parserPipelineText.trim());
  return steps?.length === 1 && steps[0]?.type === type ? steps[0] : null;
}

function getMapTemplateJoinStep(parserPipelineText: string) {
  const steps = parseParserSteps(parserPipelineText.trim());
  return steps?.length === 2 && steps[0]?.type === "mapTemplate" && steps[1]?.type === "join" ? steps[1] : null;
}

function inferCurrencyPath(rawPath: string) {
  const parts = rawPath.split(".");
  if (parts.length <= 1) {
    return "currency";
  }

  return [...parts.slice(0, -1), "currency"].join(".");
}

function buildPropFormatPreview(prop: PropDraft) {
  const sampleValue = parsePreviewSampleValue(prop.sample, prop.type);
  const fallbackValue = prop.fallback?.trim() ? prop.fallback : undefined;
  const fallbackUsedBeforeFormat = isMissingPreviewValue(sampleValue);
  const sourceValue = fallbackUsedBeforeFormat ? fallbackValue : sampleValue;
  const root = buildPreviewRoot(prop.rawPath, sourceValue);
  const pipelineResult = parsePreviewPipeline(prop.parserPipelineText);

  if (pipelineResult.error) {
    return {
      source: formatPreviewValue(sampleValue),
      result: formatPreviewValue(sourceValue),
      fallbackUsed: fallbackUsedBeforeFormat,
      error: pipelineResult.error,
    };
  }

  const formattedValue = applyPreviewParserPipeline(sourceValue, pipelineResult.pipeline, root);
  const fallbackUsedAfterFormat = isMissingPreviewValue(formattedValue);
  const resultValue = normalizePreviewVariableValue(fallbackUsedAfterFormat ? fallbackValue : formattedValue);

  return {
    source: formatPreviewValue(sampleValue),
    result: resultValue === undefined ? "변수 미생성" : formatPreviewValue(resultValue),
    fallbackUsed: Boolean(fallbackValue && (fallbackUsedBeforeFormat || fallbackUsedAfterFormat)),
    error: null,
  };
}

function parsePreviewSampleValue(sample: string | null | undefined, type: PropDraft["type"]): unknown {
  const trimmed = sample?.trim() ?? "";
  if (!trimmed) {
    return undefined;
  }

  if (type === "number") {
    const numberValue = Number(trimmed.replace(/,/g, ""));
    return Number.isFinite(numberValue) ? numberValue : sample;
  }

  if (type === "boolean") {
    if (trimmed.toLowerCase() === "true") return true;
    if (trimmed.toLowerCase() === "false") return false;
  }

  if (type === "array" || type === "object") {
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return sample;
    }
  }

  return sample;
}

function parsePreviewPipeline(value: string): { pipeline: unknown[]; error: string | null } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { pipeline: [], error: null };
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) {
      return { pipeline: [], error: "저장된 포맷은 parser block 배열이어야 합니다." };
    }

    return { pipeline: parsed, error: null };
  } catch {
    return { pipeline: [], error: "저장된 포맷 형식을 확인해 주세요." };
  }
}

function applyPreviewParserPipeline(value: unknown, pipeline: unknown[], root: Record<string, unknown>) {
  return pipeline.reduce((current, step) => {
    if (!step || typeof step !== "object" || Array.isArray(step)) {
      return current;
    }

    return applyPreviewParserStep(current, step as Record<string, unknown>, root);
  }, value);
}

function applyPreviewParserStep(value: unknown, step: Record<string, unknown>, root: Record<string, unknown>) {
  switch (step.type) {
    case "none":
      return value;
    case "fallback":
      return isMissingPreviewValue(value) ? step.value ?? step.fallback ?? step.defaultValue : value;
    case "firstItem":
      return Array.isArray(value) ? value[0] : value;
    case "mapTemplate":
      return applyPreviewMapTemplate(value, typeof step.template === "string" ? step.template : "", root);
    case "join":
      return Array.isArray(value)
        ? value
            .map((item) => normalizePreviewVariableValue(item))
            .filter((item): item is string | number => item !== undefined)
            .map(String)
            .join(typeof step.separator === "string" ? step.separator : "")
        : value;
    case "dateFormat":
      return formatPreviewDate(value, step);
    case "currencyFormat":
      return formatPreviewCurrency(value, step, root);
    case "phoneFormat":
      return formatPreviewPhone(value);
    case "truncate":
      return truncatePreviewValue(value, step);
    case "replace":
      return replacePreviewValue(value, step);
    default:
      return value;
  }
}

function applyPreviewMapTemplate(value: unknown, template: string, root: Record<string, unknown>) {
  if (!template) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => renderPreviewTemplate(template, item, root));
  }

  return renderPreviewTemplate(template, value, root);
}

function renderPreviewTemplate(template: string, local: unknown, root: Record<string, unknown>) {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}|#\{\s*([^}]+?)\s*\}/g, (_, mustacheKey: string | undefined, hashKey: string | undefined) => {
    const key = (mustacheKey ?? hashKey ?? "").trim();
    const localValue =
      local && typeof local === "object" && !Array.isArray(local)
        ? readPreviewPath(local as Record<string, unknown>, key)
        : undefined;
    const rootValue = localValue === undefined ? readPreviewPath(root, key) : localValue;
    const normalized = normalizePreviewVariableValue(rootValue);
    return normalized === undefined ? "" : String(normalized);
  });
}

function formatPreviewDate(value: unknown, step: Record<string, unknown>) {
  const source = normalizePreviewVariableValue(value);
  if (source === undefined) {
    return value;
  }

  const date = new Date(source);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const timeZone = typeof step.timezone === "string" ? step.timezone : "Asia/Seoul";
  const format = typeof step.format === "string" ? step.format : "yyyy년 M월 d일 HH:mm";
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const values: Record<string, string> = {
    yyyy: parts.year,
    MM: parts.month,
    M: String(Number(parts.month)),
    dd: parts.day,
    d: String(Number(parts.day)),
    HH: parts.hour,
    mm: parts.minute,
  };

  return format.replace(/yyyy|MM|dd|HH|mm|M|d/g, (token) => values[token] ?? token);
}

function formatPreviewCurrency(value: unknown, step: Record<string, unknown>, root: Record<string, unknown>) {
  const source = normalizePreviewVariableValue(value);
  if (source === undefined) {
    return value;
  }

  const amount = typeof source === "number" ? source : Number(String(source).replace(/,/g, ""));
  if (!Number.isFinite(amount)) {
    return value;
  }

  const locale = typeof step.locale === "string" ? step.locale : "ko-KR";
  const currency =
    typeof step.currency === "string"
      ? step.currency
      : typeof step.currencyPath === "string"
        ? normalizePreviewVariableValue(readPreviewPath(root, step.currencyPath))?.toString()
        : undefined;

  if (!currency) {
    return new Intl.NumberFormat(locale).format(amount);
  }

  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
  } catch {
    return `${new Intl.NumberFormat(locale).format(amount)} ${currency}`;
  }
}

function formatPreviewPhone(value: unknown) {
  const source = normalizePreviewVariableValue(value);
  if (source === undefined) {
    return value;
  }

  const digits = String(source).replace(/\D/g, "");
  if (/^010\d{8}$/.test(digits)) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  if (/^02\d{7,8}$/.test(digits)) {
    return digits.length === 9
      ? `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`
      : `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  if (/^0\d{9,10}$/.test(digits)) {
    return digits.length === 10
      ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
      : `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  return source;
}

function truncatePreviewValue(value: unknown, step: Record<string, unknown>) {
  const source = normalizePreviewVariableValue(value);
  const maxLength = Number(step.maxLength ?? step.length);

  if (source === undefined || !Number.isInteger(maxLength) || maxLength < 0) {
    return value;
  }

  return String(source).slice(0, maxLength);
}

function replacePreviewValue(value: unknown, step: Record<string, unknown>) {
  const source = normalizePreviewVariableValue(value);
  const from = typeof step.from === "string" ? step.from : null;
  const to = typeof step.to === "string" ? step.to : "";

  if (source === undefined || !from) {
    return value;
  }

  return String(source).split(from).join(to);
}

function normalizePreviewVariableValue(value: unknown): string | number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "boolean") {
    return String(value);
  }

  return undefined;
}

function isMissingPreviewValue(value: unknown) {
  return value === undefined || value === null || value === "";
}

function formatPreviewValue(value: unknown) {
  if (isMissingPreviewValue(value)) {
    return "값 없음";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildPreviewRoot(rawPath: string, value: unknown) {
  const root: Record<string, unknown> = {};
  const parts = rawPath.split(".").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) {
    return root;
  }

  let current = root;
  for (const [index, part] of parts.entries()) {
    if (index === parts.length - 1) {
      current[part] = value;
      break;
    }

    const next: Record<string, unknown> = {};
    current[part] = next;
    current = next;
  }

  return root;
}

function readPreviewPath(source: Record<string, unknown>, rawPath: string): unknown {
  const parts = rawPath.split(".").map((part) => part.trim()).filter(Boolean);
  let current: unknown = source;

  for (const part of parts) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeStatus(status: string): EventDraft["serviceStatus"] {
  if (status === "ACTIVE" || status === "INACTIVE" || status === "DRAFT") {
    return status;
  }

  return "DRAFT";
}

function normalizePropType(type: string): PropDraft["type"] {
  return PROP_TYPES.includes(type as PropDraft["type"]) ? type as PropDraft["type"] : "text";
}

function labelToVariable(label: string) {
  return label.replace(/\s+/g, "").trim();
}

function buildVariablesFromProps(props: V2PublEventProp[]) {
  const all = new Map<string, { key: string; label: string; rawPath: string; required: boolean }>();
  for (const prop of props) {
    if (!prop.enabled) continue;
    if (prop.alias) {
      all.set(prop.alias, {
        key: prop.alias,
        label: prop.label || prop.alias,
        rawPath: prop.rawPath,
        required: prop.required,
      });
    }

    const labelVariable = labelToVariable(prop.label);
    if (labelVariable) {
      all.set(labelVariable, {
        key: labelVariable,
        label: prop.label || labelVariable,
        rawPath: prop.rawPath,
        required: prop.required,
      });
    }
  }

  return Array.from(all.values()).sort((a, b) => Number(b.required) - Number(a.required) || a.key.localeCompare(b.key));
}

function parsePublRouteMode(pathname: string): PublRouteMode {
  const normalized = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
  const parts = normalized.split("/").filter(Boolean);

  if (parts[0] !== "publ-events" || parts.length === 1) {
    return { kind: "list" };
  }

  if (parts[1] === "new") {
    return { kind: "new" };
  }

  const eventKey = safeDecodeURIComponent(parts[1] ?? "");
  if (parts[2] === "edit") {
    return { kind: "edit", eventKey };
  }

  return { kind: "detail", eventKey };
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function buildPublEventPath(eventKey: string) {
  return `/publ-events/${encodeURIComponent(eventKey)}`;
}

function getPageTitle(mode: PublRouteMode, item: V2PublEventItem | null) {
  if (mode.kind === "new") return "Publ 이벤트 생성";
  if (mode.kind === "edit") return item ? `${item.displayName} 수정` : "Publ 이벤트 수정";
  if (mode.kind === "detail") return item?.displayName ?? "Publ 이벤트 상세";
  return "Publ 이벤트";
}

function getPageDescription(mode: PublRouteMode) {
  if (mode.kind === "new") return "새 Publ 이벤트와 prop 정의를 등록합니다";
  if (mode.kind === "edit") return "이벤트 정보, prop, 알림톡 템플릿 변수를 수정합니다";
  if (mode.kind === "detail") return "등록된 이벤트 정의를 읽기 전용으로 확인합니다";
  return "PDF 기반 이벤트 카탈로그를 관리합니다";
}
