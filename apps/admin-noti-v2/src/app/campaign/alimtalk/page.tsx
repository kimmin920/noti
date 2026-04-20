import { AppShell } from "@/components/shell/AppShell";
import { fetchServerAuthSnapshot, fetchServerCampaignsShellData } from "@/lib/server/api";

export default async function AlimtalkCampaignRoutePage() {
  const auth = await fetchServerAuthSnapshot();

  if (auth.status !== "authenticated") {
    return <AppShell initialPage="alimtalk-campaign" initialAuthState={auth} />;
  }

  try {
    const initialShellData = await fetchServerCampaignsShellData("kakao");
    return <AppShell initialPage="alimtalk-campaign" initialAuthState={auth} initialShellData={initialShellData} />;
  } catch {
    return <AppShell initialPage="alimtalk-campaign" initialAuthState={auth} />;
  }
}
