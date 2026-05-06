"use client";

import { useState, useEffectEvent } from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import { SkeletonStatGrid, SkeletonTableBox } from "@/components/loading/PageSkeleton";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";
import {
  fetchV2PartnerClientDetail,
  type V2PartnerClientDetailResponse,
  type V2PartnerOverviewResponse,
} from "@/lib/api/v2";

export function PartnerOverviewPage({
  role,
  accessOrigin,
  data,
  loading,
  error,
  onRefresh,
}: {
  role: "USER" | "PARTNER_ADMIN" | "SUPER_ADMIN";
  accessOrigin: "DIRECT" | "PUBL";
  data: V2PartnerOverviewResponse | null;
  loading?: boolean;
  error?: string | null;
  onRefresh: () => void;
}) {
  const canReadPartnerOverview = role === "PARTNER_ADMIN";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string } | null>(null);
  const [detail, setDetail] = useState<V2PartnerClientDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  if (!canReadPartnerOverview) {
    return (
      <>
        <div className="page-header">
          <div className="page-header-row">
            <div>
              <div className="page-title">협업 현황</div>
              <div className="page-desc">협업 범위에 포함된 이용처 현황을 읽기 전용으로 확인합니다</div>
            </div>
          </div>
        </div>
        <div className="box">
          <div className="empty-state">
            <div className="empty-icon">
              <AppIcon name="activity" className="icon icon-40" />
            </div>
            <div className="empty-title">접근 권한이 없습니다</div>
            <div className="empty-desc">협업 현황은 협업 운영자 계정에서만 볼 수 있습니다.</div>
          </div>
        </div>
      </>
    );
  }

  if (loading && !data) {
    return (
      <>
        <div className="page-header">
          <div className="page-header-row">
            <div>
              <div className="page-title">협업 현황</div>
              <div className="page-desc">협업 범위에 포함된 이용처 현황을 읽기 전용으로 확인합니다</div>
            </div>
          </div>
        </div>
        <SkeletonStatGrid columns={5} />
        <SkeletonTableBox titleWidth={120} rows={5} columns={["1.2fr", "0.8fr", "0.8fr", "0.8fr", "0.8fr", "1fr", "110px"]} />
        <SkeletonTableBox titleWidth={118} rows={6} columns={["1fr", "1fr", "0.8fr", "0.8fr", "0.8fr", "110px"]} />
      </>
    );
  }

  const openClientDetail = async (clientId: string, clientName: string) => {
    setSelectedClient({ id: clientId, name: clientName });
    setDrawerOpen(true);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);

    try {
      const nextDetail = await fetchV2PartnerClientDetail(clientId);
      setDetail(nextDetail);
    } catch (fetchError) {
      setDetailError(fetchError instanceof Error ? fetchError.message : "이용처 상세를 불러오지 못했습니다.");
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedClient(null);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(false);
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <div className="page-title">협업 현황</div>
            <div className="page-desc">
              {accessOrigin === "PUBL"
                ? "PUBL 범위로 연결된 이용처와 로그인 계정을 읽기 전용으로 확인합니다"
                : "협업 범위에 포함된 이용처 현황을 읽기 전용으로 확인합니다"}
            </div>
          </div>
          <button className="btn btn-default" onClick={onRefresh}>
            <AppIcon name="refresh" className="icon icon-14" />
            새로고침
          </button>
        </div>
      </div>

      {error ? (
        <div className="flash flash-attention">
          <AppIcon name="warn" className="icon icon-16 flash-icon" />
          <div className="flash-body">{error}</div>
        </div>
      ) : null}

      <div className="box mb-16">
        <div className="stats-grid-5">
          <StatCell label="이용처" value={data?.summary.clientCount ?? 0} />
          <StatCell label="로그인 계정" value={data?.summary.userAccountCount ?? 0} />
          <StatCell label="SMS 준비 완료" value={data?.summary.smsReadyClientCount ?? 0} tone="success" />
          <StatCell label="알림톡 준비 완료" value={data?.summary.kakaoReadyClientCount ?? 0} tone="accent" />
          <StatCell label="관리 대상 유저" value={data?.summary.managedUserCount ?? 0} />
        </div>
      </div>

      <div className="box">
        <div className="box-header">
          <div>
            <div className="box-title">협업 이용처</div>
            <div className="box-subtitle">협업 범위에 포함된 이용처의 기본 준비 상태를 확인합니다.</div>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>이용처</th>
                <th>상태</th>
                <th>로그인 계정</th>
                <th>승인 발신번호</th>
                <th>활성 채널</th>
                <th>관리 대상 유저</th>
                <th>업데이트</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(data?.clients ?? []).length > 0 ? (
                (data?.clients ?? []).map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="table-title-text">{item.name}</div>
                      <div className="td-muted text-small">{item.primaryAdmin?.email || item.primaryAdmin?.loginId || "담당자 없음"}</div>
                    </td>
                    <td>
                      <span className={`label ${item.status === "ACTIVE" ? "label-green" : "label-gray"}`}>
                        <span className="label-dot" />
                        {item.status === "ACTIVE" ? "활성" : "중지"}
                      </span>
                    </td>
                    <td className="td-muted">{item.userAccountCount}명</td>
                    <td className="td-mono">{item.approvedSenderNumberCount}</td>
                    <td className="td-mono">{item.activeSenderProfileCount}</td>
                    <td className="td-mono">{item.managedUserCount}</td>
                    <td className="td-muted text-small">{formatShortDateTime(item.updatedAt)}</td>
                    <td>
                      <button className="btn btn-default btn-sm" onClick={() => void openClientDetail(item.id, item.name)}>
                        보기
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state" style={{ padding: "32px 16px" }}>
                      <div className="empty-title">표시할 협업 이용처가 없습니다</div>
                      <div className="empty-desc">현재 범위에 포함된 이용처가 아직 없습니다.</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="box">
        <div className="box-header">
          <div>
            <div className="box-title">로그인 계정</div>
            <div className="box-subtitle">협업 범위에 포함된 로그인 계정을 읽기 전용으로 확인합니다.</div>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>이용처</th>
                <th>로그인 ID</th>
                <th>이메일</th>
                <th>승인 발신번호</th>
                <th>활성 채널</th>
                <th>관리 대상 유저</th>
                <th>업데이트</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(data?.userAccounts ?? []).length > 0 ? (
                (data?.userAccounts ?? []).map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="table-title-text">{item.clientName}</div>
                      <div className="td-muted text-small">{item.accessOrigin === "PUBL" ? "PUBL" : "직접"}</div>
                    </td>
                    <td className="td-mono td-muted">{item.loginId || "—"}</td>
                    <td className="td-muted">{item.email || "—"}</td>
                    <td className="td-mono">{item.approvedSenderNumberCount}</td>
                    <td className="td-mono">{item.activeSenderProfileCount}</td>
                    <td className="td-mono">{item.managedUserCount}</td>
                    <td className="td-muted text-small">{formatShortDateTime(item.updatedAt)}</td>
                    <td>
                      <button
                        className="btn btn-default btn-sm"
                        onClick={() => void openClientDetail(item.clientId, item.clientName)}
                      >
                        보기
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state" style={{ padding: "32px 16px" }}>
                      <div className="empty-title">표시할 관리자 계정이 없습니다</div>
                      <div className="empty-desc">현재 범위에 포함된 사업자 관리자 계정이 아직 없습니다.</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PartnerClientDetailDrawer
        open={drawerOpen}
        client={selectedClient}
        detail={detail}
        loading={detailLoading}
        error={detailError}
        onClose={closeDrawer}
      />
    </>
  );
}

function PartnerClientDetailDrawer({
  open,
  client,
  detail,
  loading,
  error,
  onClose,
}: {
  open: boolean;
  client: { id: string; name: string } | null;
  detail: V2PartnerClientDetailResponse | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const handleEscape = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape") {
      onClose();
    }
  });

  useMountEffect(() => {
    const onKeydown = (event: KeyboardEvent) => handleEscape(event);
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  });

  if (!open || !client) {
    return null;
  }

  return (
    <div className="template-detail-backdrop" onClick={onClose}>
      <aside className="template-detail-drawer" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="협업 이용처 보기">
        <div className="template-detail-header">
          <div>
            <div className="template-detail-eyebrow">협업 이용처</div>
            <div className="template-detail-title">{client.name}</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="상세 보기 닫기">
            <AppIcon name="x" className="icon icon-18" />
          </button>
        </div>

        <div className="template-detail-body">
          {loading ? <PartnerDetailLoading /> : null}
          {!loading && error ? (
            <div className="flash flash-attention" style={{ marginBottom: 16 }}>
              <AppIcon name="warn" className="icon icon-16 flash-icon" />
              <div className="flash-body">{error}</div>
            </div>
          ) : null}
          {!loading && !error && detail ? <PartnerDetailContent detail={detail} /> : null}
        </div>
      </aside>
    </div>
  );
}

