"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AppIcon } from "@/components/icons/AppIcon";
import { KakaoTemplateOpsTab } from "./KakaoTemplateOpsTab";
import { NoticeOpsTab } from "./NoticeOpsTab";
import { SendActivityOpsTab } from "./SendActivityOpsTab";
import { SenderNumberOpsTab } from "./SenderNumberOpsTab";
import { SmsQuotaOpsTab } from "./SmsQuotaOpsTab";
import { UsersOpsTab } from "./UsersOpsTab";

type OpsTabId = "sender-numbers" | "kakao-templates" | "sms-quotas" | "notices" | "send-activity" | "users";

function parseOpsTab(value: string | null): OpsTabId | null {
  if (value === "sender-numbers") {
    return "sender-numbers";
  }

  if (value === "kakao-templates") {
    return "kakao-templates";
  }

  if (value === "send-activity") {
    return "send-activity";
  }

  if (value === "notices") {
    return "notices";
  }

  if (value === "sms-quotas") {
    return "sms-quotas";
  }

  if (value === "users") {
    return "users";
  }

  return null;
}

function getTabTitle(tab: OpsTabId) {
  if (tab === "sender-numbers") {
    return "발신번호";
  }

  if (tab === "kakao-templates") {
    return "알림톡 템플릿";
  }

  if (tab === "send-activity") {
    return "발송 관리";
  }

  if (tab === "notices") {
    return "공지사항";
  }

  if (tab === "sms-quotas") {
    return "SMS 쿼터";
  }

  return "유저 현황";
}

function getTabSubtitle(tab: OpsTabId) {
  if (tab === "sender-numbers") {
    return "신청 리스트, 첨부 파일, 내부 승인·거절 상태를 한 화면에서 검수합니다.";
  }

  if (tab === "kakao-templates") {
    return "연결 채널과 기본 그룹의 템플릿 상태와 상세 구성을 외부 원본 기준으로 확인합니다.";
  }

  if (tab === "send-activity") {
    return "운영 계정별 문자·알림톡 발송량과 발신 자원 사용 현황을 기간 기준으로 확인합니다.";
  }

  if (tab === "notices") {
    return "사용자 대시보드에 노출할 공지사항을 Markdown으로 작성하고 관리합니다.";
  }

  if (tab === "sms-quotas") {
    return "사업자 계정별 SMS 월간 기본 한도와 현재 사용량을 확인하고 필요한 계정 한도를 상향합니다.";
  }

  return "사용자 계정 권한과 유입 채널을 확인하고, 필요한 경우 권한을 직접 조정합니다.";
}

export function OpsPage({
  role,
}: {
  role: "USER" | "PARTNER_ADMIN" | "SUPER_ADMIN";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryTab = parseOpsTab(searchParams.get("tab"));
  const activeTab = queryTab ?? "sender-numbers";
  const sendActivityRange =
    searchParams.get("range") === "1d" ||
    searchParams.get("range") === "7d" ||
    searchParams.get("range") === "30d" ||
    searchParams.get("range") === "all"
      ? searchParams.get("range")
      : "30d";
  const sendActivityStartDate = searchParams.get("startDate") || "";
  const sendActivityEndDate = searchParams.get("endDate") || "";

  const handleChangeTab = (tab: OpsTabId) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("tab", tab);
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  };

  if (role !== "SUPER_ADMIN") {
    return (
      <>
        <div className="page-header">
          <div className="page-header-row">
            <div>
              <div className="page-title">내부 운영</div>
              <div className="page-desc">운영자 전용 검수와 내부 현황을 관리합니다</div>
            </div>
          </div>
        </div>

        <div className="flash flash-attention">
          <AppIcon name="lock" className="icon icon-16 flash-icon" />
          <div className="flash-body">이 페이지는 운영자 권한이 있는 계정만 접근할 수 있습니다.</div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <div className="page-title">내부 운영</div>
            <div className="page-desc">운영자 전용 검수와 내부 현황을 관리합니다</div>
          </div>
          <span className="label label-blue">
            <span className="label-dot" />
            완료
          </span>
        </div>
      </div>

      <div className="tab-nav">
        <button className={`tab-item${activeTab === "sender-numbers" ? " active" : ""}`} onClick={() => handleChangeTab("sender-numbers")}>
          <AppIcon name="phone" className="icon icon-14" />
          발신번호
        </button>
        <button className={`tab-item${activeTab === "kakao-templates" ? " active" : ""}`} onClick={() => handleChangeTab("kakao-templates")}>
          <AppIcon name="kakao" className="icon icon-14" />
          알림톡 템플릿
        </button>
        <button className={`tab-item${activeTab === "notices" ? " active" : ""}`} onClick={() => handleChangeTab("notices")}>
          <AppIcon name="bell" className="icon icon-14" />
          공지사항
        </button>
        <button className={`tab-item${activeTab === "sms-quotas" ? " active" : ""}`} onClick={() => handleChangeTab("sms-quotas")}>
          <AppIcon name="sms-bulk" className="icon icon-14" />
          SMS 쿼터
        </button>
        <button className={`tab-item${activeTab === "send-activity" ? " active" : ""}`} onClick={() => handleChangeTab("send-activity")}>
          <AppIcon name="activity" className="icon icon-14" />
          발송 관리
        </button>
        <button className={`tab-item${activeTab === "users" ? " active" : ""}`} onClick={() => handleChangeTab("users")}>
          <AppIcon name="users" className="icon icon-14" />
          유저 현황
        </button>
      </div>

      <div className="box" style={{ marginBottom: 16 }}>
        <div className="box-header">
          <div>
            <div className="box-title">{getTabTitle(activeTab)}</div>
            <div className="box-subtitle">{getTabSubtitle(activeTab)}</div>
          </div>
        </div>
      </div>

      {activeTab === "sender-numbers" ? <SenderNumberOpsTab /> : null}
      {activeTab === "kakao-templates" ? <KakaoTemplateOpsTab /> : null}
      {activeTab === "notices" ? <NoticeOpsTab /> : null}
      {activeTab === "sms-quotas" ? <SmsQuotaOpsTab /> : null}
      {activeTab === "send-activity" ? (
        <SendActivityOpsTab key={`send-activity:${sendActivityRange}:${sendActivityStartDate}:${sendActivityEndDate}`} />
      ) : null}
      {activeTab === "users" ? <UsersOpsTab /> : null}
    </>
  );
}
