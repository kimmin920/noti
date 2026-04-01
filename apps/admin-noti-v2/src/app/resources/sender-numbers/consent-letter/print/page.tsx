import { parseConsentLetterDraft } from "@/lib/resources/sender-number-consent-letter";
import { SenderNumberConsentLetterPrintPage } from "@/components/resources/SenderNumberConsentLetterPrintPage";

type SenderNumberConsentLetterPrintRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SenderNumberConsentLetterPrintRoute({
  searchParams,
}: SenderNumberConsentLetterPrintRouteProps) {
  const resolvedSearchParams = await searchParams;
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (typeof value === "string") {
      params.set(key, value);
    }
  }

  return <SenderNumberConsentLetterPrintPage draft={parseConsentLetterDraft(params)} />;
}
