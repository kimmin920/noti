import type { Metadata } from "next";
import { NavigationProgressBar } from "@/components/loading/NavigationProgressBar";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <NavigationProgressBar />
        {children}
      </body>
    </html>
  );
}
