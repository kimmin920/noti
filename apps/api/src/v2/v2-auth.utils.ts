import { ForbiddenException } from '@nestjs/common';
import { SessionRequest, SessionUser } from '../common/session-request.interface';

export function assertTenantAdmin(req: SessionRequest): SessionUser {
  if (!req.sessionUser || req.sessionUser.role !== 'TENANT_ADMIN') {
    throw new ForbiddenException('TENANT_ADMIN role is required');
  }

  return req.sessionUser;
}
