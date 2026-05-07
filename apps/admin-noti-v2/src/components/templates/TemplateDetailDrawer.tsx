"use client";

import { useEffectEvent } from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";
import type {
  V2BrandTemplateDetailResponse,
  V2KakaoTemplateDetailResponse,
  V2SmsTemplateDetailResponse,
} from "@/lib/api/v2";
import { BrandTemplatePreview } from "./BrandTemplatePreview";

type TemplateDetailDrawerProps = {
  open: boolean;
  kind: "sms" | "kakao" | "brand" | null;
  loading: boolean;
  error: string | null;
  smsDetail: V2SmsTemplateDetailResponse | null;
  kakaoDetail: V2KakaoTemplateDetailResponse | null;
  brandDetail: V2BrandTemplateDetailResponse | null;
  kakaoActions?: {
    deleting: boolean;
    onEdit: () => void;
    onDelete: () => void;
  } | null;
  brandActions?: {
    deleting: boolean;
    onEdit: () => void;
    onDelete: () => void;
  } | null;
  onClose: () => void;
};

export function TemplateDetailDrawer({
  open,
  kind,
  loading,
  error,
  smsDetail,
  kakaoDetail,
  brandDetail,
  kakaoActions = null,
  brandActions = null,
  onClose,
}: TemplateDetailDrawerProps) {
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

  if (!open) {
    return null;
  }

  const title = kind === "kakao" ? "알림톡 템플릿 보기" : kind === "brand" ? "브랜드 템플릿 보기" : "SMS 템플릿 보기";

  return (
    <div className="template-detail-backdrop" onClick={onClose}>
      <aside className="template-detail-drawer" onClick={(event) => event.stopPropagation()} role="dialog" aria-label={title}>
        <div className="template-detail-header">
          <div>
            <div className="template-detail-eyebrow">{kind === "kakao" ? "알림톡 템플릿" : kind === "brand" ? "브랜드 템플릿" : "SMS 템플릿"}</div>
            <div className="template-detail-title">{title}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {kind === "kakao" && !loading && !error && kakaoDetail && kakaoActions ? (
              <>
                <button className="btn btn-default btn-sm" onClick={kakaoActions.onEdit}>
                  수정
                </button>
                <button className="btn btn-danger btn-sm" onClick={kakaoActions.onDelete} disabled={kakaoActions.deleting}>
                  {kakaoActions.deleting ? "삭제 중..." : "삭제"}
                </button>
              </>
            ) : null}
            {kind === "brand" && !loading && !error && brandDetail && brandActions ? (
              <>
                <button className="btn btn-default btn-sm" onClick={brandActions.onEdit}>
                  수정
                </button>
                <button className="btn btn-danger btn-sm" onClick={brandActions.onDelete} disabled={brandActions.deleting}>
                  {brandActions.deleting ? "삭제 중..." : "삭제"}
                </button>
              </>
            ) : null}
            <button className="modal-close" onClick={onClose} aria-label="상세 보기 닫기">
              <AppIcon name="x" className="icon icon-18" />
            </button>
          </div>
        </div>

        <div className="template-detail-body">
          {loading ? <TemplateDetailLoading /> : null}
          {!loading && error ? (
            <div className="flash flash-attention" style={{ marginBottom: 16 }}>
              <AppIcon name="warn" className="icon icon-16 flash-icon" />
              <div className="flash-body">{error}</div>
            </div>
          ) : null}
          {!loading && !error && kind === "sms" && smsDetail ? <SmsTemplateDetail detail={smsDetail} /> : null}
          {!loading && !error && kind === "kakao" && kakaoDetail ? <KakaoTemplateDetail detail={kakaoDetail} /> : null}
          {!loading && !error && kind === "brand" && brandDetail ? <BrandTemplateDetail detail={brandDetail} /> : null}
        </div>
      </aside>
    </div>
  );
}

function SmsTemplateDetail({ detail }: { detail: V2SmsTemplateDetailResponse }) {
  const item = detail.template;
  const requiredVariables = normalizeVariables(item.requiredVariables);

  return (
    <div className="template-detail-stack">
      <div className="box">
        <div className="box-header">
          <div>
            <div className="box-title">{item.name}</div>
            <div className="box-subtitle">현재 사용 중인 SMS 템플릿 정보입니다.</div>
          </div>
          <span className={`label ${templateStatusClass(item.status)}`}>
            <span className="label-dot" />
            {templateStatusText(item.status)}
          </span>
        </div>
        <div className="box-body">
          <div className="template-detail-meta-grid">
            <MetaField label="최근 버전" value={item.latestVersion ? `v${item.latestVersion.version}` : `v${item.versionCount}`} />
            <MetaField label="버전 수" value={`${item.versionCount}개`} />
            <MetaField label="생성일" value={formatDateTime(item.createdAt)} />
            <MetaField label="변경일" value={formatDateTime(item.updatedAt)} />
          </div>
          <div className="template-detail-section">
            <div className="template-detail-section-title">필수 변수</div>
            {requiredVariables.length > 0 ? (
              <div className="template-detail-chip-list">
                {requiredVariables.map((item) => (
                  <span key={item} className="template-detail-chip">#{`{${item}}`}</span>
                ))}
              </div>
            ) : (
              <div className="template-detail-empty-inline">필수 변수 없음</div>
            )}
          </div>
        </div>
      </div>

      <div className="box">
        <div className="box-header">
          <div className="box-title">본문</div>
        </div>
        <div className="box-body">
          <pre className="template-detail-pre">{item.body}</pre>
        </div>
      </div>
    </div>
  );
}

