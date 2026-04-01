import { AppShell } from "@/components/shell/AppShell";
import { fetchServerAuthSnapshot } from "@/lib/server/api";

export default async function RecipientsRoutePage() {
  const auth = await fetchServerAuthSnapshot();
  return <AppShell initialPage="recipients" initialAuthState={auth} />;
}
