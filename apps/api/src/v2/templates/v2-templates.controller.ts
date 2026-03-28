import { Body, Controller, Get, Param, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiConsumes, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { SessionAuthGuard } from '../../auth/session-auth.guard';
import { SessionRequest } from '../../common/session-request.interface';
import { assertTenantAdmin } from '../v2-auth.utils';
import { V2_ROUTE_PREFIX } from '../v2.constants';
import { CreateV2KakaoTemplateDto, GetV2KakaoTemplateDetailQueryDto } from './v2-templates.dto';
import { V2TemplatesService } from './v2-templates.service';

@ApiTags('v2-templates')
@ApiCookieAuth('pm_session')
@UseGuards(SessionAuthGuard)
@Controller(`${V2_ROUTE_PREFIX}/templates`)
export class V2TemplatesController {
  constructor(private readonly service: V2TemplatesService) {}

  @Get('summary')
  @ApiOperation({ summary: 'V2 템플릿 요약' })
  getSummary(@Req() req: SessionRequest) {
    return this.service.getSummary(assertTenantAdmin(req).tenantId);
  }

  @Get('sms')
  @ApiOperation({ summary: 'V2 SMS 템플릿 목록' })
  getSmsTemplates(@Req() req: SessionRequest) {
    return this.service.getSmsTemplates(assertTenantAdmin(req).tenantId);
  }

  @Get('sms/:templateId')
  @ApiOperation({ summary: 'V2 SMS 템플릿 상세' })
  getSmsTemplateDetail(@Req() req: SessionRequest, @Param('templateId') templateId: string) {
    return this.service.getSmsTemplateDetail(assertTenantAdmin(req).tenantId, templateId);
  }

  @Get('kakao')
  @ApiOperation({ summary: 'V2 알림톡 템플릿 목록' })
  getKakaoTemplates(@Req() req: SessionRequest) {
    return this.service.getKakaoTemplates(assertTenantAdmin(req).tenantId);
  }

  @Get('kakao/detail')
  @ApiOperation({ summary: 'V2 알림톡 템플릿 상세' })
  getKakaoTemplateDetail(@Req() req: SessionRequest, @Query() query: GetV2KakaoTemplateDetailQueryDto) {
    return this.service.getKakaoTemplateDetail(assertTenantAdmin(req).tenantId, query);
  }

  @Post('kakao')
  @ApiOperation({ summary: 'V2 알림톡 템플릿 생성 및 NHN 승인 요청' })
  createKakaoTemplate(@Req() req: SessionRequest, @Body() dto: CreateV2KakaoTemplateDto) {
    return this.service.createKakaoTemplate(assertTenantAdmin(req).tenantId, dto);
  }

  @Post('kakao/image')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'V2 알림톡 템플릿 이미지 업로드' })
  uploadKakaoTemplateImage(@Req() req: SessionRequest, @UploadedFile() file: Express.Multer.File) {
    assertTenantAdmin(req);
    return this.service.uploadKakaoTemplateImage(file);
  }
}
