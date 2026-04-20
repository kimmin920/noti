"use client";

import { useCallback, useState } from "react";
import { fetchAuthMe, type AuthMeResponse } from "@/lib/api/auth";
import type { AuthSessionSnapshot, AuthSessionStatus } from "@/lib/auth-types";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";

let authSessionCache: AuthMeResponse | null = null;
let authStatusCache: AuthSessionStatus = "loading";
let authErrorCache: string | null = null;

export function useAuthSession(initialSnapshot?: AuthSessionSnapshot) {
  if (initialSnapshot) {
    authSessionCache = initialSnapshot.session;
    authStatusCache = initialSnapshot.status;
    authErrorCache = initialSnapshot.error;
  }

  const [status, setStatus] = useState<AuthSessionStatus>(initialSnapshot?.status ?? authStatusCache);
  const [session, setSession] = useState<AuthMeResponse | null>(initialSnapshot?.session ?? authSessionCache);
  const [error, setError] = useState<string | null>(initialSnapshot?.error ?? authErrorCache);

  const refreshSession = useCallback(async (options?: { silent?: boolean }) => {
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
  }, []);

  useMountEffect(() => {
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
