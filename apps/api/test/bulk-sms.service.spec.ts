import { ConflictException } from '@nestjs/common';
import { BulkSmsService } from '../src/bulk-sms/bulk-sms.service';

function createFixture() {
  const prisma = {
    senderNumber: {
      findFirst: jest.fn(async () => ({
        id: 'sender_1',
        tenantId: 'tenant_demo',
        phoneNumber: '01055556666',
        status: 'APPROVED'
      }))
    },
    template: {
      findFirst: jest.fn(async () => null) as jest.Mock
    },
    managedUser: {
      findMany: jest.fn(async () => [
        {
          id: 'user_1',
          tenantId: 'tenant_demo',
          name: '민우',
          phone: '74601012345678',
          gradeOrLevel: 'Gold',
          customAttributes: {
            ticketCount: 4
          }
        },
        {
          id: 'user_2',
          tenantId: 'tenant_demo',
          name: '서연',
          phone: '01098765432',
          gradeOrLevel: 'Silver',
          customAttributes: {
            ticketCount: 7
          }
        }
      ])
    },
    managedUserField: {
      findMany: jest.fn(async () => [
        {
          key: 'ticketCount'
        }
      ])
    },
    bulkSmsCampaign: {
      create: jest.fn(async ({ data }: any) => ({
        id: 'campaign_1',
        ...data
      })),
      update: jest.fn(async ({ data }: any) => data),
      findUniqueOrThrow: jest.fn(async () => ({
        id: 'campaign_1',
        title: '대량 공지',
        status: 'SENT_TO_PROVIDER',
        body: '안녕하세요',
        nhnRequestId: 'nhn_bulk_1',
        totalRecipientCount: 2,
        acceptedCount: 2,
        failedCount: 0,
        skippedNoPhoneCount: 0,
        duplicatePhoneCount: 0,
        requestedBy: 'admin_1',
        senderNumber: {
          id: 'sender_1',
          phoneNumber: '01055556666',
          status: 'APPROVED'
        },
        template: null,
        recipients: []
      })),
      findMany: jest.fn(async () => [])
    },
    bulkSmsRecipient: {
      createMany: jest.fn(async () => ({ count: 2 })),
      updateMany: jest.fn(async () => ({ count: 1 }))
    }
  };

  const nhnService = {
    sendBulkSms: jest.fn(async () => ({
      requestId: 'nhn_bulk_1',
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

  return {
    prisma,
    nhnService,
    service: new BulkSmsService(prisma as any, nhnService as any)
  };
}

describe('BulkSmsService', () => {
  it('creates a bulk SMS campaign and forwards recipients to NHN bulk API', async () => {
    const { prisma, nhnService, service } = createFixture();

    const result = await service.createCampaign('tenant_demo', 'admin_1', {
      title: '대량 공지',
      senderNumberId: 'sender_1',
      body: '안녕하세요',
      userIds: ['user_1', 'user_2']
    });

    expect(prisma.bulkSmsCampaign.create).toHaveBeenCalled();
    expect(prisma.bulkSmsRecipient.createMany).toHaveBeenCalled();
    expect(nhnService.sendBulkSms).toHaveBeenCalledWith(
      expect.objectContaining({
        sendNo: '01055556666',
        body: '안녕하세요',
        recipients: expect.arrayContaining([
          expect.objectContaining({ recipientNo: '01012345678' }),
          expect.objectContaining({ recipientNo: '01098765432' })
        ])
      })
    );
    expect(result.campaign.nhnRequestId).toBe('nhn_bulk_1');
  });

  it('formats advertisement bulk sms with prefix and opt-out text', async () => {
    const { prisma, nhnService, service } = createFixture();

    await service.createCampaign('tenant_demo', 'admin_1', {
      title: '광고 공지',
      senderNumberId: 'sender_1',
      body: '봄 세일 안내입니다.',
      isAdvertisement: true,
      advertisingServiceName: '비주오',
      userIds: ['user_1', 'user_2']
    });

    expect(prisma.bulkSmsCampaign.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          body: `(광고)비주오\n봄 세일 안내입니다.\n무료수신거부 080-500-4233`
        })
      })
    );
    expect(nhnService.sendBulkSms).toHaveBeenCalledWith(
      expect.objectContaining({
        body: `(광고)비주오\n봄 세일 안내입니다.\n무료수신거부 080-500-4233`
      })
    );
  });

  it('supports variable templates by mapping template variables to managed user columns', async () => {
    const { prisma, nhnService, service } = createFixture();
    prisma.template.findFirst.mockResolvedValueOnce({
      id: 'tpl_sms_notice',
      tenantId: 'tenant_demo',
      channel: 'SMS',
      status: 'PUBLISHED',
      body: '안녕하세요 {{username}}님, 현재 등급은 {{level}}이고 구매 티켓은 {{ticketCount}}장입니다.',
      requiredVariables: ['username', 'level', 'ticketCount']
    });

    await service.createCampaign('tenant_demo', 'admin_1', {
      title: '변수 공지',
      senderNumberId: 'sender_1',
      templateId: 'tpl_sms_notice',
      userIds: ['user_1', 'user_2'],
      templateVariableMappings: [
        { templateVariable: 'username', userFieldKey: 'name' },
        { templateVariable: 'level', userFieldKey: 'gradeOrLevel' },
        { templateVariable: 'ticketCount', userFieldKey: 'ticketCount' }
      ]
    });

    expect(nhnService.sendBulkSms).toHaveBeenCalledWith(
      expect.objectContaining({
        body: '안녕하세요 #{username}님, 현재 등급은 #{level}이고 구매 티켓은 #{ticketCount}장입니다.',
        recipients: expect.arrayContaining([
          expect.objectContaining({
            recipientNo: '01012345678',
            templateParameters: {
              username: '민우',
              level: 'Gold',
              ticketCount: '4'
            }
          }),
          expect.objectContaining({
            recipientNo: '01098765432',
            templateParameters: {
              username: '서연',
              level: 'Silver',
              ticketCount: '7'
            }
          })
        ])
      })
    );
  });

  it('rejects variable templates when a required mapping is missing', async () => {
    const { prisma, service } = createFixture();
    prisma.template.findFirst.mockResolvedValueOnce({
      id: 'tpl_sms_notice',
      tenantId: 'tenant_demo',
      channel: 'SMS',
      status: 'PUBLISHED',
      body: '안녕하세요 {{username}}님',
      requiredVariables: ['username']
    });

    await expect(
      service.createCampaign('tenant_demo', 'admin_1', {
        title: '변수 공지',
        senderNumberId: 'sender_1',
        templateId: 'tpl_sms_notice',
        userIds: ['user_1']
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects when more than 1000 users are selected', async () => {
    const { service } = createFixture();

    await expect(
      service.createCampaign('tenant_demo', 'admin_1', {
        title: '너무 큰 배치',
        senderNumberId: 'sender_1',
        body: '안녕하세요',
        userIds: Array.from({ length: 1001 }, (_, index) => `user_${index}`)
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('registers a scheduled bulk SMS campaign with NHN immediately', async () => {
    const { nhnService, service } = createFixture();
    const scheduledAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const result = await service.createCampaign('tenant_demo', 'admin_1', {
      title: '예약 공지',
      senderNumberId: 'sender_1',
      body: '안녕하세요',
      userIds: ['user_1', 'user_2'],
      scheduledAt
    });

    expect(nhnService.sendBulkSms).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduledAt: new Date(scheduledAt)
      })
    );
    expect(result.campaign.nhnRequestId).toBe('nhn_bulk_1');
  });
});
