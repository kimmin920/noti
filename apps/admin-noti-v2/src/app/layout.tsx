import type { Metadata } from "next";
import { AuthSessionProvider } from "@/components/auth/AuthSessionProvider";
import { NavigationProgressBar } from "@/components/loading/NavigationProgressBar";
import type { AuthSessionSnapshot } from "@/lib/auth-types";
import { fetchServerAuthSnapshot } from "@/lib/server/api";
import "./globals.css";

export const metadata: Metadata = {
  title: "NOTI",
  description: "NOTI messaging admin console",
  icons: {
    icon: "/assets/noti-mark.svg",
    shortcut: "/assets/noti-mark.svg",
    apple: "/assets/noti-mark.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let initialAuthState: AuthSessionSnapshot;

  try {
    initialAuthState = await fetchServerAuthSnapshot();
  } catch (error) {
    initialAuthState = {
      status: "error",
      session: null,
      error: error instanceof Error ? error.message : "세션을 확인하지 못했습니다.",
    };
  }

  return (
    <html lang="ko">
      <body>
        <AuthSessionProvider initialSnapshot={initialAuthState}>
          <NavigationProgressBar />
          {children}
        </AuthSessionProvider>
      </body>
    </html>
  );
}
