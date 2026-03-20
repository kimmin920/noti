import { Body, Controller, ForbiddenException, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { SessionRequest } from '../common/session-request.interface';
import { CreateBulkAlimtalkCampaignDto } from './bulk-alimtalk.dto';
import { BulkAlimtalkService } from './bulk-alimtalk.service';

@ApiTags('bulk-alimtalk')
@ApiCookieAuth('pm_session')
@UseGuards(SessionAuthGuard)
@Controller('v1/bulk-alimtalk')
export class BulkAlimtalkController {
  constructor(private readonly service: BulkAlimtalkService) {}

  private assertTenantAdmin(req: SessionRequest) {
    if (!req.sessionUser || req.sessionUser.role !== 'TENANT_ADMIN') {
      throw new ForbiddenException('TENANT_ADMIN role is required');
    }
  }

  @Get('campaigns')
  @ApiOperation({ summary: '대량 알림톡 배치 조회' })
  listCampaigns(@Req() req: SessionRequest) {
    this.assertTenantAdmin(req);
    return this.service.listCampaigns(req.sessionUser!.tenantId);
  }

  @Post('campaigns')
  @ApiOperation({ summary: '대량 알림톡 배치 생성 및 NHN bulk 발송' })
  createCampaign(@Req() req: SessionRequest, @Body() dto: CreateBulkAlimtalkCampaignDto) {
    this.assertTenantAdmin(req);
    return this.service.createCampaign(req.sessionUser!.tenantId, req.sessionUser!.userId, dto);
  }
}
