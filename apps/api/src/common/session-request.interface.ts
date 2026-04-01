import type { Request } from 'express';

export interface SessionUser {
  sessionId: string;
  tenantId: string;
  userId: string;
  publUserId: string;
  email?: string | null;
  role: string;
  accessOrigin?: 'DIRECT' | 'PUBL';
  partnerScope?: 'DIRECT' | 'PUBL' | null;
}

export interface SessionRequest extends Request {
  sessionUser?: SessionUser;
}
