import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UploadedFiles,
  UseInterceptors
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnprocessableEntityResponse
} from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { memoryStorage } from 'multer';
import { Public } from '../common/public.decorator';
import { EnvService } from '../common/env';
import { SessionRequest } from '../common/session-request.interface';
import { pickBearerToken, safeCompareSecret } from '../common/utils';
import { CreateManualSmsRequestDto, CreateMessageRequestDto, MessageRequestResponseDto } from './message-requests.dto';
import { CreateManualAlimtalkRequestDto } from './message-requests.dto';
import { MessageRequestsService } from './message-requests.service';

const DIRECT_NHN_UPLOAD_SAFETY_MAX_BYTES = 10 * 1024 * 1024;

@ApiTags('message-requests')
@Controller('v1/message-requests')
export class MessageRequestsController {
  constructor(
    private readonly service: MessageRequestsService,
    private readonly env: EnvService
  ) {}

  private assertPublToken(req: Request): void {
    if (this.env.isPlaceholder(this.env.publServiceToken)) {
      return;
    }

    const token = pickBearerToken(req.headers.authorization);
    if (!safeCompareSecret(token, this.env.publServiceToken)) {
      throw new UnauthorizedException('Invalid Publ service token');
    }
  }

  @Public()
  @Post()
  @HttpCode(202)
  @ApiBearerAuth()
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Publ 이벤트 수신(비동기 접수)' })
  @ApiAcceptedResponse({ type: MessageRequestResponseDto })
  @ApiUnprocessableEntityResponse({ description: 'requiredVariables missing' })
  async create(
    @Req() req: Request,
    @Body() dto: CreateMessageRequestDto,
    @Headers('idempotency-key') idempotencyKey?: string
  ): Promise<MessageRequestResponseDto> {
    this.assertPublToken(req);

    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    const result = await this.service.create(dto, idempotencyKey);
    return {
      requestId: result.request.id,
      status: result.request.status,
      idempotent: result.idempotent
    };
  }

  @Public()
  @Get(':requestId')
  @ApiParam({ name: 'requestId' })
  @ApiOperation({ summary: '메시지 요청 상태 조회' })
  async getById(@Req() req: Request, @Param('requestId') requestId: string) {
    this.assertPublToken(req);
    return this.service.getById(requestId);
  }

  @Post('manual-sms')
  @HttpCode(202)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'attachments', maxCount: 3 }], {
      storage: memoryStorage(),
      limits: {
        fileSize: DIRECT_NHN_UPLOAD_SAFETY_MAX_BYTES,
        files: 3
      }
    })
  )
  @ApiOperation({ summary: '사업자 직접 SMS 발송(템플릿 없이 큐 접수)' })
  async createManualSms(
    @Req() req: SessionRequest,
    @Body() dto: CreateManualSmsRequestDto,
    @UploadedFiles()
    files: {
      attachments?: Express.Multer.File[];
    }
  ): Promise<MessageRequestResponseDto> {
    if (!req.sessionUser || (req.sessionUser.role !== 'USER' && req.sessionUser.role !== 'PARTNER_ADMIN')) {
      throw new ForbiddenException('USER or PARTNER_ADMIN role is required');
    }

    const result = await this.service.createManualSmsRequestsForUser(req.sessionUser.userId, dto, files.attachments ?? []);
    const request = result[0]!;
    return {
      requestId: request.id,
      requestIds: result.map((item) => item.id),
      acceptedCount: result.length,
      status: request.status
    };
  }

  @Post('manual-alimtalk')
  @HttpCode(202)
  @ApiOperation({ summary: '사업자 직접 알림톡 발송(채널/템플릿 선택 후 큐 접수)' })
  async createManualAlimtalk(
    @Req() req: SessionRequest,
    @Body() dto: CreateManualAlimtalkRequestDto
  ): Promise<MessageRequestResponseDto> {
    if (!req.sessionUser || (req.sessionUser.role !== 'USER' && req.sessionUser.role !== 'PARTNER_ADMIN')) {
      throw new ForbiddenException('USER or PARTNER_ADMIN role is required');
    }

    const result = await this.service.createManualAlimtalkRequestsForUser(req.sessionUser.userId, dto);
    const request = result[0]!;
    return {
      requestId: request.id,
      requestIds: result.map((item) => item.id),
      acceptedCount: result.length,
      status: request.status
    };
  }
}
