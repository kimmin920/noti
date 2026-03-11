import { BadRequestException, Body, Controller, Get, HttpCode, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../common/public.decorator';
import { SessionRequest } from '../common/session-request.interface';
import { createSessionToken, pickBearerToken } from '../common/utils';
import { EnvService } from '../common/env';
import { AuthService } from './auth.service';
import { SessionAuthGuard } from './session-auth.guard';
import { MeResponseDto, PasswordLoginDto } from './auth.dto';

@ApiTags('auth')
@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly env: EnvService
  ) {}

  private setSessionCookie(res: Response, sessionToken: string): void {
    res.cookie(this.env.cookieName, sessionToken, {
      httpOnly: true,
      secure: this.env.cookieSecure,
      sameSite: this.env.cookieSameSite,
      path: '/',
      maxAge: this.env.cookieMaxAgeSeconds * 1000
    });
  }

  private clearGoogleStateCookie(res: Response): void {
    res.clearCookie(this.env.googleOauthStateCookieName, {
      path: '/',
      sameSite: 'lax',
      secure: this.env.cookieSecure,
      httpOnly: true
    });
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

    this.setSessionCookie(res, sessionToken);
  }

  @Public()
  @Post('password/login')
  @HttpCode(204)
  @ApiOperation({ summary: '테스트용 loginId/password 로그인 후 pm_session 쿠키 발급' })
  @ApiNoContentResponse({ description: 'Session cookie issued' })
  async passwordLogin(
    @Body() dto: PasswordLoginDto,
    @Res({ passthrough: true }) res: Response
  ): Promise<void> {
    const sessionToken = await this.authService.exchangePasswordLogin(dto.loginId, dto.password);
    this.setSessionCookie(res, sessionToken);
  }

  @Public()
  @Get('google/start')
  @ApiOperation({ summary: 'Google OAuth 로그인 시작' })
  googleStart(@Res() res: Response): void {
    const state = createSessionToken();
    res.cookie(this.env.googleOauthStateCookieName, state, {
      httpOnly: true,
      secure: this.env.cookieSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: this.env.googleOauthStateMaxAgeSeconds * 1000
    });

    const authorizeUrl = this.authService.buildGoogleAuthorizeUrl(state);
    res.redirect(302, authorizeUrl);
  }

  @Public()
  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth 콜백 처리 후 pm_session 쿠키 발급' })
  async googleCallback(@Req() req: SessionRequest, @Res() res: Response): Promise<void> {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const expectedState = req.cookies?.[this.env.googleOauthStateCookieName] as string | undefined;

    this.clearGoogleStateCookie(res);

    if (!code) {
      throw new BadRequestException('Google authorization code is required');
    }

    if (!state || !expectedState || state !== expectedState) {
      throw new UnauthorizedException('Invalid OAuth state');
    }

    const sessionToken = await this.authService.exchangeGoogleCode(code);
    this.setSessionCookie(res, sessionToken);
    res.redirect(302, this.env.adminBaseUrl);
  }

  @Post('logout')
  @HttpCode(204)
  @ApiCookieAuth('pm_session')
  @ApiNoContentResponse({ description: 'Session revoked' })
  async logout(@Req() req: SessionRequest, @Res({ passthrough: true }) res: Response): Promise<void> {
    const token = req.cookies?.[this.env.cookieName] as string | undefined;
    await this.authService.revokeSession(token);

    res.clearCookie(this.env.cookieName, {
      path: '/',
      sameSite: this.env.cookieSameSite,
      secure: this.env.cookieSecure,
      httpOnly: true
    });
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
      role: user.role as 'TENANT_ADMIN' | 'OPERATOR'
    };
  }
}
