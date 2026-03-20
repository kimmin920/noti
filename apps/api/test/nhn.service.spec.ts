import { BadGatewayException, BadRequestException } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { NhnService } from '../src/nhn/nhn.service';

function createFixture() {
  const env = {
    nhnAlimtalkAppKey: 'alimtalk-app-key',
    nhnAlimtalkSecretKey: 'alimtalk-secret-key',
    nhnAlimtalkBaseUrl: 'https://kakaotalk-bizmessage.api.nhncloudservice.com',
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

    await expect(promise).rejects.toEqual(expect.objectContaining({ message: '존재하지 않는 카카오 채널입니다.' }));
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

    await expect(promise).rejects.toEqual(expect.objectContaining({ message: '관리자 휴대폰 번호가 채널 정보와 일치하지 않습니다.' }));
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
});
