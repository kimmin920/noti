import { ConflictException } from '@nestjs/common';
import { EventRulesService } from '../src/event-rules/event-rules.service';

function createFixture() {
  const prisma = {
    template: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (where?.id === 'tpl_sms_signup') {
          return {
            id: 'tpl_sms_signup',
            tenantId: 'tenant_demo',
            channel: 'SMS',
            status: 'PUBLISHED',
            body: '안녕하세요 #{username}님'
          };
        }

        return null;
      })
    },
    senderNumber: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (where?.id === 'sender_1') {
          return {
            id: 'sender_1',
            tenantId: 'tenant_demo',
            status: 'APPROVED'
          };
        }

        return null;
      })
    },
    providerTemplate: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (where?.id === 'provider_tpl_1') {
          return {
            id: 'provider_tpl_1',
            tenantId: 'tenant_demo',
            channel: 'ALIMTALK',
            providerStatus: 'APR',
            template: {
              id: 'alimtalk_template_1',
              body: '안녕하세요 #{username}님'
            }
          };
        }

        return null;
      })
    },
    senderProfile: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (where?.id === 'profile_1') {
          return {
            id: 'profile_1',
            tenantId: 'tenant_demo'
          };
        }

        return null;
      })
    },
    eventRule: {
      upsert: jest.fn(async ({ create }: any) => ({
        id: 'rule_1',
        ...create
      }))
    }
  };

  return {
    prisma,
    service: new EventRulesService(prisma as any)
  };
}

describe('EventRulesService', () => {
  it('normalizes blank relation ids to null before upsert', async () => {
    const { prisma, service } = createFixture();

    await service.upsert('tenant_demo', 'user_1', {
      eventKey: 'PUBL_USER_SIGNUP',
      displayName: '회원 가입',
      enabled: true,
      channelStrategy: 'SMS_ONLY',
      messagePurpose: 'NORMAL',
      requiredVariables: [' username '],
      smsTemplateId: 'tpl_sms_signup',
      smsSenderNumberId: 'sender_1',
      alimtalkTemplateId: '',
      alimtalkSenderProfileId: '   '
    });

    expect(prisma.eventRule.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          eventKey: 'PUBL_USER_SIGNUP',
          displayName: '회원 가입',
          requiredVariables: ['username'],
          smsTemplateId: 'tpl_sms_signup',
          smsSenderNumberId: 'sender_1',
          alimtalkTemplateId: null,
          alimtalkSenderProfileId: null
        }),
        update: expect.objectContaining({
          alimtalkTemplateId: null,
          alimtalkSenderProfileId: null
        })
      })
    );
  });

  it('rejects SMS_ONLY when sms template or sender number is missing', async () => {
    const { service } = createFixture();

    await expect(
      service.upsert('tenant_demo', 'user_1', {
        eventKey: 'PUBL_USER_SIGNUP',
        displayName: '회원 가입',
        enabled: true,
        channelStrategy: 'SMS_ONLY',
        messagePurpose: 'NORMAL',
        requiredVariables: ['username'],
        smsTemplateId: 'tpl_sms_signup',
        smsSenderNumberId: '',
        alimtalkTemplateId: '',
        alimtalkSenderProfileId: ''
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects when selected template variables do not match requiredVariables', async () => {
    const { prisma, service } = createFixture();
    prisma.template.findFirst.mockResolvedValueOnce({
      id: 'tpl_sms_signup',
      tenantId: 'tenant_demo',
      channel: 'SMS',
      status: 'PUBLISHED',
      body: '안녕하세요 #{이름}님'
    });

    await expect(
      service.upsert('tenant_demo', 'user_1', {
        eventKey: 'PUBL_USER_SIGNUP',
        displayName: '회원 가입',
        enabled: true,
        channelStrategy: 'SMS_ONLY',
        messagePurpose: 'NORMAL',
        requiredVariables: ['username'],
        smsTemplateId: 'tpl_sms_signup',
        smsSenderNumberId: 'sender_1',
        alimtalkTemplateId: '',
        alimtalkSenderProfileId: ''
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects ALIMTALK_THEN_SMS when no channel is configured', async () => {
    const { service } = createFixture();

    await expect(
      service.upsert('tenant_demo', 'user_1', {
        eventKey: 'PUBL_USER_SIGNUP',
        displayName: '회원 가입',
        enabled: true,
        channelStrategy: 'ALIMTALK_THEN_SMS',
        messagePurpose: 'NORMAL',
        requiredVariables: ['username'],
        smsTemplateId: '',
        smsSenderNumberId: '',
        alimtalkTemplateId: '',
        alimtalkSenderProfileId: ''
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
