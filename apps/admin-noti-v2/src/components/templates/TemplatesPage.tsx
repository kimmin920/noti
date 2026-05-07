"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ConfirmationDialog, ThemeProvider } from "@primer/react";
import { AppIcon } from "@/components/icons/AppIcon";
import { SkeletonTableBox } from "@/components/loading/PageSkeleton";
import {
  deleteV2BrandTemplate,
  deleteV2KakaoTemplate,
  type V2BrandTemplateDetailResponse,
  type V2BrandTemplatesResponse,
  type V2CreateBrandTemplateResponse,
  type V2CreateKakaoTemplateResponse,
  type V2KakaoTemplateDetailResponse,
  type V2KakaoTemplateDraftItem,
  type V2KakaoTemplatesResponse,
  type V2SaveKakaoTemplateDraftResponse,
  type V2SmsTemplateDetailResponse,
  type V2SmsTemplatesResponse,
  type V2TemplatesSummaryResponse,
  type V2UpdateBrandTemplateResponse,
  type V2UpdateKakaoTemplateResponse,
  fetchV2BrandTemplateDetail,
  fetchV2KakaoTemplateDetail,
  fetchV2SmsTemplateDetail,
} from "@/lib/api/v2";
import { useAppStore } from "@/lib/store/app-store";
import type { ResourceState } from "@/lib/store/types";
import { BrandTemplateCreateModal } from "./BrandTemplateCreateModal";
import { KakaoTemplateCreateModal } from "./KakaoTemplateCreateModal";
import { TemplateDetailDrawer } from "./TemplateDetailDrawer";

