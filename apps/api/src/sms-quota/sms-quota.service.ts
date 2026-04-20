import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

type PrismaDb = PrismaService | Prisma.TransactionClient;

type ReserveSmsUsageInput =
  | {
      ownerUserId: string;
      senderNumberId: string | null;
      quantity: number;
      usageAt: Date;
      messageRequestId: string;
      bulkSmsCampaignId?: never;
    }
  | {
      ownerUserId: string;
      senderNumberId: string | null;
      quantity: number;
      usageAt: Date;
      bulkSmsCampaignId: string;
      messageRequestId?: never;
    };

@Injectable()
export class SmsQuotaService {
  private static readonly DEFAULT_MONTHLY_LIMIT = 1000;

  constructor(private readonly prisma: PrismaService) {}

  async getUsageStatsForUser(userId: string, baseDate = new Date()) {
    return this.getUsageStatsWithDb(this.prisma, userId, baseDate);
  }

  async listUserSmsQuotas(baseDate = new Date()) {
    const monthWindow = this.getKstMonthWindow(baseDate);
    const [usageRows, senderNumberRows, users] = await Promise.all([
      this.prisma.smsUsageLedger.groupBy({
        by: ['ownerUserId'],
        where: {
          usageAt: {
            gte: monthWindow.start,
            lt: monthWindow.end,
          },
        },
        _sum: {
          quantity: true,
        },
      }),
      this.prisma.senderNumber.groupBy({
        by: ['ownerUserId'],
        where: {
          status: 'APPROVED',
        },
        _count: {
          _all: true,
        },
      }),
      this.prisma.adminUser.findMany({
        where: {
          role: {
            not: UserRole.SUPER_ADMIN,
          },
        },
        select: {
          id: true,
          providerUserId: true,
          loginProvider: true,
          loginId: true,
          email: true,
          role: true,
          accessOrigin: true,
          monthlySmsLimit: true,
        },
        orderBy: [{ createdAt: 'asc' }],
      }),
    ]);

    const usageByUserId = new Map(
      usageRows.map((row) => [row.ownerUserId, row._sum.quantity ?? 0]),
    );
    const senderNumberCountByUserId = new Map(
      senderNumberRows.map((row) => [row.ownerUserId, row._count._all]),
    );

    return {
      summary: {
        userCount: users.length,
        defaultLimit: SmsQuotaService.DEFAULT_MONTHLY_LIMIT,
        totalMonthlyLimit: users.reduce((sum, user) => sum + user.monthlySmsLimit, 0),
        totalMonthlyUsed: users.reduce((sum, user) => sum + (usageByUserId.get(user.id) ?? 0), 0),
      },
      items: users.map((user) => {
        const monthlyUsed = usageByUserId.get(user.id) ?? 0;
        const monthlySmsLimit = user.monthlySmsLimit;

        return {
          userId: user.id,
          userLabel: this.buildUserAccountLabel(user),
          loginId: user.loginId,
          email: user.email,
          providerUserId: user.providerUserId,
          role: user.role,
          accessOrigin: user.accessOrigin,
          approvedSenderNumberCount: senderNumberCountByUserId.get(user.id) ?? 0,
          monthlySmsLimit,
          monthlySmsUsed: monthlyUsed,
          monthlySmsRemaining: Math.max(monthlySmsLimit - monthlyUsed, 0),
        };
      }),
    };
  }

  async updateUserMonthlySmsLimit(userId: string, monthlySmsLimit: number) {
    const updated = await this.prisma.adminUser.update({
      where: { id: userId },
      data: { monthlySmsLimit },
      select: {
        id: true,
        monthlySmsLimit: true,
      },
    });

    return {
      userId: updated.id,
      monthlySmsLimit: updated.monthlySmsLimit,
    };
  }

  async resolveQuotaUserId(db: PrismaDb, userId: string) {
    const user = await this.ensureUser(db, userId);
    return user.id;
  }

