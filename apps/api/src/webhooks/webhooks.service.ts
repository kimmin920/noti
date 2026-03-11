import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

const WEBHOOK_STATUS_MAP: Record<string, 'REG' | 'REQ' | 'APR' | 'REJ'> = {
  TSC01: 'REQ',
  TSC02: 'REQ',
  TSC03: 'APR',
  TSC04: 'REJ'
};

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  async handleKakaoTemplateStatus(headers: Record<string, unknown>, body: Record<string, unknown>, verified: boolean) {
    const webhook = await this.prisma.webhookEvent.create({
      data: {
        headersJson: headers as Prisma.InputJsonValue,
        bodyJson: body as Prisma.InputJsonValue,
        verified,
        eventType: 'TEMPLATE_STATUS_UPDATE'
      }
    });

    try {
      const statusCode = String(body.status || body.templateStatus || '');
      const providerStatus = WEBHOOK_STATUS_MAP[statusCode];

      if (providerStatus) {
        const nhnTemplateId =
          (body.templateId as string | undefined) ||
          (body.template_id as string | undefined) ||
          (body.templateCode as string | undefined);
        const templateCode = (body.templateCode as string | undefined) || null;

        if (nhnTemplateId) {
          await this.prisma.providerTemplate.updateMany({
            where: {
              OR: [{ nhnTemplateId }, { templateCode: nhnTemplateId }, { kakaoTemplateCode: nhnTemplateId }]
            },
            data: {
              providerStatus,
              ...(templateCode
                ? {
                    templateCode,
                    kakaoTemplateCode: templateCode
                  }
                : {}),
              rejectedReason: (body.rejectReason as string | undefined) || null,
              lastSyncedAt: new Date()
            }
          });
        }
      }

      await this.prisma.webhookEvent.update({
        where: { id: webhook.id },
        data: {
          processedAt: new Date()
        }
      });
    } catch (error) {
      this.logger.error('Failed to process webhook', error as Error);

      await this.prisma.webhookEvent.update({
        where: { id: webhook.id },
        data: {
          processedAt: new Date(),
          processError: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }
}
