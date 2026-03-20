export const QUEUE_NAMES = {
  SEND: 'send-message',
  TEMPLATE_SYNC: 'template-sync',
  SENDER_SYNC: 'sender-sync'
} as const;

export const MESSAGE_JOB_NAME = 'message:dispatch';
export const BULK_SMS_JOB_NAME = 'bulk-sms:dispatch';
export const BULK_ALIMTALK_JOB_NAME = 'bulk-alimtalk:dispatch';
export const RESULT_CHECK_JOB_NAME = 'message:result-check';
export const SMS_ADVERTISEMENT_PREFIX = '(광고)';
export const SMS_ADVERTISEMENT_OPT_OUT_NUMBER = '080-500-4233';
export const SMS_ADVERTISEMENT_OPT_OUT_TEXT = `무료수신거부 ${SMS_ADVERTISEMENT_OPT_OUT_NUMBER}`;
export const DOMESTIC_SMS_STANDARD_BYTES = 90;
export const DOMESTIC_LMS_STANDARD_BYTES = 2000;
export const DOMESTIC_MMS_TITLE_STANDARD_BYTES = 40;
export const MMS_ATTACHMENT_MAX_COUNT = 3;
export const MMS_ATTACHMENT_MAX_FILE_SIZE_BYTES = 300 * 1024;
export const MMS_ATTACHMENT_TOTAL_SIZE_BYTES_FOR_THREE = 800 * 1024;

export type DomesticSmsMessageType = 'SMS' | 'LMS' | 'MMS' | 'OVER_LIMIT';

export const RETRY_BACKOFF_SECONDS = [2, 5, 15, 45, 120, 300, 900, 1800];

export const SAMPLE_EVENT_KEYS = [
  'PUBL_USER_SIGNUP',
  'PUBL_TICKET_PURCHASED',
  'PUBL_PAYMENT_COMPLETED'
] as const;

const REQUIRED_VAR_REGEX = /\{\{\s*([^}]+?)\s*\}\}|#\{\s*([^}]+?)\s*\}/g;

function normalizeSmsText(value: string): string {
  return String(value ?? '').replace(/\r\n?/g, '\n');
}

export function getDomesticSmsByteLength(value: string): number {
  let total = 0;

  for (const character of normalizeSmsText(value)) {
    const codePoint = character.codePointAt(0) ?? 0;
    total += codePoint <= 0x7f ? 1 : 2;
  }

  return total;
}

export function truncateDomesticSmsText(value: string, maxBytes: number): string {
  const normalized = normalizeSmsText(value);
  let total = 0;
  let result = '';

  for (const character of normalized) {
    const charBytes = (character.codePointAt(0) ?? 0) <= 0x7f ? 1 : 2;
    if (total + charBytes > maxBytes) {
      break;
    }

    result += character;
    total += charBytes;
  }

  return result.trim();
}

export function classifyDomesticSmsBody(
  body: string,
  options?: {
    hasAttachments?: boolean;
  }
): DomesticSmsMessageType {
  const bytes = getDomesticSmsByteLength(body);

  if (options?.hasAttachments) {
    return bytes <= DOMESTIC_LMS_STANDARD_BYTES ? 'MMS' : 'OVER_LIMIT';
  }

  if (bytes <= DOMESTIC_SMS_STANDARD_BYTES) {
    return 'SMS';
  }

  if (bytes <= DOMESTIC_LMS_STANDARD_BYTES) {
    return 'LMS';
  }

  return 'OVER_LIMIT';
}

export function buildDomesticMmsTitle(body: string, preferredTitle?: string | null): string {
  const normalizedPreferredTitle = String(preferredTitle ?? '').trim();
  const fallbackLine = normalizeSmsText(body)
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  const source = normalizedPreferredTitle || fallbackLine || '이미지 메시지';
  const truncated = truncateDomesticSmsText(source, DOMESTIC_MMS_TITLE_STANDARD_BYTES);

  return truncated || '이미지 메시지';
}

export function extractRequiredVariables(body: string): string[] {
  const set = new Set<string>();
  let match: RegExpExecArray | null = REQUIRED_VAR_REGEX.exec(body);

  while (match) {
    const key = (match[1] ?? match[2] ?? '').trim();
    if (key) {
      set.add(key);
    }
    match = REQUIRED_VAR_REGEX.exec(body);
  }

  return [...set].sort();
}

export function renderTemplate(body: string, variables: Record<string, string | number>): string {
  return body.replace(REQUIRED_VAR_REGEX, (_, mustacheKey: string | undefined, hashKey: string | undefined) => {
    const key = (mustacheKey ?? hashKey ?? '').trim();
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

export function formatNhnRequestDate(date: Date, timeZone = 'Asia/Seoul'): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });
  const parts = formatter.formatToParts(date);
  const valueByType = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${valueByType.year}-${valueByType.month}-${valueByType.day} ${valueByType.hour}:${valueByType.minute}`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function sanitizeAdvertisingServiceName(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

function stripLeadingAdvertisementPrefix(body: string, advertisingServiceName: string): string {
  let next = body.trimStart();

  if (advertisingServiceName) {
    next = next.replace(
      new RegExp(`^${escapeRegex(SMS_ADVERTISEMENT_PREFIX)}\\s*${escapeRegex(advertisingServiceName)}\\s*`, 'u'),
      ''
    );
  }

  next = next.replace(new RegExp(`^${escapeRegex(SMS_ADVERTISEMENT_PREFIX)}\\s*`, 'u'), '');
  return next.trimStart();
}

export function formatSmsBody(
  body: string,
  options?: {
    isAdvertisement?: boolean;
    advertisingServiceName?: string | null;
    optOutText?: string | null;
  }
): string {
  const normalizedBody = String(body ?? '')
    .replace(/\r\n?/g, '\n')
    .trim();

  if (!options?.isAdvertisement) {
    return normalizedBody;
  }

  const advertisingServiceName = sanitizeAdvertisingServiceName(options.advertisingServiceName);
  const optOutText =
    String(options.optOutText ?? SMS_ADVERTISEMENT_OPT_OUT_TEXT)
      .replace(/\r\n?/g, '\n')
      .trim() || SMS_ADVERTISEMENT_OPT_OUT_TEXT;
  const content = stripLeadingAdvertisementPrefix(
    normalizedBody
      .split('\n')
      .map((line) => line.trimEnd())
      .filter((line) => line.trim() !== optOutText)
      .join('\n')
      .trim(),
    advertisingServiceName
  );
  const prefix = `${SMS_ADVERTISEMENT_PREFIX}${advertisingServiceName}`;

  return [prefix, content, optOutText].filter(Boolean).join('\n');
}
