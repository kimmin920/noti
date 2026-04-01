import {
  buildDefaultSenderLetterStamp,
  type SenderLetterStamp,
} from "@/lib/resources/sender-letter-stamp";

export type ConsentLetterDraft = {
  targetPhoneNumber: string;
  delegationPeriod: string;
  delegationPurpose: string;
  ownerName: string;
  ownerRegistrationNumber: string;
  ownerAddress: string;
  ownerPhone: string;
  userName: string;
  userRegistrationNumber: string;
  userAddress: string;
  userPhone: string;
  signedDate: string;
  ownerStamp: SenderLetterStamp | null;
};

type ConsentLetterPrintableKey = Exclude<keyof ConsentLetterDraft, "ownerStamp">;

const CONSENT_LETTER_QUERY_KEYS: Record<ConsentLetterPrintableKey, string> = {
  targetPhoneNumber: "targetPhoneNumber",
  delegationPeriod: "delegationPeriod",
  delegationPurpose: "delegationPurpose",
  ownerName: "ownerName",
  ownerRegistrationNumber: "ownerRegistrationNumber",
  ownerAddress: "ownerAddress",
  ownerPhone: "ownerPhone",
  userName: "userName",
  userRegistrationNumber: "userRegistrationNumber",
  userAddress: "userAddress",
  userPhone: "userPhone",
  signedDate: "signedDate",
};

export const SENDER_NUMBER_CONSENT_LETTER_PRINT_PATH = "/resources/sender-numbers/consent-letter/print";

export function buildInitialConsentLetterDraft(phoneNumber: string): ConsentLetterDraft {
  const today = new Date().toISOString().slice(0, 10);

  return {
    targetPhoneNumber: phoneNumber.replace(/[^\d-]/g, ""),
    delegationPeriod: "SMS/알림톡 서비스 이용 신청일부터 서비스 이용 종료일까지",
    delegationPurpose: "",
    ownerName: "",
    ownerRegistrationNumber: "",
    ownerAddress: "",
    ownerPhone: "",
    userName: "비주오(VIZUO)",
    userRegistrationNumber: "519-24-02167",
    userAddress: "",
    userPhone: "",
    signedDate: today,
    ownerStamp: buildDefaultSenderLetterStamp(),
  };
}

export function formatConsentLetterSignedDate(date: string) {
  if (!date) {
    return "20    년    월    일";
  }

  const [year, month, day] = date.split("-");
  return `${year}년 ${month}월 ${day}일`;
}

export function buildConsentLetterPrintPath(draft: ConsentLetterDraft) {
  const params = new URLSearchParams();

  for (const [key, queryKey] of Object.entries(CONSENT_LETTER_QUERY_KEYS) as Array<[ConsentLetterPrintableKey, string]>) {
    const value = draft[key];
    if (value) {
      params.set(queryKey, value);
    }
  }

  const query = params.toString();
  return query ? `${SENDER_NUMBER_CONSENT_LETTER_PRINT_PATH}?${query}` : SENDER_NUMBER_CONSENT_LETTER_PRINT_PATH;
}

export function parseConsentLetterDraft(
  source: Pick<URLSearchParams, "get">,
): ConsentLetterDraft {
  const draft = buildInitialConsentLetterDraft("");

  for (const [key, queryKey] of Object.entries(CONSENT_LETTER_QUERY_KEYS) as Array<[ConsentLetterPrintableKey, string]>) {
    draft[key] = source.get(queryKey) ?? draft[key];
  }

  return draft;
}
