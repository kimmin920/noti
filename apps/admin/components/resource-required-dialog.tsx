'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ResourceRequiredDialogProps {
  open: boolean;
  icon: LucideIcon;
  badge: string;
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}

export function ResourceRequiredDialog({
  open,
  icon: Icon,
  badge,
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref = '/',
  secondaryLabel = '대시보드로 돌아가기'
}: ResourceRequiredDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/24 px-4 py-6 backdrop-blur-[3px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="resource-required-title"
      aria-describedby="resource-required-description"
    >
      <div className="w-full max-w-xl rounded-[28px] border border-border/80 bg-background shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
        <div className="space-y-6 px-6 py-6 md:px-8 md:py-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/45 px-3 py-1 text-xs font-medium text-muted-foreground">
                {badge}
              </div>
              <div className="space-y-2">
                <h2 id="resource-required-title" className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
                  {title}
                </h2>
                <p id="resource-required-description" className="text-sm leading-6 text-muted-foreground">
                  {description}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-muted/35 px-4 py-3 text-sm leading-6 text-muted-foreground">
            등록만 마치면 이 페이지로 돌아와서 바로 발송 준비를 이어갈 수 있습니다.
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link href={secondaryHref} className={cn(buttonVariants({ variant: 'outline' }), 'h-11 rounded-2xl px-5')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {secondaryLabel}
            </Link>
            <Link href={primaryHref} className={cn(buttonVariants(), 'h-11 rounded-2xl px-5')}>
              {primaryLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
