"use client";

import { type FormEvent, useMemo, useState } from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import { getGoogleLoginUrl, isLocalPasswordLoginEnabled, loginWithPassword } from "@/lib/api/auth";
import { getRouteByPageId } from "@/lib/routes";
import type { PageId } from "@/lib/store/types";

type AuthGateProps = {
  currentPage: PageId;
  sessionError?: string | null;
  onRetrySessionCheck?: () => void | Promise<void>;
  onSignedIn: () => void | Promise<void>;
};

export function AuthLoadingScreen({ currentPage }: { currentPage: PageId }) {
  const route = getRouteByPageId(currentPage);

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div className="auth-brand">
          <span className="logo-sq">MO</span>
          <div>
            <div className="auth-brand-title">MessageOps</div>
            <div className="auth-brand-subtitle">{route.title} 진입 전 세션을 확인하고 있습니다.</div>
          </div>
        </div>
        <div className="box auth-card">
          <div className="box-body auth-card-body">
            <div className="auth-status">
              <span className="auth-status-dot" />
              세션 확인 중
            </div>
            <div className="auth-copy-title">로그인 상태를 확인하고 있습니다.</div>
            <div className="auth-copy-desc">확인이 끝나면 요청한 페이지로 바로 이동합니다.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthGate({ currentPage, sessionError, onRetrySessionCheck, onSignedIn }: AuthGateProps) {
  const route = getRouteByPageId(currentPage);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const destinationLabel = useMemo(() => route.title, [route.title]);
  const localPasswordLoginEnabled = isLocalPasswordLoginEnabled();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!loginId.trim() || !password) {
      setSubmitError("로그인 ID와 비밀번호를 입력해 주세요.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      await loginWithPassword({
        loginId: loginId.trim(),
        password,
      });
      setPassword("");
      await onSignedIn();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "로그인에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = () => {
    if (typeof window === "undefined") {
      return;
    }

    window.location.href = getGoogleLoginUrl(window.location.href);
  };

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div className="auth-brand">
          <span className="logo-sq">MO</span>
          <div>
            <div className="auth-brand-title">MessageOps</div>
            <div className="auth-brand-subtitle">로그인 후 {destinationLabel} 페이지로 이어집니다.</div>
          </div>
        </div>

        <div className="box auth-card">
          <div className="box-header">
            <div>
              <div className="box-title">로그인이 필요합니다</div>
              <div className="box-subtitle">현재 요청한 화면: {destinationLabel}</div>
            </div>
            <span className="label label-gray">
              <span className="label-dot" />
              인증 필요
            </span>
          </div>
          <div className="box-body auth-card-body">
            {sessionError ? (
              <div className="flash flash-attention auth-flash">
                <AppIcon name="warn" className="icon icon-16 flash-icon" />
                <div className="flash-body">
                  <strong>세션 확인에 실패했습니다.</strong>
                  <div>{sessionError}</div>
                </div>
                {onRetrySessionCheck ? (
                  <div className="flash-actions">
                    <button type="button" className="btn btn-default btn-sm" onClick={() => void onRetrySessionCheck()}>
                      다시 확인
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="auth-copy">
              <div className="auth-copy-title">세션이 없으면 데이터를 불러오지 않습니다.</div>
              <div className="auth-copy-desc">
                로그인 후 현재 주소를 유지한 채 같은 화면에서 바로 작업을 이어갈 수 있습니다.
              </div>
            </div>

            <div className="auth-actions">
              <button type="button" className="btn btn-default" onClick={handleGoogleSignIn} disabled={submitting}>
                운영자 Google 로그인
              </button>
            </div>

            {localPasswordLoginEnabled ? (
              <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
                <div className="form-group">
                  <label className="form-label" htmlFor="auth-login-id">
                    로그인 ID
                  </label>
                  <input
                    id="auth-login-id"
                    className="form-control"
                    type="text"
                    name="loginId"
                    autoComplete="username"
                    value={loginId}
                    onChange={(event) => setLoginId(event.target.value)}
                    placeholder="admin@example.com"
                    disabled={submitting}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="auth-password">
                    비밀번호
                  </label>
                  <input
                    id="auth-password"
                    className="form-control"
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="비밀번호를 입력하세요"
                    disabled={submitting}
                  />
                </div>
                {submitError ? <div className="text-danger auth-submit-error">{submitError}</div> : null}
                <div className="auth-actions">
                  <button type="submit" className="btn btn-accent" disabled={submitting}>
                    <AppIcon name="lock" className="icon icon-14" />
                    {submitting ? "로그인 중..." : "개발용 비밀번호 로그인"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flash flash-neutral auth-flash">
                <div className="flash-body">
                  <strong>로컬 비밀번호 로그인은 비활성화되어 있습니다.</strong>
                  <div>운영 환경에서는 Google OAuth 또는 SSO 경로만 사용하는 것을 권장합니다.</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
