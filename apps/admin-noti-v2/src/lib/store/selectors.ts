import type { DraftItem, ResourceState } from "./types";

export function canSMS(resources: ResourceState) {
  return resources.sms === "active";
}

export function canKakao(resources: ResourceState) {
  return resources.kakao === "active";
}

export function canCampaign(resources: ResourceState) {
  return canSMS(resources) || canKakao(resources);
}

export function pendingResourceCount(resources: ResourceState) {
  return (
    (resources.sms === "none" || resources.sms === "pending" ? 1 : 0) +
    (resources.kakao === "none" ? 1 : 0)
  );
}

export function draftCount(drafts: DraftItem[]) {
  return drafts.length;
}
