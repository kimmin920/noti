import { AppShell } from "@/components/shell/AppShell";
import { fetchServerAuthSnapshot, fetchServerKakaoSendPageData } from "@/lib/server/api";

export default async function BrandSendRoutePage() {
  const auth = await fetchServerAuthSnapshot();

  if (auth.status !== "authenticated") {
    return <AppShell initialPage="brand-send" initialAuthState={auth} />;
  }

  try {
    const initialKakaoSendData = await fetchServerKakaoSendPageData();
    return <AppShell initialPage="brand-send" initialAuthState={auth} initialKakaoSendData={initialKakaoSendData} />;
  } catch {
    return <AppShell initialPage="brand-send" initialAuthState={auth} />;
  }
}
