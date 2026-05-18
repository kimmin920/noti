import { AppShell } from "@/components/shell/AppShell";
import { fetchServerAuthSnapshot, fetchServerScheduledSendsShellData } from "@/lib/server/api";

export default async function ScheduledRoutePage() {
  const auth = await fetchServerAuthSnapshot();

  if (auth.status !== "authenticated") {
    return <AppShell initialPage="scheduled" initialAuthState={auth} />;
  }

  try {
    const initialShellData = await fetchServerScheduledSendsShellData();
    return <AppShell initialPage="scheduled" initialAuthState={auth} initialShellData={initialShellData} />;
  } catch {
    return <AppShell initialPage="scheduled" initialAuthState={auth} />;
  }
}
