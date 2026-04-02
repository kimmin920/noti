"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AppIcon } from "@/components/icons/AppIcon";
import { SkeletonTableBox } from "@/components/loading/PageSkeleton";
import { KakaoChannelConnectModal } from "@/components/resources/KakaoChannelConnectModal";
import type {
  V2KakaoResourcesResponse,
  V2ResourcesSummaryResponse,
  V2SmsResourcesResponse,
} from "@/lib/api/v2";
import type { ResourceState } from "@/lib/store/types";
import {
  buildResourcesKakaoConnectPath,
  buildResourcesTabPath,
  KAKAO_CHANNEL_CONNECT_MODAL_QUERY,
  parseResourceTab,
  SENDER_NUMBER_APPLICATION_PATH,
  serializeResourceTab,
  type ResourceTabId,
} from "@/lib/routes";

function ProcessInfoBox() {
  return (
    <div className="box">
      <div className="box-header">
        <div className="box-title">신청 프로세스</div>
      </div>
      <div className="box-body">
        <div className="steps">
          <div className="step">
            <div className="step-circle active">1</div>
            <div className="step-label active">신청서 제출</div>
          </div>
          <div className="step">
            <div className="step-circle">2</div>
            <div className="step-label">서류 검토</div>
          </div>
          <div className="step">
            <div className="step-circle">3</div>
            <div className="step-label">발송 활성화</div>
          </div>
        </div>
        <div className="flash flash-info" style={{ marginBottom: 0, marginTop: 8 }}>
          <AppIcon name="info" className="icon icon-16 flash-icon" />
          <div className="flash-body text-small">
            발신번호 등록에는 <strong>사업자등록증</strong>과 <strong>통신서비스 이용증명원</strong>이 필요합니다.
          </div>
        </div>
      </div>
    </div>
  );
}

