import { Injectable, NotFoundException } from '@nestjs/common';
import { MessageChannel, TemplateStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import {
  CreateManualSmsRequestDto,
  MessageRequestResponseDto
} from '../../../message-requests/message-requests.dto';
import { MessageRequestsService } from '../../../message-requests/message-requests.service';
import { ProviderResultsService } from '../../../provider-results/provider-results.service';
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
    private readonly providerResultsService: ProviderResultsService,
    private readonly readinessService: V2ReadinessService
  ) {}

  async getReadiness(ownerUserId: string) {
    const readiness = await this.readinessService.getReadinessForUser(ownerUserId);
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
                code:
                  status === 'pending'
                    ? 'SMS_SENDER_NUMBER_PENDING'
                    : status === 'supplement'
                      ? 'SMS_SENDER_NUMBER_SUPPLEMENT_REQUESTED'
                    : status === 'rejected'
                      ? 'SMS_SENDER_NUMBER_REJECTED'
                      : 'SMS_SENDER_NUMBER_REQUIRED',
                message:
                  status === 'pending'
                    ? '승인 대기 중인 발신번호가 있어 SMS 발송은 심사 완료 후 사용할 수 있습니다.'
                    : status === 'supplement'
                      ? '서류 보완 요청이 있는 발신번호가 있어 SMS 발송을 시작할 수 없습니다. 신청서를 수정해 다시 제출해 주세요.'
                    : status === 'rejected'
                      ? '반려된 발신번호 신청이 있어 SMS 발송을 시작할 수 없습니다. 신청서를 수정해 다시 제출해 주세요.'
                      : '승인된 발신번호가 없어 SMS 발송을 시작할 수 없습니다.',
                cta: '발신 자원 관리'
              }
            ]
    };
  }

  async getOptions(ownerUserId: string) {
    const readiness = await this.getReadiness(ownerUserId);

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
          ownerUserId: ownerUserId,
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
          ownerUserId: ownerUserId,
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
    userId: string,
    dto: CreateManualSmsRequestDto,
    files: UploadedManualSmsAttachment[]
  ): Promise<MessageRequestResponseDto> {
    const request = await this.messageRequestsService.createManualSmsForUser(userId, dto, files);
    return {
      requestId: request.id,
      status: request.status
    };
  }

  async getRequestStatus(ownerUserId: string, requestId: string) {
    const request = await this.messageRequestsService.getByIdForUser(ownerUserId, requestId);
    const resolved = await this.providerResultsService.resolveMessageRequest(request);

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
      lastErrorCode: resolved.lastErrorCode,
      lastErrorMessage: resolved.lastErrorMessage,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      latestAttempt: request.attempts[0] ?? null,
      latestDeliveryResult: resolved.latestDeliveryResult
    };
  }

}