function SmsTemplatesTable({
  data,
  onOpenDetail,
}: {
  data: V2SmsTemplatesResponse | null;
  onOpenDetail: (item: V2SmsTemplatesResponse["items"][number]) => void;
}) {
  return (
    <div className="box">
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>템플릿명</th>
              <th>채널</th>
              <th>내용 미리보기</th>
              <th>버전</th>
              <th>상태</th>
              <th>수정일</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((item) => (
              <tr key={item.id}>
                <td><div className="table-title-text">{item.name}</div></td>
                <td><span className="chip chip-sms">SMS</span></td>
                <td className="td-muted table-preview-cell">{item.body}</td>
                <td className="td-mono td-muted">v{item.latestVersion?.version ?? item.versionCount}</td>
                <td><span className={`label ${templateStatusClass(item.status)}`}><span className="label-dot" />{templateStatusText(item.status)}</span></td>
                <td className="td-muted text-small">{formatShortDate(item.updatedAt)}</td>
                <td><button className="btn btn-default btn-sm" onClick={() => onOpenDetail(item)}>보기</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KakaoTemplatePanel({
  allowGroupTemplates,
  resources,
  data,
  onOpenCreate,
  onOpenDraft,
  onOpenDetail,
}: {
  allowGroupTemplates: boolean;
  resources: ResourceState;
  data: V2KakaoTemplatesResponse | null;
  onOpenCreate: () => void;
  onOpenDraft: (draft: V2KakaoTemplateDraftItem) => void;
  onOpenDetail: (item: V2KakaoTemplatesResponse["items"][number]) => void;
}) {
  const items = data?.items ?? [];
  const drafts = data?.drafts ?? [];
  const registrationTargets = data?.registrationTargets ?? [];
  const hasRegistrationTarget = registrationTargets.length > 0;

  if (!hasRegistrationTarget && items.length === 0 && drafts.length === 0) {
    return (
      <>
        <div className="flash flash-attention">
          <AppIcon name="kakao" className="icon icon-16 flash-icon" />
          <div className="flash-body">
            {resources.kakao === "active"
              ? allowGroupTemplates
                ? "알림톡 템플릿 등록 대상이 없습니다. 공용 그룹 또는 연결된 채널 상태를 확인해 주세요."
                : "알림톡 템플릿 등록 대상이 없습니다. 연결된 채널 상태를 확인해 주세요."
              : allowGroupTemplates
                ? "알림톡 템플릿은 공용 그룹 또는 카카오채널 연결 후 바로 조회합니다."
                : "알림톡 템플릿은 카카오채널 연결 후 바로 조회합니다."}
          </div>
        </div>
        <div className="box">
          <div className="empty-state">
            <div className="empty-icon" style={{ color: "#c9a700" }}>
              <AppIcon name="kakao" className="icon icon-40" />
            </div>
            <div className="empty-title">알림톡 템플릿 없음</div>
            <div className="empty-desc">
              {allowGroupTemplates
                ? "공용 그룹 또는 연결된 카카오채널이 있어야 알림톡 템플릿을 등록할 수 있습니다."
                : "연결된 카카오채널이 있어야 알림톡 템플릿을 등록할 수 있습니다."}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {drafts.length > 0 ? (
        <div className="box kakao-draft-box">
          <div className="box-header">
            <div>
              <div className="box-title">임시저장</div>
              <div className="box-subtitle">검수 요청 전 저장해 둔 알림톡 템플릿입니다.</div>
            </div>
            <span className="label label-blue">{drafts.length}개</span>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>템플릿명</th>
                  <th>코드</th>
                  <th>이벤트</th>
                  <th>내용 미리보기</th>
                  <th>저장일</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {drafts.map((draft) => (
                  <tr key={draft.id}>
                    <td><div className="table-title-text">{draft.name}</div></td>
                    <td className="td-mono td-muted">{draft.templateCode || "—"}</td>
                    <td className="td-mono td-muted">{draft.sourceEventKey || "—"}</td>
                    <td className="td-muted table-preview-cell-wide">{draft.body || "내용 없음"}</td>
                    <td className="td-muted text-small">{formatShortDate(draft.updatedAt)}</td>
                    <td>
                      <button className="btn btn-default btn-sm" onClick={() => onOpenDraft(draft)}>
                        이어쓰기
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="box">
          <div className="empty-state">
            <div className="empty-icon" style={{ color: "#c9a700" }}>
              <AppIcon name="kakao" className="icon icon-40" />
            </div>
            <div className="empty-title">조회된 알림톡 템플릿이 없습니다</div>
            <div className="empty-desc">
              {allowGroupTemplates
                ? "공용 그룹 또는 연결된 카카오 채널에 승인된 알림톡 템플릿이 있는지 확인해 주세요."
                : "연결된 카카오 채널에 승인된 알림톡 템플릿이 있는지 확인해 주세요."}
            </div>
            {hasRegistrationTarget ? (
              <div className="empty-actions">
                <button className="btn btn-kakao btn-sm" onClick={onOpenCreate}>
                  <AppIcon name="plus" className="icon icon-14" />
                  템플릿 등록하기
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
    <div className="box">
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>템플릿명</th>
              <th>코드</th>
              <th>출처</th>
              <th>내용 미리보기</th>
              <th>상태</th>
              <th>등록일</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td><div className="table-title-text">{item.name}</div></td>
                <td className="td-mono td-muted">{item.templateCode || item.kakaoTemplateCode || "—"}</td>
                <td><span className="table-kind-text">{item.ownerLabel}</span></td>
                <td className="td-muted table-preview-cell-wide">{item.body}</td>
                <td>
                  <span className={`label ${providerStatusClass(item.providerStatus)}`}>
                    <span className="label-dot" />
                    {providerStatusText(item.providerStatus)}
                  </span>
                </td>
                <td className="td-muted text-small">{formatShortDate(item.createdAt || item.updatedAt)}</td>
                <td>
                  <button className="btn btn-default btn-sm" onClick={() => onOpenDetail(item)} disabled={!item.templateCode && !item.kakaoTemplateCode}>
                    보기
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
      )}
    </>
  );
}

function BrandTemplatePanel({
  resources,
  data,
  onOpenCreate,
  onOpenDetail,
}: {
  resources: ResourceState;
  data: V2BrandTemplatesResponse | null;
  onOpenCreate: () => void;
  onOpenDetail: (item: V2BrandTemplatesResponse["items"][number]) => void;
}) {
  const items = data?.items ?? [];
  const registrationTargets = data?.registrationTargets ?? [];
  const hasRegistrationTarget = registrationTargets.length > 0;

  if (!hasRegistrationTarget && items.length === 0) {
    return (
      <>
        <div className="flash flash-attention">
          <AppIcon name="brand" className="icon icon-16 flash-icon" />
          <div className="flash-body">
            {resources.kakao === "active"
              ? "브랜드 메시지 템플릿 등록 대상이 없습니다. 연결된 카카오 채널 상태를 확인해 주세요."
              : "브랜드 메시지 템플릿은 카카오채널 연결 후 바로 조회합니다."}
          </div>
        </div>
        <div className="box">
          <div className="empty-state">
            <div className="empty-icon" style={{ color: "#6d5600" }}>
              <AppIcon name="brand" className="icon icon-40" />
            </div>
            <div className="empty-title">브랜드 템플릿 없음</div>
            <div className="empty-desc">연결된 카카오 채널이 있어야 브랜드 템플릿을 등록할 수 있습니다.</div>
          </div>
        </div>
      </>
    );
  }

  return items.length === 0 ? (
    <div className="box">
      <div className="empty-state">
        <div className="empty-icon" style={{ color: "#6d5600" }}>
          <AppIcon name="brand" className="icon icon-40" />
        </div>
        <div className="empty-title">조회된 브랜드 템플릿이 없습니다</div>
        <div className="empty-desc">연결된 카카오 채널에 브랜드 메시지 템플릿을 등록해 보세요.</div>
        {hasRegistrationTarget ? (
          <div className="empty-actions">
            <button className="btn btn-accent btn-sm" onClick={onOpenCreate}>
              <AppIcon name="plus" className="icon icon-14" />
              템플릿 등록하기
            </button>
          </div>
        ) : null}
      </div>
    </div>
  ) : (
    <div className="box">
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>템플릿명</th>
              <th>유형</th>
              <th>채널</th>
              <th>내용 미리보기</th>
              <th>상태</th>
              <th>등록일</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td><div className="table-title-text">{item.templateName}</div></td>
                <td><span className="chip chip-brand">{brandTemplateTypeText(item.chatBubbleType)}</span></td>
                <td><span className="table-kind-text">{item.ownerLabel}</span></td>
                <td className="td-muted table-preview-cell-wide">{item.content || item.header || item.additionalContent || "브랜드 템플릿"}</td>
                <td>
                  <span className={`label ${providerStatusClass(item.providerStatus)}`}>
                    <span className="label-dot" />
                    {providerStatusText(item.providerStatus)}
                  </span>
                </td>
                <td className="td-muted text-small">{formatShortDate(item.createdAt || item.updatedAt)}</td>
                <td>
                  <button className="btn btn-default btn-sm" onClick={() => onOpenDetail(item)} disabled={!item.templateCode}>
                    보기
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TemplatesPage({
  sessionRole,
  accessOrigin,
  resources,
  data,
  loading,
  error,
  onRefresh,
}: {
  sessionRole: "USER" | "PARTNER_ADMIN" | "SUPER_ADMIN";
  accessOrigin: "DIRECT" | "PUBL";
  resources: ResourceState;
  data: {
    summary: V2TemplatesSummaryResponse | null;
    sms: V2SmsTemplatesResponse | null;
    kakao: V2KakaoTemplatesResponse | null;
    brand: V2BrandTemplatesResponse | null;
  };
  loading?: boolean;
  error?: string | null;
  onRefresh: () => void;
}) {
  const showDraftToast = useAppStore((state) => state.showDraftToast);
  const [composerOpen, setComposerOpen] = useState(false);
  const [kakaoComposerMode, setKakaoComposerMode] = useState<"create" | "edit">("create");
  const [editingKakaoTemplate, setEditingKakaoTemplate] = useState<V2KakaoTemplateDetailResponse["template"] | null>(null);
  const [draftingKakaoTemplate, setDraftingKakaoTemplate] = useState<V2KakaoTemplateDraftItem | null>(null);
  const [deletingKakaoTemplate, setDeletingKakaoTemplate] = useState(false);
  const [kakaoDeleteConfirmOpen, setKakaoDeleteConfirmOpen] = useState(false);
  const [brandComposerOpen, setBrandComposerOpen] = useState(false);
  const [brandComposerMode, setBrandComposerMode] = useState<"create" | "edit">("create");
  const [editingBrandTemplate, setEditingBrandTemplate] = useState<V2BrandTemplatesResponse["items"][number] | null>(null);
  const [deletingBrandTemplate, setDeletingBrandTemplate] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailKind, setDetailKind] = useState<"sms" | "kakao" | "brand" | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [smsDetail, setSmsDetail] = useState<V2SmsTemplateDetailResponse | null>(null);
  const [kakaoDetail, setKakaoDetail] = useState<V2KakaoTemplateDetailResponse | null>(null);
  const [brandDetail, setBrandDetail] = useState<V2BrandTemplateDetailResponse | null>(null);
  const detailRequestIdRef = useRef(0);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasTemplateData = Boolean(data.summary || data.sms || data.kakao || data.brand);
  const showLoadingNotice = Boolean(loading && !hasTemplateData);
  const kakaoRegistrationTargets = data.kakao?.registrationTargets ?? [];
  const brandRegistrationTargets = data.brand?.registrationTargets ?? [];
  const hasKakaoCategories = (data.kakao?.categories?.length ?? 0) > 0;
  const allowGroupTemplates = sessionRole === "PARTNER_ADMIN" && accessOrigin === "PUBL";
  const queryTab = parseTemplateTab(searchParams.get("tab"));
  const resolvedActiveTab = queryTab ?? "tmpl-sms";

  const handleKakaoTemplateSaved = (response: V2CreateKakaoTemplateResponse | V2UpdateKakaoTemplateResponse) => {
    setComposerOpen(false);
    setKakaoComposerMode("create");
    setEditingKakaoTemplate(null);
    setDraftingKakaoTemplate(null);
    showDraftToast(buildKakaoTemplateSavedMessage(response, kakaoComposerMode));
    onRefresh();
  };

  const handleKakaoTemplateDraftSaved = (response: V2SaveKakaoTemplateDraftResponse) => {
    setDraftingKakaoTemplate(response.draft);
    showDraftToast("알림톡 템플릿을 임시저장했습니다.", { tone: "success" });
    onRefresh();
  };

  const openKakaoTemplateCreate = () => {
    setKakaoComposerMode("create");
    setEditingKakaoTemplate(null);
    setDraftingKakaoTemplate(null);
    setComposerOpen(true);
  };

  const openKakaoTemplateDraft = (draft: V2KakaoTemplateDraftItem) => {
    setKakaoComposerMode("create");
    setEditingKakaoTemplate(null);
    setDraftingKakaoTemplate(draft);
    setComposerOpen(true);
  };

  const openKakaoTemplateEdit = (template: V2KakaoTemplateDetailResponse["template"]) => {
    setKakaoComposerMode("edit");
    setEditingKakaoTemplate(template);
    setDraftingKakaoTemplate(null);
    setComposerOpen(true);
  };

  const handleBrandTemplateSaved = (response: V2CreateBrandTemplateResponse | V2UpdateBrandTemplateResponse) => {
    setBrandComposerOpen(false);
    setBrandComposerMode("create");
    setEditingBrandTemplate(null);
    showDraftToast(
      `${response.target.label} 대상으로 브랜드 템플릿을 ${brandComposerMode === "edit" ? "수정" : "저장"}했습니다.`,
      { tone: "success" }
    );
    onRefresh();
  };

  const openBrandTemplateCreate = () => {
    setBrandComposerMode("create");
    setEditingBrandTemplate(null);
    setBrandComposerOpen(true);
  };

  const openBrandTemplateEdit = (template: V2BrandTemplatesResponse["items"][number]) => {
    setBrandComposerMode("edit");
    setEditingBrandTemplate(template);
    setBrandComposerOpen(true);
  };

  const handleBrandTemplateDelete = async () => {
    const template = brandDetail?.template;
    if (!template?.templateCode) {
      return;
    }

    const confirmed = window.confirm(`"${template.templateName}" 템플릿을 삭제할까요? 이 작업은 되돌릴 수 없습니다.`);
    if (!confirmed) {
      return;
    }

    setDeletingBrandTemplate(true);
    try {
      await deleteV2BrandTemplate({
        senderProfileId: template.senderProfileId,
        templateCode: template.templateCode,
      });
      closeTemplateDetail();
      showDraftToast(`${template.templateName} 템플릿을 삭제했습니다.`, { tone: "success" });
      onRefresh();
    } catch (deleteError) {
      showDraftToast(
        deleteError instanceof Error ? deleteError.message : "브랜드 템플릿 삭제에 실패했습니다.",
        { tone: "error" }
      );
    } finally {
      setDeletingBrandTemplate(false);
    }
  };

  const handleKakaoTemplateDelete = async () => {
    const template = kakaoDetail?.template;
    const templateCode = template?.templateCode || template?.kakaoTemplateCode;

    if (!template || !templateCode) {
      return;
    }

    setKakaoDeleteConfirmOpen(false);
    setDeletingKakaoTemplate(true);
    try {
      await deleteV2KakaoTemplate({
        source: template.source,
        ownerKey: template.ownerKey,
        templateCode,
      });
      closeTemplateDetail();
      showDraftToast(`${template.name} 템플릿을 삭제했습니다.`, { tone: "success" });
      onRefresh();
    } catch (deleteError) {
      showDraftToast(
        deleteError instanceof Error ? deleteError.message : "알림톡 템플릿 삭제에 실패했습니다.",
        { tone: "error" }
      );
    } finally {
      setDeletingKakaoTemplate(false);
    }
  };

  const closeTemplateDetail = () => {
    detailRequestIdRef.current += 1;
    setKakaoDeleteConfirmOpen(false);
    setDetailOpen(false);
    setDetailLoading(false);
    setDetailError(null);
    setSmsDetail(null);
    setKakaoDetail(null);
    setBrandDetail(null);
  };

  const openSmsTemplateDetail = async (item: V2SmsTemplatesResponse["items"][number]) => {
    const requestId = detailRequestIdRef.current + 1;
    detailRequestIdRef.current = requestId;
    setDetailKind("sms");
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setSmsDetail(null);
    setKakaoDetail(null);
    setBrandDetail(null);

    try {
      const response = await fetchV2SmsTemplateDetail(item.id);
      if (detailRequestIdRef.current !== requestId) return;
      setSmsDetail(response);
    } catch (detailError) {
      if (detailRequestIdRef.current !== requestId) return;
      setDetailError(detailError instanceof Error ? detailError.message : "SMS 템플릿 상세를 불러오지 못했습니다.");
    } finally {
      if (detailRequestIdRef.current === requestId) {
        setDetailLoading(false);
      }
    }
  };

  const openKakaoTemplateDetail = async (item: V2KakaoTemplatesResponse["items"][number]) => {
    const templateCode = item.templateCode || item.kakaoTemplateCode;
    if (!templateCode) {
      return;
    }

    const requestId = detailRequestIdRef.current + 1;
    detailRequestIdRef.current = requestId;
    setDetailKind("kakao");
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setSmsDetail(null);
    setKakaoDetail(null);
    setBrandDetail(null);

    try {
      const response = await fetchV2KakaoTemplateDetail({
        source: item.source,
        ownerKey: item.ownerKey,
        templateCode,
      });
      if (detailRequestIdRef.current !== requestId) return;
      setKakaoDetail(response);
    } catch (detailError) {
      if (detailRequestIdRef.current !== requestId) return;
      setDetailError(detailError instanceof Error ? detailError.message : "알림톡 템플릿 상세를 불러오지 못했습니다.");
    } finally {
      if (detailRequestIdRef.current === requestId) {
        setDetailLoading(false);
      }
    }
  };

  const openBrandTemplateDetail = async (item: V2BrandTemplatesResponse["items"][number]) => {
    if (!item.templateCode) {
      return;
    }

    const requestId = detailRequestIdRef.current + 1;
    detailRequestIdRef.current = requestId;
    setDetailKind("brand");
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setSmsDetail(null);
    setKakaoDetail(null);
    setBrandDetail(null);

    try {
      const response = await fetchV2BrandTemplateDetail({
        senderProfileId: item.senderProfileId,
        templateCode: item.templateCode,
      });
      if (detailRequestIdRef.current !== requestId) return;
      setBrandDetail(response);
    } catch (detailError) {
      if (detailRequestIdRef.current !== requestId) return;
      setDetailError(detailError instanceof Error ? detailError.message : "브랜드 템플릿 상세를 불러오지 못했습니다.");
    } finally {
      if (detailRequestIdRef.current === requestId) {
        setDetailLoading(false);
      }
    }
  };

  const handleChangeTemplateTab = (tab: "tmpl-sms" | "tmpl-kakao" | "tmpl-brand") => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("tab", serializeTemplateTab(tab));
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  };

  if (showLoadingNotice) {
    return (
      <>
        <div className="page-header">
          <div className="page-header-row">
            <div>
              <div className="page-title">템플릿 관리</div>
              <div className="page-desc">SMS, 알림톡, 브랜드 메시지 템플릿을 관리합니다</div>
            </div>
            <div className="flex gap-8">
              <button className="btn btn-accent" disabled>
                <AppIcon name="plus" className="icon icon-14" />
                템플릿 만들기
              </button>
            </div>
          </div>
        </div>

        <div className="tab-nav">
          <button className={`tab-item${resolvedActiveTab === "tmpl-sms" ? " active" : ""}`} disabled>
            <AppIcon name="template" className="icon icon-14" />
            SMS 템플릿
          </button>
          <button className={`tab-item${resolvedActiveTab === "tmpl-kakao" ? " active" : ""}`} disabled>
            <AppIcon name="kakao" className="icon icon-14" />
            알림톡 템플릿
          </button>
          <button className={`tab-item${resolvedActiveTab === "tmpl-brand" ? " active" : ""}`} disabled>
            <AppIcon name="brand" className="icon icon-14" />
            브랜드 템플릿
          </button>
        </div>

        <SkeletonTableBox titleWidth={92} rows={5} columns={["1.6fr", "90px", "2fr", "90px", "110px", "84px"]} />
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <div className="page-title">템플릿 관리</div>
            <div className="page-desc">SMS, 알림톡, 브랜드 메시지 템플릿을 관리합니다</div>
          </div>
          <div className="flex gap-8">
            {resolvedActiveTab === "tmpl-kakao" ? (
              <>
                <button className="btn btn-default" onClick={onRefresh}>
                  <AppIcon name="refresh" className="icon icon-14" />
                  새로고침
                </button>
                <button className="btn btn-accent" onClick={openKakaoTemplateCreate} disabled={kakaoRegistrationTargets.length === 0 || !hasKakaoCategories}>
                  <AppIcon name="plus" className="icon icon-14" />
                  템플릿 등록
                </button>
              </>
            ) : resolvedActiveTab === "tmpl-brand" ? (
              <>
                <button className="btn btn-default" onClick={onRefresh}>
                  <AppIcon name="refresh" className="icon icon-14" />
                  새로고침
                </button>
                <button className="btn btn-accent" onClick={openBrandTemplateCreate} disabled={brandRegistrationTargets.length === 0}>
                  <AppIcon name="plus" className="icon icon-14" />
                  템플릿 등록
                </button>
              </>
            ) : (
              <button className="btn btn-accent" disabled>
                <AppIcon name="plus" className="icon icon-14" />
                템플릿 만들기
              </button>
            )}
          </div>
        </div>
      </div>

      {error ? (
        <div className="flash flash-attention">
          <AppIcon name="warn" className="icon icon-16 flash-icon" />
          <div className="flash-body">{error}</div>
        </div>
      ) : null}

      <div className="tab-nav">
        <button className={`tab-item${resolvedActiveTab === "tmpl-sms" ? " active" : ""}`} onClick={() => handleChangeTemplateTab("tmpl-sms")}>
          <AppIcon name="template" className="icon icon-14" />
          SMS 템플릿 <span className="tab-counter">{data.summary?.sms.totalCount ?? 0}</span>
        </button>
        <button className={`tab-item${resolvedActiveTab === "tmpl-kakao" ? " active" : ""}`} onClick={() => handleChangeTemplateTab("tmpl-kakao")}>
          <AppIcon name="kakao" className="icon icon-14" />
          알림톡 템플릿 <span className="tab-counter">{resources.kakao === "active" ? data.summary?.kakao.totalCount ?? 0 : 0}</span>
        </button>
        <button className={`tab-item${resolvedActiveTab === "tmpl-brand" ? " active" : ""}`} onClick={() => handleChangeTemplateTab("tmpl-brand")}>
          <AppIcon name="brand" className="icon icon-14" />
          브랜드 템플릿 <span className="tab-counter">{resources.kakao === "active" ? data.summary?.brand.totalCount ?? 0 : 0}</span>
        </button>
      </div>

      {resolvedActiveTab === "tmpl-sms" ? (
        <SmsTemplatesTable data={data.sms} onOpenDetail={openSmsTemplateDetail} />
      ) : resolvedActiveTab === "tmpl-kakao" ? (
        <KakaoTemplatePanel
          allowGroupTemplates={allowGroupTemplates}
          resources={resources}
          data={data.kakao}
          onOpenCreate={openKakaoTemplateCreate}
          onOpenDraft={openKakaoTemplateDraft}
          onOpenDetail={openKakaoTemplateDetail}
        />
      ) : (
        <BrandTemplatePanel
          resources={resources}
          data={data.brand}
          onOpenCreate={openBrandTemplateCreate}
          onOpenDetail={openBrandTemplateDetail}
        />
      )}

      {composerOpen ? (
        <KakaoTemplateCreateModal
          open={composerOpen}
          registrationTargets={kakaoRegistrationTargets}
          categories={data.kakao?.categories ?? []}
          mode={kakaoComposerMode}
          initialTemplate={editingKakaoTemplate}
          initialDraft={draftingKakaoTemplate}
          onClose={() => {
            setComposerOpen(false);
            setKakaoComposerMode("create");
            setEditingKakaoTemplate(null);
            setDraftingKakaoTemplate(null);
          }}
          onCreated={handleKakaoTemplateSaved}
          onUpdated={handleKakaoTemplateSaved}
          onDraftSaved={handleKakaoTemplateDraftSaved}
        />
      ) : null}

      {brandComposerOpen ? (
        <BrandTemplateCreateModal
          open={brandComposerOpen}
          registrationTargets={brandRegistrationTargets}
          mode={brandComposerMode}
          initialTemplate={editingBrandTemplate}
          onClose={() => {
            setBrandComposerOpen(false);
            setBrandComposerMode("create");
            setEditingBrandTemplate(null);
          }}
          onSaved={handleBrandTemplateSaved}
        />
      ) : null}

      {detailOpen ? (
        <TemplateDetailDrawer
          open={detailOpen}
          kind={detailKind}
          loading={detailLoading}
          error={detailError}
          smsDetail={smsDetail}
          kakaoDetail={kakaoDetail}
          brandDetail={brandDetail}
          kakaoActions={
            kakaoDetail?.template
              ? {
                  deleting: deletingKakaoTemplate,
                  onEdit: () => {
                    openKakaoTemplateEdit(kakaoDetail.template);
                    closeTemplateDetail();
                  },
                  onDelete: () => setKakaoDeleteConfirmOpen(true),
                }
              : null
          }
          brandActions={
            brandDetail?.template
              ? {
                  deleting: deletingBrandTemplate,
                  onEdit: () => {
                    openBrandTemplateEdit(brandDetail.template);
                    closeTemplateDetail();
                  },
                  onDelete: handleBrandTemplateDelete,
                }
              : null
          }
          onClose={closeTemplateDetail}
        />
      ) : null}

      {kakaoDeleteConfirmOpen && kakaoDetail?.template ? (
        <ThemeProvider colorMode="light" dayScheme="light" preventSSRMismatch>
          <ConfirmationDialog
            title="템플릿 삭제?"
            confirmButtonContent="삭제"
            confirmButtonType="danger"
            cancelButtonContent="취소"
            onClose={(gesture) => {
              if (gesture === "confirm") {
                void handleKakaoTemplateDelete();
                return;
              }
              setKakaoDeleteConfirmOpen(false);
            }}
          >
            {`"${kakaoDetail.template.name}" 템플릿을 삭제합니다. 이 작업은 되돌릴 수 없고, NHN 템플릿 목록에서도 제거됩니다.`}
          </ConfirmationDialog>
        </ThemeProvider>
      ) : null}
    </>
  );
}

function templateStatusText(status: string) {
  if (status === "PUBLISHED") return "발행됨";
  if (status === "ARCHIVED") return "보관됨";
  return "초안";
}

function templateStatusClass(status: string) {
  if (status === "PUBLISHED") return "label-green";
  if (status === "ARCHIVED") return "label-gray";
  return "label-blue";
}

function providerStatusText(status?: string | null) {
  if (status === "APR") return "승인됨";
  if (status === "REJ") return "반려";
  if (status === "REG" || status === "REQ") return "검토 중";
  return "미동기화";
}

function providerStatusClass(status?: string | null) {
  if (status === "APR") return "label-green";
  if (status === "REJ") return "label-red";
  if (status === "REG" || status === "REQ") return "label-blue";
  return "label-gray";
}

function buildKakaoTemplateSavedMessage(
  response: V2CreateKakaoTemplateResponse | V2UpdateKakaoTemplateResponse,
  mode: "create" | "edit"
) {
  const status = providerStatusText(response.template.providerStatus);
  return `${response.target.label} 대상으로 알림톡 템플릿 ${mode === "edit" ? "수정" : "신청"}을 접수했습니다. 현재 상태: ${status}`;
}

function parseTemplateTab(value: string | null): "tmpl-sms" | "tmpl-kakao" | "tmpl-brand" | null {
  if (value === "sms") return "tmpl-sms";
  if (value === "kakao") return "tmpl-kakao";
  if (value === "brand") return "tmpl-brand";
  return null;
}

function serializeTemplateTab(value: "tmpl-sms" | "tmpl-kakao" | "tmpl-brand") {
  if (value === "tmpl-kakao") return "kakao";
  if (value === "tmpl-brand") return "brand";
  return "sms";
}

function brandTemplateTypeText(type: string | null) {
  const map: Record<string, string> = {
    TEXT: "텍스트형",
    IMAGE: "이미지형",
    WIDE: "와이드 이미지형",
    WIDE_ITEM_LIST: "와이드 아이템리스트형",
    PREMIUM_VIDEO: "프리미엄 동영상형",
    COMMERCE: "커머스형",
    CAROUSEL_FEED: "캐러셀 피드형",
    CAROUSEL_COMMERCE: "캐러셀 커머스형",
  };
  return type ? (map[type] || type) : "기타";
}

function formatShortDate(value: string | null) {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}
