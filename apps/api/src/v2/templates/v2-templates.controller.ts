import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiConsumes, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { SessionAuthGuard } from '../../auth/session-auth.guard';
import { SessionRequest } from '../../common/session-request.interface';
import { assertAccountUser } from '../v2-auth.utils';
import { V2_ROUTE_PREFIX } from '../v2.constants';
import {
  CreateV2BrandTemplateDto,
  CreateV2KakaoTemplateDto,
  DeleteV2BrandTemplateQueryDto,
  DeleteV2KakaoTemplateQueryDto,
  GetV2BrandTemplateDetailQueryDto,
  GetV2KakaoTemplateDraftsQueryDto,
  GetV2KakaoTemplateDetailQueryDto,
  SaveV2KakaoTemplateDraftDto,
  UpdateV2BrandTemplateDto,
  UploadV2BrandTemplateImageDto
} from './v2-templates.dto';
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
    return this.service.getSummary(assertAccountUser(req));
  }

  @Get('sms')
  @ApiOperation({ summary: 'V2 SMS 템플릿 목록' })
  getSmsTemplates(@Req() req: SessionRequest) {
    return this.service.getSmsTemplates(assertAccountUser(req));
  }

  @Get('sms/:templateId')
  @ApiOperation({ summary: 'V2 SMS 템플릿 상세' })
  getSmsTemplateDetail(@Req() req: SessionRequest, @Param('templateId') templateId: string) {
    return this.service.getSmsTemplateDetail(assertAccountUser(req), templateId);
  }

  @Get('kakao')
  @ApiOperation({ summary: 'V2 알림톡 템플릿 목록' })
  getKakaoTemplates(@Req() req: SessionRequest) {
    return this.service.getKakaoTemplates(assertAccountUser(req));
  }

  @Get('kakao/drafts')
  @ApiOperation({ summary: 'V2 알림톡 템플릿 임시저장 목록' })
  getKakaoTemplateDrafts(@Req() req: SessionRequest, @Query() query: GetV2KakaoTemplateDraftsQueryDto) {
    return this.service.getKakaoTemplateDrafts(assertAccountUser(req), query);
  }

  @Get('brand')
  @ApiOperation({ summary: 'V2 브랜드 메시지 템플릿 목록' })
  getBrandTemplates(@Req() req: SessionRequest) {
    return this.service.getBrandTemplates(assertAccountUser(req));
  }

  @Get('kakao/detail')
  @ApiOperation({ summary: 'V2 알림톡 템플릿 상세' })
  getKakaoTemplateDetail(@Req() req: SessionRequest, @Query() query: GetV2KakaoTemplateDetailQueryDto) {
    return this.service.getKakaoTemplateDetail(assertAccountUser(req), query);
  }

  @Get('brand/detail')
  @ApiOperation({ summary: 'V2 브랜드 메시지 템플릿 상세' })
  getBrandTemplateDetail(@Req() req: SessionRequest, @Query() query: GetV2BrandTemplateDetailQueryDto) {
    return this.service.getBrandTemplateDetail(assertAccountUser(req), query);
  }

  @Post('kakao')
  @ApiOperation({ summary: 'V2 알림톡 템플릿 생성 및 NHN 승인 요청' })
  createKakaoTemplate(@Req() req: SessionRequest, @Body() dto: CreateV2KakaoTemplateDto) {
    return this.service.createKakaoTemplate(assertAccountUser(req), dto);
  }

  @Post('kakao/drafts')
  @ApiOperation({ summary: 'V2 알림톡 템플릿 임시저장' })
  saveKakaoTemplateDraft(@Req() req: SessionRequest, @Body() dto: SaveV2KakaoTemplateDraftDto) {
    return this.service.saveKakaoTemplateDraft(assertAccountUser(req), dto);
  }

  @Put('kakao/:templateCode')
  @ApiOperation({ summary: 'V2 알림톡 템플릿 수정 및 NHN 재검수 요청' })
  updateKakaoTemplate(
    @Req() req: SessionRequest,
    @Param('templateCode') templateCode: string,
    @Body() dto: CreateV2KakaoTemplateDto
  ) {
    return this.service.updateKakaoTemplate(assertAccountUser(req), templateCode, dto);
  }

  @Delete('kakao/:templateCode')
  @ApiOperation({ summary: 'V2 알림톡 템플릿 삭제' })
  deleteKakaoTemplate(
    @Req() req: SessionRequest,
    @Param('templateCode') templateCode: string,
    @Query() query: DeleteV2KakaoTemplateQueryDto
  ) {
    return this.service.deleteKakaoTemplate(assertAccountUser(req), templateCode, query);
  }

  @Post('brand')
  @ApiOperation({ summary: 'V2 브랜드 메시지 템플릿 생성' })
  createBrandTemplate(@Req() req: SessionRequest, @Body() dto: CreateV2BrandTemplateDto) {
    return this.service.createBrandTemplate(assertAccountUser(req), dto);
  }

  @Put('brand/:templateCode')
  @ApiOperation({ summary: 'V2 브랜드 메시지 템플릿 수정' })
  updateBrandTemplate(
    @Req() req: SessionRequest,
    @Param('templateCode') templateCode: string,
    @Body() dto: UpdateV2BrandTemplateDto
  ) {
    return this.service.updateBrandTemplate(assertAccountUser(req), templateCode, dto);
  }

  @Delete('brand/:templateCode')
  @ApiOperation({ summary: 'V2 브랜드 메시지 템플릿 삭제' })
  deleteBrandTemplate(
    @Req() req: SessionRequest,
    @Param('templateCode') templateCode: string,
    @Query() query: DeleteV2BrandTemplateQueryDto
  ) {
    return this.service.deleteBrandTemplate(assertAccountUser(req), templateCode, query);
  }

  @Post('kakao/image')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'V2 알림톡 템플릿 이미지 업로드' })
  uploadKakaoTemplateImage(@Req() req: SessionRequest, @UploadedFile() file: Express.Multer.File) {
    assertAccountUser(req);
    return this.service.uploadKakaoTemplateImage(file);
  }

  @Post('brand/image')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'V2 브랜드 메시지 템플릿 이미지 업로드' })
  uploadBrandTemplateImage(
    @Req() req: SessionRequest,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadV2BrandTemplateImageDto
  ) {
    assertAccountUser(req);
    return this.service.uploadBrandTemplateImage(file, dto);
  }
}
