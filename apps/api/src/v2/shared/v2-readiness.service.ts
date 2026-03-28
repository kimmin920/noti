import { Injectable } from '@nestjs/common';
import { SenderNumberStatus, SenderProfileStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

type SmsReadinessStatus = 'none' | 'pending' | 'active';
type KakaoReadinessStatus = 'none' | 'active';

@Injectable()
export class V2ReadinessService {
  constructor(private readonly prisma: PrismaService) {}

  async getReadiness(tenantId: string) {
    const [
      senderNumberTotalCount,
      senderNumberSubmittedCount,
      senderNumberApprovedCount,
      senderNumberRejectedCount,
      senderProfileTotalCount,
      senderProfileActiveCount,
      senderProfileBlockedCount,
      senderProfileDormantCount,
      senderProfileUnknownCount
    ] = await Promise.all([
      this.prisma.senderNumber.count({ where: { tenantId } }),
      this.prisma.senderNumber.count({
        where: {
          tenantId,
          status: SenderNumberStatus.SUBMITTED
        }
      }),
      this.prisma.senderNumber.count({
        where: {
          tenantId,
          status: SenderNumberStatus.APPROVED
        }
      }),
      this.prisma.senderNumber.count({
        where: {
          tenantId,
          status: SenderNumberStatus.REJECTED
        }
      }),
      this.prisma.senderProfile.count({ where: { tenantId } }),
      this.prisma.senderProfile.count({
        where: {
          tenantId,
          status: SenderProfileStatus.ACTIVE
        }
      }),
      this.prisma.senderProfile.count({
        where: {
          tenantId,
          status: SenderProfileStatus.BLOCKED
        }
      }),
      this.prisma.senderProfile.count({
        where: {
          tenantId,
          status: SenderProfileStatus.DORMANT
        }
      }),
      this.prisma.senderProfile.count({
        where: {
          tenantId,
          status: SenderProfileStatus.UNKNOWN
        }
      })
    ]);

    const smsStatus: SmsReadinessStatus =
      senderNumberApprovedCount > 0 ? 'active' : senderNumberSubmittedCount > 0 ? 'pending' : 'none';
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
