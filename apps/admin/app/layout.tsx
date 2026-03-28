import type { Metadata } from 'next';
import { Bricolage_Grotesque, Chango, Noto_Sans_KR } from 'next/font/google';
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

const brand = Chango({
  subsets: ['latin'],
  variable: '--font-brand',
  weight: ['400']
});

export const metadata: Metadata = {
  title: 'NOTI',
  description: 'NOTI admin console'
};

import { DashboardLayout } from '../components/dashboard-layout';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='ko' className='antialiased'>
      <body className={`${display.variable} ${body.variable} ${brand.variable}`}>
        <DashboardLayout>
          {children}
        </DashboardLayout>
      </body>
    </html>
  );
}
