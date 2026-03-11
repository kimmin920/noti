import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { SessionRequest } from '../common/session-request.interface';
import { EventRulesService } from './event-rules.service';
import { UpsertEventRuleDto } from './event-rules.dto';

@ApiTags('event-rules')
@ApiCookieAuth('pm_session')
@UseGuards(SessionAuthGuard)
@Controller('v1/event-rules')
export class EventRulesController {
  constructor(private readonly service: EventRulesService) {}

  @Get()
  @ApiOperation({ summary: '이벤트 규칙 목록' })
  list(@Req() req: SessionRequest) {
    return this.service.list(req.sessionUser!.tenantId);
  }

  @Get(':eventRuleId')
  @ApiOperation({ summary: '이벤트 규칙 상세' })
  detail(@Req() req: SessionRequest, @Param('eventRuleId') eventRuleId: string) {
    return this.service.detail(req.sessionUser!.tenantId, eventRuleId);
  }

  @Post('upsert')
  @ApiOperation({ summary: '이벤트 규칙 저장/수정' })
  upsert(@Req() req: SessionRequest, @Body() dto: UpsertEventRuleDto) {
    return this.service.upsert(req.sessionUser!.tenantId, req.sessionUser!.userId, dto);
  }
}
