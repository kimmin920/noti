type ParserStep = Record<string, unknown>;

export type PublEventPropSeed = {
  rawPath: string;
  alias: string;
  label: string;
  type: string;
  required?: boolean;
  sample?: string;
  description?: string;
  fallback?: string;
  parserPipeline?: ParserStep[];
  enabled?: boolean;
};

export type PublEventSeed = {
  catalogKey: string;
  eventKey: string;
  displayName: string;
  category: string;
  pAppCode?: string;
  pAppName?: string;
  triggerText?: string;
  detailText?: string;
  serviceStatus: 'ACTIVE' | 'INACTIVE' | 'DRAFT';
  locationType?: string;
  locationId?: string;
  sourceType?: string;
  actionType?: string;
  docsVersion: string;
  props: PublEventPropSeed[];
};

const DOCS_VERSION = 'publ-notifications-v1.0.7';

const KST_DATE_FORMAT: ParserStep[] = [
  {
    type: 'dateFormat',
    timezone: 'Asia/Seoul',
    format: 'yyyy년 M월 d일 HH:mm'
  }
];

const ORDER_ITEMS_JOIN: ParserStep[] = [
  {
    type: 'mapTemplate',
    template: '#{productName} #{serializedOptions} #{qty}개'
  },
  {
    type: 'join',
    separator: ', '
  }
];

function prop(
  rawPath: string,
  alias: string,
  label: string,
  type: string,
  sample?: string,
  options: Omit<PublEventPropSeed, 'rawPath' | 'alias' | 'label' | 'type' | 'sample'> = {}
): PublEventPropSeed {
  return {
    rawPath,
    alias,
    label,
    type,
    sample,
    ...options
  };
}

function baseProps(): PublEventPropSeed[] {
  return [
    prop('eventKey', 'eventKey', '이벤트 키', 'text', 'MEMBER_GENERAL_CHANNEL_ACCOUNT_REGISTER', {
      required: true
    }),
    prop('targetPhoneNumber', 'targetPhoneNumber', '수신자 전화번호', 'text', '010-1234-1234', {
      required: true,
      description: '문서상 가입 정보를 통해 수집된 폰 번호가 없을 경우 기록하지 않습니다.'
    }),
    prop('targetId', 'targetId', '수신자 프로필 ID', 'text', 'SUBMV6T55JAJWY4CSXT-VEDVU'),
    prop('targetName', 'targetName', '수신자 닉네임', 'text', 'publ1호팬', {
      fallback: '고객'
    }),
    prop('channelTitle', 'channelTitle', '채널 제목', 'text', 'publUniverse'),
    prop('connectedDomain', 'connectedDomain', '연결 도메인', 'text', 'universe.publ.biz'),
    prop('occuredAt', 'eventOccurredAt', '이벤트 발생일시', 'datetime', '2024-03-04T02:40:15.016Z', {
      parserPipeline: KST_DATE_FORMAT
    }),
    prop('channelId', 'channelId', '채널 ID', 'number', '23'),
    prop('channelCode', 'channelCode', '채널 코드', 'text', 'L2NoYW5uZWxzLzc3'),
    prop('locationType', 'locationType', '위치 타입', 'enum', 'P_APP'),
    prop('locationId', 'locationId', '위치 ID', 'text', 'A00001'),
    prop('locationDetail', 'locationDetail', '위치 상세', 'text', '-'),
    prop('performerType', 'performerType', '행위자 타입', 'enum', 'MEMBER'),
    prop('performerId', 'performerId', '행위자 ID', 'text', 'SUBS12341234'),
    prop('performerDetail', 'performerName', '행위자 이름', 'text', 'publ1호팬'),
    prop('sourceType', 'sourceType', '소스 타입', 'enum', 'ACCOUNT'),
    prop('sourceId', 'sourceId', '소스 ID', 'text', '32'),
    prop('sourceOwnerId', 'sourceOwnerId', '소스 소유자 ID', 'text', 'SUBMV6T55JAJWY4CSXT-VEDVU'),
    prop('sourceOwnerDetail', 'sourceOwnerName', '소스 소유자 이름', 'text', 'publ1호팬'),
    prop('subsLinkWeb', 'linkWeb', '전환 링크', 'text', '/settings/purchase/...')
  ];
}

function event(input: Omit<PublEventSeed, 'docsVersion' | 'props'> & {
  sourceAlias: string;
  sourceLabel: string;
  sourceSample: string;
  sourceRequired?: boolean;
  props?: PublEventPropSeed[];
}): PublEventSeed {
  return {
    ...input,
    docsVersion: DOCS_VERSION,
    props: [
      ...baseProps(),
      prop('sourceDetail', input.sourceAlias, input.sourceLabel, 'text', input.sourceSample, {
        required: input.sourceRequired ?? true
      }),
      ...(input.props ?? [])
    ]
  };
}

const moneyProps = (prefix: string, aliasPrefix: string, labelPrefix: string, sampleAmount = '20000') => [
  prop(`${prefix}.amount`, `${aliasPrefix}Amount`, `${labelPrefix} 금액`, 'number', sampleAmount, {
    parserPipeline: [{ type: 'currencyFormat', currencyPath: `${prefix}.currency`, locale: 'ko-KR' }]
  }),
  prop(`${prefix}.currency`, `${aliasPrefix}Currency`, `${labelPrefix} 통화`, 'text', 'KRW')
];

