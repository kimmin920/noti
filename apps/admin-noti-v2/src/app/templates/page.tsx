import { AppShell } from "@/components/shell/AppShell";
import { fetchServerAuthSnapshot, fetchServerTemplatesShellData } from "@/lib/server/api";

export default async function TemplatesRoutePage() {
  const auth = await fetchServerAuthSnapshot();

  if (auth.status !== "authenticated") {
    return <AppShell initialPage="templates" initialAuthState={auth} />;
  }

  try {
    const initialShellData = await fetchServerTemplatesShellData();
    return <AppShell initialPage="templates" initialAuthState={auth} initialShellData={initialShellData} />;
  } catch {
    return <AppShell initialPage="templates" initialAuthState={auth} />;
  }
}
