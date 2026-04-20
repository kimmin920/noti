"use client";

import { useState } from "react";
import { BrandMessagePage } from "@/components/kakao/brand/BrandMessagePage";
import { AppIcon } from "@/components/icons/AppIcon";
import { useRouteNavigate } from "@/lib/hooks/use-route-navigate";
import type { V2KakaoSendPageData } from "@/lib/api/v2";
import { KakaoSendPage } from "./KakaoSendPage";

type KakaoMode = "alimtalk" | "brand";

export function KakaoMessagingPage({
  initialData,
  allowGroupTemplates = false,
}: {
  initialData?: V2KakaoSendPageData;
  allowGroupTemplates?: boolean;
}) {
  const navigate = useRouteNavigate();
  const [activeMode, setActiveMode] = useState<KakaoMode>("alimtalk");

  return (
    <>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <div className="page-title">카카오 발송</div>
            <div className="page-desc">알림톡과 브랜드 메시지를 같은 화면에서 준비하고 보낼 수 있습니다</div>
          </div>
          <button className="btn btn-default" onClick={() => navigate("logs")}>
            발송 이력
          </button>
        </div>
      </div>

      <div className="kakao-mode-switch" role="tablist" aria-label="카카오 발송 모드">
        <button
          type="button"
          role="tab"
          aria-selected={activeMode === "alimtalk"}
          className={`kakao-mode-tab${activeMode === "alimtalk" ? " active" : ""}`}
          onClick={() => setActiveMode("alimtalk")}
        >
          <AppIcon name="kakao" className="icon icon-16" />
          알림톡
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeMode === "brand"}
          className={`kakao-mode-tab${activeMode === "brand" ? " active" : ""}`}
          onClick={() => setActiveMode("brand")}
        >
          <AppIcon name="campaign" className="icon icon-16" />
          브랜드 메시지
          <span className="kakao-mode-pill">1차</span>
        </button>
      </div>

      {activeMode === "alimtalk" ? (
        <KakaoSendPage
          embedded
          initialData={initialData?.alimtalk}
          allowGroupTemplates={allowGroupTemplates}
        />
      ) : (
        <BrandMessagePage embedded initialData={initialData?.brand} />
      )}
    </>
  );
}
