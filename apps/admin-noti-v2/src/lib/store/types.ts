export type SmsStatus = "none" | "pending" | "supplement" | "rejected" | "active";
export type KakaoStatus = "none" | "active";
export type ScheduledStatus = "none" | "active";

export type PageId =
  | "dashboard"
  | "resources"
  | "sender-number-apply"
  | "kakao-connect"
  | "templates"
  | "events"
  | "logs"
  | "recipients"
  | "drafts"
  | "settings"
  | "ops"
  | "partner"
  | "sms-send"
  | "sms-campaign"
  | "sms-mock"
  | "alimtalk-send"
  | "alimtalk-campaign"
  | "brand-send"
  | "brand-campaign";

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
  scheduleType: "now" | "later";
  scheduledAt: string;
};

export type CampaignState = {
  mode: "list" | "new" | "detail";
  step: 1 | 2 | 3 | 4;
  channel: "sms" | "kakao" | "brand" | null;
  recipientMode: "upload" | "segment" | "manual";
  selectedCampaignId: string | null;
  selectedCampaignChannel: "sms" | "kakao" | "brand" | null;
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
  tone: "info" | "success" | "error";
  action: "drafts" | null;
};

export type UiState = {
  devPanelOpen: boolean;
  topbarNoticeOpen: boolean;
  navigationPendingPage: PageId | null;
  navigationPendingSince: number | null;
};
