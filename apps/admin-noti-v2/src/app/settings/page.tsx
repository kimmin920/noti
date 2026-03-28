import { AppShell } from "@/components/shell/AppShell";
import { fetchServerAuthSnapshot, fetchServerSettingsShellData } from "@/lib/server/api";

export default async function SettingsRoutePage() {
  const auth = await fetchServerAuthSnapshot();

  if (auth.status !== "authenticated") {
    return <AppShell initialPage="settings" initialAuthState={auth} />;
  }

  try {
    const initialShellData = await fetchServerSettingsShellData();
    return <AppShell initialPage="settings" initialAuthState={auth} initialShellData={initialShellData} />;
  } catch {
    return <AppShell initialPage="settings" initialAuthState={auth} />;
  }
}
