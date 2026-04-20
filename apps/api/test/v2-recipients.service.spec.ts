import { V2RecipientsService } from '../src/v2/recipients/v2-recipients.service';

describe('V2RecipientsService', () => {
  it('maps managed users into recipient summary and items', async () => {
    const usersService = {
      list: jest.fn(async () => ({
        fields: [],
        users: [
          {
            id: 'user_1',
            source: 'manual',
            externalId: null,
            name: '김민우',
            email: 'minu@example.com',
            phone: '01012345678',
            status: 'ACTIVE',
            userType: null,
            segment: 'VIP',
            gradeOrLevel: 'Gold',
            marketingConsent: true,
            tags: ['vip'],
            registeredAt: null,
            lastLoginAt: null,
            createdAt: new Date('2026-04-06T10:00:00.000Z'),
            updatedAt: new Date('2026-04-06T11:00:00.000Z'),
            customAttributes: {}
          },
          {
            id: 'user_2',
            source: 'manual',
            externalId: null,
            name: '박서연',
            email: null,
            phone: null,
            status: 'INACTIVE',
            userType: null,
            segment: null,
            gradeOrLevel: null,
            marketingConsent: false,
            tags: [],
            registeredAt: null,
            lastLoginAt: null,
            createdAt: new Date('2026-04-06T10:10:00.000Z'),
            updatedAt: new Date('2026-04-06T11:10:00.000Z'),
            customAttributes: {}
          }
        ],
        summary: {
          totalUsers: 2,
          activeUsers: 1,
          inactiveUsers: 1,
          dormantUsers: 0,
          blockedUsers: 0,
          sourceCount: 1,
          customFieldCount: 0
        },
        sourceBreakdown: [{ source: 'manual', count: 2 }]
      }))
    };

    const service = new V2RecipientsService(usersService as never);
    const result = await service.listRecipients('admin_1');

    expect(result.summary.totalCount).toBe(2);
    expect(result.summary.phoneCount).toBe(1);
    expect(result.summary.marketingConsentCount).toBe(1);
    expect(result.items[0].name).toBe('김민우');
    expect(result.sourceBreakdown).toEqual([{ source: 'manual', count: 2 }]);
  });

  it('passes manual recipient creation through to UsersService', async () => {
    const usersService = {
      createManualUser: jest.fn(async () => ({
        mode: 'created',
        user: {
          id: 'user_1',
          source: 'manual',
          externalId: null,
          name: '김민우',
          email: null,
          phone: '01012345678',
          status: 'ACTIVE',
          userType: null,
          segment: null,
          gradeOrLevel: null,
          marketingConsent: null,
          tags: [],
          registeredAt: null,
          lastLoginAt: null,
          createdAt: new Date('2026-04-06T10:00:00.000Z'),
          updatedAt: new Date('2026-04-06T10:00:00.000Z'),
          customAttributes: {}
        }
      }))
    };

    const service = new V2RecipientsService(usersService as never);
    const result = await service.createRecipient('admin_1', {
      source: 'manual',
      name: '김민우',
      phone: '01012345678'
    });

    expect(usersService.createManualUser).toHaveBeenCalledWith('admin_1', {
      source: 'manual',
      name: '김민우',
      phone: '01012345678'
    });
    expect(result.mode).toBe('created');
    expect(result.user.phone).toBe('01012345678');
  });
});
