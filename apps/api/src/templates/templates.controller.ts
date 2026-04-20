import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MessageChannel } from '@prisma/client';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { SessionRequest } from '../common/session-request.interface';
import { CreateTemplateDto, PreviewTemplateDto, UpdateTemplateDto } from './templates.dto';
import { TemplatesService } from './templates.service';

@ApiTags('templates')
@ApiCookieAuth('pm_session')
@UseGuards(SessionAuthGuard)
@Controller('v1/templates')
export class TemplatesController {
  constructor(private readonly service: TemplatesService) {}

  @Get()
  @ApiOperation({ summary: '템플릿 목록' })
  list(@Req() req: SessionRequest, @Query('channel') channel?: MessageChannel) {
    return this.service.list(req.sessionUser!.userId, channel);
  }

  @Post()
  @ApiOperation({ summary: '템플릿 생성 (ALIMTALK는 NHN 승인요청 자동 실행)' })
  create(@Req() req: SessionRequest, @Body() dto: CreateTemplateDto) {
    return this.service.create(req.sessionUser!.userId, dto);
  }

  @Put(':templateId')
  @ApiOperation({ summary: '템플릿 수정 + 버전 추가 (ALIMTALK는 NHN 승인요청 자동 재실행)' })
  update(@Req() req: SessionRequest, @Param('templateId') templateId: string, @Body() dto: UpdateTemplateDto) {
    return this.service.update(req.sessionUser!.userId, templateId, dto);
  }

  @Post(':templateId/preview')
  @ApiOperation({ summary: '템플릿 미리보기 렌더' })
  preview(
    @Req() req: SessionRequest,
    @Param('templateId') templateId: string,
    @Body() dto: PreviewTemplateDto
  ) {
    return this.service.preview(req.sessionUser!.userId, templateId, dto.variables);
  }

  @Post(':templateId/publish')
  @ApiOperation({ summary: '템플릿 게시(PUBLISHED)' })
  publish(@Req() req: SessionRequest, @Param('templateId') templateId: string) {
    return this.service.publish(req.sessionUser!.userId, templateId);
  }

  @Post(':templateId/archive')
  @ApiOperation({ summary: '템플릿 보관(ARCHIVED)' })
  archive(@Req() req: SessionRequest, @Param('templateId') templateId: string) {
    return this.service.archive(req.sessionUser!.userId, templateId);
  }

  @Get(':templateId/versions')
  @ApiOperation({ summary: '템플릿 버전 이력' })
  versions(@Req() req: SessionRequest, @Param('templateId') templateId: string) {
    return this.service.versions(req.sessionUser!.userId, templateId);
  }

  @Post(':templateId/nhn-sync')
  @ApiOperation({ summary: 'NHN 동기화 요청(ALIMTALK)' })
  nhnSync(@Req() req: SessionRequest, @Param('templateId') templateId: string) {
    return this.service.requestNhnSync(req.sessionUser!.userId, templateId);
  }
}
