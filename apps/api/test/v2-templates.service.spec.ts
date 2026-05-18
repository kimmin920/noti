import { BadRequestException, ConflictException } from '@nestjs/common';
import { V2TemplatesService } from '../src/v2/templates/v2-templates.service';

function createServiceFixture() {
  const prisma = {
    $transaction: jest.fn(),
    providerTemplate: {
      findFirst: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn()
    },
    template: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    templateVersion: {
      create: jest.fn(),
      findFirst: jest.fn()
    },
    senderNumber: {
      findFirst: jest.fn(),
      findMany: jest.fn()
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
    deleteAlimtalkTemplate: jest.fn(),
    fetchSmsTemplateCategories: jest.fn().mockResolvedValue([
      {
        categoryId: 1,
        categoryParentId: 0,
        depth: 0,
        sort: 0,
        categoryName: 'NOTI',
        categoryDesc: 'Publ SMS template parent category',
        useYn: 'Y'
      },
      {
        categoryId: 10,
        categoryParentId: 1,
        depth: 1,
        sort: 0,
        categoryName: 'user_1',
        categoryDesc: 'Publ SMS template category',
        useYn: 'Y'
      }
    ]),
    fetchSmsTemplates: jest.fn().mockResolvedValue({
      templates: [],
      totalCount: 0
    }),
    createSmsTemplateCategory: jest.fn(),
    createSmsTemplate: jest.fn(),
    updateSmsTemplate: jest.fn(),
    deleteSmsTemplate: jest.fn()
  };

  return {
    prisma,
    readinessService,
    kakaoTemplateCatalogService,
    nhnService,
    service: new V2TemplatesService(prisma as any, readinessService as any, kakaoTemplateCatalogService as any, nhnService as any)
  };
}

describe('V2TemplatesService templates', () => {
  it('ensures an SMS template category named with the current user id', async () => {
    const { service, nhnService } = createServiceFixture();

    nhnService.fetchSmsTemplateCategories.mockResolvedValueOnce([]);
    nhnService.createSmsTemplateCategory
      .mockResolvedValueOnce({
        categoryId: 1,
        categoryParentId: 0,
        depth: 0,
        sort: 0,
        categoryName: 'NOTI',
        categoryDesc: 'Publ SMS template parent category',
        useYn: 'Y'
      })
      .mockResolvedValueOnce({
        categoryId: 777,
        categoryParentId: 1,
        depth: 1,
        sort: 0,
        categoryName: 'user_1',
        categoryDesc: 'Publ SMS template category',
        useYn: 'Y'
      });

    const result = await service.ensureSmsTemplateCategory({ userId: 'user_1', accessOrigin: 'DIRECT' } as any);

    expect(nhnService.createSmsTemplateCategory).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        categoryName: 'NOTI',
        useYn: 'Y',
        createUser: 'user_1'
      })
    );
    expect(nhnService.createSmsTemplateCategory).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        categoryParentId: 1,
        categoryName: 'user_1',
        useYn: 'Y',
        createUser: 'user_1'
      })
    );
    expect(result).toEqual({
      category: {
        categoryId: 777,
        categoryParentId: 1,
        depth: 1,
        categoryName: 'user_1',
        categoryDesc: 'Publ SMS template category'
      },
      created: true
    });
  });

  it('creates a user SMS template category under the NOTI parent category', async () => {
    const { service, nhnService } = createServiceFixture();

    nhnService.fetchSmsTemplateCategories.mockResolvedValueOnce([
      {
        categoryId: 1,
        categoryParentId: 0,
        depth: 0,
        sort: 0,
        categoryName: 'NOTI',
        categoryDesc: 'Publ SMS template parent category',
        useYn: 'Y'
      }
    ]);
    nhnService.createSmsTemplateCategory.mockResolvedValue({
      categoryId: 777,
      categoryParentId: 1,
      depth: 1,
      sort: 0,
      categoryName: 'user_1',
      categoryDesc: 'Publ SMS template category',
      useYn: 'Y'
    });

    const result = await service.ensureSmsTemplateCategory({ userId: 'user_1', accessOrigin: 'DIRECT' } as any);

    expect(nhnService.createSmsTemplateCategory).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryParentId: 1,
        categoryName: 'user_1',
        useYn: 'Y',
        createUser: 'user_1'
      })
    );
    expect(result).toEqual({
      category: {
        categoryId: 777,
        categoryParentId: 1,
        depth: 1,
        categoryName: 'user_1',
        categoryDesc: 'Publ SMS template category'
      },
      created: true
    });
  });

  it('returns only the current user SMS template category', async () => {
    const { service, prisma, nhnService } = createServiceFixture();

    prisma.template.count.mockResolvedValue(0);
    prisma.template.findMany.mockResolvedValue([]);
    prisma.senderNumber.findMany.mockResolvedValue([]);
    nhnService.fetchSmsTemplateCategories.mockResolvedValue([
      {
        categoryId: 1,
        categoryParentId: 0,
        depth: 0,
        sort: 0,
        categoryName: 'NOTI',
        categoryDesc: 'Publ SMS template parent category',
        useYn: 'Y'
      },
      {
        categoryId: 9,
        categoryParentId: 0,
        depth: 0,
        sort: 1,
        categoryName: 'user_1',
        categoryDesc: 'Root user category',
        useYn: 'Y'
      },
      {
        categoryId: 10,
        categoryParentId: 1,
        depth: 1,
        sort: 2,
        categoryName: 'user_1',
        categoryDesc: 'Publ SMS template category',
        useYn: 'Y'
      },
      {
        categoryId: 11,
        categoryParentId: 1,
        depth: 1,
        sort: 3,
        categoryName: 'other_user',
        categoryDesc: 'Publ SMS template category',
        useYn: 'Y'
      },
      {
        categoryId: 12,
        categoryParentId: 1,
        depth: 1,
        sort: 4,
        categoryName: 'user_1',
        categoryDesc: 'Inactive category',
        useYn: 'N'
      }
    ]);

    const result = await service.getSmsTemplates({ userId: 'user_1', accessOrigin: 'DIRECT' } as any);

    expect(result.categories).toEqual([
      {
        categoryId: 10,
        categoryParentId: 1,
        depth: 1,
        categoryName: 'user_1',
        categoryDesc: 'Publ SMS template category'
      }
    ]);
  });

  it('rejects SMS template creation with another category id', async () => {
    const { service, prisma, nhnService } = createServiceFixture();

    prisma.senderNumber.findFirst.mockResolvedValue({
      id: 'sender_1',
      phoneNumber: '010-1234-5678'
    });

    const promise = service.createSmsTemplate(
      { userId: 'user_1', accessOrigin: 'DIRECT' } as any,
      {
        senderNumberId: 'sender_1',
        categoryId: 99,
        sendType: 'SMS',
        name: '가입 안내',
        body: '안녕하세요'
      }
    );

    await expect(promise).rejects.toBeInstanceOf(BadRequestException);
    expect(nhnService.createSmsTemplate).not.toHaveBeenCalled();
  });

  it('creates an SMS template only in NHN', async () => {
    const { service, prisma, nhnService } = createServiceFixture();

    prisma.senderNumber.findFirst.mockResolvedValue({
      id: 'sender_1',
      phoneNumber: '010-1234-5678'
    });
    nhnService.createSmsTemplate.mockResolvedValue({
      templateId: 'SMS_TPL_01',
      template: {
        templateId: 'SMS_TPL_01',
        categoryId: 10,
        categoryName: '기본',
        templateName: '가입 안내',
        useYn: 'Y',
        sendNo: '01012345678',
        sendType: '0',
        body: '안녕하세요 ##name##님',
        attachFileList: []
      }
    });

    const result = await service.createSmsTemplate(
      { userId: 'user_1', accessOrigin: 'DIRECT' } as any,
      {
        senderNumberId: 'sender_1',
        categoryId: 10,
        sendType: 'SMS',
        name: '가입 안내',
        body: '안녕하세요 #{name}님'
      }
    );

    expect(nhnService.createSmsTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: 10,
        templateName: '가입 안내',
        sendNo: '01012345678',
        sendType: '0',
        body: '안녕하세요 #{name}님'
      })
    );
    expect(prisma.template.create).not.toHaveBeenCalled();
    expect(prisma.providerTemplate.create).not.toHaveBeenCalled();
    expect(result.template.nhnTemplateId).toBe('SMS_TPL_01');
    expect(result.template.body).toBe('안녕하세요 #{name}님');
  });

  it('creates an MMS SMS template with NHN attachment ids', async () => {
    const { service, prisma, nhnService } = createServiceFixture();

    prisma.senderNumber.findFirst.mockResolvedValue({
      id: 'sender_1',
      phoneNumber: '010-1234-5678'
    });
    nhnService.createSmsTemplate.mockResolvedValue({
      templateId: 'SMS_TPL_MMS_01',
      template: {
        templateId: 'SMS_TPL_MMS_01',
        categoryId: 10,
        categoryName: '기본',
        useYn: 'Y',
        templateName: '이미지 안내',
        sendNo: '01012345678',
        sendType: '1',
        title: '이미지 안내',
        body: '이미지 안내',
        attachFileList: [
          {
            fileId: 321,
            fileName: 'notice.jpg',
            filePath: '/sms/notice.jpg',
            fileSize: 1024
          }
        ]
      }
    });

    const result = await service.createSmsTemplate(
      { userId: 'user_1', accessOrigin: 'DIRECT' } as any,
      {
        senderNumberId: 'sender_1',
        categoryId: 10,
        sendType: 'SMS',
        name: '이미지 안내',
        title: '이미지 안내',
        body: '이미지 안내',
        attachments: [
          {
            fileId: 321,
            fileName: 'notice.jpg',
            size: 1024
          }
        ]
      }
    );

    expect(nhnService.createSmsTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        sendType: '1',
        title: '이미지 안내',
        attachFileIdList: [321]
      })
    );
    expect(prisma.template.create).not.toHaveBeenCalled();
    expect(result.template.sendType).toBe('MMS');
    expect(result.template.attachments).toEqual([
      {
        fileId: 321,
        fileName: 'notice.jpg',
        filePath: '/sms/notice.jpg',
        previewDataUrl: null,
        size: 1024
      }
    ]);
  });

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
