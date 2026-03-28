import type { AuthMeResponse } from "@/lib/api/auth";

export type AuthSessionStatus = "loading" | "authenticated" | "unauthenticated" | "error";

export type AuthSessionSnapshot = {
  status: AuthSessionStatus;
  session: AuthMeResponse | null;
  error: string | null;
};
