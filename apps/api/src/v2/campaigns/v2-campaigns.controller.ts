import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard } from '../../auth/session-auth.guard';
import { SessionRequest } from '../../common/session-request.interface';
import { CreateBulkAlimtalkCampaignDto } from '../../bulk-alimtalk/bulk-alimtalk.dto';
import { CreateBulkSmsCampaignDto } from '../../bulk-sms/bulk-sms.dto';
import { assertTenantAdmin } from '../v2-auth.utils';
import { V2_ROUTE_PREFIX } from '../v2.constants';
import { V2CampaignsService } from './v2-campaigns.service';

@ApiTags('v2-campaigns')
@ApiCookieAuth('pm_session')
@UseGuards(SessionAuthGuard)
@Controller(`${V2_ROUTE_PREFIX}/campaigns`)
export class V2CampaignsController {
  constructor(private readonly service: V2CampaignsService) {}

  @Get('sms/bootstrap')
  @ApiOperation({ summary: 'V2 대량 SMS 발송 화면 bootstrap 조회' })
  getSmsBootstrap(@Req() req: SessionRequest) {
    return this.service.getSmsBootstrap(assertTenantAdmin(req).tenantId);
  }

  @Get('recipients/search')
  @ApiOperation({ summary: 'V2 대량 발송용 수신자 검색' })
  searchRecipients(
    @Req() req: SessionRequest,
    @Query('q') query?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    return this.service.searchRecipients(assertTenantAdmin(req).tenantId, {
      query,
      status,
      limit,
      offset
    });
  }

  @Get()
  @ApiOperation({ summary: 'V2 대량 발송 campaign 목록 조회' })
  listCampaigns(
    @Req() req: SessionRequest,
    @Query('channel') channel?: string,
    @Query('limit') limit?: string
  ) {
    return this.service.listCampaigns(assertTenantAdmin(req).tenantId, channel, limit);
  }

  @Post('sms')
  @HttpCode(202)
  @ApiOperation({ summary: 'V2 대량 SMS 발송 campaign 접수' })
  createSmsCampaign(@Req() req: SessionRequest, @Body() dto: CreateBulkSmsCampaignDto) {
    const sessionUser = assertTenantAdmin(req);
    return this.service.createSmsCampaign(sessionUser.tenantId, sessionUser.userId, dto);
  }

  @Post('kakao')
  @HttpCode(202)
  @ApiOperation({ summary: 'V2 대량 알림톡 발송 campaign 접수' })
  createKakaoCampaign(@Req() req: SessionRequest, @Body() dto: CreateBulkAlimtalkCampaignDto) {
    const sessionUser = assertTenantAdmin(req);
    return this.service.createKakaoCampaign(sessionUser.tenantId, sessionUser.userId, dto);
  }

  @Get(':campaignId')
  @ApiOperation({ summary: 'V2 대량 발송 campaign 상세 조회' })
  getCampaignById(
    @Req() req: SessionRequest,
    @Param('campaignId') campaignId: string,
    @Query('channel') channel?: string
  ) {
    return this.service.getCampaignById(assertTenantAdmin(req).tenantId, campaignId, channel);
  }
}
