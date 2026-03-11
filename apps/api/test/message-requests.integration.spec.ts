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
  metadataJson?: Record<string, string | number>;
  manualBody?: string | null;
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
});