function SmsResourcePanel({
  resources,
  data,
}: {
  resources: ResourceState;
  data: V2SmsResourcesResponse | null;
}) {
  const smsApplyUrl = SENDER_NUMBER_APPLICATION_PATH;
  const items = [...(data?.items ?? [])].sort((left, right) => {
    const statusWeight = {
      REJECTED: 0,
      SUBMITTED: 1,
      APPROVED: 2,
    } as const;

    const leftWeight = statusWeight[left.status as keyof typeof statusWeight] ?? 99;
    const rightWeight = statusWeight[right.status as keyof typeof statusWeight] ?? 99;

    if (leftWeight !== rightWeight) {
      return leftWeight - rightWeight;
    }

    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
  const hasItems = items.length > 0;
  const rejectedCount = items.filter((item) => item.status === "REJECTED").length;
  const header = (
    <div className="flex items-center gap-8 mb-16">
      <h3 style={{ fontSize: 15, fontWeight: 600 }}>등록된 발신번호</h3>
      <span className="ml-auto" />
      <a className="btn btn-accent" href={smsApplyUrl}>
        <AppIcon name="plus" className="icon icon-14" />
        {hasItems ? "번호 추가" : "발신번호 신청"}
      </a>
    </div>
  );

  if (!hasItems) {
    return (
      <>
        {header}
        <div className="box">
          <div className="empty-state">
            <div className="empty-icon">
              <AppIcon name="phone" className="icon icon-40" />
            </div>
            <div className="empty-title">등록된 발신번호가 없습니다</div>
            <div className="empty-desc">발신번호를 등록하면 SMS를 발송할 수 있습니다. 서류 검토 후 활성화됩니다.</div>
            <div className="empty-actions">
              <a className="btn btn-accent" href={smsApplyUrl}>
                <AppIcon name="plus" className="icon icon-14" />
                발신번호 신청하기
              </a>
            </div>
          </div>
        </div>
        <ProcessInfoBox />
      </>
    );
  }

  return (
    <>
      {header}

      {resources.sms === "active" ? (
        <div className="flash flash-success">
          <AppIcon name="check-circle" className="icon icon-16 flash-icon" />
          <div className="flash-body">
            <strong>승인된 발신번호가 등록되어 있습니다.</strong> SMS 발송이 가능합니다.
          </div>
        </div>
      ) : null}

      {resources.sms === "pending" ? (
        <div className="flash flash-info">
          <AppIcon name="info" className="icon icon-16 flash-icon" />
          <div className="flash-body">
            <strong>서류 검토가 진행 중입니다.</strong> 검토 완료 후 자동으로 발송이 활성화됩니다. 영업일 기준 1–3일 소요됩니다.
          </div>
        </div>
      ) : null}

      {resources.sms === "rejected" ? (
        <div className="flash flash-attention">
          <AppIcon name="warn" className="icon icon-16 flash-icon" />
          <div className="flash-body">
            <strong>거절된 발신번호 신청이 있습니다.</strong>{" "}
            {rejectedCount > 1
              ? `${rejectedCount}건의 거절 사유를 확인한 뒤 서류를 보완해 다시 신청해 주세요.`
              : "거절 사유를 확인한 뒤 서류를 보완해 다시 신청해 주세요."}
          </div>
        </div>
      ) : null}

      {items.map((item) => {
        if (item.status === "SUBMITTED") {
          return (
            <div className="box" key={item.id}>
              <div className="box-header">
                <div>
                  <div className="box-title">{item.phoneNumber}</div>
                  <div className="box-subtitle">
                    {senderNumberTypeText(item.type)} · 최근 제출일: {formatShortDate(item.updatedAt)}
                  </div>
                </div>
                <span className="label label-blue">
                  <span className="label-dot" />
                  서류 검토 중
                </span>
              </div>
              <div className="box-body">
                <div style={{ marginBottom: 12, fontSize: 13, color: "var(--fg-muted)" }}>신청 진행 상황</div>
                <div className="steps">
                  <div className="step">
                    <div className="step-circle done">
                      <AppIcon name="check" className="icon icon-14" />
                    </div>
                    <div className="step-label done">신청 완료</div>
                  </div>
                  <div className="step">
                    <div className="step-circle active">2</div>
                    <div className="step-label active">서류 검토</div>
                  </div>
                  <div className="step">
                    <div className="step-circle">3</div>
                    <div className="step-label">발송 활성화</div>
                  </div>
                </div>
                <div className="flash flash-info" style={{ marginBottom: 0, marginTop: 8 }}>
                  <AppIcon name="info" className="icon icon-16 flash-icon" />
                  <div className="flash-body text-small">
                    {item.reviewMemo || "검토 결과는 등록된 이메일로 안내드립니다. 서류 미비 시 보완 요청 메일이 발송됩니다."}
                  </div>
                </div>
              </div>
            </div>
          );
        }

        if (item.status === "REJECTED") {
          return (
            <div className="box" key={item.id}>
              <div className="box-header">
                <div>
                  <div className="box-title">{item.phoneNumber}</div>
                  <div className="box-subtitle">
                    {senderNumberTypeText(item.type)} · 최근 검토일: {formatShortDate(item.updatedAt)}
                  </div>
                </div>
                <span className="label label-red">
                  <span className="label-dot" />
                  거절됨
                </span>
              </div>
              <div className="box-body">
                <div style={{ marginBottom: 12, fontSize: 13, color: "var(--fg-muted)" }}>거절 사유</div>
                <div className="ops-detail-note ops-detail-note-danger">
                  {item.reviewMemo || "제출한 서류를 확인한 뒤 다시 신청해 주세요."}
                </div>
              </div>
              <div className="box-footer">
                <span className="text-small">서류를 보완한 뒤 같은 번호로 다시 신청할 수 있습니다.</span>
                <a className="btn btn-default btn-sm" href={smsApplyUrl}>
                  다시 신청
                </a>
              </div>
            </div>
          );
        }

        return (
          <div className="box" key={item.id}>
            <div className="box-header">
              <div>
                <div className="box-title">{item.phoneNumber}</div>
                <div className="box-subtitle">
                  {senderNumberTypeText(item.type)} · 등록일: {formatShortDate(item.approvedAt || item.updatedAt)}
                </div>
              </div>
              <span className="label label-green">
                <span className="label-dot" />
                활성
              </span>
            </div>
            <div className="box-body">
              <div className="steps">
                <div className="step">
                  <div className="step-circle done">
                    <AppIcon name="check" className="icon icon-14" />
                  </div>
                  <div className="step-label done">신청 완료</div>
                </div>
                <div className="step">
                  <div className="step-circle done">
                    <AppIcon name="check" className="icon icon-14" />
                  </div>
                  <div className="step-label done">서류 검토</div>
                </div>
                <div className="step">
                  <div className="step-circle done">
                    <AppIcon name="check" className="icon icon-14" />
                  </div>
                  <div className="step-label done">발송 활성화</div>
                </div>
              </div>
            </div>
            <div className="box-footer">
              <span className="text-small">SMS 단건 발송 및 대량 발송에 사용할 수 있습니다.</span>
              <button className="btn btn-default btn-sm">
                <AppIcon name="trash" className="icon icon-14" />
                삭제
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}

function KakaoResourcePanel({
  resources,
  data,
  onOpenConnectModal,
}: {
  resources: ResourceState;
  data: V2KakaoResourcesResponse | null;
  onOpenConnectModal: () => void;
}) {
  if (resources.kakao === "none") {
    return (
      <>
        <div className="flex items-center gap-8 mb-16">
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>카카오 발신프로필 (채널)</h3>
          <span className="ml-auto" />
          <button className="btn btn-kakao" onClick={onOpenConnectModal}>
            <AppIcon name="kakao" className="icon icon-14" />
            채널 연결하기
          </button>
        </div>
        <div className="box">
          <div className="empty-state">
            <div className="empty-icon" style={{ color: "#c9a700" }}>
              <AppIcon name="kakao" className="icon icon-40" />
            </div>
            <div className="empty-title">연결된 카카오채널이 없습니다</div>
            <div className="empty-desc">카카오 비즈니스 채널을 연결하면 알림톡을 발송할 수 있습니다.</div>
            <div className="empty-actions">
              <button className="btn btn-kakao" onClick={onOpenConnectModal}>채널 연결하기</button>
            </div>
          </div>
        </div>
        <div className="box">
          <div className="box-header">
            <div className="box-title">연결 전 확인사항</div>
          </div>
          <div className="box-row">
            <div className="box-row-content">
              <div className="box-row-title">카카오 비즈 계정</div>
              <div className="box-row-desc">카카오 비즈니스 계정이 없다면 먼저 신청하세요.</div>
            </div>
            <a className="btn btn-default btn-sm" href="#">
              비즈 계정 신청 <AppIcon name="external" className="icon icon-12" />
            </a>
          </div>
          <div className="box-row">
            <div className="box-row-content">
              <div className="box-row-title">채널 검색용 ID 확인</div>
              <div className="box-row-desc">카카오톡 채널 관리자 센터 → 채널 설정에서 확인할 수 있습니다.</div>
            </div>
            <a className="btn btn-default btn-sm" href="#">
              채널 관리자 <AppIcon name="external" className="icon icon-12" />
            </a>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-8 mb-16">
        <h3 style={{ fontSize: 15, fontWeight: 600 }}>카카오 발신프로필 (채널)</h3>
        <span className="ml-auto" />
        <button className="btn btn-default btn-sm" onClick={onOpenConnectModal}>
          <AppIcon name="plus" className="icon icon-14" />
          채널 추가
        </button>
      </div>
      <div className="flash flash-success">
        <AppIcon name="check-circle" className="icon icon-16 flash-icon" />
        <div className="flash-body">
          <strong>카카오채널이 연결되었습니다.</strong> 알림톡 발송이 가능합니다.
        </div>
      </div>
      {(data?.items ?? []).map((item) => (
        <div className="box" key={item.id}>
          <div className="box-header">
            <div>
              <div className="box-title">{item.plusFriendId}</div>
              <div className="box-subtitle">{item.senderProfileType ?? "브랜드 채널"} · 연결일: {formatShortDate(item.createdAt)}</div>
            </div>
            <span className="label label-green">
              <span className="label-dot" />
              활성
            </span>
          </div>
          <div className="box-body">
            <div className="dash-row dash-row-3" style={{ marginBottom: 0 }}>
              <div style={{ fontSize: 12 }}>
                <div className="text-muted" style={{ marginBottom: 2 }}>발신프로필 키</div>
                <div className="td-mono">{item.senderKey}</div>
              </div>
              <div style={{ fontSize: 12 }}>
                <div className="text-muted" style={{ marginBottom: 2 }}>채널 ID</div>
                <div className="td-mono">{item.plusFriendId}</div>
              </div>
              <div style={{ fontSize: 12 }}>
                <div className="text-muted" style={{ marginBottom: 2 }}>알림톡 템플릿</div>
                <div style={{ fontWeight: 500 }}>
                  승인 {data?.summary.approvedTemplateCount ?? 0}개
                </div>
              </div>
            </div>
          </div>
          <div className="box-footer">
            <span className="text-small">알림톡 단건 발송 및 이벤트 자동 발송에 사용할 수 있습니다.</span>
            <button className="btn btn-default btn-sm">
              <AppIcon name="trash" className="icon icon-14" />
              연결 해제
            </button>
          </div>
        </div>
      ))}
    </>
  );
}

export function ResourcesPage({
  resources,
  data,
  loading,
  error,
}: {
  resources: ResourceState;
  data: {
    summary: V2ResourcesSummaryResponse | null;
    sms: V2SmsResourcesResponse | null;
    kakao: V2KakaoResourcesResponse | null;
  };
  loading?: boolean;
  error?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasResourceData = Boolean(data.summary || data.sms || data.kakao);
  const showLoadingNotice = Boolean(loading && !hasResourceData);
  const queryTab = parseResourceTab(searchParams.get("tab"));
  const resolvedActiveTab = queryTab ?? "tab-sms";
  const kakaoConnectModalOpen = searchParams.get("connect") === KAKAO_CHANNEL_CONNECT_MODAL_QUERY;

  const handleChangeResourceTab = (tab: ResourceTabId) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("tab", serializeResourceTab(tab));
    nextParams.delete("connect");
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  };

  const handleOpenKakaoConnectModal = () => {
    router.push(buildResourcesKakaoConnectPath(), { scroll: false });
  };

  const handleCloseKakaoConnectModal = () => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("connect");
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  };

  if (showLoadingNotice) {
    return (
      <>
        <div className="page-header">
          <div className="page-header-row">
            <div>
              <div className="page-title">발신 자원 관리</div>
              <div className="page-desc">SMS 발신번호와 카카오 채널을 등록·관리합니다</div>
            </div>
          </div>
        </div>

        <div className="tab-nav">
          <button className={`tab-item${resolvedActiveTab === "tab-sms" ? " active" : ""}`} disabled>
            <AppIcon name="phone" className="icon icon-14" />
            SMS 발신번호
          </button>
          <button className={`tab-item${resolvedActiveTab === "tab-kakao" ? " active" : ""}`} disabled>
            <AppIcon name="kakao" className="icon icon-14" />
            카카오 채널
          </button>
        </div>

        <SkeletonTableBox titleWidth={118} rows={4} columns={["1.8fr", "1.1fr", "110px"]} />
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <div className="page-title">발신 자원 관리</div>
            <div className="page-desc">SMS 발신번호와 카카오 채널을 등록·관리합니다</div>
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
        <button className={`tab-item${resolvedActiveTab === "tab-sms" ? " active" : ""}`} onClick={() => handleChangeResourceTab("tab-sms")}>
          <AppIcon name="phone" className="icon icon-14" />
          SMS 발신번호
        </button>
        <button className={`tab-item${resolvedActiveTab === "tab-kakao" ? " active" : ""}`} onClick={() => handleChangeResourceTab("tab-kakao")}>
          <AppIcon name="kakao" className="icon icon-14" />
          카카오 채널
        </button>
      </div>

      {resolvedActiveTab === "tab-sms" ? (
        <SmsResourcePanel resources={resources} data={data.sms} />
      ) : (
        <KakaoResourcePanel resources={resources} data={data.kakao} onOpenConnectModal={handleOpenKakaoConnectModal} />
      )}

      {kakaoConnectModalOpen ? (
        <KakaoChannelConnectModal open={kakaoConnectModalOpen} onClose={handleCloseKakaoConnectModal} />
      ) : null}
    </>
  );
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

function senderNumberTypeText(type: string) {
  if (type === "COMPANY") return "회사 번호";
  if (type === "EMPLOYEE") return "개인 번호";
  return type;
}
