"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppIcon } from "@/components/icons/AppIcon";
import { getGoogleLoginUrl } from "@/lib/api/auth";
import type { PageId } from "@/lib/store/types";

type AuthGateProps = {
  currentPage: PageId;
  sessionError?: string | null;
  onRetrySessionCheck?: () => void | Promise<void>;
};

export function AuthLoadingScreen({}: { currentPage: PageId }) {
  useLeavesOverlay();

  return (
    <main className="auth-shell" aria-labelledby="auth-loading-title">
      <LeavesOverlay />
      <section className="auth-panel auth-panel-compact">
        <div className="auth-brand">
          <span className="auth-brand-mark" aria-hidden="true" />
        </div>

        <div className="auth-card" aria-busy="true" aria-live="polite">
          <div className="auth-card-body">
            <div className="auth-status">
              <span className="auth-spinner" aria-hidden="true" />
              <span>세션 확인 중</span>
            </div>
            <h1 className="auth-title" id="auth-loading-title">
              로그인 상태를 확인하고 있습니다
            </h1>
          </div>
        </div>

        <div className="auth-legal-links" aria-label="서비스 문서">
          <Link href="/terms">이용약관</Link>
          <Link href="/privacy">개인정보처리방침</Link>
        </div>
      </section>
    </main>
  );
}

export function AuthGate({ currentPage, sessionError, onRetrySessionCheck }: AuthGateProps) {
  void currentPage;
  useLeavesOverlay();
  const [signingIn, setSigningIn] = useState(false);

  const handleGoogleSignIn = () => {
    if (typeof window === "undefined") {
      return;
    }
    if (signingIn) {
      return;
    }

    setSigningIn(true);
    window.location.assign(getGoogleLoginUrl(window.location.href));
  };

  return (
    <main className="auth-shell" aria-labelledby="auth-title">
      <LeavesOverlay />
      <section className="auth-panel">
        <div className="auth-brand">
          <span className="auth-brand-mark" aria-hidden="true" />
        </div>

        <div className="auth-card">
          <div className="auth-card-body">
            <h1 className="auth-title" id="auth-title">
              시작하기
            </h1>

            {sessionError ? (
              <section className="flash flash-attention auth-flash" aria-labelledby="auth-error-title" role="alert">
                <AppIcon name="warn" className="icon icon-16 flash-icon" />
                <div className="flash-body">
                  <strong id="auth-error-title">세션 확인에 실패했습니다</strong>
                  <div>{sessionError}</div>
                </div>
                {onRetrySessionCheck ? (
                  <div className="flash-actions">
                    <button type="button" className="btn btn-default btn-sm" onClick={() => void onRetrySessionCheck()}>
                      <AppIcon name="refresh" className="icon icon-14" />
                      다시 확인
                    </button>
                  </div>
                ) : null}
              </section>
            ) : null}

            <button
              type="button"
              className="btn btn-accent auth-google-button"
              aria-disabled={signingIn}
              onClick={handleGoogleSignIn}
            >
              {signingIn ? (
                <span className="auth-spinner auth-spinner-on-emphasis" aria-hidden="true" />
              ) : (
                <span className="auth-google-mark" aria-hidden="true">
                  G
                </span>
              )}
              {signingIn ? "Google로 이동 중..." : "Google로 계속하기"}
            </button>
            <span className="sr-only" aria-live="polite">
              {signingIn ? "Google 로그인 화면으로 이동 중입니다." : ""}
            </span>
          </div>
        </div>

        <p className="auth-legal-note">
          계속하면 <Link href="/terms">이용약관</Link> 및 <Link href="/privacy">개인정보처리방침</Link>에 동의하게 됩니다.
        </p>
      </section>
    </main>
  );
}

function LeavesOverlay() {
  return <video id="leaves-overlay" src="/leaves.mp4" autoPlay loop muted playsInline preload="none" aria-hidden="true" />;
}

function useLeavesOverlay() {
  useEffect(() => {
    document.body.classList.add("leaves");

    return () => {
      document.body.classList.remove("leaves");
    };
  }, []);
}
