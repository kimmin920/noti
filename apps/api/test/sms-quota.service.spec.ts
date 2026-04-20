import { ConflictException } from '@nestjs/common';
import { SmsQuotaService } from '../src/sms-quota/sms-quota.service';

function createFixture() {
  const monthlyAggregate = { _sum: { quantity: 320 } };
  const lifetimeAggregate = { _sum: { quantity: 980 } };
  const dailyAggregate = { _sum: { quantity: 22 } };

  const prisma: any = {
    adminUser: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.id === 'tenant_demo') {
          return {
            id: 'tenant_demo',
            providerUserId: 'google:demo-owner',
            loginId: 'owner@demo.dev',
            email: 'owner@demo.dev',
            monthlySmsLimit: 2000,
          };
        }

        return null;
      }),
      findMany: jest.fn(async () => [
        {
          id: 'tenant_demo',
          loginId: 'owner@demo.dev',
          email: 'owner@demo.dev',
          providerUserId: 'google:demo-owner',
          role: 'USER',
          accessOrigin: 'DIRECT',
          monthlySmsLimit: 2000,
        },
      ]),
      update: jest.fn(async ({ where, data }: any) => ({
        id: where.id,
        monthlySmsLimit: data.monthlySmsLimit,
      })),
    },
    senderNumber: {
      groupBy: jest.fn(async () => [
        {
          ownerUserId: 'tenant_demo',
          _count: { _all: 1 },
        },
      ]),
    },
    smsUsageLedger: {
      aggregate: jest
        .fn()
        .mockResolvedValueOnce(lifetimeAggregate)
        .mockResolvedValueOnce(monthlyAggregate)
        .mockResolvedValueOnce(dailyAggregate),
      create: jest.fn(async ({ data }: any) => ({
        id: 'ledger_1',
        ...data,
      })),
      groupBy: jest.fn(async () => [
        {
          ownerUserId: 'tenant_demo',
          _sum: {
            quantity: 320,
          },
        },
      ]),
    },
    $transaction: jest.fn(async (callback: any): Promise<any> => callback(prisma)),
  };

  return {
    prisma,
    service: new SmsQuotaService(prisma as any),
  };
}

describe('SmsQuotaService', () => {
  it('returns user sms usage stats with monthly limit', async () => {
    const { service } = createFixture();

    const result = await service.getUsageStatsForUser('tenant_demo', new Date('2026-04-13T10:00:00.000Z'));

    expect(result).toEqual({
      lifetimeUsed: 980,
      monthlyUsed: 320,
      dailyUsed: 22,
      monthlyLimit: 2000,
      monthlyRemaining: 1680,
    });
  });

  it('blocks reserve when monthly limit would be exceeded', async () => {
    const { prisma, service } = createFixture();
    prisma.smsUsageLedger.aggregate = jest.fn(async () => ({ _sum: { quantity: 1990 } }));

    await expect(
      service.assertCanReserveUsage(prisma as any, 'tenant_demo', 20, new Date('2026-04-13T10:00:00.000Z')),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lists user quotas with current usage', async () => {
    const { service } = createFixture();

    const result = await service.listUserSmsQuotas(new Date('2026-04-13T10:00:00.000Z'));

    expect(result.summary).toEqual({
      userCount: 1,
      defaultLimit: 1000,
      totalMonthlyLimit: 2000,
      totalMonthlyUsed: 320,
    });
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        userId: 'tenant_demo',
        userLabel: 'owner@demo.dev',
        email: 'owner@demo.dev',
        monthlySmsLimit: 2000,
        monthlySmsUsed: 320,
        monthlySmsRemaining: 1680,
        approvedSenderNumberCount: 1,
      }),
    );
  });

  it('updates user monthly limit', async () => {
    const { prisma, service } = createFixture();

    const result = await service.updateUserMonthlySmsLimit('tenant_demo', 5000);

    expect(prisma.adminUser.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tenant_demo' },
        data: { monthlySmsLimit: 5000 },
      }),
    );
    expect(result).toEqual({
      userId: 'tenant_demo',
      monthlySmsLimit: 5000,
    });
  });
});
