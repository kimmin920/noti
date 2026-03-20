export const SMS_ADVERTISEMENT_PREFIX = '(광고)';
export const SMS_ADVERTISEMENT_OPT_OUT_NUMBER = '080-500-4233';
export const SMS_ADVERTISEMENT_OPT_OUT_TEXT = `무료수신거부 ${SMS_ADVERTISEMENT_OPT_OUT_NUMBER}`;

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

export function formatSmsBodyForAdvertisement(
  body: string,
  options?: {
    isAdvertisement?: boolean;
    advertisingServiceName?: string | null;
  }
): string {
  const normalizedBody = String(body ?? '')
    .replace(/\r\n?/g, '\n')
    .trim();

  if (!options?.isAdvertisement) {
    return normalizedBody;
  }

  const advertisingServiceName = sanitizeAdvertisingServiceName(options.advertisingServiceName);
  const content = stripLeadingAdvertisementPrefix(
    normalizedBody
      .split('\n')
      .map((line) => line.trimEnd())
      .filter((line) => line.trim() !== SMS_ADVERTISEMENT_OPT_OUT_TEXT)
      .join('\n')
      .trim(),
    advertisingServiceName
  );

  return [`${SMS_ADVERTISEMENT_PREFIX}${advertisingServiceName}`, content, SMS_ADVERTISEMENT_OPT_OUT_TEXT]
    .filter(Boolean)
    .join('\n');
}
