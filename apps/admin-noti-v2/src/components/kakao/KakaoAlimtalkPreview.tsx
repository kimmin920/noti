"use client";

import type { V2KakaoCampaignBootstrapResponse, V2KakaoSendOptionsResponse } from "@/lib/api/v2";

export type KakaoTemplateAction =
  | V2KakaoSendOptionsResponse["templates"][number]["buttons"][number]
  | V2KakaoSendOptionsResponse["templates"][number]["quickReplies"][number]
  | V2KakaoCampaignBootstrapResponse["templates"][number]["buttons"][number]
  | V2KakaoCampaignBootstrapResponse["templates"][number]["quickReplies"][number];

export function renderKakaoPreviewText(text: string, variables: Record<string, string>) {
  return text.split(/(#[{][^}]+[}])/g).map((part, index) => {
    const match = part.match(/^#\{(.+)\}$/);
    if (!match) return <span key={`${part}-${index}`}>{part}</span>;
    const value = variables[match[1]];
    return value ? (
      <span key={`${part}-${index}`}>{value}</span>
    ) : (
      <span key={`${part}-${index}`} className="preview-rich-inline-token">
        {part}
      </span>
    );
  });
}

export function KakaoPreviewActions({
  actions,
}: {
  actions: KakaoTemplateAction[];
}) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="kakao-preview-buttons">
      {[...actions].sort((a, b) => a.ordering - b.ordering).map((action, index) => {
        return (
          <div className="kakao-preview-button" key={`${action.type}-${action.name ?? index}-${action.ordering}`}>
            <span>{action.name || kakaoActionTypeLabel(action.type)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function KakaoActionDetails({
  actions,
  variables,
}: {
  actions: KakaoTemplateAction[];
  variables: Record<string, string>;
}) {
  const actionsWithLinks = actions
    .map((action) => ({
      action,
      links: getKakaoActionLinks(action),
    }))
    .filter((item) => item.links.length > 0);

  if (actionsWithLinks.length === 0) {
    return null;
  }

  return (
    <div className="kakao-action-details">
      <div className="kakao-action-details-title">버튼/링크</div>
      <div className="kakao-action-detail-list">
        {actionsWithLinks.map(({ action, links }, index) => (
          <div className="kakao-action-detail-row" key={`${action.type}-${action.name ?? index}-${action.ordering}`}>
            <div className="kakao-action-detail-head">
              <span className="kakao-action-detail-name">{action.name || kakaoActionTypeLabel(action.type)}</span>
              <span className="kakao-action-detail-type">{kakaoActionTypeLabel(action.type)}</span>
            </div>
            <dl className="kakao-action-link-list">
              {links.map((link) => (
                <div className="kakao-action-link-row" key={link.label}>
                  <dt>{link.label}</dt>
                  <dd>{renderKakaoPreviewText(link.value, variables)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

function getKakaoActionLinks(action: KakaoTemplateAction) {
  const links = [
    action.linkMo ? { label: "모바일", value: action.linkMo } : null,
    action.linkPc ? { label: "PC", value: action.linkPc } : null,
    action.schemeIos ? { label: "iOS", value: action.schemeIos } : null,
    action.schemeAndroid ? { label: "Android", value: action.schemeAndroid } : null,
    "telNumber" in action && action.telNumber ? { label: "전화번호", value: action.telNumber } : null,
  ];

  return links.filter((link): link is { label: string; value: string } => Boolean(link));
}

function kakaoActionTypeLabel(type: string) {
  if (type === "WL") return "웹링크";
  if (type === "AL") return "앱링크";
  if (type === "AC") return "채널 추가";
  if (type === "BK") return "봇 키워드";
  if (type === "MD") return "메시지 전달";
  return type || "버튼";
}
