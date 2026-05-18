import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard } from '../../auth/session-auth.guard';
import { SessionRequest } from '../../common/session-request.interface';
import { assertAccountUser } from '../v2-auth.utils';
import { V2_ROUTE_PREFIX } from '../v2.constants';
import { V2ScheduledSendsService } from './v2-scheduled-sends.service';

@ApiTags('v2-scheduled-sends')
@ApiCookieAuth('pm_session')
@UseGuards(SessionAuthGuard)
@Controller(`${V2_ROUTE_PREFIX}/scheduled-sends`)
export class V2ScheduledSendsController {
  constructor(private readonly service: V2ScheduledSendsService) {}

  @Get()
  @ApiOperation({ summary: 'V2 예약 발송 목록' })
  listUpcoming(@Req() req: SessionRequest, @Query('limit') limit?: string) {
    const sessionUser = assertAccountUser(req);
    return this.service.listUpcoming(sessionUser.userId, { limit });
  }
}
