"use client";

import { create } from "zustand";
import type {
  CampaignState,
  DraftItem,
  KakaoComposerState,
  OverlayState,
  PageId,
  ResourceState,
  SmsComposerState,
  SmsImage,
  ToastState,
  UiState,
} from "./types";

const initialSmsComposer: SmsComposerState = {
  to: "",
  subject: "",
  body: "",
  images: [],
  scheduleType: "now",
  scheduledAt: "",
};

const initialKakaoComposer: KakaoComposerState = {
  selectedTemplate: "",
  recipientPhone: "",
  variables: {},
  fallbackEnabled: false,
  scheduleType: "now",
  scheduledAt: "",
};

const initialCampaignState: CampaignState = {
  mode: "list",
  step: 1,
  channel: null,
  recipientMode: "upload",
  selectedCampaignId: null,
  selectedCampaignChannel: null,
};

const initialOverlays: OverlayState = {
  floatingHelperOpen: false,
  smsRegModalOpen: false,
  kakaoRegModalOpen: false,
  lockedModalOpen: false,
  lockedType: null,
};

const initialToast: ToastState = {
  open: false,
  message: "",
  tone: "info",
  action: null,
};

let draftToastTimeout: ReturnType<typeof setTimeout> | null = null;
let navigationPendingTimeout: ReturnType<typeof setTimeout> | null = null;

function getByteLength(text: string) {
  return new Blob([text]).size;
}

function hasSmsComposerContent(composer: SmsComposerState) {
  return Boolean(
    composer.to.trim() ||
      composer.subject.trim() ||
      composer.body.trim() ||
      composer.images.length > 0,
  );
}

function inferDraftType(composer: SmsComposerState): DraftItem["type"] {
  if (composer.images.length > 0) return "mms";
  return getByteLength(composer.body) > 90 ? "lms" : "sms";
}

function buildDraftFromSmsComposer(composer: SmsComposerState, id: number): DraftItem {
  const type = inferDraftType(composer);

  return {
    id,
    channel: type,
    type,
    to: composer.to.trim(),
    subject: composer.subject.trim() || `${type.toUpperCase()} 초안`,
    body: composer.body,
    hasImages: composer.images.length > 0,
    imageCount: composer.images.length,
    savedAt: new Date().toISOString(),
  };
}

type AppStoreSetter = (
  partial:
    | Partial<AppStore>
    | ((state: AppStore) => Partial<AppStore>),
) => void;

type ToastOptions = {
  tone?: ToastState["tone"];
  action?: ToastState["action"];
  durationMs?: number;
};

function openToast(set: AppStoreSetter, message: string, options?: ToastOptions) {
  if (draftToastTimeout) {
    clearTimeout(draftToastTimeout);
  }

  const tone = options?.tone ?? "info";
  const action = options?.action ?? null;
  const durationMs =
    options?.durationMs ?? (tone === "error" ? 7200 : tone === "success" ? 3400 : 4200);

  set((state) => ({
    draftToast: {
      ...state.draftToast,
      open: true,
      message,
      tone,
      action,
    },
  }));

  draftToastTimeout = setTimeout(() => {
    set((state) => ({
      draftToast: {
        ...state.draftToast,
        open: false,
      },
    }));
    draftToastTimeout = null;
  }, durationMs);
}

type AppStore = {
  ui: UiState;
  resources: ResourceState;
  devResourceOverrides: Partial<ResourceState>;
  drafts: {
    items: DraftItem[];
    nextId: number;
  };
  smsComposer: SmsComposerState;
  kakaoComposer: KakaoComposerState;
  campaign: CampaignState;
  overlays: OverlayState;
  draftToast: ToastState;
  navigate: (page: PageId, fromPage: PageId | null) => void;
  setSmsStatus: (status: ResourceState["sms"]) => void;
  setKakaoStatus: (status: ResourceState["kakao"]) => void;
  setScheduledStatus: (status: ResourceState["scheduled"]) => void;
  toggleDevPanel: () => void;
  closeDevPanel: () => void;
  toggleTopbarNotice: () => void;
  closeTopbarNotice: () => void;
  startNavigationPending: (page: PageId) => void;
  clearNavigationPending: () => void;
  setSmsComposer: (patch: Partial<SmsComposerState>) => void;
  resetSmsComposer: () => void;
  addSmsImage: (image: SmsImage) => void;
  removeSmsImage: (id: number) => void;
  saveSmsDraft: () => void;
  loadDraftIntoSmsComposer: (id: number) => void;
  setKakaoComposer: (patch: Partial<KakaoComposerState>) => void;
  resetKakaoComposer: () => void;
  saveKakaoDraft: () => void;
  setCampaign: (patch: Partial<CampaignState>) => void;
  resetCampaign: () => void;
  openFloatingHelper: () => void;
  closeFloatingHelper: () => void;
  toggleFloatingHelper: () => void;
  openSmsRegModal: () => void;
  closeSmsRegModal: () => void;
  openKakaoRegModal: () => void;
  closeKakaoRegModal: () => void;
  openLockedModal: (type: OverlayState["lockedType"]) => void;
  closeLockedModal: () => void;
  showDraftToast: (message: string, options?: ToastOptions) => void;
  hideDraftToast: () => void;
  addDraft: (draft: Omit<DraftItem, "id" | "savedAt">) => void;
  deleteDraft: (id: number) => void;
  clearDrafts: () => void;
};

