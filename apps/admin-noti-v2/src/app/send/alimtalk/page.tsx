import { AppShell } from "@/components/shell/AppShell";
import { fetchServerAuthSnapshot, fetchServerKakaoSendPageData } from "@/lib/server/api";

export default async function AlimtalkSendRoutePage() {
  const auth = await fetchServerAuthSnapshot();

  if (auth.status !== "authenticated") {
    return <AppShell initialPage="alimtalk-send" initialAuthState={auth} />;
  }

  try {
    const initialKakaoSendData = await fetchServerKakaoSendPageData();
    return <AppShell initialPage="alimtalk-send" initialAuthState={auth} initialKakaoSendData={initialKakaoSendData} />;
  } catch {
    return <AppShell initialPage="alimtalk-send" initialAuthState={auth} />;
  }
}
