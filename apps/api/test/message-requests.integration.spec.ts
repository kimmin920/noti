import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { MessageChannel } from '@prisma/client';
import { MessageRequestsService } from '../src/message-requests/message-requests.service';

type RequestRow = {
  id: string;
  tenantId: string;
  eventKey: string;
  idempotencyKey: string;
  recipientPhone: string;
  recipientUserId?: string;
  variablesJson: Record<string, string | number>;
  metadataJson?: Record<string, unknown>;
  manualBody?: string | null;
  scheduledAt?: Date | null;
  status: string;
  resolvedChannel: MessageChannel;
};

function createFixtureService() {
  const rows: RequestRow[] = [];
  let seq = 1;

  const rules: Record<string, any> = {
    'tenant_demo:PUBL_USER_SIGNUP': {
      enabled: true,
      channelStrategy: 'SMS_ONLY',
      requiredVariables: ['username'],
      smsTemplate: { id: 'tpl_sms_signup', status: 'PUBLISHED' },
      smsSenderNumber: { id: 'sender_1', status: 'APPROVED' },
      alimtalkTemplate: null,
      alimtalkSenderProfile: null
    },
    'tenant_demo:PUBL_TICKET_PURCHASED': {
      enabled: true,
      channelStrategy: 'ALIMTALK_THEN_SMS',
      requiredVariables: ['username', 'ticketName'],
      smsTemplate: { id: 'tpl_sms_ticket', status: 'PUBLISHED' },
      smsSenderNumber: { id: 'sender_1', status: 'APPROVED' },
      alimtalkTemplate: { id: 'pt_apr', providerStatus: 'APR', template: { id: 'tpl_alim_ticket' } },
      alimtalkSenderProfile: { id: 'profile_1' }
    },
    'tenant_demo:PUBL_PAYMENT_COMPLETED': {
      enabled: true,
      channelStrategy: 'ALIMTALK_ONLY',
      requiredVariables: ['username', 'amount'],
      smsTemplate: null,
      smsSenderNumber: null,
      alimtalkTemplate: { id: 'pt_req', providerStatus: 'REQ', template: { id: 'tpl_alim_payment' } },
      alimtalkSenderProfile: { id: 'profile_1' }
    }
  };

  const prisma = {
    messageRequest: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.tenantId_idempotencyKey) {
          return (
            rows.find(
              (r) =>
                r.tenantId === where.tenantId_idempotencyKey.tenantId &&
                r.idempotencyKey === where.tenantId_idempotencyKey.idempotencyKey
            ) ?? null
          );
        }

        return rows.find((r) => r.id === where.id) ?? null;
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        return (
          rows.find((r) => r.id === where.id && r.tenantId === where.tenantId) ?? null
        );
      }),
      create: jest.fn(async ({ data }: any) => {
        const created = {
          id: `req_${seq++}`,
          ...data
        };
        rows.push(created);
        return created;
      })
    },
    senderNumber: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (
          where.id === 'sender_1' &&
          where.tenantId === 'tenant_demo' &&
          where.status === 'APPROVED'
        ) {
          return {
            id: 'sender_1',
            tenantId: 'tenant_demo',
            status: 'APPROVED',
            phoneNumber: '0212345678'
          };
        }

        return null;
      })
    },
    senderProfile: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (where.id === 'profile_1' && where.tenantId === 'tenant_demo') {
          return {
            id: 'profile_1',
            tenantId: 'tenant_demo',
            senderKey: 'SENDER_KEY_1'
          };
        }

        return null;
      })
    },
    providerTemplate: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (
          where.id === 'provider_tpl_1' &&
          where.tenantId === 'tenant_demo' &&
          where.channel === 'ALIMTALK'
        ) {
          return {
            id: 'provider_tpl_1',
            tenantId: 'tenant_demo',
            providerStatus: 'APR',
            templateCode: 'WELCOME001',
            template: {
              id: 'tpl_alim_manual',
              body: '#{username}님 가입을 환영합니다.',
              requiredVariables: ['username']
            }
          };
        }

        return null;
      })
    },
    eventRule: {
      findUnique: jest.fn(async ({ where }: any) => {
        const key = `${where.tenantId_eventKey.tenantId}:${where.tenantId_eventKey.eventKey}`;
        return rules[key] ?? null;
      })
    }
  };

  const queueService = {
    enqueueSendMessage: jest.fn(async () => undefined)
  };

  const service = new MessageRequestsService(prisma as any, queueService as any);
  return { service, rows, queueService };
}

