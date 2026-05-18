import { extractRequiredVariables, extractRequiredVariablesFromSources, renderTemplate } from '@publ/shared';

describe('shared template variable parsing', () => {
  it('extracts variables from hash syntax', () => {
    expect(extractRequiredVariables('#{이름}님, #{시간} 결제가 완료되었습니다.')).toEqual(['시간', '이름']);
  });

  it('extracts variables across template body and action links', () => {
    expect(
      extractRequiredVariablesFromSources([
        '#{채널제목} 환불 승인',
        'https://#{채널주소}/channels/#{채널코드}/#{하위주소}',
        null,
        undefined
      ])
    ).toEqual(['채널제목', '채널주소', '채널코드', '하위주소']);
  });

  it('renders both mustache and hash syntax', () => {
    expect(
      renderTemplate('{{username}}님, #{amount}원 결제가 완료되었습니다.', {
        username: '민우',
        amount: 39000
      })
    ).toBe('민우님, 39000원 결제가 완료되었습니다.');
  });
});
