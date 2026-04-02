import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard } from '../../auth/session-auth.guard';
import { SessionRequest } from '../../common/session-request.interface';
import { UpsertEventRuleDto } from '../../event-rules/event-rules.dto';
import { assertPartnerAdmin } from '../v2-auth.utils';
import { V2_ROUTE_PREFIX } from '../v2.constants';
import { V2EventsService } from './v2-events.service';

@ApiTags('v2-events')
@ApiCookieAuth('pm_session')
@UseGuards(SessionAuthGuard)
@Controller(`${V2_ROUTE_PREFIX}/events`)
export class V2EventsController {
  constructor(private readonly service: V2EventsService) {}

  @Get()
  @ApiOperation({ summary: 'V2 이벤트 규칙 목록과 옵션 조회' })
  list(@Req() req: SessionRequest) {
    const sessionUser = assertPartnerAdmin(req);
    return this.service.list(sessionUser.tenantId, sessionUser.userId);
  }

  @Post()
  @ApiOperation({ summary: 'V2 이벤트 규칙 생성' })
  create(@Req() req: SessionRequest, @Body() dto: UpsertEventRuleDto) {
    const sessionUser = assertPartnerAdmin(req);
    return this.service.create(sessionUser.tenantId, sessionUser.userId, sessionUser.userId, dto);
  }

  @Patch(':eventRuleId')
  @ApiOperation({ summary: 'V2 이벤트 규칙 수정' })
  updateById(@Req() req: SessionRequest, @Param('eventRuleId') eventRuleId: string, @Body() dto: UpsertEventRuleDto) {
    const sessionUser = assertPartnerAdmin(req);
    return this.service.updateById(sessionUser.tenantId, sessionUser.userId, sessionUser.userId, eventRuleId, dto);
  }
}
