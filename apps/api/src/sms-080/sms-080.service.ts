import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Sms080ServiceStatus, Sms080ServiceType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateSms080ApplicationDto, ReviewSms080ApplicationDto } from './sms-080.dto';

const DEFAULT_NHN_PROVIDER_NAME = 'NHN Cloud';
const DEFAULT_EXTERNAL_PROVIDER_NAME = '외부 080 제공 업체';

@Injectable()
export class Sms080ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(ownerUserId: string) {
    return this.prisma.sms080Service.findMany({
      where: { ownerUserId },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }]
    });
  }

  async createApplication(ownerUserId: string, dto: CreateSms080ApplicationDto) {
    const owner = await this.getOwnerContext(ownerUserId);
    const businessName = dto.businessName?.trim() || this.buildOwnerLabel(owner);

    if (dto.type === Sms080ServiceType.NHN_MANAGED) {
      const pendingManaged = await this.prisma.sms080Service.findFirst({
        where: {
          ownerUserId,
          type: Sms080ServiceType.NHN_MANAGED,
          status: Sms080ServiceStatus.SUBMITTED
        }
      });

      if (pendingManaged) {
        throw new ConflictException('이미 심사 중인 080 신규 신청이 있습니다.');
      }

      return this.prisma.sms080Service.create({
        data: {
          ownerUserId,
          type: Sms080ServiceType.NHN_MANAGED,
          status: Sms080ServiceStatus.SUBMITTED,
          unsubscribeNumber: null,
          businessName,
          providerName: DEFAULT_NHN_PROVIDER_NAME,
          reviewMemo: null,
          reviewedBy: null,
          approvedAt: null
        }
      });
    }

    if (dto.type === Sms080ServiceType.EXTERNAL) {
      const unsubscribeNumber = this.normalize080Number(dto.unsubscribeNumber);
      const providerName = dto.providerName?.trim() || DEFAULT_EXTERNAL_PROVIDER_NAME;
      const existing = await this.prisma.sms080Service.findFirst({
        where: {
          ownerUserId,
          unsubscribeNumber
        }
      });

      if (existing?.status === Sms080ServiceStatus.SUBMITTED) {
        throw new ConflictException('이미 심사 중인 080 번호입니다.');
      }

      if (existing?.status === Sms080ServiceStatus.APPROVED) {
        throw new ConflictException('이미 등록된 080 번호입니다.');
      }

      const data = {
        ownerUserId,
        type: Sms080ServiceType.EXTERNAL,
        status: Sms080ServiceStatus.SUBMITTED,
        unsubscribeNumber,
        businessName,
        providerName,
        reviewMemo: null,
        reviewedBy: null,
        approvedAt: null
      };

      if (existing) {
        return this.prisma.sms080Service.update({
          where: { id: existing.id },
          data
        });
      }

      return this.prisma.sms080Service.create({ data });
    }

    throw new BadRequestException('지원하지 않는 080 신청 유형입니다.');
  }

  async listAllForOperator() {
    const items = await this.prisma.sms080Service.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }]
    });

    const owners = await this.loadOwners(items.map((item) => item.ownerUserId));
    return items.map((item) => ({
      ...item,
      user: {
        id: item.ownerUserId,
        name: this.buildOwnerLabel(owners.get(item.ownerUserId))
      }
    }));
  }

  async approveForOperator(applicationId: string, reviewerId: string, dto: ReviewSms080ApplicationDto) {
    const application = await this.prisma.sms080Service.findUnique({
      where: { id: applicationId }
    });

    if (!application) {
      throw new NotFoundException('080 application not found');
    }

    const unsubscribeNumber =
      application.type === Sms080ServiceType.NHN_MANAGED
        ? this.normalize080Number(dto.unsubscribeNumber)
        : dto.unsubscribeNumber
          ? this.normalize080Number(dto.unsubscribeNumber)
          : application.unsubscribeNumber;

    if (!unsubscribeNumber) {
      throw new BadRequestException('승인할 080 번호를 입력해 주세요.');
    }

    await this.assertNoDuplicateNumber(application.ownerUserId, unsubscribeNumber, application.id);

    return this.prisma.sms080Service.update({
      where: { id: application.id },
      data: {
        status: Sms080ServiceStatus.APPROVED,
        unsubscribeNumber,
        providerName:
          application.providerName ||
          (application.type === Sms080ServiceType.NHN_MANAGED ? DEFAULT_NHN_PROVIDER_NAME : DEFAULT_EXTERNAL_PROVIDER_NAME),
        reviewedBy: reviewerId,
        reviewMemo: dto.memo?.trim() || null,
        approvedAt: new Date()
      }
    });
  }

  async rejectForOperator(applicationId: string, reviewerId: string, memo?: string) {
    const application = await this.prisma.sms080Service.findUnique({
      where: { id: applicationId }
    });

    if (!application) {
      throw new NotFoundException('080 application not found');
    }

    return this.prisma.sms080Service.update({
      where: { id: application.id },
      data: {
        status: Sms080ServiceStatus.REJECTED,
        reviewedBy: reviewerId,
        reviewMemo: memo?.trim() || null,
        approvedAt: null
      }
    });
  }

  private normalize080Number(value?: string | null) {
    const digits = value?.replace(/\D/g, '') ?? '';

    if (!/^080\d{7,8}$/.test(digits)) {
      throw new BadRequestException('080으로 시작하는 수신거부 번호를 입력해 주세요.');
    }

    return digits;
  }

  private async assertNoDuplicateNumber(ownerUserId: string, unsubscribeNumber: string, exceptId: string) {
    const existing = await this.prisma.sms080Service.findFirst({
      where: {
        ownerUserId,
        unsubscribeNumber,
        id: {
          not: exceptId
        }
      }
    });

    if (existing && existing.status !== Sms080ServiceStatus.REJECTED) {
      throw new ConflictException('이미 등록되었거나 심사 중인 080 번호입니다.');
    }
  }

  private async getOwnerContext(ownerUserId: string) {
    const owner = await this.prisma.adminUser.findUnique({
      where: { id: ownerUserId },
      select: {
        id: true,
        email: true,
        loginId: true,
        providerUserId: true
      }
    });

    if (!owner) {
      throw new NotFoundException('Owner account not found');
    }

    return owner;
  }

  private async loadOwners(ownerUserIds: string[]) {
    const owners = await this.prisma.adminUser.findMany({
      where: {
        id: {
          in: [...new Set(ownerUserIds.filter(Boolean))]
        }
      },
      select: {
        id: true,
        email: true,
        loginId: true,
        providerUserId: true
      }
    });

    return new Map(owners.map((owner) => [owner.id, owner]));
  }

  private buildOwnerLabel(owner?: {
    id: string;
    email: string | null;
    loginId: string | null;
    providerUserId: string;
  } | null) {
    if (!owner) {
      return '알 수 없는 계정';
    }

    return owner.email?.trim() || owner.loginId?.trim() || owner.providerUserId || owner.id;
  }
}
