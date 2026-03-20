import { getApiBase } from './api-base';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBase()}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    }
  });

  if (!response.ok) {
    const body = await response.text();
    let message = body || `HTTP ${response.status}`;

    if (body) {
      try {
        const parsed = JSON.parse(body) as { message?: string | string[]; error?: string };
        if (Array.isArray(parsed.message) && parsed.message.length > 0) {
          message = parsed.message.join(', ');
        } else if (typeof parsed.message === 'string' && parsed.message.trim()) {
          message = parsed.message;
        } else if (typeof parsed.error === 'string' && parsed.error.trim()) {
          message = parsed.error;
        }
      } catch {
        // Keep the raw response text when the server does not return JSON.
      }
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const samplePayloads = {
  PUBL_USER_SIGNUP: {
    tenantId: 'tenant_demo',
    eventKey: 'PUBL_USER_SIGNUP',
    recipient: { phone: '01012345678', userId: 'publ_user_1' },
    variables: { username: '민우' },
    metadata: { publEventId: 'evt_signup_sample', traceId: 'trace_signup' }
  },
  PUBL_TICKET_PURCHASED: {
    tenantId: 'tenant_demo',
    eventKey: 'PUBL_TICKET_PURCHASED',
    recipient: { phone: '01012345678', userId: 'publ_user_1' },
    variables: { username: '민우', ticketName: 'VIP' },
    metadata: { publEventId: 'evt_ticket_sample', traceId: 'trace_ticket' }
  },
  PUBL_PAYMENT_COMPLETED: {
    tenantId: 'tenant_demo',
    eventKey: 'PUBL_PAYMENT_COMPLETED',
    recipient: { phone: '01012345678', userId: 'publ_user_1' },
    variables: { username: '민우', amount: '39000' },
    metadata: { publEventId: 'evt_payment_sample', traceId: 'trace_payment' }
  }
};