function PartnerDetailLoading() {
  return (
    <div className="template-detail-stack">
      <SkeletonStatGrid columns={4} />
      <SkeletonTableBox titleWidth={112} rows={4} columns={["1fr", "1fr", "110px"]} />
      <SkeletonTableBox titleWidth={108} rows={4} columns={["1fr", "0.8fr", "90px", "110px"]} />
      <SkeletonTableBox titleWidth={108} rows={4} columns={["1fr", "1fr", "110px"]} />
    </div>
  );
}

function PartnerDetailContent({ detail }: { detail: V2PartnerClientDetailResponse }) {
  return (
    <div className="template-detail-stack">
      <div className="box">
        <div className="box-header">
          <div>
            <div className="box-title">{detail.client.name}</div>
            <div className="box-subtitle">협업 범위에 포함된 이용처 상세 정보입니다.</div>
          </div>
          <span className={`label ${detail.client.status === "ACTIVE" ? "label-green" : "label-gray"}`}>
            <span className="label-dot" />
            {detail.client.status === "ACTIVE" ? "활성" : "중지"}
          </span>
        </div>
        <div className="box-body">
          <div className="template-detail-meta-grid">
            <MetaField label="로그인 계정" value={`${detail.summary.userAccountCount}명`} />
            <MetaField label="승인 발신번호" value={`${detail.summary.approvedSenderNumberCount}개`} />
            <MetaField label="활성 채널" value={`${detail.summary.activeSenderProfileCount}개`} />
            <MetaField label="관리 대상 유저" value={`${detail.summary.managedUserCount.toLocaleString()}명`} />
          </div>
          <div className="template-detail-meta-grid template-detail-meta-grid-tight">
            <MetaField label="SMS 템플릿" value={`${detail.summary.smsTemplateCount}개`} />
            <MetaField label="승인 알림톡 템플릿" value={`${detail.summary.approvedKakaoTemplateCount}개`} />
            <MetaField label="활성 알림톡 자동화" value={`${detail.summary.enabledEventRuleCount}개`} />
            <MetaField label="최근 7일 단건 발송" value={`${detail.summary.recentManualRequestCount}건`} />
          </div>
          <div className="template-detail-meta-grid template-detail-meta-grid-tight">
            <MetaField label="최근 7일 대량 발송" value={`${detail.summary.recentBulkCampaignCount}건`} />
            <MetaField label="접근 매체" value={detail.client.accessOrigin === "PUBL" ? "PUBL" : "직접"} />
            <MetaField label="생성일" value={formatShortDateTime(detail.client.createdAt)} />
            <MetaField label="업데이트" value={formatShortDateTime(detail.client.updatedAt)} />
          </div>
        </div>
      </div>

      <div className="box">
        <div className="box-header">
          <div className="box-title">로그인 계정</div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>로그인 ID</th>
                <th>이메일</th>
                <th>접근 매체</th>
                <th>업데이트</th>
              </tr>
            </thead>
            <tbody>
              {detail.userAccounts.map((item) => (
                <tr key={item.id}>
                  <td className="td-mono td-muted">{item.loginId || "—"}</td>
                  <td className="td-muted">{item.email || "—"}</td>
                  <td className="td-muted">{item.accessOrigin === "PUBL" ? "PUBL" : "직접"}</td>
                  <td className="td-muted text-small">{formatShortDateTime(item.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="box">
        <div className="box-header">
          <div className="box-title">발신번호</div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>번호</th>
                <th>유형</th>
                <th>상태</th>
                <th>승인일</th>
              </tr>
            </thead>
            <tbody>
              {detail.senderNumbers.length > 0 ? (
                detail.senderNumbers.map((item) => (
                  <tr key={item.id}>
                    <td className="td-mono">{item.phoneNumber}</td>
                    <td className="td-muted">{item.type}</td>
                    <td>
                      <span className={`label ${senderNumberStatusClass(item.status)}`}>
                        <span className="label-dot" />
                        {senderNumberStatusText(item.status)}
                      </span>
                    </td>
                    <td className="td-muted text-small">{item.approvedAt ? formatShortDateTime(item.approvedAt) : "—"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="td-muted text-small">등록된 발신번호가 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="box">
        <div className="box-header">
          <div className="box-title">카카오 채널</div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>채널</th>
                <th>타입</th>
                <th>상태</th>
                <th>업데이트</th>
              </tr>
            </thead>
            <tbody>
              {detail.senderProfiles.length > 0 ? (
                detail.senderProfiles.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="table-title-text">{item.plusFriendId}</div>
                      <div className="td-mono td-muted text-small">{item.senderKey}</div>
                    </td>
                    <td className="td-muted">{item.senderProfileType || "—"}</td>
                    <td>
                      <span className={`label ${senderProfileStatusClass(item.status)}`}>
                        <span className="label-dot" />
                        {senderProfileStatusText(item.status)}
                      </span>
                    </td>
                    <td className="td-muted text-small">{formatShortDateTime(item.updatedAt)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="td-muted text-small">연결된 카카오 채널이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "accent";
}) {
  const color =
    tone === "success" ? "var(--success-fg)" : tone === "accent" ? "var(--accent-fg)" : "var(--fg-default)";

  return (
    <div className="stat-cell">
      <div className="stat-label-t">{label}</div>
      <div className="stat-value-t" style={{ color }}>
        {value.toLocaleString()}
      </div>
    </div>
  );
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

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div className="template-detail-meta-item">
      <div className="template-detail-meta-label">{label}</div>
      <div className="template-detail-meta-value">{value}</div>
    </div>
  );
}

function senderNumberStatusText(status: string) {
  if (status === "APPROVED") return "승인";
  if (status === "SUBMITTED") return "접수";
  if (status === "SUPPLEMENT_REQUESTED") return "보완 요청";
  if (status === "REJECTED") return "반려";
  return "초안";
}

function senderNumberStatusClass(status: string) {
  if (status === "APPROVED") return "label-green";
  if (status === "SUBMITTED") return "label-blue";
  if (status === "SUPPLEMENT_REQUESTED") return "label-yellow";
  if (status === "REJECTED") return "label-red";
  return "label-gray";
}

function senderProfileStatusText(status: string) {
  if (status === "ACTIVE") return "활성";
  if (status === "BLOCKED") return "차단";
  if (status === "DORMANT") return "휴면";
  return "확인 필요";
}

function senderProfileStatusClass(status: string) {
  if (status === "ACTIVE") return "label-green";
  if (status === "BLOCKED") return "label-red";
  if (status === "DORMANT") return "label-yellow";
  return "label-gray";
}