export const useAppStore = create<AppStore>((set, get) => ({
  ui: {
    devPanelOpen: false,
    topbarNoticeOpen: false,
    navigationPendingPage: null,
    navigationPendingSince: null,
  },
  resources: {
    sms: "none",
    kakao: "none",
    scheduled: "none",
  },
  devResourceOverrides: {},
  drafts: {
    items: [],
    nextId: 1,
  },
  smsComposer: initialSmsComposer,
  kakaoComposer: initialKakaoComposer,
  campaign: initialCampaignState,
  overlays: initialOverlays,
  draftToast: initialToast,
  navigate: (page, fromPage) => {
    const { smsComposer } = get();
    const currentPage = fromPage;

    if (currentPage === "sms-send" && page !== "sms-send" && hasSmsComposerContent(smsComposer)) {
      let toastMessage = "";
      set((state) => {
        toastMessage = `${inferDraftType(state.smsComposer).toUpperCase()} 초안이 임시저장되었습니다.`;
        return {
          drafts: {
            nextId: state.drafts.nextId + 1,
            items: [buildDraftFromSmsComposer(state.smsComposer, state.drafts.nextId), ...state.drafts.items],
          },
          smsComposer: initialSmsComposer,
        };
      });
      openToast(set, toastMessage, {
        tone: "success",
        action: "drafts",
      });
    }
  },
  setSmsStatus: (status) =>
    set((state) => ({
      devResourceOverrides: { ...state.devResourceOverrides, sms: status },
    })),
  setKakaoStatus: (status) =>
    set((state) => ({
      devResourceOverrides: { ...state.devResourceOverrides, kakao: status },
    })),
  setScheduledStatus: (status) =>
    set((state) => ({
      devResourceOverrides: { ...state.devResourceOverrides, scheduled: status },
    })),
  toggleDevPanel: () =>
    set((state) => ({
      ui: {
        ...state.ui,
        devPanelOpen: !state.ui.devPanelOpen,
        topbarNoticeOpen: false,
      },
    })),
  closeDevPanel: () =>
    set((state) => ({
      ui: { ...state.ui, devPanelOpen: false },
    })),
  toggleTopbarNotice: () =>
    set((state) => ({
      ui: {
        ...state.ui,
        topbarNoticeOpen: !state.ui.topbarNoticeOpen,
        devPanelOpen: false,
      },
    })),
  closeTopbarNotice: () =>
    set((state) => ({
      ui: { ...state.ui, topbarNoticeOpen: false },
    })),
  startNavigationPending: (page) =>
    {
      if (navigationPendingTimeout) {
        clearTimeout(navigationPendingTimeout);
        navigationPendingTimeout = null;
      }

      set((state) => ({
        ui: {
          ...state.ui,
          navigationPendingPage: page,
          navigationPendingSince: Date.now(),
        },
      }));
    },
  clearNavigationPending: () => {
    const { navigationPendingPage, navigationPendingSince } = get().ui;
    if (!navigationPendingPage) {
      return;
    }

    if (navigationPendingTimeout) {
      clearTimeout(navigationPendingTimeout);
      navigationPendingTimeout = null;
    }

    const elapsed = navigationPendingSince ? Date.now() - navigationPendingSince : 0;
    const remaining = Math.max(0, 70 - elapsed);

    const clear = () =>
      set((state) => ({
        ui: {
          ...state.ui,
          navigationPendingPage: null,
          navigationPendingSince: null,
        },
      }));

    if (remaining > 0) {
      navigationPendingTimeout = setTimeout(() => {
        clear();
        navigationPendingTimeout = null;
      }, remaining);
      return;
    }

    clear();
  },
  setSmsComposer: (patch) =>
    set((state) => ({
      smsComposer: { ...state.smsComposer, ...patch },
    })),
  resetSmsComposer: () =>
    set(() => ({
      smsComposer: initialSmsComposer,
    })),
  addSmsImage: (image) =>
    set((state) => ({
      smsComposer: {
        ...state.smsComposer,
        images: [...state.smsComposer.images, image].slice(0, 3),
      },
    })),
  removeSmsImage: (id) =>
    set((state) => ({
      smsComposer: {
        ...state.smsComposer,
        images: state.smsComposer.images.filter((image) => image.id !== id),
      },
    })),
  saveSmsDraft: () => {
    if (!hasSmsComposerContent(get().smsComposer)) return;

    let toastMessage = "";
    set((state) => {
      toastMessage = `${inferDraftType(state.smsComposer).toUpperCase()} 초안이 임시저장되었습니다.`;
      return {
        drafts: {
          nextId: state.drafts.nextId + 1,
          items: [buildDraftFromSmsComposer(state.smsComposer, state.drafts.nextId), ...state.drafts.items],
        },
        smsComposer: initialSmsComposer,
      };
    });
    openToast(set, toastMessage, {
      tone: "success",
      action: "drafts",
    });
  },
  loadDraftIntoSmsComposer: (id) => {
    const draft = get().drafts.items.find((item) => item.id === id);
    if (!draft) return;

    set(() => ({
      smsComposer: {
        ...initialSmsComposer,
        to: draft.to,
        subject: draft.subject,
        body: draft.body,
      },
    }));
  },
  setKakaoComposer: (patch) =>
    set((state) => ({
      kakaoComposer: { ...state.kakaoComposer, ...patch },
    })),
  resetKakaoComposer: () =>
    set(() => ({
      kakaoComposer: initialKakaoComposer,
    })),
  saveKakaoDraft: () => {
    const composer = get().kakaoComposer;
    const hasContent = Boolean(
      composer.selectedTemplate ||
        composer.recipientPhone.trim() ||
        Object.values(composer.variables).some(Boolean),
    );
    if (!hasContent) return;

    set((state) => ({
      drafts: {
        nextId: state.drafts.nextId + 1,
        items: [
          {
            id: state.drafts.nextId,
            channel: "kakao",
            type: "kakao",
            to: state.kakaoComposer.recipientPhone.trim(),
            subject: state.kakaoComposer.selectedTemplate || "알림톡 초안",
            body: state.kakaoComposer.selectedTemplate,
            hasImages: false,
            imageCount: 0,
            savedAt: new Date().toISOString(),
          },
          ...state.drafts.items,
        ],
      },
      kakaoComposer: initialKakaoComposer,
    }));
    openToast(set, "알림톡 초안이 임시저장되었습니다.", {
      tone: "success",
      action: "drafts",
    });
  },
  setCampaign: (patch) =>
    set((state) => ({
      campaign: { ...state.campaign, ...patch },
    })),
  resetCampaign: () =>
    set(() => ({
      campaign: initialCampaignState,
    })),
  openFloatingHelper: () =>
    set((state) => ({
      overlays: { ...state.overlays, floatingHelperOpen: true },
      ui: { ...state.ui, topbarNoticeOpen: false, devPanelOpen: false },
    })),
  closeFloatingHelper: () =>
    set((state) => ({
      overlays: { ...state.overlays, floatingHelperOpen: false },
    })),
  toggleFloatingHelper: () =>
    set((state) => ({
      overlays: { ...state.overlays, floatingHelperOpen: !state.overlays.floatingHelperOpen },
      ui: { ...state.ui, topbarNoticeOpen: false, devPanelOpen: false },
    })),
  openSmsRegModal: () =>
    set((state) => ({
      overlays: { ...state.overlays, smsRegModalOpen: true },
    })),
  closeSmsRegModal: () =>
    set((state) => ({
      overlays: { ...state.overlays, smsRegModalOpen: false },
    })),
  openKakaoRegModal: () =>
    set((state) => ({
      overlays: { ...state.overlays, kakaoRegModalOpen: true },
    })),
  closeKakaoRegModal: () =>
    set((state) => ({
      overlays: { ...state.overlays, kakaoRegModalOpen: false },
    })),
  openLockedModal: (type) =>
    set((state) => ({
      overlays: { ...state.overlays, lockedModalOpen: true, lockedType: type },
    })),
  closeLockedModal: () =>
    set((state) => ({
      overlays: { ...state.overlays, lockedModalOpen: false, lockedType: null },
    })),
  showDraftToast: (message, options) =>
    openToast(set, message, options),
  hideDraftToast: () => {
    if (draftToastTimeout) {
      clearTimeout(draftToastTimeout);
      draftToastTimeout = null;
    }
    set((state) => ({
      draftToast: { ...state.draftToast, open: false },
    }));
  },
  addDraft: (draft) => {
    set((state) => ({
      drafts: {
        nextId: state.drafts.nextId + 1,
        items: [
          {
            ...draft,
            id: state.drafts.nextId,
            savedAt: new Date().toISOString(),
          },
          ...state.drafts.items,
        ],
      },
    }));
    openToast(set, `${draft.type === "kakao" ? "알림톡" : draft.type.toUpperCase()} 초안이 임시저장되었습니다.`, {
      tone: "success",
      action: "drafts",
    });
  },
  deleteDraft: (id) =>
    set((state) => ({
      drafts: {
        ...state.drafts,
        items: state.drafts.items.filter((item) => item.id !== id),
      },
    })),
  clearDrafts: () =>
    set((state) => ({
      drafts: {
        ...state.drafts,
        items: [],
      },
    })),
}));
