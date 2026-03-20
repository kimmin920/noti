import { extractRequiredVariables, renderTemplate } from '@publ/shared';

describe('shared template variable parsing', () => {
  it('extracts variables from hash syntax', () => {
    expect(extractRequiredVariables('#{이름}님, #{시간} 결제가 완료되었습니다.')).toEqual(['시간', '이름']);
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
