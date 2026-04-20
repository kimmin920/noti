import { AppShell } from "@/components/shell/AppShell";
import { fetchServerAuthSnapshot, fetchServerCampaignsShellData } from "@/lib/server/api";

export default async function SmsCampaignRoutePage() {
  const auth = await fetchServerAuthSnapshot();

  if (auth.status !== "authenticated") {
    return <AppShell initialPage="sms-campaign" initialAuthState={auth} />;
  }

  try {
    const initialShellData = await fetchServerCampaignsShellData("sms");
    return <AppShell initialPage="sms-campaign" initialAuthState={auth} initialShellData={initialShellData} />;
  } catch {
    return <AppShell initialPage="sms-campaign" initialAuthState={auth} />;
  }
}
