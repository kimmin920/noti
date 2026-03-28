import type { Metadata } from "next";
import { NavigationProgressBar } from "@/components/loading/NavigationProgressBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "MessageOps Console",
  description: "MessageOps prototype migrated to Next.js",
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