describe('MessageRequestsService integration scenarios', () => {
  it('handles sample event PUBL_USER_SIGNUP', async () => {
    const { service } = createFixtureService();
    const result = await service.create(
      {
        tenantId: 'tenant_demo',
        eventKey: 'PUBL_USER_SIGNUP',
        recipient: { phone: '01012345678', userId: 'u1' },
        variables: { username: '민우' },
        metadata: { publEventId: 'evt1' }
      },
      'evt1'
    );

    expect(result.request.status).toBe('ACCEPTED');
    expect(result.request.resolvedChannel).toBe('SMS');
  });

  it('handles sample event PUBL_TICKET_PURCHASED', async () => {
    const { service } = createFixtureService();
    const result = await service.create(
      {
        tenantId: 'tenant_demo',
        eventKey: 'PUBL_TICKET_PURCHASED',
        recipient: { phone: '01012345678', userId: 'u1' },
        variables: { username: '민우', ticketName: 'VIP' },
        metadata: { publEventId: 'evt2' }
      },
      'evt2'
    );

    expect(result.request.status).toBe('ACCEPTED');
    expect(result.request.resolvedChannel).toBe('ALIMTALK');
  });

  it('blocks ALIMTALK_ONLY when template is not APR', async () => {
    const { service } = createFixtureService();

    await expect(
      service.create(
        {
          tenantId: 'tenant_demo',
          eventKey: 'PUBL_PAYMENT_COMPLETED',
          recipient: { phone: '01012345678', userId: 'u1' },
          variables: { username: '민우', amount: '39000' },
          metadata: { publEventId: 'evt3' }
        },
        'evt3'
      )
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns same requestId for duplicate idempotency key', async () => {
    const { service } = createFixtureService();

    const first = await service.create(
      {
        tenantId: 'tenant_demo',
        eventKey: 'PUBL_USER_SIGNUP',
        recipient: { phone: '01012345678', userId: 'u1' },
        variables: { username: '민우' }
      },
      'same-key'
    );

    const second = await service.create(
      {
        tenantId: 'tenant_demo',
        eventKey: 'PUBL_USER_SIGNUP',
        recipient: { phone: '01012345678', userId: 'u1' },
        variables: { username: '민우' }
      },
      'same-key'
    );

    expect(second.request.id).toBe(first.request.id);
    expect(second.idempotent).toBe(true);
  });

  it('returns 422-equivalent error when required variables are missing', async () => {
    const { service, rows } = createFixtureService();

    await expect(
      service.create(
        {
          tenantId: 'tenant_demo',
          eventKey: 'PUBL_TICKET_PURCHASED',
          recipient: { phone: '01012345678', userId: 'u1' },
          variables: { username: '민우' }
        },
        'missing-vars'
      )
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    expect(rows).toHaveLength(0);
  });

  it('blocks message request detail lookup across tenants', async () => {
    const { service } = createFixtureService();

    const created = await service.create(
      {
        tenantId: 'tenant_demo',
        eventKey: 'PUBL_USER_SIGNUP',
        recipient: { phone: '01012345678', userId: 'u1' },
        variables: { username: '민우' }
      },
      'cross-tenant-check'
    );

    await expect(service.getByIdForTenant('tenant_other', created.request.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('accepts manual sms request when approved sender number exists', async () => {
    const { service } = createFixtureService();

    const request = await service.createManualSms('tenant_demo', 'user_1', {
      senderNumberId: 'sender_1',
      recipientPhone: '01012345678',
      body: '직접 보내는 테스트 문자입니다.'
    });

    expect(request.eventKey).toBe('MANUAL_SMS_SEND');
    expect(request.resolvedChannel).toBe('SMS');
    expect((request as any).manualBody).toBe('직접 보내는 테스트 문자입니다.');
  });

  it('formats manual advertisement sms with prefix and opt-out text', async () => {
    const { service } = createFixtureService();

    const request = await service.createManualSms('tenant_demo', 'user_1', {
      senderNumberId: 'sender_1',
      recipientPhone: '01012345678',
      body: '봄 세일 안내입니다.',
      isAdvertisement: true,
      advertisingServiceName: '비주오'
    });

    expect((request as any).manualBody).toBe(`(광고)비주오\n봄 세일 안내입니다.\n무료수신거부 080-500-4233`);
    expect((request.metadataJson as any)?.smsAdvertisement).toEqual({
      enabled: true,
      advertisingServiceName: '비주오'
    });
  });

  it('stores MMS attachment metadata and message type for manual SMS', async () => {
    const { service } = createFixtureService();

    const request = await service.createManualSms(
      'tenant_demo',
      'user_1',
      {
        senderNumberId: 'sender_1',
        recipientPhone: '01012345678',
        body: '이미지 첨부 안내 메시지입니다.',
        mmsTitle: '상품 안내'
      },
      [
        {
          path: 'uploads/promo.jpg',
          originalname: 'promo.jpg',
          mimetype: 'image/jpeg',
          size: 120 * 1024
        }
      ]
    );

    expect((request.metadataJson as any)?.smsMessageType).toBe('MMS');
    expect((request.metadataJson as any)?.mmsTitle).toBe('상품 안내');
    expect((request.metadataJson as any)?.smsAttachments).toEqual([
      expect.objectContaining({
        originalName: 'promo.jpg',
        mimeType: 'image/jpeg',
        size: 120 * 1024
      })
    ]);
  });

  it('accepts manual alimtalk request with SMS failover metadata', async () => {
    const { service } = createFixtureService();

    const request = await service.createManualAlimtalk('tenant_demo', 'user_1', {
      senderProfileId: 'profile_1',
      providerTemplateId: 'provider_tpl_1',
      recipientPhone: '01012345678',
      useSmsFailover: true,
      fallbackSenderNumberId: 'sender_1',
      variables: {
        username: '민우'
      }
    });

    expect(request.eventKey).toBe('MANUAL_ALIMTALK_SEND');
    expect(request.resolvedChannel).toBe('ALIMTALK');
    expect((request.metadataJson as any)?.smsFailover).toEqual({
      enabled: true,
      senderNumberId: 'sender_1',
      senderNo: '0212345678'
    });
  });

  it('stores scheduledAt and enqueues immediate NHN reservation registration for manual SMS', async () => {
    const { service, rows, queueService } = createFixtureService();
    const scheduledAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const request = await service.createManualSms('tenant_demo', 'user_1', {
      senderNumberId: 'sender_1',
      recipientPhone: '01012345678',
      body: '예약 발송 테스트',
      scheduledAt
    });

    expect(rows[0]?.scheduledAt).toEqual(new Date(scheduledAt));
    expect(request.id).toBe(rows[0]?.id);
    expect(queueService.enqueueSendMessage).toHaveBeenCalledWith(request.id);
  });

  it('blocks SMS failover when approved sender number is missing', async () => {
    const { service } = createFixtureService();

    await expect(
      service.createManualAlimtalk('tenant_demo', 'user_1', {
        senderProfileId: 'profile_1',
        providerTemplateId: 'provider_tpl_1',
        recipientPhone: '01012345678',
        useSmsFailover: true,
        variables: {
          username: '민우'
        }
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
