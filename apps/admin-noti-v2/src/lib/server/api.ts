import { cookies } from "next/headers";
import type { AuthMeResponse } from "@/lib/api/auth";
import type {
  V2BootstrapResponse,
  V2CampaignsResponse,
  V2DashboardResponse,
  V2EventsResponse,
  V2KakaoSendOptionsResponse,
  V2KakaoSendReadinessResponse,
  V2SmsSendOptionsResponse,
  V2SmsSendReadinessResponse,
  V2LogsResponse,
  V2KakaoResourcesResponse,
  V2KakaoTemplatesResponse,
  V2OpsHealthResponse,
  V2ResourcesSummaryResponse,
  V2SmsResourcesResponse,
  V2SmsTemplatesResponse,
  V2TemplatesSummaryResponse,
} from "@/lib/api/v2";
import type { AuthSessionSnapshot } from "@/lib/auth-types";

const API_BASE_URL = (process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

async function serverApiFetch<T>(path: string): Promise<T> {
  const cookieStore = await cookies();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: {
      cookie: cookieStore.toString(),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;

    try {
      const data = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(data.message)) {
        message = data.message.join(", ");
      } else if (typeof data.message === "string") {
        message = data.message;
      }
    } catch {
      // keep status text
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export async function fetchServerAuthSnapshot(): Promise<AuthSessionSnapshot> {
  const cookieStore = await cookies();
  const response = await fetch(`${API_BASE_URL}/v1/auth/me`, {
    method: "GET",
    headers: {
      cookie: cookieStore.toString(),
    },
    cache: "no-store",
  });

  if (response.status === 401) {
    return {
      status: "unauthenticated",
      session: null,
      error: null,
    };
  }

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;

    try {
      const data = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(data.message)) {
        message = data.message.join(", ");
      } else if (typeof data.message === "string") {
        message = data.message;
      }
    } catch {
      // keep status text
    }

    return {
      status: "error",
      session: null,
      error: message,
    };
  }

  const session = (await response.json()) as AuthMeResponse;
  return {
    status: "authenticated",
    session,
    error: null,
  };
}

export async function fetchServerDashboardShellData() {
  const [bootstrap, dashboard] = await Promise.all([
    serverApiFetch<V2BootstrapResponse>("/v2/bootstrap"),
    serverApiFetch<V2DashboardResponse>("/v2/dashboard"),
  ]);

  return {
    bootstrap,
    dashboard,
  };
}

export async function fetchServerResourcesShellData() {
  const [bootstrap, summary, sms, kakao] = await Promise.all([
    serverApiFetch<V2BootstrapResponse>("/v2/bootstrap"),
    serverApiFetch<V2ResourcesSummaryResponse>("/v2/resources/summary"),
    serverApiFetch<V2SmsResourcesResponse>("/v2/resources/sms"),
    serverApiFetch<V2KakaoResourcesResponse>("/v2/resources/kakao"),
  ]);

  return {
    bootstrap,
    resources: {
      summary,
      sms,
      kakao,
    },
  };
}

export async function fetchServerTemplatesShellData() {
  const [bootstrap, summary, sms, kakao] = await Promise.all([
    serverApiFetch<V2BootstrapResponse>("/v2/bootstrap"),
    serverApiFetch<V2TemplatesSummaryResponse>("/v2/templates/summary"),
    serverApiFetch<V2SmsTemplatesResponse>("/v2/templates/sms"),
    serverApiFetch<V2KakaoTemplatesResponse>("/v2/templates/kakao"),
  ]);

  return {
    bootstrap,
    templates: {
      summary,
      sms,
      kakao,
    },
  };
}

export async function fetchServerLogsShellData() {
  const [bootstrap, logs] = await Promise.all([
    serverApiFetch<V2BootstrapResponse>("/v2/bootstrap"),
    serverApiFetch<V2LogsResponse>("/v2/logs"),
  ]);

  return {
    bootstrap,
    logs,
  };
}

export async function fetchServerEventsShellData() {
  const [bootstrap, events] = await Promise.all([
    serverApiFetch<V2BootstrapResponse>("/v2/bootstrap"),
    serverApiFetch<V2EventsResponse>("/v2/events"),
  ]);

  return {
    bootstrap,
    events,
  };
}

export async function fetchServerSettingsShellData() {
  const [bootstrap, opsHealth] = await Promise.all([
    serverApiFetch<V2BootstrapResponse>("/v2/bootstrap"),
    serverApiFetch<V2OpsHealthResponse>("/v2/ops/health"),
  ]);

  return {
    bootstrap,
    opsHealth,
  };
}

export async function fetchServerCampaignsShellData() {
  const [bootstrap, campaigns] = await Promise.all([
    serverApiFetch<V2BootstrapResponse>("/v2/bootstrap"),
    serverApiFetch<V2CampaignsResponse>("/v2/campaigns"),
  ]);

  return {
    bootstrap,
    campaigns,
  };
}

export async function fetchServerSmsSendPageData() {
  const readiness = await serverApiFetch<V2SmsSendReadinessResponse>("/v2/send/sms/readiness");

  if (!readiness.ready) {
    return {
      readiness,
      options: null as V2SmsSendOptionsResponse | null,
    };
  }

  const options = await serverApiFetch<V2SmsSendOptionsResponse>("/v2/send/sms/options");
  return {
    readiness,
    options,
  };
}

export async function fetchServerKakaoSendPageData() {
  const readiness = await serverApiFetch<V2KakaoSendReadinessResponse>("/v2/send/kakao/readiness");

  if (!readiness.ready) {
    return {
      readiness,
      options: null as V2KakaoSendOptionsResponse | null,
    };
  }

  const options = await serverApiFetch<V2KakaoSendOptionsResponse>("/v2/send/kakao/options");
  return {
    readiness,
    options,
  };
}
