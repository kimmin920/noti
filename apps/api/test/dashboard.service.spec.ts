import { DashboardService } from '../src/dashboard/dashboard.service';

function createFixture() {
  const prisma = {
    adminUser: {
      findUnique: jest.fn(async () => ({
        id: 'user_1',
        loginId: 'owner@demo.dev',
        email: 'owner@demo.dev',
        providerUserId: 'local:owner@demo.dev',
        accessOrigin: 'DIRECT',
        autoRechargeEnabled: false,
        lowBalanceAlertEnabled: false,
        dailySendLimit: 1000,
        createdAt: new Date('2026-03-02T10:00:00.000Z')
      })),
      update: jest.fn(async ({ where, data }: any) => ({
        id: where.id,
        loginId: 'owner@demo.dev',
        email: 'owner@demo.dev',
        providerUserId: 'local:owner@demo.dev',
        accessOrigin: 'DIRECT',
        autoRechargeEnabled: data.autoRechargeEnabled ?? false,
        lowBalanceAlertEnabled: data.lowBalanceAlertEnabled ?? false,
        dailySendLimit: data.dailySendLimit ?? 1000,
        createdAt: new Date('2026-03-02T10:00:00.000Z')
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
        title: data.title ?? '점검 안내',
        body: data.body ?? '오늘 저녁 점검이 예정되어 있습니다.',
        isPinned: data.isPinned ?? true,
        archivedAt: data.archivedAt ?? null
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
  it('builds current user dashboard overview with quota and notices', async () => {
    const { service } = createFixture();

    const result = await service.getOverview({
      userId: 'user_1',
      providerUserId: 'local:owner@demo.dev',
      loginProvider: 'LOCAL_PASSWORD',
      email: 'owner@demo.dev',
      role: 'USER',
      sessionId: 'sess_1'
    });

    expect(result.currentUser.serviceName).toBe('owner@demo.dev');
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

    const result = await service.updateSettings('user_1', {
      autoRechargeEnabled: true,
      lowBalanceAlertEnabled: true
    });

    expect(prisma.adminUser.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user_1' },
        data: {
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

  it('creates, updates and archives operator notices', async () => {
    const { prisma, service } = createFixture();

    await service.createNotice(
      {
        title: '  긴급 공지 ',
        body: '  발송 점검 중입니다. ',
        isPinned: true
      },
      {
        userId: 'operator_1',
        providerUserId: 'google:ops@noti.dev',
        loginProvider: 'GOOGLE_OAUTH',
        email: 'ops@noti.dev',
        role: 'SUPER_ADMIN',
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

    await service.updateNotice('notice_1', {
      title: '  업데이트 공지 ',
      body: '  본문 수정 테스트 ',
      isPinned: false
    });

    expect(prisma.dashboardNotice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'notice_1' },
        data: expect.objectContaining({
          title: '업데이트 공지',
          body: '본문 수정 테스트',
          isPinned: false
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
