import { UnauthorizedException } from '@nestjs/common';
import axios from 'axios';
import { sign } from 'jsonwebtoken';
import { AuthService } from '../src/auth/auth.service';
import { hashPassword } from '../src/common/utils';

function fixture() {
  const sessions: any[] = [];

  const prisma = {
    tenant: {
      upsert: jest.fn(async ({ where, create }: any) => ({ id: where.id || create.id, name: 'Tenant' }))
    },
    adminUser: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (where.loginId === 'test1@vizuo.work') {
          return {
            id: 'user_local_1',
            tenantId: 'tenant_test1',
            publUserId: 'local:test1@vizuo.work',
            loginId: 'test1@vizuo.work',
            email: 'test1@vizuo.work',
            passwordHash: hashPassword('vizuo.work123'),
            role: 'TENANT_ADMIN'
          };
        }

        return null;
      }),
      upsert: jest.fn(async ({ create, update }: any) => ({
        id: 'user_1',
        publUserId: create.publUserId,
        email: create.email ?? update.email ?? null,
        role: create.role ?? update.role ?? 'TENANT_ADMIN'
      }))
    },
    session: {
      create: jest.fn(async ({ data }: any) => {
        sessions.push(data);
        return data;
      }),
      deleteMany: jest.fn(async () => ({ count: 1 }))
    }
  };

  const env = {
    publSsoSecret: 'test-secret',
    sessionSecret: 'session-secret',
    cookieMaxAgeSeconds: 86400,
    googleOauthClientId: 'google-client-id',
    googleOauthClientSecret: 'google-client-secret',
    googleOauthRedirectUri: 'http://localhost:3000/v1/auth/google/callback',
    googleOauthAllowedDomain: 'publ.dev',
    googleOauthDefaultTenantId: 'tenant_demo',
    googleOauthDefaultTenantName: 'Google Tenant',
    googleOauthOperatorEmails: ['ops@publ.dev'],
    publAccounts: ['publ-account@publ.dev'],
    googleOauthAllowedEmails: ['ops@publ.dev', 'publ-account@publ.dev'],
    googleOauthOperatorTenantId: 'tenant_internal_ops',
    googleOauthOperatorTenantName: 'Publ Internal Operations',
    isPlaceholder: (value: string) => value.includes('__REPLACE_ME__')
  };

  const service = new AuthService(prisma as any, env as any);
  return { service, sessions, prisma };
}

describe('AuthService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('exchanges valid HS256 token and creates session', async () => {
    const { service, sessions } = fixture();

    const jwt = sign(
      {
        sub: 'publ_user_1',
        tenant_id: 'tenant_demo',
        role: 'TENANT_ADMIN'
      },
      'test-secret',
      {
        algorithm: 'HS256',
        issuer: 'publ',
        audience: 'publ-messaging',
        expiresIn: '2m'
      }
    );

    const token = await service.exchangeSsoToken(jwt);

    expect(token).toBeTruthy();
    expect(sessions).toHaveLength(1);
  });

  it('rejects invalid role', async () => {
    const { service } = fixture();

    const jwt = sign(
      {
        sub: 'publ_user_1',
        tenant_id: 'tenant_demo',
        role: 'USER'
      },
      'test-secret',
      {
        algorithm: 'HS256',
        issuer: 'publ',
        audience: 'publ-messaging',
        expiresIn: '2m'
      }
    );

    await expect(service.exchangeSsoToken(jwt)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects Google account when it is not a configured operator', async () => {
    const { service } = fixture();

    jest.spyOn(axios, 'post').mockResolvedValue({
      data: {
        id_token: 'google-id-token'
      }
    } as any);

    jest.spyOn(axios, 'get').mockResolvedValue({
      data: {
        aud: 'google-client-id',
        sub: 'google-sub-1',
        email: 'admin@publ.dev',
        email_verified: 'true',
        hd: 'publ.dev'
      }
    } as any);

    await expect(
      service.exchangeGoogleCode('google-auth-code', 'http://localhost:3000/v1/auth/google/callback')
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('creates OPERATOR session for configured internal Google account', async () => {
    const { service, sessions, prisma } = fixture();

    jest.spyOn(axios, 'post').mockResolvedValue({
      data: {
        id_token: 'google-id-token'
      }
    } as any);

    jest.spyOn(axios, 'get').mockResolvedValue({
      data: {
        aud: 'google-client-id',
        sub: 'google-sub-ops',
        email: 'ops@publ.dev',
        email_verified: 'true',
        hd: 'publ.dev'
      }
    } as any);

    const token = await service.exchangeGoogleCode('google-auth-code', 'http://localhost:3000/v1/auth/google/callback');

    expect(token).toBeTruthy();
    expect(sessions).toHaveLength(1);
    expect(prisma.tenant.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tenant_internal_ops' },
        create: expect.objectContaining({ id: 'tenant_internal_ops' })
      })
    );
    expect(prisma.adminUser.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ role: 'OPERATOR' }),
        create: expect.objectContaining({ role: 'OPERATOR' })
      })
    );
  });

  it('creates TENANT_ADMIN session for configured publ account', async () => {
    const { service, sessions, prisma } = fixture();

    jest.spyOn(axios, 'post').mockResolvedValue({
      data: {
        id_token: 'google-id-token'
      }
    } as any);

    jest.spyOn(axios, 'get').mockResolvedValue({
      data: {
        aud: 'google-client-id',
        sub: 'google-sub-publ-account',
        email: 'publ-account@publ.dev',
        email_verified: 'true',
        hd: 'publ.dev'
      }
    } as any);

    const token = await service.exchangeGoogleCode('google-auth-code', 'http://localhost:3000/v1/auth/google/callback');

    expect(token).toBeTruthy();
    expect(sessions).toHaveLength(1);
    expect(prisma.tenant.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tenant_demo' },
        create: expect.objectContaining({ id: 'tenant_demo' })
      })
    );
    expect(prisma.adminUser.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ role: 'TENANT_ADMIN' }),
        create: expect.objectContaining({ role: 'TENANT_ADMIN' })
      })
    );
  });

  it('creates session for local password login', async () => {
    const { service, sessions } = fixture();

    const token = await service.exchangePasswordLogin('test1@vizuo.work', 'vizuo.work123');

    expect(token).toBeTruthy();
    expect(sessions).toHaveLength(1);
  });

  it('rejects local password login when password is invalid', async () => {
    const { service } = fixture();

    await expect(service.exchangePasswordLogin('test1@vizuo.work', 'wrong-password')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects Google account when workspace domain does not match', async () => {
    const { service } = fixture();

    jest.spyOn(axios, 'post').mockResolvedValue({
      data: {
        id_token: 'google-id-token'
      }
    } as any);

    jest.spyOn(axios, 'get').mockResolvedValue({
      data: {
        aud: 'google-client-id',
        sub: 'google-sub-1',
        email: 'admin@other.dev',
        email_verified: 'true',
        hd: 'other.dev'
      }
    } as any);

    await expect(
      service.exchangeGoogleCode('google-auth-code', 'http://localhost:3000/v1/auth/google/callback')
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
