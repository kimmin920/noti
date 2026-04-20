import { UsersService } from '../src/users/users.service';

function createFixture() {
  const managedUserFieldFindMany = jest.fn(async () => []);
  const managedUserFindFirst = jest.fn(async ({ where }: any) => {
    if (where.source === 'manual' && where.email === 'minu@example.com') {
      return {
        id: 'user_existing',
        ownerUserId: 'admin_1',
        source: 'manual',
        name: '기존 사용자',
        email: 'minu@example.com',
        phone: '01099998888',
        customAttributes: {}
      };
    }

    return null;
  });

  const prisma = {
    managedUserField: {
      findMany: managedUserFieldFindMany,
      create: jest.fn(async ({ data }: any) => data)
    },
    managedUser: {
      findMany: jest.fn(async () => []),
      findFirst: managedUserFindFirst,
      create: jest.fn(async ({ data }: any) => ({
        id: 'user_created',
        ownerUserId: data.ownerUserId,
        createdAt: new Date('2026-03-17T10:00:00.000Z'),
        updatedAt: new Date('2026-03-17T10:00:00.000Z'),
        ...data
      })),
      update: jest.fn(async ({ where, data }: any) => ({
        id: where.id,
        ownerUserId: 'admin_1',
        createdAt: new Date('2026-03-16T10:00:00.000Z'),
        updatedAt: new Date('2026-03-17T10:00:00.000Z'),
        ...data
      }))
    }
  };

  return {
    prisma,
    service: new UsersService(prisma as any)
  };
}

describe('UsersService', () => {
  it('creates a manual user and provisions missing custom fields', async () => {
    const { prisma, service } = createFixture();

    const result = await service.createManualUser('admin_1', {
      source: 'manual',
      name: '김민우',
      phone: '010-1234-5678',
      tags: ['vip', 'manual'],
      customAttributes: {
        note: '내부 등록',
        pointBalance: 12000,
        marketingFlag: true
      }
    });

    expect(prisma.managedUserField.create).toHaveBeenCalledTimes(3);
    expect(prisma.managedUser.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerUserId: 'admin_1',
          source: 'manual',
          name: '김민우',
          phone: '01012345678'
        })
      })
    );
    expect(result.mode).toBe('created');
    expect(result.user.phone).toBe('01012345678');
  });

  it('updates an existing manual user when the same source/email already exists', async () => {
    const { prisma, service } = createFixture();

    const result = await service.createManualUser('admin_1', {
      source: 'manual',
      name: '김민우',
      email: 'minu@example.com',
      segment: '운영 테스트'
    });

    expect(prisma.managedUser.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user_existing' },
        data: expect.objectContaining({
          email: 'minu@example.com',
          segment: '운영 테스트'
        })
      })
    );
    expect(result.mode).toBe('updated');
  });
});
