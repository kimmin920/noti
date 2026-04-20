"use client";

import { useCallback, useState } from "react";
import type { AuthSessionController } from "@/lib/auth-session-context";
import { useAuthSessionContext } from "@/lib/auth-session-context";
import { fetchAuthMe, type AuthMeResponse } from "@/lib/api/auth";
import type { AuthSessionSnapshot, AuthSessionStatus } from "@/lib/auth-types";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";

let authSessionCache: AuthMeResponse | null = null;
let authStatusCache: AuthSessionStatus = "loading";
let authErrorCache: string | null = null;

export function useManagedAuthSession(
  initialSnapshot?: AuthSessionSnapshot,
  options?: {
    disabled?: boolean;
  },
): AuthSessionController {
  const disabled = options?.disabled ?? false;

  if (!disabled && initialSnapshot) {
    authSessionCache = initialSnapshot.session;
    authStatusCache = initialSnapshot.status;
    authErrorCache = initialSnapshot.error;
  }

  const [status, setStatus] = useState<AuthSessionStatus>(
    disabled ? "loading" : (initialSnapshot?.status ?? authStatusCache),
  );
  const [session, setSession] = useState<AuthMeResponse | null>(
    disabled ? null : (initialSnapshot?.session ?? authSessionCache),
  );
  const [error, setError] = useState<string | null>(
    disabled ? null : (initialSnapshot?.error ?? authErrorCache),
  );

  const refreshSession = useCallback(async (options?: { silent?: boolean }) => {
    if (disabled) {
      return;
    }

    const silent = options?.silent ?? false;

    if (!silent) {
      setStatus("loading");
    }
    setError(null);
    authErrorCache = null;

    try {
      const me = await fetchAuthMe();

      if (!me) {
        authSessionCache = null;
        authStatusCache = "unauthenticated";
        setSession(null);
        setStatus("unauthenticated");
        return;
      }

      authSessionCache = me;
      authStatusCache = "authenticated";
      setSession(me);
      setStatus("authenticated");
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "세션을 확인하지 못했습니다.";

      authSessionCache = null;
      authStatusCache = "error";
      authErrorCache = message;
      setSession(null);
      setStatus("error");
      setError(message);
    }
  }, [disabled]);

  useMountEffect(() => {
    if (disabled) {
      return;
    }

    if (initialSnapshot?.status === "authenticated") {
      return;
    }

    if (initialSnapshot?.status === "unauthenticated" || initialSnapshot?.status === "error") {
      void refreshSession({ silent: true });
      return;
    }

    if (authStatusCache === "authenticated" || authStatusCache === "unauthenticated") {
      void refreshSession({ silent: true });
      return;
    }

    void refreshSession();
  });

  return {
    status,
    session,
    error,
    refreshSession,
  };
}

export function useAuthSession(initialSnapshot?: AuthSessionSnapshot): AuthSessionController {
  const context = useAuthSessionContext();
  const fallback = useManagedAuthSession(initialSnapshot, {
    disabled: Boolean(context),
  });

  return context ?? fallback;
}
