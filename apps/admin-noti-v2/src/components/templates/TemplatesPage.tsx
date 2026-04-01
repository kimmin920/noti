"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AppIcon } from "@/components/icons/AppIcon";
import { SkeletonTableBox } from "@/components/loading/PageSkeleton";
import {
  type V2CreateKakaoTemplateResponse,
  type V2KakaoTemplateDetailResponse,
  type V2KakaoTemplatesResponse,
  type V2SmsTemplateDetailResponse,
  type V2SmsTemplatesResponse,
  type V2TemplatesSummaryResponse,
  fetchV2KakaoTemplateDetail,
  fetchV2SmsTemplateDetail,
} from "@/lib/api/v2";
import { useAppStore } from "@/lib/store/app-store";
import type { ResourceState } from "@/lib/store/types";
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
  onOpenDetail,
}: {
  allowGroupTemplates: boolean;
  resources: ResourceState;
  data: V2KakaoTemplatesResponse | null;
  onOpenCreate: () => void;
  onOpenDetail: (item: V2KakaoTemplatesResponse["items"][number]) => void;
}) {
  const items = data?.items ?? [];
  const registrationTargets = data?.registrationTargets ?? [];
  const hasRegistrationTarget = registrationTargets.length > 0;

  if (!hasRegistrationTarget && items.length === 0) {
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
          <div className="flash-actions">
            <button className="btn btn-default btn-sm">채널 연결하기</button>
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
            <div className="empty-actions">
              <button className="btn btn-kakao btn-sm">
                <AppIcon name="kakao" className="icon icon-14" />
                채널 연결하기
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
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
                    <td><span className="table-kind-text">{sourceLabel(item.source, item.ownerLabel)}</span></td>
                    <td className="td-muted table-preview-cell-wide">{item.body}</td>
                    <td>
                      <span className={`label ${providerStatusClass(item.providerStatus)}`}>
                        <span className="label-dot" />
                        {providerStatusText(item.providerStatus)}
                      </span>
                    </td>
                    <td className="td-muted text-small">{formatShortDate(item.createdAt || item.updatedAt)}</td>
                    <td>
                      <button
                        className="btn btn-default btn-sm"
                        onClick={() => onOpenDetail(item)}
                        disabled={!item.templateCode && !item.kakaoTemplateCode}
                      >
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

export function TemplatesPage({
  sessionRole,
  partnerScope,
  resources,
  data,
  loading,
  error,
  onRefresh,
}: {
  sessionRole: "TENANT_ADMIN" | "PARTNER_ADMIN" | "SUPER_ADMIN";
  partnerScope: "DIRECT" | "PUBL" | null;
  resources: ResourceState;
  data: {
    summary: V2TemplatesSummaryResponse | null;
    sms: V2SmsTemplatesResponse | null;
    kakao: V2KakaoTemplatesResponse | null;
  };
  loading?: boolean;
  error?: string | null;
  onRefresh: () => void;
}) {
  const showDraftToast = useAppStore((state) => state.showDraftToast);
  const [composerOpen, setComposerOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailKind, setDetailKind] = useState<"sms" | "kakao" | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [smsDetail, setSmsDetail] = useState<V2SmsTemplateDetailResponse | null>(null);
  const [kakaoDetail, setKakaoDetail] = useState<V2KakaoTemplateDetailResponse | null>(null);
  const detailRequestIdRef = useRef(0);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasTemplateData = Boolean(data.summary || data.sms || data.kakao);
  const showLoadingNotice = Boolean(loading && !hasTemplateData);
  const kakaoRegistrationTargets = data.kakao?.registrationTargets ?? [];
  const hasKakaoCategories = (data.kakao?.categories?.length ?? 0) > 0;
  const allowGroupTemplates = sessionRole === "PARTNER_ADMIN" && partnerScope === "PUBL";
  const queryTab = parseTemplateTab(searchParams.get("tab"));
  const resolvedActiveTab = queryTab ?? "tmpl-sms";

  const openKakaoComposer = () => {
    setComposerOpen(true);
  };

  const closeKakaoComposer = () => {
    setComposerOpen(false);
  };

  const handleKakaoTemplateCreated = (response: V2CreateKakaoTemplateResponse) => {
    setComposerOpen(false);
    showDraftToast(buildKakaoTemplateCreatedMessage(response));
    onRefresh();
  };

  const closeTemplateDetail = () => {
    detailRequestIdRef.current += 1;
    setDetailOpen(false);
    setDetailLoading(false);
    setDetailError(null);
    setSmsDetail(null);
    setKakaoDetail(null);
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

    try {
      const response = await fetchV2SmsTemplateDetail(item.id);
      if (detailRequestIdRef.current !== requestId) {
        return;
      }

      setSmsDetail(response);
    } catch (error) {
      if (detailRequestIdRef.current !== requestId) {
        return;
      }

      setDetailError(error instanceof Error ? error.message : "SMS 템플릿 상세를 불러오지 못했습니다.");
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

    try {
      const response = await fetchV2KakaoTemplateDetail({
        source: item.source,
        ownerKey: item.ownerKey,
        templateCode,
      });
      if (detailRequestIdRef.current !== requestId) {
        return;
      }

      setKakaoDetail(response);
    } catch (error) {
      if (detailRequestIdRef.current !== requestId) {
        return;
      }

      setDetailError(error instanceof Error ? error.message : "알림톡 템플릿 상세를 불러오지 못했습니다.");
    } finally {
      if (detailRequestIdRef.current === requestId) {
        setDetailLoading(false);
      }
    }
  };

  const handleChangeTemplateTab = (tab: "tmpl-sms" | "tmpl-kakao") => {
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
              <div className="page-desc">SMS 및 알림톡 발송 템플릿을 관리합니다</div>
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
              <div className="page-desc">SMS 및 알림톡 발송 템플릿을 관리합니다</div>
            </div>
            <div className="flex gap-8">
              {resolvedActiveTab === "tmpl-kakao" ? (
                <>
                  <button className="btn btn-default" onClick={onRefresh}>
                    <AppIcon name="refresh" className="icon icon-14" />
                    새로고침
                  </button>
                  <button className="btn btn-accent" onClick={openKakaoComposer} disabled={kakaoRegistrationTargets.length === 0 || !hasKakaoCategories}>
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
      </div>

      {resolvedActiveTab === "tmpl-sms" ? (
        <SmsTemplatesTable data={data.sms} onOpenDetail={openSmsTemplateDetail} />
      ) : (
        <KakaoTemplatePanel
          allowGroupTemplates={allowGroupTemplates}
          resources={resources}
          data={data.kakao}
          onOpenCreate={openKakaoComposer}
          onOpenDetail={openKakaoTemplateDetail}
        />
      )}

      {composerOpen ? (
        <KakaoTemplateCreateModal
          open={composerOpen}
          registrationTargets={kakaoRegistrationTargets}
          categories={data.kakao?.categories ?? []}
          onClose={closeKakaoComposer}
          onCreated={handleKakaoTemplateCreated}
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
          onClose={closeTemplateDetail}
        />
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

function buildKakaoTemplateCreatedMessage(response: V2CreateKakaoTemplateResponse) {
  const status = providerStatusText(response.template.providerStatus);
  return `${response.target.label} 대상으로 알림톡 템플릿 신청을 접수했습니다. 현재 상태: ${status}`;
}

function sourceLabel(source: "DEFAULT_GROUP" | "SENDER_PROFILE", ownerLabel: string) {
  if (source === "DEFAULT_GROUP") return ownerLabel;
  return ownerLabel;
}

function parseTemplateTab(value: string | null): "tmpl-sms" | "tmpl-kakao" | null {
  if (value === "sms") return "tmpl-sms";
  if (value === "kakao") return "tmpl-kakao";
  return null;
}

function serializeTemplateTab(value: "tmpl-sms" | "tmpl-kakao") {
  return value === "tmpl-kakao" ? "kakao" : "sms";
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
