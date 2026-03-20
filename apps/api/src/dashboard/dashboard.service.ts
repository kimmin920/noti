import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SessionUser } from '../common/session-request.interface';
import { CreateDashboardNoticeDto, UpdateDashboardQuotaDto, UpdateDashboardSettingsDto } from './dashboard.dto';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(sessionUser: SessionUser) {
    const [tenant, adminUser, settings, notices, directCount, bulkSmsCount, bulkAlimtalkCount] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: sessionUser.tenantId },
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true
        }
      }),
      this.prisma.adminUser.findUnique({
        where: { id: sessionUser.userId },
        select: {
          id: true,
          loginId: true,
          email: true,
          createdAt: true
        }
      }),
      this.ensureSettings(sessionUser.tenantId),
      this.listActiveNotices(5),
      this.prisma.messageRequest.count({
        where: {
          tenantId: sessionUser.tenantId,
          status: { not: 'CANCELED' },
          ...this.todayScheduleFilter()
        }
      }),
      this.prisma.bulkSmsRecipient.count({
        where: {
          campaign: {
            tenantId: sessionUser.tenantId,
            ...this.todayScheduleFilter()
          }
        }
      }),
      this.prisma.bulkAlimtalkRecipient.count({
        where: {
          campaign: {
            tenantId: sessionUser.tenantId,
            ...this.todayScheduleFilter()
          }
        }
      })
    ]);

    if (!tenant || !adminUser) {
      throw new NotFoundException('Dashboard account context was not found');
    }

    const todaySent = directCount + bulkSmsCount + bulkAlimtalkCount;
    const dailyMax = settings.dailySendLimit;
    const remaining = Math.max(dailyMax - todaySent, 0);

    return {
      account: {
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantStatus: tenant.status,
        tenantCreatedAt: tenant.createdAt,
        userId: sessionUser.userId,
        publUserId: sessionUser.publUserId,
        loginId: adminUser.loginId,
        email: adminUser.email ?? sessionUser.email ?? null,
        role: sessionUser.role,
        loginProvider: this.resolveLoginProvider(sessionUser.publUserId),
        joinedAt: adminUser.createdAt
      },
      balance: {
        autoRechargeEnabled: settings.autoRechargeEnabled,
        lowBalanceAlertEnabled: settings.lowBalanceAlertEnabled
      },
      sendQuota: {
        todaySent,
        dailyMax,
        remaining
      },
      notices
    };
  }

  async updateSettings(tenantId: string, dto: UpdateDashboardSettingsDto) {
    const prisma = this.prisma as any;
    const settings = await prisma.tenantDashboardSetting.upsert({
      where: { tenantId },
      create: {
        tenantId,
        ...(dto.autoRechargeEnabled !== undefined ? { autoRechargeEnabled: dto.autoRechargeEnabled } : {}),
        ...(dto.lowBalanceAlertEnabled !== undefined ? { lowBalanceAlertEnabled: dto.lowBalanceAlertEnabled } : {})
      },
      update: {
        ...(dto.autoRechargeEnabled !== undefined ? { autoRechargeEnabled: dto.autoRechargeEnabled } : {}),
        ...(dto.lowBalanceAlertEnabled !== undefined ? { lowBalanceAlertEnabled: dto.lowBalanceAlertEnabled } : {})
      }
    });

    return {
      autoRechargeEnabled: settings.autoRechargeEnabled,
      lowBalanceAlertEnabled: settings.lowBalanceAlertEnabled
    };
  }

  async updateQuota(tenantId: string, dto: UpdateDashboardQuotaDto) {
    const prisma = this.prisma as any;
    const settings = await prisma.tenantDashboardSetting.upsert({
      where: { tenantId },
      create: {
        tenantId,
        dailySendLimit: dto.dailySendLimit
      },
      update: {
        dailySendLimit: dto.dailySendLimit
      }
    });

    return {
      dailySendLimit: settings.dailySendLimit
    };
  }

  async listInternalNotices() {
    const prisma = this.prisma as any;
    return prisma.dashboardNotice.findMany({
      where: {
        archivedAt: null
      },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take: 12
    });
  }

  async createNotice(dto: CreateDashboardNoticeDto, sessionUser: SessionUser) {
    const prisma = this.prisma as any;
    return prisma.dashboardNotice.create({
      data: {
        title: dto.title.trim(),
        body: dto.body.trim(),
        isPinned: dto.isPinned ?? false,
        createdBy: sessionUser.userId,
        createdByEmail: sessionUser.email ?? null
      }
    });
  }

  async archiveNotice(noticeId: string) {
    const prisma = this.prisma as any;
    const notice = await prisma.dashboardNotice.findUnique({
      where: { id: noticeId }
    });

    if (!notice) {
      throw new NotFoundException('Dashboard notice not found');
    }

    return prisma.dashboardNotice.update({
      where: { id: noticeId },
      data: {
        archivedAt: new Date()
      }
    });
  }

  private async ensureSettings(tenantId: string) {
    const prisma = this.prisma as any;
    return prisma.tenantDashboardSetting.upsert({
      where: { tenantId },
      create: { tenantId },
      update: {}
    });
  }

  private async listActiveNotices(limit: number) {
    const prisma = this.prisma as any;
    return prisma.dashboardNotice.findMany({
      where: {
        archivedAt: null
      },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take: limit
    });
  }

  private todayScheduleFilter() {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
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
            lt: end
          }
        },
        {
          scheduledAt: null,
          createdAt: {
            gte: start,
            lt: end
          }
        }
      ]
    };
  }

  private resolveLoginProvider(publUserId: string): 'GOOGLE_OAUTH' | 'PUBL_SSO' | 'LOCAL_PASSWORD' {
    if (publUserId.startsWith('google:')) {
      return 'GOOGLE_OAUTH';
    }

    if (publUserId.startsWith('local:')) {
      return 'LOCAL_PASSWORD';
    }

    return 'PUBL_SSO';
  }
}
