import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SessionUser } from '../common/session-request.interface';
import { CreateDashboardNoticeDto, UpdateDashboardNoticeDto, UpdateDashboardQuotaDto, UpdateDashboardSettingsDto } from './dashboard.dto';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(sessionUser: SessionUser) {
    const [adminUser, notices, directCount, bulkSmsCount, bulkAlimtalkCount] = await Promise.all([
      this.prisma.adminUser.findUnique({
        where: { id: sessionUser.userId },
        select: {
          id: true,
          loginId: true,
          email: true,
          providerUserId: true,
          accessOrigin: true,
          autoRechargeEnabled: true,
          lowBalanceAlertEnabled: true,
          dailySendLimit: true,
          createdAt: true,
        },
      }),
      this.listActiveNotices(5),
      this.prisma.messageRequest.count({
        where: {
          ownerUserId: sessionUser.userId,
          status: { not: 'CANCELED' },
          ...this.todayScheduleFilter(),
        },
      }),
      this.prisma.bulkSmsRecipient.count({
        where: {
          campaign: {
            ownerUserId: sessionUser.userId,
            ...this.todayScheduleFilter(),
          },
        },
      }),
      this.prisma.bulkAlimtalkRecipient.count({
        where: {
          campaign: {
            ownerUserId: sessionUser.userId,
            ...this.todayScheduleFilter(),
          },
        },
      }),
    ]);

    if (!adminUser) {
      throw new NotFoundException('Dashboard user context was not found');
    }

    const todaySent = directCount + bulkSmsCount + bulkAlimtalkCount;
    const dailyMax = adminUser.dailySendLimit;
    const remaining = Math.max(dailyMax - todaySent, 0);

    return {
      currentUser: {
        userId: adminUser.id,
        serviceName: this.buildServiceName(adminUser),
        serviceStatus: 'ACTIVE',
        serviceCreatedAt: adminUser.createdAt,
        providerUserId: sessionUser.providerUserId,
        loginId: adminUser.loginId,
        email: adminUser.email ?? sessionUser.email ?? null,
        role: sessionUser.role,
        loginProvider: sessionUser.loginProvider,
        joinedAt: adminUser.createdAt,
      },
      balance: {
        autoRechargeEnabled: adminUser.autoRechargeEnabled,
        lowBalanceAlertEnabled: adminUser.lowBalanceAlertEnabled,
      },
      sendQuota: {
        todaySent,
        dailyMax,
        remaining,
      },
      notices,
    };
  }

  async updateSettings(userId: string, dto: UpdateDashboardSettingsDto) {
    const settings = await this.prisma.adminUser.update({
      where: { id: userId },
      data: {
        ...(dto.autoRechargeEnabled !== undefined ? { autoRechargeEnabled: dto.autoRechargeEnabled } : {}),
        ...(dto.lowBalanceAlertEnabled !== undefined ? { lowBalanceAlertEnabled: dto.lowBalanceAlertEnabled } : {}),
      },
    });

    return {
      autoRechargeEnabled: settings.autoRechargeEnabled,
      lowBalanceAlertEnabled: settings.lowBalanceAlertEnabled,
    };
  }

  async updateQuota(userId: string, dto: UpdateDashboardQuotaDto) {
    const settings = await this.prisma.adminUser.update({
      where: { id: userId },
      data: {
        dailySendLimit: dto.dailySendLimit,
      },
    });

    return {
      dailySendLimit: settings.dailySendLimit,
    };
  }

  async listInternalNotices() {
    return this.prisma.dashboardNotice.findMany({
      where: {
        archivedAt: null,
      },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take: 12,
    });
  }

  async createNotice(dto: CreateDashboardNoticeDto, sessionUser: SessionUser) {
    return this.prisma.dashboardNotice.create({
      data: {
        title: dto.title.trim(),
        body: dto.body.trim(),
        isPinned: dto.isPinned ?? false,
        createdBy: sessionUser.userId,
        createdByEmail: sessionUser.email ?? null,
      },
    });
  }

  async updateNotice(noticeId: string, dto: UpdateDashboardNoticeDto) {
    const notice = await this.prisma.dashboardNotice.findUnique({
      where: { id: noticeId },
    });

    if (!notice) {
      throw new NotFoundException('Dashboard notice not found');
    }

    const nextData: Record<string, unknown> = {};

    if (dto.title !== undefined) {
      nextData.title = dto.title.trim();
    }

    if (dto.body !== undefined) {
      nextData.body = dto.body.trim();
    }

    if (dto.isPinned !== undefined) {
      nextData.isPinned = dto.isPinned;
    }

    return this.prisma.dashboardNotice.update({
      where: { id: noticeId },
      data: nextData,
    });
  }

  async archiveNotice(noticeId: string) {
    const notice = await this.prisma.dashboardNotice.findUnique({
      where: { id: noticeId },
    });

    if (!notice) {
      throw new NotFoundException('Dashboard notice not found');
    }

    return this.prisma.dashboardNotice.update({
      where: { id: noticeId },
      data: {
        archivedAt: new Date(),
      },
    });
  }

  private async listActiveNotices(limit: number) {
    return this.prisma.dashboardNotice.findMany({
      where: {
        archivedAt: null,
      },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });
  }

  private todayScheduleFilter() {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(new Date());
    const year = Number(parts.find((part) => part.type === 'year')?.value ?? '1970');
    const month = Number(parts.find((part) => part.type === 'month')?.value ?? '01');
    const day = Number(parts.find((part) => part.type === 'day')?.value ?? '01');
    const start = new Date(Date.UTC(year, month - 1, day, -9, 0, 0, 0));
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    return {
      OR: [
        {
          scheduledAt: {
            gte: start,
            lt: end,
          },
        },
        {
          scheduledAt: null,
          createdAt: {
            gte: start,
            lt: end,
          },
        },
      ],
    };
  }

  private buildServiceName(adminUser: {
    email: string | null;
    loginId: string | null;
    providerUserId: string;
    accessOrigin: 'DIRECT' | 'PUBL';
  }) {
    if (adminUser.email?.trim()) {
      return adminUser.email.trim();
    }

    if (adminUser.loginId?.trim()) {
      return adminUser.loginId.trim();
    }

    return adminUser.accessOrigin === 'PUBL' ? 'Publ' : adminUser.providerUserId;
  }
}
