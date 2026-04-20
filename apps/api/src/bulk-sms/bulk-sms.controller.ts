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

  private assertUserAccess(req: SessionRequest) {
    if (!req.sessionUser || (req.sessionUser.role !== 'USER' && req.sessionUser.role !== 'PARTNER_ADMIN')) {
      throw new ForbiddenException('USER or PARTNER_ADMIN role is required');
    }
  }

  @Get('campaigns')
  @ApiOperation({ summary: '대량 SMS 배치 조회' })
  listCampaigns(@Req() req: SessionRequest) {
    this.assertUserAccess(req);
    return this.service.listCampaignsForUser(req.sessionUser!.userId);
  }

  @Post('campaigns')
  @ApiOperation({ summary: '대량 SMS 배치 생성 및 NHN bulk 발송' })
  createCampaign(@Req() req: SessionRequest, @Body() dto: CreateBulkSmsCampaignDto) {
    this.assertUserAccess(req);
    return this.service.createCampaignForUser(req.sessionUser!.userId, dto);
  }
}
