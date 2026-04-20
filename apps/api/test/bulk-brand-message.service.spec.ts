import { ConflictException } from '@nestjs/common';
import { BulkBrandMessageService } from '../src/bulk-brand-message/bulk-brand-message.service';

function createFixture() {
  const prisma = {
    senderProfile: {
      findFirst: jest.fn(async () => ({
        id: 'sender_profile_1',
        tenantId: 'tenant_demo',
        senderKey: 'sender_key_1',
        plusFriendId: '@publ',
        status: 'ACTIVE'
      }))
    },
    managedUser: {
      findMany: jest.fn(async () => [
        {
          id: 'user_1',
          name: '민우',
          phone: '74601012345678',
          customAttributes: {
            membershipName: 'VIP'
          }
        },
        {
          id: 'user_2',
          name: '서연',
          phone: '01098765432',
          customAttributes: {
            membershipName: 'BASIC'
          }
        }
      ])
    },
    managedUserField: {
      findMany: jest.fn(async () => [{ key: 'membershipName' }])
    },
    bulkBrandMessageCampaign: {
      create: jest.fn(async ({ data }: any) => ({
        id: 'brand_campaign_1',
        ...data
      })),
      update: jest.fn(async ({ data }: any) => data),
      findUniqueOrThrow: jest.fn(async () => ({
        id: 'brand_campaign_1',
        title: '브랜드 봄 프로모션',
        status: 'SENT_TO_PROVIDER',
        mode: 'FREESTYLE',
        scheduledAt: null,
        nhnRequestId: 'nhn_brand_bulk_1',
        body: '봄 프로모션이 시작되었습니다.',
        messageType: 'IMAGE',
        templateName: null,
        templateCode: null,
        pushAlarm: true,
        adult: false,
        statsEventKey: null,
        resellerCode: null,
        imageUrl: 'https://cdn.example.com/brand.png',
        imageLink: 'https://example.com/promo',
        buttonsJson: [
          {
            type: 'WL',
            name: '자세히 보기',
            linkMo: 'https://example.com/promo'
          }
        ],
        totalRecipientCount: 2,
        acceptedCount: 2,
        failedCount: 0,
        skippedNoPhoneCount: 0,
        duplicatePhoneCount: 0,
        requestedBy: 'admin_1',
        senderProfile: {
          id: 'sender_profile_1',
          plusFriendId: '@publ',
          senderKey: 'sender_key_1',
          status: 'ACTIVE'
        },
        recipients: []
      }))
    },
    bulkBrandMessageRecipient: {
      createMany: jest.fn(async () => ({ count: 2 })),
      updateMany: jest.fn(async () => ({ count: 1 }))
    }
  };

  const nhnService = {
    sendBulkBrandMessage: jest.fn(async () => ({
      requestId: 'nhn_brand_bulk_1',
      sendResultList: [
        {
          recipientNo: '01012345678',
          recipientSeq: '1',
          resultCode: '0',
          resultMessage: 'accepted',
          recipientGroupingKey: 'managed-user:user_1'
        },
        {
          recipientNo: '01098765432',
          recipientSeq: '2',
          resultCode: '0',
          resultMessage: 'accepted',
          recipientGroupingKey: 'managed-user:user_2'
        }
      ],
      providerRequest: { mock: false },
      providerResponse: { header: { isSuccessful: true } }
    }))
  };

  const queueService = {
    enqueueBulkBrandMessageCampaign: jest.fn(async () => undefined)
  };

  return {
    prisma,
    nhnService,
    queueService,
    service: new BulkBrandMessageService(prisma as any, nhnService as any, queueService as any)
  };
}

