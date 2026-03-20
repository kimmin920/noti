'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, type Transition } from 'framer-motion';
import { CalendarDays, Check, Clock3, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const spring = {
  type: 'spring',
  stiffness: 420,
  damping: 32,
  mass: 0.9
} as const;

const easeStandard: [number, number, number, number] = [0.22, 1, 0.36, 1];
const easeExit: [number, number, number, number] = [0.4, 0, 1, 1];

const overlayContentVariants = {
  closed: {
    y: 4,
    opacity: 0,
    scale: 0.985,
    transition: {
      duration: 0.12,
      ease: easeExit
    }
  },
  open: {
    y: 0,
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.26,
      ease: easeStandard
    }
  }
} as const;

type InlineSendSchedulerTone = 'sms' | 'alimtalk';

interface InlineSendSchedulerProps {
  tone: InlineSendSchedulerTone;
  primaryLabel: string;
  scheduledPrimaryLabel: string;
  loadingLabel: string;
  loading?: boolean;
  onPrimaryAction: () => Promise<void> | void;
  onScheduledAction?: (scheduledAt: string) => Promise<void> | void;
  className?: string;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function getDefaultDate() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function getDefaultTime() {
  const now = new Date();
  const rounded = new Date(now);
  const minuteBucket = Math.ceil(now.getMinutes() / 15) * 15;
  rounded.setMinutes(minuteBucket % 60, 0, 0);
  if (minuteBucket >= 60) {
    rounded.setHours(rounded.getHours() + 1);
  }
  return `${pad(rounded.getHours())}:${pad(rounded.getMinutes())}`;
}

function formatSchedule(date: string, time: string) {
  if (!date || !time) {
    return '';
  }

  const dt = new Date(`${date}T${time}`);
  if (Number.isNaN(dt.getTime())) {
    return `${date} ${time}`;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour12: true,
    hour: 'numeric',
    minute: '2-digit'
  }).format(dt);
}

function toScheduledDate(date: string, time: string) {
  if (!date || !time) {
    return null;
  }

  const dt = new Date(`${date}T${time}`);
  if (Number.isNaN(dt.getTime())) {
    return null;
  }

  return dt;
}

