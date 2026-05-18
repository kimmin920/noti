import { ForbiddenException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { CsrfOriginGuard } from '../src/common/csrf-origin.guard';
import { EnvService } from '../src/common/env';

function createHttpContext(req: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req
    })
  } as ExecutionContext;
}

function createRequest(method: string, headers: Record<string, string> = {}) {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );

  return {
    method,
    protocol: 'https',
    secure: true,
    get: jest.fn((name: string) => normalizedHeaders[name.toLowerCase()] ?? '')
  };
}

describe('production security configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('does not require production secrets in development', () => {
    process.env.NODE_ENV = 'development';

    expect(() => new EnvService().validateStartupConfig()).not.toThrow();
  });

  it('rejects production startup when required secrets or safe cookie settings are missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.COOKIE_SECURE = 'false';
    process.env.LOCAL_PASSWORD_LOGIN_ENABLED = 'true';
    process.env.CORS_ALLOW_ORIGINS = '';

    expect(() => new EnvService().validateStartupConfig()).toThrow(/SESSION_SECRET must be configured/);
  });

  it('accepts production startup when required security settings are present', () => {
    process.env.NODE_ENV = 'production';
    process.env.SESSION_SECRET = 'session-secret-value';
    process.env.PUBL_SSO_HS256_SECRET = 'publ-sso-secret-value';
    process.env.PUBL_SERVICE_TOKEN = 'publ-service-token-value';
    process.env.NHN_WEBHOOK_SIGNATURE_SECRET = 'nhn-webhook-secret-value';
    process.env.COOKIE_SECURE = 'true';
    process.env.LOCAL_PASSWORD_LOGIN_ENABLED = 'false';
    process.env.NEXT_PUBLIC_LOCAL_PASSWORD_LOGIN_ENABLED = 'false';
    process.env.SWAGGER_ENABLED = 'false';
    process.env.TRUST_PROXY = 'loopback, linklocal, uniquelocal';
    process.env.ADMIN_BASE_URL = 'https://admin.example.com';
    process.env.CORS_ALLOW_ORIGINS = 'https://admin.example.com';

    expect(() => new EnvService().validateStartupConfig()).not.toThrow();
  });

  it('rejects production startup when Swagger or trust-all proxy mode is enabled', () => {
    process.env.NODE_ENV = 'production';
    process.env.SESSION_SECRET = 'session-secret-value';
    process.env.PUBL_SSO_HS256_SECRET = 'publ-sso-secret-value';
    process.env.PUBL_SERVICE_TOKEN = 'publ-service-token-value';
    process.env.NHN_WEBHOOK_SIGNATURE_SECRET = 'nhn-webhook-secret-value';
    process.env.COOKIE_SECURE = 'true';
    process.env.LOCAL_PASSWORD_LOGIN_ENABLED = 'false';
    process.env.NEXT_PUBLIC_LOCAL_PASSWORD_LOGIN_ENABLED = 'false';
    process.env.SWAGGER_ENABLED = 'true';
    process.env.TRUST_PROXY = 'true';
    process.env.ADMIN_BASE_URL = 'https://admin.example.com';
    process.env.CORS_ALLOW_ORIGINS = 'https://admin.example.com';

    expect(() => new EnvService().validateStartupConfig()).toThrow(/SWAGGER_ENABLED must be false/);
  });
});

describe('CsrfOriginGuard', () => {
  const env = {
    adminBaseUrl: 'https://admin.example.com',
    corsOrigins: ['https://admin.example.com']
  } as EnvService;

  it('allows safe methods without origin checks', () => {
    const guard = new CsrfOriginGuard(env);
    const req = createRequest('GET', { origin: 'https://evil.example.com' });

    expect(guard.canActivate(createHttpContext(req))).toBe(true);
  });

  it('allows unsafe requests from the configured admin origin', () => {
    const guard = new CsrfOriginGuard(env);
    const req = createRequest('POST', {
      origin: 'https://admin.example.com',
      host: 'api.example.com'
    });

    expect(guard.canActivate(createHttpContext(req))).toBe(true);
  });

  it('rejects unsafe browser requests from unknown origins', () => {
    const guard = new CsrfOriginGuard(env);
    const req = createRequest('POST', {
      origin: 'https://evil.example.com',
      host: 'api.example.com'
    });

    expect(() => guard.canActivate(createHttpContext(req))).toThrow(ForbiddenException);
  });

  it('allows server-to-server unsafe requests without browser origin headers', () => {
    const guard = new CsrfOriginGuard(env);
    const req = createRequest('POST', { host: 'api.example.com' });

    expect(guard.canActivate(createHttpContext(req))).toBe(true);
  });
});
