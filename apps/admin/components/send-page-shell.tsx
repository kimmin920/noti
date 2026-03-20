import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type SendPageStat = {
  label: string;
  value: string;
  hint: string;
};

type SendPageLink = {
  label: string;
  href: string;
  description: string;
};

interface SendPageShellProps {
  icon: LucideIcon;
  badge: string;
  title: string;
  description: string;
  stats: SendPageStat[];
  quickLinks: SendPageLink[];
  children: React.ReactNode;
}

export function SendPageShell({
  icon: Icon,
  badge,
  title,
  description,
  stats,
  quickLinks,
  children
}: SendPageShellProps) {
  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card/90 px-6 py-7 shadow-soft backdrop-blur md:px-8">
        <div className="absolute inset-y-0 right-0 w-80 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.18),transparent_58%)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground transition hover:border-primary/30 hover:text-primary"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Dashboard
            </Link>
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Icon className="h-3.5 w-3.5" />
                {badge}
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                  {description}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3 shadow-sm"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {stat.label}
                </div>
                <div className="mt-2 text-2xl font-bold tracking-tight">{stat.value}</div>
                <div className="mt-1 text-xs text-muted-foreground">{stat.hint}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">{children}</div>

        <aside className="space-y-6">
          <Card className="glass">
            <CardHeader>
              <CardTitle>작업 가이드</CardTitle>
              <CardDescription>발송 전 확인하면 실수를 줄일 수 있는 핵심 항목입니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="rounded-2xl border bg-background/80 px-4 py-3">
                수신 번호는 `01012345678` 형식으로 입력하세요.
              </div>
              <div className="rounded-2xl border bg-background/80 px-4 py-3">
                실패 원인은 우측 메뉴가 아니라 대시보드의 발송 로그에서 가장 빨리 확인됩니다.
              </div>
              <div className="rounded-2xl border bg-background/80 px-4 py-3">
                외부 승인 상태가 바뀐 직후라면 먼저 발신 정보와 템플릿을 새로고침하는 편이 안전합니다.
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle>바로가기</CardTitle>
              <CardDescription>발송과 함께 자주 움직이는 설정 화면입니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group flex items-start justify-between rounded-2xl border bg-background/85 px-4 py-3 transition hover:border-primary/30 hover:bg-primary/5"
                >
                  <div>
                    <div className="text-sm font-semibold text-foreground">{link.label}</div>
                    <div className="mt-1 text-xs leading-5 text-muted-foreground">{link.description}</div>
                  </div>
                  <ArrowUpRight className="mt-0.5 h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
                </Link>
              ))}
            </CardContent>
          </Card>
        </aside>
      </section>
    </div>
  );
}
