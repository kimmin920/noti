import { ConflictException } from '@nestjs/common';
import { BulkAlimtalkService } from '../src/bulk-alimtalk/bulk-alimtalk.service';

function createFixture() {
  const prisma = {
    senderProfile: {
      findFirst: jest.fn(async () => ({
        id: 'sender_profile_1',
        tenantId: 'tenant_demo',
        senderKey: 'sender_key_1',
        status: 'ACTIVE'
      }))
    },
    providerTemplate: {
      findFirst: jest.fn(async () => ({
        id: 'provider_template_1',
        tenantId: 'tenant_demo',
        channel: 'ALIMTALK',
        providerStatus: 'APR',
        templateCode: 'TPLWELCOME01',
        kakaoTemplateCode: 'KAKAO_TPL_01',
        nhnTemplateId: 'TPLWELCOME01',
        template: {
          id: 'template_1',
          channel: 'ALIMTALK',
          body: '안녕하세요 {{username}}님, {{courseName}} 수강이 시작됩니다.',
          requiredVariables: ['username', 'courseName']
        }
      })) as jest.Mock
    },
    managedUser: {
      findMany: jest.fn(async () => [
        {
          id: 'user_1',
          tenantId: 'tenant_demo',
          name: '민우',
          phone: '74601012345678',
          segment: 'React Bootcamp',
          customAttributes: null
        },
        {
          id: 'user_2',
          tenantId: 'tenant_demo',
          name: '서연',
          phone: '01098765432',
          segment: 'Data Sprint',
          customAttributes: null
        }
      ])
    },
    managedUserField: {
      findMany: jest.fn(async () => [])
    },
    bulkAlimtalkCampaign: {
      create: jest.fn(async ({ data }: any) => ({
        id: 'campaign_1',
        ...data
      })),
      update: jest.fn(async ({ data }: any) => data),
      findUniqueOrThrow: jest.fn(async () => ({
        id: 'campaign_1',
        title: '대량 알림톡',
        status: 'SENT_TO_PROVIDER',
        templateSource: 'LOCAL',
        templateName: '수강 안내',
        templateCode: 'TPLWELCOME01',
        body: '안녕하세요 {{username}}님, {{courseName}} 수강이 시작됩니다.',
        nhnRequestId: 'nhn_alimtalk_bulk_1',
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
        providerTemplate: {
          id: 'provider_template_1',
          templateCode: 'TPLWELCOME01',
          template: {
            id: 'template_1',
            name: '수강 안내',
            body: '안녕하세요 {{username}}님, {{courseName}} 수강이 시작됩니다.'
          }
        },
        recipients: []
      })),
      findMany: jest.fn(async () => [])
    },
    bulkAlimtalkRecipient: {
      createMany: jest.fn(async () => ({ count: 2 })),
      updateMany: jest.fn(async () => ({ count: 1 }))
    }
  };

  const nhnService = {
    sendBulkAlimtalk: jest.fn(async () => ({
      requestId: 'nhn_alimtalk_bulk_1',
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
      providerResponse: { header: { isSuccessful: true } },
      mock: false
    }))
  };

  const queueService = {
    enqueueBulkAlimtalkCampaign: jest.fn(async () => undefined)
  };

  return {
    prisma,
    nhnService,
    queueService,
    service: new BulkAlimtalkService(prisma as any, nhnService as any, queueService as any)
  };
}

