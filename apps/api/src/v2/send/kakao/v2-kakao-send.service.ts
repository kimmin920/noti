import { Injectable, NotFoundException } from '@nestjs/common';
import {
  MessageChannel
} from '@prisma/client';
import { SessionUser } from '../../../common/session-request.interface';
import { PrismaService } from '../../../database/prisma.service';
import {
  CreateManualAlimtalkRequestDto,
  MessageRequestResponseDto
} from '../../../message-requests/message-requests.dto';
import { MessageRequestsService } from '../../../message-requests/message-requests.service';
import { ProviderResultsService } from '../../../provider-results/provider-results.service';
import { V2KakaoTemplateCatalogService } from '../../shared/v2-kakao-template-catalog.service';
import { V2ReadinessService } from '../../shared/v2-readiness.service';
import { canUsePartnerGroupTemplates } from '../../v2-auth.utils';

@Injectable()
export class V2KakaoSendService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messageRequestsService: MessageRequestsService,
    private readonly providerResultsService: ProviderResultsService,
    private readonly readinessService: V2ReadinessService,
    private readonly kakaoTemplateCatalogService: V2KakaoTemplateCatalogService
  ) {}

  async getReadiness(ownerUserId: string) {
    const readiness = await this.readinessService.getReadinessForUser(ownerUserId);
    const status = readiness.resourceState.kakao;
    const ready = status === 'active';

    return {
      ready,
      status,
      blockers:
        status === 'active'
          ? []
          : [
              {
                code: 'KAKAO_SENDER_PROFILE_REQUIRED',
                message: '사용 가능한 카카오 채널이 없어 알림톡 발송을 시작할 수 없습니다.',
                cta: '발신 자원 관리'
              }
            ]
    };
  }

  async getOptions(sessionUser: SessionUser) {
    const readiness = await this.getReadiness(sessionUser.userId);
    const includePartnerGroupTemplates = canUsePartnerGroupTemplates(sessionUser);

    if (!readiness.ready) {
      return {
        readiness,
        senderProfiles: [],
        templates: [],
        fallbackSenderNumbers: []
      };
    }

    const [catalog, fallbackSenderNumbers] = await Promise.all([
      this.kakaoTemplateCatalogService.getTemplateCatalogForUser(sessionUser.userId, {
        activeOnly: true,
        includeDefaultGroup: includePartnerGroupTemplates,
        groupScope: sessionUser.accessOrigin === 'PUBL' ? 'PUBL' : null
      }),
      this.prisma.senderNumber.findMany({
        where: {
          ownerUserId: sessionUser.userId,
          status: 'APPROVED'
        },
        orderBy: [{ approvedAt: 'desc' }, { updatedAt: 'desc' }],
        select: {
          id: true,
          phoneNumber: true,
          type: true,
          approvedAt: true
        }
      })
    ]);

    return {
      readiness,
      senderProfiles: catalog.senderProfiles.map((item) => ({
        id: item.id,
        plusFriendId: item.plusFriendId,
        senderKey: item.senderKey,
        senderProfileType: item.senderProfileType,
        isDefault: item.isDefault,
        updatedAt: item.updatedAt
      })),
      templates: catalog.items
        .filter((item) => item.providerStatus === 'APR')
        .map((item) => ({
          id: item.id,
          source: item.source,
          ownerKey: item.ownerKey,
          ownerLabel: item.ownerLabel,
          providerStatus: item.providerStatus,
          providerStatusRaw: item.providerStatusRaw,
          providerStatusName: item.providerStatusName,
          templateCode: item.templateCode,
          kakaoTemplateCode: item.kakaoTemplateCode,
          updatedAt: item.updatedAt,
          template: {
            name: item.templateName,
            body: item.templateBody,
            requiredVariables: item.requiredVariables,
            messageType: item.templateMessageType
          }
        })),
      fallbackSenderNumbers
    };
  }

  async createRequest(
    userId: string,
    dto: CreateManualAlimtalkRequestDto
  ): Promise<MessageRequestResponseDto> {
    const request = await this.messageRequestsService.createManualAlimtalkForUser(userId, dto);
    return {
      requestId: request.id,
      status: request.status
    };
  }

  async getRequestStatus(ownerUserId: string, requestId: string) {
    const request = await this.messageRequestsService.getByIdForUser(ownerUserId, requestId);
    const resolved = await this.providerResultsService.resolveMessageRequest(request);

    if (request.resolvedChannel !== MessageChannel.ALIMTALK) {
      throw new NotFoundException('AlimTalk request not found');
    }

    return {
      requestId: request.id,
      status: request.status,
      channel: request.resolvedChannel,
      recipientPhone: request.recipientPhone,
      senderProfileId: request.resolvedSenderProfileId,
      templateId: request.resolvedTemplateId,
      providerTemplateId: request.resolvedProviderTemplateId,
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
