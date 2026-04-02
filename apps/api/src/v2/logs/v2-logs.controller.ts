import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard } from '../../auth/session-auth.guard';
import { SessionRequest } from '../../common/session-request.interface';
import { assertTenantAdmin } from '../v2-auth.utils';
import { V2_ROUTE_PREFIX } from '../v2.constants';
import { V2LogsService } from './v2-logs.service';

@ApiTags('v2-logs')
@ApiCookieAuth('pm_session')
@UseGuards(SessionAuthGuard)
@Controller(`${V2_ROUTE_PREFIX}/logs`)
export class V2LogsController {
  constructor(private readonly service: V2LogsService) {}

  @Get()
  @ApiOperation({ summary: 'V2 발송 로그 목록' })
  list(
    @Req() req: SessionRequest,
    @Query('status') status?: string,
    @Query('eventKey') eventKey?: string,
    @Query('channel') channel?: string,
    @Query('limit') limit?: string
  ) {
    const sessionUser = assertTenantAdmin(req);
    return this.service.list(sessionUser.tenantId, sessionUser.userId, {
      status,
      eventKey,
      channel,
      limit
    });
  }

  @Get(':requestId')
  @ApiOperation({ summary: 'V2 발송 로그 상세' })
  getDetail(@Req() req: SessionRequest, @Param('requestId') requestId: string) {
    const sessionUser = assertTenantAdmin(req);
    return this.service.getDetail(sessionUser.tenantId, sessionUser.userId, requestId);
  }
}
