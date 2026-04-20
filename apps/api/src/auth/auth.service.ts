import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import axios from 'axios';
import { JwtPayload, verify } from 'jsonwebtoken';
import { PrismaService } from '../database/prisma.service';
import { EnvService } from '../common/env';
import { createSessionToken, hashToken, verifyPassword } from '../common/utils';

interface PublJwtPayload extends JwtPayload {
  iss: string;
  aud: string;
  sub: string;
  role?: string;
  access_origin?: 'DIRECT' | 'PUBL';
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
      this.env.isPlaceholder(this.env.googleOauthClientSecret)
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

    if (!payload.sub?.trim()) {
      throw new UnauthorizedException('PUBL subject(sub) is missing');
    }

    const providerUserId = payload.sub.trim();
    const existingUser = await this.findUserByProviderUserId(providerUserId);
    const accessOrigin = existingUser?.accessOrigin ?? (payload.access_origin === 'DIRECT' ? 'DIRECT' : 'PUBL');
    const role = this.resolveRuntimeRole(existingUser?.role ?? null, null);

    const user = existingUser
      ? await this.prisma.adminUser.update({
          where: {
            id: existingUser.id
          },
          data: {
            role,
            email: null,
            loginProvider: 'PUBL_SSO',
            accessOrigin
          }
        })
      : await this.prisma.adminUser.create({
          data: {
            providerUserId,
            loginProvider: 'PUBL_SSO',
            email: null,
            role,
            accessOrigin
          }
        });

    return this.issueSession(user.id);
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

    return this.issueSession(user.id);
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
    const providerUserId = `google:${tokenInfo.sub}`;
    const existingUser = await this.findUserByProviderUserId(providerUserId);
    const role = this.resolveRuntimeRole(existingUser?.role ?? null, normalizedEmail || null);
    const accessOrigin = existingUser?.accessOrigin ?? 'DIRECT';

    const user = existingUser
      ? await this.prisma.adminUser.update({
          where: {
            id: existingUser.id
          },
          data: {
            email: normalizedEmail || null,
            loginProvider: 'GOOGLE_OAUTH',
            role,
            accessOrigin
          }
        })
      : await this.prisma.adminUser.create({
          data: {
            providerUserId,
            loginProvider: 'GOOGLE_OAUTH',
            email: normalizedEmail || null,
            role,
            accessOrigin
          }
        });

    return this.issueSession(user.id);
  }

  async revokeSession(rawToken?: string): Promise<void> {
    if (!rawToken) {
      return;
    }

    const tokenHash = hashToken(rawToken, this.env.sessionSecret);
    await this.prisma.session.deleteMany({ where: { tokenHash } });
  }

  private async issueSession(userId: string): Promise<string> {
    const token = createSessionToken();
    const tokenHash = hashToken(token, this.env.sessionSecret);
    const expiresAt = new Date(Date.now() + this.env.cookieMaxAgeSeconds * 1000);

    await this.prisma.session.create({
      data: {
        tokenHash,
        userId,
        expiresAt
      }
    });

    return token;
  }

  private async findUserByProviderUserId(providerUserId: string) {
    const users = await this.prisma.adminUser.findMany({
      where: { providerUserId }
    });

    if (users.length === 0) {
      return null;
    }

    users.sort((left, right) => {
      return (
        this.roleRank(right.role) - this.roleRank(left.role) ||
        this.accessOriginRank(right.accessOrigin) - this.accessOriginRank(left.accessOrigin) ||
        right.createdAt.getTime() - left.createdAt.getTime() ||
        right.id.localeCompare(left.id)
      );
    });

    return users[0];
  }

  private resolveRuntimeRole(currentRole: UserRole | null, email: string | null): UserRole {
    const normalizedEmail = email?.trim().toLowerCase() ?? '';
    if (normalizedEmail && this.env.superAdminEmails.includes(normalizedEmail)) {
      return UserRole.SUPER_ADMIN;
    }

    if (currentRole === UserRole.PARTNER_ADMIN) {
      return UserRole.PARTNER_ADMIN;
    }

    return UserRole.USER;
  }

  private roleRank(role: UserRole): number {
    switch (role) {
      case UserRole.SUPER_ADMIN:
        return 3;
      case UserRole.PARTNER_ADMIN:
        return 2;
      default:
        return 1;
    }
  }

  private accessOriginRank(accessOrigin: 'DIRECT' | 'PUBL'): number {
    return accessOrigin === 'PUBL' ? 1 : 0;
  }
}
