import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard } from '../../auth/session-auth.guard';
import { SessionRequest } from '../../common/session-request.interface';
import { CreateManagedUserDto } from '../../users/users.dto';
import { assertAccountUser } from '../v2-auth.utils';
import { V2_ROUTE_PREFIX } from '../v2.constants';
import { V2RecipientsService } from './v2-recipients.service';

@ApiTags('v2-recipients')
@ApiCookieAuth('pm_session')
@UseGuards(SessionAuthGuard)
@Controller(`${V2_ROUTE_PREFIX}/recipients`)
export class V2RecipientsController {
  constructor(private readonly service: V2RecipientsService) {}

  @Get()
  @ApiOperation({ summary: '수신자 관리 목록 조회' })
  listRecipients(@Req() req: SessionRequest) {
    const sessionUser = assertAccountUser(req);
    return this.service.listRecipients(sessionUser.userId);
  }

  @Post()
  @ApiOperation({ summary: '수신자 직접 추가 또는 수정' })
  createRecipient(@Req() req: SessionRequest, @Body() dto: CreateManagedUserDto) {
    const sessionUser = assertAccountUser(req);
    return this.service.createRecipient(sessionUser.userId, dto);
  }
}
