"use client";

import { AppIcon } from "@/components/icons/AppIcon";
import { useAppStore } from "@/lib/store/app-store";

const SAMPLE_DRAFTS = {
  sms: [
    { to: "010-1234-5678", subject: "SMS 초안", body: "안녕하세요, #{name}님!\n이번 주 특별 할인 행사를 알려드립니다.\n지금 바로 확인해 보세요." },
    { to: "010-9876-5432", subject: "인증 문자", body: "[인증] 인증번호는 #{code}입니다. 3분 내 입력해 주세요." },
  ],
  kakao: [
    { to: "010-3333-4444", subject: "주문 완료 알림", body: "#{name}님의 주문이 완료되었습니다.\n주문번호: #{order_id}" },
    { to: "", subject: "배송 출발 안내", body: "#{name}님, 상품이 출발했습니다!\n운송장: #{tracking_no}" },
  ],
  mms: [
    { to: "010-7777-8888", subject: "이미지 프로모션", body: "여름 세일이 시작되었습니다!\n지금 바로 확인하세요.", hasImages: true, imageCount: 2 },
    { to: "010-2222-3333", subject: "신상품 안내", body: "새로운 상품이 출시되었습니다!", hasImages: true, imageCount: 1 },
  ],
} as const;

const sampleIndex = { sms: 0, kakao: 0, mms: 0 };

function SegButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button className={active ? "active" : undefined} onClick={onClick}>
      {children}
    </button>
  );
}

export function DevPanel() {
  const open = useAppStore((state) => state.ui.devPanelOpen);
  const resources = useAppStore((state) => state.resources);
  const devResourceOverrides = useAppStore((state) => state.devResourceOverrides);
  const setSmsStatus = useAppStore((state) => state.setSmsStatus);
  const setKakaoStatus = useAppStore((state) => state.setKakaoStatus);
  const setScheduledStatus = useAppStore((state) => state.setScheduledStatus);
  const addDraft = useAppStore((state) => state.addDraft);
  const clearDrafts = useAppStore((state) => state.clearDrafts);
  const resolvedResources = {
    ...resources,
    ...devResourceOverrides,
  };

  const addSampleDraft = (channel: "sms" | "kakao" | "mms") => {
    const drafts = SAMPLE_DRAFTS[channel];
    const next = drafts[sampleIndex[channel] % drafts.length];
    sampleIndex[channel] += 1;
    addDraft({
      channel,
      type: channel,
      to: next.to,
      subject: next.subject,
      body: next.body,
      hasImages: "hasImages" in next ? next.hasImages : false,
      imageCount: "imageCount" in next ? next.imageCount : 0,
    });
  };

  return (
    <div className={`dev-panel${open ? " open" : ""}`} id="devPanel">
      <div className="dev-panel-title">
        <AppIcon name="sliders" className="icon icon-14" style={{ color: "#c4a7ff" }} />
        개발자 패널 — 상태 시뮬레이터
      </div>

      <div className="dev-section">
        <div className="dev-section-label">SMS 발신번호</div>
        <div className="dev-seg">
          <SegButton active={resolvedResources.sms === "none"} onClick={() => setSmsStatus("none")}>
            미신청
          </SegButton>
          <SegButton active={resolvedResources.sms === "pending"} onClick={() => setSmsStatus("pending")}>
            심사중
          </SegButton>
          <SegButton active={resolvedResources.sms === "rejected"} onClick={() => setSmsStatus("rejected")}>
            거절됨
          </SegButton>
          <SegButton active={resolvedResources.sms === "active"} onClick={() => setSmsStatus("active")}>
            등록완료
          </SegButton>
        </div>
      </div>

      <div className="dev-section">
        <div className="dev-section-label">카카오 채널</div>
        <div className="dev-seg">
          <SegButton active={resolvedResources.kakao === "none"} onClick={() => setKakaoStatus("none")}>
            미연결
          </SegButton>
          <SegButton active={resolvedResources.kakao === "active"} onClick={() => setKakaoStatus("active")}>
            연결완료
          </SegButton>
        </div>
      </div>

      <div className="dev-section">
        <div className="dev-section-label">예약 메시지</div>
        <div className="dev-seg">
          <SegButton
            active={resolvedResources.scheduled === "none"}
            onClick={() => setScheduledStatus("none")}
          >
            없음
          </SegButton>
          <SegButton
            active={resolvedResources.scheduled === "active"}
            onClick={() => setScheduledStatus("active")}
          >
            예약 있음
          </SegButton>
        </div>
      </div>

      <div className="dev-section">
        <div className="dev-section-label">임시저장함 테스트</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <button className="dev-action-btn dev-action-blue" onClick={() => addSampleDraft("sms")}>+ SMS 초안 추가</button>
          <button className="dev-action-btn dev-action-yellow" onClick={() => addSampleDraft("kakao")}>+ 알림톡 초안 추가</button>
          <button className="dev-action-btn dev-action-purple" onClick={() => addSampleDraft("mms")}>+ MMS 초안 추가</button>
          <button className="dev-action-btn dev-action-red" onClick={clearDrafts}>전체 초안 삭제</button>
        </div>
      </div>

      <div className="dev-hint">상태 변경은 즉시 반영되며, 등록 완료/채널 연결 완료 상태도 대시보드에서는 운영 중으로 집계됩니다.</div>
    </div>
  );
}
