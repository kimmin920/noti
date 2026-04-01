import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { SessionAuthGuard } from '../../auth/session-auth.guard';
import { SessionRequest } from '../../common/session-request.interface';
import { ReviewSenderNumberDto } from '../../sender-numbers/sender-numbers.dto';
import { assertOperator, assertTenantAdmin } from '../v2-auth.utils';
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

  @Get('sender-number-applications')
  @ApiOperation({ summary: '운영자용 발신번호 신청 목록' })
  getSenderNumberApplications(@Req() req: SessionRequest) {
    assertOperator(req);
    return this.service.getSenderNumberApplications();
  }

  @Post('sender-number-applications/:senderNumberId/approve')
  @ApiOperation({ summary: '운영자용 발신번호 승인' })
  approveSenderNumberApplication(
    @Req() req: SessionRequest,
    @Param('senderNumberId') senderNumberId: string,
    @Body() dto: ReviewSenderNumberDto
  ) {
    const operator = assertOperator(req);
    return this.service.approveSenderNumberApplication(senderNumberId, operator.userId, dto.memo);
  }

  @Post('sender-number-applications/:senderNumberId/reject')
  @ApiOperation({ summary: '운영자용 발신번호 거절' })
  rejectSenderNumberApplication(
    @Req() req: SessionRequest,
    @Param('senderNumberId') senderNumberId: string,
    @Body() dto: ReviewSenderNumberDto
  ) {
    const operator = assertOperator(req);
    return this.service.rejectSenderNumberApplication(senderNumberId, operator.userId, dto.memo);
  }

  @Get('sender-number-applications/:senderNumberId/attachments/:kind')
  @ApiOperation({ summary: '운영자용 발신번호 첨부 다운로드' })
  async downloadSenderNumberAttachment(
    @Req() req: SessionRequest,
    @Param('senderNumberId') senderNumberId: string,
    @Param('kind') kind: string,
    @Res() res: Response
  ) {
    assertOperator(req);

    if (
      kind !== 'telecom' &&
      kind !== 'consent' &&
      kind !== 'personalInfoConsent' &&
      kind !== 'businessRegistration' &&
      kind !== 'relationshipProof' &&
      kind !== 'additional' &&
      kind !== 'employment'
    ) {
      throw new BadRequestException(
        'Attachment kind must be telecom, consent, personalInfoConsent, businessRegistration, relationshipProof, additional, or employment'
      );
    }

    const file = await this.service.getSenderNumberAttachment(senderNumberId, kind);
    res.download(file.filePath, file.fileName);
  }

  @Get('kakao-template-applications')
  @ApiOperation({ summary: '운영자용 알림톡 템플릿 현황 목록' })
  getKakaoTemplateApplications(@Req() req: SessionRequest) {
    assertOperator(req);
    return this.service.getKakaoTemplateApplications();
  }

  @Get('kakao-template-applications/detail')
  @ApiOperation({ summary: '운영자용 알림톡 템플릿 상세' })
  getKakaoTemplateApplicationDetail(
    @Req() req: SessionRequest,
    @Query('senderKey') senderKey: string,
    @Query('templateCode') templateCode: string,
    @Query('tenantId') tenantId?: string,
    @Query('source') source?: 'DEFAULT_GROUP' | 'SENDER_PROFILE'
  ) {
    assertOperator(req);
    return this.service.getKakaoTemplateApplicationDetail({
      senderKey,
      templateCode,
      tenantId,
      source
    });
  }

  @Get('admin-users')
  @ApiOperation({ summary: '운영자용 운영 계정 목록' })
  getAdminUsers(@Req() req: SessionRequest) {
    assertOperator(req);
    return this.service.getAdminUsers();
  }

  @Get('managed-users')
  @ApiOperation({ summary: '운영자용 관리 대상 유저 목록' })
  getManagedUsers(@Req() req: SessionRequest) {
    assertOperator(req);
    return this.service.getManagedUsers();
  }

  @Get('send-activity')
  @ApiOperation({ summary: '운영자용 운영 계정별 발송 활동 요약' })
  getSendActivity(
    @Req() req: SessionRequest,
    @Query('range') range?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    assertOperator(req);
    return this.service.getSendActivity({ range, startDate, endDate });
  }

  @Get('send-activity/:adminUserId')
  @ApiOperation({ summary: '운영자용 운영 계정별 발송 활동 상세' })
  getSendActivityDetail(
    @Req() req: SessionRequest,
    @Param('adminUserId') adminUserId: string,
    @Query('range') range?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    assertOperator(req);
    return this.service.getSendActivityDetail(adminUserId, { range, startDate, endDate });
  }
}
