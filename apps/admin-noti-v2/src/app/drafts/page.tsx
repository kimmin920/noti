import { AppShell } from "@/components/shell/AppShell";
import { fetchServerAuthSnapshot } from "@/lib/server/api";

export default async function DraftsRoutePage() {
  const auth = await fetchServerAuthSnapshot();
  return <AppShell initialPage="drafts" initialAuthState={auth} />;
}
