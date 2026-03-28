import { AppShell } from "@/components/shell/AppShell";
import { fetchServerAuthSnapshot, fetchServerLogsShellData } from "@/lib/server/api";

export default async function LogsRoutePage() {
  const auth = await fetchServerAuthSnapshot();

  if (auth.status !== "authenticated") {
    return <AppShell initialPage="logs" initialAuthState={auth} />;
  }

  try {
    const initialShellData = await fetchServerLogsShellData();
    return <AppShell initialPage="logs" initialAuthState={auth} initialShellData={initialShellData} />;
  } catch {
    return <AppShell initialPage="logs" initialAuthState={auth} />;
  }
}
