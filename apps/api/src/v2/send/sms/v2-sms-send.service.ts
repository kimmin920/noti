import { Injectable, NotFoundException } from '@nestjs/common';
import { MessageChannel, TemplateStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import {
  CreateManualSmsRequestDto,
  MessageRequestResponseDto
} from '../../../message-requests/message-requests.dto';
import { MessageRequestsService } from '../../../message-requests/message-requests.service';
import { V2ReadinessService } from '../../shared/v2-readiness.service';

interface UploadedManualSmsAttachment {
  path: string;
  originalname: string;
  mimetype?: string;
  size: number;
}

@Injectable()
export class V2SmsSendService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messageRequestsService: MessageRequestsService,
    private readonly readinessService: V2ReadinessService
  ) {}

  async getReadiness(tenantId: string) {
    const readiness = await this.readinessService.getReadiness(tenantId);
    const status = readiness.resourceState.sms;
    const ready = status === 'active';

    return {
      ready,
      status,
      blockers:
        status === 'active'
          ? []
          : [
              {
                code: status === 'pending' ? 'SMS_SENDER_NUMBER_PENDING' : 'SMS_SENDER_NUMBER_REQUIRED',
                message:
                  status === 'pending'
                    ? '승인 대기 중인 발신번호가 있어 SMS 발송은 심사 완료 후 사용할 수 있습니다.'
                    : '승인된 발신번호가 없어 SMS 발송을 시작할 수 없습니다.',
                cta: '발신 자원 관리'
              }
            ]
    };
  }

  async getOptions(tenantId: string) {
    const readiness = await this.getReadiness(tenantId);

    if (!readiness.ready) {
      return {
        readiness,
        senderNumbers: [],
        templates: []
      };
    }

    const [senderNumbers, templates] = await Promise.all([
      this.prisma.senderNumber.findMany({
        where: {
          tenantId,
          status: 'APPROVED'
        },
        orderBy: [{ approvedAt: 'desc' }, { updatedAt: 'desc' }],
        select: {
          id: true,
          phoneNumber: true,
          type: true,
          approvedAt: true,
          updatedAt: true
        }
      }),
      this.prisma.template.findMany({
        where: {
          tenantId,
          channel: MessageChannel.SMS,
          status: TemplateStatus.PUBLISHED
        },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          body: true,
          requiredVariables: true,
          updatedAt: true
        }
      })
    ]);

    return {
      readiness,
      senderNumbers,
      templates
    };
  }

  async createRequest(
    tenantId: string,
    userId: string,
    dto: CreateManualSmsRequestDto,
    files: UploadedManualSmsAttachment[]
  ): Promise<MessageRequestResponseDto> {
    const request = await this.messageRequestsService.createManualSms(tenantId, userId, dto, files);
    return {
      requestId: request.id,
      status: request.status
    };
  }

  async getRequestStatus(tenantId: string, requestId: string) {
    const request = await this.messageRequestsService.getByIdForTenant(tenantId, requestId);

    if (request.resolvedChannel !== MessageChannel.SMS) {
      throw new NotFoundException('SMS request not found');
    }

    return {
      requestId: request.id,
      status: request.status,
      channel: request.resolvedChannel,
      recipientPhone: request.recipientPhone,
      senderNumberId: request.resolvedSenderNumberId,
      templateId: request.resolvedTemplateId,
      scheduledAt: request.scheduledAt,
      lastErrorCode: request.lastErrorCode,
      lastErrorMessage: request.lastErrorMessage,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      latestAttempt: request.attempts[0] ?? null,
      latestDeliveryResult: request.deliveryResults[0] ?? null
    };
  }
}
