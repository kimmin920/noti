import { MessageChannel } from '@prisma/client';
import { V2LogsService } from '../src/v2/logs/v2-logs.service';

describe('V2LogsService', () => {
  it('maps brand message rows into shared log list with provider channel and message type', async () => {
    const prisma = {
      adminUser: {
        findUnique: jest.fn(async () => ({ tenantId: 'tenant_demo' }))
      },
      messageRequest: {
        findMany: jest.fn(async () => [
          {
            id: 'req_brand_1',
            eventKey: 'MANUAL_BRAND_MESSAGE_SEND',
            resolvedChannel: MessageChannel.BRAND_MESSAGE,
            metadataJson: {
              brandMessage: {
                messageType: 'IMAGE'
              }
            },
            status: 'SENT_TO_PROVIDER',
            recipientPhone: '01012345678',
            scheduledAt: null,
            lastErrorCode: null,
            lastErrorMessage: null,
            createdAt: new Date('2026-04-06T09:00:00.000Z'),
            updatedAt: new Date('2026-04-06T09:01:00.000Z'),
            deliveryResults: [
              {
                providerStatus: 'DELIVERED',
                providerCode: '0000',
                providerMessage: 'ok',
                createdAt: new Date('2026-04-06T09:01:00.000Z')
              }
            ]
          }
        ]),
        count: jest.fn(async () => 1),
        groupBy: jest.fn(async () => [{ status: 'SENT_TO_PROVIDER', _count: { status: 1 } }])
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
        count: jest.fn(async () => 0),
        findMany: jest.fn(async () => [])
      }
    };

    const providerResultsService = {
      resolveMessageRequests: jest.fn(async () => [
        {
          status: 'DELIVERED',
          lastErrorCode: null,
          lastErrorMessage: null,
          latestDeliveryResult: {
            providerStatus: 'DELIVERED',
            providerCode: '0000',
            providerMessage: 'ok',
            createdAt: '2026-04-06T09:01:00.000Z'
          },
          deliveryResults: []
        }
      ]),
      resolveSmsCampaign: jest.fn(),
      resolveAlimtalkCampaign: jest.fn(),
      resolveBrandMessageCampaign: jest.fn()
    };

    const service = new V2LogsService(prisma as any, {} as any, providerResultsService as any);
    const result = await service.list('user_1');

    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'req_brand_1',
        kind: 'message',
        mode: 'MANUAL',
        channel: 'kakao',
        campaignChannel: null,
        providerChannel: 'BRAND_MESSAGE',
        messageType: 'IMAGE',
        recipientCount: 1,
        latestDeliveryResult: {
          providerStatus: 'DELIVERED',
          providerCode: '0000',
          providerMessage: 'ok',
          createdAt: '2026-04-06T09:01:00.000Z'
        }
      })
    ]);
  });

  it('marks event-driven message rows as automatic in the shared log list', async () => {
    const prisma = {
      adminUser: {
        findUnique: jest.fn(async () => ({ tenantId: 'tenant_demo' }))
      },
      messageRequest: {
        findMany: jest.fn(async () => [
          {
            id: 'req_auto_1',
            eventKey: 'MEMBER_GENERAL_CHANNEL_ACCOUNT_REGISTER',
            resolvedChannel: MessageChannel.ALIMTALK,
            metadataJson: {},
            status: 'SENT_TO_PROVIDER',
            recipientPhone: '01012345678',
            scheduledAt: null,
            lastErrorCode: null,
            lastErrorMessage: null,
            createdAt: new Date('2026-05-05T08:29:00.000Z'),
            updatedAt: new Date('2026-05-05T08:30:00.000Z')
          }
        ]),
        count: jest.fn(async () => 1)
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
        count: jest.fn(async () => 0),
        findMany: jest.fn(async () => [])
      }
    };

    const providerResultsService = {
      resolveMessageRequests: jest.fn(async () => [
        {
          status: 'SENT_TO_PROVIDER',
          lastErrorCode: null,
          lastErrorMessage: null,
          latestDeliveryResult: null,
          deliveryResults: []
        }
      ]),
      resolveSmsCampaign: jest.fn(),
      resolveAlimtalkCampaign: jest.fn(),
      resolveBrandMessageCampaign: jest.fn()
    };

    const service = new V2LogsService(prisma as any, {} as any, providerResultsService as any);
    const result = await service.list('user_1');

    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'req_auto_1',
        kind: 'message',
        mode: 'AUTO',
        eventKey: 'MEMBER_GENERAL_CHANNEL_ACCOUNT_REGISTER',
        channel: 'kakao',
        providerChannel: 'ALIMTALK'
      })
    ]);
  });

  it('renders retry requests directly under their original message row', async () => {
    const prisma = {
      adminUser: {
        findUnique: jest.fn(async () => ({ tenantId: 'tenant_demo' }))
      },
      messageRequest: {
        findMany: jest.fn(async () => [
          {
            id: 'req_standalone',
            eventKey: 'MEMBER_GENERAL_CHANNEL_ACCOUNT_REGISTER',
            resolvedChannel: MessageChannel.ALIMTALK,
            metadataJson: {},
            status: 'SEND_FAILED',
            recipientPhone: '01099998888',
            scheduledAt: null,
            lastErrorCode: '500',
            lastErrorMessage: 'failed',
            createdAt: new Date('2026-05-05T08:35:00.000Z'),
            updatedAt: new Date('2026-05-05T08:35:00.000Z'),
            retryOfRequestId: null,
            retryRequests: []
          },
          {
            id: 'req_thread_original',
            eventKey: 'MEMBER_GENERAL_CHANNEL_ACCOUNT_REGISTER',
            resolvedChannel: MessageChannel.ALIMTALK,
            metadataJson: {},
            status: 'SEND_FAILED',
            recipientPhone: '01011112222',
            scheduledAt: null,
            lastErrorCode: '500',
            lastErrorMessage: 'failed',
            createdAt: new Date('2026-05-05T08:10:00.000Z'),
            updatedAt: new Date('2026-05-05T08:10:00.000Z'),
            retryOfRequestId: null,
            retryRequests: [
              {
                id: 'req_thread_retry_1',
                eventKey: 'MEMBER_GENERAL_CHANNEL_ACCOUNT_REGISTER',
                retryOfRequestId: 'req_thread_original',
                resolvedChannel: MessageChannel.ALIMTALK,
                metadataJson: {},
                status: 'SEND_FAILED',
                recipientPhone: '01011112222',
                recipientUserId: null,
                scheduledAt: null,
                lastErrorCode: '500',
                lastErrorMessage: 'failed',
                createdAt: new Date('2026-05-05T08:30:00.000Z'),
                updatedAt: new Date('2026-05-05T08:30:00.000Z')
              },
              {
                id: 'req_thread_retry_2',
                eventKey: 'MEMBER_GENERAL_CHANNEL_ACCOUNT_REGISTER',
                retryOfRequestId: 'req_thread_original',
                resolvedChannel: MessageChannel.ALIMTALK,
                metadataJson: {},
                status: 'SEND_FAILED',
                recipientPhone: '01011112222',
                recipientUserId: null,
                scheduledAt: null,
                lastErrorCode: '500',
                lastErrorMessage: 'failed',
                createdAt: new Date('2026-05-05T08:40:00.000Z'),
                updatedAt: new Date('2026-05-05T08:40:00.000Z')
              }
            ]
          }
        ]),
        count: jest.fn(async () => 4)
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
        count: jest.fn(async () => 0),
        findMany: jest.fn(async () => [])
      }
    };

    const providerResultsService = {
      resolveMessageRequests: jest.fn(async (requests: Array<{ id: string; status: string }>) =>
        requests.map((request) => ({
          status: request.status,
          lastErrorCode: null,
          lastErrorMessage: null,
          latestDeliveryResult: null,
          deliveryResults: []
        }))
      ),
      resolveSmsCampaign: jest.fn(),
      resolveAlimtalkCampaign: jest.fn(),
      resolveBrandMessageCampaign: jest.fn()
    };

    const service = new V2LogsService(prisma as any, {} as any, providerResultsService as any);
    const result = await service.list('user_1');

    expect(result.items.map((item) => item.id)).toEqual([
      'req_thread_original',
      'req_thread_retry_1',
      'req_thread_retry_2',
      'req_standalone'
    ]);
    expect(result.items[1]).toEqual(
      expect.objectContaining({
        id: 'req_thread_retry_1',
        retry: expect.objectContaining({
          retryOfRequestId: 'req_thread_original'
        })
      })
    );
  });

  it('summarizes the original retry badge as successful when any retry succeeds', async () => {
    const prisma = {
      adminUser: {
        findUnique: jest.fn(async () => ({ tenantId: 'tenant_demo' }))
      },
      messageRequest: {
        findMany: jest.fn(async () => [
          {
            id: 'req_thread_original',
            eventKey: 'SELLER_P_APP_A00001_POST_CREATE',
            resolvedChannel: MessageChannel.ALIMTALK,
            metadataJson: {},
            status: 'SEND_FAILED',
            recipientPhone: '01097690373',
            scheduledAt: null,
            lastErrorCode: '500',
            lastErrorMessage: 'failed',
            createdAt: new Date('2026-05-06T10:20:00.000Z'),
            updatedAt: new Date('2026-05-06T10:20:00.000Z'),
            retryOfRequestId: null,
            retryRequests: [
              {
                id: 'req_retry_failed_1',
                eventKey: 'SELLER_P_APP_A00001_POST_CREATE',
                retryOfRequestId: 'req_thread_original',
                resolvedChannel: MessageChannel.ALIMTALK,
                metadataJson: {},
                status: 'SEND_FAILED',
                recipientPhone: '01097690373',
                recipientUserId: null,
                scheduledAt: null,
                lastErrorCode: '500',
                lastErrorMessage: 'failed',
                createdAt: new Date('2026-05-06T10:30:00.000Z'),
                updatedAt: new Date('2026-05-06T10:30:00.000Z')
              },
              {
                id: 'req_retry_success',
                eventKey: 'SELLER_P_APP_A00001_POST_CREATE',
                retryOfRequestId: 'req_thread_original',
                resolvedChannel: MessageChannel.ALIMTALK,
                metadataJson: {},
                status: 'SENT_TO_PROVIDER',
                nhnMessageId: 'nhn_retry_success',
                recipientPhone: '01097690373',
                recipientUserId: null,
                scheduledAt: null,
                lastErrorCode: null,
                lastErrorMessage: null,
                createdAt: new Date('2026-05-06T10:40:00.000Z'),
                updatedAt: new Date('2026-05-06T10:40:00.000Z')
              },
              {
                id: 'req_retry_failed_2',
                eventKey: 'SELLER_P_APP_A00001_POST_CREATE',
                retryOfRequestId: 'req_thread_original',
                resolvedChannel: MessageChannel.ALIMTALK,
                metadataJson: {},
                status: 'SEND_FAILED',
                recipientPhone: '01097690373',
                recipientUserId: null,
                scheduledAt: null,
                lastErrorCode: '500',
                lastErrorMessage: 'failed',
                createdAt: new Date('2026-05-06T10:50:00.000Z'),
                updatedAt: new Date('2026-05-06T10:50:00.000Z')
              }
            ]
          }
        ]),
        count: jest.fn(async () => 4)
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
        count: jest.fn(async () => 0),
        findMany: jest.fn(async () => [])
      }
    };

    const providerResultsService = {
      resolveMessageRequests: jest.fn(async (requests: Array<{ id: string; status: string }>) =>
        requests.map((request) => ({
          status: request.id === 'req_retry_success' ? 'DELIVERED' : request.status,
          lastErrorCode: null,
          lastErrorMessage: null,
          latestDeliveryResult: null,
          deliveryResults: []
        }))
      ),
      resolveSmsCampaign: jest.fn(),
      resolveAlimtalkCampaign: jest.fn(),
      resolveBrandMessageCampaign: jest.fn()
    };

    const service = new V2LogsService(prisma as any, {} as any, providerResultsService as any);
    const result = await service.list('user_1');

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 'req_thread_original',
        retry: expect.objectContaining({
          latestRequestId: 'req_retry_success',
          latestStatus: 'DELIVERED',
          retryCount: 3
        })
      })
    );
  });

  it('filters message rows by grouped delivery status', async () => {
    const prisma = {
      adminUser: {
        findUnique: jest.fn(async () => ({ tenantId: 'tenant_demo' }))
      },
      messageRequest: {
        findMany: jest.fn(async () => [
          {
            id: 'req_done_1',
            eventKey: 'MANUAL_ALIMTALK_SEND',
            resolvedChannel: MessageChannel.ALIMTALK,
            metadataJson: {},
            status: 'SENT_TO_PROVIDER',
            recipientPhone: '01011112222',
            scheduledAt: null,
            lastErrorCode: null,
            lastErrorMessage: null,
            createdAt: new Date('2026-05-05T08:20:00.000Z'),
            updatedAt: new Date('2026-05-05T08:21:00.000Z')
          },
          {
            id: 'req_failed_1',
            eventKey: 'MEMBER_GENERAL_CHANNEL_ACCOUNT_REGISTER',
            resolvedChannel: MessageChannel.ALIMTALK,
            metadataJson: {},
            status: 'SEND_FAILED',
            recipientPhone: '01033334444',
            scheduledAt: null,
            lastErrorCode: '500',
            lastErrorMessage: 'failed',
            createdAt: new Date('2026-05-05T08:30:00.000Z'),
            updatedAt: new Date('2026-05-05T08:31:00.000Z')
          }
        ]),
        count: jest.fn(async () => 2)
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
        count: jest.fn(async () => 0),
        findMany: jest.fn(async () => [])
      }
    };

    const providerResultsService = {
      resolveMessageRequests: jest.fn(async () => [
        {
          status: 'DELIVERED',
          lastErrorCode: null,
          lastErrorMessage: null,
          latestDeliveryResult: null,
          deliveryResults: []
        },
        {
          status: 'SEND_FAILED',
          lastErrorCode: '500',
          lastErrorMessage: 'failed',
          latestDeliveryResult: null,
          deliveryResults: []
        }
      ]),
      resolveSmsCampaign: jest.fn(),
      resolveAlimtalkCampaign: jest.fn(),
      resolveBrandMessageCampaign: jest.fn()
    };

    const service = new V2LogsService(prisma as any, {} as any, providerResultsService as any);
    const result = await service.list('user_1', { statusGroup: 'failed' });

    expect(result.filters.statusGroup).toBe('failed');
    expect(result.summary.totalCount).toBe(1);
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'req_failed_1',
        status: 'SEND_FAILED'
      })
    ]);
  });

  it('omits failed originals that already have a successful retry from the failed queue', async () => {
    const prisma = {
      adminUser: {
        findUnique: jest.fn(async () => ({ tenantId: 'tenant_demo' }))
      },
      messageRequest: {
        findMany: jest.fn(async () => [
          {
            id: 'req_failed_retried',
            eventKey: 'MEMBER_GENERAL_CHANNEL_ACCOUNT_REGISTER',
            resolvedChannel: MessageChannel.ALIMTALK,
            metadataJson: {},
            status: 'SEND_FAILED',
            recipientPhone: '01011112222',
            scheduledAt: null,
            lastErrorCode: '500',
            lastErrorMessage: 'failed',
            createdAt: new Date('2026-05-05T08:20:00.000Z'),
            updatedAt: new Date('2026-05-05T08:21:00.000Z'),
            retryOfRequestId: null,
            retryRequests: [
              {
                id: 'req_retry_success',
                status: 'SENT_TO_PROVIDER',
                nhnMessageId: 'nhn_retry_success',
                resolvedChannel: MessageChannel.ALIMTALK,
                metadataJson: {},
                scheduledAt: null,
                lastErrorCode: null,
                lastErrorMessage: null,
                createdAt: new Date('2026-05-05T08:25:00.000Z'),
                updatedAt: new Date('2026-05-05T08:26:00.000Z')
              }
            ]
          },
          {
            id: 'req_failed_open',
            eventKey: 'MEMBER_GENERAL_CHANNEL_ACCOUNT_REGISTER',
            resolvedChannel: MessageChannel.ALIMTALK,
            metadataJson: {},
            status: 'SEND_FAILED',
            recipientPhone: '01033334444',
            scheduledAt: null,
            lastErrorCode: '500',
            lastErrorMessage: 'failed',
            createdAt: new Date('2026-05-05T08:30:00.000Z'),
            updatedAt: new Date('2026-05-05T08:31:00.000Z'),
            retryOfRequestId: null,
            retryRequests: []
          }
        ]),
        count: jest.fn(async () => 2)
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
        count: jest.fn(async () => 0),
        findMany: jest.fn(async () => [])
      }
    };

    const providerResultsService = {
      resolveMessageRequests: jest.fn(async (requests: Array<{ id: string }>) => {
        if (requests[0]?.id === 'req_retry_success') {
          return [
            {
              status: 'DELIVERED',
              lastErrorCode: null,
              lastErrorMessage: null,
              latestDeliveryResult: null,
              deliveryResults: []
            }
          ];
        }

        return [
          {
            status: 'SEND_FAILED',
            lastErrorCode: '500',
            lastErrorMessage: 'failed',
            latestDeliveryResult: null,
            deliveryResults: []
          },
          {
            status: 'SEND_FAILED',
            lastErrorCode: '500',
            lastErrorMessage: 'failed',
            latestDeliveryResult: null,
            deliveryResults: []
          }
        ];
      }),
      resolveSmsCampaign: jest.fn(),
      resolveAlimtalkCampaign: jest.fn(),
      resolveBrandMessageCampaign: jest.fn()
    };

    const service = new V2LogsService(prisma as any, {} as any, providerResultsService as any);
    const result = await service.list('user_1', { statusGroup: 'failed' });

    expect(result.summary.totalCount).toBe(1);
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'req_failed_open',
        retry: expect.objectContaining({
          latestRequestId: null
        })
      })
    ]);
  });

  it('returns brand message detail with resolved sender profile metadata', async () => {
    const prisma = {
      adminUser: {
        findUnique: jest.fn(async () => ({ tenantId: 'tenant_demo' }))
      },
      senderNumber: {
        findFirst: jest.fn(async () => null)
      },
      senderProfile: {
        findFirst: jest.fn(async () => ({
          id: 'profile_1',
          plusFriendId: '@비주오',
          senderKey: 'SENDER_KEY_1'
        }))
      },
      template: {
        findFirst: jest.fn(async () => null)
      },
      providerTemplate: {
        findFirst: jest.fn(async () => null)
      }
    };

    const messageRequestsService = {
      getByIdForUser: jest.fn(async () => ({
        id: 'req_brand_1',
        eventKey: 'MANUAL_BRAND_MESSAGE_SEND',
        resolvedChannel: MessageChannel.BRAND_MESSAGE,
        recipientPhone: '01012345678',
        recipientUserId: null,
        variablesJson: {},
        metadataJson: {
          brandMessage: {
            mode: 'FREESTYLE',
            targeting: 'I',
            messageType: 'TEXT',
            pushAlarm: true,
            adult: false,
            buttons: []
          }
        },
        manualBody: '브랜드 메시지 테스트',
        scheduledAt: null,
        status: 'ACCEPTED',
        resolvedSenderNumberId: null,
        resolvedSenderProfileId: 'profile_1',
        resolvedTemplateId: null,
        resolvedProviderTemplateId: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        createdAt: new Date('2026-04-06T09:00:00.000Z'),
        updatedAt: new Date('2026-04-06T09:01:00.000Z'),
        attempts: [
          {
            id: 'attempt_1',
            attemptNumber: 1,
            errorCode: null,
            errorMessage: null,
            createdAt: new Date('2026-04-06T09:00:30.000Z')
          }
        ],
        deliveryResults: [
          {
            id: 'delivery_1',
            providerStatus: 'ACCEPTED',
            providerCode: null,
            providerMessage: 'queued',
            createdAt: new Date('2026-04-06T09:01:00.000Z')
          }
        ]
      }))
    };

    const providerResultsService = {
      resolveMessageRequest: jest.fn(async () => ({
        status: 'SENT_TO_PROVIDER',
        lastErrorCode: null,
        lastErrorMessage: null,
        latestDeliveryResult: {
          providerStatus: 'ACCEPTED',
          providerCode: null,
          providerMessage: 'queued',
          createdAt: '2026-04-06T09:01:00.000Z'
        },
        deliveryResults: [
          {
            providerStatus: 'ACCEPTED',
            providerCode: null,
            providerMessage: 'queued',
            createdAt: '2026-04-06T09:01:00.000Z'
          }
        ]
      }))
    };

    const service = new V2LogsService(prisma as any, messageRequestsService as any, providerResultsService as any);
    const result = await service.getDetail('user_1', 'req_brand_1');

    expect(result.providerChannel).toBe('BRAND_MESSAGE');
    expect(result.messageType).toBe('TEXT');
    expect(result.brandMessage).toEqual(
      expect.objectContaining({
        mode: 'FREESTYLE',
        targeting: 'I',
        messageType: 'TEXT'
      })
    );
    expect(result.resolvedSenderProfile).toEqual({
      id: 'profile_1',
      plusFriendId: '@비주오',
      senderKey: 'SENDER_KEY_1'
    });
  });

  it('includes bulk campaign rows in the shared log list', async () => {
    const prisma = {
      adminUser: {
        findUnique: jest.fn(async () => ({ tenantId: 'tenant_demo' }))
      },
      messageRequest: {
        findMany: jest.fn(async () => []),
        count: jest.fn(async () => 0)
      },
      bulkSmsCampaign: {
        count: jest.fn(async () => 1),
        findMany: jest.fn(async () => [
          {
            id: 'bulk_sms_1',
            title: '대량 테스트',
            status: 'PROCESSING',
            scheduledAt: null,
            nhnRequestId: 'nhn-bulk-1',
            totalRecipientCount: 3,
            skippedNoPhoneCount: 0,
            duplicatePhoneCount: 0,
            providerResponse: null,
            createdAt: new Date('2026-04-07T03:00:00.000Z'),
            updatedAt: new Date('2026-04-07T03:01:00.000Z'),
            recipients: [
              {
                id: 'bulk_recipient_1',
                recipientPhone: '01011112222',
                recipientSeq: '1',
                status: 'REQUESTED'
              }
            ]
          }
        ])
      },
      bulkAlimtalkCampaign: {
        count: jest.fn(async () => 0),
        findMany: jest.fn(async () => [])
      },
      bulkBrandMessageCampaign: {
        count: jest.fn(async () => 0),
        findMany: jest.fn(async () => [])
      }
    };

    const providerResultsService = {
      resolveMessageRequests: jest.fn(async () => []),
      resolveSmsCampaign: jest.fn(async () => ({
        status: 'SENT_TO_PROVIDER',
        recipientStats: {
          totalCount: 3,
          submittedCount: 3,
          deliveredCount: 0,
          failedCount: 0,
          pendingCount: 0,
          skippedNoPhoneCount: 0,
          duplicatePhoneCount: 0
        },
        recipients: new Map([
          [
            'bulk_recipient_1',
            {
              status: 'SENT_TO_PROVIDER',
              providerResultCode: null,
              providerResultMessage: null,
              providerStatus: 'ACCEPTED',
              resolvedAt: '2026-04-07T03:01:00.000Z'
            }
          ]
        ])
      })),
      resolveAlimtalkCampaign: jest.fn(),
      resolveBrandMessageCampaign: jest.fn()
    };

    const service = new V2LogsService(prisma as any, {} as any, providerResultsService as any);
    const result = await service.list('user_1');

    expect(result.summary.totalCount).toBe(1);
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'bulk_sms_1',
        kind: 'campaign',
        mode: 'BULK',
        eventKey: 'BULK_SMS_SEND',
        channel: 'sms',
        campaignChannel: 'sms',
        providerChannel: 'SMS',
        title: '대량 테스트',
        recipientPhone: null,
        recipientCount: 3,
        status: 'SENT_TO_PROVIDER'
      })
    ]);
  });
});
