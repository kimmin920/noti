import { Body, Controller, Get, Param, Post, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiConsumes, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { SessionAuthGuard } from '../../auth/session-auth.guard';
import { ObjectStorageService } from '../../common/object-storage.service';
import { SessionRequest } from '../../common/session-request.interface';
import { DOCUMENT_UPLOAD_MAX_FILE_SIZE_BYTES, documentUploadFileFilter } from '../../common/upload-security';
import { CreateSenderNumberDto } from '../../sender-numbers/sender-numbers.dto';
import { SenderNumbersService } from '../../sender-numbers/sender-numbers.service';
import { CreateSms080ApplicationDto } from '../../sms-080/sms-080.dto';
import {
  CreateSenderProfileApplicationDto,
  VerifySenderProfileTokenDto
} from '../../sender-profiles/sender-profiles.dto';
import { assertAccountUser } from '../v2-auth.utils';
import { V2_ROUTE_PREFIX } from '../v2.constants';
import { V2ResourcesService } from './v2-resources.service';

@ApiTags('v2-resources')
@ApiCookieAuth('pm_session')
@UseGuards(SessionAuthGuard)
@Controller(`${V2_ROUTE_PREFIX}/resources`)
export class V2ResourcesController {
  constructor(
    private readonly service: V2ResourcesService,
    private readonly senderNumbersService: SenderNumbersService,
    private readonly objectStorage: ObjectStorageService
  ) {}

  @Get('summary')
  @ApiOperation({ summary: 'V2 발신 자원 요약' })
  getSummary(@Req() req: SessionRequest) {
    return this.service.getSummary(assertAccountUser(req));
  }

  @Get('sms')
  @ApiOperation({ summary: 'V2 SMS 발신번호 목록' })
  getSmsResources(@Req() req: SessionRequest) {
    return this.service.getSmsResources(assertAccountUser(req));
  }

  @Get('sms-080')
  @ApiOperation({ summary: 'V2 080 수신거부 번호 목록' })
  getSms080Resources(@Req() req: SessionRequest) {
    return this.service.getSms080Resources(assertAccountUser(req));
  }

  @Post('sms-080/applications')
  @ApiOperation({ summary: 'V2 080 수신거부 번호 신청' })
  createSms080Application(@Req() req: SessionRequest, @Body() dto: CreateSms080ApplicationDto) {
    return this.service.createSms080Application(assertAccountUser(req), dto);
  }

  @Get('sender-numbers/:senderNumberId')
  @ApiOperation({ summary: 'V2 발신번호 신청 상세' })
  getSenderNumberApplication(@Req() req: SessionRequest, @Param('senderNumberId') senderNumberId: string) {
    return this.service.getSenderNumberApplication(assertAccountUser(req), senderNumberId);
  }

  @Get('kakao')
  @ApiOperation({ summary: 'V2 카카오 채널 목록' })
  getKakaoResources(@Req() req: SessionRequest) {
    return this.service.getKakaoResources(assertAccountUser(req));
  }

  @Get('kakao/connect/bootstrap')
  @ApiOperation({ summary: 'V2 카카오 채널 연결 페이지 초기 데이터' })
  getKakaoConnectBootstrap(@Req() req: SessionRequest) {
    return this.service.getKakaoConnectBootstrap(assertAccountUser(req));
  }

  @Post('kakao/connect/request')
  @ApiOperation({ summary: 'V2 카카오 채널 인증 토큰 요청' })
  requestKakaoConnect(@Req() req: SessionRequest, @Body() dto: CreateSenderProfileApplicationDto) {
    return this.service.requestKakaoConnect(assertAccountUser(req), dto);
  }

  @Post('kakao/connect/verify')
  @ApiOperation({ summary: 'V2 카카오 채널 인증 토큰 확인' })
  verifyKakaoConnect(@Req() req: SessionRequest, @Body() dto: VerifySenderProfileTokenDto) {
    return this.service.verifyKakaoConnect(assertAccountUser(req), dto);
  }

  @Post('kakao/:senderProfileId/default')
  @ApiOperation({ summary: 'V2 기본 카카오 채널 설정' })
  setDefaultKakaoChannel(@Req() req: SessionRequest, @Param('senderProfileId') senderProfileId: string) {
    return this.service.setDefaultKakaoChannel(assertAccountUser(req), senderProfileId);
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
        { name: 'idCardCopy', maxCount: 1 },
        { name: 'thirdPartyBusinessRegistration', maxCount: 1 },
        { name: 'relationshipProof', maxCount: 1 },
        { name: 'additionalDocument', maxCount: 1 }
      ],
      {
        storage: memoryStorage(),
        limits: {
          fileSize: DOCUMENT_UPLOAD_MAX_FILE_SIZE_BYTES,
          files: 7
        },
        fileFilter: documentUploadFileFilter
      }
    )
  )
  async applySenderNumber(
    @Req() req: SessionRequest,
    @Body() dto: CreateSenderNumberDto,
    @UploadedFiles()
    files: {
      telecomCertificate?: Express.Multer.File[];
      consentDocument?: Express.Multer.File[];
      personalInfoConsent?: Express.Multer.File[];
      idCardCopy?: Express.Multer.File[];
      thirdPartyBusinessRegistration?: Express.Multer.File[];
      relationshipProof?: Express.Multer.File[];
      additionalDocument?: Express.Multer.File[];
    }
  ) {
    const sessionUser = assertAccountUser(req);
    const storedFiles = await this.storeSenderNumberApplicationFiles(sessionUser.userId, files);

    return this.senderNumbersService.apply(
      sessionUser.userId,
      dto,
      storedFiles,
      {
        email: sessionUser.email
      }
    );
  }

  private async storeSenderNumberApplicationFiles(
    ownerUserId: string,
    files: {
      telecomCertificate?: Express.Multer.File[];
      consentDocument?: Express.Multer.File[];
      personalInfoConsent?: Express.Multer.File[];
      idCardCopy?: Express.Multer.File[];
      thirdPartyBusinessRegistration?: Express.Multer.File[];
      relationshipProof?: Express.Multer.File[];
      additionalDocument?: Express.Multer.File[];
    }
  ) {
    const basePrefix = `sender-numbers/${ownerUserId}`;
    const [
      telecom,
      consent,
      personalInfoConsent,
      idCardCopy,
      thirdPartyBusinessRegistration,
      relationshipProof,
      additionalDocument
    ] = await Promise.all([
      this.storeOptionalFile(files.telecomCertificate?.[0], `${basePrefix}/telecom`),
      this.storeOptionalFile(files.consentDocument?.[0], `${basePrefix}/consent`),
      this.storeOptionalFile(files.personalInfoConsent?.[0], `${basePrefix}/personal-info-consent`),
      this.storeOptionalFile(files.idCardCopy?.[0], `${basePrefix}/id-card-copy`),
      this.storeOptionalFile(files.thirdPartyBusinessRegistration?.[0], `${basePrefix}/business-registration`),
      this.storeOptionalFile(files.relationshipProof?.[0], `${basePrefix}/relationship-proof`),
      this.storeOptionalFile(files.additionalDocument?.[0], `${basePrefix}/additional`)
    ]);

    return {
      telecom,
      consent,
      personalInfoConsent,
      idCardCopy,
      thirdPartyBusinessRegistration,
      relationshipProof,
      additionalDocument
    };
  }

  private storeOptionalFile(file: Express.Multer.File | undefined, keyPrefix: string) {
    return file ? this.objectStorage.saveUploadedFile(file, keyPrefix) : Promise.resolve(undefined);
  }
}
