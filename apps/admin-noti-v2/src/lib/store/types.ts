export type SmsStatus = "none" | "pending" | "active";
export type KakaoStatus = "none" | "active";
export type ScheduledStatus = "none" | "active";

export type PageId =
  | "dashboard"
  | "resources"
  | "templates"
  | "events"
  | "logs"
  | "recipients"
  | "drafts"
  | "settings"
  | "sms-send"
  | "kakao-send"
  | "campaign";

export type ResourceState = {
  sms: SmsStatus;
  kakao: KakaoStatus;
  scheduled: ScheduledStatus;
};

export type DraftType = "sms" | "lms" | "mms" | "kakao";

export type DraftItem = {
  id: number;
  channel: DraftType;
  type: DraftType;
  to: string;
  subject: string;
  body: string;
  hasImages: boolean;
  imageCount: number;
  savedAt: string;
};

export type SmsImage = {
  id: number;
  src: string;
  name: string;
  size: number;
};

export type SmsComposerState = {
  to: string;
  subject: string;
  body: string;
  images: SmsImage[];
  scheduleType: "now" | "later";
  scheduledAt: string;
};

export type KakaoComposerState = {
  selectedTemplate: string;
  recipientPhone: string;
  variables: Record<string, string>;
  fallbackEnabled: boolean;
  fallbackBody: string;
  scheduleType: "now" | "later";
  scheduledAt: string;
};

export type CampaignState = {
  mode: "list" | "new" | "detail";
  step: 1 | 2 | 3 | 4;
  channel: "sms" | "kakao" | null;
  recipientMode: "upload" | "segment" | "manual";
  selectedCampaignId: string | null;
  selectedCampaignChannel: "sms" | "kakao" | null;
};

export type OverlayState = {
  floatingHelperOpen: boolean;
  smsRegModalOpen: boolean;
  kakaoRegModalOpen: boolean;
  lockedModalOpen: boolean;
  lockedType: "sms" | "kakao" | "campaign" | null;
};

export type ToastState = {
  open: boolean;
  message: string;
};

export type UiState = {
  devPanelOpen: boolean;
  topbarNoticeOpen: boolean;
  activeResourceTab: "tab-sms" | "tab-kakao";
  navigationPendingPage: PageId | null;
  navigationPendingSince: number | null;
};
