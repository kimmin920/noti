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
