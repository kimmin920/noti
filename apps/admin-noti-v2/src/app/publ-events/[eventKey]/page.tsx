import { AppShell } from "@/components/shell/AppShell";
import { fetchServerAuthSnapshot } from "@/lib/server/api";

export default async function PublEventDetailPage() {
  const auth = await fetchServerAuthSnapshot();

  return <AppShell initialPage="publ-events" initialAuthState={auth} />;
}
