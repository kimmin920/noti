import type { Request } from 'express';

export interface SessionUser {
  sessionId: string;
  userId: string;
  providerUserId: string;
  loginProvider: 'GOOGLE_OAUTH' | 'PUBL_SSO' | 'LOCAL_PASSWORD';
  email?: string | null;
  role: string;
  accessOrigin?: 'DIRECT' | 'PUBL';
}

export interface SessionRequest extends Request {
  sessionUser?: SessionUser;
}
