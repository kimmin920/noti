import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { MessageChannel } from '@prisma/client';
import { MessageRequestsService } from '../src/message-requests/message-requests.service';

type RequestRow = {
  id: string;
  ownerUserId: string;
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

function createFixtureService(options: { publEventServiceStatus?: 'ACTIVE' | 'INACTIVE' | 'DRAFT' } = {}) {
  const rows: RequestRow[] = [];
  let seq = 1;
  let prisma: any;

  const rules: Record<string, any> = {
    'tenant_demo:PUBL_USER_SIGNUP': {
      ownerUserId: 'tenant_demo',
      enabled: true,
      channelStrategy: 'SMS_ONLY',
      requiredVariables: ['username'],
      smsTemplate: { id: 'tpl_sms_signup', status: 'PUBLISHED' },
      smsSenderNumber: { id: 'sender_1', status: 'APPROVED' },
      alimtalkTemplate: null,
      alimtalkSenderProfile: null
    },
    'tenant_demo:PUBL_TICKET_PURCHASED': {
      ownerUserId: 'tenant_demo',
      enabled: true,
      channelStrategy: 'ALIMTALK_THEN_SMS',
      requiredVariables: ['username', 'ticketName'],
      smsTemplate: { id: 'tpl_sms_ticket', status: 'PUBLISHED' },
      smsSenderNumber: { id: 'sender_1', status: 'APPROVED' },
      alimtalkTemplate: { id: 'pt_apr', providerStatus: 'APR', template: { id: 'tpl_alim_ticket' } },
      alimtalkSenderProfile: { id: 'profile_1' }
    },
    'tenant_demo:PUBL_PAYMENT_COMPLETED': {
      ownerUserId: 'tenant_demo',
      enabled: true,
      channelStrategy: 'ALIMTALK_ONLY',
      requiredVariables: ['username', 'amount'],
      smsTemplate: null,
      smsSenderNumber: null,
      alimtalkTemplate: { id: 'pt_req', providerStatus: 'REQ', template: { id: 'tpl_alim_payment' } },
      alimtalkSenderProfile: { id: 'profile_1' }
    }
  };

  prisma = {
    $transaction: jest.fn(async (callback: any) => callback(prisma)),
    messageRequest: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.ownerUserId_idempotencyKey) {
          return (
            rows.find(
              (r) =>
                r.ownerUserId === where.ownerUserId_idempotencyKey.ownerUserId &&
                r.idempotencyKey === where.ownerUserId_idempotencyKey.idempotencyKey
            ) ?? null
          );
        }

        return rows.find((r) => r.id === where.id) ?? null;
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        return rows.find((r) => r.id === where.id && r.ownerUserId === where.ownerUserId) ?? null;
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
        if (where.id === 'sender_1' && where.status === 'APPROVED') {
          return {
            id: 'sender_1',
            ownerUserId: 'tenant_demo',
            status: 'APPROVED',
            phoneNumber: '0212345678'
          };
        }

        return null;
      })
    },
    senderProfile: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (where.id === 'profile_1') {
          return {
            id: 'profile_1',
            ownerUserId: 'tenant_demo',
            senderKey: 'SENDER_KEY_1'
          };
        }

        return null;
      })
    },
    providerTemplate: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (where.id === 'provider_tpl_1' && where.channel === 'ALIMTALK') {
          return {
            id: 'provider_tpl_1',
            ownerUserId: 'tenant_demo',
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
    adminUser: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.providerUserId === 'publ:business_123') {
          return {
            id: 'tenant_demo',
            providerUserId: 'publ:business_123',
            accessOrigin: 'PUBL'
          };
        }

        return null;
      })
    },
    publEventDefinition: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (where.eventKey === 'PUBL_TICKET_PURCHASED') {
          return {
            eventKey: 'PUBL_TICKET_PURCHASED',
            serviceStatus: options.publEventServiceStatus ?? 'ACTIVE',
            props: [
              {
                rawPath: 'targetPhoneNumber',
                alias: 'targetPhoneNumber',
                label: '수신자 전화번호',
                fallback: null,
                parserPipeline: null,
                enabled: true
              },
              {
                rawPath: 'targetId',
                alias: 'targetId',
                label: '수신자 ID',
                fallback: null,
                parserPipeline: null,
                enabled: true
              },
              {
                rawPath: 'targetName',
                alias: 'username',
                label: '수신자 이름',
                fallback: '고객',
                parserPipeline: null,
                enabled: true
              },
              {
                rawPath: 'ticket.name',
                alias: 'ticketName',
                label: '티켓명',
                fallback: null,
                parserPipeline: null,
                enabled: true
              },
              {
                rawPath: 'occurredAt',
                alias: 'eventOccurredAt',
                label: '이벤트 발생일시',
                fallback: null,
                parserPipeline: [{ type: 'dateFormat', timezone: 'Asia/Seoul', format: 'yyyy년 M월 d일 HH:mm' }],
                enabled: true
              },
              {
                rawPath: 'sourceDetailMeta.priceAmount',
                alias: 'priceAmount',
                label: '결제 금액',
                fallback: null,
                parserPipeline: [{ type: 'currencyFormat', currencyPath: 'sourceDetailMeta.priceCurrency', locale: 'ko-KR' }],
                enabled: true
              },
              {
                rawPath: 'sourceDetailMeta.orderItems',
                alias: 'orderItemNames',
                label: '주문 상품 목록',
                fallback: null,
                parserPipeline: [
                  { type: 'mapTemplate', template: '#{productName} #{serializedOptions} #{qty}개' },
                  { type: 'join', separator: ', ' }
                ],
                enabled: true
              }
            ]
          };
        }

        return null;
      })
    },
    eventRule: {
      findFirst: jest.fn(async ({ where }: any) => {
        const key = `${where.ownerUserId}:${where.eventKey}`;
        return rules[key] ?? null;
      })
    }
  };

  const queueService = {
    enqueueSendMessage: jest.fn(async () => undefined)
  };

  const smsQuotaService = {
    resolveQuotaAccountId: jest.fn(async () => 'admin_1'),
    resolveQuotaUserId: jest.fn(async () => 'tenant_demo'),
    assertCanReserveUsage: jest.fn(async () => ({
      monthlyLimit: 1000,
      monthlyUsed: 0,
      monthlyRemaining: 1000
    })),
    reserveUsage: jest.fn(async () => undefined)
  };

  const service = new MessageRequestsService(prisma as any, queueService as any, smsQuotaService as any);
  return { service, rows, queueService, smsQuotaService };
}