describe('BulkBrandMessageService', () => {
  it('creates a bulk brand campaign and forwards buttons and image metadata to NHN', async () => {
    const { prisma, nhnService, service } = createFixture();

    const result = await service.createCampaign('admin_1', 'admin_1', {
      title: '브랜드 봄 프로모션',
      senderProfileId: 'sender_profile_1',
      messageType: 'IMAGE',
      content: '봄 프로모션이 시작되었습니다.',
      userIds: ['user_1', 'user_2'],
      image: {
        imageUrl: 'https://cdn.example.com/brand.png',
        imageLink: 'https://example.com/promo'
      },
      buttons: [
        {
          type: 'WL',
          name: '자세히 보기',
          linkMo: 'https://example.com/promo'
        }
      ]
    });

    expect(prisma.bulkBrandMessageCampaign.create).toHaveBeenCalled();
    expect(prisma.bulkBrandMessageRecipient.createMany).toHaveBeenCalled();
    expect(nhnService.sendBulkBrandMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        senderKey: 'sender_key_1',
        messageType: 'IMAGE',
        content: '봄 프로모션이 시작되었습니다.',
        image: expect.objectContaining({
          imageUrl: 'https://cdn.example.com/brand.png',
          imageLink: 'https://example.com/promo'
        }),
        buttons: expect.arrayContaining([
          expect.objectContaining({
            type: 'WL',
            name: '자세히 보기'
          })
        ]),
        recipients: expect.arrayContaining([
          expect.objectContaining({ recipientNo: '01012345678' }),
          expect.objectContaining({ recipientNo: '01098765432' })
        ])
      })
    );
    expect(prisma.bulkBrandMessageCampaign.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'SENT_TO_PROVIDER',
          nhnRequestId: 'nhn_brand_bulk_1'
        })
      })
    );
    expect(prisma.bulkBrandMessageCampaign.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          acceptedCount: expect.anything()
        })
      })
    );
    expect(prisma.bulkBrandMessageRecipient.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: {
          recipientSeq: '1'
        }
      })
    );
    expect(result.campaign.nhnRequestId).toBe('nhn_brand_bulk_1');
  });

  it('creates a bulk brand template campaign with recipient template parameters', async () => {
    const { prisma, nhnService, service } = createFixture();

    await service.createCampaign('admin_1', 'admin_1', {
      title: '브랜드 템플릿 발송',
      senderProfileId: 'sender_profile_1',
      mode: 'TEMPLATE',
      messageType: 'COMMERCE',
      templateCode: 'BRAND_TPL_01',
      templateName: '멤버십 혜택 안내',
      templateBody: '안녕하세요 #{username}님, #{membershipName} 혜택을 확인하세요.',
      requiredVariables: ['username', 'membershipName'],
      templateVariableMappings: [
        { templateVariable: 'username', userFieldKey: 'name' },
        { templateVariable: 'membershipName', userFieldKey: 'membershipName' }
      ],
      userIds: ['user_1', 'user_2']
    });

    expect(prisma.bulkBrandMessageCampaign.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mode: 'TEMPLATE',
          templateName: '멤버십 혜택 안내',
          templateCode: 'BRAND_TPL_01',
          messageType: 'COMMERCE'
        })
      })
    );
    expect(prisma.bulkBrandMessageRecipient.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            templateParameters: {
              username: '민우',
              membershipName: 'VIP'
            }
          }),
          expect.objectContaining({
            templateParameters: {
              username: '서연',
              membershipName: 'BASIC'
            }
          })
        ])
      })
    );
    expect(nhnService.sendBulkBrandMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'TEMPLATE',
        templateCode: 'BRAND_TPL_01',
        recipients: expect.arrayContaining([
          expect.objectContaining({
            templateParameters: {
              username: '민우',
              membershipName: 'VIP'
            }
          })
        ])
      })
    );
  });

  it('rejects image message campaigns without an uploaded image url', async () => {
    const { service } = createFixture();

    await expect(
      service.createQueuedCampaign('admin_1', 'admin_1', {
        title: '이미지 누락',
        senderProfileId: 'sender_profile_1',
        messageType: 'IMAGE',
        content: '이미지가 필요한 메시지입니다.',
        userIds: ['user_1']
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('falls back to recipient phone matching when NHN omits recipientGroupingKey', async () => {
    const { prisma, nhnService, service } = createFixture();

    (nhnService.sendBulkBrandMessage as jest.Mock).mockResolvedValueOnce({
      requestId: 'nhn_brand_bulk_2',
      sendResultList: [
        {
          recipientNo: '01012345678',
          recipientSeq: '1',
          resultCode: '3022',
          resultMessage: '발송 가능한 시간이 아님',
          recipientGroupingKey: null
        },
        {
          recipientNo: '01098765432',
          recipientSeq: '2',
          resultCode: '0',
          resultMessage: 'accepted',
          recipientGroupingKey: null
        }
      ],
      providerRequest: { mock: false },
      providerResponse: { header: { isSuccessful: true } }
    });

    await service.createCampaign('admin_1', 'admin_1', {
      title: '그룹키 누락',
      senderProfileId: 'sender_profile_1',
      messageType: 'TEXT',
      content: '테스트',
      userIds: ['user_1', 'user_2']
    });

    expect(prisma.bulkBrandMessageRecipient.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          campaignId: 'brand_campaign_1',
          recipientPhone: '01012345678'
        }),
        data: expect.objectContaining({
          status: 'FAILED'
        })
      })
    );
  });
});
