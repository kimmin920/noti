"use client";

import type { ReactNode } from "react";
import { AuthSessionContext } from "@/lib/auth-session-context";
import type { AuthSessionSnapshot } from "@/lib/auth-types";
import { useManagedAuthSession } from "@/lib/hooks/use-auth-session";

type AuthSessionProviderProps = {
  initialSnapshot?: AuthSessionSnapshot;
  children: ReactNode;
};

export function AuthSessionProvider({ initialSnapshot, children }: AuthSessionProviderProps) {
  const auth = useManagedAuthSession(initialSnapshot);

  return <AuthSessionContext.Provider value={auth}>{children}</AuthSessionContext.Provider>;
}
