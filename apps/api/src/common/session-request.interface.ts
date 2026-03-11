import type { Request } from 'express';

export interface SessionUser {
  sessionId: string;
  tenantId: string;
  userId: string;
  publUserId: string;
  email?: string | null;
  role: string;
}

export interface SessionRequest extends Request {
  sessionUser?: SessionUser;
}
