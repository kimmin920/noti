import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { ApiConsumes, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { SessionAuthGuard } from '../../../auth/session-auth.guard';
import { SessionRequest } from '../../../common/session-request.interface';
import { CreateManualSmsRequestDto } from '../../../message-requests/message-requests.dto';
import { assertAccountUser } from '../../v2-auth.utils';
import { V2_ROUTE_PREFIX } from '../../v2.constants';
import { V2SmsSendService } from './v2-sms-send.service';

function fileNameBuilder(_req: unknown, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) {
  const unique = `${Date.now()}_${Math.round(Math.random() * 1_000_000)}`;
  cb(null, `${unique}${extname(file.originalname)}`);
}

@ApiTags('v2-send-sms')
@ApiCookieAuth('pm_session')
@UseGuards(SessionAuthGuard)
@Controller(`${V2_ROUTE_PREFIX}/send/sms`)
export class V2SmsSendController {
  constructor(private readonly service: V2SmsSendService) {}

  @Get('readiness')
  @ApiOperation({ summary: 'V2 SMS 발송 readiness' })
  getReadiness(@Req() req: SessionRequest) {
    const sessionUser = assertAccountUser(req);
    return this.service.getReadiness(sessionUser.userId);
  }

  @Get('options')
  @ApiOperation({ summary: 'V2 SMS 발송 옵션 조회' })
  getOptions(@Req() req: SessionRequest) {
    const sessionUser = assertAccountUser(req);
    return this.service.getOptions(sessionUser.userId);
  }

  @Post('requests')
  @HttpCode(202)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'attachments', maxCount: 3 }], {
      storage: diskStorage({
        destination: 'uploads',
        filename: fileNameBuilder
      })
    })
  )
  @ApiOperation({ summary: 'V2 직접 SMS 발송 요청 접수' })
  createRequest(
    @Req() req: SessionRequest,
    @Body() dto: CreateManualSmsRequestDto,
    @UploadedFiles()
    files: {
      attachments?: Express.Multer.File[];
    }
  ) {
    const sessionUser = assertAccountUser(req);
    return this.service.createRequest(sessionUser.userId, dto, files.attachments ?? []);
  }

  @Get('requests/:requestId')
  @ApiOperation({ summary: 'V2 SMS 발송 요청 상태 조회' })
  getRequestStatus(@Req() req: SessionRequest, @Param('requestId') requestId: string) {
    return this.service.getRequestStatus(assertAccountUser(req).userId, requestId);
  }
}