describe('MessageRequestsService integration scenarios', () => {
  it('handles sample event PUBL_USER_SIGNUP', async () => {
    const { service } = createFixtureService();
    const result = await service.create(
      {
        ownerUserId: 'tenant_demo',
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
        ownerUserId: 'tenant_demo',
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

  it('accepts Publ raw event with providerUserId and maps props to variables', async () => {
    const { service, queueService } = createFixtureService();
    const result = await service.createFromPublEvent(
      {
        partnerKey: 'PUBL',
        providerUserId: 'publ:business_123',
        eventKey: 'PUBL_TICKET_PURCHASED',
        props: {
          targetPhoneNumber: '01012345678',
          targetId: 'u1',
          targetName: '민우',
          occurredAt: '2024-03-04T02:40:15.016Z',
          ticket: {
            name: 'VIP'
          },
          sourceDetailMeta: {
            priceAmount: 20000,
            priceCurrency: 'KRW',
            orderItems: [
              {
                productName: '티셔츠',
                serializedOptions: '빨강',
                qty: 2
              },
              {
                productName: '모자',
                serializedOptions: '검정',
                qty: 1
              }
            ]
          }
        },
        metadata: {
          publEventId: 'evt_2'
        }
      },
      'publ-evt-2'
    );

    expect(result.request.ownerUserId).toBe('tenant_demo');
    expect(result.request.recipientPhone).toBe('01012345678');
    expect(result.request.recipientUserId).toBe('u1');
    expect(result.request.variablesJson).toEqual(
      expect.objectContaining({
        username: '민우',
        ticketName: 'VIP',
        eventOccurredAt: '2024년 3월 4일 11:40',
        priceAmount: '₩20,000',
        orderItemNames: '티셔츠 빨강 2개, 모자 검정 1개'
      })
    );
    expect(result.request.metadataJson).toEqual(
      expect.objectContaining({
        partnerKey: 'PUBL',
        providerUserId: 'publ:business_123',
        publEventId: 'evt_2'
      })
    );
    expect(result.request.resolvedChannel).toBe('ALIMTALK');
    expect(queueService.enqueueSendMessage).toHaveBeenCalledWith(result.request.id);
  });

  it('rejects Publ raw event when providerUserId is unknown', async () => {
    const { service } = createFixtureService();

    await expect(
      service.createFromPublEvent(
        {
          partnerKey: 'PUBL',
          providerUserId: 'publ:missing',
          eventKey: 'PUBL_TICKET_PURCHASED',
          props: {
            targetPhoneNumber: '01012345678',
            username: '민우',
            ticketName: 'VIP'
          }
        },
        'publ-missing-owner'
      )
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects Publ raw event when global Publ event is inactive', async () => {
    const { service, queueService, rows } = createFixtureService({ publEventServiceStatus: 'INACTIVE' });

    await expect(
      service.createFromPublEvent(
        {
          partnerKey: 'PUBL',
          providerUserId: 'publ:business_123',
          eventKey: 'PUBL_TICKET_PURCHASED',
          props: {
            targetPhoneNumber: '01012345678',
            targetName: '민우',
            ticket: {
              name: 'VIP'
            }
          }
        },
        'publ-inactive-event'
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        statusCode: 409,
        code: 'PUBL_EVENT_INACTIVE',
        message: '비활성화된 Publ 이벤트라 발송 요청을 접수할 수 없습니다.',
        eventKey: 'PUBL_TICKET_PURCHASED',
        serviceStatus: 'INACTIVE'
      })
    });

    expect(rows).toHaveLength(0);
    expect(queueService.enqueueSendMessage).not.toHaveBeenCalled();
  });

  it('rejects Publ raw event when targetPhoneNumber is missing', async () => {
    const { service } = createFixtureService();

    await expect(
      service.createFromPublEvent(
        {
          partnerKey: 'PUBL',
          providerUserId: 'publ:business_123',
          eventKey: 'PUBL_TICKET_PURCHASED',
          props: {
            targetName: '민우',
            ticket: {
              name: 'VIP'
            }
          }
        },
        'publ-missing-phone'
      )
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('blocks ALIMTALK_ONLY when template is not APR', async () => {
    const { service } = createFixtureService();

    await expect(
      service.create(
        {
          ownerUserId: 'tenant_demo',
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
        ownerUserId: 'tenant_demo',
        eventKey: 'PUBL_USER_SIGNUP',
        recipient: { phone: '01012345678', userId: 'u1' },
        variables: { username: '민우' }
      },
      'same-key'
    );

    const second = await service.create(
      {
        ownerUserId: 'tenant_demo',
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
          ownerUserId: 'tenant_demo',
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
        ownerUserId: 'tenant_demo',
        eventKey: 'PUBL_USER_SIGNUP',
        recipient: { phone: '01012345678', userId: 'u1' },
        variables: { username: '민우' }
      },
      'cross-tenant-check'
    );

    await expect(service.getByIdForUser('tenant_other', created.request.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('accepts manual sms request when approved sender number exists', async () => {
    const { service } = createFixtureService();

    const request = await service.createManualSms('user_1', {
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

    const request = await service.createManualSms('user_1', {
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

    const request = await service.createManualAlimtalk('user_1', {
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

  it('accepts manual brand message request and stores brand metadata', async () => {
    const { service, queueService } = createFixtureService();

    const request = await service.createManualBrandMessage('user_1', {
      senderProfileId: 'profile_1',
      mode: 'FREESTYLE',
      targeting: 'I',
      messageType: 'IMAGE',
      recipientPhone: '01012345678',
      content: '브랜드 메시지 테스트',
      pushAlarm: true,
      adult: false,
      statsEventKey: 'evt_brand_launch',
      resellerCode: '123456789',
      buttons: [
        {
          type: 'WL',
          name: '자세히 보기',
          linkMo: 'https://example.com/mobile'
        }
      ],
      image: {
        imageUrl: 'https://cdn.example.com/brand.png',
        imageLink: 'https://example.com/landing'
      }
    });

    expect(request.eventKey).toBe('MANUAL_BRAND_MESSAGE_SEND');
    expect(request.resolvedChannel).toBe('BRAND_MESSAGE');
    expect(request.manualBody).toBe('브랜드 메시지 테스트');
    expect((request.metadataJson as any)?.brandMessage).toEqual({
      mode: 'FREESTYLE',
      targeting: 'I',
      messageType: 'IMAGE',
      pushAlarm: true,
      adult: false,
      statsId: 'evt_brand_launch',
      statsEventKey: 'evt_brand_launch',
      resellerCode: '123456789',
      buttons: [
        {
          type: 'WL',
          name: '자세히 보기',
          linkMo: 'https://example.com/mobile',
          linkPc: null,
          schemeIos: null,
          schemeAndroid: null
        }
      ],
      image: {
        assetId: null,
        imageUrl: 'https://cdn.example.com/brand.png',
        imageLink: 'https://example.com/landing'
      }
    });
    expect(queueService.enqueueSendMessage).toHaveBeenCalledWith(request.id);
  });

  it('accepts manual brand template request and stores template metadata with variables', async () => {
    const { service, queueService } = createFixtureService();

    const request = await service.createManualBrandMessage('user_1', {
      senderProfileId: 'profile_1',
      mode: 'TEMPLATE',
      targeting: 'I',
      recipientPhone: '01012345678',
      templateCode: 'BRAND_TEMPLATE_001',
      templateName: '브랜드 템플릿',
      templateBody: '#{username}님을 위한 신상품 안내입니다.',
      requiredVariables: ['username'],
      variables: {
        username: '민우'
      }
    });

    expect(request.eventKey).toBe('MANUAL_BRAND_MESSAGE_SEND');
    expect(request.resolvedChannel).toBe('BRAND_MESSAGE');
    expect(request.manualBody).toBe('#{username}님을 위한 신상품 안내입니다.');
    expect(request.variablesJson).toEqual({
      username: '민우'
    });
    expect((request.metadataJson as any)?.brandMessage).toEqual({
      mode: 'TEMPLATE',
      targeting: 'I',
      messageType: null,
      pushAlarm: true,
      adult: false,
      statsId: null,
      statsEventKey: null,
      resellerCode: null,
      templateCode: 'BRAND_TEMPLATE_001',
      templateName: '브랜드 템플릿',
      templateBody: '#{username}님을 위한 신상품 안내입니다.',
      requiredVariables: ['username']
    });
    expect(queueService.enqueueSendMessage).toHaveBeenCalledWith(request.id);
  });

  it('blocks manual brand template request when required variables are missing', async () => {
    const { service } = createFixtureService();

    await expect(
      service.createManualBrandMessage('user_1', {
        senderProfileId: 'profile_1',
        mode: 'TEMPLATE',
        targeting: 'I',
        recipientPhone: '01012345678',
        templateCode: 'BRAND_TEMPLATE_001',
        templateBody: '#{username}님을 위한 신상품 안내입니다.',
        requiredVariables: ['username'],
        variables: {}
      })
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('accepts non-text brand messages without image link', async () => {
    const { service } = createFixtureService();

    const request = await service.createManualBrandMessage('user_1', {
      senderProfileId: 'profile_1',
      mode: 'FREESTYLE',
      targeting: 'I',
      messageType: 'IMAGE',
      recipientPhone: '01012345678',
      content: '브랜드 메시지 테스트',
      image: {
        imageUrl: 'https://cdn.example.com/brand.png'
      }
    });

    expect((request.metadataJson as any)?.brandMessage?.image).toEqual({
      assetId: null,
      imageUrl: 'https://cdn.example.com/brand.png',
      imageLink: null
    });
  });

  it('blocks image links without http or https protocol', async () => {
    const { service } = createFixtureService();

    await expect(
      service.createManualBrandMessage('user_1', {
        senderProfileId: 'profile_1',
        mode: 'FREESTYLE',
        targeting: 'I',
        messageType: 'IMAGE',
        recipientPhone: '01012345678',
        content: '브랜드 메시지 테스트',
        image: {
          imageUrl: 'https://cdn.example.com/brand.png',
          imageLink: 'example.com/landing'
        }
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks image brand messages longer than 400 characters', async () => {
    const { service } = createFixtureService();

    await expect(
      service.createManualBrandMessage('user_1', {
        senderProfileId: 'profile_1',
        mode: 'FREESTYLE',
        targeting: 'I',
        messageType: 'IMAGE',
        recipientPhone: '01012345678',
        content: '가'.repeat(401),
        image: {
          imageUrl: 'https://cdn.example.com/brand.png',
          imageLink: 'https://example.com/landing'
        }
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('stores scheduledAt and enqueues immediate NHN reservation registration for manual SMS', async () => {
    const { service, rows, queueService } = createFixtureService();
    const scheduledAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const request = await service.createManualSms('user_1', {
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
      service.createManualAlimtalk('user_1', {
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
