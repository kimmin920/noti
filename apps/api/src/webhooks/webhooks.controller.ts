import { Body, Controller, Headers, HttpCode, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../common/public.decorator';
import { EnvService } from '../common/env';
import { WebhooksService } from './webhooks.service';

@ApiTags('webhooks')
@Controller('v1/webhooks/nhn')
export class WebhooksController {
  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly env: EnvService
  ) {}

  @Public()
  @Post('kakao')
  @HttpCode(204)
  @ApiOperation({ summary: 'Kakao Bizmessage webhook(TSC01~TSC04)' })
  @ApiHeader({ name: 'X-Toast-Webhook-Signature', required: true })
  async kakao(
    @Req() req: Request,
    @Body() body: Record<string, unknown>,
    @Headers('x-toast-webhook-signature') signature?: string
  ): Promise<void> {
    const expected = this.env.nhnWebhookSignatureSecret;
    const verified = !this.env.isPlaceholder(expected) && signature === expected;

    if (!verified && !this.env.isPlaceholder(expected)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    await this.webhooksService.handleKakaoTemplateStatus(req.headers as Record<string, unknown>, body, verified);
  }
}
