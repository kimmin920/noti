'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    FileText,
    FileBadge2,
    Zap,
    History,
    Smartphone,
    MessageSquareText,
    ChevronDown,
    SendHorizontal,
    Users,
    UserPlus,
    DatabaseZap,
    FlaskConical,
    Cable
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
    { name: '대시보드', href: '/', icon: LayoutDashboard },
    { name: '발송 로그', href: '/#logs', icon: History },
];

const eventMenuItems = [
    { name: '이벤트 만들기', href: '/events/create', icon: Cable },
    { name: '이벤트 테스트', href: '/events/test', icon: FlaskConical }
];

const alimtalkMenuItems = [
    { name: '알림톡 보내기', href: '/send/alimtalk/single', icon: MessageSquareText },
    { name: '대량 알림톡 보내기', href: '/send/alimtalk/bulk', icon: Users },
    { name: '알림톡 템플릿', href: '/send/alimtalk/templates', icon: FileText },
    { name: '카카오 채널 (발신프로필)', href: '/send/alimtalk/channels', icon: FileBadge2 }
];

const smsMenuItems = [
    { name: 'SMS 보내기', href: '/send/sms/single', icon: SendHorizontal },
    { name: '대량메세지 보내기', href: '/send/sms/bulk', icon: Users },
    { name: '템플릿 관리', href: '/send/sms/templates', icon: FileText },
    { name: 'SMS 발신번호 관리', href: '/send/sms/sender-numbers', icon: FileBadge2 }
];

const userMenuItems = [
    { name: '유저 목록', href: '/users', icon: Users },
    { name: '유저 추가하기', href: '/users/create', icon: UserPlus },
    { name: '유저 불러오기', href: '/users/import', icon: DatabaseZap }
];

const usagePlan = {
    title: 'Premium Trial',
    expiresLabel: '이 테스트 플랜은 2026년 9월 8일에 만료됩니다.',
    used: 500,
    limit: 1000
};

