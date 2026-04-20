import { Injectable } from '@nestjs/common';
import { SenderNumberStatus, SenderProfileStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

type SmsReadinessStatus = 'none' | 'pending' | 'supplement' | 'rejected' | 'active';
type KakaoReadinessStatus = 'none' | 'active';

@Injectable()
export class V2ReadinessService {
  constructor(private readonly prisma: PrismaService) {}

  async getReadinessForUser(ownerUserId: string) {
    return this.getReadinessByOwnerUserId(ownerUserId);
  }

  private async getReadinessByOwnerUserId(ownerUserId: string) {
    const [
      senderNumberTotalCount,
      senderNumberSubmittedCount,
      senderNumberSupplementRequestedCount,
      senderNumberApprovedCount,
      senderNumberRejectedCount,
      senderProfileTotalCount,
      senderProfileActiveCount,
      senderProfileBlockedCount,
      senderProfileDormantCount,
      senderProfileUnknownCount
    ] = await Promise.all([
      this.prisma.senderNumber.count({ where: { ownerUserId } }),
      this.prisma.senderNumber.count({
        where: {
          ownerUserId,
          status: SenderNumberStatus.SUBMITTED
        }
      }),
      this.prisma.senderNumber.count({
        where: {
          ownerUserId,
          status: SenderNumberStatus.SUPPLEMENT_REQUESTED
        }
      }),
      this.prisma.senderNumber.count({
        where: {
          ownerUserId,
          status: SenderNumberStatus.APPROVED
        }
      }),
      this.prisma.senderNumber.count({
        where: {
          ownerUserId,
          status: SenderNumberStatus.REJECTED
        }
      }),
      this.prisma.senderProfile.count({ where: { ownerUserId } }),
      this.prisma.senderProfile.count({
        where: {
          ownerUserId,
          status: SenderProfileStatus.ACTIVE
        }
      }),
      this.prisma.senderProfile.count({
        where: {
          ownerUserId,
          status: SenderProfileStatus.BLOCKED
        }
      }),
      this.prisma.senderProfile.count({
        where: {
          ownerUserId,
          status: SenderProfileStatus.DORMANT
        }
      }),
      this.prisma.senderProfile.count({
        where: {
          ownerUserId,
          status: SenderProfileStatus.UNKNOWN
        }
      })
    ]);

    const smsStatus: SmsReadinessStatus =
      senderNumberApprovedCount > 0
        ? 'active'
        : senderNumberSupplementRequestedCount > 0
          ? 'supplement'
          : senderNumberSubmittedCount > 0
            ? 'pending'
            : senderNumberRejectedCount > 0
              ? 'rejected'
              : 'none';
    const kakaoStatus: KakaoReadinessStatus = senderProfileActiveCount > 0 ? 'active' : 'none';
    const pendingSetupCount = Number(smsStatus !== 'active') + Number(kakaoStatus !== 'active');

    return {
      resourceState: {
        sms: smsStatus,
        kakao: kakaoStatus
      },
      sms: {
        status: smsStatus,
        totalCount: senderNumberTotalCount,
        approvedCount: senderNumberApprovedCount,
        submittedCount: senderNumberSubmittedCount,
        supplementRequestedCount: senderNumberSupplementRequestedCount,
        rejectedCount: senderNumberRejectedCount
      },
      kakao: {
        status: kakaoStatus,
        totalCount: senderProfileTotalCount,
        activeCount: senderProfileActiveCount,
        blockedCount: senderProfileBlockedCount,
        dormantCount: senderProfileDormantCount,
        unknownCount: senderProfileUnknownCount
      },
      pendingSetupCount,
      allReady: pendingSetupCount === 0,
      nextRequiredAction:
        smsStatus !== 'active' ? 'SMS_SENDER_NUMBER' : kakaoStatus !== 'active' ? 'KAKAO_CHANNEL' : null
    };
  }
}
