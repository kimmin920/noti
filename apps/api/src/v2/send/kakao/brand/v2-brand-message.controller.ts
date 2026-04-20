import { Body, Controller, Get, HttpCode, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard } from '../../../../auth/session-auth.guard';
import { SessionRequest } from '../../../../common/session-request.interface';
import { assertAccountUser } from '../../../v2-auth.utils';
import { V2_ROUTE_PREFIX } from '../../../v2.constants';
import { CreateManualBrandMessageRequestDto, UploadV2BrandMessageImageDto } from './v2-brand-message.dto';
import { V2BrandMessageService } from './v2-brand-message.service';

@ApiTags('v2-send-kakao-brand')
@ApiCookieAuth('pm_session')
@UseGuards(SessionAuthGuard)
@Controller(`${V2_ROUTE_PREFIX}/send/kakao/brand`)
export class V2BrandMessageController {
  constructor(private readonly service: V2BrandMessageService) {}

  @Get('readiness')
  @ApiOperation({ summary: 'V2 브랜드 메시지 발송 readiness' })
  getReadiness(@Req() req: SessionRequest) {
    const sessionUser = assertAccountUser(req);
    return this.service.getReadiness(sessionUser.userId);
  }

  @Get('options')
  @ApiOperation({ summary: 'V2 브랜드 메시지 발송 옵션 조회' })
  getOptions(@Req() req: SessionRequest) {
    return this.service.getOptions(assertAccountUser(req));
  }

  @Post('requests')
  @HttpCode(202)
  @ApiOperation({ summary: 'V2 브랜드 메시지 발송 요청' })
  createRequest(@Req() req: SessionRequest, @Body() dto: CreateManualBrandMessageRequestDto) {
    const sessionUser = assertAccountUser(req);
    return this.service.createRequest(sessionUser.userId, dto);
  }

  @Post('image')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'V2 브랜드 메시지 이미지 업로드' })
  uploadImage(
    @Req() req: SessionRequest,
    @Body() dto: UploadV2BrandMessageImageDto,
    @UploadedFile() file: Express.Multer.File
  ) {
    return this.service.uploadImage(assertAccountUser(req), file, dto.messageType);
  }
}
