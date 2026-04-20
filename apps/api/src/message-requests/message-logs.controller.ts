import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { SessionRequest } from '../common/session-request.interface';
import { MessageRequestsService } from './message-requests.service';

@ApiTags('message-logs')
@ApiCookieAuth('pm_session')
@UseGuards(SessionAuthGuard)
@Controller('v1/admin/message-requests')
export class MessageLogsController {
  constructor(private readonly service: MessageRequestsService) {}

  @Get()
  @ApiOperation({ summary: '발송 로그 목록/필터' })
  list(
    @Req() req: SessionRequest,
    @Query('status') status?: string,
    @Query('eventKey') eventKey?: string
  ) {
    return this.service.listForUser(req.sessionUser!.userId, { status, eventKey });
  }

  @Get(':requestId')
  @ApiOperation({ summary: '발송 로그 상세' })
  detail(@Req() req: SessionRequest, @Param('requestId') requestId: string) {
    return this.service.getByIdForUser(req.sessionUser!.userId, requestId);
  }
}
