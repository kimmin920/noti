import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

export function hashToken(token: string, secret: string): string {
  return createHash('sha256').update(`${token}:${secret}`).digest('hex');
}

export function createSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, hashedPassword: string): boolean {
  const [scheme, salt, stored] = hashedPassword.split(':');
  if (scheme !== 'scrypt' || !salt || !stored) {
    return false;
  }

  const derived = scryptSync(password, salt, 64);
  const storedBuffer = Buffer.from(stored, 'hex');

  if (derived.length !== storedBuffer.length) {
    return false;
  }

  return timingSafeEqual(derived, storedBuffer);
}

export function pickBearerToken(value?: string): string | null {
  if (!value) {
    return null;
  }

  const parts = value.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}
