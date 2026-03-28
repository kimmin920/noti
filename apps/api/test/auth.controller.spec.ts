import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthController } from '../src/auth/auth.controller';

function createFixture(overrides?: Partial<Record<string, unknown>>) {
  const authService = {
    buildGoogleAuthorizeUrl: jest.fn(
      (state: string, redirectUri: string) =>
        `https://accounts.google.com/o/oauth2/v2/auth?state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`
    ),
    exchangeGoogleCode: jest.fn(async () => 'session-token'),
    revokeSession: jest.fn(async () => undefined)
  };

  const env = {
    cookieName: 'pm_session',
    cookieSecure: true,
    cookieSameSite: 'lax' as const,
    cookieDomain: '.vizuo.work',
    cookieMaxAgeSeconds: 86400,
    localPasswordLoginEnabled: true,
    adminBaseUrl: 'https://admin-speed-demon.vizuo.work',
    googleOauthStateCookieName: 'pm_oauth_state',
    googleOauthStateCookieSecure: true,
    googleOauthStateCookieSameSite: 'lax' as const,
    googleOauthStateCookieDomain: undefined,
    googleOauthStateMaxAgeSeconds: 600,
    corsOrigins: [],
    ...overrides
  };

  const googleOauthStateService = {
    issue: jest.fn(() => 'issued-state'),
    consume: jest.fn(() => null)
  };

  const controller = new AuthController(
    authService as any,
    env as any,
    googleOauthStateService as any
  );

  const res = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    redirect: jest.fn()
  };

  return { authService, controller, env, googleOauthStateService, res };
}

describe('AuthController', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('issues Google OAuth state via server-side store and redirects without setting a state cookie', () => {
    const { authService, controller, googleOauthStateService, res } = createFixture();
    const req = {
      query: {
        returnTo: 'https://admin-speed-demon.vizuo.work/internal'
      },
      get: jest.fn((name: string) => {
        if (name === 'host') return 'api-speed-demon.vizuo.work';
        if (name === 'x-forwarded-proto') return 'https';
        return '';
      }),
      protocol: 'https',
      secure: true
    };

    controller.googleStart(res as any, req as any);

    expect(googleOauthStateService.issue).toHaveBeenCalledWith(req, {
      redirectUri: 'https://api-speed-demon.vizuo.work/v1/auth/google/callback',
      returnTo: 'https://admin-speed-demon.vizuo.work/internal'
    });
    expect(res.cookie).not.toHaveBeenCalled();
    expect(res.clearCookie).toHaveBeenCalledTimes(2);
    expect(authService.buildGoogleAuthorizeUrl).toHaveBeenCalledWith(
      'issued-state',
      'https://api-speed-demon.vizuo.work/v1/auth/google/callback'
    );
    expect(res.redirect).toHaveBeenCalledWith(
      302,
      'https://accounts.google.com/o/oauth2/v2/auth?state=issued-state&redirect_uri=https%3A%2F%2Fapi-speed-demon.vizuo.work%2Fv1%2Fauth%2Fgoogle%2Fcallback'
    );
  });

  it('rejects local password login when the feature is disabled', async () => {
    const { controller, res } = createFixture({
      localPasswordLoginEnabled: false
    });
    const req = {
      get: jest.fn(() => 'localhost:3000'),
      protocol: 'http',
      secure: false
    };

    await expect(
      controller.passwordLogin(
        req as any,
        { loginId: 'test1@vizuo.work', password: 'vizuo.work123' } as any,
        res as any
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects callback when server-side state validation fails', async () => {
    const { controller, googleOauthStateService, res } = createFixture();
    const req = {
      query: {
        code: 'google-auth-code',
        state: 'received-state'
      },
      cookies: {},
      get: jest.fn(() => 'api-speed-demon.vizuo.work'),
      protocol: 'https',
      secure: true,
      headers: {}
    };

    await expect(controller.googleCallback(req as any, res as any)).rejects.toBeInstanceOf(UnauthorizedException);

    expect(googleOauthStateService.consume).toHaveBeenCalledWith('received-state', req);
    expect(res.clearCookie).toHaveBeenCalledTimes(2);
  });

  it('uses host-only cookies on localhost even when a shared cookie domain is configured', async () => {
    const { controller, googleOauthStateService, authService, res } = createFixture();
    (googleOauthStateService.consume as jest.Mock).mockReturnValue({
      redirectUri: 'http://localhost:3000/v1/auth/google/callback',
      returnTo: 'http://localhost:3001/login?next=%2Finternal'
    });

    const req = {
      query: {
        code: 'google-auth-code',
        state: 'received-state'
      },
      cookies: {},
      get: jest.fn((name: string) => {
        if (name === 'host') return 'localhost:3000';
        return '';
      }),
      protocol: 'http',
      secure: false,
      headers: {}
    };

    await controller.googleCallback(req as any, res as any);

    expect(authService.exchangeGoogleCode).toHaveBeenCalledWith(
      'google-auth-code',
      'http://localhost:3000/v1/auth/google/callback'
    );
    expect(res.cookie).toHaveBeenCalledWith(
      'pm_session',
      'session-token',
      expect.objectContaining({
        domain: undefined,
        secure: false
      })
    );
    expect(res.redirect).toHaveBeenCalledWith(302, 'http://localhost:3001/login?next=%2Finternal');
  });
});
