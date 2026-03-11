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

  private assertRole(req: SessionRequest, expectedRole: 'TENANT_ADMIN' | 'OPERATOR') {
    if (!req.sessionUser || req.sessionUser.role !== expectedRole) {
      throw new ForbiddenException(`${expectedRole} role is required`);
    }
  }

  @Get('sender-numbers')
  @ApiOperation({ summary: '발신번호 목록' })
  list(@Req() req: SessionRequest) {
    this.assertRole(req, 'TENANT_ADMIN');
    return this.service.list(req.sessionUser!.tenantId);
  }

  @Post('sender-numbers/apply')
  @ApiOperation({ summary: '발신번호 신청 + 서류 업로드' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'telecomCertificate', maxCount: 1 },
        { name: 'employmentCertificate', maxCount: 1 }
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
      employmentCertificate?: Express.Multer.File[];
    }
  ) {
    this.assertRole(req, 'TENANT_ADMIN');
    return this.service.apply(req.sessionUser!.tenantId, dto, {
      telecom: files.telecomCertificate?.[0]?.path,
      employment: files.employmentCertificate?.[0]?.path
    });
  }

  @Get('admin/sender-number-reviews')
  @ApiOperation({ summary: '운영자 검수 큐 조회(SUBMITTED)' })
  reviewQueue(@Req() req: SessionRequest) {
    this.assertRole(req, 'OPERATOR');
    return this.service.listAllForOperator();
  }

  @Get('admin/sender-number-reviews/nhn-registered')
  @ApiOperation({ summary: 'NHN sendNos 기반 등록 완료 발신번호 조회' })
  listRegisteredFromNhn(@Req() req: SessionRequest) {
    this.assertRole(req, 'TENANT_ADMIN');
    return this.service.listRegisteredFromNhn(req.sessionUser!.tenantId);
  }

  @Post('admin/sender-number-reviews/:senderNumberId/approve')
  @ApiOperation({ summary: '발신번호 승인' })
  approve(
    @Req() req: SessionRequest,
    @Param('senderNumberId') senderNumberId: string,
    @Body() dto: ReviewSenderNumberDto
  ) {
    this.assertRole(req, 'OPERATOR');
    return this.service.approveForOperator(senderNumberId, req.sessionUser!.userId, dto.memo);
  }

  @Post('admin/sender-number-reviews/:senderNumberId/reject')
  @ApiOperation({ summary: '발신번호 반려' })
  reject(
    @Req() req: SessionRequest,
    @Param('senderNumberId') senderNumberId: string,
    @Body() dto: ReviewSenderNumberDto
  ) {
    this.assertRole(req, 'OPERATOR');
    return this.service.rejectForOperator(senderNumberId, req.sessionUser!.userId, dto.memo);
  }

  @Post('admin/sender-number-reviews/sync')
  @ApiOperation({ summary: 'SMS API sendNos 기반 승인번호 동기화' })
  syncApproved(@Req() req: SessionRequest) {
    this.assertRole(req, 'TENANT_ADMIN');
    return this.service.syncApprovedFromNhn(req.sessionUser!.tenantId);
  }

  @Get('internal/sender-number-applications')
  @ApiOperation({ summary: '내부 운영용 전체 발신번호 신청 조회' })
  listAllApplications(@Req() req: SessionRequest) {
    this.assertRole(req, 'OPERATOR');
    return this.service.listAllForOperator();
  }

  @Get('internal/nhn-registered-sender-numbers')
  @ApiOperation({ summary: '내부 운영용 NHN 등록 완료 발신번호 조회(sendNos)' })
  listNhnRegisteredSendersForOperator(@Req() req: SessionRequest) {
    this.assertRole(req, 'OPERATOR');
    return this.service.listRegisteredFromNhnForOperator();
  }

  @Post('internal/sender-number-applications/:senderNumberId/approve')
  @ApiOperation({ summary: '내부 운영용 발신번호 승인' })
  approveForOperator(
    @Req() req: SessionRequest,
    @Param('senderNumberId') senderNumberId: string,
    @Body() dto: ReviewSenderNumberDto
  ) {
    this.assertRole(req, 'OPERATOR');
    return this.service.approveForOperator(senderNumberId, req.sessionUser!.userId, dto.memo);
  }

  @Post('internal/sender-number-applications/:senderNumberId/reject')
  @ApiOperation({ summary: '내부 운영용 발신번호 반려' })
  rejectForOperator(
    @Req() req: SessionRequest,
    @Param('senderNumberId') senderNumberId: string,
    @Body() dto: ReviewSenderNumberDto
  ) {
    this.assertRole(req, 'OPERATOR');
    return this.service.rejectForOperator(senderNumberId, req.sessionUser!.userId, dto.memo);
  }

  @Get('internal/sender-number-applications/:senderNumberId/attachments/:kind')
  @ApiOperation({ summary: '내부 운영용 발신번호 첨부파일 다운로드' })
  async downloadAttachment(
    @Req() req: SessionRequest,
    @Param('senderNumberId') senderNumberId: string,
    @Param('kind') kind: string,
    @Res() res: Response
  ) {
    this.assertRole(req, 'OPERATOR');

    if (kind !== 'telecom' && kind !== 'employment') {
      throw new BadRequestException('Attachment kind must be telecom or employment');
    }

    const file = await this.service.getAttachmentForOperator(senderNumberId, kind);
    res.download(file.filePath, file.fileName);
  }
}
