import { DashboardService } from '../src/dashboard/dashboard.service';

function createFixture() {
  const prisma = {
    tenant: {
      findUnique: jest.fn(async () => ({
        id: 'tenant_demo',
        name: 'Demo Tenant',
        status: 'ACTIVE',
        createdAt: new Date('2026-03-01T09:00:00.000Z')
      }))
    },
    adminUser: {
      findUnique: jest.fn(async () => ({
        id: 'user_1',
        loginId: 'owner@demo.dev',
        email: 'owner@demo.dev',
        createdAt: new Date('2026-03-02T10:00:00.000Z')
      }))
    },
    tenantDashboardSetting: {
      upsert: jest.fn(async ({ create, update }: any) => ({
        id: 'setting_1',
        tenantId: create?.tenantId ?? 'tenant_demo',
        autoRechargeEnabled: update?.autoRechargeEnabled ?? create?.autoRechargeEnabled ?? false,
        lowBalanceAlertEnabled: update?.lowBalanceAlertEnabled ?? create?.lowBalanceAlertEnabled ?? false,
        dailySendLimit: update?.dailySendLimit ?? create?.dailySendLimit ?? 1000,
        createdAt: new Date('2026-03-01T09:00:00.000Z'),
        updatedAt: new Date('2026-03-17T18:30:00.000Z')
      }))
    },
    dashboardNotice: {
      findMany: jest.fn(async () => [
        {
          id: 'notice_1',
          title: '점검 안내',
          body: '오늘 저녁 점검이 예정되어 있습니다.',
          isPinned: true,
          createdBy: 'operator_1',
          createdByEmail: 'ops@noti.dev',
          archivedAt: null,
          createdAt: new Date('2026-03-17T07:00:00.000Z'),
          updatedAt: new Date('2026-03-17T07:00:00.000Z')
        }
      ]),
      create: jest.fn(async ({ data }: any) => ({
        id: 'notice_new',
        ...data,
        archivedAt: null,
        createdAt: new Date('2026-03-17T08:00:00.000Z'),
        updatedAt: new Date('2026-03-17T08:00:00.000Z')
      })),
      findUnique: jest.fn(async () => ({ id: 'notice_1' })),
      update: jest.fn(async ({ where, data }: any) => ({
        id: where.id,
        archivedAt: data.archivedAt
      }))
    },
    messageRequest: {
      count: jest.fn(async () => 2)
    },
    bulkSmsRecipient: {
      count: jest.fn(async () => 4)
    },
    bulkAlimtalkRecipient: {
      count: jest.fn(async () => 3)
    }
  };

  return {
    prisma,
    service: new DashboardService(prisma as any)
  };
}

describe('DashboardService', () => {
  it('builds tenant dashboard overview with quota and notices', async () => {
    const { service } = createFixture();

    const result = await service.getOverview({
      tenantId: 'tenant_demo',
      userId: 'user_1',
      providerUserId: 'local:owner@demo.dev',
      email: 'owner@demo.dev',
      role: 'TENANT_ADMIN',
      sessionId: 'sess_1'
    });

    expect(result.account.tenantName).toBe('Demo Tenant');
    expect(result.balance.autoRechargeEnabled).toBe(false);
    expect(result.sendQuota).toEqual({
      todaySent: 9,
      dailyMax: 1000,
      remaining: 991
    });
    expect(result.notices).toHaveLength(1);
  });

  it('updates stored dashboard toggles', async () => {
    const { prisma, service } = createFixture();

    const result = await service.updateSettings('tenant_demo', {
      autoRechargeEnabled: true,
      lowBalanceAlertEnabled: true
    });

    expect(prisma.tenantDashboardSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant_demo' },
        update: {
          autoRechargeEnabled: true,
          lowBalanceAlertEnabled: true
        }
      })
    );
    expect(result).toEqual({
      autoRechargeEnabled: true,
      lowBalanceAlertEnabled: true
    });
  });

  it('creates and archives operator notices', async () => {
    const { prisma, service } = createFixture();

    await service.createNotice(
      {
        title: '  긴급 공지 ',
        body: '  발송 점검 중입니다. ',
        isPinned: true
      },
      {
        tenantId: 'tenant_internal_ops',
        userId: 'operator_1',
        providerUserId: 'google:ops@noti.dev',
        email: 'ops@noti.dev',
        role: 'OPERATOR',
        sessionId: 'sess_ops'
      }
    );

    expect(prisma.dashboardNotice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: '긴급 공지',
          body: '발송 점검 중입니다.',
          isPinned: true,
          createdByEmail: 'ops@noti.dev'
        })
      })
    );

    await service.archiveNotice('notice_1');
    expect(prisma.dashboardNotice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'notice_1' },
        data: expect.objectContaining({
          archivedAt: expect.any(Date)
        })
      })
    );
  });
});
