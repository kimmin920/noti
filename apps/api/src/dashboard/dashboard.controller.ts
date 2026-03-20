import { Body, Controller, ForbiddenException, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { SessionRequest } from '../common/session-request.interface';
import { CreateDashboardNoticeDto, UpdateDashboardQuotaDto, UpdateDashboardSettingsDto } from './dashboard.dto';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiCookieAuth('pm_session')
@UseGuards(SessionAuthGuard)
@Controller('v1')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  private assertRole(req: SessionRequest, expectedRole: 'TENANT_ADMIN' | 'OPERATOR') {
    if (!req.sessionUser || req.sessionUser.role !== expectedRole) {
      throw new ForbiddenException(`${expectedRole} role is required`);
    }
  }

  @Get('dashboard/overview')
  @ApiOperation({ summary: '테넌트 대시보드 개요 조회' })
  overview(@Req() req: SessionRequest) {
    this.assertRole(req, 'TENANT_ADMIN');
    return this.service.getOverview(req.sessionUser!);
  }

  @Post('dashboard/settings')
  @ApiOperation({ summary: '테넌트 대시보드 설정 업데이트' })
  updateSettings(@Req() req: SessionRequest, @Body() dto: UpdateDashboardSettingsDto) {
    this.assertRole(req, 'TENANT_ADMIN');
    return this.service.updateSettings(req.sessionUser!.tenantId, dto);
  }

  @Post('internal/dashboard-quota')
  @ApiOperation({ summary: '내부 운영용 일일 발송 한도 수정' })
  updateQuota(@Req() req: SessionRequest, @Body() dto: UpdateDashboardQuotaDto) {
    this.assertRole(req, 'OPERATOR');
    return this.service.updateQuota(req.sessionUser!.tenantId, dto);
  }

  @Get('internal/dashboard-notices')
  @ApiOperation({ summary: '내부 운영용 공지사항 목록' })
  listNotices(@Req() req: SessionRequest) {
    this.assertRole(req, 'OPERATOR');
    return this.service.listInternalNotices();
  }

  @Post('internal/dashboard-notices')
  @ApiOperation({ summary: '내부 운영용 공지사항 작성' })
  createNotice(@Req() req: SessionRequest, @Body() dto: CreateDashboardNoticeDto) {
    this.assertRole(req, 'OPERATOR');
    return this.service.createNotice(dto, req.sessionUser!);
  }

  @Post('internal/dashboard-notices/:noticeId/archive')
  @ApiOperation({ summary: '내부 운영용 공지사항 보관' })
  archiveNotice(@Req() req: SessionRequest, @Param('noticeId') noticeId: string) {
    this.assertRole(req, 'OPERATOR');
    return this.service.archiveNotice(noticeId);
  }
}
