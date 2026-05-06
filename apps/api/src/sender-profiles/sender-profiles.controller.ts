import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { SessionRequest } from '../common/session-request.interface';
import {
  CreateSenderProfileApplicationDto,
  ListSenderProfilesDto,
  VerifySenderProfileTokenDto
} from './sender-profiles.dto';
import { SenderProfilesService } from './sender-profiles.service';

@ApiTags('sender-profiles')
@ApiCookieAuth('pm_session')
@UseGuards(SessionAuthGuard)
@Controller('v1/sender-profiles')
export class SenderProfilesController {
  constructor(private readonly service: SenderProfilesService) {}

  private assertUserAccess(req: SessionRequest) {
    if (!req.sessionUser || (req.sessionUser.role !== 'USER' && req.sessionUser.role !== 'PARTNER_ADMIN')) {
      throw new ForbiddenException('USER or PARTNER_ADMIN role is required');
    }
  }

  @Get('categories')
  @ApiOperation({ summary: '카카오 채널 신청용 카테고리 조회' })
  listCategories(@Req() req: SessionRequest) {
    this.assertUserAccess(req);
    return this.service.listCategories();
  }

  @Get()
  @ApiOperation({ summary: '카카오 채널 조회' })
  list(@Req() req: SessionRequest, @Query() query: ListSenderProfilesDto) {
    this.assertUserAccess(req);
    return this.service.list(req.sessionUser!.userId, query);
  }

  @Get('default-group/status')
  @ApiOperation({ summary: '기본 발신프로필그룹 상태 조회' })
  getDefaultGroupStatus(@Req() req: SessionRequest) {
    this.assertUserAccess(req);
    return this.service.getDefaultGroupStatus();
  }

  @Get('default-group/templates')
  @ApiOperation({ summary: '기본 발신프로필그룹 템플릿 조회' })
  getDefaultGroupTemplates(@Req() req: SessionRequest) {
    this.assertUserAccess(req);
    return this.service.getDefaultGroupTemplates();
  }

  @Get(':senderKey')
  @ApiOperation({ summary: '카카오 채널 현황조회' })
  getBySenderKey(@Req() req: SessionRequest, @Param('senderKey') senderKey: string) {
    this.assertUserAccess(req);
    return this.service.getBySenderKey(req.sessionUser!.userId, senderKey);
  }

  @Post('apply')
  @ApiOperation({ summary: '카카오 채널 신청' })
  apply(@Req() req: SessionRequest, @Body() dto: CreateSenderProfileApplicationDto) {
    this.assertUserAccess(req);
    return this.service.apply(req.sessionUser!.userId, dto);
  }

  @Post(':senderKey/default-group-sync')
  @ApiOperation({ summary: '카카오 채널을 기본 발신프로필그룹에 재동기화' })
  syncSenderToDefaultGroup(@Req() req: SessionRequest, @Param('senderKey') senderKey: string) {
    this.assertUserAccess(req);
    return this.service.syncSenderToDefaultGroup(req.sessionUser!.userId, senderKey);
  }

  @Post(':senderProfileId/default')
  @ApiOperation({ summary: '기본 카카오 채널 설정' })
  setDefault(@Req() req: SessionRequest, @Param('senderProfileId') senderProfileId: string) {
    this.assertUserAccess(req);
    return this.service.setDefault(req.sessionUser!.userId, senderProfileId);
  }

  @Post('token')
  @ApiOperation({ summary: '카카오 채널 신청 토큰 인증' })
  verifyToken(@Req() req: SessionRequest, @Body() dto: VerifySenderProfileTokenDto) {
    this.assertUserAccess(req);
    return this.service.verifyToken(req.sessionUser!.userId, dto);
  }
}
