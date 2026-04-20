import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard } from '../../auth/session-auth.guard';
import { SessionRequest } from '../../common/session-request.interface';
import { assertAccountUser } from '../v2-auth.utils';
import { V2_ROUTE_PREFIX } from '../v2.constants';
import { V2DashboardService } from './v2-dashboard.service';

@ApiTags('v2-dashboard')
@ApiCookieAuth('pm_session')
@UseGuards(SessionAuthGuard)
@Controller(`${V2_ROUTE_PREFIX}/dashboard`)
export class V2DashboardController {
  constructor(private readonly service: V2DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'V2 dashboard 전용 요약 데이터' })
  getDashboard(@Req() req: SessionRequest) {
    return this.service.getDashboard(assertAccountUser(req));
  }
}
