import { AppShell } from "@/components/shell/AppShell";
import { fetchServerAuthSnapshot } from "@/lib/server/api";

export default async function MockSmsRoutePage() {
  const auth = await fetchServerAuthSnapshot();
  return <AppShell initialPage="sms-mock" initialAuthState={auth} />;
}
