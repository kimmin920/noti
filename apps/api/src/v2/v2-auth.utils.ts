import { ForbiddenException } from '@nestjs/common';
import { SessionRequest, SessionUser } from '../common/session-request.interface';

export function assertWorkspaceAdmin(req: SessionRequest): SessionUser {
  if (!req.sessionUser || (req.sessionUser.role !== 'TENANT_ADMIN' && req.sessionUser.role !== 'PARTNER_ADMIN')) {
    throw new ForbiddenException('TENANT_ADMIN or PARTNER_ADMIN role is required');
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
  return sessionUser.role === 'PARTNER_ADMIN' && sessionUser.partnerScope === 'PUBL';
}

export const assertTenantAdmin = assertWorkspaceAdmin;
export const assertOperator = assertSuperAdmin;
