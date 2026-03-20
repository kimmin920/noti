export type SenderNumberApiType = 'COMPANY' | 'EMPLOYEE';

export const SMS_SENDER_NUMBER_GUIDE_URL =
  'https://console.nhncloud.com/project/6gXTdLBS/notification/sms#preregistration-outgoing-numbers';

export const SENDER_NUMBER_ALLOWED_EXTENSIONS = 'PNG, JPG, JPEG, PDF, ZIP, TIF, TIFF';

export const SENDER_NUMBER_TYPE_OPTIONS = [
  {
    apiType: 'COMPANY' as const,
    label: '사업자 명의 번호',
    description: '다른 사업자 명의로 개통된 번호입니다. 이용승낙서, 사업자등록증, 관계 확인 문서가 함께 필요합니다.',
    requiredDocuments: [
      '통신서비스 이용증명원',
      '이용승낙서',
      '번호 명의 사업자등록증',
      '관계 확인 문서'
    ]
  },
  {
    apiType: 'EMPLOYEE' as const,
    label: '개인 명의 번호',
    description: '개인 명의로 개통된 번호입니다. 통신서비스 이용증명원과 이용승낙서가 필요합니다.',
    requiredDocuments: [
      '통신서비스 이용증명원',
      '이용승낙서'
    ]
  }
] satisfies Array<{
  apiType: SenderNumberApiType;
  label: string;
  description: string;
  requiredDocuments: string[];
}>;

export function getSenderNumberTypeLabel(type: SenderNumberApiType | string) {
  return SENDER_NUMBER_TYPE_OPTIONS.find((option) => option.apiType === type)?.label ?? type;
}

export function isThirdPartyBusinessType(type: SenderNumberApiType | string) {
  return type === 'COMPANY';
}
