import { AppShell } from "@/components/shell/AppShell";
import { fetchServerAuthSnapshot } from "@/lib/server/api";

export default async function SenderNumberApplicationRoute() {
  const auth = await fetchServerAuthSnapshot();
  return <AppShell initialPage="sender-number-apply" initialAuthState={auth} />;
}
