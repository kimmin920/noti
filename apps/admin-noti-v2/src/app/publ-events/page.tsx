import { AppShell } from "@/components/shell/AppShell";
import { fetchServerAuthSnapshot } from "@/lib/server/api";

export default async function PublEventsRoutePage() {
  const auth = await fetchServerAuthSnapshot();

  return <AppShell initialPage="publ-events" initialAuthState={auth} />;
}
