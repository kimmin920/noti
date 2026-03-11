'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    FileText,
    Zap,
    UserSquare2,
    Send,
    History,
    Settings,
    Bell
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
    { name: '대시보드', href: '/', icon: LayoutDashboard },
    { name: '템플릿', href: '#templates', icon: FileText },
    { name: '이벤트 규칙', href: '#event-rules', icon: Zap },
    { name: '발신 정보', href: '#senders', icon: UserSquare2 },
    { name: '직접 발송', href: '#direct-send', icon: Send },
    { name: '발송 로그', href: '#logs', icon: History },
];

export function NavSidebar() {
    const pathname = usePathname();

    return (
        <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card/50 backdrop-blur-xl transition-transform dark:bg-slate-900/50">
            <div className="flex h-full flex-col px-3 py-4">
                <div className="mb-10 flex items-center px-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20">
                        <Bell className="h-6 w-6 text-white" />
                    </div>
                    <span className="ml-3 text-xl font-bold tracking-tight">Publ Notify</span>
                </div>

                <nav className="flex-1 space-y-1">
                    {navItems.map((item) => (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-primary/10 hover:text-primary",
                                pathname === item.href ? "bg-primary/10 text-primary" : "text-muted-foreground"
                            )}
                        >
                            <item.icon className={cn(
                                "mr-3 h-5 w-5 transition-colors",
                                pathname === item.href ? "text-primary" : "group-hover:text-primary"
                            )} />
                            {item.name}
                        </Link>
                    ))}
                </nav>

                <div className="mt-auto border-t pt-4">
                    <button className="group flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100">
                        <Settings className="mr-3 h-5 w-5 transition-colors group-hover:text-slate-900 dark:group-hover:text-slate-100" />
                        설정
                    </button>
                </div>
            </div>
        </aside>
    );
}
