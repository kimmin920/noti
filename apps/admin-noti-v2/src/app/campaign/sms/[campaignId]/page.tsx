import { AppShell } from "@/components/shell/AppShell";
import { fetchServerAuthSnapshot, fetchServerCampaignsShellData } from "@/lib/server/api";

type SmsCampaignDetailRoutePageProps = {
  params: Promise<{
    campaignId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SmsCampaignDetailRoutePage({
  params,
  searchParams,
}: SmsCampaignDetailRoutePageProps) {
  const auth = await fetchServerAuthSnapshot();
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const from = typeof resolvedSearchParams.from === "string" ? resolvedSearchParams.from : null;

  if (auth.status !== "authenticated") {
    return (
      <AppShell
        initialPage="sms-campaign"
        initialAuthState={auth}
        initialCampaignDetail={{
          campaignId: resolvedParams.campaignId,
          campaignChannel: "sms",
          from: from === "logs" ? "logs" : null,
        }}
      />
    );
  }

  try {
    const initialShellData = await fetchServerCampaignsShellData("sms");
    return (
      <AppShell
        initialPage="sms-campaign"
        initialAuthState={auth}
        initialShellData={initialShellData}
        initialCampaignDetail={{
          campaignId: resolvedParams.campaignId,
          campaignChannel: "sms",
          from: from === "logs" ? "logs" : null,
        }}
      />
    );
  } catch {
    return (
      <AppShell
        initialPage="sms-campaign"
        initialAuthState={auth}
        initialCampaignDetail={{
          campaignId: resolvedParams.campaignId,
          campaignChannel: "sms",
          from: from === "logs" ? "logs" : null,
        }}
      />
    );
  }
}