export function NavSidebar() {
    const pathname = usePathname();
    const [hash, setHash] = useState('');
    const [alimtalkExpanded, setAlimtalkExpanded] = useState(false);
    const [smsExpanded, setSmsExpanded] = useState(false);
    const [userExpanded, setUserExpanded] = useState(false);
    const [eventExpanded, setEventExpanded] = useState(false);

    useEffect(() => {
        const syncHash = () => setHash(window.location.hash);
        syncHash();
        window.addEventListener('hashchange', syncHash);
        return () => window.removeEventListener('hashchange', syncHash);
    }, [pathname]);

    useEffect(() => {
        if (alimtalkMenuItems.some((item) => isActive(item.href))) {
            setAlimtalkExpanded(true);
        }
        if (smsMenuItems.some((item) => isActive(item.href))) {
            setSmsExpanded(true);
        }
        if (userMenuItems.some((item) => isActive(item.href))) {
            setUserExpanded(true);
        }
        if (eventMenuItems.some((item) => isActive(item.href))) {
            setEventExpanded(true);
        }
    }, [hash, pathname]);

    function isActive(href: string) {
        const [targetPath, targetHash] = href.split('#');
        const normalizedPath = targetPath || '/';

        if (targetHash) {
            return pathname === normalizedPath && hash === `#${targetHash}`;
        }

        if (href === '/') {
            return pathname === '/' && !hash;
        }

        if (pathname === href || pathname.startsWith(`${href}/`)) {
            return true;
        }

        return pathname === href;
    }

    const alimtalkGroupActive = alimtalkMenuItems.some((item) => isActive(item.href));
    const smsGroupActive = smsMenuItems.some((item) => isActive(item.href));
    const userGroupActive = userMenuItems.some((item) => isActive(item.href));
    const eventGroupActive = eventMenuItems.some((item) => isActive(item.href));
    const usageRatio = Math.max(0, Math.min(100, (usagePlan.used / usagePlan.limit) * 100));

    return (
        <aside className="fixed left-0 top-0 z-40 h-screen w-64 overflow-x-hidden overflow-y-auto border-r bg-card/50 backdrop-blur-xl transition-transform dark:bg-slate-900/50">
            <div className="flex min-h-full flex-col px-3 py-4">
                <div className="mb-8 px-1">
                    <div className="relative mx-auto aspect-[237/145] w-full max-w-[196px]">
                        <Image
                            src="/labelBackground.svg"
                            alt=""
                            fill
                            priority
                            sizes="196px"
                            className="object-contain [transform:rotate(347deg)]"
                        />
                        <div className="absolute inset-0 flex items-center justify-center px-5 py-4">
                            <div className="relative h-10 w-[8.25rem] shrink-0">
                                <Image
                                    src="/noti-wordmark.svg"
                                    alt="NOTI wordmark"
                                    fill
                                    priority
                                    sizes="132px"
                                    className="object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.24)]"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 space-y-1">
                    {navItems.map((item) => (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-primary/10 hover:text-primary",
                                isActive(item.href) ? "bg-primary/10 text-primary" : "text-muted-foreground"
                            )}
                        >
                            <item.icon className={cn(
                                "mr-3 h-5 w-5 transition-colors",
                                isActive(item.href) ? "text-primary" : "group-hover:text-primary"
                            )} />
                            {item.name}
                        </Link>
                    ))}

                    <div className="pt-2">
                        <button
                            type="button"
                            onClick={() => setEventExpanded((current) => !current)}
                            className={cn(
                                "group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-primary/10 hover:text-primary",
                                eventGroupActive ? "bg-primary/10 text-primary" : "text-muted-foreground"
                            )}
                        >
                            <span className="flex items-center">
                                <Zap
                                    className={cn(
                                        "mr-3 h-5 w-5 transition-colors",
                                        eventGroupActive ? "text-primary" : "group-hover:text-primary"
                                    )}
                                />
                                이벤트(API)
                            </span>
                            <ChevronDown
                                className={cn(
                                    "h-4 w-4 transition-transform duration-200",
                                    eventExpanded ? "rotate-180" : "rotate-0"
                                )}
                            />
                        </button>

                        {eventExpanded && (
                            <div className="mt-1 space-y-1 pl-4">
                                {eventMenuItems.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            "group flex items-center rounded-xl px-3 py-2 text-sm transition-all duration-200 hover:bg-primary/10 hover:text-primary",
                                            isActive(item.href) ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground"
                                        )}
                                    >
                                        <item.icon
                                            className={cn(
                                                "mr-3 h-4 w-4 transition-colors",
                                                isActive(item.href) ? "text-primary" : "group-hover:text-primary"
                                            )}
                                        />
                                        {item.name}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="pt-2">
                        <button
                            type="button"
                            onClick={() => setAlimtalkExpanded((current) => !current)}
                            className={cn(
                                "group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-primary/10 hover:text-primary",
                                alimtalkGroupActive ? "bg-primary/10 text-primary" : "text-muted-foreground"
                            )}
                        >
                            <span className="flex items-center">
                                <MessageSquareText
                                    className={cn(
                                        "mr-3 h-5 w-5 transition-colors",
                                        alimtalkGroupActive ? "text-primary" : "group-hover:text-primary"
                                    )}
                                />
                                카카오 메세지
                            </span>
                            <ChevronDown
                                className={cn(
                                    "h-4 w-4 transition-transform duration-200",
                                    alimtalkExpanded ? "rotate-180" : "rotate-0"
                                )}
                            />
                        </button>

                        {alimtalkExpanded && (
                            <div className="mt-1 space-y-1 pl-4">
                                {alimtalkMenuItems.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            "group flex items-center rounded-xl px-3 py-2 text-sm transition-all duration-200 hover:bg-primary/10 hover:text-primary",
                                            isActive(item.href) ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground"
                                        )}
                                    >
                                        <item.icon
                                            className={cn(
                                                "mr-3 h-4 w-4 transition-colors",
                                                isActive(item.href) ? "text-primary" : "group-hover:text-primary"
                                            )}
                                        />
                                        {item.name}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="pt-2">
                        <button
                            type="button"
                            onClick={() => setSmsExpanded((current) => !current)}
                            className={cn(
                                "group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-primary/10 hover:text-primary",
                                smsGroupActive ? "bg-primary/10 text-primary" : "text-muted-foreground"
                            )}
                        >
                            <span className="flex items-center">
                                <Smartphone
                                    className={cn(
                                        "mr-3 h-5 w-5 transition-colors",
                                        smsGroupActive ? "text-primary" : "group-hover:text-primary"
                                    )}
                                />
                                SMS
                            </span>
                            <ChevronDown
                                className={cn(
                                    "h-4 w-4 transition-transform duration-200",
                                    smsExpanded ? "rotate-180" : "rotate-0"
                                )}
                            />
                        </button>

                        {smsExpanded && (
                            <div className="mt-1 space-y-1 pl-4">
                                {smsMenuItems.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            "group flex items-center rounded-xl px-3 py-2 text-sm transition-all duration-200 hover:bg-primary/10 hover:text-primary",
                                            isActive(item.href) ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground"
                                        )}
                                    >
                                        <item.icon
                                            className={cn(
                                                "mr-3 h-4 w-4 transition-colors",
                                                isActive(item.href) ? "text-primary" : "group-hover:text-primary"
                                            )}
                                        />
                                        {item.name}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="pt-2">
                        <button
                            type="button"
                            onClick={() => setUserExpanded((current) => !current)}
                            className={cn(
                                "group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-primary/10 hover:text-primary",
                                userGroupActive ? "bg-primary/10 text-primary" : "text-muted-foreground"
                            )}
                        >
                            <span className="flex items-center">
                                <Users
                                    className={cn(
                                        "mr-3 h-5 w-5 transition-colors",
                                        userGroupActive ? "text-primary" : "group-hover:text-primary"
                                    )}
                                />
                                유저
                            </span>
                            <ChevronDown
                                className={cn(
                                    "h-4 w-4 transition-transform duration-200",
                                    userExpanded ? "rotate-180" : "rotate-0"
                                )}
                            />
                        </button>

                        {userExpanded && (
                            <div className="mt-1 space-y-1 pl-4">
                                {userMenuItems.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            "group flex items-center rounded-xl px-3 py-2 text-sm transition-all duration-200 hover:bg-primary/10 hover:text-primary",
                                            isActive(item.href) ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground"
                                        )}
                                    >
                                        <item.icon
                                            className={cn(
                                                "mr-3 h-4 w-4 transition-colors",
                                                isActive(item.href) ? "text-primary" : "group-hover:text-primary"
                                            )}
                                        />
                                        {item.name}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </nav>

                <div className="mt-auto border-t border-border/70 pt-4">
                    <div className="rounded-[26px] border border-border/80 bg-white/85 px-4 py-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)] backdrop-blur dark:bg-slate-950/75 dark:shadow-[0_12px_30px_rgba(2,6,23,0.34)]">
                        <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground/90">
                            Usage
                        </div>
                        <div className="mt-3 text-[24px] font-medium leading-tight tracking-[-0.02em] text-foreground">
                            {usagePlan.title}
                        </div>
                        <p className="mt-2.5 text-[15px] leading-6 text-muted-foreground">
                            {usagePlan.expiresLabel}
                        </p>

                        <div className="mt-6 flex items-end justify-between gap-3">
                            <span className="text-[15px] font-medium text-muted-foreground">Usage</span>
                            <span className="text-[17px] font-medium tracking-[-0.02em] text-foreground">
                                {usagePlan.used}/{usagePlan.limit}
                            </span>
                        </div>

                        <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                            <div
                                className="h-full rounded-full bg-slate-950 transition-[width] duration-500 dark:bg-white"
                                style={{ width: `${usageRatio}%` }}
                            />
                        </div>

                        <Link
                            href="/#logs"
                            className={cn(
                                "mt-5 flex h-12 items-center justify-center rounded-2xl border border-border/80 bg-white text-sm font-medium text-foreground shadow-[0_6px_18px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800"
                            )}
                        >
                            사용량 현황 보기
                        </Link>
                    </div>
                </div>
            </div>
        </aside>
    );
}
