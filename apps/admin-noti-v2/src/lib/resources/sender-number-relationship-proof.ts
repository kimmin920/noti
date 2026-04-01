import {
  buildDefaultSenderLetterStamp,
  type SenderLetterStamp,
} from "@/lib/resources/sender-letter-stamp";

export type RelationshipProofDraft = {
  ownerCompanyName: string;
  ownerBusinessNumber: string;
  targetPhoneNumber: string;
  relationshipType: string;
  relationshipDescription: string;
  usagePurpose: string;
  usagePeriod: string;
  signedDate: string;
  ownerStamp: SenderLetterStamp | null;
  userStamp: SenderLetterStamp | null;
};

type RelationshipProofPrintableKey = Exclude<
  keyof RelationshipProofDraft,
  "ownerStamp" | "userStamp"
>;

const RELATIONSHIP_PROOF_QUERY_KEYS: Record<RelationshipProofPrintableKey, string> = {
  ownerCompanyName: "ownerCompanyName",
  ownerBusinessNumber: "ownerBusinessNumber",
  targetPhoneNumber: "targetPhoneNumber",
  relationshipType: "relationshipType",
  relationshipDescription: "relationshipDescription",
  usagePurpose: "usagePurpose",
  usagePeriod: "usagePeriod",
  signedDate: "signedDate",
};

export const SENDER_NUMBER_RELATIONSHIP_PROOF_PRINT_PATH =
  "/resources/sender-numbers/relationship-proof/print";

export const RELATIONSHIP_TYPE_OPTIONS = [
  "위수탁",
  "계열사",
  "대행",
  "공급/제휴",
  "기타",
] as const;

export function buildInitialRelationshipProofDraft(phoneNumber: string): RelationshipProofDraft {
  const today = new Date().toISOString().slice(0, 10);

  return {
    ownerCompanyName: "",
    ownerBusinessNumber: "",
    targetPhoneNumber: phoneNumber.replace(/[^\d-]/g, ""),
    relationshipType: "위수탁",
    relationshipDescription: "",
    usagePurpose: "메시지 발송 서비스 이용",
    usagePeriod: "서비스 이용 신청일부터 서비스 이용 종료일까지",
    signedDate: today,
    ownerStamp: buildDefaultSenderLetterStamp(),
    userStamp: {
      ...buildDefaultSenderLetterStamp(),
      dataUrl: "/assets/비주오.png",
      x: 24,
      y: 12,
      width: 68,
      height: 68,
    },
  };
}

export function formatRelationshipProofSignedDate(date: string) {
  if (!date) {
    return "20    년    월    일";
  }

  const [year, month, day] = date.split("-");
  return `${year}년 ${month}월 ${day}일`;
}

export function buildRelationshipProofPrintPath(draft: RelationshipProofDraft) {
  const params = new URLSearchParams();

  for (const [key, queryKey] of Object.entries(
    RELATIONSHIP_PROOF_QUERY_KEYS,
  ) as Array<[RelationshipProofPrintableKey, string]>) {
    const value = draft[key];
    if (value) {
      params.set(queryKey, value);
    }
  }

  const query = params.toString();
  return query
    ? `${SENDER_NUMBER_RELATIONSHIP_PROOF_PRINT_PATH}?${query}`
    : SENDER_NUMBER_RELATIONSHIP_PROOF_PRINT_PATH;
}

export function parseRelationshipProofDraft(
  source: Pick<URLSearchParams, "get">,
): RelationshipProofDraft {
  const draft = buildInitialRelationshipProofDraft("");

  for (const [key, queryKey] of Object.entries(
    RELATIONSHIP_PROOF_QUERY_KEYS,
  ) as Array<[RelationshipProofPrintableKey, string]>) {
    draft[key] = source.get(queryKey) ?? draft[key];
  }

  return draft;
}
