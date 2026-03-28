import {
  PrismaClient,
  MessageChannel,
  ProviderTemplateStatus,
  TemplateStatus,
  ChannelStrategy,
  MessagePurpose,
  UserRole,
  ManagedUserStatus,
  ManagedUserFieldType
} from '@prisma/client';
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

  await prisma.tenantDashboardSetting.upsert({
    where: { tenantId: tenant.id },
    update: {
      autoRechargeEnabled: false,
      lowBalanceAlertEnabled: false,
      dailySendLimit: 1000
    },
    create: {
      tenantId: tenant.id,
      autoRechargeEnabled: false,
      lowBalanceAlertEnabled: false,
      dailySendLimit: 1000
    }
  });

  // Keep the demo tenant free of prewired sender resources.
  // This cleans up the legacy seed values on reruns so app restarts do not resurrect them.
  await prisma.senderNumber.deleteMany({
    where: {
      tenantId: tenant.id,
      phoneNumber: '0212345678'
    }
  });

  await prisma.senderProfile.deleteMany({
    where: {
      tenantId: tenant.id,
      senderKey: 'ALIM_SENDER_KEY_1'
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
      smsSenderNumberId: null,
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
      smsSenderNumberId: null,
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
      smsSenderNumberId: null,
      alimtalkTemplateId: aprProviderTemplate.id,
      alimtalkSenderProfileId: null,
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
      smsSenderNumberId: null,
      alimtalkTemplateId: aprProviderTemplate.id,
      alimtalkSenderProfileId: null,
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
      alimtalkSenderProfileId: null,
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
      alimtalkSenderProfileId: null,
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

    await prisma.tenantDashboardSetting.upsert({
      where: { tenantId: tenantRecord.id },
      update: {},
      create: {
        tenantId: tenantRecord.id
      }
    });
  }

  await prisma.managedUserField.upsert({
    where: {
      tenantId_key: {
        tenantId: tenant.id,
        key: 'pointBalance'
      }
    },
    update: {
      label: '포인트 잔액',
      dataType: ManagedUserFieldType.NUMBER
    },
    create: {
      tenantId: tenant.id,
      key: 'pointBalance',
      label: '포인트 잔액',
      dataType: ManagedUserFieldType.NUMBER
    }
  });

  await prisma.managedUserField.upsert({
    where: {
      tenantId_key: {
        tenantId: tenant.id,
        key: 'cohortName'
      }
    },
    update: {
      label: '학습 코호트',
      dataType: ManagedUserFieldType.TEXT
    },
    create: {
      tenantId: tenant.id,
      key: 'cohortName',
      label: '학습 코호트',
      dataType: ManagedUserFieldType.TEXT
    }
  });

  await prisma.managedUserField.upsert({
    where: {
      tenantId_key: {
        tenantId: tenant.id,
        key: 'ticketCount'
      }
    },
    update: {
      label: '구매 티켓 수',
      dataType: ManagedUserFieldType.NUMBER
    },
    create: {
      tenantId: tenant.id,
      key: 'ticketCount',
      label: '구매 티켓 수',
      dataType: ManagedUserFieldType.NUMBER
    }
  });

  const managedUsers = [
    {
      source: 'publ',
      externalId: 'publ_user_1',
      name: '김민우',
      email: 'minwoo@publ.demo',
      phone: '01097690373',
      status: ManagedUserStatus.ACTIVE,
      userType: 'MEMBER',
      segment: 'VIP',
      gradeOrLevel: 'Gold',
      marketingConsent: true,
      tags: ['commerce', 'ticket'],
      registeredAt: new Date('2026-03-01T09:00:00.000Z'),
      lastLoginAt: new Date('2026-03-11T22:14:00.000Z'),
      customAttributes: {
        pointBalance: 12800,
        ticketCount: 4
      },
      rawPayload: {
        id: 'publ_user_1',
        member_name: '김민우',
        level: 'Gold',
        point_balance: 12800,
        ticket_count: 4
      }
    },
    {
      source: 'publ',
      externalId: 'publ_user_2',
      name: '이서윤',
      email: 'seoyoon@publ.demo',
      phone: '01055554444',
      status: ManagedUserStatus.DORMANT,
      userType: 'MEMBER',
      segment: '휴면 예정',
      gradeOrLevel: 'Silver',
      marketingConsent: false,
      tags: ['commerce'],
      registeredAt: new Date('2025-12-14T12:10:00.000Z'),
      lastLoginAt: new Date('2026-01-07T08:30:00.000Z'),
      customAttributes: {
        pointBalance: 3200
      },
      rawPayload: {
        id: 'publ_user_2',
        member_name: '이서윤',
        status_name: 'dormant',
        point_balance: 3200
      }
    },
    {
      source: 'academy-lms',
      externalId: 'student_301',
      name: '박지훈',
      email: 'jihun@academy.demo',
      phone: '01077778888',
      status: ManagedUserStatus.ACTIVE,
      userType: 'STUDENT',
      segment: 'React Bootcamp',
      gradeOrLevel: '3주차',
      marketingConsent: true,
      tags: ['education', 'spring-26'],
      registeredAt: new Date('2026-02-03T01:30:00.000Z'),
      lastLoginAt: new Date('2026-03-11T15:42:00.000Z'),
      customAttributes: {
        cohortName: '2026 Spring',
        ticketCount: 0
      },
      rawPayload: {
        student_id: 'student_301',
        student_name: '박지훈',
        cohort_name: '2026 Spring',
        progress_step: '3주차'
      }
    }
  ];

  for (const managedUser of managedUsers) {
    await prisma.managedUser.upsert({
      where: {
        tenantId_source_externalId: {
          tenantId: tenant.id,
          source: managedUser.source,
          externalId: managedUser.externalId
        }
      },
      update: managedUser,
      create: {
        tenantId: tenant.id,
        ...managedUser
      }
    });
  }

  await prisma.dashboardNotice.upsert({
    where: { id: 'notice_launch_checklist' },
    update: {
      title: '발신번호/카카오 채널 승인 정책 안내',
      body: '현재 대시보드에서는 NHN 상태와 내부 승인 상태를 분리해 보여줍니다. 발신번호와 카카오 채널은 내부 심사 완료 후에만 운영에 사용하세요.',
      isPinned: true,
      archivedAt: null
    },
    create: {
      id: 'notice_launch_checklist',
      title: '발신번호/카카오 채널 승인 정책 안내',
      body: '현재 대시보드에서는 NHN 상태와 내부 승인 상태를 분리해 보여줍니다. 발신번호와 카카오 채널은 내부 심사 완료 후에만 운영에 사용하세요.',
      isPinned: true,
      createdBy: admin.id,
      createdByEmail: admin.email
    }
  });

  await prisma.dashboardNotice.upsert({
    where: { id: 'notice_sender_review_mail' },
    update: {
      title: '발신번호 신청 메일 알림 점검',
      body: 'SMTP 설정이 연결되면 새 발신번호 신청 건이 운영자 메일로 즉시 전달됩니다. 알림이 오지 않으면 환경변수 값을 먼저 확인하세요.',
      isPinned: false,
      archivedAt: null
    },
    create: {
      id: 'notice_sender_review_mail',
      title: '발신번호 신청 메일 알림 점검',
      body: 'SMTP 설정이 연결되면 새 발신번호 신청 건이 운영자 메일로 즉시 전달됩니다. 알림이 오지 않으면 환경변수 값을 먼저 확인하세요.',
      isPinned: false,
      createdBy: admin.id,
      createdByEmail: admin.email
    }
  });

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
