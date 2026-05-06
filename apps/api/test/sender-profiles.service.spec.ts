import { SenderProfilesService } from '../src/sender-profiles/sender-profiles.service';

function createFixture() {
  const prisma: any = {
    adminUser: {
      findUnique: jest.fn(async () => ({
        id: 'admin_1',
        providerUserId: 'google:admin_1'
      }))
    },
    senderProfile: {
      findMany: jest.fn(async () => []),
      findFirst: jest.fn(async () => null),
      updateMany: jest.fn(async () => ({ count: 1 })),
      update: jest.fn(async ({ data }: any) => ({
        id: 'profile_1',
        ownerUserId: 'admin_1',
        plusFriendId: '@vizuo',
        senderKey: 'sender_key_1',
        senderProfileType: 'NORMAL',
        status: data?.status ?? 'ACTIVE',
        isDefault: data?.isDefault ?? true,
        createdAt: new Date('2026-05-06T00:00:00.000Z'),
        updatedAt: new Date('2026-05-06T00:00:00.000Z')
      })),
      upsert: jest.fn(async ({ create, update }: any) => ({
        id: 'profile_1',
        ownerUserId: create?.ownerUserId ?? 'admin_1',
        plusFriendId: create?.plusFriendId ?? update?.plusFriendId ?? '@vizuo',
        senderKey: create?.senderKey ?? 'sender_key_1',
        senderProfileType: 'NORMAL',
        status: create?.status ?? update?.status ?? 'UNKNOWN',
        isDefault: create?.isDefault ?? update?.isDefault ?? false,
        createdAt: new Date('2026-05-06T00:00:00.000Z'),
        updatedAt: new Date('2026-05-06T00:00:00.000Z')
      }))
    },
    $transaction: jest.fn()
  };
  prisma.$transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) => callback(prisma));

  const nhnService = {
    registerSenderProfile: jest.fn(async () => ({
      header: {
        isSuccessful: true,
        resultCode: 0,
        resultMessage: 'SUCCESS'
      }
    })),
    verifySenderProfileToken: jest.fn(async () => ({
      header: {
        isSuccessful: true,
        resultCode: 0,
        resultMessage: 'SUCCESS'
      },
      sender: {
        plusFriendId: '@vizuo',
        senderKey: 'sender_key_1',
        categoryCode: null,
        status: 'YSC03',
        statusName: '정상',
        kakaoStatus: null,
        kakaoStatusName: null,
        kakaoProfileStatus: 'A',
        kakaoProfileStatusName: '정상',
        profileSpamLevel: null,
        profileMessageSpamLevel: null,
        dormant: false,
        block: false,
        createDate: null,
        initialUserRestriction: null,
        alimtalk: null,
        friendtalk: null
      }
    })),
    ensureSenderInDefaultGroup: jest.fn(async () => ({
      enabled: true,
      groupSenderKey: 'group_1',
      added: true,
      alreadyMember: false
    })),
    fetchSenderProfiles: jest.fn(async () => ({
      header: {
        isSuccessful: true,
        resultCode: 0,
        resultMessage: 'SUCCESS'
      },
      senders: [
        {
          plusFriendId: '@vizuo',
          senderKey: 'sender_key_1',
          categoryCode: null,
          status: 'YSC03',
          statusName: '정상',
          kakaoStatus: null,
          kakaoStatusName: null,
          kakaoProfileStatus: 'A',
          kakaoProfileStatusName: '정상',
          profileSpamLevel: null,
          profileMessageSpamLevel: null,
          dormant: false,
          block: false,
          createDate: null,
          initialUserRestriction: null,
          alimtalk: null,
          friendtalk: null
        }
      ],
      totalCount: 1
    })),
    fetchSenderCategories: jest.fn(async () => []),
    fetchSenderProfile: jest.fn(async () => null),
    fetchSenderGroup: jest.fn(async () => null),
    fetchTemplatesForSenderOrGroup: jest.fn(async () => ({
      templates: [],
      totalCount: 0
    }))
  };

  const env = {
    nhnDefaultSenderGroupKey: ''
  };

  return {
    prisma,
    nhnService,
    env,
    service: new SenderProfilesService(prisma as any, nhnService as any, env as any)
  };
}

describe('SenderProfilesService', () => {
  it('does not create a local sender profile during apply before token verification', async () => {
    const { prisma, nhnService, service } = createFixture();

    const result = await service.apply('admin_1', {
      plusFriendId: '@vizuo',
      phoneNo: '01012345678',
      categoryCode: '00100010001'
    });

    expect(nhnService.registerSenderProfile).toHaveBeenCalledWith({
      plusFriendId: '@vizuo',
      phoneNo: '01012345678',
      categoryCode: '00100010001'
    });
    expect(prisma.senderProfile.upsert).not.toHaveBeenCalled();
    expect(nhnService.fetchSenderProfiles).not.toHaveBeenCalled();
    expect(result.sender).toBeNull();
  });

  it('creates a local sender profile only after token verification succeeds', async () => {
    const { prisma, service } = createFixture();

    const result = await service.verifyToken('admin_1', {
      plusFriendId: '@vizuo',
      token: 12345678
    });

    expect(prisma.senderProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ownerUserId_senderKey: {
            ownerUserId: 'admin_1',
            senderKey: 'sender_key_1'
          }
        }
      })
    );
    expect(result.sender).toEqual(
      expect.objectContaining({
        plusFriendId: '@vizuo',
        senderKey: 'sender_key_1',
        localSenderProfileId: 'profile_1'
      })
    );
  });

  it('marks the first verified channel as default', async () => {
    const { prisma, service } = createFixture();

    await service.verifyToken('admin_1', {
      plusFriendId: '@vizuo',
      token: 12345678
    });

    expect(prisma.senderProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          isDefault: true
        })
      })
    );
  });

  it('can move the default channel to another active sender profile', async () => {
    const { prisma, service } = createFixture();

    prisma.senderProfile.findFirst.mockResolvedValueOnce({
      id: 'profile_2',
      ownerUserId: 'admin_1',
      plusFriendId: '@publ',
      senderKey: 'sender_key_2',
      senderProfileType: 'NORMAL',
      status: 'ACTIVE',
      isDefault: false,
      createdAt: new Date('2026-05-06T00:00:00.000Z'),
      updatedAt: new Date('2026-05-06T00:00:00.000Z')
    });
    prisma.senderProfile.update.mockResolvedValueOnce({
      id: 'profile_2',
      ownerUserId: 'admin_1',
      plusFriendId: '@publ',
      senderKey: 'sender_key_2',
      senderProfileType: 'NORMAL',
      status: 'ACTIVE',
      isDefault: true,
      createdAt: new Date('2026-05-06T00:00:00.000Z'),
      updatedAt: new Date('2026-05-06T00:00:00.000Z')
    });

    const result = await service.setDefault('admin_1', 'profile_2');

    expect(prisma.senderProfile.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ownerUserId: 'admin_1',
          isDefault: true,
          id: {
            not: 'profile_2'
          }
        }),
        data: {
          isDefault: false
        }
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        localSenderProfileId: 'profile_2',
        plusFriendId: '@publ',
        isDefault: true
      })
    );
  });
});
