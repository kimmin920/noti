import type { PageId } from "@/lib/store/types";

export type AppRouteDef = {
  id: PageId;
  path: string;
  title: string;
  desc: string;
};

export const APP_ROUTES: AppRouteDef[] = [
  { id: "dashboard", path: "/dashboard", title: "대시보드", desc: "ACME Corp 워크스페이스 운영 현황" },
  { id: "resources", path: "/resources", title: "발신 자원 관리", desc: "SMS 발신번호와 카카오 채널을 등록·관리합니다" },
  { id: "templates", path: "/templates", title: "템플릿 관리", desc: "SMS 및 알림톡 발송 템플릿을 관리합니다" },
  { id: "events", path: "/events", title: "이벤트 규칙", desc: "외부 이벤트에 따라 자동으로 메시지를 발송하는 규칙을 관리합니다" },
  { id: "logs", path: "/logs", title: "발송 로그", desc: "발송 결과와 상태를 확인할 수 있습니다" },
  { id: "recipients", path: "/recipients", title: "수신자 관리", desc: "수신 대상과 그룹을 관리합니다" },
  { id: "drafts", path: "/drafts", title: "임시저장함", desc: "저장된 메시지 초안을 확인할 수 있습니다" },
  { id: "settings", path: "/settings", title: "운영 설정", desc: "워크스페이스 운영 설정을 관리합니다" },
  { id: "sms-send", path: "/send/sms", title: "SMS 발송", desc: "단건 문자와 MMS를 전송합니다" },
  { id: "kakao-send", path: "/send/kakao", title: "알림톡 발송", desc: "카카오 비즈메시지를 전송합니다" },
  { id: "campaign", path: "/campaign", title: "대량 발송", desc: "대상자 그룹에 맞춰 대량 메시지를 보냅니다" },
];

export const APP_ROUTE_MAP = Object.fromEntries(
  APP_ROUTES.map((route) => [route.id, route]),
) as Record<PageId, AppRouteDef>;

export function getRouteByPageId(pageId: PageId) {
  return APP_ROUTE_MAP[pageId];
}

export function getPageIdByPath(pathname: string): PageId | null {
  const normalized = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
  const match = APP_ROUTES.find((route) => route.path === normalized);
  return match?.id ?? null;
}
