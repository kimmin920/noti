"use client";

import { AppIcon } from "@/components/icons/AppIcon";
import { useRouteNavigate } from "@/lib/hooks/use-route-navigate";
import type { ResourceState } from "@/lib/store/types";

export function BrandCampaignPage({
  resources,
}: {
  resources: ResourceState;
}) {
  const navigate = useRouteNavigate();
  const kakaoReady = resources.kakao === "active";

  return (
    <>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <div className="page-title">브랜드 메시지 대량 발송</div>
            <div className="page-desc">브랜드 메시지 대량 발송 흐름을 별도 메뉴로 분리해 준비합니다</div>
          </div>
        </div>
      </div>

      {!kakaoReady ? (
        <>
          <div className="flash flash-attention">
            <AppIcon name="warn" className="icon icon-16 flash-icon" />
            <div className="flash-body">브랜드 메시지 대량 발송을 쓰려면 먼저 카카오 채널 연결이 필요합니다.</div>
          </div>
          <div className="box">
            <div className="empty-state">
              <div className="empty-icon" style={{ color: "#c9a700" }}>
                <AppIcon name="kakao-bulk" className="icon icon-40" />
              </div>
              <div className="empty-title">카카오 발신 자원을 먼저 준비해 주세요</div>
              <div className="empty-desc">채널 연결이 완료되면 이 화면에서 브랜드 메시지 대량 발송 흐름을 이어서 붙일 수 있습니다.</div>
              <div className="empty-actions">
                <button className="btn btn-kakao" onClick={() => navigate("resources")}>
                  발신 자원 관리
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="box">
          <div className="box-header">
            <div>
              <div className="box-title">분리 완료</div>
              <div className="box-subtitle">사이드바에서는 이미 독립 메뉴로 동작합니다</div>
            </div>
          </div>
          <div className="box-body">
            <div className="brand-roadmap-grid">
              <div className="brand-roadmap-card">
                <div className="brand-roadmap-title">다음 단계</div>
                <p>수신자 파일 업로드와 대량 발송 request 생성기를 이 메뉴에 바로 연결합니다.</p>
              </div>
              <div className="brand-roadmap-card">
                <div className="brand-roadmap-title">예정 기능</div>
                <p>검수 후 진행, 예약 발송, 발송 결과 조회를 브랜드 메시지 대량 흐름에 맞춰 붙입니다.</p>
              </div>
              <div className="brand-roadmap-card">
                <div className="brand-roadmap-title">현재 사용 가능</div>
                <p>단건 브랜드 메시지는 사이드바의 브랜드 메시지 메뉴에서 바로 보낼 수 있습니다.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
