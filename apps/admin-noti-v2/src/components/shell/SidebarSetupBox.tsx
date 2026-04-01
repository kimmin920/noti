"use client";

import { useState } from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";
import type { ResourceState } from "@/lib/store/types";

const SIDEBAR_SETUP_BOX_DISMISSED_KEY = "publ.sidebar.setup-box.dismissed";

export function SidebarSetupBox({
  resources,
  onGoResources,
}: {
  resources: ResourceState;
  onGoResources: () => void;
}) {
  const [hydrated, setHydrated] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const allDone = resources.sms === "active" && resources.kakao === "active";

  useMountEffect(() => {
    setDismissed(window.localStorage.getItem(SIDEBAR_SETUP_BOX_DISMISSED_KEY) === "true");
    setHydrated(true);
  });

  const smsText =
    resources.sms === "none"
      ? "발신번호 미등록"
      : resources.sms === "pending"
        ? "발신번호 심사 중"
        : "발신번호 등록 완료";

  const kakaoText =
    resources.kakao === "none" ? "카카오채널 미연결" : "카카오채널 연결 완료";

  const dismiss = () => {
    window.localStorage.setItem(SIDEBAR_SETUP_BOX_DISMISSED_KEY, "true");
    setDismissed(true);
  };

  if (!hydrated || dismissed) {
    return null;
  }

  return (
    <div className={`setup-box${allDone ? " all-done" : ""}`}>
      <div className="setup-box-top">
        <div className="setup-box-title">
          {allDone ? <AppIcon name="check-circle" className="icon icon-14" /> : <AppIcon name="warn" className="icon icon-14" />}
          {allDone ? "모든 발신 자원 준비 완료" : "초기 설정이 필요합니다"}
        </div>
        <button className="setup-box-close" type="button" aria-label="초기 설정 박스 닫기" onClick={dismiss}>
          <AppIcon name="x" className="icon icon-14" />
        </button>
      </div>
      <div className="setup-row">
        <span className={`dot ${resources.sms === "active" ? "done" : "pending"}`} />
        <span>{smsText}</span>
      </div>
      <div className="setup-row">
        <span className={`dot ${resources.kakao === "active" ? "done" : "pending"}`} />
        <span>{kakaoText}</span>
      </div>
      {!allDone ? (
        <button className="setup-cta" onClick={onGoResources}>
          설정 시작하기 →
        </button>
      ) : null}
    </div>
  );
}
