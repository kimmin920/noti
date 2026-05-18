import { Injectable, NotFoundException } from '@nestjs/common';
import { MessageChannel } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import {
  CreateManualSmsRequestDto,
  MessageRequestResponseDto
} from '../../../message-requests/message-requests.dto';
import { MessageRequestsService } from '../../../message-requests/message-requests.service';
import { NhnService } from '../../../nhn/nhn.service';
import { ProviderResultsService } from '../../../provider-results/provider-results.service';
import { V2ReadinessService } from '../../shared/v2-readiness.service';
import {
  findUserSmsTemplateCategory,
  summarizeNhnSmsTemplateItem
} from '../../shared/v2-sms-template.utils';

type UploadedManualSmsAttachment = Express.Multer.File & { buffer: Buffer };

@Injectable()
export class V2SmsSendService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messageRequestsService: MessageRequestsService,
    private readonly providerResultsService: ProviderResultsService,
    private readonly readinessService: V2ReadinessService,
    private readonly nhnService: NhnService
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

    const senderNumbers = await this.prisma.senderNumber.findMany({
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
    });
    const templates = await this.fetchNhnSmsTemplatesForUser(ownerUserId);

    return {
      readiness,
      senderNumbers,
      templates: templates.map((template) => summarizeNhnSmsTemplateItem(template, senderNumbers))
    };
  }

  private async fetchNhnSmsTemplatesForUser(ownerUserId: string) {
    const category = await this.nhnService
      .fetchSmsTemplateCategories()
      .then((items) => findUserSmsTemplateCategory(items, ownerUserId))
      .catch(() => null);

    if (!category) {
      return [];
    }

    return this.nhnService
      .fetchSmsTemplates({
        categoryId: category.categoryId,
        useYn: 'Y',
        pageNum: 1,
        pageSize: 1000
      })
      .then((response) => response.templates)
      .catch(() => []);
  }

  async createRequest(
    userId: string,
    dto: CreateManualSmsRequestDto,
    files: UploadedManualSmsAttachment[]
  ): Promise<MessageRequestResponseDto> {
    const requests = await this.messageRequestsService.createManualSmsRequestsForUser(userId, dto, files);
    const request = requests[0]!;
    return {
      requestId: request.id,
      requestIds: requests.map((item) => item.id),
      acceptedCount: requests.length,
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
