import { BadRequestException, ConflictException } from '@nestjs/common';
import { V2TemplatesService } from '../src/v2/templates/v2-templates.service';

function createServiceFixture() {
  const prisma = {
    $transaction: jest.fn(),
    providerTemplate: {
      findFirst: jest.fn()
    },
    template: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    publEventDefinition: {
      count: jest.fn()
    }
  };
  const readinessService = {};
  const kakaoTemplateCatalogService = {
    getRegistrationTargetsForUser: jest.fn(),
    getTemplateCatalogForUser: jest.fn()
  };
  const nhnService = {
    requestAlimtalkTemplateSync: jest.fn(),
    deleteAlimtalkTemplate: jest.fn()
  };

  return {
    prisma,
    readinessService,
    kakaoTemplateCatalogService,
    nhnService,
    service: new V2TemplatesService(prisma as any, readinessService as any, kakaoTemplateCatalogService as any, nhnService as any)
  };
}

describe('V2TemplatesService createKakaoTemplate', () => {
  it('rejects web link buttons that do not start with http or https before calling NHN', async () => {
    const { service, kakaoTemplateCatalogService, nhnService } = createServiceFixture();

    const promise = service.createKakaoTemplate(
      { userId: 'user_1', accessOrigin: 'DIRECT' } as any,
      {
        targetType: 'SENDER_PROFILE',
        targetId: 'profile_1',
        templateCode: 'ABC_D',
        name: '테스트',
        body: '가입 테스트',
        messageType: 'BA',
        emphasizeType: 'NONE',
        categoryCode: '001001',
        buttons: [
          {
            type: 'WL',
            name: '버튼이름',
            linkMo: '#{채널코드}/#{채널명}',
            linkPc: '#{채널코드}/#{채널명}'
          }
        ],
        quickReplies: []
      }
    );

    await expect(promise).rejects.toEqual(
      expect.objectContaining({
        message: expect.stringContaining('Mobile URL은 http:// 또는 https://로 시작해야 합니다.')
      })
    );
    await expect(promise).rejects.toBeInstanceOf(BadRequestException);
    expect(kakaoTemplateCatalogService.getRegistrationTargetsForUser).not.toHaveBeenCalled();
    expect(nhnService.requestAlimtalkTemplateSync).not.toHaveBeenCalled();
  });

  it('tracks variables used in button links as required template variables', async () => {
    const { service, prisma, kakaoTemplateCatalogService, nhnService } = createServiceFixture();
    const createTemplate = jest.fn().mockResolvedValue({
      id: 'tpl_1',
      body: '가입 테스트'
    });
    const createTemplateVersion = jest.fn().mockResolvedValue({ id: 'tplv_1' });
    const createProviderTemplate = jest.fn().mockResolvedValue({ id: 'pt_1' });

    kakaoTemplateCatalogService.getRegistrationTargetsForUser.mockResolvedValue([
      {
        id: 'profile_1',
        type: 'SENDER_PROFILE',
        label: '@비주오',
        senderKey: 'sender_key_1',
        senderProfileId: 'profile_1',
        senderProfileType: 'NORMAL'
      }
    ]);
    nhnService.requestAlimtalkTemplateSync.mockResolvedValue({
      nhnTemplateId: 'ABC_D',
      templateCode: 'ABC_D',
      kakaoTemplateCode: null,
      providerStatus: 'REQ'
    });
    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        template: { create: createTemplate },
        templateVersion: { create: createTemplateVersion },
        providerTemplate: { create: createProviderTemplate }
      })
    );

    await service.createKakaoTemplate(
      { userId: 'user_1', accessOrigin: 'DIRECT' } as any,
      {
        targetType: 'SENDER_PROFILE',
        targetId: 'profile_1',
        templateCode: 'ABC_D',
        name: '테스트',
        body: '가입 테스트',
        messageType: 'BA',
        emphasizeType: 'NONE',
        categoryCode: '001001',
        buttons: [
          {
            type: 'WL',
            name: '버튼이름',
            linkMo: 'https://example.com/#{channelCode}/#{channelTitle}'
          }
        ],
        quickReplies: []
      }
    );

    expect(createTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          requiredVariables: ['channelCode', 'channelTitle']
        })
      })
    );
  });

  it('updates an existing NHN template with the same template code', async () => {
    const { service, prisma, kakaoTemplateCatalogService, nhnService } = createServiceFixture();

    kakaoTemplateCatalogService.getRegistrationTargetsForUser.mockResolvedValue([
      {
        id: 'profile_1',
        type: 'SENDER_PROFILE',
        label: '@비주오',
        senderKey: 'sender_key_1',
        senderProfileId: 'profile_1',
        senderProfileType: 'NORMAL'
      }
    ]);
    nhnService.requestAlimtalkTemplateSync.mockResolvedValue({
      nhnTemplateId: 'ABC_D',
      templateCode: 'ABC_D',
      kakaoTemplateCode: null,
      providerStatus: 'REQ'
    });
    prisma.providerTemplate.findFirst.mockResolvedValue(null);

    await service.updateKakaoTemplate(
      { userId: 'user_1', accessOrigin: 'DIRECT' } as any,
      'ABC_D',
      {
        targetType: 'SENDER_PROFILE',
        targetId: 'profile_1',
        templateCode: 'ABC_D',
        name: '테스트 수정',
        body: '가입 테스트 수정',
        messageType: 'BA',
        emphasizeType: 'NONE',
        categoryCode: '001001',
        buttons: [],
        quickReplies: []
      }
    );

    expect(nhnService.requestAlimtalkTemplateSync).toHaveBeenCalledWith(
      expect.objectContaining({
        existingTemplateCode: 'ABC_D',
        templateCode: 'ABC_D',
        senderKey: 'sender_key_1',
        name: '테스트 수정'
      })
    );
  });

  it('saves a Kakao template draft locally without requesting NHN review', async () => {
    const { service, prisma, nhnService } = createServiceFixture();
    const createdAt = new Date('2026-05-07T00:00:00.000Z');
    const updatedAt = new Date('2026-05-07T00:01:00.000Z');

    prisma.template.findMany.mockResolvedValue([]);
    prisma.template.create.mockResolvedValue({
      id: 'draft_1',
      name: '주문 완료 알림톡',
      body: '주문번호 #{orderNo}',
      requiredVariables: ['orderNo'],
      metadataJson: {
        draftKind: 'KAKAO_TEMPLATE_DRAFT',
        sourceEventKey: 'ORDER_CREATED',
        targetType: 'SENDER_PROFILE',
        targetId: 'profile_1',
        templateCode: 'ORDER_01',
        messageType: 'BA',
        emphasizeType: 'NONE',
        securityFlag: false,
        buttons: [],
        quickReplies: [],
        savedAt: updatedAt.toISOString()
      },
      createdAt,
      updatedAt
    });

    const result = await service.saveKakaoTemplateDraft(
      { userId: 'user_1', accessOrigin: 'DIRECT' } as any,
      {
        sourceEventKey: 'ORDER_CREATED',
        targetType: 'SENDER_PROFILE',
        targetId: 'profile_1',
        templateCode: 'ORDER_01',
        name: '주문 완료 알림톡',
        body: '주문번호 #{orderNo}',
        messageType: 'BA',
        emphasizeType: 'NONE',
        buttons: [],
        quickReplies: []
      }
    );

    expect(nhnService.requestAlimtalkTemplateSync).not.toHaveBeenCalled();
    expect(prisma.template.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: '주문 완료 알림톡',
          body: '주문번호 #{orderNo}',
          requiredVariables: ['orderNo'],
          metadataJson: expect.objectContaining({
            draftKind: 'KAKAO_TEMPLATE_DRAFT',
            sourceEventKey: 'ORDER_CREATED',
            templateCode: 'ORDER_01'
          })
        })
      })
    );
    expect(result.draft).toEqual(
      expect.objectContaining({
        id: 'draft_1',
        sourceEventKey: 'ORDER_CREATED',
        templateCode: 'ORDER_01',
        requiredVariables: ['orderNo']
      })
    );
  });

  it('blocks deleting a Kakao template that is still connected to an event rule', async () => {
    const { service, prisma, kakaoTemplateCatalogService, nhnService } = createServiceFixture();

    kakaoTemplateCatalogService.getTemplateCatalogForUser.mockResolvedValue({
      items: [
        {
          source: 'SENDER_PROFILE',
          ownerKey: 'sender_key_1',
          senderKey: 'sender_key_1',
          templateCode: 'ABC_D',
          kakaoTemplateCode: null
        }
      ]
    });
    prisma.providerTemplate.findFirst.mockResolvedValue({
      eventRules: [{ eventKey: 'ORDER_CREATED' }]
    });

    const promise = service.deleteKakaoTemplate(
      { userId: 'user_1', accessOrigin: 'DIRECT' } as any,
      'ABC_D',
      {
        source: 'SENDER_PROFILE',
        ownerKey: 'sender_key_1',
        templateCode: 'ABC_D'
      }
    );

    await expect(promise).rejects.toBeInstanceOf(ConflictException);
    expect(nhnService.deleteAlimtalkTemplate).not.toHaveBeenCalled();
  });
});
