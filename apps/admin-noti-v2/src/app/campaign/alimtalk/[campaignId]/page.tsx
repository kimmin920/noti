import { AppShell } from "@/components/shell/AppShell";
import { fetchServerAuthSnapshot, fetchServerCampaignsShellData } from "@/lib/server/api";

type AlimtalkCampaignDetailRoutePageProps = {
  params: Promise<{
    campaignId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AlimtalkCampaignDetailRoutePage({
  params,
  searchParams,
}: AlimtalkCampaignDetailRoutePageProps) {
  const auth = await fetchServerAuthSnapshot();
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const from = typeof resolvedSearchParams.from === "string" ? resolvedSearchParams.from : null;

  if (auth.status !== "authenticated") {
    return (
      <AppShell
        initialPage="alimtalk-campaign"
        initialAuthState={auth}
        initialCampaignDetail={{
          campaignId: resolvedParams.campaignId,
          campaignChannel: "kakao",
          from: from === "logs" ? "logs" : null,
        }}
      />
    );
  }

  try {
    const initialShellData = await fetchServerCampaignsShellData("kakao");
    return (
      <AppShell
        initialPage="alimtalk-campaign"
        initialAuthState={auth}
        initialShellData={initialShellData}
        initialCampaignDetail={{
          campaignId: resolvedParams.campaignId,
          campaignChannel: "kakao",
          from: from === "logs" ? "logs" : null,
        }}
      />
    );
  } catch {
    return (
      <AppShell
        initialPage="alimtalk-campaign"
        initialAuthState={auth}
        initialCampaignDetail={{
          campaignId: resolvedParams.campaignId,
          campaignChannel: "kakao",
          from: from === "logs" ? "logs" : null,
        }}
      />
    );
  }
}