const orderMetaProps = () => [
  prop('sourceDetailMeta.orderId', 'orderId', '주문번호', 'text', 'O20260116'),
  prop('sourceDetailMeta.orderPackageId', 'orderPackageId', '주문 패키지 번호', 'text', 'PKG-102938'),
  prop('sourceDetailMeta.recipientName', 'recipientName', '수취인명', 'text', '홍길동'),
  prop('sourceDetailMeta.recipientSerializedPhoneNumber', 'recipientPhoneNumber', '수취인 연락처', 'text', '010-1234-5678'),
  prop('sourceDetailMeta.shippingAddress', 'shippingAddress', '배송 주소', 'text', '서울특별시 강남구 테헤란로 123'),
  prop('sourceDetailMeta.shippingMemo', 'shippingMemo', '배송 메모', 'text', '부재 시 문 앞에 놓아주세요.'),
  prop('sourceDetailMeta.totalOrderItems', 'totalOrderItems', '주문 품목 수', 'number', '1'),
  prop('sourceDetailMeta.orderItems', 'orderItemNames', '주문 상품 목록', 'array', '베이직 코튼 티셔츠 1개, 울 블렌드 머플러 2개', {
    parserPipeline: ORDER_ITEMS_JOIN
  })
];

const claimMetaProps = () => [
  prop('sourceDetailMeta.orderClaimTicketId', 'orderClaimTicketId', '취소 티켓 번호', 'text', 'C-2026-REF-01'),
  prop('sourceDetailMeta.reason', 'cancelReason', '취소 사유', 'text', '단순 변심으로 인한 취소 요청'),
  ...orderMetaProps()
];

