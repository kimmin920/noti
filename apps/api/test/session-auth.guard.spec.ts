import { UnauthorizedException } from '@nestjs/common';
import { SessionAuthGuard } from '../src/auth/session-auth.guard';
import { hashToken } from '../src/common/utils';

function createContext(req: Record<string, unknown>) {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => req
    })
  } as any;
}

function createGuard() {
  const prisma = {
    session: {
      findMany: jest.fn()
    }
  };
  const env = {
    cookieName: 'pm_session',
    sessionSecret: 'session-secret'
  };
  const reflector = {
    getAllAndOverride: jest.fn(() => false)
  };
  const guard = new SessionAuthGuard(prisma as any, env as any, reflector as any);

  return { env, guard, prisma };
}

function createSession(token: string, role: 'USER' | 'PARTNER_ADMIN' | 'SUPER_ADMIN' = 'USER') {
  return {
    id: `session-${token}`,
    tokenHash: hashToken(token, 'session-secret'),
    user: {
      id: `user-${token}`,
      providerUserId: `provider-${token}`,
      loginProvider: 'GOOGLE_OAUTH',
      email: `${token}@example.com`,
      role,
      accessOrigin: 'DIRECT'
    }
  };
}

describe('SessionAuthGuard', () => {
  it('accepts a later duplicate pm_session cookie when the first one is stale', async () => {
    const { guard, prisma } = createGuard();
    const validSession = createSession('valid-token');
    prisma.session.findMany.mockResolvedValue([validSession]);
    const req = {
      headers: {
        cookie: 'pm_session=stale-token; theme=dark; pm_session=valid-token'
      },
      cookies: {
        pm_session: 'stale-token'
      }
    };

    await expect(guard.canActivate(createContext(req))).resolves.toBe(true);

    expect(prisma.session.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tokenHash: {
            in: [
              hashToken('stale-token', 'session-secret'),
              hashToken('valid-token', 'session-secret')
            ]
          }
        })
      })
    );
    expect((req as any).sessionUser).toEqual(
      expect.objectContaining({
        sessionId: validSession.id,
        userId: validSession.user.id,
        email: validSession.user.email
      })
    );
  });

  it('falls back to parsed cookies when the raw Cookie header is absent', async () => {
    const { guard, prisma } = createGuard();
    prisma.session.findMany.mockResolvedValue([createSession('parsed-token')]);
    const req = {
      headers: {},
      cookies: {
        pm_session: 'parsed-token'
      }
    };

    await expect(guard.canActivate(createContext(req))).resolves.toBe(true);
  });

  it('rejects when no session cookie value is present', async () => {
    const { guard, prisma } = createGuard();
    const req = {
      headers: {},
      cookies: {}
    };

    await expect(guard.canActivate(createContext(req))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.session.findMany).not.toHaveBeenCalled();
  });
});
