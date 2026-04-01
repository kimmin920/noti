import { BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CookieOptions, Response } from 'express';
import { Public } from '../common/public.decorator';
import { SessionRequest } from '../common/session-request.interface';
import { pickBearerToken } from '../common/utils';
import { EnvService } from '../common/env';
import { AuthService } from './auth.service';
import { GoogleOauthRequestContext, GoogleOauthStateService } from './google-oauth-state.service';
import { SessionAuthGuard } from './session-auth.guard';
import { MeResponseDto, PasswordLoginDto } from './auth.dto';

@ApiTags('auth')
@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly env: EnvService,
    private readonly googleOauthStateService: GoogleOauthStateService
  ) {}

  private setSessionCookie(req: SessionRequest, res: Response, sessionToken: string): void {
    this.clearSessionCookie(req, res);

    const domain = this.resolveCookieDomain(req, this.env.cookieDomain);

    res.cookie(this.env.cookieName, sessionToken, {
      httpOnly: true,
      secure: this.resolveCookieSecure(req, this.env.cookieSecure),
      sameSite: this.env.cookieSameSite,
      domain,
      path: '/',
      maxAge: this.env.cookieMaxAgeSeconds * 1000
    });
  }

  private clearGoogleStateCookie(req: SessionRequest, res: Response): void {
    const cookieName = this.env.googleOauthStateCookieName;
    const baseOptions: CookieOptions = {
      path: '/',
      sameSite: this.env.googleOauthStateCookieSameSite,
      secure: this.resolveCookieSecure(req, this.env.googleOauthStateCookieSecure),
      httpOnly: true
    };

    res.clearCookie(cookieName, baseOptions);

    const legacyDomains = new Set<string>();
    if (this.env.googleOauthStateCookieDomain) {
      legacyDomains.add(this.env.googleOauthStateCookieDomain);
    }
    if (this.env.cookieDomain) {
      legacyDomains.add(this.env.cookieDomain);
    }

    for (const domain of legacyDomains) {
      res.clearCookie(cookieName, {
        ...baseOptions,
        domain
      });
    }
  }

  private clearSessionCookie(req: SessionRequest, res: Response): void {
    const cookieName = this.env.cookieName;
    const baseOptions: CookieOptions = {
      path: '/',
      sameSite: this.env.cookieSameSite,
      secure: this.resolveCookieSecure(req, this.env.cookieSecure),
      httpOnly: true
    };

    res.clearCookie(cookieName, baseOptions);

    if (this.env.cookieDomain) {
      res.clearCookie(cookieName, {
        ...baseOptions,
        domain: this.env.cookieDomain
      });
    }
  }

  private resolveCookieSecure(req: SessionRequest, preferredSecure: boolean): boolean {
    if (!preferredSecure) {
      return false;
    }

    const forwardedProto = (req.get('x-forwarded-proto') ?? '')
      .split(',')[0]
      ?.trim()
      .toLowerCase();

    return req.secure || req.protocol === 'https' || forwardedProto === 'https';
  }

  private resolveCookieDomain(req: SessionRequest, configuredDomain?: string): string | undefined {
    if (!configuredDomain) {
      return undefined;
    }

    const host = this.getRequestHost(req);
    const normalizedDomain = configuredDomain.replace(/^\./, '').toLowerCase();

    if (host === normalizedDomain || host.endsWith(`.${normalizedDomain}`)) {
      return configuredDomain;
    }

    return undefined;
  }

  private getRequestHost(req: SessionRequest): string {
    const forwardedHost = (req.get('x-forwarded-host') ?? '')
      .split(',')[0]
      ?.trim();
    const hostHeader = forwardedHost || (req.get('host') ?? '');
    return hostHeader.replace(/:\d+$/, '').toLowerCase();
  }

  private getRequestOrigin(req: SessionRequest): string {
    const forwardedProto = (req.get('x-forwarded-proto') ?? '')
      .split(',')[0]
      ?.trim()
      .toLowerCase();
    const protocol = forwardedProto || req.protocol || (req.secure ? 'https' : 'http');
    const forwardedHost = (req.get('x-forwarded-host') ?? '')
      .split(',')[0]
      ?.trim();
    const host = forwardedHost || (req.get('host') ?? '');

    return `${protocol}://${host}`;
  }

  private assertLocalPasswordLoginEnabled(): void {
    if (!this.env.localPasswordLoginEnabled) {
      throw new ForbiddenException('Local password login is disabled');
    }
  }

  private normalizeOrigin(candidate: string): string | null {
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
      }
      return parsed.origin;
    } catch {
      return null;
    }
  }

  private deriveAdminOriginFromApiOrigin(apiOrigin: string): string | null {
    const parsed = new URL(apiOrigin);

    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return `${parsed.protocol}//${parsed.hostname}:3001`;
    }

    if (parsed.hostname.startsWith('api-')) {
      return `${parsed.protocol}//${parsed.hostname.replace(/^api-/, 'admin-')}`;
    }

    if (parsed.hostname.startsWith('api.')) {
      return `${parsed.protocol}//${parsed.hostname.replace(/^api\./, 'admin.')}`;
    }

    return null;
  }

  private resolveGoogleOauthContext(req: SessionRequest): GoogleOauthRequestContext {
    const apiOrigin = this.getRequestOrigin(req);
    const redirectUri = `${apiOrigin}/v1/auth/google/callback`;
    const allowedAdminOrigins = new Set<string>();
    const configuredAdminOrigin = this.normalizeOrigin(this.env.adminBaseUrl);
    const derivedAdminOrigin = this.deriveAdminOriginFromApiOrigin(apiOrigin);

    if (configuredAdminOrigin) {
      allowedAdminOrigins.add(configuredAdminOrigin);
    }

    if (derivedAdminOrigin) {
      allowedAdminOrigins.add(derivedAdminOrigin);
    }

    for (const origin of this.env.corsOrigins ?? []) {
      const normalizedOrigin = this.normalizeOrigin(origin);
      if (normalizedOrigin) {
        allowedAdminOrigins.add(normalizedOrigin);
      }
    }

    const rawReturnTo = typeof req.query.returnTo === 'string'
      ? req.query.returnTo
      : req.get('referer') ?? '';

    if (rawReturnTo) {
      try {
        const parsedReturnTo = new URL(rawReturnTo);
        if (allowedAdminOrigins.has(parsedReturnTo.origin)) {
          return {
            redirectUri,
            returnTo: parsedReturnTo.toString()
          };
        }
      } catch {
        // Ignore invalid user-provided return URLs and fall back to a known-safe admin origin.
      }
    }

    const fallbackOrigin = derivedAdminOrigin || configuredAdminOrigin || this.env.adminBaseUrl;
    return {
      redirectUri,
      returnTo: fallbackOrigin
    };
  }

  @Public()
  @Post('sso/exchange')
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publ SSO JWT(HS256) 교환 후 pm_session 쿠키 발급' })
  @ApiNoContentResponse({ description: 'Session cookie issued' })
  async exchange(@Req() req: SessionRequest, @Res({ passthrough: true }) res: Response): Promise<void> {
    const token = pickBearerToken(req.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Authorization Bearer token is required');
    }

    const sessionToken = await this.authService.exchangeSsoToken(token);

    this.setSessionCookie(req, res, sessionToken);
  }

  @Public()
  @Post('password/login')
  @HttpCode(204)
  @ApiOperation({ summary: '테스트용 loginId/password 로그인 후 pm_session 쿠키 발급' })
  @ApiNoContentResponse({ description: 'Session cookie issued' })
  async passwordLogin(
    @Req() req: SessionRequest,
    @Body() dto: PasswordLoginDto,
    @Res({ passthrough: true }) res: Response
  ): Promise<void> {
    this.assertLocalPasswordLoginEnabled();
    const sessionToken = await this.authService.exchangePasswordLogin(dto.loginId, dto.password);
    this.setSessionCookie(req, res, sessionToken);
  }

  @Public()
  @Get('google/start')
  @ApiOperation({ summary: 'Google OAuth 로그인 시작' })
  googleStart(@Res() res: Response, @Req() req: SessionRequest): void {
    const context = this.resolveGoogleOauthContext(req);
    const state = this.googleOauthStateService.issue(req, context);

    this.clearGoogleStateCookie(req, res);

    const authorizeUrl = this.authService.buildGoogleAuthorizeUrl(state, context.redirectUri);
    res.redirect(302, authorizeUrl);
  }

  @Public()
  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth 콜백 처리 후 pm_session 쿠키 발급' })
  async googleCallback(@Req() req: SessionRequest, @Res() res: Response): Promise<void> {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';

    this.clearGoogleStateCookie(req, res);

    if (!code) {
      throw new BadRequestException('Google authorization code is required');
    }

    const oauthContext = state
      ? this.googleOauthStateService.consume(state, req)
      : null;

    if (!oauthContext) {
      throw new UnauthorizedException('Invalid OAuth state');
    }

    const previousSessionToken = req.cookies?.[this.env.cookieName] as string | undefined;
    await this.authService.revokeSession(previousSessionToken);

    const sessionToken = await this.authService.exchangeGoogleCode(code, oauthContext.redirectUri);
    this.setSessionCookie(req, res, sessionToken);
    res.redirect(302, oauthContext.returnTo);
  }

  @Post('logout')
  @HttpCode(204)
  @ApiCookieAuth('pm_session')
  @ApiNoContentResponse({ description: 'Session revoked' })
  async logout(@Req() req: SessionRequest, @Res({ passthrough: true }) res: Response): Promise<void> {
    const token = req.cookies?.[this.env.cookieName] as string | undefined;
    await this.authService.revokeSession(token);

    this.clearSessionCookie(req, res);
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  @ApiCookieAuth('pm_session')
  @ApiOkResponse({ type: MeResponseDto })
  me(@Req() req: SessionRequest): MeResponseDto {
    const user = req.sessionUser;
    if (!user) {
      throw new UnauthorizedException();
    }

    return {
      tenantId: user.tenantId,
      userId: user.userId,
      publUserId: user.publUserId,
      email: user.email ?? null,
      loginProvider: user.publUserId.startsWith('google:')
        ? 'GOOGLE_OAUTH'
        : user.publUserId.startsWith('local:')
          ? 'LOCAL_PASSWORD'
          : 'PUBL_SSO',
      role: user.role as 'TENANT_ADMIN' | 'PARTNER_ADMIN' | 'SUPER_ADMIN',
      accessOrigin: (user.accessOrigin === 'PUBL' ? 'PUBL' : 'DIRECT') as 'DIRECT' | 'PUBL',
      partnerScope: user.partnerScope === 'DIRECT' || user.partnerScope === 'PUBL' ? user.partnerScope : null
    };
  }
}
