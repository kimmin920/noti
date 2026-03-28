'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NavSidebar } from './nav-sidebar';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStandaloneRoute = pathname === '/preview' || pathname.startsWith('/v2');

  if (isStandaloneRoute) {
    return <div className="min-h-screen bg-[#f6f8fa] text-foreground">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavSidebar />

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-border/80 bg-background/95 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">NOTI</div>
              <div className="text-sm font-semibold text-foreground">Admin Console</div>
            </div>
            <Link
              href="/preview"
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground"
            >
              V2 Preview
            </Link>
          </div>
        </header>

        <main>
          <div className="mx-auto w-full max-w-[1480px] px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
