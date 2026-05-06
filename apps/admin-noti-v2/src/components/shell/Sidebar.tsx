"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { AppIcon } from "@/components/icons/AppIcon";
import { useAppStore } from "@/lib/store/app-store";
import { useRouteNavigate } from "@/lib/hooks/use-route-navigate";
import {
  canKakao,
  canSMS,
} from "@/lib/store/selectors";
import type { PageId, ResourceState } from "@/lib/store/types";
import { DraftWidgetCompare } from "./DraftWidgetCompare";
import { SidebarSetupBox } from "./SidebarSetupBox";

function NavButton({
  active = false,
  locked = false,
  label,
  badge,
  icon,
  onClick,
}: {
  active?: boolean;
  locked?: boolean;
  label: string;
  badge?: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={`sidebar-item${active ? " active" : ""}${locked ? " locked" : ""}`}
      onClick={onClick}
    >
      <span className="si-left">
        {icon}
        {label}
      </span>
      <span className="si-right">
        {badge}
      </span>
    </button>
  );
}

function LockPill() {
  return (
    <span className="lock-pill">
      <AppIcon name="lock" className="icon icon-12" />
    </span>
  );
}

export function Sidebar({
  currentPage,
  resources,
  role,
  accessOrigin,
  eventRuleCount = 0,
}: {
  currentPage: PageId;
  resources: ResourceState;
  role: "USER" | "PARTNER_ADMIN" | "SUPER_ADMIN";
  accessOrigin: "DIRECT" | "PUBL";
  eventRuleCount?: number;
}) {
  const navigate = useRouteNavigate();
  const openLockedModal = useAppStore((state) => state.openLockedModal);
  const [kakaoHelpOpen, setKakaoHelpOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  const smsReady = canSMS(resources);
  const kakaoReady = canKakao(resources);
  const canManagePartnerEvents = role === "PARTNER_ADMIN";
  const canManagePublEvents = role === "PARTNER_ADMIN" && accessOrigin === "PUBL";
  const canViewPartnerOverview = role === "PARTNER_ADMIN";
  const resourcesActive =
    currentPage === "resources" || currentPage === "sender-number-apply" || currentPage === "kakao-connect";

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!kakaoHelpOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setKakaoHelpOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [kakaoHelpOpen]);

  if (role === "SUPER_ADMIN") {
    return (
      <nav className="sidebar">
        <div className="sidebar-section">
          <span className="sidebar-heading">내부</span>
          <NavButton
            active={currentPage === "ops"}
            label="내부 운영"
            icon={<AppIcon name="shield" className="icon icon-16" />}
            onClick={() => navigate("ops")}
          />
        </div>
      </nav>
    );
  }

  return (
    <nav className="sidebar">
      <SidebarSetupBox resources={resources} onGoResources={() => navigate("resources")} />

      <div className="sidebar-section">
        <span className="sidebar-heading">대시보드</span>
        <NavButton
          active={currentPage === "dashboard"}
          label="개요"
          icon={<AppIcon name="dashboard" className="icon icon-16" />}
          onClick={() => navigate("dashboard")}
        />
      </div>

      <div className="sidebar-section">
        <span className="sidebar-heading">메시지 발송</span>
        <NavButton
          active={currentPage === "sms-send"}
          locked={!smsReady}
          label="SMS 발송"
          icon={<AppIcon name="sms" className="icon icon-16" />}
          badge={!smsReady ? <LockPill /> : null}
          onClick={() => (smsReady ? navigate("sms-send") : openLockedModal("sms"))}
        />
        <NavButton
          active={currentPage === "sms-campaign"}
          locked={!smsReady}
          label="SMS 대량 발송"
          icon={<AppIcon name="sms-bulk" className="icon icon-16" />}
          badge={!smsReady ? <LockPill /> : null}
          onClick={() => (smsReady ? navigate("sms-campaign") : openLockedModal("sms"))}
        />
      </div>

      <div className="sidebar-section">
        <div className="sidebar-heading-row">
          <span className="sidebar-heading">카카오 발송</span>
          <button
            type="button"
            className={`sidebar-help-trigger${kakaoHelpOpen ? " active" : ""}`}
            aria-label="알림톡과 브랜드 메시지 차이 보기"
            aria-haspopup="dialog"
            aria-expanded={kakaoHelpOpen}
            onClick={() => setKakaoHelpOpen((open) => !open)}
          >
            도움말
          </button>
        </div>
        <NavButton
          active={currentPage === "alimtalk-send"}
          locked={!kakaoReady}
          label="알림톡 발송"
          icon={<AppIcon name="kakao" className="icon icon-16" />}
          badge={!kakaoReady ? <LockPill /> : null}
          onClick={() => (kakaoReady ? navigate("alimtalk-send") : openLockedModal("kakao"))}
        />
        <NavButton
          active={currentPage === "alimtalk-campaign"}
          locked={!kakaoReady}
          label="알림톡 대량 발송"
          icon={<AppIcon name="kakao-bulk" className="icon icon-16" />}
          badge={!kakaoReady ? <LockPill /> : null}
          onClick={() => (kakaoReady ? navigate("alimtalk-campaign") : openLockedModal("kakao"))}
        />
        <NavButton
          active={currentPage === "brand-send"}
          locked={!kakaoReady}
          label="브랜드 메시지"
          icon={<AppIcon name="brand" className="icon icon-16" />}
          badge={!kakaoReady ? <LockPill /> : null}
          onClick={() => (kakaoReady ? navigate("brand-send") : openLockedModal("kakao"))}
        />
        <NavButton
          active={currentPage === "brand-campaign"}
          locked={!kakaoReady}
          label="브랜드 메시지 대량"
          icon={<AppIcon name="brand-bulk" className="icon icon-16" />}
          badge={!kakaoReady ? <LockPill /> : null}
          onClick={() => (kakaoReady ? navigate("brand-campaign") : openLockedModal("kakao"))}
        />
      </div>

      {portalReady && kakaoHelpOpen
        ? createPortal(
            <div className="sidebar-help-overlay" role="presentation" onClick={() => setKakaoHelpOpen(false)}>
              <div
                className="sidebar-help-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="kakao-send-help-title"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="sidebar-help-header">
                  <div>
                    <p className="sidebar-help-kicker">카카오 발송 도움말</p>
                    <h3 id="kakao-send-help-title" className="sidebar-help-title">
                      알림톡과 브랜드 메시지 차이
                    </h3>
                  </div>
                  <button
                    type="button"
                    className="modal-close"
                    aria-label="도움말 닫기"
                    onClick={() => setKakaoHelpOpen(false)}
                  >
                    ×
                  </button>
                </div>

                <div className="sidebar-help-body">
                  <p className="sidebar-help-summary">
                    발송 목적에 따라 메시지 유형을 고르면 운영 실수를 줄일 수 있습니다. 주문·예약·안내는
                    알림톡, 혜택·이벤트·광고는 브랜드 메시지가 더 잘 맞습니다.
                  </p>

                  <div className="sidebar-help-section-head">
                    <span className="sidebar-help-section-label">핵심 구분</span>
                    <p className="sidebar-help-section-copy">어떤 메시지 유형이 현재 목적에 맞는지 먼저 확인하세요.</p>
                  </div>

                  <div className="sidebar-help-choice-grid">
                    <section className="sidebar-help-card" aria-labelledby="kakao-help-alimtalk-title">
                      <div className="sidebar-help-card-top">
                        <span className="sidebar-help-chip neutral">정보성 발송</span>
                        <AppIcon name="kakao" className="icon icon-16" />
                      </div>
                      <h4 id="kakao-help-alimtalk-title" className="sidebar-help-card-title">
                        알림톡
                      </h4>
                      <p className="sidebar-help-card-summary">
                        주문, 예약, 본인 확인, 안내처럼 꼭 전달해야 하는 메시지에 적합합니다.
                      </p>
                      <ul className="sidebar-help-list">
                        <li>자유 형식은 지원하지 않습니다.</li>
                        <li>승인된 템플릿으로만 발송할 수 있습니다.</li>
                        <li>광고성 메시지는 보낼 수 없습니다.</li>
                        <li>채널 친구 여부와 관계없이 발송 가능합니다.</li>
                      </ul>
                    </section>

                    <section className="sidebar-help-card accent" aria-labelledby="kakao-help-brand-title">
                      <div className="sidebar-help-card-top">
                        <span className="sidebar-help-chip accent">광고·프로모션</span>
                        <AppIcon name="brand" className="icon icon-16" />
                      </div>
                      <h4 id="kakao-help-brand-title" className="sidebar-help-card-title">
                        브랜드 메시지
                      </h4>
                      <p className="sidebar-help-card-summary">
                        혜택, 이벤트, 쿠폰, 신상품 소개처럼 반응을 끌어내는 메시지에 적합합니다.
                      </p>
                      <ul className="sidebar-help-list">
                        <li>광고, 프로모션, 혜택 안내에 사용할 수 있습니다.</li>
                        <li>자유형과 템플릿형을 모두 사용할 수 있습니다.</li>
                        <li>기본은 채널 친구 대상(I) 발송입니다.</li>
                        <li>야간 제한이 있어 발송 시간 확인이 필요합니다.</li>
                      </ul>
                    </section>
                  </div>

                  <div className="sidebar-help-note">
                    <div className="sidebar-help-note-head">
                      <AppIcon name="warn" className="icon icon-14" />
                      <span className="sidebar-help-note-eyebrow">브랜드 메시지 추가 조건</span>
                    </div>
                    <p className="sidebar-help-note-title">브랜드 메시지 비친구 발송(M/N)은 별도 조건이 필요합니다</p>
                    <p className="sidebar-help-note-copy">
                      브랜드 메시지는 기본적으로 채널 친구에게 발송합니다. 비친구 발송(M/N)은 브랜드 메시지
                      전용 확장 옵션이며, 비즈니스 인증 채널, 채널 친구 수 5만명 이상, 최근 알림톡 발송 성공
                      이력 등 NHN 조건을 충족한 경우에만 열릴 수 있습니다. 필요하면 먼저 문의해주세요.
                    </p>
                  </div>

                  <div className="sidebar-help-strategy">
                    <div className="sidebar-help-note-head">
                      <AppIcon name="merge" className="icon icon-14" />
                      <span className="sidebar-help-note-eyebrow">실무 권장 흐름</span>
                    </div>
                    <p className="sidebar-help-strategy-title">추천 운영 흐름</p>
                    <div className="sidebar-help-strategy-steps">
                      <div className="sidebar-help-step">
                        <span className="sidebar-help-step-index">1</span>
                        <div>
                          <p className="sidebar-help-step-title">알림톡으로 필요한 안내를 먼저 보냅니다</p>
                          <p className="sidebar-help-step-copy">
                            주문, 예약, 인증, 일정 안내처럼 사용자가 기대하는 정보성 메시지를 알림톡으로 전달합니다.
                          </p>
                        </div>
                      </div>
                      <div className="sidebar-help-step">
                        <span className="sidebar-help-step-index">2</span>
                        <div>
                          <p className="sidebar-help-step-title">채널 추가 버튼으로 친구 전환을 유도합니다</p>
                          <p className="sidebar-help-step-copy">
                            알림톡 템플릿에 채널 추가 버튼을 넣어 친구를 확보하면, 이후 브랜드 메시지 활용 폭이 넓어집니다.
                          </p>
                        </div>
                      </div>
                      <div className="sidebar-help-step">
                        <span className="sidebar-help-step-index">3</span>
                        <div>
                          <p className="sidebar-help-step-title">친구가 된 사용자에게 브랜드 메시지를 보냅니다</p>
                          <p className="sidebar-help-step-copy">
                            혜택, 이벤트, 프로모션은 브랜드 메시지로 이어서 발송하는 방식이 가장 보편적이고 안정적입니다.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      <DraftWidgetCompare currentPage={currentPage} />

      <div className="sidebar-section">
        <span className="sidebar-heading">자동화</span>
        {canManagePartnerEvents ? (
          <NavButton
            active={currentPage === "events"}
            label="알림톡 자동화"
            icon={<AppIcon name="zap" className="icon icon-16" />}
            badge={eventRuleCount > 0 ? <span className="sidebar-badge blue">{eventRuleCount}</span> : null}
            onClick={() => navigate("events")}
          />
        ) : null}
        {canManagePublEvents ? (
          <NavButton
            active={currentPage === "publ-events"}
            label="Publ 이벤트"
            icon={<AppIcon name="webhook" className="icon icon-16" />}
            onClick={() => navigate("publ-events")}
          />
        ) : null}
        <NavButton
          active={currentPage === "templates"}
          label="템플릿 관리"
          icon={<AppIcon name="template" className="icon icon-16" />}
          onClick={() => navigate("templates")}
        />
      </div>

      <div className="sidebar-section">
        <span className="sidebar-heading">운영</span>
        {canViewPartnerOverview ? (
          <NavButton
            active={currentPage === "partner"}
            label="협업 현황"
            icon={<AppIcon name="activity" className="icon icon-16" />}
            onClick={() => navigate("partner")}
          />
        ) : null}
        <NavButton
          active={resourcesActive}
          label="발신 자원 관리"
          icon={<AppIcon name="key" className="icon icon-16" />}
          onClick={() => navigate("resources")}
        />
        <NavButton
          active={currentPage === "logs"}
          label="발송 로그"
          icon={<AppIcon name="log" className="icon icon-16" />}
          onClick={() => navigate("logs")}
        />
        <NavButton
          active={currentPage === "recipients"}
          label="수신자 관리"
          icon={<AppIcon name="users" className="icon icon-16" />}
          onClick={() => navigate("recipients")}
        />
      </div>

      <div className="sidebar-section">
        <span className="sidebar-heading">설정</span>
        <NavButton
          active={currentPage === "settings"}
          label="운영 설정"
          icon={<AppIcon name="settings" className="icon icon-16" />}
          onClick={() => navigate("settings")}
        />
      </div>
    </nav>
  );
}
