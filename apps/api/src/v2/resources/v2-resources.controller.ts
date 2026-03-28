import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard } from '../../auth/session-auth.guard';
import { SessionRequest } from '../../common/session-request.interface';
import { assertTenantAdmin } from '../v2-auth.utils';
import { V2_ROUTE_PREFIX } from '../v2.constants';
import { V2ResourcesService } from './v2-resources.service';

@ApiTags('v2-resources')
@ApiCookieAuth('pm_session')
@UseGuards(SessionAuthGuard)
@Controller(`${V2_ROUTE_PREFIX}/resources`)
export class V2ResourcesController {
  constructor(private readonly service: V2ResourcesService) {}

  @Get('summary')
  @ApiOperation({ summary: 'V2 발신 자원 요약' })
  getSummary(@Req() req: SessionRequest) {
    return this.service.getSummary(assertTenantAdmin(req).tenantId);
  }

  @Get('sms')
  @ApiOperation({ summary: 'V2 SMS 발신번호 목록' })
  getSmsResources(@Req() req: SessionRequest) {
    return this.service.getSmsResources(assertTenantAdmin(req).tenantId);
  }

  @Get('kakao')
  @ApiOperation({ summary: 'V2 카카오 채널 목록' })
  getKakaoResources(@Req() req: SessionRequest) {
    return this.service.getKakaoResources(assertTenantAdmin(req).tenantId);
  }
}
