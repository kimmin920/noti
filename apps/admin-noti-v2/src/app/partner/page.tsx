import { AppShell } from "@/components/shell/AppShell";
import { fetchServerAuthSnapshot, fetchServerPartnerShellData } from "@/lib/server/api";

export default async function PartnerRoutePage() {
  const auth = await fetchServerAuthSnapshot();

  if (auth.status !== "authenticated") {
    return <AppShell initialPage="partner" initialAuthState={auth} />;
  }

  const session = auth.session;
  if (!session || session.role !== "PARTNER_ADMIN") {
    return <AppShell initialPage="partner" initialAuthState={auth} />;
  }

  try {
    const initialShellData = await fetchServerPartnerShellData();
    return <AppShell initialPage="partner" initialAuthState={auth} initialShellData={initialShellData} />;
  } catch {
    return <AppShell initialPage="partner" initialAuthState={auth} />;
  }
}
