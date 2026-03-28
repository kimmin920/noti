import { AppShell } from "@/components/shell/AppShell";
import { fetchServerAuthSnapshot, fetchServerDashboardShellData } from "@/lib/server/api";

export default async function DashboardRoutePage() {
  const auth = await fetchServerAuthSnapshot();

  if (auth.status !== "authenticated") {
    return <AppShell initialPage="dashboard" initialAuthState={auth} />;
  }

  try {
    const initialShellData = await fetchServerDashboardShellData();
    return <AppShell initialPage="dashboard" initialAuthState={auth} initialShellData={initialShellData} />;
  } catch {
    return <AppShell initialPage="dashboard" initialAuthState={auth} />;
  }
}
