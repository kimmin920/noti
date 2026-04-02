const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const LOCAL_PASSWORD_LOGIN_ENABLED =
  process.env.NEXT_PUBLIC_LOCAL_PASSWORD_LOGIN_ENABLED === "true" ||
  (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_LOCAL_PASSWORD_LOGIN_ENABLED !== "false");

export type AuthMeResponse = {
  tenantId: string;
  userId: string;
  providerUserId: string;
  email: string | null;
  loginProvider: "GOOGLE_OAUTH" | "PUBL_SSO" | "LOCAL_PASSWORD";
  role: "TENANT_ADMIN" | "PARTNER_ADMIN" | "SUPER_ADMIN";
  accessOrigin: "DIRECT" | "PUBL";
  partnerScope: "DIRECT" | "PUBL" | null;
};

type ErrorPayload = {
  message?: string | string[];
};

async function readErrorMessage(response: Response) {
  let message = `${response.status} ${response.statusText}`;

  try {
    const data = (await response.json()) as ErrorPayload;
    if (Array.isArray(data.message)) {
      message = data.message.join(", ");
    } else if (typeof data.message === "string") {
      message = data.message;
    }
  } catch {
    // Ignore json parsing failures and keep the default status text.
  }

  return message;
}

export async function fetchAuthMe() {
  const response = await fetch(`${API_BASE_URL}/v1/auth/me`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.json() as Promise<AuthMeResponse>;
}

export async function loginWithPassword(payload: { loginId: string; password: string }) {
  const response = await fetch(`${API_BASE_URL}/v1/auth/password/login`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}

export async function logout() {
  const response = await fetch(`${API_BASE_URL}/v1/auth/logout`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}

export function isLocalPasswordLoginEnabled() {
  return LOCAL_PASSWORD_LOGIN_ENABLED;
}

export function getGoogleLoginUrl(returnTo?: string) {
  const url = new URL(`${API_BASE_URL}/v1/auth/google/start`);
  if (returnTo) {
    url.searchParams.set("returnTo", returnTo);
  }
  return url.toString();
}