  async assertCanReserveUsage(db: PrismaDb, ownerUserId: string, quantity: number, usageAt: Date) {
    const user = await this.ensureUser(db, ownerUserId);
    const monthWindow = this.getKstMonthWindow(usageAt);
    const monthAggregate = await db.smsUsageLedger.aggregate({
      where: {
        ownerUserId,
        usageAt: {
          gte: monthWindow.start,
          lt: monthWindow.end,
        },
      },
      _sum: {
        quantity: true,
      },
    });

    const used = monthAggregate._sum?.quantity ?? 0;
    const limit = user.monthlySmsLimit;
    if (used + quantity > limit) {
      throw new ConflictException(
        `이번 달 SMS 한도를 초과했습니다. 현재 ${used.toLocaleString()} / ${limit.toLocaleString()}건 사용 중입니다.`,
      );
    }

    return {
      monthlyLimit: limit,
      monthlyUsed: used,
      monthlyRemaining: Math.max(limit - used, 0),
    };
  }

  async reserveUsage(db: PrismaDb, input: ReserveSmsUsageInput) {
    return db.smsUsageLedger.create({
      data: {
        ownerUserId: input.ownerUserId,
        senderNumberId: input.senderNumberId,
        quantity: input.quantity,
        usageAt: input.usageAt,
        ...(input.messageRequestId ? { messageRequestId: input.messageRequestId } : {}),
        ...(input.bulkSmsCampaignId ? { bulkSmsCampaignId: input.bulkSmsCampaignId } : {}),
      },
    });
  }

  private async getUsageStatsWithDb(db: PrismaDb, ownerUserId: string, baseDate: Date) {
    const user = await this.ensureUser(db, ownerUserId);
    const monthWindow = this.getKstMonthWindow(baseDate);
    const dayWindow = this.getKstDayWindow(baseDate);

    const [lifetimeAggregate, monthAggregate, dayAggregate] = await Promise.all([
      db.smsUsageLedger.aggregate({
        where: {
          ownerUserId,
        },
        _sum: {
          quantity: true,
        },
      }),
      db.smsUsageLedger.aggregate({
        where: {
          ownerUserId,
          usageAt: {
            gte: monthWindow.start,
            lt: monthWindow.end,
          },
        },
        _sum: {
          quantity: true,
        },
      }),
      db.smsUsageLedger.aggregate({
        where: {
          ownerUserId,
          usageAt: {
            gte: dayWindow.start,
            lt: dayWindow.end,
          },
        },
        _sum: {
          quantity: true,
        },
      }),
    ]);

    const lifetimeUsed = lifetimeAggregate._sum?.quantity ?? 0;
    const monthlyUsed = monthAggregate._sum?.quantity ?? 0;
    const dailyUsed = dayAggregate._sum?.quantity ?? 0;
    const monthlyLimit = user.monthlySmsLimit;

    return {
      lifetimeUsed,
      monthlyUsed,
      dailyUsed,
      monthlyLimit,
      monthlyRemaining: Math.max(monthlyLimit - monthlyUsed, 0),
    };
  }

  private async ensureUser(db: PrismaDb, userId: string) {
    const user = await db.adminUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        providerUserId: true,
        loginId: true,
        email: true,
        monthlySmsLimit: true,
      },
    });

    if (!user) {
      throw new NotFoundException('SMS 쿼터를 적용할 사용자를 찾을 수 없습니다.');
    }

    return {
      ...user,
      monthlySmsLimit: user.monthlySmsLimit ?? SmsQuotaService.DEFAULT_MONTHLY_LIMIT,
    };
  }

  private buildUserAccountLabel(user: {
    email: string | null;
    loginId: string | null;
    providerUserId: string;
  }) {
    return user.email?.trim() || user.loginId?.trim() || user.providerUserId;
  }

  private getKstMonthWindow(baseDate: Date) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
    });
    const parts = formatter.formatToParts(baseDate);
    const year = Number(parts.find((part) => part.type === 'year')?.value ?? '1970');
    const month = Number(parts.find((part) => part.type === 'month')?.value ?? '01');
    const start = new Date(Date.UTC(year, month - 1, 1, -9, 0, 0, 0));
    const end =
      month === 12
        ? new Date(Date.UTC(year + 1, 0, 1, -9, 0, 0, 0))
        : new Date(Date.UTC(year, month, 1, -9, 0, 0, 0));

    return { start, end };
  }

  private getKstDayWindow(baseDate: Date) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(baseDate);
    const year = Number(parts.find((part) => part.type === 'year')?.value ?? '1970');
    const month = Number(parts.find((part) => part.type === 'month')?.value ?? '01');
    const day = Number(parts.find((part) => part.type === 'day')?.value ?? '01');
    const start = new Date(Date.UTC(year, month - 1, day, -9, 0, 0, 0));
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    return { start, end };
  }
}
