import { BadRequestException, Body, Controller, Headers, HttpCode, Post, Req, UnauthorizedException } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse
} from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../common/public.decorator';
import { EnvService } from '../common/env';
import { pickBearerToken } from '../common/utils';
import { CreatePublEventRequestDto, MessageRequestResponseDto } from './message-requests.dto';
import { MessageRequestsService } from './message-requests.service';

@ApiTags('publ-events')
@Controller('v1/publ/events')
export class PublEventsController {
  constructor(
    private readonly service: MessageRequestsService,
    private readonly env: EnvService
  ) {}

  private assertPublToken(req: Request): void {
    if (this.env.isPlaceholder(this.env.publServiceToken)) {
      return;
    }

    const token = pickBearerToken(req.headers.authorization);
    if (!token || token !== this.env.publServiceToken) {
      throw new UnauthorizedException('Invalid Publ service token');
    }
  }

  @Public()
  @Post()
  @HttpCode(202)
  @ApiBearerAuth()
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Publ 원본 이벤트 수신(providerUserId 기반)' })
  @ApiAcceptedResponse({ type: MessageRequestResponseDto })
  @ApiUnprocessableEntityResponse({ description: 'recipient phone or requiredVariables missing' })
  async create(
    @Req() req: Request,
    @Body() dto: CreatePublEventRequestDto,
    @Headers('idempotency-key') idempotencyKey?: string
  ): Promise<MessageRequestResponseDto> {
    this.assertPublToken(req);

    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    const result = await this.service.createFromPublEvent(dto, idempotencyKey);
    return {
      requestId: result.request.id,
      status: result.request.status,
      idempotent: result.idempotent
    };
  }

}
