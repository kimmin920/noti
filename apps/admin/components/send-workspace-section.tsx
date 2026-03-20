import Link from 'next/link';
import { MessageSquareText, Send, Smartphone } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SendWorkspaceSectionProps {
  approvedSenderNumberCount: number;
  readySenderProfileCount: number;
  approvedAlimtalkTemplateCount: number;
}

export function SendWorkspaceSection({
  approvedSenderNumberCount,
  readySenderProfileCount,
  approvedAlimtalkTemplateCount
}: SendWorkspaceSectionProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">발송 워크스페이스</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            직접 발송 도구를 채널별로 분리했습니다. 필요한 흐름만 바로 열어 작업하면 됩니다.
          </p>
        </div>
        <div className="hidden items-center gap-2 rounded-full border bg-background/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground md:flex">
          <Send className="h-3.5 w-3.5" />
          Messaging Tools
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="glass overflow-hidden">
          <CardHeader className="relative">
            <div className="absolute inset-y-0 right-0 w-36 bg-[radial-gradient(circle_at_top_right,rgba(22,163,74,0.18),transparent_60%)]" />
            <div className="relative">
              <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                <Smartphone className="h-5 w-5" />
              </div>
              <CardTitle>SMS 보내기</CardTitle>
              <CardDescription>승인된 발신번호로 즉시 문자를 보낼 수 있는 전용 페이지입니다.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border bg-background/80 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Approved</div>
                <div className="mt-2 text-2xl font-bold">{approvedSenderNumberCount}</div>
                <div className="mt-1 text-xs text-muted-foreground">즉시 사용 가능한 발신번호</div>
              </div>
              <div className="rounded-2xl border bg-background/80 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Flow</div>
                <div className="mt-2 text-2xl font-bold">1 Step</div>
                <div className="mt-1 text-xs text-muted-foreground">번호 선택 후 바로 전송</div>
              </div>
            </div>
            <Link
              href="/send/sms/single"
              className={cn(buttonVariants(), 'w-full shadow-lg shadow-emerald-500/20')}
            >
              SMS 발송 화면 열기
            </Link>
            <Link
              href="/send/sms/sender-numbers"
              className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}
            >
              SMS 발신번호 관리
            </Link>
          </CardContent>
        </Card>

        <Card className="glass overflow-hidden">
          <CardHeader className="relative">
            <div className="absolute inset-y-0 right-0 w-40 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.18),transparent_60%)]" />
            <div className="relative">
              <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600">
                <MessageSquareText className="h-5 w-5" />
              </div>
              <CardTitle>알림톡 보내기</CardTitle>
              <CardDescription>채널, 승인 템플릿, 변수 입력을 한 화면에서 처리하는 전용 페이지입니다.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border bg-background/80 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Channels</div>
                <div className="mt-2 text-2xl font-bold">{readySenderProfileCount}</div>
                <div className="mt-1 text-xs text-muted-foreground">바로 발송 가능한 카카오 채널</div>
              </div>
              <div className="rounded-2xl border bg-background/80 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Templates</div>
                <div className="mt-2 text-2xl font-bold">{approvedAlimtalkTemplateCount}</div>
                <div className="mt-1 text-xs text-muted-foreground">선택 가능한 승인 템플릿</div>
              </div>
            </div>
            <Link
              href="/send/alimtalk/single"
              className={cn(buttonVariants(), 'w-full shadow-lg shadow-blue-500/20')}
            >
              알림톡 발송 화면 열기
            </Link>
            <Link
              href="/send/alimtalk/bulk"
              className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}
            >
              대량 알림톡 화면 열기
            </Link>
            <Link
              href="/send/alimtalk/templates"
              className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}
            >
              알림톡 템플릿 열기
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
