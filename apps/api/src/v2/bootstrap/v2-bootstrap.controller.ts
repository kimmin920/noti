import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard } from '../../auth/session-auth.guard';
import { SessionRequest } from '../../common/session-request.interface';
import { assertAccountUser } from '../v2-auth.utils';
import { V2_ROUTE_PREFIX } from '../v2.constants';
import { V2BootstrapService } from './v2-bootstrap.service';

@ApiTags('v2-bootstrap')
@ApiCookieAuth('pm_session')
@UseGuards(SessionAuthGuard)
@Controller(`${V2_ROUTE_PREFIX}/bootstrap`)
export class V2BootstrapController {
  constructor(private readonly service: V2BootstrapService) {}

  @Get()
  @ApiOperation({ summary: 'V2 shell bootstrap 데이터' })
  getBootstrap(@Req() req: SessionRequest) {
    return this.service.getBootstrap(assertAccountUser(req));
  }
}
