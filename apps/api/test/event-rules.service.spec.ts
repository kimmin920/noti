import { ConflictException } from '@nestjs/common';
import { EventRulesService } from '../src/event-rules/event-rules.service';

function createFixture() {
  const prisma = {
    template: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (where?.id === 'tpl_sms_signup') {
          return {
            id: 'tpl_sms_signup',
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
            status: 'ACTIVE'
          };
        }

        return null;
      })
    },
    publEventDefinition: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (where?.eventKey === 'PUBL_USER_SIGNUP') {
          return {
            eventKey: 'PUBL_USER_SIGNUP',
            defaultTemplateCode: 'PUBL_DEFAULT_001',
            defaultKakaoTemplateCode: null,
            defaultTemplateStatus: 'APR',
            defaultTemplateBody: '안녕하세요 #{username}님'
          };
        }

        return null;
      })
    },
    eventRule: {
      findFirst: jest.fn(async () => null),
      create: jest.fn(async ({ data }: any) => ({
        id: 'rule_1',
        ...data
      })),
      update: jest.fn(async ({ data }: any) => ({
        id: 'rule_1',
        ...data
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

    await service.upsert('user_1', 'user_1', {
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

    expect(prisma.eventRule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerUserId: 'user_1',
          eventKey: 'PUBL_USER_SIGNUP',
          displayName: '회원 가입',
          requiredVariables: ['username'],
          smsTemplateId: 'tpl_sms_signup',
          smsSenderNumberId: 'sender_1',
          alimtalkTemplateId: null,
          alimtalkSenderProfileId: null
        })
      })
    );
  });

  it('rejects SMS_ONLY when sms template or sender number is missing', async () => {
    const { service } = createFixture();

    await expect(
      service.upsert('user_1', 'user_1', {
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
      channel: 'SMS',
      status: 'PUBLISHED',
      body: '안녕하세요 #{이름}님'
    });

    await expect(
      service.upsert('user_1', 'user_1', {
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
      service.upsert('user_1', 'user_1', {
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

  it('allows default AlimTalk template binding with an active Kakao channel', async () => {
    const { prisma, service } = createFixture();

    await service.upsert('user_1', 'user_1', {
      eventKey: 'PUBL_USER_SIGNUP',
      displayName: '회원 가입',
      enabled: true,
      channelStrategy: 'ALIMTALK_ONLY',
      messagePurpose: 'NORMAL',
      requiredVariables: ['username'],
      smsTemplateId: '',
      smsSenderNumberId: '',
      alimtalkTemplateId: '',
      alimtalkTemplateBindingMode: 'DEFAULT',
      alimtalkSenderProfileId: 'profile_1'
    });

    expect(prisma.eventRule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerUserId: 'user_1',
          eventKey: 'PUBL_USER_SIGNUP',
          alimtalkTemplateId: null,
          alimtalkTemplateBindingMode: 'DEFAULT',
          alimtalkSenderProfileId: 'profile_1'
        })
      })
    );
  });
});
