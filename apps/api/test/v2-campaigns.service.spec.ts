import { V2CampaignsService } from '../src/v2/campaigns/v2-campaigns.service';

describe('V2CampaignsService', () => {
  it('returns kakao bootstrap with approved templates only', async () => {
    const prisma = {
      adminUser: {
        findUnique: jest.fn(async () => ({ tenantId: 'tenant_demo' }))
      },
      managedUserField: {
        findMany: jest.fn(async () => [{ key: 'courseName', label: '과정명', dataType: 'STRING' }])
      },
      managedUser: {
        count: jest
          .fn()
          .mockResolvedValueOnce(24)
          .mockResolvedValueOnce(18)
          .mockResolvedValueOnce(20)
      }
    };

    const readinessService = {
      getReadinessForUser: jest.fn(async () => ({
        resourceState: {
          sms: 'none',
          kakao: 'active',
          scheduled: 'none'
        }
      })),
      getReadiness: jest.fn(async () => ({
        resourceState: {
          sms: 'none',
          kakao: 'active',
          scheduled: 'none'
        }
      }))
    };

    const kakaoTemplateCatalogService = {
      getTemplateCatalogForUser: jest.fn(async () => ({
        senderProfiles: [
          {
            id: 'profile_1',
            plusFriendId: '@publ',
            senderKey: 'sender_key_1',
            senderProfileType: 'NORMAL',
            updatedAt: new Date('2026-04-06T09:00:00.000Z')
          }
        ],
        items: [
          {
            id: 'tpl_apr_1',
            source: 'SENDER_PROFILE',
            ownerKey: 'sender_key_1',
            ownerLabel: '@publ',
            providerStatus: 'APR',
            providerStatusRaw: 'APR',
            providerStatusName: '승인',
            templateCode: 'TPL_WELCOME',
            kakaoTemplateCode: 'KAKAO_WELCOME',
            updatedAt: '2026-04-06T09:00:00.000Z',
            templateName: '환영 안내',
            templateBody: '안녕하세요 {{name}}님',
            requiredVariables: ['name'],
            templateMessageType: 'BA'
          },
          {
            id: 'tpl_req_1',
            source: 'SENDER_PROFILE',
            ownerKey: 'sender_key_1',
            ownerLabel: '@publ',
            providerStatus: 'REQ',
            providerStatusRaw: 'REQ',
            providerStatusName: '심사중',
            templateCode: 'TPL_PENDING',
            kakaoTemplateCode: 'KAKAO_PENDING',
            updatedAt: '2026-04-06T08:00:00.000Z',
            templateName: '심사중 템플릿',
            templateBody: '심사 중',
            requiredVariables: [],
            templateMessageType: 'BA'
          }
        ]
      }))
    };

    const service = new V2CampaignsService(
      prisma as any,
      readinessService as any,
      {} as any,
      {} as any,
      {} as any,
      kakaoTemplateCatalogService as any,
      {} as any,
      {} as any
    );

    const result = await service.getKakaoBootstrap({
      tenantId: 'tenant_demo',
      userId: 'admin_1',
      role: 'USER',
      email: 'admin@example.com',
      loginId: 'admin'
    } as any);

    expect(result.readiness).toEqual({
      ready: true,
      status: 'active',
      blockers: []
    });
    expect(result.senderProfiles).toEqual([
      expect.objectContaining({
        id: 'profile_1',
        plusFriendId: '@publ',
        senderKey: 'sender_key_1'
      })
    ]);
    expect(result.templates).toEqual([
      expect.objectContaining({
        id: 'tpl_apr_1',
        providerStatus: 'APR',
        template: expect.objectContaining({
          name: '환영 안내',
          body: '안녕하세요 {{name}}님'
        })
      })
    ]);
    expect(result.recipientSummary).toEqual({
      totalCount: 24,
      activeCount: 18,
      contactableCount: 20,
      customFieldCount: 1
    });
    expect(result.limits).toEqual({ maxUserCount: 1000 });
  });

  it('returns brand bootstrap with supported message types and constraints', async () => {
    const prisma = {
      adminUser: {
        findUnique: jest.fn(async () => ({ tenantId: 'tenant_demo' }))
      },
      senderProfile: {
        findMany: jest.fn(async () => [
          {
            id: 'sender_profile_1',
            plusFriendId: '@publ',
            senderKey: 'sender_key_1',
            senderProfileType: 'NORMAL',
            status: 'ACTIVE',
            createdAt: new Date('2026-04-06T09:00:00.000Z'),
            updatedAt: new Date('2026-04-06T09:10:00.000Z')
          }
        ])
      },
      managedUserField: {
        findMany: jest.fn(async () => [{ key: 'segment', label: '세그먼트', dataType: 'STRING' }])
      },
      managedUser: {
        count: jest
          .fn()
          .mockResolvedValueOnce(31)
          .mockResolvedValueOnce(25)
          .mockResolvedValueOnce(28)
      }
    };

    const readinessService = {
      getReadinessForUser: jest.fn(async () => ({
        resourceState: {
          sms: 'active',
          kakao: 'active',
          scheduled: 'none'
        }
      })),
      getReadiness: jest.fn(async () => ({
        resourceState: {
          sms: 'active',
          kakao: 'active',
          scheduled: 'none'
        }
      }))
    };

    const nhnService = {
      fetchBrandTemplatesForSender: jest.fn(async () => ({
        templates: [
          {
            templateCode: 'BRAND_TPL_01',
            templateName: '브랜드 환영 안내',
            status: 'APR',
            chatBubbleType: 'COMMERCE',
            content: '안녕하세요 #{name}님',
            header: null,
            additionalContent: null,
            createDate: '2026-04-06T09:00:00.000Z',
            updateDate: '2026-04-06T09:10:00.000Z'
          }
        ]
      }))
    };

    const service = new V2CampaignsService(
      prisma as any,
      readinessService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      nhnService as any
    );

    const result = await service.getBrandBootstrap({
      tenantId: 'tenant_demo',
      userId: 'admin_1',
      role: 'USER',
      email: 'admin@example.com',
      loginId: 'admin'
    } as any);

    expect(result.readiness).toEqual({
      ready: true,
      status: 'active',
      blockers: []
    });
    expect(result.senderProfiles).toEqual([
      expect.objectContaining({
        id: 'sender_profile_1',
        plusFriendId: '@publ',
        senderKey: 'sender_key_1'
      })
    ]);
    expect(result.templates).toEqual([
      expect.objectContaining({
        templateCode: 'BRAND_TPL_01',
        templateName: '브랜드 환영 안내',
        chatBubbleType: 'COMMERCE',
        requiredVariables: ['name']
      })
    ]);
    expect(result.supportedMessageTypes).toEqual(['TEXT', 'IMAGE', 'WIDE']);
    expect(result.constraints).toEqual(
      expect.objectContaining({
        nightSendRestricted: true,
        supportedFeatures: expect.objectContaining({
          pushAlarm: true,
          buttons: true,
          template: true
        })
      })
    );
    expect(result.recipientSummary).toEqual({
      totalCount: 31,
      activeCount: 25,
      contactableCount: 28,
      customFieldCount: 1
    });
  });

  it('prefers provider-resolved campaign stats over persisted counts in list responses', async () => {
    const prisma = {
      adminUser: {
        findUnique: jest.fn(async () => ({ tenantId: 'tenant_demo' }))
      },
      bulkSmsCampaign: {
        count: jest.fn(async () => 0),
        findMany: jest.fn(async () => [])
      },
      bulkAlimtalkCampaign: {
        count: jest.fn(async () => 0),
        findMany: jest.fn(async () => [])
      },
      bulkBrandMessageCampaign: {
        count: jest.fn(async () => 1),
        findMany: jest.fn(async () => [
          {
            id: 'brand_campaign_1',
            title: '브랜드 테스트',
            status: 'SENT_TO_PROVIDER',
            scheduledAt: null,
            nhnRequestId: 'nhn_req_1',
            totalRecipientCount: 1,
            acceptedCount: 1,
            failedCount: 0,
            skippedNoPhoneCount: 0,
            duplicatePhoneCount: 0,
            createdAt: new Date('2026-04-06T09:00:00.000Z'),
            updatedAt: new Date('2026-04-06T09:01:00.000Z'),
            messageType: 'TEXT',
            senderProfile: {
              id: 'profile_1',
              plusFriendId: '@publ',
              status: 'ACTIVE'
            },
            recipients: [
              {
                id: 'recipient_1',
                recipientPhone: '01012345678',
                recipientSeq: '1',
                status: 'ACCEPTED'
              }
            ]
          }
        ])
      }
    };

    const readinessService = {
      getReadinessForUser: jest.fn(async () => ({
        resourceState: {
          sms: 'active',
          kakao: 'active',
          scheduled: 'none'
        }
      })),
      getReadiness: jest.fn(async () => ({
        resourceState: {
          sms: 'active',
          kakao: 'active',
          scheduled: 'none'
        }
      }))
    };

    const providerResultsService = {
      resolveSmsCampaign: jest.fn(),
      resolveAlimtalkCampaign: jest.fn(),
      resolveBrandMessageCampaign: jest.fn(async () => ({
        status: 'FAILED',
        recipientStats: {
          totalCount: 1,
          submittedCount: 0,
          deliveredCount: 0,
          failedCount: 1,
          pendingCount: 0,
          skippedNoPhoneCount: 0,
          duplicatePhoneCount: 0
        },
        recipients: new Map()
      }))
    };

    const service = new V2CampaignsService(
      prisma as any,
      readinessService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      providerResultsService as any,
      {} as any
    );

    const result = await service.listCampaigns('admin_1', 'brand', '20');

    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'brand_campaign_1',
        status: 'FAILED',
        recipientStats: expect.objectContaining({
          deliveredCount: 0,
          failedCount: 1
        })
      })
    ]);
  });
});
