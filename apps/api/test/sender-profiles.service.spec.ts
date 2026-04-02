import { SenderProfilesService } from '../src/sender-profiles/sender-profiles.service';

function createFixture() {
  const prisma = {
    senderProfile: {
      findMany: jest.fn(async () => []),
      findFirst: jest.fn(async () => null),
      upsert: jest.fn(async ({ create, update }: any) => ({
        id: 'profile_1',
        tenantId: create?.tenantId ?? 'tenant_demo',
        plusFriendId: create?.plusFriendId ?? update?.plusFriendId ?? '@vizuo',
        senderKey: create?.senderKey ?? 'sender_key_1',
        senderProfileType: 'NORMAL',
        status: create?.status ?? update?.status ?? 'UNKNOWN'
      }))
    }
  };

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

    const result = await service.apply('tenant_demo', {
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

    const result = await service.verifyToken('tenant_demo', 'admin_1', {
      plusFriendId: '@vizuo',
      token: 12345678
    });

    expect(prisma.senderProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_ownerAdminUserId_senderKey: {
            tenantId: 'tenant_demo',
            ownerAdminUserId: 'admin_1',
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
});
