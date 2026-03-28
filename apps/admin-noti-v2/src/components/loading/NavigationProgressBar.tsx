"use client";

import { useRef } from "react";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";
import { useAppStore } from "@/lib/store/app-store";

export function NavigationProgressBar() {
  const barRef = useRef<HTMLDivElement | null>(null);

  useMountEffect(() => {
    const bar = barRef.current;
    if (!bar) {
      return;
    }

    let lastPendingPage = useAppStore.getState().ui.navigationPendingPage;
    let progress = 0;
    let active = false;
    let trickleTimer: ReturnType<typeof setTimeout> | null = null;
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    const clearTimers = () => {
      if (trickleTimer) {
        clearTimeout(trickleTimer);
        trickleTimer = null;
      }
      if (fadeTimer) {
        clearTimeout(fadeTimer);
        fadeTimer = null;
      }
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
    };

    const setBar = (nextWidth: number, nextOpacity: number, withTransition = true) => {
      if (!withTransition) {
        bar.style.transition = "none";
      } else {
        bar.style.transition = "width 220ms ease-out, opacity 90ms ease-out";
      }

      bar.style.width = `${nextWidth}%`;
      bar.style.opacity = `${nextOpacity}`;

      if (!withTransition) {
        void bar.offsetWidth;
        bar.style.transition = "width 220ms ease-out, opacity 90ms ease-out";
      }
    };

    const nextIncrement = (current: number) => {
      if (current < 25) return 8 + Math.random() * 7;
      if (current < 55) return 4 + Math.random() * 5;
      if (current < 80) return 1.5 + Math.random() * 2.5;
      if (current < 90) return 0.4 + Math.random() * 0.9;
      return 0;
    };

    const scheduleTrickle = () => {
      trickleTimer = setTimeout(() => {
        if (!active) {
          return;
        }

        progress = Math.min(progress + nextIncrement(progress), 90);
        setBar(progress, 1);

        if (progress < 90) {
          scheduleTrickle();
        }
      }, 180 + Math.random() * 140);
    };

    const resetBar = () => {
      active = false;
      progress = 0;
      setBar(0, 0, false);
    };

    const start = () => {
      clearTimers();
      active = true;
      progress = 0;
      setBar(0, 0, false);

      requestAnimationFrame(() => {
        progress = 10 + Math.random() * 3;
        setBar(progress, 1);
        scheduleTrickle();
      });
    };

    const complete = () => {
      if (!active) {
        resetBar();
        return;
      }

      clearTimers();
      active = false;
      progress = 100;
      setBar(100, 1);

      fadeTimer = setTimeout(() => {
        setBar(100, 0);
        hideTimer = setTimeout(() => {
          resetBar();
        }, 110);
      }, 35);
    };

    resetBar();

    if (lastPendingPage) {
      start();
    }

    const unsubscribe = useAppStore.subscribe((state) => {
      const nextPendingPage = state.ui.navigationPendingPage;
      if (nextPendingPage === lastPendingPage) {
        return;
      }

      lastPendingPage = nextPendingPage;

      if (nextPendingPage) {
        start();
        return;
      }

      complete();
    });

    return () => {
      clearTimers();
      unsubscribe();
    };
  });

  return <div ref={barRef} className="navigation-progress-bar" aria-hidden="true" />;
}
