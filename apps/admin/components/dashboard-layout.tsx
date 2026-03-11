'use client';

import { NavSidebar } from './nav-sidebar';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-background text-foreground">
            <NavSidebar />
            <main className="pl-64">
                <div className="container mx-auto max-w-7xl p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
