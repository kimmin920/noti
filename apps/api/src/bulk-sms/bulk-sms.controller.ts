import { Body, Controller, ForbiddenException, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { SessionRequest } from '../common/session-request.interface';
import { CreateBulkSmsCampaignDto } from './bulk-sms.dto';
import { BulkSmsService } from './bulk-sms.service';

@ApiTags('bulk-sms')
@ApiCookieAuth('pm_session')
@UseGuards(SessionAuthGuard)
@Controller('v1/bulk-sms')
export class BulkSmsController {
  constructor(private readonly service: BulkSmsService) {}

  private assertTenantAdmin(req: SessionRequest) {
    if (!req.sessionUser || (req.sessionUser.role !== 'TENANT_ADMIN' && req.sessionUser.role !== 'PARTNER_ADMIN')) {
      throw new ForbiddenException('TENANT_ADMIN or PARTNER_ADMIN role is required');
    }
  }

  @Get('campaigns')
  @ApiOperation({ summary: '대량 SMS 배치 조회' })
  listCampaigns(@Req() req: SessionRequest) {
    this.assertTenantAdmin(req);
    return this.service.listCampaigns(req.sessionUser!.tenantId, req.sessionUser!.userId);
  }

  @Post('campaigns')
  @ApiOperation({ summary: '대량 SMS 배치 생성 및 NHN bulk 발송' })
  createCampaign(@Req() req: SessionRequest, @Body() dto: CreateBulkSmsCampaignDto) {
    this.assertTenantAdmin(req);
    return this.service.createCampaign(req.sessionUser!.tenantId, req.sessionUser!.userId, req.sessionUser!.userId, dto);
  }
}
