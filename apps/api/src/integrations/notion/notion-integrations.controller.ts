import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/public.decorator';
import { EnvService } from '../../common/env';
import { SessionRequest } from '../../common/session-request.interface';
import { assertAccountUser } from '../../v2/v2-auth.utils';
import { SyncNotionRecipientsDto } from './notion-integrations.dto';
import { NotionIntegrationsService } from './notion-integrations.service';
import { NotionOauthStateService } from './notion-oauth-state.service';

@ApiTags('notion-integrations')
@Controller('v1/integrations/notion')
export class NotionIntegrationsController {
  constructor(
    private readonly env: EnvService,
    private readonly service: NotionIntegrationsService,
    private readonly stateService: NotionOauthStateService
  ) {}

  @Get('start')
  @ApiCookieAuth('pm_session')
  @ApiOperation({ summary: 'Notion OAuth 연결 시작' })
  start(@Req() req: SessionRequest, @Res() res: Response): void {
    const sessionUser = assertAccountUser(req);
    const redirectUri = this.env.notionOauthRedirectUri || `${this.getRequestOrigin(req)}/v1/integrations/notion/callback`;
    const returnTo = this.resolveReturnTo(req);
    const state = this.stateService.issue(req, {
      ownerUserId: sessionUser.userId,
      redirectUri,
      returnTo
    });

    res.redirect(302, this.service.buildAuthorizeUrl(state, redirectUri));
  }

  @Public()
  @Get('callback')
  @ApiOperation({ summary: 'Notion OAuth 콜백 처리' })
  async callback(@Req() req: SessionRequest, @Res() res: Response): Promise<void> {
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const context = state ? this.stateService.consume(state, req) : null;

    if (!context) {
      res.redirect(302, this.appendNotionResult(this.fallbackReturnTo(), 'error'));
      return;
    }

    const error = typeof req.query.error === 'string' ? req.query.error : '';
    if (error) {
      res.redirect(302, this.appendNotionResult(context.returnTo, 'error'));
      return;
    }

    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (!code) {
      res.redirect(302, this.appendNotionResult(context.returnTo, 'error'));
      return;
    }

    try {
      await this.service.completeOauth(context.ownerUserId, code, context.redirectUri);
      res.redirect(302, this.appendNotionResult(context.returnTo, 'connected'));
    } catch {
      res.redirect(302, this.appendNotionResult(context.returnTo, 'error'));
    }
  }

  @Get('status')
  @ApiCookieAuth('pm_session')
  @ApiOperation({ summary: 'Notion 연결 상태 조회' })
  status(@Req() req: SessionRequest) {
    const sessionUser = assertAccountUser(req);
    return this.service.getStatus(sessionUser.userId);
  }

  @Get('data-sources')
  @ApiCookieAuth('pm_session')
  @ApiOperation({ summary: 'Notion 수신자 후보 데이터베이스 조회' })
  dataSources(@Req() req: SessionRequest) {
    const sessionUser = assertAccountUser(req);
    return this.service.listDataSources(sessionUser.userId);
  }

  @Get('data-sources/:dataSourceId/preview')
  @ApiCookieAuth('pm_session')
  @ApiOperation({ summary: 'Notion 데이터베이스 미리보기 조회' })
  previewDataSource(@Req() req: SessionRequest, @Param('dataSourceId') dataSourceId: string) {
    const sessionUser = assertAccountUser(req);
    return this.service.previewDataSource(sessionUser.userId, dataSourceId);
  }

  @Post('sync')
  @ApiCookieAuth('pm_session')
  @ApiOperation({ summary: 'Notion 데이터베이스를 수신자 목록으로 동기화' })
  sync(@Req() req: SessionRequest, @Body() dto: SyncNotionRecipientsDto) {
    const sessionUser = assertAccountUser(req);
    return this.service.syncRecipients(sessionUser.userId, dto);
  }

  private resolveReturnTo(req: SessionRequest): string {
    const rawReturnTo = typeof req.query.returnTo === 'string'
      ? req.query.returnTo
      : req.get('referer') ?? '';
    const allowedOrigins = new Set<string>();

    for (const value of [this.env.adminBaseUrl, ...this.env.corsOrigins]) {
      const origin = this.normalizeOrigin(value);
      if (origin) {
        allowedOrigins.add(origin);
      }
    }

    if (rawReturnTo) {
      try {
        const parsedReturnTo = new URL(rawReturnTo);
        if (allowedOrigins.has(parsedReturnTo.origin)) {
          return parsedReturnTo.toString();
        }
      } catch {
        // Fall back to the known admin URL.
      }
    }

    return this.fallbackReturnTo();
  }

  private fallbackReturnTo(): string {
    return new URL('/recipients', this.env.adminBaseUrl).toString();
  }

  private appendNotionResult(returnTo: string, result: 'connected' | 'error'): string {
    const url = new URL(returnTo);
    url.searchParams.set('notion', result);
    return url.toString();
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

  private normalizeOrigin(value: string): string | null {
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
      }
      return parsed.origin;
    } catch {
      return null;
    }
  }
}