describe('BulkAlimtalkService', () => {
  it('creates a bulk AlimTalk campaign and forwards mapped recipient variables to NHN', async () => {
    const { prisma, nhnService, service } = createFixture();

    const result = await service.createCampaign('admin_1', 'admin_1', {
      title: '대량 알림톡',
      senderProfileId: 'sender_profile_1',
      providerTemplateId: 'provider_template_1',
      userIds: ['user_1', 'user_2'],
      templateVariableMappings: [
        { templateVariable: 'username', userFieldKey: 'name' },
        { templateVariable: 'courseName', userFieldKey: 'segment' }
      ]
    });

    expect(prisma.bulkAlimtalkCampaign.create).toHaveBeenCalled();
    expect(prisma.bulkAlimtalkRecipient.createMany).toHaveBeenCalled();
    expect(nhnService.sendBulkAlimtalk).toHaveBeenCalledWith(
      expect.objectContaining({
        senderKey: 'sender_key_1',
        templateCode: 'TPLWELCOME01',
        recipients: expect.arrayContaining([
          expect.objectContaining({
            recipientNo: '01012345678',
            templateParameters: {
              username: '민우',
              courseName: 'React Bootcamp'
            }
          }),
          expect.objectContaining({
            recipientNo: '01098765432',
            templateParameters: {
              username: '서연',
              courseName: 'Data Sprint'
            }
          })
        ])
      })
    );
    expect(prisma.bulkAlimtalkCampaign.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'SENT_TO_PROVIDER',
          nhnRequestId: 'nhn_alimtalk_bulk_1'
        })
      })
    );
    expect(prisma.bulkAlimtalkCampaign.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          acceptedCount: expect.anything()
        })
      })
    );
    expect(prisma.bulkAlimtalkRecipient.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: {
          recipientSeq: '1'
        }
      })
    );
    expect(result.campaign.nhnRequestId).toBe('nhn_alimtalk_bulk_1');
  });

  it('rejects variable templates when a required mapping is missing', async () => {
    const { service } = createFixture();

    await expect(
      service.createCampaign('admin_1', 'admin_1', {
        title: '매핑 누락',
        senderProfileId: 'sender_profile_1',
        providerTemplateId: 'provider_template_1',
        userIds: ['user_1']
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a bulk AlimTalk campaign from an approved group template payload', async () => {
    const { prisma, nhnService, service } = createFixture();

    (prisma.bulkAlimtalkCampaign.findUniqueOrThrow as jest.Mock).mockResolvedValueOnce({
      id: 'campaign_group_1',
      title: '그룹 템플릿 발송',
      status: 'SENT_TO_PROVIDER',
      templateSource: 'GROUP',
      templateName: '기본 그룹 템플릿',
      templateCode: 'GROUP_TPL_01',
      body: '안녕하세요 {{username}}님',
      nhnRequestId: 'nhn_alimtalk_bulk_group_1',
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
      providerTemplate: null,
      recipients: []
    });

    const result = await service.createCampaign('admin_1', 'admin_1', {
      title: '그룹 템플릿 발송',
      senderProfileId: 'sender_profile_1',
      templateSource: 'GROUP',
      templateCode: 'GROUP_TPL_01',
      templateName: '기본 그룹 템플릿',
      templateBody: '안녕하세요 {{username}}님',
      userIds: ['user_1', 'user_2'],
      templateVariableMappings: [{ templateVariable: 'username', userFieldKey: 'name' }]
    });

    expect(prisma.providerTemplate.findFirst).not.toHaveBeenCalled();
    expect(prisma.bulkAlimtalkCampaign.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          templateSource: 'GROUP',
          templateName: '기본 그룹 템플릿',
          templateCode: 'GROUP_TPL_01',
          providerTemplateId: null
        })
      })
    );
    expect(nhnService.sendBulkAlimtalk).toHaveBeenCalledWith(
      expect.objectContaining({
        templateCode: 'GROUP_TPL_01'
      })
    );
    expect(result.campaign.templateSource).toBe('GROUP');
    expect(result.campaign.providerTemplate).toBeNull();
  });

  it('registers a scheduled bulk AlimTalk campaign with NHN immediately', async () => {
    const { nhnService, service } = createFixture();
    const scheduledAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const result = await service.createCampaign('admin_1', 'admin_1', {
      title: '예약 알림톡',
      senderProfileId: 'sender_profile_1',
      providerTemplateId: 'provider_template_1',
      userIds: ['user_1', 'user_2'],
      templateVariableMappings: [
        { templateVariable: 'username', userFieldKey: 'name' },
        { templateVariable: 'courseName', userFieldKey: 'segment' }
      ],
      scheduledAt
    });

    expect(nhnService.sendBulkAlimtalk).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduledAt: new Date(scheduledAt)
      })
    );
    expect(result.campaign.nhnRequestId).toBe('nhn_alimtalk_bulk_1');
  });

  it('creates a queued bulk AlimTalk campaign for the V2 async pipeline', async () => {
    const { nhnService, queueService, service } = createFixture();
    const scheduledAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const result = await service.createQueuedCampaign('admin_1', 'admin_1', {
      title: '큐 발송 알림톡',
      senderProfileId: 'sender_profile_1',
      providerTemplateId: 'provider_template_1',
      userIds: ['user_1', 'user_2'],
      templateVariableMappings: [
        { templateVariable: 'username', userFieldKey: 'name' },
        { templateVariable: 'courseName', userFieldKey: 'segment' }
      ],
      scheduledAt
    });

    expect(queueService.enqueueBulkAlimtalkCampaign).toHaveBeenCalledWith(
      'campaign_1',
      expect.any(Date)
    );
    expect(nhnService.sendBulkAlimtalk).not.toHaveBeenCalled();
    expect(result.campaign.id).toBe('campaign_1');
  });
});
