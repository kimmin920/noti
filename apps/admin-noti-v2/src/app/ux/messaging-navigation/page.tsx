import { AppShell } from "@/components/shell/AppShell";
import { MessagingNavigationComparePage } from "@/components/ux/MessagingNavigationComparePage";
import type { AuthSessionSnapshot } from "@/lib/auth-types";
import { fetchServerAuthSnapshot } from "@/lib/server/api";

export default async function MessagingNavigationCompareRoutePage() {
  let auth: AuthSessionSnapshot;

  try {
    auth = await fetchServerAuthSnapshot();
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      return (
        <main className="main ux-standalone-main">
          <div className="page active">
            <MessagingNavigationComparePage />
          </div>
        </main>
      );
    }

    auth = {
      status: "error",
      session: null,
      error: error instanceof Error ? error.message : "세션을 확인하지 못했습니다.",
    };
  }

  return <AppShell initialPage="messaging-nav-compare" initialAuthState={auth} />;
}
