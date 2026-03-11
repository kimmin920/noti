"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const shared_1 = require("@publ/shared");
const prisma = new client_1.PrismaClient();
async function main() {
    const tenant = await prisma.tenant.upsert({
        where: { id: 'tenant_demo' },
        update: { name: 'Demo Tenant' },
        create: {
            id: 'tenant_demo',
            name: 'Demo Tenant'
        }
    });
    const admin = await prisma.adminUser.upsert({
        where: { tenantId_publUserId: { tenantId: tenant.id, publUserId: 'publ_admin_1' } },
        update: {},
        create: {
            tenantId: tenant.id,
            publUserId: 'publ_admin_1',
            role: client_1.UserRole.TENANT_ADMIN
        }
    });
    const senderNumber = await prisma.senderNumber.upsert({
        where: { tenantId_phoneNumber: { tenantId: tenant.id, phoneNumber: '0212345678' } },
        update: { status: client_1.SenderNumberStatus.APPROVED },
        create: {
            tenantId: tenant.id,
            phoneNumber: '0212345678',
            type: client_1.SenderNumberType.COMPANY,
            status: client_1.SenderNumberStatus.APPROVED,
            approvedAt: new Date()
        }
    });
    const senderProfile = await prisma.senderProfile.upsert({
        where: { tenantId_senderKey: { tenantId: tenant.id, senderKey: 'ALIM_SENDER_KEY_1' } },
        update: { status: client_1.SenderProfileStatus.ACTIVE },
        create: {
            tenantId: tenant.id,
            plusFriendId: '@publ',
            senderKey: 'ALIM_SENDER_KEY_1',
            senderProfileType: 'NORMAL',
            status: client_1.SenderProfileStatus.ACTIVE
        }
    });
    const smsSignupBody = '{{username}}님, Publ 가입을 환영합니다.';
    const smsTicketBody = '{{username}}님, {{ticketName}} 티켓 구매가 완료되었습니다.';
    const smsPaymentBody = '{{username}}님, {{amount}}원 결제가 완료되었습니다.';
    const smsSignupTemplate = await prisma.template.upsert({
        where: { id: 'tpl_sms_signup' },
        update: {
            body: smsSignupBody,
            requiredVariables: (0, shared_1.extractRequiredVariables)(smsSignupBody),
            status: client_1.TemplateStatus.PUBLISHED
        },
        create: {
            id: 'tpl_sms_signup',
            tenantId: tenant.id,
            channel: client_1.MessageChannel.SMS,
            name: 'Signup SMS',
            body: smsSignupBody,
            syntax: 'MUSTACHE_LIKE',
            requiredVariables: (0, shared_1.extractRequiredVariables)(smsSignupBody),
            status: client_1.TemplateStatus.PUBLISHED
        }
    });
    const smsTicketTemplate = await prisma.template.upsert({
        where: { id: 'tpl_sms_ticket' },
        update: {
            body: smsTicketBody,
            requiredVariables: (0, shared_1.extractRequiredVariables)(smsTicketBody),
            status: client_1.TemplateStatus.PUBLISHED
        },
        create: {
            id: 'tpl_sms_ticket',
            tenantId: tenant.id,
            channel: client_1.MessageChannel.SMS,
            name: 'Ticket Purchased SMS',
            body: smsTicketBody,
            syntax: 'MUSTACHE_LIKE',
            requiredVariables: (0, shared_1.extractRequiredVariables)(smsTicketBody),
            status: client_1.TemplateStatus.PUBLISHED
        }
    });
    const alimtalkBody = '[Publ]\n{{username}}님, {{ticketName}} 티켓 구매가 완료되었습니다.';
    const alimtalkTemplate = await prisma.template.upsert({
        where: { id: 'tpl_alim_ticket' },
        update: {
            body: alimtalkBody,
            requiredVariables: (0, shared_1.extractRequiredVariables)(alimtalkBody),
            status: client_1.TemplateStatus.PUBLISHED
        },
        create: {
            id: 'tpl_alim_ticket',
            tenantId: tenant.id,
            channel: client_1.MessageChannel.ALIMTALK,
            name: 'Ticket Purchased Alimtalk',
            body: alimtalkBody,
            syntax: 'KAKAO_HASH',
            requiredVariables: (0, shared_1.extractRequiredVariables)(alimtalkBody),
            status: client_1.TemplateStatus.PUBLISHED
        }
    });
    const paymentAlimtalkBody = '[Publ]\n{{username}}님, {{amount}}원 결제가 완료되었습니다.';
    const paymentAlimtalkTemplate = await prisma.template.upsert({
        where: { id: 'tpl_alim_payment' },
        update: {
            body: paymentAlimtalkBody,
            requiredVariables: (0, shared_1.extractRequiredVariables)(paymentAlimtalkBody),
            status: client_1.TemplateStatus.PUBLISHED
        },
        create: {
            id: 'tpl_alim_payment',
            tenantId: tenant.id,
            channel: client_1.MessageChannel.ALIMTALK,
            name: 'Payment Completed Alimtalk',
            body: paymentAlimtalkBody,
            syntax: 'KAKAO_HASH',
            requiredVariables: (0, shared_1.extractRequiredVariables)(paymentAlimtalkBody),
            status: client_1.TemplateStatus.PUBLISHED
        }
    });
    const aprProviderTemplate = await prisma.providerTemplate.upsert({
        where: { id: 'pt_alim_ticket_apr' },
        update: {
            providerStatus: client_1.ProviderTemplateStatus.APR,
            templateId: alimtalkTemplate.id
        },
        create: {
            id: 'pt_alim_ticket_apr',
            tenantId: tenant.id,
            channel: client_1.MessageChannel.ALIMTALK,
            templateId: alimtalkTemplate.id,
            nhnTemplateId: 'nhn_tpl_ticket',
            providerStatus: client_1.ProviderTemplateStatus.APR,
            lastSyncedAt: new Date()
        }
    });
    const reqProviderTemplate = await prisma.providerTemplate.upsert({
        where: { id: 'pt_alim_payment_req' },
        update: {
            providerStatus: client_1.ProviderTemplateStatus.REQ,
            templateId: paymentAlimtalkTemplate.id
        },
        create: {
            id: 'pt_alim_payment_req',
            tenantId: tenant.id,
            channel: client_1.MessageChannel.ALIMTALK,
            templateId: paymentAlimtalkTemplate.id,
            nhnTemplateId: 'nhn_tpl_payment',
            providerStatus: client_1.ProviderTemplateStatus.REQ,
            lastSyncedAt: new Date()
        }
    });
    await prisma.eventRule.upsert({
        where: { tenantId_eventKey: { tenantId: tenant.id, eventKey: 'PUBL_USER_SIGNUP' } },
        update: {
            displayName: '회원 가입',
            enabled: true,
            channelStrategy: client_1.ChannelStrategy.SMS_ONLY,
            messagePurpose: client_1.MessagePurpose.NORMAL,
            requiredVariables: ['username'],
            smsTemplateId: smsSignupTemplate.id,
            smsSenderNumberId: senderNumber.id,
            updatedBy: admin.id
        },
        create: {
            tenantId: tenant.id,
            eventKey: 'PUBL_USER_SIGNUP',
            displayName: '회원 가입',
            enabled: true,
            channelStrategy: client_1.ChannelStrategy.SMS_ONLY,
            messagePurpose: client_1.MessagePurpose.NORMAL,
            requiredVariables: ['username'],
            smsTemplateId: smsSignupTemplate.id,
            smsSenderNumberId: senderNumber.id,
            updatedBy: admin.id
        }
    });
    await prisma.eventRule.upsert({
        where: { tenantId_eventKey: { tenantId: tenant.id, eventKey: 'PUBL_TICKET_PURCHASED' } },
        update: {
            displayName: '티켓 구매',
            enabled: true,
            channelStrategy: client_1.ChannelStrategy.ALIMTALK_THEN_SMS,
            messagePurpose: client_1.MessagePurpose.NORMAL,
            requiredVariables: ['username', 'ticketName'],
            smsTemplateId: smsTicketTemplate.id,
            smsSenderNumberId: senderNumber.id,
            alimtalkTemplateId: aprProviderTemplate.id,
            alimtalkSenderProfileId: senderProfile.id,
            updatedBy: admin.id
        },
        create: {
            tenantId: tenant.id,
            eventKey: 'PUBL_TICKET_PURCHASED',
            displayName: '티켓 구매',
            enabled: true,
            channelStrategy: client_1.ChannelStrategy.ALIMTALK_THEN_SMS,
            messagePurpose: client_1.MessagePurpose.NORMAL,
            requiredVariables: ['username', 'ticketName'],
            smsTemplateId: smsTicketTemplate.id,
            smsSenderNumberId: senderNumber.id,
            alimtalkTemplateId: aprProviderTemplate.id,
            alimtalkSenderProfileId: senderProfile.id,
            updatedBy: admin.id
        }
    });
    await prisma.eventRule.upsert({
        where: { tenantId_eventKey: { tenantId: tenant.id, eventKey: 'PUBL_PAYMENT_COMPLETED' } },
        update: {
            displayName: '결제 완료',
            enabled: true,
            channelStrategy: client_1.ChannelStrategy.ALIMTALK_ONLY,
            messagePurpose: client_1.MessagePurpose.NORMAL,
            requiredVariables: ['username', 'amount'],
            alimtalkTemplateId: reqProviderTemplate.id,
            alimtalkSenderProfileId: senderProfile.id,
            updatedBy: admin.id
        },
        create: {
            tenantId: tenant.id,
            eventKey: 'PUBL_PAYMENT_COMPLETED',
            displayName: '결제 완료',
            enabled: true,
            channelStrategy: client_1.ChannelStrategy.ALIMTALK_ONLY,
            messagePurpose: client_1.MessagePurpose.NORMAL,
            requiredVariables: ['username', 'amount'],
            alimtalkTemplateId: reqProviderTemplate.id,
            alimtalkSenderProfileId: senderProfile.id,
            updatedBy: admin.id
        }
    });
    console.log('Seed complete for tenant:', tenant.id);
}
main()
    .catch((error) => {
    console.error(error);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map