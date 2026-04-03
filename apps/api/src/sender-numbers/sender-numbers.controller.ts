import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { ApiConsumes, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import type { Response } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { SessionRequest } from '../common/session-request.interface';
import { CreateSenderNumberDto, ReviewSenderNumberDto } from './sender-numbers.dto';
import { SenderNumbersService } from './sender-numbers.service';

function fileNameBuilder(_req: unknown, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) {
  const unique = `${Date.now()}_${Math.round(Math.random() * 1_000_000)}`;
  cb(null, `${unique}${extname(file.originalname)}`);
}

@ApiTags('sender-numbers')
@ApiCookieAuth('pm_session')
@UseGuards(SessionAuthGuard)
@Controller('v1')
export class SenderNumbersController {
  constructor(private readonly service: SenderNumbersService) {}

  private assertWorkspaceAdmin(req: SessionRequest) {
    if (!req.sessionUser || (req.sessionUser.role !== 'TENANT_ADMIN' && req.sessionUser.role !== 'PARTNER_ADMIN')) {
      throw new ForbiddenException('TENANT_ADMIN or PARTNER_ADMIN role is required');
    }
  }

  private assertSuperAdmin(req: SessionRequest) {
    if (!req.sessionUser || req.sessionUser.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('SUPER_ADMIN role is required');
    }
  }

  @Get('sender-numbers')
  @ApiOperation({ summary: '발신번호 목록' })
  list(@Req() req: SessionRequest) {
    this.assertWorkspaceAdmin(req);
    return this.service.list(req.sessionUser!.tenantId, req.sessionUser!.userId);
  }

  @Post('sender-numbers/apply')
  @ApiOperation({ summary: '발신번호 신청 + 서류 업로드' })
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
        storage: diskStorage({
          destination: 'uploads',
          filename: fileNameBuilder
        })
      }
    )
  )
  apply(
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
    this.assertWorkspaceAdmin(req);
    return this.service.apply(
      req.sessionUser!.tenantId,
      req.sessionUser!.userId,
      dto,
      {
        telecom: files.telecomCertificate?.[0]?.path,
        consent: files.consentDocument?.[0]?.path,
        personalInfoConsent: files.personalInfoConsent?.[0]?.path,
        idCardCopy: files.idCardCopy?.[0]?.path,
        thirdPartyBusinessRegistration: files.thirdPartyBusinessRegistration?.[0]?.path,
        relationshipProof: files.relationshipProof?.[0]?.path,
        additionalDocument: files.additionalDocument?.[0]?.path
      },
      {
        email: req.sessionUser?.email
      }
    );
  }

  @Get('admin/sender-number-reviews')
  @ApiOperation({ summary: '운영자 검수 큐 조회(SUBMITTED)' })
  reviewQueue(@Req() req: SessionRequest) {
    this.assertSuperAdmin(req);
    return this.service.listAllForOperator();
  }

  @Get('admin/sender-number-reviews/nhn-registered')
  @ApiOperation({ summary: '외부 sendNos 기반 등록 완료 발신번호 조회' })
  listRegisteredFromNhn(@Req() req: SessionRequest) {
    this.assertWorkspaceAdmin(req);
    return this.service.listRegisteredFromNhn(req.sessionUser!.tenantId, req.sessionUser!.userId);
  }

  @Post('admin/sender-number-reviews/:senderNumberId/approve')
  @ApiOperation({ summary: '발신번호 승인' })
  approve(
    @Req() req: SessionRequest,
    @Param('senderNumberId') senderNumberId: string,
    @Body() dto: ReviewSenderNumberDto
  ) {
    this.assertSuperAdmin(req);
    return this.service.approveForOperator(senderNumberId, req.sessionUser!.userId, dto.memo);
  }

  @Post('admin/sender-number-reviews/:senderNumberId/reject')
  @ApiOperation({ summary: '발신번호 반려' })
  reject(
    @Req() req: SessionRequest,
    @Param('senderNumberId') senderNumberId: string,
    @Body() dto: ReviewSenderNumberDto
  ) {
    this.assertSuperAdmin(req);
    return this.service.rejectForOperator(senderNumberId, req.sessionUser!.userId, dto.memo);
  }

  @Post('admin/sender-number-reviews/:senderNumberId/request-supplement')
  @ApiOperation({ summary: '발신번호 서류 보완 요청' })
  requestSupplement(
    @Req() req: SessionRequest,
    @Param('senderNumberId') senderNumberId: string,
    @Body() dto: ReviewSenderNumberDto
  ) {
    this.assertSuperAdmin(req);
    return this.service.requestSupplementForOperator(senderNumberId, req.sessionUser!.userId, dto.memo);
  }

  @Post('admin/sender-number-reviews/sync')
  @ApiOperation({ summary: 'SMS API sendNos 재조회 (내부 승인과 별개)' })
  syncApproved(@Req() req: SessionRequest) {
    this.assertWorkspaceAdmin(req);
    return this.service.syncApprovedFromNhn(req.sessionUser!.tenantId, req.sessionUser!.userId);
  }

  @Get('internal/sender-number-applications')
  @ApiOperation({ summary: '내부 운영용 전체 발신번호 신청 조회' })
  listAllApplications(@Req() req: SessionRequest) {
    this.assertSuperAdmin(req);
    return this.service.listAllForOperator();
  }

  @Get('internal/nhn-registered-sender-numbers')
  @ApiOperation({ summary: '내부 운영용 등록 완료 발신번호 조회(sendNos)' })
  listNhnRegisteredSendersForOperator(@Req() req: SessionRequest) {
    this.assertSuperAdmin(req);
    return this.service.listRegisteredFromNhnForOperator();
  }

  @Post('internal/sender-number-applications/:senderNumberId/approve')
  @ApiOperation({ summary: '내부 운영용 발신번호 승인' })
  approveForOperator(
    @Req() req: SessionRequest,
    @Param('senderNumberId') senderNumberId: string,
    @Body() dto: ReviewSenderNumberDto
  ) {
    this.assertSuperAdmin(req);
    return this.service.approveForOperator(senderNumberId, req.sessionUser!.userId, dto.memo);
  }

  @Post('internal/sender-number-applications/:senderNumberId/reject')
  @ApiOperation({ summary: '내부 운영용 발신번호 반려' })
  rejectForOperator(
    @Req() req: SessionRequest,
    @Param('senderNumberId') senderNumberId: string,
    @Body() dto: ReviewSenderNumberDto
  ) {
    this.assertSuperAdmin(req);
    return this.service.rejectForOperator(senderNumberId, req.sessionUser!.userId, dto.memo);
  }

  @Post('internal/sender-number-applications/:senderNumberId/request-supplement')
  @ApiOperation({ summary: '내부 운영용 발신번호 서류 보완 요청' })
  requestSupplementForOperator(
    @Req() req: SessionRequest,
    @Param('senderNumberId') senderNumberId: string,
    @Body() dto: ReviewSenderNumberDto
  ) {
    this.assertSuperAdmin(req);
    return this.service.requestSupplementForOperator(senderNumberId, req.sessionUser!.userId, dto.memo);
  }

  @Get('internal/sender-number-applications/:senderNumberId/attachments/:kind')
  @ApiOperation({ summary: '내부 운영용 발신번호 첨부파일 다운로드' })
  async downloadAttachment(
    @Req() req: SessionRequest,
    @Param('senderNumberId') senderNumberId: string,
    @Param('kind') kind: string,
    @Res() res: Response
  ) {
    this.assertSuperAdmin(req);

    if (
      kind !== 'telecom' &&
      kind !== 'consent' &&
      kind !== 'personalInfoConsent' &&
      kind !== 'idCardCopy' &&
      kind !== 'businessRegistration' &&
      kind !== 'relationshipProof' &&
      kind !== 'additional' &&
      kind !== 'employment'
    ) {
      throw new BadRequestException(
        'Attachment kind must be telecom, consent, personalInfoConsent, idCardCopy, businessRegistration, relationshipProof, additional, or employment'
      );
    }

    const file = await this.service.getAttachmentForOperator(senderNumberId, kind);
    res.download(file.filePath, file.fileName);
  }
}