export function InlineSendScheduler({
  tone,
  primaryLabel,
  scheduledPrimaryLabel,
  loadingLabel,
  loading,
  onPrimaryAction,
  onScheduledAction,
  className
}: InlineSendSchedulerProps) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [scheduled, setScheduled] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [date, setDate] = useState(getDefaultDate());
  const [time, setTime] = useState(getDefaultTime());
  const schedulerContentRef = useRef<HTMLDivElement | null>(null);
  const collapsedHeight = 64;
  const [expandedHeight, setExpandedHeight] = useState(collapsedHeight);
  const overlayActive = open || closing;
  const schedulingEnabled = typeof onScheduledAction === 'function';

  const scheduleLabel = useMemo(() => formatSchedule(date, time), [date, time]);
  const scheduledDate = useMemo(() => toScheduledDate(date, time), [date, time]);
  const isScheduleInFuture = scheduledDate ? scheduledDate.getTime() > Date.now() : false;
  const scheduleActionLabel = scheduleLabel
    ? `${scheduleLabel}에 예약 전송하기`
    : '선택한 시각으로 예약 전송하기';
  const shellTransition: Transition = open
    ? spring
    : {
        duration: 0.16,
        ease: [0.4, 0, 1, 1] as [number, number, number, number]
      };
  const theme =
    tone === 'sms'
      ? {
          active: 'border-primary/20 bg-primary/5 text-primary',
          idle: 'border-border bg-muted/60 text-muted-foreground hover:border-primary/20 hover:bg-primary/5 hover:text-primary',
          panelBorder: 'border-primary/10',
          panelShadow: 'shadow-[0_8px_24px_rgba(37,99,235,0.10)]',
          overlayShadow: 'shadow-[0_18px_40px_rgba(15,23,42,0.12)]',
          focus: 'focus-within:border-primary/30',
          success: 'border-emerald-200 bg-emerald-50 text-emerald-700'
        }
      : {
          active: 'border-amber-200 bg-amber-50 text-amber-700',
          idle: 'border-border bg-muted/60 text-muted-foreground hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700',
          panelBorder: 'border-amber-100',
          panelShadow: 'shadow-[0_8px_24px_rgba(245,158,11,0.10)]',
          overlayShadow: 'shadow-[0_18px_40px_rgba(15,23,42,0.12)]',
          focus: 'focus-within:border-amber-300',
          success: 'border-emerald-200 bg-emerald-50 text-emerald-700'
        };

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timer = window.setTimeout(() => setToastMessage(''), 2200);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    const node = schedulerContentRef.current;
    if (!open || !node) {
      return;
    }

    const updateHeight = () => {
      setExpandedHeight(Math.max(collapsedHeight, node.scrollHeight + 16));
    };

    updateHeight();

    const observer = new ResizeObserver(() => updateHeight());
    observer.observe(node);

    return () => observer.disconnect();
  }, [collapsedHeight, date, open, time]);

  function openScheduler() {
    setClosing(false);
    setOpen(true);
  }

  function closeScheduler() {
    if (!open) {
      return;
    }

    setClosing(true);
    setOpen(false);
  }

  async function handleSchedule() {
    if (!scheduledDate || !isScheduleInFuture) {
      setToastMessage('예약 시각은 현재 이후로 선택해 주세요');
      return;
    }

    if (schedulingEnabled && onScheduledAction) {
      try {
        await onScheduledAction(scheduledDate.toISOString());
        setScheduled(false);
        closeScheduler();
        setToastMessage('예약 요청을 접수했습니다');
      } catch {
        // Parent handles the error surface.
      }
      return;
    }

    setScheduled(true);
    closeScheduler();
    setToastMessage('예약 시각이 반영됐습니다');
  }

  async function handlePrimary() {
    if (scheduled) {
      setScheduled(false);
    }
    await onPrimaryAction();
  }

  return (
    <div className={cn('relative w-full', className)}>
      <motion.div
        animate={{ height: open ? expandedHeight : collapsedHeight }}
        transition={shellTransition}
        className={cn(
          'relative grid overflow-visible rounded-[24px] border bg-white shadow-[0_8px_28px_rgba(15,23,42,0.08)]',
          theme.panelBorder,
          theme.panelShadow
        )}
      >
        <motion.div
          layout
          animate={{
            opacity: open ? 0 : 1,
            scale: open ? 0.985 : 1,
            y: open ? 8 : 0,
            filter: open ? 'blur(2px)' : 'blur(0px)'
          }}
          transition={{
            opacity: { duration: open ? 0.18 : 0.12, ease: [0.22, 1, 0.36, 1] },
            scale: { duration: open ? 0.24 : 0.14, ease: [0.22, 1, 0.36, 1] },
            y: { duration: open ? 0.24 : 0.14, ease: [0.22, 1, 0.36, 1] },
            filter: { duration: open ? 0.18 : 0.12 }
          }}
          className={cn('col-start-1 row-start-1 flex items-center gap-3 p-2', open && 'pointer-events-none')}
        >
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => {
              if (open) {
                closeScheduler();
                return;
              }

              openScheduler();
            }}
            className={cn(
              'inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border transition',
              open ? theme.active : theme.idle
            )}
            aria-label={open ? 'Close scheduler' : 'Open scheduler'}
          >
            <motion.div
              animate={{ rotate: open ? -8 : 0, scale: open ? 1.05 : 1 }}
              transition={spring}
            >
              <CalendarDays className="h-5 w-5" />
            </motion.div>
          </motion.button>

          <motion.button
            layout
            transition={spring}
            type="button"
            whileTap={{ scale: 0.99 }}
            onClick={() => {
              void handlePrimary();
            }}
            disabled={loading}
            className="inline-flex h-12 flex-1 items-center justify-center rounded-[18px] bg-neutral-950 px-5 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(0,0,0,0.16)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? loadingLabel : scheduled && !schedulingEnabled ? scheduledPrimaryLabel : primaryLabel}
          </motion.button>
        </motion.div>

        <AnimatePresence
          initial={false}
          onExitComplete={() => {
            setClosing(false);
          }}
        >
          {open && (
            <motion.div
              key="scheduler"
              layout
              initial={{
                height: collapsedHeight,
                opacity: 0,
                y: 8,
                filter: 'blur(8px)'
              }}
              animate={{
                height: expandedHeight,
                opacity: 1,
                y: 0,
                filter: 'blur(0px)'
              }}
              exit={{
                height: collapsedHeight,
                opacity: 0,
                y: 4,
                filter: 'blur(6px)'
              }}
              transition={{
                height: { duration: 0.12, ease: easeExit },
                opacity: { duration: 0.1 },
                filter: { duration: 0.1 },
                y: { duration: 0.12, ease: easeExit }
              }}
              className={cn(
                'col-start-1 row-start-1 z-10 overflow-hidden rounded-[24px] bg-white/95 p-2 backdrop-blur-sm',
                closing && 'pointer-events-none',
                theme.overlayShadow
              )}
              style={{ originY: 0 }}
            >
              <motion.div
                ref={schedulerContentRef}
                initial="closed"
                animate="open"
                exit="closed"
                variants={overlayContentVariants}
                className="px-1 pb-1 pt-1"
              >
                <div className="rounded-[22px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] px-3 pb-3 pt-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.88)]">
                  <div className="flex items-center gap-2">
                    <label
                      className={cn(
                        'group relative flex h-11 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-700 transition',
                        theme.focus
                      )}
                    >
                      <CalendarDays className="h-4 w-4 shrink-0 text-neutral-400" />
                      <input
                        type="date"
                        value={date}
                        onChange={(event) => setDate(event.target.value)}
                        className="w-full min-w-0 bg-transparent outline-none [color-scheme:light]"
                      />
                    </label>

                    <label
                      className={cn(
                        'group relative flex h-11 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-700 transition',
                        theme.focus
                      )}
                    >
                      <Clock3 className="h-4 w-4 shrink-0 text-neutral-400" />
                      <input
                        type="time"
                        step="900"
                        value={time}
                        onChange={(event) => setTime(event.target.value)}
                        className="w-full min-w-0 bg-transparent outline-none [color-scheme:light]"
                      />
                    </label>

                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      onClick={closeScheduler}
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-neutral-500 transition hover:border-neutral-300 hover:text-neutral-700"
                      aria-label="Close scheduler"
                    >
                      <X className="h-4 w-4" />
                    </motion.button>
                  </div>

                  <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <motion.p
                      key={scheduleLabel}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.2 }}
                      className="text-sm text-neutral-500"
                    >
                      예약 시각 <span className="font-medium text-neutral-700">{scheduleLabel}</span>
                    </motion.p>

                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.99 }}
                      whileHover={{ y: -1 }}
                      onClick={() => {
                        void handleSchedule();
                      }}
                      disabled={loading || !isScheduleInFuture}
                      className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-neutral-950 px-5 py-3 text-center text-sm font-semibold leading-5 text-white shadow-[0_6px_16px_rgba(0,0,0,0.16)] disabled:cursor-not-allowed disabled:opacity-50 md:ml-auto"
                    >
                      {scheduleActionLabel}
                    </motion.button>
                  </div>

                  <div className="mt-3 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
                    {schedulingEnabled ? (
                      <>
                        예약 요청을 접수하면 <span className="font-semibold text-neutral-700">{scheduleLabel || '선택한 시각'}</span>에 큐에서 실제 발송됩니다.
                      </>
                    ) : (
                      <>
                        현재는 예약 선택 <span className="font-semibold text-neutral-700">UI만 적용</span>되고, 실제 예약 발송 로직은 아직 연결되지 않았습니다.
                      </>
                    )}
                    {!isScheduleInFuture ? (
                      <span className="ml-1 text-rose-600">현재 이후 시각만 선택할 수 있습니다.</span>
                    ) : null}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {scheduled && !open && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22 }}
            className={cn('mt-3 flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm', theme.success)}
          >
            <Check className="h-4 w-4" />
            예약 전송 예정 <span className="font-semibold">{scheduleLabel}</span>
            <span className="text-xs opacity-80">(UI 전용)</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none absolute -top-14 right-0 rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 shadow-[0_12px_30px_rgba(0,0,0,0.12)]"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
