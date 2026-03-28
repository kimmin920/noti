import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard } from '../../auth/session-auth.guard';
import { SessionRequest } from '../../common/session-request.interface';
import { assertTenantAdmin } from '../v2-auth.utils';
import { V2_ROUTE_PREFIX } from '../v2.constants';
import { V2OpsService } from './v2-ops.service';

@ApiTags('v2-ops')
@ApiCookieAuth('pm_session')
@UseGuards(SessionAuthGuard)
@Controller(`${V2_ROUTE_PREFIX}/ops`)
export class V2OpsController {
  constructor(private readonly service: V2OpsService) {}

  @Get('health')
  @ApiOperation({ summary: 'V2 운영 health 상세' })
  getHealth(@Req() req: SessionRequest) {
    assertTenantAdmin(req);
    return this.service.getHealth();
  }
}
