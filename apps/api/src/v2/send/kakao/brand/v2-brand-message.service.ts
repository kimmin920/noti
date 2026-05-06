import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SessionUser } from '../../../../common/session-request.interface';
import { PrismaService } from '../../../../database/prisma.service';
import { MessageRequestResponseDto } from '../../../../message-requests/message-requests.dto';
import { MessageRequestsService } from '../../../../message-requests/message-requests.service';
import { NhnService } from '../../../../nhn/nhn.service';
import { V2ReadinessService } from '../../../shared/v2-readiness.service';
import { CreateManualBrandMessageRequestDto } from './v2-brand-message.dto';

@Injectable()
export class V2BrandMessageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messageRequestsService: MessageRequestsService,
    private readonly nhnService: NhnService,
    private readonly readinessService: V2ReadinessService
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
                message: '브랜드 메시지는 연결된 카카오 채널이 있을 때 시작할 수 있습니다.',
                cta: '발신 자원 관리'
              }
            ]
    };
  }

  async getOptions(sessionUser: SessionUser) {
    const readiness = await this.getReadiness(sessionUser.userId);

    if (!readiness.ready) {
        return {
          readiness,
          senderProfiles: [],
          supportedModes: ['FREESTYLE', 'TEMPLATE'],
          supportedTargetings: ['I'],
          supportedMessageTypes: ['TEXT', 'IMAGE', 'WIDE'],
          tabs: buildBrandMessageTabs(),
          constraints: buildBrandMessageConstraints()
        };
    }

    const senderProfiles = await this.prisma.senderProfile.findMany({
      where: {
        ownerUserId: sessionUser.userId,
        status: 'ACTIVE'
      },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        plusFriendId: true,
        senderKey: true,
        senderProfileType: true,
        status: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return {
      readiness,
      senderProfiles,
      supportedModes: ['FREESTYLE', 'TEMPLATE'],
      supportedTargetings: ['I'],
      supportedMessageTypes: ['TEXT', 'IMAGE', 'WIDE'],
      tabs: buildBrandMessageTabs(),
      constraints: buildBrandMessageConstraints()
    };
  }

  async createRequest(
    userId: string,
    dto: CreateManualBrandMessageRequestDto
  ): Promise<MessageRequestResponseDto> {
    const request = await this.messageRequestsService.createManualBrandMessageForUser(userId, dto);

    return {
      requestId: request.id,
      status: request.status
    };
  }

  async uploadImage(sessionUser: SessionUser, file: Express.Multer.File, messageType: 'IMAGE' | 'WIDE') {
    const readiness = await this.getReadiness(sessionUser.userId);
    if (!readiness.ready) {
      throw new BadRequestException(readiness.blockers[0]?.message || '브랜드 메시지 발송 준비가 완료되지 않았습니다.');
    }

    if (!file) {
      throw new BadRequestException('업로드할 이미지 파일을 선택해 주세요.');
    }

    if (!['image/jpeg', 'image/png'].includes(file.mimetype)) {
      throw new BadRequestException('브랜드 메시지 이미지는 JPG 또는 PNG만 업로드할 수 있습니다.');
    }

    if (typeof file.size === 'number' && file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('브랜드 메시지 이미지는 5MB 이하만 업로드할 수 있습니다.');
    }

    const image = await this.nhnService.uploadBrandMessageImage(file, {
      imageType: messageType === 'WIDE' ? 'WIDE_IMAGE' : 'IMAGE'
    });

    if (!image.imageUrl) {
      throw new BadRequestException('업로드된 이미지 URL을 확인하지 못했습니다.');
    }

    return image;
  }

}

function buildBrandMessageTabs() {
  return [
    { id: 'regular', label: '일반 발송', enabled: true },
    { id: 'mass', label: '대량 발송', enabled: false },
    { id: 'templates', label: '템플릿 관리', enabled: false },
    { id: 'unsubscribe', label: '080 수신거부', enabled: false },
    { id: 'mn-activation', label: 'M/N 사용 신청', enabled: false }
  ] as const;
}

function buildBrandMessageConstraints() {
  return {
    nightSendRestricted: true,
    nightSendWindow: {
      start: '20:50',
      end: '08:00'
    },
    supportedFeatures: {
      pushAlarm: true,
      statsEventKey: false,
      resellerCode: false,
      adult: true,
      schedule: true,
      buttons: true,
      preview: true,
      coupon: false,
      template: true,
      mnTargeting: false,
      massUpload: false,
      unsubscribePerRecipient: false,
      resendPerRecipient: false
    }
  };
}
