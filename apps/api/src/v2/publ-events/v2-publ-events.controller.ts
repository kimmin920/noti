import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard } from '../../auth/session-auth.guard';
import { SessionRequest } from '../../common/session-request.interface';
import { assertPublPartnerAdmin } from '../v2-auth.utils';
import { V2_ROUTE_PREFIX } from '../v2.constants';
import { UpsertV2PublEventDto } from './v2-publ-events.dto';
import { V2PublEventsService } from './v2-publ-events.service';

@ApiTags('v2-publ-events')
@ApiCookieAuth('pm_session')
@UseGuards(SessionAuthGuard)
@Controller(`${V2_ROUTE_PREFIX}/publ-events`)
export class V2PublEventsController {
  constructor(private readonly service: V2PublEventsService) {}

  @Get()
  @ApiOperation({ summary: 'Publ 이벤트 카탈로그 목록' })
  list(@Req() req: SessionRequest) {
    assertPublPartnerAdmin(req);
    return this.service.list();
  }

  @Post()
  @ApiOperation({ summary: 'Publ 이벤트 카탈로그 생성' })
  create(@Req() req: SessionRequest, @Body() dto: UpsertV2PublEventDto) {
    assertPublPartnerAdmin(req);
    return this.service.create(dto);
  }

  @Patch(':eventId')
  @ApiOperation({ summary: 'Publ 이벤트 카탈로그 수정' })
  update(@Req() req: SessionRequest, @Param('eventId') eventId: string, @Body() dto: UpsertV2PublEventDto) {
    assertPublPartnerAdmin(req);
    return this.service.update(eventId, dto);
  }
}
