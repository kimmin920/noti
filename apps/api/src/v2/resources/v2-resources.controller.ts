import { Body, Controller, Get, Post, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiConsumes, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { SessionAuthGuard } from '../../auth/session-auth.guard';
import { SessionRequest } from '../../common/session-request.interface';
import { CreateSenderNumberDto } from '../../sender-numbers/sender-numbers.dto';
import { SenderNumbersService } from '../../sender-numbers/sender-numbers.service';
import {
  CreateSenderProfileApplicationDto,
  VerifySenderProfileTokenDto
} from '../../sender-profiles/sender-profiles.dto';
import { assertWorkspaceAdmin } from '../v2-auth.utils';
import { V2_ROUTE_PREFIX } from '../v2.constants';
import { V2ResourcesService } from './v2-resources.service';

function fileNameBuilder(_req: unknown, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) {
  const unique = `${Date.now()}_${Math.round(Math.random() * 1_000_000)}`;
  cb(null, `${unique}${extname(file.originalname)}`);
}

@ApiTags('v2-resources')
@ApiCookieAuth('pm_session')
@UseGuards(SessionAuthGuard)
@Controller(`${V2_ROUTE_PREFIX}/resources`)
export class V2ResourcesController {
  constructor(
    private readonly service: V2ResourcesService,
    private readonly senderNumbersService: SenderNumbersService
  ) {}

  @Get('summary')
  @ApiOperation({ summary: 'V2 발신 자원 요약' })
  getSummary(@Req() req: SessionRequest) {
    return this.service.getSummary(assertWorkspaceAdmin(req));
  }

  @Get('sms')
  @ApiOperation({ summary: 'V2 SMS 발신번호 목록' })
  getSmsResources(@Req() req: SessionRequest) {
    return this.service.getSmsResources(assertWorkspaceAdmin(req));
  }

  @Get('kakao')
  @ApiOperation({ summary: 'V2 카카오 채널 목록' })
  getKakaoResources(@Req() req: SessionRequest) {
    return this.service.getKakaoResources(assertWorkspaceAdmin(req));
  }

  @Get('kakao/connect/bootstrap')
  @ApiOperation({ summary: 'V2 카카오 채널 연결 페이지 초기 데이터' })
  getKakaoConnectBootstrap(@Req() req: SessionRequest) {
    return this.service.getKakaoConnectBootstrap(assertWorkspaceAdmin(req));
  }

  @Post('kakao/connect/request')
  @ApiOperation({ summary: 'V2 카카오 채널 인증 토큰 요청' })
  requestKakaoConnect(@Req() req: SessionRequest, @Body() dto: CreateSenderProfileApplicationDto) {
    return this.service.requestKakaoConnect(assertWorkspaceAdmin(req), dto);
  }

  @Post('kakao/connect/verify')
  @ApiOperation({ summary: 'V2 카카오 채널 인증 토큰 확인' })
  verifyKakaoConnect(@Req() req: SessionRequest, @Body() dto: VerifySenderProfileTokenDto) {
    return this.service.verifyKakaoConnect(assertWorkspaceAdmin(req), dto);
  }

  @Post('sender-numbers/apply')
  @ApiOperation({ summary: 'V2 발신번호 신청 + 서류 업로드' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'telecomCertificate', maxCount: 1 },
        { name: 'consentDocument', maxCount: 1 },
        { name: 'personalInfoConsent', maxCount: 1 },
        { name: 'thirdPartyBusinessRegistration', maxCount: 1 },
        { name: 'relationshipProof', maxCount: 1 },
        { name: 'additionalDocument', maxCount: 1 }
      ],
      {
        storage: diskStorage({
          destination: 'uploads',
          filename: fileNameBuilder
        })
      }
    )
  )
  applySenderNumber(
    @Req() req: SessionRequest,
    @Body() dto: CreateSenderNumberDto,
    @UploadedFiles()
    files: {
      telecomCertificate?: Express.Multer.File[];
      consentDocument?: Express.Multer.File[];
      personalInfoConsent?: Express.Multer.File[];
      thirdPartyBusinessRegistration?: Express.Multer.File[];
      relationshipProof?: Express.Multer.File[];
      additionalDocument?: Express.Multer.File[];
    }
  ) {
    const sessionUser = assertWorkspaceAdmin(req);

    return this.senderNumbersService.apply(
      sessionUser.tenantId,
      sessionUser.userId,
      dto,
      {
        telecom: files.telecomCertificate?.[0]?.path,
        consent: files.consentDocument?.[0]?.path,
        personalInfoConsent: files.personalInfoConsent?.[0]?.path,
        thirdPartyBusinessRegistration: files.thirdPartyBusinessRegistration?.[0]?.path,
        relationshipProof: files.relationshipProof?.[0]?.path,
        additionalDocument: files.additionalDocument?.[0]?.path
      },
      {
        email: sessionUser.email
      }
    );
  }
}
