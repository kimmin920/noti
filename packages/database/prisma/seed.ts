import { PrismaClient, MessageChannel, ProviderTemplateStatus, SenderNumberStatus, SenderNumberType, SenderProfileStatus, TemplateStatus, ChannelStrategy, MessagePurpose, UserRole } from '@prisma/client';
import { randomBytes, scryptSync } from 'crypto';
import { extractRequiredVariables } from '@publ/shared';

const prisma = new PrismaClient();
const TEST_PASSWORD = 'vizuo.work123';

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

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
      email: null,
      role: UserRole.TENANT_ADMIN
    }
  });

  const senderNumber = await prisma.senderNumber.upsert({
    where: { tenantId_phoneNumber: { tenantId: tenant.id, phoneNumber: '0212345678' } },
    update: { status: SenderNumberStatus.APPROVED },
    create: {
      tenantId: tenant.id,
      phoneNumber: '0212345678',
      type: SenderNumberType.COMPANY,
      status: SenderNumberStatus.APPROVED,
      approvedAt: new Date()
    }
  });

  const senderProfile = await prisma.senderProfile.upsert({
    where: { tenantId_senderKey: { tenantId: tenant.id, senderKey: 'ALIM_SENDER_KEY_1' } },
    update: { status: SenderProfileStatus.ACTIVE },
    create: {
      tenantId: tenant.id,
      plusFriendId: '@publ',
      senderKey: 'ALIM_SENDER_KEY_1',
      senderProfileType: 'NORMAL',
      status: SenderProfileStatus.ACTIVE
    }
  });

  const smsSignupBody = '{{username}}님, Publ 가입을 환영합니다.';
  const smsTicketBody = '{{username}}님, {{ticketName}} 티켓 구매가 완료되었습니다.';
  const smsPaymentBody = '{{username}}님, {{amount}}원 결제가 완료되었습니다.';

  const smsSignupTemplate = await prisma.template.upsert({
    where: { id: 'tpl_sms_signup' },
    update: {
      body: smsSignupBody,
      requiredVariables: extractRequiredVariables(smsSignupBody),
      status: TemplateStatus.PUBLISHED
    },
    create: {
      id: 'tpl_sms_signup',
      tenantId: tenant.id,
      channel: MessageChannel.SMS,
      name: 'Signup SMS',
      body: smsSignupBody,
      syntax: 'MUSTACHE_LIKE',
      requiredVariables: extractRequiredVariables(smsSignupBody),
      status: TemplateStatus.PUBLISHED
    }
  });

  const smsTicketTemplate = await prisma.template.upsert({
    where: { id: 'tpl_sms_ticket' },
    update: {
      body: smsTicketBody,
      requiredVariables: extractRequiredVariables(smsTicketBody),
      status: TemplateStatus.PUBLISHED
    },
    create: {
      id: 'tpl_sms_ticket',
      tenantId: tenant.id,
      channel: MessageChannel.SMS,
      name: 'Ticket Purchased SMS',
      body: smsTicketBody,
      syntax: 'MUSTACHE_LIKE',
      requiredVariables: extractRequiredVariables(smsTicketBody),
      status: TemplateStatus.PUBLISHED
    }
  });

  const alimtalkBody = '[Publ]\n{{username}}님, {{ticketName}} 티켓 구매가 완료되었습니다.';

  const alimtalkTemplate = await prisma.template.upsert({
    where: { id: 'tpl_alim_ticket' },
    update: {
      body: alimtalkBody,
      requiredVariables: extractRequiredVariables(alimtalkBody),
      status: TemplateStatus.PUBLISHED
    },
    create: {
      id: 'tpl_alim_ticket',
      tenantId: tenant.id,
      channel: MessageChannel.ALIMTALK,
      name: 'Ticket Purchased Alimtalk',
      body: alimtalkBody,
      syntax: 'KAKAO_HASH',
      requiredVariables: extractRequiredVariables(alimtalkBody),
      status: TemplateStatus.PUBLISHED
    }
  });

  const paymentAlimtalkBody = '[Publ]\n{{username}}님, {{amount}}원 결제가 완료되었습니다.';

  const paymentAlimtalkTemplate = await prisma.template.upsert({
    where: { id: 'tpl_alim_payment' },
    update: {
      body: paymentAlimtalkBody,
      requiredVariables: extractRequiredVariables(paymentAlimtalkBody),
      status: TemplateStatus.PUBLISHED
    },
    create: {
      id: 'tpl_alim_payment',
      tenantId: tenant.id,
      channel: MessageChannel.ALIMTALK,
      name: 'Payment Completed Alimtalk',
      body: paymentAlimtalkBody,
      syntax: 'KAKAO_HASH',
      requiredVariables: extractRequiredVariables(paymentAlimtalkBody),
      status: TemplateStatus.PUBLISHED
    }
  });

  const aprProviderTemplate = await prisma.providerTemplate.upsert({
    where: { id: 'pt_alim_ticket_apr' },
    update: {
      providerStatus: ProviderTemplateStatus.APR,
      templateId: alimtalkTemplate.id
    },
    create: {
      id: 'pt_alim_ticket_apr',
      tenantId: tenant.id,
      channel: MessageChannel.ALIMTALK,
      templateId: alimtalkTemplate.id,
      nhnTemplateId: 'nhn_tpl_ticket',
      providerStatus: ProviderTemplateStatus.APR,
      lastSyncedAt: new Date()
    }
  });

  const reqProviderTemplate = await prisma.providerTemplate.upsert({
    where: { id: 'pt_alim_payment_req' },
    update: {
      providerStatus: ProviderTemplateStatus.REQ,
      templateId: paymentAlimtalkTemplate.id
    },
    create: {
      id: 'pt_alim_payment_req',
      tenantId: tenant.id,
      channel: MessageChannel.ALIMTALK,
      templateId: paymentAlimtalkTemplate.id,
      nhnTemplateId: 'nhn_tpl_payment',
      providerStatus: ProviderTemplateStatus.REQ,
      lastSyncedAt: new Date()
    }
  });

  await prisma.eventRule.upsert({
    where: { tenantId_eventKey: { tenantId: tenant.id, eventKey: 'PUBL_USER_SIGNUP' } },
    update: {
      displayName: '회원 가입',
      enabled: true,
      channelStrategy: ChannelStrategy.SMS_ONLY,
      messagePurpose: MessagePurpose.NORMAL,
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
      channelStrategy: ChannelStrategy.SMS_ONLY,
      messagePurpose: MessagePurpose.NORMAL,
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
      channelStrategy: ChannelStrategy.ALIMTALK_THEN_SMS,
      messagePurpose: MessagePurpose.NORMAL,
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
      channelStrategy: ChannelStrategy.ALIMTALK_THEN_SMS,
      messagePurpose: MessagePurpose.NORMAL,
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
      channelStrategy: ChannelStrategy.ALIMTALK_ONLY,
      messagePurpose: MessagePurpose.NORMAL,
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
      channelStrategy: ChannelStrategy.ALIMTALK_ONLY,
      messagePurpose: MessagePurpose.NORMAL,
      requiredVariables: ['username', 'amount'],
      alimtalkTemplateId: reqProviderTemplate.id,
      alimtalkSenderProfileId: senderProfile.id,
      updatedBy: admin.id
    }
  });

  const testAccounts = [
    { tenantId: 'tenant_test1', tenantName: 'Vizuo Test Tenant 1', loginId: 'test1@vizuo.work' },
    { tenantId: 'tenant_test2', tenantName: 'Vizuo Test Tenant 2', loginId: 'test2@vizuo.work' },
    { tenantId: 'tenant_test3', tenantName: 'Vizuo Test Tenant 3', loginId: 'test3@vizuo.work' }
  ];

  for (const account of testAccounts) {
    const tenantRecord = await prisma.tenant.upsert({
      where: { id: account.tenantId },
      update: { name: account.tenantName },
      create: {
        id: account.tenantId,
        name: account.tenantName
      }
    });

    await prisma.adminUser.upsert({
      where: {
        tenantId_publUserId: {
          tenantId: tenantRecord.id,
          publUserId: `local:${account.loginId}`
        }
      },
      update: {
        email: account.loginId,
        loginId: account.loginId,
        passwordHash: hashPassword(TEST_PASSWORD),
        role: UserRole.TENANT_ADMIN
      },
      create: {
        tenantId: tenantRecord.id,
        publUserId: `local:${account.loginId}`,
        loginId: account.loginId,
        email: account.loginId,
        passwordHash: hashPassword(TEST_PASSWORD),
        role: UserRole.TENANT_ADMIN
      }
    });
  }

  console.log('Seed complete for tenant:', tenant.id);
  console.log('Local test accounts ready:', testAccounts.map((account) => account.loginId).join(', '));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
