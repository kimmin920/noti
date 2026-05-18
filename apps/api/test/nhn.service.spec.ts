import { BadGatewayException, BadRequestException } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { NhnService } from '../src/nhn/nhn.service';

function createFixture() {
  const env = {
    nhnAlimtalkAppKey: 'alimtalk-app-key',
    nhnAlimtalkSecretKey: 'alimtalk-secret-key',
    nhnAlimtalkBaseUrl: 'https://kakaotalk-bizmessage.api.nhncloudservice.com',
    nhnSmsAppKey: 'sms-app-key',
    nhnSmsSecretKey: 'sms-secret-key',
    nhnSmsBaseUrl: 'https://api-sms.cloud.toast.com',
    isPlaceholder: () => false
  };

  return {
    service: new NhnService(env as any)
  };
}

describe('NhnService sender profile errors', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('surfaces NHN sender profile apply header errors as user-facing bad requests', async () => {
    const { service } = createFixture();

    jest.spyOn(axios, 'request').mockResolvedValue({
      data: {
        header: {
          isSuccessful: false,
          resultCode: 40012,
          resultMessage: '존재하지 않는 카카오 채널입니다.'
        }
      }
    } as any);

    const promise = service.registerSenderProfile({
      plusFriendId: '@missing-channel',
      phoneNo: '01012345678',
      categoryCode: '00100010001'
    });

    await expect(promise).rejects.toEqual(
      expect.objectContaining({ message: expect.stringContaining('존재하지 않는 카카오 채널입니다.') })
    );
    await expect(promise).rejects.toBeInstanceOf(BadRequestException);
  });

  it('surfaces NHN sender profile token errors as user-facing bad requests', async () => {
    const { service } = createFixture();

    jest.spyOn(axios, 'request').mockResolvedValue({
      data: {
        header: {
          isSuccessful: false,
          resultCode: 40021,
          resultMessage: '관리자 휴대폰 번호가 채널 정보와 일치하지 않습니다.'
        }
      }
    } as any);

    const promise = service.verifySenderProfileToken({
      plusFriendId: '@vizuo',
      token: 12345678
    });

    await expect(promise).rejects.toEqual(
      expect.objectContaining({ message: expect.stringContaining('관리자 휴대폰 번호가 채널 정보와 일치하지 않습니다.') })
    );
    await expect(promise).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps upstream transport errors readable without extra prefixes', async () => {
    const { service } = createFixture();

    jest.spyOn(axios, 'request').mockRejectedValue(
      new AxiosError(
        'Request failed',
        undefined,
        undefined,
        undefined,
        {
          data: {
            header: {
              resultMessage: 'NHN 서버와 통신할 수 없습니다.'
            }
          }
        } as any
      )
    );

    const promise = service.registerSenderProfile({
      plusFriendId: '@vizuo',
      phoneNo: '01012345678',
      categoryCode: '00100010001'
    });

    await expect(promise).rejects.toEqual(expect.objectContaining({ message: 'NHN 서버와 통신할 수 없습니다.' }));
    await expect(promise).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('uploads a brand message image and returns NHN image metadata', async () => {
    const { service } = createFixture();

    const postSpy = jest.spyOn(axios, 'post').mockResolvedValue({
      data: {
        header: {
          isSuccessful: true,
          resultCode: 0
        },
        image: {
          imageSeq: 101,
          imageUrl: 'https://cdn.example.com/brand-image.png',
          imageName: 'brand-image.png'
        }
      }
    } as any);

    const result = await service.uploadBrandMessageImage(
      {
        buffer: Buffer.from('fake-image'),
        originalname: '브랜드메시지.png',
        mimetype: 'image/png'
      },
      {
        imageType: 'WIDE_IMAGE'
      }
    );

    expect(postSpy).toHaveBeenCalledWith(
      expect.stringContaining('/brand-message/v1.0/appkeys/alimtalk-app-key/images'),
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Secret-Key': 'alimtalk-secret-key'
        })
      })
    );
    expect(result).toEqual({
      imageSeq: 101,
      imageUrl: 'https://cdn.example.com/brand-image.png',
      imageName: 'brand-image.png'
    });
  });

  it('keeps brand message image upload transport errors readable without extra prefixes', async () => {
    const { service } = createFixture();

    jest.spyOn(axios, 'post').mockRejectedValue(
      new AxiosError(
        'Request failed',
        undefined,
        undefined,
        undefined,
        {
          data: {
            header: {
              resultMessage: '브랜드 메시지 이미지를 업로드할 수 없습니다.'
            }
          }
        } as any
      )
    );

    const promise = service.uploadBrandMessageImage(
      {
        buffer: Buffer.from('fake-image'),
        originalname: 'brand.png',
        mimetype: 'image/png'
      },
      {
        imageType: 'IMAGE'
      }
    );

    await expect(promise).rejects.toEqual(
      expect.objectContaining({ message: 'NHN brand message image upload failed: 브랜드 메시지 이미지를 업로드할 수 없습니다.' })
    );
    await expect(promise).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('prefers SMS delivery status fields over generic SUCCESS result messages', async () => {
    const { service } = createFixture();

    jest.spyOn(axios, 'get').mockResolvedValue({
      data: {
        header: {
          isSuccessful: true
        },
        body: {
          data: {
            recipientNo: '01012345678',
            msgStatusName: 'PROCESSING',
            msgStatusCode: '01',
            resultCode: 'SUCCESS',
            resultMessage: 'SUCCESS',
            requestDate: '2026-04-07T12:00:00.000Z',
            updateDate: '2026-04-07T12:00:30.000Z'
          }
        }
      }
    } as any);

    const result = await service.fetchSmsDeliveryStatus('request_1:1', 'SMS');

    expect(result.providerStatus).toBe('PROCESSING');
    expect(result.providerCode).toBe('01');
    expect(result.providerMessage).toBe('PROCESSING');
  });

  it('creates an SMS template through NHN and normalizes template variables', async () => {
    const { service } = createFixture();

    const requestSpy = jest.spyOn(axios, 'request');
    requestSpy
      .mockResolvedValueOnce({
        data: {
          header: {
            isSuccessful: true,
            resultCode: 0
          }
        }
      } as any)
      .mockResolvedValueOnce({
        data: {
          header: {
            isSuccessful: true,
            resultCode: 0
          },
          body: {
            data: {
              templateId: 'SMS_TPL_01',
              categoryId: 10,
              categoryName: '기본',
              templateName: '가입 안내',
              useYn: 'Y',
              sendNo: '01012345678',
              sendType: '0',
              body: '안녕하세요 ##name##님'
            }
          }
        }
      } as any);

    const result = await service.createSmsTemplate({
      categoryId: 10,
      templateId: 'SMS_TPL_01',
      templateName: '가입 안내',
      sendNo: '01012345678',
      sendType: '0',
      body: '안녕하세요 #{name}님',
      useYn: 'Y'
    });

    expect(requestSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        method: 'POST',
        url: expect.stringContaining('/sms/v3.0/appKeys/sms-app-key/templates'),
        data: expect.objectContaining({
          templateId: 'SMS_TPL_01',
          body: '안녕하세요 ##name##님'
        })
      })
    );
    expect(result.templateId).toBe('SMS_TPL_01');
    expect(result.template?.categoryName).toBe('기본');
  });

  it('updates an SMS template without sending immutable category fields', async () => {
    const { service } = createFixture();

    const requestSpy = jest.spyOn(axios, 'request');
    requestSpy
      .mockResolvedValueOnce({
        data: {
          header: {
            isSuccessful: true,
            resultCode: 0
          }
        }
      } as any)
      .mockResolvedValueOnce({
        data: {
          header: {
            isSuccessful: true,
            resultCode: 0
          },
          body: {
            data: {
              templateId: 'SMS_TPL_01',
              templateName: '수정 안내',
              useYn: 'Y',
              sendNo: '01012345678',
              sendType: '1',
              title: '수정',
              body: '수정 ##name##'
            }
          }
        }
      } as any);

    await service.updateSmsTemplate('SMS_TPL_01', {
      templateName: '수정 안내',
      sendNo: '01012345678',
      sendType: '1',
      title: '수정',
      body: '수정 #{name}',
      useYn: 'Y'
    });

    const updatePayload = requestSpy.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(updatePayload).toMatchObject({
      templateName: '수정 안내',
      body: '수정 ##name##'
    });
    expect(updatePayload).not.toHaveProperty('categoryId');
    expect(updatePayload).not.toHaveProperty('templateId');
  });

  it('uploads an SMS MMS attachment as a base64 binaryUpload request', async () => {
    const { service } = createFixture();
    const imageBuffer = Buffer.from('jpeg-bytes');

    const requestSpy = jest.spyOn(axios, 'request').mockResolvedValue({
      data: {
        header: {
          isSuccessful: true,
          resultCode: 0
        },
        body: {
          data: {
            fileId: 321,
            fileName: 'notice.jpg',
            filePath: '/sms/notice.jpg'
          }
        }
      }
    } as any);

    const result = await service.uploadSmsAttachment(
      {
        buffer: imageBuffer,
        originalname: 'notice.jpg'
      } as Express.Multer.File,
      'tester'
    );

    expect(requestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: expect.stringContaining('/sms/v3.0/appKeys/sms-app-key/attachfile/binaryUpload'),
        data: {
          fileName: 'notice.jpg',
          createUser: 'tester',
          fileBody: imageBuffer.toString('base64')
        }
      })
    );
    expect(result).toEqual({
      fileId: 321,
      fileName: 'notice.jpg',
      filePath: '/sms/notice.jpg'
    });
  });

  it('creates an SMS template category through NHN without forcing a root parent id', async () => {
    const { service } = createFixture();

    const requestSpy = jest.spyOn(axios, 'request').mockResolvedValue({
      data: {
        header: {
          isSuccessful: true,
          resultCode: 0
        },
        body: {
          data: {
            categoryId: 456,
            categoryParentId: 0,
            depth: 0,
            sort: 0,
            categoryName: 'user_1',
            categoryDesc: 'Publ SMS template category',
            useYn: 'Y'
          }
        }
      }
    } as any);

    const result = await service.createSmsTemplateCategory({
      categoryName: 'user_1',
      categoryDesc: 'Publ SMS template category',
      useYn: 'Y',
      createUser: 'user_1'
    });

    expect(requestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: expect.stringContaining('/sms/v3.0/appKeys/sms-app-key/categories'),
        data: {
          categoryName: 'user_1',
          categoryDesc: 'Publ SMS template category',
          useYn: 'Y',
          createUser: 'user_1'
        }
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        categoryId: 456,
        categoryName: 'user_1',
        useYn: 'Y'
      })
    );
  });

  it('creates an SMS template category under an explicit parent category', async () => {
    const { service } = createFixture();

    const requestSpy = jest.spyOn(axios, 'request').mockResolvedValue({
      data: {
        header: {
          isSuccessful: true,
          resultCode: 0
        },
        body: {
          data: {
            categoryId: 777,
            categoryParentId: 456,
            depth: 1,
            sort: 0,
            categoryName: 'user_1',
            categoryDesc: 'Publ SMS template category',
            useYn: 'Y'
          }
        }
      }
    } as any);

    await service.createSmsTemplateCategory({
      categoryParentId: 456,
      categoryName: 'user_1',
      categoryDesc: 'Publ SMS template category',
      useYn: 'Y',
      createUser: 'user_1'
    });

    expect(requestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: expect.stringContaining('/sms/v3.0/appKeys/sms-app-key/categories'),
        data: expect.objectContaining({
          categoryParentId: 456,
          categoryName: 'user_1'
        })
      })
    );
  });

  it('omits empty templateParameter for bulk AlimTalk recipients without variables', async () => {
    const { service } = createFixture();

    const postSpy = jest.spyOn(axios, 'post').mockResolvedValue({
      data: {
        header: {
          isSuccessful: true,
          resultCode: 0
        },
        message: {
          requestId: 'bulk_request_1',
          sendResults: [
            {
              recipientNo: '01012345678',
              recipientSeq: 1,
              resultCode: 0,
              resultMessage: 'SUCCESS'
            }
          ]
        }
      }
    } as any);

    await service.sendBulkAlimtalk({
      senderKey: 'sender_key_1',
      templateCode: 'GROUP_TPL_01',
      recipients: [
        {
          recipientNo: '01012345678',
          recipientName: '민우',
          recipientGroupingKey: 'managed-user:user_1',
          templateParameters: {}
        }
      ]
    });

    expect(postSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        recipientList: [
          expect.objectContaining({
            recipientNo: '01012345678',
            recipientName: '민우',
            recipientGroupingKey: 'managed-user:user_1'
          })
        ]
      }),
      expect.any(Object)
    );

    const providerRequest = postSpy.mock.calls[0]?.[1] as {
      recipientList: Array<Record<string, unknown>>;
    };
    expect(providerRequest.recipientList[0]).not.toHaveProperty('templateParameter');
  });

  it('counts brand messages directly from NHN message list response', async () => {
    const { service } = createFixture();

    jest.spyOn(axios, 'request').mockResolvedValue({
      data: {
        header: {
          isSuccessful: true,
          resultCode: 0
        },
        messageSearchResultResponse: {
          totalCount: 7,
          messages: [
            { requestId: 'req-1', recipientSeq: 1 },
            { requestId: 'req-2', recipientSeq: 1 }
          ]
        }
      }
    } as any);

    const count = await service.fetchBrandMessageCountByRequestDateRange(
      new Date('2026-04-13T00:00:00.000+09:00'),
      new Date('2026-04-14T00:00:00.000+09:00')
    );

    expect(count).toBe(7);
  });

  it('uses basic-messages for bulk brand template sends and omits empty templateParameter', async () => {
    const { service } = createFixture();

    const postSpy = jest.spyOn(axios, 'post').mockResolvedValue({
      data: {
        header: {
          isSuccessful: true,
          resultCode: 0
        },
        message: {
          requestId: 'brand_bulk_request_1',
          sendResults: [
            {
              recipientNo: '01012345678',
              recipientSeq: 1,
              resultCode: 0,
              resultMessage: 'SUCCESS'
            }
          ]
        }
      }
    } as any);

    await service.sendBulkBrandMessage({
      senderKey: 'sender_key_1',
      mode: 'TEMPLATE',
      targeting: 'I',
      templateCode: 'BRAND_TPL_01',
      pushAlarm: true,
      adult: false,
      recipients: [
        {
          recipientNo: '01012345678',
          recipientName: '민우',
          recipientGroupingKey: 'managed-user:user_1',
          templateParameters: {}
        }
      ]
    });

    expect(postSpy).toHaveBeenCalledWith(
      expect.stringContaining('/brand-message/v1.0/appkeys/alimtalk-app-key/basic-messages'),
      expect.objectContaining({
        templateCode: 'BRAND_TPL_01',
        recipientList: [
          expect.objectContaining({
            recipientNo: '01012345678',
            recipientName: '민우',
            recipientGroupingKey: 'managed-user:user_1'
          })
        ]
      }),
      expect.any(Object)
    );

    const providerRequest = postSpy.mock.calls[0]?.[1] as {
      recipientList: Array<Record<string, unknown>>;
    };
    expect(providerRequest.recipientList[0]).not.toHaveProperty('templateParameter');
  });

  it('updates a brand template through NHN and reloads detail', async () => {
    const { service } = createFixture();

    const requestSpy = jest.spyOn(axios, 'request');
    requestSpy
      .mockResolvedValueOnce({
        data: {
          header: {
            isSuccessful: true,
            resultCode: 0
          }
        }
      } as any)
      .mockResolvedValueOnce({
        data: {
          header: {
            isSuccessful: true,
            resultCode: 0
          },
          template: {
            templateCode: 'BRAND_TPL_01',
            templateName: '수정된 템플릿',
            senderKey: 'sender_key_1',
            plusFriendId: '@vizuo',
            chatBubbleType: 'TEXT',
            content: '본문',
            buttons: [],
            status: 'APR'
          }
        }
      } as any);

    const result = await service.updateBrandTemplate({
      senderKey: 'sender_key_1',
      templateCode: 'BRAND_TPL_01',
      templateName: '수정된 템플릿',
      chatBubbleType: 'TEXT',
      content: '본문'
    });

    expect(requestSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        method: 'PUT',
        url: expect.stringContaining('/brand-message/v1.0/appkeys/alimtalk-app-key/senders/sender_key_1/templates/BRAND_TPL_01'),
        data: expect.objectContaining({
          templateName: '수정된 템플릿',
          chatBubbleType: 'TEXT',
          content: '본문'
        })
      })
    );
    expect(result.templateCode).toBe('BRAND_TPL_01');
    expect(result.template?.templateName).toBe('수정된 템플릿');
  });

  it('deletes a brand template through NHN', async () => {
    const { service } = createFixture();

    const requestSpy = jest.spyOn(axios, 'request').mockResolvedValue({
      data: {
        header: {
          isSuccessful: true,
          resultCode: 0
        }
      }
    } as any);

    const result = await service.deleteBrandTemplate('sender_key_1', 'BRAND_TPL_01');

    expect(requestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'DELETE',
        url: expect.stringContaining('/brand-message/v1.0/appkeys/alimtalk-app-key/senders/sender_key_1/templates/BRAND_TPL_01')
      })
    );
    expect(result).toEqual({
      templateCode: 'BRAND_TPL_01'
    });
  });
});