export const PUBL_EVENT_CATALOG: PublEventSeed[] = [
  event({
    catalogKey: 'core.account.register',
    eventKey: 'MEMBER_GENERAL_CHANNEL_ACCOUNT_REGISTER',
    displayName: '회원의 채널 가입 알림',
    category: '코어 - 계정',
    triggerText: '채널에 회원 계정 가입 시 발생하는 알림입니다.',
    detailText: '채널에 회원 계정 가입 시 발생하는 알림입니다.',
    serviceStatus: 'ACTIVE',
    locationType: 'GENERAL',
    locationId: 'CHANNEL',
    sourceType: 'ACCOUNT',
    actionType: 'REGISTER',
    sourceAlias: 'memberNickname',
    sourceLabel: '회원 닉네임',
    sourceSample: 'publ1호팬'
  }),
  event({
    catalogKey: 'core.order.create',
    eventKey: 'MEMBER_GENERAL_CHANNEL_ORDER_CREATE',
    displayName: '회원의 채널 내 상품 결제',
    category: '코어 - 주문 / 환불',
    triggerText: '채널에서 회원이 결제 시 발생',
    detailText: '채널에 회원이 상품 결제 시 발생하는 알림입니다.',
    serviceStatus: 'ACTIVE',
    locationType: 'GENERAL',
    locationId: 'CHANNEL',
    sourceType: 'ORDER',
    actionType: 'CREATE',
    sourceAlias: 'productName',
    sourceLabel: '상품명',
    sourceSample: '신규환영패키지',
    props: [
      prop('sourceDetailMeta.priceAmount', 'priceAmount', '결제 금액', 'number', '20000', {
        parserPipeline: [{ type: 'currencyFormat', currencyPath: 'sourceDetailMeta.priceCurrency', locale: 'ko-KR' }]
      }),
      prop('sourceDetailMeta.priceCurrency', 'priceCurrency', '결제 통화', 'text', 'KRW')
    ]
  }),
  event({
    catalogKey: 'core.refund.accept',
    eventKey: 'SYSTEM_GENERAL_CHANNEL_REFUND_REQUEST_ACCEPT',
    displayName: '채널 내 환불 승인',
    category: '코어 - 주문 / 환불',
    triggerText: '채널에서 회원이 주문한 상품의 환불 성공 시 발생',
    detailText: '채널에 회원이 구매한 상품의 환불이 성공했을 시 발생하는 알림입니다.',
    serviceStatus: 'ACTIVE',
    locationType: 'GENERAL',
    locationId: 'CHANNEL',
    sourceType: 'REFUND_REQUEST',
    actionType: 'ACCEPT',
    sourceAlias: 'refundProductName',
    sourceLabel: '환불 상품명',
    sourceSample: '신규환영패키지',
    props: [
      prop('sourceDetailMeta.requestAmount', 'refundRequestAmount', '환불 요청 금액', 'number', '20000', {
        parserPipeline: [{ type: 'currencyFormat', currencyPath: 'sourceDetailMeta.requestAmountCurrency', locale: 'ko-KR' }]
      }),
      prop('sourceDetailMeta.requestAmountCurrency', 'refundRequestCurrency', '환불 요청 통화', 'text', 'KRW')
    ]
  }),
  event({
    catalogKey: 'core.coupon.reward',
    eventKey: 'SYSTEM_GENERAL_CHANNEL_COUPON_REWARD',
    displayName: '프로모션 지급 혜택의 쿠폰 지급 알림',
    category: '코어 - 프로모션',
    triggerText: '프로모션 지급 혜택의 실행 트리거에 의해 특정 조건을 만족하는 회원에게 쿠폰 지급 시 발생하는 알림입니다.',
    detailText: '회원이 특정 액션을 수행하여 쿠폰이 지급되었을 때 발생하는 알림입니다.',
    serviceStatus: 'ACTIVE',
    locationType: 'GENERAL',
    locationId: 'CHANNEL',
    sourceType: 'COUPON',
    actionType: 'REWARD',
    sourceAlias: 'couponName',
    sourceLabel: '쿠폰명',
    sourceSample: '신규 가입자 대상 할인 쿠폰',
    props: [
      prop('sourceDetailMeta.expiresAt', 'couponExpiresAt', '쿠폰 유효기간', 'text', '2025-09-17(수) 23:59까지')
    ]
  }),
  event({
    catalogKey: 'timeline.post.create',
    eventKey: 'SELLER_P_APP_A00001_POST_CREATE',
    displayName: '셀러의 게시글 생성 알림',
    category: '타임라인 pApp',
    pAppCode: 'A00001',
    pAppName: '타임라인 pApp',
    triggerText: '셀러가 타임라인 pApp에서 게시글 생성 시 발생하는 이벤트입니다.',
    detailText: '타임라인 pApp에서 셀러가 게시글을 생성할 시, 회원에게 전송되는 알림 이벤트입니다.',
    serviceStatus: 'ACTIVE',
    locationType: 'P_APP',
    locationId: 'A00001',
    sourceType: 'POST',
    actionType: 'CREATE',
    sourceAlias: 'postPreview',
    sourceLabel: '게시글 미리보기',
    sourceSample: '안녕하세요, 여러분'
  }),
  event({
    catalogKey: 'notice.post.create',
    eventKey: 'SELLER_P_APP_A00002_POST_CREATE',
    displayName: '셀러의 게시글 생성 알림',
    category: '공지사항 pApp',
    pAppCode: 'A00002',
    pAppName: '공지사항 pApp',
    triggerText: '셀러가 공지사항 pApp에서 게시글 생성 시 발생하는 이벤트입니다.',
    detailText: '공지사항 pApp에서 셀러가 게시글을 생성할 시, 회원에게 전송되는 알림 이벤트입니다.',
    serviceStatus: 'ACTIVE',
    locationType: 'P_APP',
    locationId: 'A00002',
    sourceType: 'POST',
    actionType: 'CREATE',
    sourceAlias: 'noticeTitle',
    sourceLabel: '공지사항 제목',
    sourceSample: '[공지] 2월 이벤트 안내'
  }),
  event({
    catalogKey: 'board.post.create',
    eventKey: 'SELLER_P_APP_A00003_POST_CREATE',
    displayName: '셀러의 게시글 생성 알림',
    category: '자유게시판 pApp',
    pAppCode: 'A00003',
    pAppName: '자유게시판 pApp',
    triggerText: '셀러가 자유게시판 pApp에서 게시글 생성 시 발생하는 이벤트입니다.',
    detailText: '자유게시판 pApp에서 셀러가 게시글을 생성할 시, 회원에게 전송되는 알림 이벤트입니다.',
    serviceStatus: 'ACTIVE',
    locationType: 'P_APP',
    locationId: 'A00003',
    sourceType: 'POST',
    actionType: 'CREATE',
    sourceAlias: 'postTitle',
    sourceLabel: '게시글 제목',
    sourceSample: '반가워요 자게 여러분'
  }),
  event({
    catalogKey: 'class.notice.general.create',
    eventKey: 'SELLER_P_APP_C00007_NOTICE_POST_CREATE_GENERAL',
    displayName: '클래스 공지사항 게시글 생성 알림',
    category: '강의 pApp',
    pAppCode: 'C00007',
    pAppName: '강의 pApp',
    triggerText: '셀러가 클래스 공지사항에서 게시글 생성 시 발생하는 이벤트입니다.',
    detailText: '클래스 공지사항에서 셀러가 게시글을 생성할 시, 회원에게 전송되는 알림 이벤트입니다.',
    serviceStatus: 'ACTIVE',
    locationType: 'P_APP',
    locationId: 'C00007',
    sourceType: 'NOTICE_POST',
    actionType: 'CREATE',
    sourceAlias: 'classNoticeTitle',
    sourceLabel: '클래스 공지 제목',
    sourceSample: '쿠킹 클래스 콘텐츠 업데이트 안내',
    props: [
      prop('sourceDetailMeta.subscriberDistinctId', 'subscriberDistinctId', '수강생 프로필 ID', 'text', 'SUB45674567'),
      prop('parentSourceId', 'classId', '클래스 ID', 'number', '12'),
      prop('parentSourceDetail', 'classTitle', '클래스 제목', 'text', '5분안에 배우는 쿠킹 클래스')
    ]
  }),
  event({
    catalogKey: 'class.notice.student.create',
    eventKey: 'SELLER_P_APP_C00007_NOTICE_POST_CREATE_FOR_STUDENT',
    displayName: '클래스 수강생 전용 공지사항 게시글 생성 알림',
    category: '강의 pApp',
    pAppCode: 'C00007',
    pAppName: '강의 pApp',
    triggerText: '셀러가 수강생 전용 클래스 공지사항에서 게시글 생성 시 발생하는 이벤트입니다.',
    detailText: '수강생 전용 클래스 공지사항에서 셀러가 게시글을 생성할 시, 회원에게 전송되는 알림 이벤트입니다.',
    serviceStatus: 'ACTIVE',
    locationType: 'P_APP',
    locationId: 'C00007',
    sourceType: 'NOTICE_POST',
    actionType: 'CREATE',
    sourceAlias: 'studentNoticeTitle',
    sourceLabel: '수강생 공지 제목',
    sourceSample: '쿠킹 클래스 수강생 전용 콘텐츠 업로드 일정',
    props: [
      prop('parentSourceId', 'classId', '클래스 ID', 'number', '12'),
      prop('parentSourceDetail', 'classTitle', '클래스 제목', 'text', '5분안에 배우는 쿠킹 클래스')
    ]
  }),
  event({
    catalogKey: 'class.session.drawNear',
    eventKey: 'SYSTEM_P_APP_C00007_SESSION_DRAW_NEAR_TO_TIME',
    displayName: '코칭 세션 시작 임박 알림',
    category: '강의 pApp',
    pAppCode: 'C00007',
    pAppName: '강의 pApp',
    triggerText: '클래스 내 코칭 세션의 시작 시간이 임박할 시',
    detailText: '클래스에 코칭 세션이 포함된 경우, 코칭 세션의 시작 임박 알림을 최대 15분 전에 전송합니다.',
    serviceStatus: 'ACTIVE',
    locationType: 'P_APP',
    locationId: 'C00007',
    sourceType: 'SESSION',
    actionType: 'DRAW_NEAR_TO_TIME',
    sourceAlias: 'sessionTitle',
    sourceLabel: '세션 제목',
    sourceSample: '쿠킹 실시간 화상 Zoom 강의',
    props: [
      prop('sourceDetailMeta.occuredAt', 'sessionStartAt', '세션 시작일시', 'datetime', '2024-06-01T00:02:01', {
        parserPipeline: KST_DATE_FORMAT
      }),
      prop('parentSourceDetail', 'classTitle', '클래스 제목', 'text', '5분안에 배우는 쿠킹 클래스')
    ]
  }),
  event({
    catalogKey: 'class.session.arrival',
    eventKey: 'SYSTEM_P_APP_C00007_SESSION_ARRIVAL_OF_TIME',
    displayName: '코칭 세션 시작 알림',
    category: '강의 pApp',
    pAppCode: 'C00007',
    pAppName: '강의 pApp',
    triggerText: '클래스 내 코칭 세션의 시작 시간이 도래할 시',
    detailText: '클래스에 코칭 세션이 포함된 경우, 코칭 세션의 시작 알림을 전송합니다.',
    serviceStatus: 'ACTIVE',
    locationType: 'P_APP',
    locationId: 'C00007',
    sourceType: 'SESSION',
    actionType: 'ARRIVAL_OF_TIME',
    sourceAlias: 'sessionTitle',
    sourceLabel: '세션 제목',
    sourceSample: '쿠킹 실시간 화상 Zoom 강의',
    props: [
      prop('sourceDetailMeta.occuredAt', 'sessionStartAt', '세션 시작일시', 'datetime', '2024-06-01T00:02:01', {
        parserPipeline: KST_DATE_FORMAT
      }),
      prop('parentSourceDetail', 'classTitle', '클래스 제목', 'text', '5분안에 배우는 쿠킹 클래스')
    ]
  }),
  event({
    catalogKey: 'booking.schedule.book',
    eventKey: 'MEMBER_P_APP_E00001_SCHEDULE_BOOK',
    displayName: '예약 완료 알림',
    category: '상담 예약 pApp',
    pAppCode: 'E00001',
    pAppName: '상담 예약 pApp',
    triggerText: '회원이 예약을 완료했을 때 발생하는 이벤트입니다.',
    detailText: '회원이 예약을 완료했을 때 발생하는 이벤트입니다.',
    serviceStatus: 'ACTIVE',
    locationType: 'P_APP',
    locationId: 'E00001',
    sourceType: 'SCHEDULE',
    actionType: 'BOOK',
    sourceAlias: 'scheduleTitle',
    sourceLabel: '예약 일정명',
    sourceSample: '[청소년 심리상담] - 오은영쌤 60분',
    props: [
      prop('sourceDetailMeta.occurredAt', 'scheduleStartAt', '예약 시작일시', 'datetime', '2024-05-07T00:00:000Z', {
        required: true,
        parserPipeline: KST_DATE_FORMAT
      })
    ]
  }),
  event({
    catalogKey: 'booking.schedule.cancel',
    eventKey: 'MEMBER_P_APP_E00001_SCHEDULE_BOOK_CANCELED',
    displayName: '예약 취소 알림',
    category: '상담 예약 pApp',
    pAppCode: 'E00001',
    pAppName: '상담 예약 pApp',
    triggerText: '회원이 예약을 취소했을 때 발생하는 이벤트입니다.',
    detailText: '회원이 예약을 취소했을 때 발생하는 이벤트입니다.',
    serviceStatus: 'ACTIVE',
    locationType: 'P_APP',
    locationId: 'E00001',
    sourceType: 'SCHEDULE',
    actionType: 'BOOK_CANCELED',
    sourceAlias: 'scheduleTitle',
    sourceLabel: '예약 일정명',
    sourceSample: '[청소년 심리상담] - 오은영쌤 60분',
    props: [
      prop('sourceDetailMeta.occurredAt', 'scheduleStartAt', '예약 시작일시', 'datetime', '2024-05-07T00:00:000Z', {
        parserPipeline: KST_DATE_FORMAT
      })
    ]
  }),
  event({
    catalogKey: 'booking.schedule.drawNear',
    eventKey: 'SYSTEM_P_APP_E00001_SCHEDULE_DRAW_NEAR_TO_TIME',
    displayName: '예약 일정 시작 임박 알림',
    category: '상담 예약 pApp',
    pAppCode: 'E00001',
    pAppName: '상담 예약 pApp',
    triggerText: '회원이 예약한 일정의 시작 시간 15분 전에 발생하는 이벤트입니다.',
    detailText: '일정 시작 시간으로부터 15분 전에 생성됩니다.',
    serviceStatus: 'ACTIVE',
    locationType: 'P_APP',
    locationId: 'E00001',
    sourceType: 'SCHEDULE',
    actionType: 'DRAW_NEAR_TO_TIME',
    sourceAlias: 'scheduleTitle',
    sourceLabel: '예약 일정명',
    sourceSample: '[청소년 심리상담] - 오은영쌤 60분',
    props: [
      prop('sourceDetailMeta.occurredAt', 'scheduleStartAt', '예약 시작일시', 'datetime', '2024-05-07T00:00:000Z', {
        required: true,
        parserPipeline: KST_DATE_FORMAT
      })
    ]
  }),
  event({
    catalogKey: 'booking.schedule.arrival',
    eventKey: 'SYSTEM_P_APP_E00001_SCHEDULE_ARRIVAL_OF_TIME',
    displayName: '예약 일정 시작 알림',
    category: '상담 예약 pApp',
    pAppCode: 'E00001',
    pAppName: '상담 예약 pApp',
    triggerText: '회원이 예약한 일정의 시작 시간에 발생하는 이벤트입니다.',
    detailText: '회원이 예약한 일정의 시작 시간이 도래했을 때 발생하는 이벤트입니다.',
    serviceStatus: 'ACTIVE',
    locationType: 'P_APP',
    locationId: 'E00001',
    sourceType: 'SCHEDULE',
    actionType: 'ARRIVAL_OF_TIME',
    sourceAlias: 'scheduleTitle',
    sourceLabel: '예약 일정명',
    sourceSample: '[청소년 심리상담] - 오은영쌤 60분',
    props: [
      prop('sourceDetailMeta.occurredAt', 'scheduleStartAt', '예약 시작일시', 'datetime', '2024-05-07T00:00:000Z', {
        required: true,
        parserPipeline: KST_DATE_FORMAT
      })
    ]
  }),
  event({
    catalogKey: 'booking.schedule.delete',
    eventKey: 'SELLER_P_APP_E00001_SCHEDULE_DELETE',
    displayName: '예약 일정 삭제 알림',
    category: '상담 예약 pApp',
    pAppCode: 'E00001',
    pAppName: '상담 예약 pApp',
    triggerText: '회원이 예약한 일정이 셀러에 의해 삭제되었을 때에 발생하는 이벤트입니다.',
    detailText: '해당 일정이 셀러에 의해 삭제된 경우, 기존 예약자였던 회원에게 알려주기 위한 알림 이벤트가 생성됩니다.',
    serviceStatus: 'ACTIVE',
    locationType: 'P_APP',
    locationId: 'E00001',
    sourceType: 'SCHEDULE',
    actionType: 'DELETE',
    sourceAlias: 'scheduleTitle',
    sourceLabel: '예약 일정명',
    sourceSample: '[청소년 심리상담] - 오은영쌤 60분',
    props: [
      prop('sourceDetailMeta.occurredAt', 'scheduleStartAt', '예약 시작일시', 'datetime', '2024-05-07T00:00:000Z', {
        parserPipeline: KST_DATE_FORMAT
      })
    ]
  }),
  event({
    catalogKey: 'messenger.member.message',
    eventKey: 'MEMBER_P_APP_D00003_CHATROOM_MSG_OCCURED',
    displayName: '채팅방 새로운 메세지 알림 - 회원의 메세지',
    category: '메신저 pApp',
    pAppCode: 'D00003',
    pAppName: '메신저 pApp',
    triggerText: '채팅방에 회원으로부터 새로운 메세지가 발송되었을 때',
    detailText: '회원이 채팅방에 메세지를 작성한 경우, 해당 채팅방에 속하며 알림을 구독 중인 모든 회원들에게 알림이 발송됩니다.',
    serviceStatus: 'ACTIVE',
    locationType: 'P_APP',
    locationId: 'D00003',
    sourceType: 'CHATROOM_MSG',
    actionType: 'MSG_OCCURED',
    sourceAlias: 'chatMessage',
    sourceLabel: '채팅 메시지',
    sourceSample: '신입입니다. 반가워요'
  }),
  event({
    catalogKey: 'messenger.seller.message',
    eventKey: 'SELLER_P_APP_D00003_CHATROOM_MSG_OCCURED',
    displayName: '채팅방 새로운 메세지 알림 - 셀러의 메세지',
    category: '메신저 pApp',
    pAppCode: 'D00003',
    pAppName: '메신저 pApp',
    triggerText: '채팅방에 셀러로부터 새로운 메세지가 발송되었을 때',
    detailText: '셀러가 채팅방에 메세지를 작성한 경우, 해당 채팅방에 속하며 알림을 구독 중인 모든 회원들에게 알림이 발송됩니다.',
    serviceStatus: 'ACTIVE',
    locationType: 'P_APP',
    locationId: 'D00003',
    sourceType: 'CHATROOM_MSG',
    actionType: 'MSG_OCCURED',
    sourceAlias: 'chatMessage',
    sourceLabel: '채팅 메시지',
    sourceSample: '반가워요 신입님'
  }),
  event({
    catalogKey: 'ticket.schedule.book',
    eventKey: 'MEMBER_P_APP_E00002_SCHEDULE_BOOK',
    displayName: '티켓 구매 완료 알림',
    category: '티켓 pApp',
    pAppCode: 'E00002',
    pAppName: '티켓 pApp',
    triggerText: '회원이 티켓을 구매했을 때',
    detailText: '회원이 티켓을 예매한 경우 발생하는 알림 이벤트입니다.',
    serviceStatus: 'ACTIVE',
    locationType: 'P_APP',
    locationId: 'E00002',
    sourceType: 'SCHEDULE',
    actionType: 'BOOK',
    sourceAlias: 'scheduleTitle',
    sourceLabel: '스케줄 제목',
    sourceSample: '레베카 1회차',
    props: [
      prop('sourceDetailMeta.reservationId', 'reservationId', '예매번호', 'text', 'TMPSI1234'),
      prop('sourceDetailMeta.reservedItemCount', 'reservedItemCount', '구매 좌석 수', 'number', '9'),
      prop('sourceDetailMeta.scheduledAt', 'scheduledAt', '공연 시작일시', 'datetime', '2024-05-01T02:00:000Z', {
        parserPipeline: KST_DATE_FORMAT
      }),
      ...moneyProps('sourceDetailMeta.finalPrice', 'finalPrice', '최종 결제'),
      prop('parentSourceDetail', 'eventScheduleTitle', '이벤트-스케줄 제목', 'text', '레베카 - 레베카 1회차 공연')
    ]
  }),
  event({
    catalogKey: 'ticket.schedule.memberCancel',
    eventKey: 'MEMBER_P_APP_E00002_SCHEDULE_BOOK_CANCELED',
    displayName: '회원에 의한 티켓 예매 취소',
    category: '티켓 pApp',
    pAppCode: 'E00002',
    pAppName: '티켓 pApp',
    triggerText: '회원이 예매한 티켓을 취소했을 때',
    detailText: '회원이 자신이 예매한 티켓을 취소한 경우 발생하는 알림 이벤트입니다.',
    serviceStatus: 'ACTIVE',
    locationType: 'P_APP',
    locationId: 'E00002',
    sourceType: 'SCHEDULE',
    actionType: 'BOOK_CANCELED',
    sourceAlias: 'scheduleTitle',
    sourceLabel: '스케줄 제목',
    sourceSample: '레베카 1회차',
    props: [
      prop('sourceDetailMeta.reservationId', 'reservationId', '예매번호', 'text', 'TMPSI1234'),
      prop('sourceDetailMeta.reservedItemCount', 'reservedItemCount', '구매 좌석 수', 'number', '9'),
      prop('sourceDetailMeta.scheduledAt', 'scheduledAt', '공연 시작일시', 'datetime', '2024-05-01T02:00:000Z', {
        parserPipeline: KST_DATE_FORMAT
      }),
      ...moneyProps('sourceDetailMeta.finalPrice', 'finalPrice', '최종 결제'),
      prop('parentSourceDetail', 'eventScheduleTitle', '이벤트-스케줄 제목', 'text', '레베카 - 레베카 1회차 공연')
    ]
  }),
  event({
    catalogKey: 'ticket.schedule.sellerCancel',
    eventKey: 'SELLER_P_APP_E00002_SCHEDULE_BOOK_CANCELED',
    displayName: '사업자에 의한 티켓 예매 취소',
    category: '티켓 pApp',
    pAppCode: 'E00002',
    pAppName: '티켓 pApp',
    triggerText: '사업자가 회원이 예매한 티켓을 취소했을 때',
    detailText: '사업자가 회원이 예매한 티켓을 취소한 경우 발생하는 알림 이벤트입니다.',
    serviceStatus: 'ACTIVE',
    locationType: 'P_APP',
    locationId: 'E00002',
    sourceType: 'SCHEDULE',
    actionType: 'BOOK_CANCELED',
    sourceAlias: 'scheduleTitle',
    sourceLabel: '스케줄 제목',
    sourceSample: '레베카 1회차',
    props: [
      prop('sourceDetailMeta.reservationId', 'reservationId', '예매번호', 'text', 'TMPSI1234'),
      prop('sourceDetailMeta.reservedItemCount', 'reservedItemCount', '구매 좌석 수', 'number', '9'),
      prop('sourceDetailMeta.scheduledAt', 'scheduledAt', '공연 시작일시', 'datetime', '2024-05-01T02:00:000Z', {
        parserPipeline: KST_DATE_FORMAT
      }),
      ...moneyProps('sourceDetailMeta.finalPrice', 'finalPrice', '최종 결제'),
      prop('parentSourceDetail', 'eventScheduleTitle', '이벤트-스케줄 제목', 'text', '레베카 - 레베카 1회차 공연')
    ]
  }),
  event({
    catalogKey: 'commerce.order.create',
    eventKey: 'MEMBER_P_APP_X00004_ORDER_CREATE',
    displayName: '구매자의 상품 주문',
    category: '커머스 pApp',
    pAppCode: 'X00004',
    pAppName: '커머스 pApp',
    triggerText: '구매자가 상품 주문을 완료했을 때',
    detailText: '구매자가 주문 결제를 완료했을 때 발생하는 이벤트입니다.',
    serviceStatus: 'INACTIVE',
    locationType: 'P_APP',
    locationId: 'X00004',
    sourceType: 'ORDER',
    actionType: 'CREATE',
    sourceAlias: 'firstProductName',
    sourceLabel: '첫 번째 상품명',
    sourceSample: '핑크퐁 무지개 장갑',
    props: [
      ...moneyProps('sourceDetailMeta.purchasePrice', 'purchasePrice', '총 주문'),
      prop('sourceDetailMeta.ordererName', 'ordererName', '주문자 이름', 'text', '홍길동'),
      prop('sourceDetailMeta.ordererSerializePhoneNumber', 'ordererPhoneNumber', '주문자 연락처', 'text', '01012341234'),
      ...orderMetaProps()
    ]
  }),
  event({
    catalogKey: 'commerce.package.preparing',
    eventKey: 'SELLER_P_APP_X00004_ORDER_PACKAGE_UPDATE_TO_PREPARING',
    displayName: '주문 상태 변경 - 상품 준비 중',
    category: '커머스 pApp',
    pAppCode: 'X00004',
    pAppName: '커머스 pApp',
    triggerText: '셀러가 주문 품목 상태를 상품 준비 중으로 변경했을 때',
    detailText: '구매자의 주문 품목이 상품 준비 중 상태로 변경되었음을 알리는 이벤트입니다.',
    serviceStatus: 'INACTIVE',
    locationType: 'P_APP',
    locationId: 'X00004',
    sourceType: 'ORDER_PACKAGE',
    actionType: 'UPDATE_TO_PREPARING',
    sourceAlias: 'orderPackageProductName',
    sourceLabel: '주문 품목 상품명',
    sourceSample: '핑크퐁 무지개 장갑',
    props: orderMetaProps()
  }),
  event({
    catalogKey: 'commerce.package.shipping',
    eventKey: 'SELLER_P_APP_X00004_ORDER_PACKAGE_UPDATE_TO_SHIPPING',
    displayName: '주문 상태 변경 - 배송 중',
    category: '커머스 pApp',
    pAppCode: 'X00004',
    pAppName: '커머스 pApp',
    triggerText: '셀러가 주문 품목 상태를 배송 중으로 변경했을 때',
    detailText: '구매자의 주문 품목이 배송 중 상태로 변경되었음을 알리는 이벤트입니다.',
    serviceStatus: 'INACTIVE',
    locationType: 'P_APP',
    locationId: 'X00004',
    sourceType: 'ORDER_PACKAGE',
    actionType: 'UPDATE_TO_SHIPPING',
    sourceAlias: 'shippingProductName',
    sourceLabel: '배송 상품명',
    sourceSample: '핑크퐁 무지개 장갑',
    props: [
      prop('sourceDetailMeta.trackingNumber', 'trackingNumber', '송장번호', 'text', '680499123456'),
      ...orderMetaProps()
    ]
  }),
  event({
    catalogKey: 'commerce.package.delivered',
    eventKey: 'SELLER_P_APP_X00004_ORDER_PACKAGE_UPDATE_TO_DELIVERED',
    displayName: '주문 상태 변경 - 배송 완료',
    category: '커머스 pApp',
    pAppCode: 'X00004',
    pAppName: '커머스 pApp',
    triggerText: '셀러/시스템이 주문 품목 상태를 배송 완료로 변경했을 때',
    detailText: '구매자의 주문 품목이 배송 완료 상태로 변경되었음을 알리는 이벤트입니다.',
    serviceStatus: 'INACTIVE',
    locationType: 'P_APP',
    locationId: 'X00004',
    sourceType: 'ORDER_PACKAGE',
    actionType: 'UPDATE_TO_DELIVERED',
    sourceAlias: 'deliveredProductName',
    sourceLabel: '배송 완료 상품명',
    sourceSample: '핑크퐁 무지개 장갑',
    props: [
      prop('sourceDetailMeta.trackingNumber', 'trackingNumber', '송장번호', 'text', '580312345678'),
      ...orderMetaProps()
    ]
  }),
  event({
    catalogKey: 'commerce.order.autoCancellation',
    eventKey: 'SELLER_P_APP_X00004_ORDER_TRIGGER_AUTO_CANCELLATION',
    displayName: '주문 실패로 인한 자동 취소 및 환불',
    category: '커머스 pApp',
    pAppCode: 'X00004',
    pAppName: '커머스 pApp',
    triggerText: '재고 부족 등의 사유로 주문이 실패할 시',
    detailText: '재고 부족 등의 사유로 주문이 실패할 시 자동 취소 및 환불되는 이벤트입니다.',
    serviceStatus: 'INACTIVE',
    locationType: 'P_APP',
    locationId: 'X00004',
    sourceType: 'ORDER',
    actionType: 'TRIGGER_AUTO_CANCELLATION',
    sourceAlias: 'cancelledProductName',
    sourceLabel: '자동 취소 상품명',
    sourceSample: '핑크퐁 무지개 장갑',
    props: [
      ...moneyProps('sourceDetailMeta.purchasePrice', 'purchasePrice', '주문'),
      ...moneyProps('sourceDetailMeta.refundedTotal', 'refundedTotal', '환불'),
      ...claimMetaProps()
    ]
  }),
  event({
    catalogKey: 'commerce.order.directCancel',
    eventKey: 'SELLER_P_APP_X00004_ORDER_PERFORM_DIRECT_CANCEL',
    displayName: '셀러의 주문 상품 직권 취소',
    category: '커머스 pApp',
    pAppCode: 'X00004',
    pAppName: '커머스 pApp',
    triggerText: '셀러가 상품 주문을 직권으로 취소했을 때',
    detailText: '셀러가 구매자의 주문을 직권으로 취소했을 때 발생하는 이벤트입니다.',
    serviceStatus: 'INACTIVE',
    locationType: 'P_APP',
    locationId: 'X00004',
    sourceType: 'ORDER_CLAIM_TICKET',
    actionType: 'PERFORM_DIRECT_CANCEL',
    sourceAlias: 'directCancelProductName',
    sourceLabel: '직권 취소 상품명',
    sourceSample: '핑크퐁 무지개 장갑',
    props: [
      ...moneyProps('sourceDetailMeta.refundedTotal', 'refundedTotal', '환불'),
      ...moneyProps('sourceDetailMeta.previousBalance', 'previousBalance', '취소 이전 잔여'),
      ...moneyProps('sourceDetailMeta.balance', 'balance', '주문 잔여'),
      ...moneyProps('sourceDetailMeta.purchasePrice', 'purchasePrice', '구매'),
      ...claimMetaProps()
    ]
  }),
  event({
    catalogKey: 'commerce.claim.requestCancellation',
    eventKey: 'MEMBER_P_APP_X00004_ORDER_CLAIM_TICKET_REQUEST_CANCELLATION',
    displayName: '구매자의 취소 요청',
    category: '커머스 pApp',
    pAppCode: 'X00004',
    pAppName: '커머스 pApp',
    triggerText: '구매자가 주문 취소를 요청했을 때',
    detailText: '구매자가 주문 취소를 요청했을 때 발생하는 이벤트입니다.',
    serviceStatus: 'INACTIVE',
    locationType: 'P_APP',
    locationId: 'X00004',
    sourceType: 'ORDER_CLAIM_TICKET',
    actionType: 'REQUEST_CANCELLATION',
    sourceAlias: 'cancelRequestProductName',
    sourceLabel: '취소 요청 상품명',
    sourceSample: '핑크퐁 무지개 장갑',
    props: [
      ...moneyProps('sourceDetailMeta.cancelRequestedTotal', 'cancelRequestedTotal', '취소 요청'),
      ...claimMetaProps()
    ]
  }),
  event({
    catalogKey: 'commerce.claim.approveCancellation',
    eventKey: 'SELLER_P_APP_X00004_ORDER_CLAIM_TICKET_APPROVE_CANCELLATION',
    displayName: '셀러의 주문 취소 요청 승인',
    category: '커머스 pApp',
    pAppCode: 'X00004',
    pAppName: '커머스 pApp',
    triggerText: '셀러가 주문 취소 요청을 승인함',
    detailText: '셀러가 주문 취소 요청을 승인했을 때 발생하는 이벤트입니다.',
    serviceStatus: 'INACTIVE',
    locationType: 'P_APP',
    locationId: 'X00004',
    sourceType: 'ORDER_CLAIM_TICKET',
    actionType: 'APPROVE_CANCELLATION',
    sourceAlias: 'approvedCancelProductName',
    sourceLabel: '취소 승인 상품명',
    sourceSample: '핑크퐁 무지개 장갑',
    props: [
      ...moneyProps('sourceDetailMeta.refundedTotal', 'refundedTotal', '환불'),
      ...moneyProps('sourceDetailMeta.previousBalance', 'previousBalance', '취소 이전 잔여'),
      ...moneyProps('sourceDetailMeta.balance', 'balance', '주문 잔여'),
      ...claimMetaProps()
    ]
  }),
  event({
    catalogKey: 'commerce.claim.rejectCancellation',
    eventKey: 'SELLER_P_APP_X00004_ORDER_CLAIM_TICKET_REJECT_CANCELLATION',
    displayName: '셀러의 주문 취소 요청 거절',
    category: '커머스 pApp',
    pAppCode: 'X00004',
    pAppName: '커머스 pApp',
    triggerText: '셀러가 주문 취소 요청을 거절함',
    detailText: '셀러가 주문 취소 요청을 거절했을 때 발생하는 이벤트입니다.',
    serviceStatus: 'INACTIVE',
    locationType: 'P_APP',
    locationId: 'X00004',
    sourceType: 'ORDER_CLAIM_TICKET',
    actionType: 'REJECT_CANCELLATION',
    sourceAlias: 'rejectedCancelProductName',
    sourceLabel: '취소 거절 상품명',
    sourceSample: '핑크퐁 무지개 장갑',
    props: [
      ...moneyProps('sourceDetailMeta.cancelRequestedTotal', 'cancelRequestedTotal', '취소 요청'),
      prop('sourceDetailMeta.rejectionReason', 'rejectionReason', '취소 거절 사유', 'text', '이미 배송 절차가 시작되어 취소가 불가합니다.'),
      ...claimMetaProps()
    ]
  })
];
