export const QUEUE_NAMES = {
  SEND: 'send-message',
  TEMPLATE_SYNC: 'template-sync',
  SENDER_SYNC: 'sender-sync'
} as const;

export const MESSAGE_JOB_NAME = 'message:dispatch';
export const RESULT_CHECK_JOB_NAME = 'message:result-check';

export const RETRY_BACKOFF_SECONDS = [2, 5, 15, 45, 120, 300, 900, 1800];

export const SAMPLE_EVENT_KEYS = [
  'PUBL_USER_SIGNUP',
  'PUBL_TICKET_PURCHASED',
  'PUBL_PAYMENT_COMPLETED'
] as const;

const REQUIRED_VAR_REGEX = /\{\{\s*([a-zA-Z0-9_\.]+)\s*\}\}/g;

export function extractRequiredVariables(body: string): string[] {
  const set = new Set<string>();
  let match: RegExpExecArray | null = REQUIRED_VAR_REGEX.exec(body);

  while (match) {
    set.add(match[1]);
    match = REQUIRED_VAR_REGEX.exec(body);
  }

  return [...set].sort();
}

export function renderTemplate(body: string, variables: Record<string, string | number>): string {
  return body.replace(REQUIRED_VAR_REGEX, (_, key: string) => {
    if (!(key in variables)) {
      throw new Error(`Missing template variable: ${key}`);
    }
    return String(variables[key]);
  });
}

export function jitterSeconds(base: number): number {
  const random = Math.random() * 0.3 + 0.85;
  return Math.max(1, Math.round(base * random));
}

export function missingRequiredVariables(
  required: string[],
  payload: Record<string, string | number | null | undefined>
): string[] {
  return required.filter((key) => {
    const value = payload[key];
    return value === undefined || value === null || value === '';
  });
}
