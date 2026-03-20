export const DOMESTIC_SMS_STANDARD_BYTES = 90;
export const DOMESTIC_LMS_STANDARD_BYTES = 2000;
export const DOMESTIC_MMS_TITLE_STANDARD_BYTES = 40;
export const MMS_ATTACHMENT_MAX_COUNT = 3;
export const MMS_ATTACHMENT_MAX_FILE_SIZE_BYTES = 300 * 1024;
export const MMS_ATTACHMENT_TOTAL_SIZE_BYTES_FOR_THREE = 800 * 1024;

export type DomesticSmsMessageType = 'SMS' | 'LMS' | 'MMS' | 'OVER_LIMIT';

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
