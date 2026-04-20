import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { SessionAuthGuard } from '../../auth/session-auth.guard';
import { SessionRequest } from '../../common/session-request.interface';
import { CreateDashboardNoticeDto, UpdateDashboardNoticeDto } from '../../dashboard/dashboard.dto';
import { ReviewSenderNumberDto } from '../../sender-numbers/sender-numbers.dto';
import { UpdateUserSmsQuotaDto, UpdateAdminUserAccessOriginDto, UpdateAdminUserRoleDto } from './v2-ops.dto';
import { assertAccountUser, assertOperator } from '../v2-auth.utils';
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
    assertAccountUser(req);
    return this.service.getHealth();
  }

  @Get('notices')
  @ApiOperation({ summary: '운영자용 공지사항 목록' })
  getNotices(@Req() req: SessionRequest) {
    assertOperator(req);
    return this.service.getNotices();
  }

  @Get('sms-quotas')
  @ApiOperation({ summary: '운영자용 사용자 계정 SMS 월간 쿼터 목록' })
  getSmsQuotas(@Req() req: SessionRequest) {
    assertOperator(req);
    return this.service.getSmsQuotas();
  }

  @Patch('sms-quotas/:userId')
  @ApiOperation({ summary: '운영자용 사용자 계정 SMS 월간 쿼터 수정' })
  updateUserSmsQuota(
    @Req() req: SessionRequest,
    @Param('userId') userId: string,
    @Body() dto: UpdateUserSmsQuotaDto
  ) {
    assertOperator(req);
    return this.service.updateUserSmsQuota(userId, dto.monthlySmsLimit);
  }

  @Post('notices')
  @ApiOperation({ summary: '운영자용 공지사항 작성' })
  createNotice(@Req() req: SessionRequest, @Body() dto: CreateDashboardNoticeDto) {
    const operator = assertOperator(req);
    return this.service.createNotice(dto, operator);
  }

  @Patch('notices/:noticeId')
  @ApiOperation({ summary: '운영자용 공지사항 수정' })
  updateNotice(@Req() req: SessionRequest, @Param('noticeId') noticeId: string, @Body() dto: UpdateDashboardNoticeDto) {
    assertOperator(req);
    return this.service.updateNotice(noticeId, dto);
  }

  @Post('notices/:noticeId/archive')
  @ApiOperation({ summary: '운영자용 공지사항 보관' })
  archiveNotice(@Req() req: SessionRequest, @Param('noticeId') noticeId: string) {
    assertOperator(req);
    return this.service.archiveNotice(noticeId);
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

  @Post('sender-number-applications/:senderNumberId/request-supplement')
  @ApiOperation({ summary: '운영자용 발신번호 서류 보완 요청' })
  requestSenderNumberSupplement(
    @Req() req: SessionRequest,
    @Param('senderNumberId') senderNumberId: string,
    @Body() dto: ReviewSenderNumberDto
  ) {
    const operator = assertOperator(req);
    return this.service.requestSenderNumberSupplement(senderNumberId, operator.userId, dto.memo);
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
      kind !== 'idCardCopy' &&
      kind !== 'businessRegistration' &&
      kind !== 'relationshipProof' &&
      kind !== 'additional' &&
      kind !== 'employment'
    ) {
      throw new BadRequestException(
        'Attachment kind must be telecom, consent, personalInfoConsent, idCardCopy, businessRegistration, relationshipProof, additional, or employment'
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
    @Query('userId') userId?: string,
    @Query('source') source?: 'GROUP' | 'SENDER_PROFILE'
  ) {
    assertOperator(req);
    return this.service.getKakaoTemplateApplicationDetail({
      senderKey,
      templateCode,
      userId,
      source
    });
  }

  @Get('admin-users')
  @ApiOperation({ summary: '운영자용 사용자 계정 목록' })
  getAdminUsers(@Req() req: SessionRequest) {
    assertOperator(req);
    return this.service.getAdminUsers();
  }

  @Patch('admin-users/:adminUserId/role')
  @ApiOperation({ summary: '운영자용 사용자 권한 변경' })
  updateAdminUserRole(
    @Req() req: SessionRequest,
    @Param('adminUserId') adminUserId: string,
    @Body() dto: UpdateAdminUserRoleDto
  ) {
    assertOperator(req);
    return this.service.updateAdminUserRole(adminUserId, dto.role);
  }

  @Patch('admin-users/:adminUserId/access-origin')
  @ApiOperation({ summary: '운영자용 사용자 유입 채널 변경' })
  updateAdminUserAccessOrigin(
    @Req() req: SessionRequest,
    @Param('adminUserId') adminUserId: string,
    @Body() dto: UpdateAdminUserAccessOriginDto
  ) {
    assertOperator(req);
    return this.service.updateAdminUserAccessOrigin(adminUserId, dto.accessOrigin);
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