function KakaoTemplateDetail({ detail }: { detail: V2KakaoTemplateDetailResponse }) {
  const item = detail.template;
  const rejectionMessages = item.providerStatus === "REJ" ? normalizeKakaoRejectionMessages(item) : [];

  return (
    <div className="template-detail-stack">
      <div className="box">
        <div className="box-header">
          <div>
            <div className="box-title">{item.name}</div>
            <div className="box-subtitle">{item.ownerLabel}</div>
          </div>
          <span className={`label ${providerStatusClass(item.providerStatus)}`}>
            <span className="label-dot" />
            {providerStatusText(item.providerStatus)}
          </span>
        </div>
        <div className="box-body">
          <div className="template-detail-meta-grid">
            <MetaField label="템플릿 코드" value={item.templateCode || "—"} mono />
            <MetaField label="메시지 유형" value={messageTypeText(item.messageType)} />
            <MetaField label="강조 유형" value={emphasizeTypeText(item.emphasizeType)} />
            <MetaField label="등록일" value={formatDateTime(item.createdAt)} />
          </div>
          <div className="template-detail-meta-grid template-detail-meta-grid-tight">
            <MetaField label="채널" value={item.ownerLabel} />
            <MetaField label="보안 템플릿" value={item.securityFlag ? "사용" : "사용 안 함"} />
            <MetaField label="카테고리" value={item.categoryCode || "—"} mono />
            <MetaField label="변경일" value={formatDateTime(item.updatedAt)} />
          </div>
        </div>
      </div>

      {item.providerStatus === "REJ" ? (
        <div className="box">
          <div className="box-header">
            <div>
              <div className="box-title">반려 사유</div>
              <div className="box-subtitle">NHN/카카오 검수에서 전달된 코멘트입니다.</div>
            </div>
          </div>
          <div className="box-body">
            {rejectionMessages.length > 0 ? (
              <div className="template-rejection-list">
                {rejectionMessages.map((message, index) => (
                  <div key={`${index}-${message}`} className="template-rejection-note">
                    {message}
                  </div>
                ))}
              </div>
            ) : (
              <div className="template-rejection-note muted">반려 사유가 제공되지 않았습니다.</div>
            )}
          </div>
        </div>
      ) : null}

      <div className="box">
        <div className="box-header">
          <div className="box-title">메시지 미리보기</div>
        </div>
        <div className="box-body">
          <div className="template-detail-preview-wrap">
            <div className="kakao-phone">
              <div className="kakao-phone-topbar">
                <span />
                <div className="kakao-phone-topbar-title">알림톡</div>
                <span />
              </div>
              <div className="kakao-chat-area">
                <div className="kakao-chat-header">
                  <span className="kakao-chat-header-badge">{item.ownerLabel}</span>
                </div>
                <div className="kakao-msg-row">
                  <div className="kakao-avatar">톡</div>
                  <div className="kakao-bubble-wrap">
                    <div className="kakao-sender-name">{item.ownerLabel}</div>
                    <div className="kakao-bubble">
                      {item.imageUrl ? (
                        <div className="kakao-bubble-img">
                          <img src={item.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                      ) : null}
                      {item.title ? <div className="kakao-bubble-title">{item.title}</div> : null}
                      {item.subtitle ? <div className="kakao-bubble-subtitle">{item.subtitle}</div> : null}
                      <div className="kakao-bubble-content">{item.body}</div>
                      {item.extra ? <div className="kakao-bubble-extra">{item.extra}</div> : null}
                      {item.buttons.length > 0 ? (
                        <div className="kakao-btn-area">
                          {item.buttons.map((button) => (
                            <div key={`${button.ordering}-${button.type}-${button.name || "button"}`} className="kakao-btn-item">
                              {button.name || button.type}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {item.quickReplies.length > 0 ? (
                      <div className="kakao-quick-area">
                        {item.quickReplies.map((quickReply) => (
                          <div key={`${quickReply.ordering}-${quickReply.type}-${quickReply.name || "quick"}`} className="kakao-quick-item">
                            {quickReply.name || quickReply.type}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BrandTemplateDetail({ detail }: { detail: V2BrandTemplateDetailResponse }) {
  const item = detail.template;

  return (
    <div className="template-detail-stack">
      <div className="box">
        <div className="box-header">
          <div>
            <div className="box-title">{item.templateName}</div>
            <div className="box-subtitle">{item.ownerLabel}</div>
          </div>
          <span className={`label ${providerStatusClass(item.providerStatus)}`}>
            <span className="label-dot" />
            {providerStatusText(item.providerStatus)}
          </span>
        </div>
        <div className="box-body">
          <div className="template-detail-meta-grid">
            <MetaField label="템플릿 코드" value={item.templateCode || "—"} mono />
            <MetaField label="유형" value={brandTemplateTypeText(item.chatBubbleType)} />
            <MetaField label="채널" value={item.ownerLabel} />
            <MetaField label="등록일" value={formatDateTime(item.createdAt)} />
          </div>
          <div className="template-detail-meta-grid template-detail-meta-grid-tight">
            <MetaField label="senderKey" value={item.senderKey} mono />
            <MetaField label="성인용 메시지" value={item.adult ? "사용" : "사용 안 함"} />
            <MetaField label="프로필 타입" value={item.senderProfileType || "—"} />
            <MetaField label="변경일" value={formatDateTime(item.updatedAt)} />
          </div>
        </div>
      </div>

      <div className="box">
        <div className="box-header">
          <div className="box-title">메시지 미리보기</div>
        </div>
        <div className="box-body">
          <div className="template-detail-preview-wrap">
            <BrandTemplatePreview model={item} compact />
          </div>
        </div>
      </div>

      {item.content ? (
        <div className="box">
          <div className="box-header">
            <div className="box-title">본문</div>
          </div>
          <div className="box-body">
            <pre className="template-detail-pre">{item.content}</pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MetaField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="template-detail-meta-field">
      <div className="template-detail-meta-label">{label}</div>
      <div className={`template-detail-meta-value${mono ? " mono" : ""}`}>{value}</div>
    </div>
  );
}

function TemplateDetailLoading() {
  return (
    <div className="template-detail-stack">
      <div className="box">
        <div className="box-body">
          <div className="template-detail-loading-line wide" />
          <div className="template-detail-loading-grid">
            <div className="template-detail-loading-line" />
            <div className="template-detail-loading-line" />
            <div className="template-detail-loading-line" />
            <div className="template-detail-loading-line" />
          </div>
        </div>
      </div>
      <div className="box">
        <div className="box-body">
          <div className="template-detail-loading-block" />
        </div>
      </div>
    </div>
  );
}

function normalizeVariables(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item)).filter(Boolean);
}

function normalizeKakaoRejectionMessages(item: V2KakaoTemplateDetailResponse["template"]) {
  const primaryMessages = uniqueRejectionMessages([
    item.rejectedReason,
    ...(Array.isArray(item.comments) ? item.comments : []),
  ]);

  if (primaryMessages.length > 0) {
    return primaryMessages;
  }

  return uniqueRejectionMessages([item.comment]);
}

function uniqueRejectionMessages(messages: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const uniqueMessages: string[] = [];

  for (const message of messages) {
    const trimmed = typeof message === "string" ? message.trim() : "";

    if (!trimmed) {
      continue;
    }

    const key = trimmed.replace(/\s+/g, " ");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueMessages.push(trimmed);
  }

  return uniqueMessages;
}

function templateStatusText(status: string) {
  if (status === "PUBLISHED") return "발행됨";
  if (status === "ARCHIVED") return "보관됨";
  return "초안";
}

function templateStatusClass(status: string) {
  if (status === "PUBLISHED") return "label-green";
  if (status === "ARCHIVED") return "label-gray";
  return "label-blue";
}

function providerStatusText(status?: string | null) {
  if (status === "APR") return "승인됨";
  if (status === "REJ") return "반려";
  return "검토 중";
}

function providerStatusClass(status?: string | null) {
  if (status === "APR") return "label-green";
  if (status === "REJ") return "label-red";
  return "label-blue";
}

function messageTypeText(type: string | null) {
  if (type === "AD") return "채널 추가형";
  if (type === "EX") return "부가 정보형";
  if (type === "MI") return "복합형";
  if (type === "BA") return "기본형";
  return "기본형";
}

function emphasizeTypeText(type: string | null) {
  if (type === "TEXT") return "강조 표기형";
  if (type === "IMAGE") return "이미지형";
  return "없음";
}

function brandTemplateTypeText(type: string | null) {
  const map: Record<string, string> = {
    TEXT: "텍스트형",
    IMAGE: "이미지형",
    WIDE: "와이드 이미지형",
    WIDE_ITEM_LIST: "와이드 아이템리스트형",
    PREMIUM_VIDEO: "프리미엄 동영상형",
    COMMERCE: "커머스형",
    CAROUSEL_FEED: "캐러셀 피드형",
    CAROUSEL_COMMERCE: "캐러셀 커머스형",
  };
  return type ? (map[type] || type) : "기타";
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "—";
  }

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
