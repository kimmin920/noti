"use client";

import { createContext, useContext } from "react";
import type { AuthMeResponse } from "@/lib/api/auth";
import type { AuthSessionSnapshot, AuthSessionStatus } from "@/lib/auth-types";

export type AuthSessionController = {
  status: AuthSessionStatus;
  session: AuthMeResponse | null;
  error: string | null;
  refreshSession: (options?: { silent?: boolean }) => Promise<void>;
};

export const AuthSessionContext = createContext<AuthSessionController | null>(null);

export function useAuthSessionContext() {
  return useContext(AuthSessionContext);
}
