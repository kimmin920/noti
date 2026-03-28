import { AppIcon } from "@/components/icons/AppIcon";
import type { ResourceState } from "@/lib/store/types";

export function SidebarSetupBox({
  resources,
  onGoResources,
}: {
  resources: ResourceState;
  onGoResources: () => void;
}) {
  const allDone = resources.sms === "active" && resources.kakao === "active";

  const smsText =
    resources.sms === "none"
      ? "발신번호 미등록"
      : resources.sms === "pending"
        ? "발신번호 심사 중"
        : "발신번호 등록 완료";

  const kakaoText =
    resources.kakao === "none" ? "카카오채널 미연결" : "카카오채널 연결 완료";

  return (
    <div className={`setup-box${allDone ? " all-done" : ""}`}>
      <div className="setup-box-title">
        {allDone ? <AppIcon name="check-circle" className="icon icon-14" /> : <AppIcon name="warn" className="icon icon-14" />}
        {allDone ? "모든 발신 자원 준비 완료" : "초기 설정이 필요합니다"}
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
