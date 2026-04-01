import { AppShell } from "@/components/shell/AppShell";
import { fetchServerAuthSnapshot, fetchServerEventsShellData } from "@/lib/server/api";

export default async function EventsRoutePage() {
  const auth = await fetchServerAuthSnapshot();

  if (auth.status !== "authenticated") {
    return <AppShell initialPage="events" initialAuthState={auth} />;
  }

  const session = auth.session;

  if (!session || session.role !== "PARTNER_ADMIN") {
    return <AppShell initialPage="events" initialAuthState={auth} />;
  }

  try {
    const initialShellData = await fetchServerEventsShellData();
    return <AppShell initialPage="events" initialAuthState={auth} initialShellData={initialShellData} />;
  } catch {
    return <AppShell initialPage="events" initialAuthState={auth} />;
  }
}
