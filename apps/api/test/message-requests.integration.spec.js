"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const message_requests_service_1 = require("../src/message-requests/message-requests.service");
function createFixtureService() {
    const rows = [];
    let seq = 1;
    const rules = {
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
            findUnique: jest.fn(async ({ where }) => {
                if (where.tenantId_idempotencyKey) {
                    return (rows.find((r) => r.tenantId === where.tenantId_idempotencyKey.tenantId &&
                        r.idempotencyKey === where.tenantId_idempotencyKey.idempotencyKey) ?? null);
                }
                return rows.find((r) => r.id === where.id) ?? null;
            }),
            create: jest.fn(async ({ data }) => {
                const created = {
                    id: `req_${seq++}`,
                    ...data
                };
                rows.push(created);
                return created;
            })
        },
        eventRule: {
            findUnique: jest.fn(async ({ where }) => {
                const key = `${where.tenantId_eventKey.tenantId}:${where.tenantId_eventKey.eventKey}`;
                return rules[key] ?? null;
            })
        }
    };
    const queueService = {
        enqueueSendMessage: jest.fn(async () => undefined)
    };
    const service = new message_requests_service_1.MessageRequestsService(prisma, queueService);
    return { service, rows, queueService };
}
describe('MessageRequestsService integration scenarios', () => {
    it('handles sample event PUBL_USER_SIGNUP', async () => {
        const { service } = createFixtureService();
        const result = await service.create({
            tenantId: 'tenant_demo',
            eventKey: 'PUBL_USER_SIGNUP',
            recipient: { phone: '01012345678', userId: 'u1' },
            variables: { username: '민우' },
            metadata: { publEventId: 'evt1' }
        }, 'evt1');
        expect(result.request.status).toBe('ACCEPTED');
        expect(result.request.resolvedChannel).toBe('SMS');
    });
    it('handles sample event PUBL_TICKET_PURCHASED', async () => {
        const { service } = createFixtureService();
        const result = await service.create({
            tenantId: 'tenant_demo',
            eventKey: 'PUBL_TICKET_PURCHASED',
            recipient: { phone: '01012345678', userId: 'u1' },
            variables: { username: '민우', ticketName: 'VIP' },
            metadata: { publEventId: 'evt2' }
        }, 'evt2');
        expect(result.request.status).toBe('ACCEPTED');
        expect(result.request.resolvedChannel).toBe('ALIMTALK');
    });
    it('blocks ALIMTALK_ONLY when template is not APR', async () => {
        const { service } = createFixtureService();
        await expect(service.create({
            tenantId: 'tenant_demo',
            eventKey: 'PUBL_PAYMENT_COMPLETED',
            recipient: { phone: '01012345678', userId: 'u1' },
            variables: { username: '민우', amount: '39000' },
            metadata: { publEventId: 'evt3' }
        }, 'evt3')).rejects.toBeInstanceOf(common_1.ConflictException);
    });
    it('returns same requestId for duplicate idempotency key', async () => {
        const { service } = createFixtureService();
        const first = await service.create({
            tenantId: 'tenant_demo',
            eventKey: 'PUBL_USER_SIGNUP',
            recipient: { phone: '01012345678', userId: 'u1' },
            variables: { username: '민우' }
        }, 'same-key');
        const second = await service.create({
            tenantId: 'tenant_demo',
            eventKey: 'PUBL_USER_SIGNUP',
            recipient: { phone: '01012345678', userId: 'u1' },
            variables: { username: '민우' }
        }, 'same-key');
        expect(second.request.id).toBe(first.request.id);
        expect(second.idempotent).toBe(true);
    });
    it('returns 422-equivalent error when required variables are missing', async () => {
        const { service, rows } = createFixtureService();
        await expect(service.create({
            tenantId: 'tenant_demo',
            eventKey: 'PUBL_TICKET_PURCHASED',
            recipient: { phone: '01012345678', userId: 'u1' },
            variables: { username: '민우' }
        }, 'missing-vars')).rejects.toBeInstanceOf(common_1.UnprocessableEntityException);
        expect(rows).toHaveLength(0);
    });
});
//# sourceMappingURL=message-requests.integration.spec.js.map