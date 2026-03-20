function normalizeOrigin(value: string): string {
  return value.replace(/\/+$/, '');
}

function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function normalizeConfiguredOrigin(value?: string): string {
  return value ? normalizeOrigin(value) : '';
}

function isLocalConfiguredOrigin(value: string): boolean {
  try {
    const parsed = new URL(value);
    return isLocalHostname(parsed.hostname);
  } catch {
    return false;
  }
}

function deriveFromLocation(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  const { protocol, hostname } = window.location;

  if (isLocalHostname(hostname)) {
    return 'http://localhost:3000';
  }

  if (hostname.startsWith('admin-')) {
    return `${protocol}//${hostname.replace(/^admin-/, 'api-')}`;
  }

  if (hostname.startsWith('admin.')) {
    return `${protocol}//${hostname.replace(/^admin\./, 'api.')}`;
  }

  return '';
}

export function getApiBase(): string {
  const derived = deriveFromLocation();
  const configured = normalizeConfiguredOrigin(process.env.NEXT_PUBLIC_API_BASE_URL);

  if (typeof window !== 'undefined' && isLocalHostname(window.location.hostname)) {
    if (configured && isLocalConfiguredOrigin(configured)) {
      return configured;
    }

    if (derived) {
      return normalizeOrigin(derived);
    }
  }

  if (configured) {
    return configured;
  }

  if (derived) {
    return normalizeOrigin(derived);
  }

  return 'http://localhost:3000';
}
