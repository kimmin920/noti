import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Param } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard } from '../../auth/session-auth.guard';
import { SessionRequest } from '../../common/session-request.interface';
import { assertPartnerAdmin } from '../v2-auth.utils';
import { V2_ROUTE_PREFIX } from '../v2.constants';
import { V2PartnerService } from './v2-partner.service';

@ApiTags('v2-partner')
@ApiCookieAuth('pm_session')
@UseGuards(SessionAuthGuard)
@Controller(`${V2_ROUTE_PREFIX}/partner`)
export class V2PartnerController {
  constructor(private readonly service: V2PartnerService) {}

  @Get('overview')
  @ApiOperation({ summary: 'PARTNER_ADMIN용 협업 현황 overview' })
  getOverview(@Req() req: SessionRequest) {
    return this.service.getOverview(assertPartnerAdmin(req));
  }

  @Get('clients/:clientId')
  @ApiOperation({ summary: 'PARTNER_ADMIN용 협업 이용처 상세' })
  getClientDetail(@Req() req: SessionRequest, @Param('clientId') clientId: string) {
    return this.service.getClientDetail(assertPartnerAdmin(req), clientId);
  }
}
