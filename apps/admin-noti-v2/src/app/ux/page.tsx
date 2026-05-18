import { Suspense } from "react";
import { RecommendedMessagingUxPage } from "@/components/ux/RecommendedMessagingUxPage";

export default function UxVariantPage() {
  return (
    <Suspense fallback={null}>
      <RecommendedMessagingUxPage />
    </Suspense>
  );
}
