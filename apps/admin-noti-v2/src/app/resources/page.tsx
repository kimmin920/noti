import { AppShell } from "@/components/shell/AppShell";
import { fetchServerAuthSnapshot, fetchServerResourcesShellData } from "@/lib/server/api";

export default async function ResourcesRoutePage() {
  const auth = await fetchServerAuthSnapshot();

  if (auth.status !== "authenticated") {
    return <AppShell initialPage="resources" initialAuthState={auth} />;
  }

  try {
    const initialShellData = await fetchServerResourcesShellData();
    return <AppShell initialPage="resources" initialAuthState={auth} initialShellData={initialShellData} />;
  } catch {
    return <AppShell initialPage="resources" initialAuthState={auth} />;
  }
}
