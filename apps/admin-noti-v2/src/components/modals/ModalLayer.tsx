"use client";

import { AppIcon } from "@/components/icons/AppIcon";
import { useRouteNavigate } from "@/lib/hooks/use-route-navigate";
import { useAppStore } from "@/lib/store/app-store";

function ModalBackdrop({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`modal-backdrop${open ? " open" : ""}`} onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function ModalLayer() {
  const overlays = useAppStore((state) => state.overlays);
  const closeSmsRegModal = useAppStore((state) => state.closeSmsRegModal);
  const closeKakaoRegModal = useAppStore((state) => state.closeKakaoRegModal);
  const closeLockedModal = useAppStore((state) => state.closeLockedModal);
  const navigate = useRouteNavigate();

  const lockedDesc =
    overlays.lockedType === "sms"
      ? "SMS 발송은 발신번호 등록이 완료된 후 이용할 수 있습니다."
      : overlays.lockedType === "kakao"
        ? "알림톡 발송은 카카오채널 연결이 완료된 후 이용할 수 있습니다."
        : overlays.lockedType === "campaign"
          ? "대량 발송은 발신번호 또는 카카오채널 중 하나 이상이 등록된 후 이용할 수 있습니다."
          : "";

  return (
    <>
      <ModalBackdrop open={overlays.smsRegModalOpen} onClose={closeSmsRegModal}>
        <div className="modal-header">
          <div className="modal-title"><AppIcon name="phone" className="icon icon-18" /> 발신번호 신청</div>
          <button className="modal-close" onClick={closeSmsRegModal}><AppIcon name="x" className="icon icon-18" /></button>
        </div>
        <div className="modal-body">
          <div className="form-group"><label className="form-label">발신번호 <span className="text-danger">*</span></label><input className="form-control" placeholder="예: 0212345678 또는 01012345678" /><p className="form-hint">하이픈 없이 숫자만 입력하세요.</p></div>
          <div className="form-group"><label className="form-label">번호 유형 <span className="text-danger">*</span></label><select className="form-control"><option value="">유형 선택</option><option>일반 번호 (02, 031 등)</option><option>휴대폰 번호 (010)</option><option>대표번호 (1588, 1544 등)</option></select></div>
          <div className="form-group"><label className="form-label">사업자등록증 <span className="text-danger">*</span></label><div className="upload-area"><p>파일을 끌어다 놓거나 클릭하여 업로드</p><p style={{ color: "var(--fg-subtle)" }}>PDF, JPG, PNG · 최대 5MB</p></div></div>
          <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">통신서비스 이용증명원 <span className="text-danger">*</span></label><div className="upload-area"><p>파일을 끌어다 놓거나 클릭하여 업로드</p><p style={{ color: "var(--fg-subtle)" }}>PDF, JPG, PNG · 최대 5MB</p></div></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-default" onClick={closeSmsRegModal}>취소</button>
          <button className="btn btn-accent"><AppIcon name="send" className="icon icon-14" /> 신청 제출</button>
        </div>
      </ModalBackdrop>

      <ModalBackdrop open={overlays.kakaoRegModalOpen} onClose={closeKakaoRegModal}>
        <div className="modal-header">
          <div className="modal-title"><AppIcon name="kakao" className="icon icon-18" /> 카카오채널 연결</div>
          <button className="modal-close" onClick={closeKakaoRegModal}><AppIcon name="x" className="icon icon-18" /></button>
        </div>
        <div className="modal-body">
          <div className="form-group"><label className="form-label">채널 검색용 ID <span className="text-danger">*</span></label><input className="form-control" placeholder="예: @my-brand-channel" /><p className="form-hint">카카오톡 채널 관리자 센터 → 채널 설정에서 확인할 수 있습니다.</p></div>
          <div className="form-group"><label className="form-label">카카오 비즈 계정 ID <span className="text-danger">*</span></label><input className="form-control" placeholder="카카오 비즈니스 계정 이메일" /></div>
          <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">채널 유형</label><select className="form-control"><option>브랜드 채널</option><option>비즈니스 채널</option></select></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-default" onClick={closeKakaoRegModal}>취소</button>
          <button className="btn btn-kakao">채널 연결하기</button>
        </div>
      </ModalBackdrop>

      <ModalBackdrop open={overlays.lockedModalOpen} onClose={closeLockedModal}>
        <div className="modal-header">
          <div className="modal-title"><AppIcon name="lock" className="icon icon-18" /> 발신 자원이 필요합니다</div>
          <button className="modal-close" onClick={closeLockedModal}><AppIcon name="x" className="icon icon-18" /></button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: "var(--fg-muted)", marginBottom: 16 }}>{lockedDesc}</p>
          <div className="flash flash-attention" style={{ marginBottom: 0 }}>
            <div className="flash-body text-small">발신 자원을 먼저 등록하면 이 기능을 사용할 수 있습니다.</div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-default" onClick={closeLockedModal}>닫기</button>
          <button
            className="btn btn-accent"
            onClick={() => {
              closeLockedModal();
              navigate("resources");
            }}
          >
            자원 관리
          </button>
        </div>
      </ModalBackdrop>
    </>
  );
}
