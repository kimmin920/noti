import { AppShell } from "@/components/shell/AppShell";
import { fetchServerAuthSnapshot, fetchServerCampaignsShellData } from "@/lib/server/api";

export default async function BrandCampaignRoutePage() {
  const auth = await fetchServerAuthSnapshot();

  if (auth.status !== "authenticated") {
    return <AppShell initialPage="brand-campaign" initialAuthState={auth} />;
  }

  try {
    const initialShellData = await fetchServerCampaignsShellData("brand");
    return <AppShell initialPage="brand-campaign" initialAuthState={auth} initialShellData={initialShellData} />;
  } catch {
    return <AppShell initialPage="brand-campaign" initialAuthState={auth} />;
  }
}
