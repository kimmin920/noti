import { Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard } from '../../../auth/session-auth.guard';
import { SessionRequest } from '../../../common/session-request.interface';
import { CreateManualAlimtalkRequestDto } from '../../../message-requests/message-requests.dto';
import { assertAccountUser } from '../../v2-auth.utils';
import { V2_ROUTE_PREFIX } from '../../v2.constants';
import { V2KakaoSendService } from './v2-kakao-send.service';

@ApiTags('v2-send-kakao')
@ApiCookieAuth('pm_session')
@UseGuards(SessionAuthGuard)
@Controller(`${V2_ROUTE_PREFIX}/send/kakao`)
export class V2KakaoSendController {
  constructor(private readonly service: V2KakaoSendService) {}

  @Get('readiness')
  @ApiOperation({ summary: 'V2 알림톡 발송 readiness' })
  getReadiness(@Req() req: SessionRequest) {
    const sessionUser = assertAccountUser(req);
    return this.service.getReadiness(sessionUser.userId);
  }

  @Get('options')
  @ApiOperation({ summary: 'V2 알림톡 발송 옵션 조회' })
  getOptions(@Req() req: SessionRequest) {
    return this.service.getOptions(assertAccountUser(req));
  }

  @Post('requests')
  @HttpCode(202)
  @ApiOperation({ summary: 'V2 직접 알림톡 발송 요청 접수' })
  createRequest(@Req() req: SessionRequest, @Body() dto: CreateManualAlimtalkRequestDto) {
    const sessionUser = assertAccountUser(req);
    return this.service.createRequest(sessionUser.userId, dto);
  }

  @Get('requests/:requestId')
  @ApiOperation({ summary: 'V2 알림톡 발송 요청 상태 조회' })
  getRequestStatus(@Req() req: SessionRequest, @Param('requestId') requestId: string) {
    return this.service.getRequestStatus(assertAccountUser(req).userId, requestId);
  }
}
