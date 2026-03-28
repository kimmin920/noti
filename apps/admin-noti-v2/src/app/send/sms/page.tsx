import { AppShell } from "@/components/shell/AppShell";
import { fetchServerAuthSnapshot, fetchServerSmsSendPageData } from "@/lib/server/api";

export default async function SmsSendRoutePage() {
  const auth = await fetchServerAuthSnapshot();

  if (auth.status !== "authenticated") {
    return <AppShell initialPage="sms-send" initialAuthState={auth} />;
  }

  try {
    const initialSmsSendData = await fetchServerSmsSendPageData();
    return <AppShell initialPage="sms-send" initialAuthState={auth} initialSmsSendData={initialSmsSendData} />;
  } catch {
    return <AppShell initialPage="sms-send" initialAuthState={auth} />;
  }
}
