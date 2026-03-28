import { AppShell } from "@/components/shell/AppShell";
import { fetchServerAuthSnapshot, fetchServerCampaignsShellData } from "@/lib/server/api";

export default async function CampaignRoutePage() {
  const auth = await fetchServerAuthSnapshot();

  if (auth.status !== "authenticated") {
    return <AppShell initialPage="campaign" initialAuthState={auth} />;
  }

  try {
    const initialShellData = await fetchServerCampaignsShellData();
    return <AppShell initialPage="campaign" initialAuthState={auth} initialShellData={initialShellData} />;
  } catch {
    return <AppShell initialPage="campaign" initialAuthState={auth} />;
  }
}
