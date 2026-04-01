import { AppShell } from "@/components/shell/AppShell";
import { fetchServerAuthSnapshot } from "@/lib/server/api";

export default async function OpsRoutePage() {
  const auth = await fetchServerAuthSnapshot();
  return <AppShell initialPage="ops" initialAuthState={auth} />;
}
