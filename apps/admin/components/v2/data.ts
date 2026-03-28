export type SetupStatus = 'active' | 'pending' | 'missing';

export interface SetupItem {
  key: 'sms' | 'kakao';
  label: string;
  description: string;
  status: SetupStatus;
}

export const workspaceName = 'ACME Corp';

export const setupItems: SetupItem[] = [
  {
    key: 'sms',
    label: 'SMS 발신번호',
    description: '010-1234-5678 등록 완료',
    status: 'active'
  },
  {
    key: 'kakao',
    label: '카카오채널',
    description: '@acme-brand 연결 완료',
    status: 'active'
  }
];

export const notices = [
  {
    type: 'notice' as const,
    title: '메시지 서비스 점검 예정 (06-20 02:00-04:00)',
    date: '2026-03-22'
  },
  {
    type: 'update' as const,
    title: '알림톡 버튼 타입 추가 지원',
    date: '2026-03-18'
  }
];

export const smsTemplates = [
  {
    name: '회원가입 인증번호',
    preview: '[인증] 인증번호는 #{code}입니다.',
    version: 'v3',
    status: '발행됨',
    updatedAt: '2026-03-21'
  },
  {
    name: '배송 출발 알림',
    preview: '#{name}님의 상품이 출발했습니다.',
    version: 'v1',
    status: '초안',
    updatedAt: '2026-03-20'
  },
  {
    name: '결제 완료 (구버전)',
    preview: '결제가 완료되었습니다. #{amount}원',
    version: 'v2',
    status: '보관됨',
    updatedAt: '2026-03-11'
  }
];

export const kakaoTemplates = [
  {
    name: 'welcome_v2',
    channel: '@acme-brand',
    preview: '회원가입이 완료되었습니다. 첫 설정을 이어서 진행해 주세요.',
    status: '승인됨',
    updatedAt: '2026-03-19'
  },
  {
    name: 'payment_done_v1',
    channel: '@acme-brand',
    preview: '결제가 완료되었습니다. 주문 내역을 확인해 주세요.',
    status: '승인됨',
    updatedAt: '2026-03-12'
  }
];

export const eventRules = [
  {
    key: 'user.registered',
    strategy: 'Fallback',
    channels: ['알림톡', 'SMS'],
    template: 'welcome_v2',
    status: '활성',
    processed: '124'
  },
  {
    key: 'payment.completed',
    strategy: '단일',
    channels: ['알림톡만'],
    template: 'payment_done_v1',
    status: '활성',
    processed: '84'
  },
  {
    key: 'delivery.started',
    strategy: '단일',
    channels: ['SMS만'],
    template: 'delivery_v1',
    status: '일시정지',
    processed: '12'
  }
];

export const logRows = [
  {
    requestId: 'req_01JQ9V5M6Y',
    channel: 'SMS',
    recipient: '010-****-1234',
    status: '전송완료',
    createdAt: '2026-03-23 14:02'
  },
  {
    requestId: 'req_01JQ9V5P8A',
    channel: '알림톡',
    recipient: '010-****-5678',
    status: '전송완료',
    createdAt: '2026-03-23 13:48'
  },
  {
    requestId: 'req_01JQ9V5S1D',
    channel: 'SMS',
    recipient: '010-****-9012',
    status: '실패',
    createdAt: '2026-03-23 13:31'
  },
  {
    requestId: 'req_01JQ9V62ZW',
    channel: '알림톡',
    recipient: '010-****-3456',
    status: '처리중',
    createdAt: '2026-03-23 13:15'
  }
];

export const recipients = [
  {
    name: '김민우',
    phone: '010-1234-5678',
    segment: '신규 가입자',
    consent: '동의',
    status: '활성'
  },
  {
    name: '이서윤',
    phone: '010-2222-3333',
    segment: '결제 완료',
    consent: '동의',
    status: '활성'
  },
  {
    name: '박지훈',
    phone: '010-4444-5555',
    segment: '배송 알림',
    consent: '거부',
    status: '휴면'
  }
];

export const draftMessages = [
  {
    id: 'draft-1',
    channel: 'SMS',
    title: '배송 안내 SMS',
    body: '#{name}님, 주문하신 상품이 오늘 출발했습니다.',
    updatedAt: '5분 전'
  },
  {
    id: 'draft-2',
    channel: '알림톡',
    title: '가입 축하 메시지',
    body: '회원가입이 완료되었습니다. 첫 설정을 시작해 주세요.',
    updatedAt: '18분 전'
  }
];

export const campaignRows = [
  {
    id: 'summer-promo',
    name: '6월 프로모션 안내',
    subtitle: '여름 세일 혜택 안내',
    channel: 'SMS',
    recipients: '5,200',
    progressLabel: '3,120 / 5,200',
    progress: 60,
    successRate: '97.8%',
    status: '진행 중',
    scheduledAt: '2026-03-23 14:00'
  },
  {
    id: 'welcome-campaign',
    name: '신규 회원 웰컴 메시지',
    subtitle: '가입 축하 알림톡',
    channel: '알림톡',
    recipients: '3,800',
    progressLabel: '3,800 / 3,800',
    progress: 100,
    successRate: '96.3%',
    status: '발송 완료',
    scheduledAt: '2026-03-20 10:00'
  },
  {
    id: 'weekly-news',
    name: '주간 뉴스레터',
    subtitle: '이번 주 업데이트 안내',
    channel: 'SMS',
    recipients: '2,100',
    progressLabel: '예약됨',
    progress: 0,
    successRate: '—',
    status: '예약됨',
    scheduledAt: '2026-03-24 09:00'
  },
  {
    id: 'may-sale-cancelled',
    name: '5월 할인 이벤트',
    subtitle: '5월 프로모션',
    channel: '알림톡',
    recipients: '1,380',
    progressLabel: '발송 취소됨',
    progress: 0,
    successRate: '—',
    status: '취소됨',
    scheduledAt: '2026-03-10 11:00'
  }
];

export const campaignRecipients = [
  {
    phone: '010-****-1234',
    name: '김○○',
    status: '성공',
    code: 'SUCCESS',
    time: '14:02:31'
  },
  {
    phone: '010-****-5678',
    name: '이○○',
    status: '성공',
    code: 'SUCCESS',
    time: '14:02:33'
  },
  {
    phone: '010-****-9012',
    name: '박○○',
    status: '실패',
    code: 'E4010',
    time: '14:02:35'
  },
  {
    phone: '010-****-7890',
    name: '정○○',
    status: '대기',
    code: '—',
    time: '—'
  }
];

export const campaignErrorSummary = [
  { code: 'E4010', label: '수신 거부', count: 42 },
  { code: 'E4020', label: '존재하지 않는 번호', count: 18 },
  { code: 'E5000', label: '기타 오류', count: 6 }
];

export function isSetupActive(status: SetupStatus) {
  return status === 'active';
}

export function canSendSms() {
  return isSetupActive(setupItems.find((item) => item.key === 'sms')?.status ?? 'missing');
}

export function canSendKakao() {
  return isSetupActive(setupItems.find((item) => item.key === 'kakao')?.status ?? 'missing');
}

export function canSendCampaign() {
  return canSendSms() || canSendKakao();
}
