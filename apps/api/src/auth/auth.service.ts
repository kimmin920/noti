import { Injectable, UnauthorizedException } from '@nestjs/common';
import axios from 'axios';
import { JwtPayload, verify } from 'jsonwebtoken';
import { PrismaService } from '../database/prisma.service';
import { EnvService } from '../common/env';
import { createSessionToken, hashToken, verifyPassword } from '../common/utils';

interface PublJwtPayload extends JwtPayload {
  iss: string;
  aud: string;
  sub: string;
  tenant_id: string;
  role: 'TENANT_ADMIN' | 'OPERATOR';
}

interface GoogleTokenResponse {
  id_token?: string;
}

interface GoogleTokenInfoResponse {
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: string;
  hd?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly env: EnvService
  ) {}

  assertGoogleOauthConfigured(): void {
    if (
      this.env.isPlaceholder(this.env.googleOauthClientId) ||
      this.env.isPlaceholder(this.env.googleOauthClientSecret) ||
      this.env.isPlaceholder(this.env.googleOauthDefaultTenantId)
    ) {
      throw new UnauthorizedException('Google OAuth is not configured');
    }
  }

  buildGoogleAuthorizeUrl(state: string, redirectUri: string): string {
    this.assertGoogleOauthConfigured();

    const params = new URLSearchParams({
      client_id: this.env.googleOauthClientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account'
    });

    if (this.env.googleOauthAllowedDomain) {
      params.set('hd', this.env.googleOauthAllowedDomain);
    }

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeSsoToken(rawJwt: string): Promise<string> {
    if (this.env.isPlaceholder(this.env.publSsoSecret)) {
      throw new UnauthorizedException('PUBL_SSO_HS256_SECRET is not configured');
    }

    let payload: PublJwtPayload;

    try {
      payload = verify(rawJwt, this.env.publSsoSecret, {
        algorithms: ['HS256'],
        issuer: 'publ',
        audience: 'publ-messaging'
      }) as PublJwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid SSO token');
    }

    if (payload.role !== 'TENANT_ADMIN' && payload.role !== 'OPERATOR') {
      throw new UnauthorizedException('TENANT_ADMIN or OPERATOR role is required');
    }

    const tenant = await this.prisma.tenant.upsert({
      where: { id: payload.tenant_id },
      update: {},
      create: {
        id: payload.tenant_id,
        name: `Tenant ${payload.tenant_id}`
      }
    });

    const user = await this.prisma.adminUser.upsert({
      where: {
        tenantId_publUserId: {
          tenantId: tenant.id,
          publUserId: payload.sub
        }
      },
      update: {
        role: payload.role,
        email: null
      },
      create: {
        tenantId: tenant.id,
        publUserId: payload.sub,
        email: null,
        role: payload.role
      }
    });

    return this.issueSession(user.id, tenant.id);
  }

  async exchangePasswordLogin(loginId: string, password: string): Promise<string> {
    const normalizedLoginId = loginId.trim().toLowerCase();

    if (!normalizedLoginId || !password) {
      throw new UnauthorizedException('loginId and password are required');
    }

    const user = await this.prisma.adminUser.findFirst({
      where: {
        loginId: normalizedLoginId
      }
    });

    if (!user) {
      throw new UnauthorizedException('Invalid loginId or password');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Invalid loginId or password');
    }

    if (!verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid loginId or password');
    }

    return this.issueSession(user.id, user.tenantId);
  }

  async exchangeGoogleCode(rawCode: string, redirectUri: string): Promise<string> {
    this.assertGoogleOauthConfigured();

    let idToken: string;

    try {
      const tokenResponse = await axios.post<GoogleTokenResponse>(
        'https://oauth2.googleapis.com/token',
        new URLSearchParams({
          code: rawCode,
          client_id: this.env.googleOauthClientId,
          client_secret: this.env.googleOauthClientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      idToken = tokenResponse.data?.id_token ?? '';
    } catch {
      throw new UnauthorizedException('Failed to exchange Google authorization code');
    }

    if (!idToken) {
      throw new UnauthorizedException('Google id_token is missing');
    }

    let tokenInfo: GoogleTokenInfoResponse;
    try {
      const tokenInfoResponse = await axios.get<GoogleTokenInfoResponse>(
        'https://oauth2.googleapis.com/tokeninfo',
        {
          params: {
            id_token: idToken
          }
        }
      );
      tokenInfo = tokenInfoResponse.data;
    } catch {
      throw new UnauthorizedException('Failed to verify Google id_token');
    }

    if (tokenInfo.aud !== this.env.googleOauthClientId) {
      throw new UnauthorizedException('Google id_token audience mismatch');
    }

    if (tokenInfo.email_verified !== 'true') {
      throw new UnauthorizedException('Google email is not verified');
    }

    if (this.env.googleOauthAllowedDomain && tokenInfo.hd !== this.env.googleOauthAllowedDomain) {
      throw new UnauthorizedException('Google workspace domain is not allowed');
    }

    if (!tokenInfo.sub) {
      throw new UnauthorizedException('Google subject(sub) is missing');
    }

    const normalizedEmail = tokenInfo.email?.toLowerCase() ?? '';
    const isOperator = normalizedEmail
      ? this.env.googleOauthOperatorEmails.includes(normalizedEmail)
      : false;

    if (!isOperator) {
      throw new UnauthorizedException('Google OAuth is only allowed for OPERATOR accounts');
    }

    const tenant = await this.prisma.tenant.upsert({
      where: {
        id: this.env.googleOauthOperatorTenantId
      },
      update: {},
      create: {
        id: this.env.googleOauthOperatorTenantId,
        name: this.env.googleOauthOperatorTenantName
      }
    });

    const user = await this.prisma.adminUser.upsert({
      where: {
        tenantId_publUserId: {
          tenantId: tenant.id,
          publUserId: `google:${tokenInfo.sub}`
        }
      },
      update: {
        email: normalizedEmail || null,
        role: 'OPERATOR'
      },
      create: {
        tenantId: tenant.id,
        publUserId: `google:${tokenInfo.sub}`,
        email: normalizedEmail || null,
        role: 'OPERATOR'
      }
    });

    return this.issueSession(user.id, tenant.id);
  }

  async revokeSession(rawToken?: string): Promise<void> {
    if (!rawToken) {
      return;
    }

    const tokenHash = hashToken(rawToken, this.env.sessionSecret);
    await this.prisma.session.deleteMany({ where: { tokenHash } });
  }

  private async issueSession(userId: string, tenantId: string): Promise<string> {
    const token = createSessionToken();
    const tokenHash = hashToken(token, this.env.sessionSecret);
    const expiresAt = new Date(Date.now() + this.env.cookieMaxAgeSeconds * 1000);

    await this.prisma.session.create({
      data: {
        tokenHash,
        userId,
        tenantId,
        expiresAt
      }
    });

    return token;
  }
}
