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

  private assertUserAccess(req: SessionRequest) {
    if (!req.sessionUser || (req.sessionUser.role !== 'USER' && req.sessionUser.role !== 'PARTNER_ADMIN')) {
      throw new ForbiddenException('USER or PARTNER_ADMIN role is required');
    }
  }

  @Get('campaigns')
  @ApiOperation({ summary: '대량 알림톡 배치 조회' })
  listCampaigns(@Req() req: SessionRequest) {
    this.assertUserAccess(req);
    return this.service.listCampaignsForUser(req.sessionUser!.userId);
  }

  @Post('campaigns')
  @ApiOperation({ summary: '대량 알림톡 배치 생성 및 NHN bulk 발송' })
  createCampaign(@Req() req: SessionRequest, @Body() dto: CreateBulkAlimtalkCampaignDto) {
    this.assertUserAccess(req);
    return this.service.createCampaignForUser(req.sessionUser!.userId, dto);
  }
}
