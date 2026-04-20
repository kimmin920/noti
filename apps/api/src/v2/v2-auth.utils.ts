import { ForbiddenException } from '@nestjs/common';
import { SessionRequest, SessionUser } from '../common/session-request.interface';

export function assertAccountUser(req: SessionRequest): SessionUser {
  if (!req.sessionUser || (req.sessionUser.role !== 'USER' && req.sessionUser.role !== 'PARTNER_ADMIN')) {
    throw new ForbiddenException('USER or PARTNER_ADMIN role is required');
  }

  return req.sessionUser;
}

export function assertSuperAdmin(req: SessionRequest): SessionUser {
  if (!req.sessionUser || req.sessionUser.role !== 'SUPER_ADMIN') {
    throw new ForbiddenException('SUPER_ADMIN role is required');
  }

  return req.sessionUser;
}

export function assertPartnerAdmin(req: SessionRequest): SessionUser {
  if (!req.sessionUser || req.sessionUser.role !== 'PARTNER_ADMIN') {
    throw new ForbiddenException('PARTNER_ADMIN role is required');
  }

  return req.sessionUser;
}

export function canUsePartnerGroupTemplates(sessionUser: SessionUser) {
  return sessionUser.role === 'PARTNER_ADMIN' && sessionUser.accessOrigin === 'PUBL';
}

export const assertOperator = assertSuperAdmin;
