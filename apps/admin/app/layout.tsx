import type { Metadata } from 'next';
import { Bricolage_Grotesque, Noto_Sans_KR } from 'next/font/google';
import './globals.css';

const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '600', '700']
});

const body = Noto_Sans_KR({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '700']
});

export const metadata: Metadata = {
  title: 'publ-messaging admin',
  description: 'Publ messaging admin console'
};

import { DashboardLayout } from '../components/dashboard-layout';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='ko'>
      <body className={`${display.variable} ${body.variable}`}>
        <DashboardLayout>
          {children}
        </DashboardLayout>
      </body>
    </html>
  );
}
