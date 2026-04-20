import { UnauthorizedException } from '@nestjs/common';
import axios from 'axios';
import { sign } from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { AuthService } from '../src/auth/auth.service';
import { hashPassword } from '../src/common/utils';

type ExistingUser = {
  id: string;
  providerUserId: string;
  loginId?: string | null;
  email?: string | null;
  passwordHash?: string | null;
  loginProvider?: "GOOGLE_OAUTH" | "PUBL_SSO" | "LOCAL_PASSWORD";
  role: UserRole;
  accessOrigin?: 'DIRECT' | 'PUBL';
};

function fixture(options?: { existingUsers?: ExistingUser[] }) {
  const sessions: any[] = [];
  const existingUsers = options?.existingUsers ?? [];

  const prisma = {
    adminUser: {
      findMany: jest.fn(async ({ where }: any) => {
        if (where.providerUserId) {
          return existingUsers
            .filter((item) => item.providerUserId === where.providerUserId)
            .map((user) => ({
              ...user,
              createdAt: new Date('2026-04-14T00:00:00.000Z')
            }));
        }

        return [];
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        if (where.loginId) {
          return existingUsers.find((user) => user.loginId === where.loginId) ?? null;
        }

        return null;
      }),
      create: jest.fn(async ({ data }: any) => ({
        id: 'user_1',
        providerUserId: data.providerUserId ?? 'provider',
        loginProvider: data.loginProvider ?? 'PUBL_SSO',
        loginId: data.loginId ?? null,
        email: data.email ?? null,
        role: data.role ?? UserRole.USER,
        accessOrigin: data.accessOrigin ?? 'DIRECT',
      })),
      update: jest.fn(async ({ where, data }: any) => {
        const existing = existingUsers.find((user) => user.id === where.id) ?? existingUsers[0];
        return {
          id: existing?.id ?? 'user_1',
          providerUserId: existing?.providerUserId ?? 'provider',
          loginProvider: data.loginProvider ?? existing?.loginProvider ?? 'PUBL_SSO',
          loginId: existing?.loginId ?? null,
          email: data.email ?? existing?.email ?? null,
          role: data.role ?? existing?.role ?? UserRole.USER,
          accessOrigin: data.accessOrigin ?? existing?.accessOrigin ?? 'DIRECT',
        };
      }),
    },
    session: {
      create: jest.fn(async ({ data }: any) => {
        sessions.push(data);
        return data;
      }),
      deleteMany: jest.fn(async () => ({ count: 1 })),
    },
  };

  const env = {
    publSsoSecret: 'test-secret',
    sessionSecret: 'session-secret',
    cookieMaxAgeSeconds: 86400,
    googleOauthClientId: 'google-client-id',
    googleOauthClientSecret: 'google-client-secret',
    googleOauthRedirectUri: 'http://localhost:3000/v1/auth/google/callback',
    googleOauthAllowedDomain: 'publ.dev',
    superAdminEmails: ['ops@publ.dev'],
    isPlaceholder: (value: string) => value.includes('__REPLACE_ME__'),
  };

  const service = new AuthService(prisma as any, env as any);
  return { service, sessions, prisma };
}

