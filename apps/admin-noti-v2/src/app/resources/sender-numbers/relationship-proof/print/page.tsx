import { SenderNumberRelationshipProofPrintPage } from "@/components/resources/SenderNumberRelationshipProofPrintPage";
import { parseRelationshipProofDraft } from "@/lib/resources/sender-number-relationship-proof";

type SenderNumberRelationshipProofPrintRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SenderNumberRelationshipProofPrintRoute({
  searchParams,
}: SenderNumberRelationshipProofPrintRouteProps) {
  const resolvedSearchParams = await searchParams;
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (typeof value === "string") {
      params.set(key, value);
    }
  }

  return <SenderNumberRelationshipProofPrintPage draft={parseRelationshipProofDraft(params)} />;
}