describe('AuthService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates USER session for a valid PUBL SSO login', async () => {
    const { service, sessions, prisma } = fixture();

    const jwt = sign(
      {
        sub: 'publ_user_1',
        tenant_id: 'publ_account_1',
        role: 'PARTNER_ADMIN',
        access_origin: 'PUBL',
      },
      'test-secret',
      {
        algorithm: 'HS256',
        issuer: 'publ',
        audience: 'publ-messaging',
        expiresIn: '2m',
      },
    );

    const token = await service.exchangeSsoToken(jwt);

    expect(token).toBeTruthy();
    expect(sessions).toHaveLength(1);
    expect(prisma.adminUser.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: UserRole.USER,
          loginProvider: 'PUBL_SSO',
          accessOrigin: 'PUBL',
        }),
      }),
    );
  });

  it('preserves PARTNER_ADMIN for an existing PUBL user', async () => {
    const { service, prisma } = fixture({
      existingUsers: [
        {
          id: 'user_partner_1',
          providerUserId: 'publ_user_1',
          role: UserRole.PARTNER_ADMIN,
          accessOrigin: 'PUBL',
        },
      ],
    });

    const jwt = sign(
      {
        sub: 'publ_user_1',
        tenant_id: 'publ_account_1',
        access_origin: 'PUBL',
      },
      'test-secret',
      {
        algorithm: 'HS256',
        issuer: 'publ',
        audience: 'publ-messaging',
        expiresIn: '2m',
      },
    );

    await service.exchangeSsoToken(jwt);

    expect(prisma.adminUser.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: UserRole.PARTNER_ADMIN,
        }),
      }),
    );
  });

  it('creates USER session for a normal Google login', async () => {
    const { service, sessions, prisma } = fixture();

    jest.spyOn(axios, 'post').mockResolvedValue({
      data: {
        id_token: 'google-id-token',
      },
    } as any);

    jest.spyOn(axios, 'get').mockResolvedValue({
      data: {
        aud: 'google-client-id',
        sub: 'google-sub-1',
        email: 'member@publ.dev',
        email_verified: 'true',
        hd: 'publ.dev',
      },
    } as any);

    const token = await service.exchangeGoogleCode('google-auth-code', 'http://localhost:3000/v1/auth/google/callback');

    expect(token).toBeTruthy();
    expect(sessions).toHaveLength(1);
    expect(prisma.adminUser.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: UserRole.USER,
          loginProvider: 'GOOGLE_OAUTH',
          accessOrigin: 'DIRECT',
        }),
      }),
    );
  });

  it('creates SUPER_ADMIN session only for env allowlisted email', async () => {
    const { service, prisma } = fixture();

    jest.spyOn(axios, 'post').mockResolvedValue({
      data: {
        id_token: 'google-id-token',
      },
    } as any);

    jest.spyOn(axios, 'get').mockResolvedValue({
      data: {
        aud: 'google-client-id',
        sub: 'google-sub-ops',
        email: 'ops@publ.dev',
        email_verified: 'true',
        hd: 'publ.dev',
      },
    } as any);

    await service.exchangeGoogleCode('google-auth-code', 'http://localhost:3000/v1/auth/google/callback');

    expect(prisma.adminUser.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: UserRole.SUPER_ADMIN,
          loginProvider: 'GOOGLE_OAUTH',
        }),
      }),
    );
  });

  it('preserves PARTNER_ADMIN for an existing Google user', async () => {
    const { service, prisma } = fixture({
      existingUsers: [
        {
          id: 'user_partner_google',
          providerUserId: 'google:google-sub-2',
          email: 'partner@publ.dev',
          role: UserRole.PARTNER_ADMIN,
          accessOrigin: 'PUBL',
        },
      ],
    });

    jest.spyOn(axios, 'post').mockResolvedValue({
      data: {
        id_token: 'google-id-token',
      },
    } as any);

    jest.spyOn(axios, 'get').mockResolvedValue({
      data: {
        aud: 'google-client-id',
        sub: 'google-sub-2',
        email: 'partner@publ.dev',
        email_verified: 'true',
        hd: 'publ.dev',
      },
    } as any);

    await service.exchangeGoogleCode('google-auth-code', 'http://localhost:3000/v1/auth/google/callback');

    expect(prisma.adminUser.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: UserRole.PARTNER_ADMIN,
          accessOrigin: 'PUBL',
        }),
      }),
    );
  });

  it('creates session for local password login', async () => {
    const { service, sessions } = fixture({
      existingUsers: [
        {
          id: 'user_local_1',
          providerUserId: 'local:test1@vizuo.work',
          loginId: 'test1@vizuo.work',
          email: 'test1@vizuo.work',
          passwordHash: hashPassword('vizuo.work123'),
          role: UserRole.USER,
          accessOrigin: 'DIRECT',
        },
      ],
    });

    const token = await service.exchangePasswordLogin('test1@vizuo.work', 'vizuo.work123');

    expect(token).toBeTruthy();
    expect(sessions).toHaveLength(1);
  });

  it('rejects invalid SSO token', async () => {
    const { service } = fixture();

    await expect(service.exchangeSsoToken('not-a-valid-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
