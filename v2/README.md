# V2 Planning Notes

Updated: 2026-03-25
Status: Implementation started in staged rollout

이 문서는 V2 개발을 바로 시작하기 전에, 현재까지 대화에서 나온 요구사항과 코드베이스 분석 결과를 정리해 두는 작업 문서다.

현재는 V2 서버 작업을 단계별로 시작했고, 각 단계 종료 시 사용자 확인을 받은 뒤 다음 단계로 진행한다.
상세 서버 설계와 단계별 진행 계획은 `v2/server-v2-plan.md`에 정리한다.
배포와 릴리즈 체크리스트는 `v2/deployment-checklist.md`에 정리한다.

## 1. V2 목표

### 1-1. 배포와 운영을 더 쉽게

- `local(machine) / dev / prod` 환경 관리가 쉬워야 한다.
- 배포 체크리스트가 반드시 있어야 한다.
- 운영 로그를 한 곳에서 보기 쉽게 정리해야 한다.
- 헬스체크 상태를 운영 페이지에서 초록/빨강 형태로 직관적으로 볼 수 있으면 좋다.

### 1-2. 서버 구조를 더 단순하게

- 메시징은 모두 NHN API를 사용한다.
- 현재 단건 이벤트 발송에서 Redis를 타는 구조가 꼭 필요한지 재검토한다.
- 가능하면 불필요한 프로세스/컴포넌트를 줄인다.

### 1-3. 프론트 로딩 구조 개선

- route별로 필요한 데이터만 fetch 하도록 나눈다.
- 특히 보내기 화면에서는 선제적으로 readiness만 확인하고, 조건이 안 되면 나머지 무거운 fetch는 하지 않는다.
- dashboard는 dashboard 화면 전용 API로 필요한 요약 데이터만 받는 방향을 우선 검토한다.

## 2. 현재 구조 요약

현재 저장소는 모노레포 구조다.

- `apps/api`: NestJS API
- `apps/admin`: Next.js admin UI
- `apps/worker`: BullMQ worker
- `apps/poller`: delivery result poller
- `packages/database`: Prisma schema/migrations
- `packages/shared`: 공용 유틸

현재는 대략 다음과 같은 흐름이 섞여 있다.

- 단건 발송: `API -> Redis/BullMQ -> worker -> NHN`
- 단건 결과 조회: `poller -> NHN 조회`
- 대량 발송: `API -> NHN 직접 호출`

즉, 단건/대량 발송 전략이 서로 다르고, 비동기 처리 경계도 일관되지 않다.

## 3. 현재 코드에서 확인한 주요 문제

### 3-1. 메시징 흐름이 일관되지 않음

- 단건 메시지는 큐를 타지만 대량 SMS/대량 알림톡은 API에서 바로 NHN을 호출한다.
- `QueueService`에는 bulk enqueue 메서드가 있으나 실제 bulk service에서는 이를 사용하지 않는다.
- 결과적으로 재시도, 실패 처리, 추적 방식이 단건과 대량에서 다르다.

### 3-2. 저장과 enqueue가 분리되어 있음

- 단건 요청은 `messageRequest`를 저장한 뒤 queue enqueue를 별도로 수행한다.
- 이 구조에서는 DB 저장은 성공했지만 enqueue가 실패하면 `ACCEPTED` 상태의 고립 요청이 생길 수 있다.

### 3-3. 헬스체크가 너무 얕음

- 현재 `/health`는 단순히 `status: ok`와 시간만 반환한다.
- DB 연결 상태, dispatcher/worker heartbeat, poll backlog, NHN 설정 유효성 같은 운영 핵심 신호를 확인할 수 없다.

### 3-4. 운영 로그가 구조화되어 있지 않음

- worker/poller/API에서 `console.log`와 `console.error` 중심으로 로그를 남긴다.
- correlation id 중심 추적이 약하다.
- 인증부 일부는 헤더/쿠키까지 로그에 남기고 있어 민감 정보 관리 측면에서 좋지 않다.

### 3-5. 환경 관리가 혼란스러움

- `.env.example`에 Google OAuth 관련 블록이 중복되어 있다.
- Docker Compose의 admin은 로컬 API가 아니라 외부 URL을 바라보도록 잡혀 있다.
- local/dev/prod 환경별 설정 책임이 명확히 정리되어 있지 않다.

### 3-6. 컨테이너 시작 시 seed 자동 실행

- 현재 API 시작 스크립트에서 migrate 이후 seed까지 자동 실행한다.
- 데모/로컬에는 편하지만 운영 안전성 관점에서는 분리하는 편이 낫다.

### 3-7. 테스트 기준선도 일부 흔들림

- `npm test` 기준으로 1개 테스트가 실패했다.
- 원인은 예약 발송 테스트가 고정된 미래 시간을 사용하다가, 현재 날짜 기준으로 과거 시간이 되어 실패하는 것이다.

### 3-8. 프론트가 과하게 fetch 함

- `useAdminDashboard` 하나가 대시보드, 템플릿, 이벤트 규칙, 발신번호, 로그, bulk SMS 캠페인, bulk 알림톡 캠페인, sender profile 관련 데이터까지 한꺼번에 fetch 한다.
- 그래서 템플릿 페이지, 이벤트 생성 페이지, 단건 보내기 페이지에서도 campaigns/logs 같은 불필요한 데이터가 같이 호출된다.
- 페이지 목적과 실제 fetch 범위가 맞지 않는다.

## 4. Redis가 꼭 필요한가

2026-03-25 기준 결론부터 말하면 "영구적으로 꼭 필요하다고 단정할 수는 없지만, V2 1차 구현에서는 유지한다."

이유는 현재 발송 안정성에 Redis/BullMQ가 이미 깊게 들어가 있고,
지금 시점의 최우선 과제는 "서버 구조 정리 + V2 프론트 연결 + 발송 경로 통일"이기 때문이다.

현재 Redis는 NHN이 요구해서 있는 것이 아니라,
우리 서비스가 아래 기능을 비동기로 처리하기 위해 선택한 실행 계층이다.

- 단건/이벤트 발송 큐잉
- retry / backoff
- delay / 예약 발송
- rate limit
- result-check job
- dead-letter 처리

현재 기준 의사결정:

- V2 1차: Redis 유지
- V2 1차: 단건/이벤트/벌크 발송을 하나의 공통 비동기 파이프라인으로 통일
- V2 2차 후보: Postgres outbox/dispatcher 전환 여부 재검토

즉, 지금은 "Redis를 없앨까?"보다 "발송 흐름을 먼저 일관되게 만들자"가 우선이다.

## 5. 현재 기준 추천 구조

### 5-1. V2 서버는 기존 `apps/api` 안에서 `/v2` 네임스페이스로 시작

- 새 레포나 새 서버를 바로 만드는 대신, 현재 `apps/api` 안에 `v2` 모듈 계층을 추가한다.
- 인증, Prisma, NHN 연동, 기존 worker/poller는 우선 재사용한다.
- 프론트 `apps/admin-noti-v2`는 `/v2/*` API만 보게 만든다.

### 5-2. 모든 발송은 공통 비동기 파이프라인으로 통일

목표 흐름:

- API 요청 수신
- 사전조건 / readiness 검증
- DB에 request 또는 campaign 저장
- Redis/BullMQ enqueue
- API는 `202 Accepted` 반환
- worker가 NHN 호출
- poller / result-check job이 후속 상태 갱신

현재 상태에서 이 기준을 만족하지 못하는 부분은 bulk SMS / bulk 알림톡이 API에서 NHN을 직접 호출하는 경로다.
V2에서는 이 둘도 큐 경로에 합류시키는 쪽을 우선 추진한다.

### 5-3. 운영 관측성 강화

- 구조화 JSON 로그 도입
- 공통 correlation key 사용
  - `requestId`
  - `messageRequestId`
  - `campaignId`
  - `nhnRequestId`
- 운영 페이지에서 다음을 볼 수 있게 한다.
  - DB 상태
  - dispatcher heartbeat
  - backlog 개수
  - 최근 실패 건수
- dead-letter 개수
- NHN 설정 유효성

### 5-4. 배포 구성 단순화

V2 1차 기준 검토안:

- `api`
- `admin`
- `worker`
- `poller`
- `postgres`
- `redis`

V2 2차에서 `worker + poller` 통합과 Redis 제거 여부를 다시 검토한다.

## 6. 프론트엔드 V2 방향

### 6-1. route별 훅/route별 API

현재처럼 공용 훅 하나가 모든 데이터를 한 번에 가져오는 구조는 피한다.

권장 예시:

- `useDashboardOverview`
- `useSmsSendPage`
- `useAlimtalkSendPage`
- `useSmsTemplatesPage`
- `useEventRulesPage`
- `useSmsCampaignsPage`
- `useAlimtalkCampaignsPage`

### 6-2. readiness-first

특히 다음 화면은 readiness 우선으로 간다.

- 문자 보내기
- 카카오메세지 보내기

예시 흐름:

1. 먼저 발송 가능 여부만 조회한다.
2. 발신번호/채널/템플릿 요건이 안 되면 여기서 멈춘다.
3. 요건이 충족될 때만 상세 옵션, 최근 로그, 템플릿 목록 등을 불러온다.

SMS 예시:

- 승인된 발신번호가 없는 경우:
  - 템플릿 목록
  - 로그
  - 캠페인 목록
  - 기타 부가 정보
  를 굳이 먼저 fetch 하지 않는다.

알림톡 예시:

- 사용 가능한 sender profile이 있는지 먼저 확인
- sender profile 선택 이후 그 채널에서 쓸 수 있는 템플릿 목록을 조회
- 기본 그룹 템플릿은 선택한 sender profile 기준으로 사용 가능 여부를 판단

### 6-3. dashboard API는 화면 전용으로

이 방향은 현재 기준으로 좋은 선택이다.

좋은 dashboard API:

- dashboard 화면에서 실제로 보여줄 카드/지표만 반환
- 요약/카운트/최근 N건만 반환
- 내부에서 병렬 쿼리로 조합

피해야 할 형태:

- "admin에 필요한 모든 걸 다 반환하는 만능 API"
- 화면이 바뀔수록 점점 비대해지는 aggregator API

즉, `dashboard 전용 API`는 찬성하지만 `거대한 admin 전체용 API`는 반대한다.

## 7. 운영 페이지 아이디어

admin 내부에 운영 상태판을 두는 방향을 우선 검토한다.

후보 경로:

- `/internal/system`
- `/internal/operations`

표시 후보:

- API 상태
- DB 상태
- dispatcher 상태
- 최근 발송 성공/실패
- dead-letter 수
- 미처리 backlog 수
- 최근 NHN 오류 코드 분포
- webhook 최근 수신 상태

UI는 단순한 표보다는 상태 카드 형태가 적합하다.

- 초록: 정상
- 노랑: 주의
- 빨강: 장애/즉시 확인 필요

주의:

- NHN 전체 상태를 100% 실시간으로 보장하는 것은 어렵다.
- 대신 "최근 성공률", "인증/설정 체크", "heartbeat", "backlog" 기준 건강도를 표현한다.

## 8. 배포/운영 체크리스트 방향

V2에서는 문서형 체크리스트와 자동 preflight를 함께 가는 것이 좋다.

### 문서형 체크리스트

- 필수 env 입력 여부
- DB migration 반영 여부
- seed 실행 여부 확인
- NHN 자격증명 확인
- webhook secret 확인
- API/Admin base URL 확인
- 쿠키/CORS 설정 확인
- health endpoint 확인
- 운영자 로그인 확인

### 자동 preflight 후보

- env schema validation
- DB 연결 체크
- migration 상태 체크
- NHN auth/token 체크
- 중요 URL 교차검증
- dispatcher readiness 체크

## 9. 이번 대화에서 합의된 방향

- route를 나누는 것이 맞다.
- 공용 훅 하나로 모든 화면 데이터를 가져오는 구조는 V2에서 해소한다.
- 보내기 화면은 readiness-first로 간다.
- dashboard는 dashboard 전용 API로 필요한 요약만 내려주는 방향이 좋다.
- V2 1차에서는 Redis를 유지한다.
- 대신 단건/이벤트/벌크 발송을 공통 비동기 파이프라인으로 통일한다.
- Redis 제거는 V2 2차에서 재검토한다.

## 10. 아직 결정이 필요한 항목

- `worker/poller`를 하나의 `dispatcher`로 합칠지
- 운영 상태판을 기존 admin 내부에 둘지, 별도 보호된 화면으로 둘지
- bulk 발송 이력과 단건 발송 이력을 최종적으로 어떤 조회 모델로 통합할지
- Redis 제거를 장기적으로 검토할지, 장기 유지할지

## 10-1. Guides / Changelog 영역

사용자들이 볼 수 있는 "가이드 문서"와 "changelog / 공지사항" 영역이 필요하다.

현재 기준 추천 방향:

- 같은 웹 안에 별도 페이지 영역으로 둔다.
- 다만 기존 dashboard 본문 안에 섞지 말고, 별도의 docs/content 영역으로 분리한다.

권장 route 예시:

- `/help`
- `/guides`
- `/guides/[slug]`
- `/changelog`
- `/changelog/[slug]`

### 왜 같은 웹 안이 좋은가

- 제품과 같은 도메인 안에서 사용자 신뢰와 연결성이 좋다.
- 로그인/앱/가이드/공지 사이 이동이 자연스럽다.
- 링크 공유와 검색이 쉽다.
- 초기 운영 복잡도가 낮다.

### 왜 dashboard와는 분리해야 하는가

- dashboard는 운영/작업 화면이다.
- 가이드/공지/릴리즈 노트는 콘텐츠 소비 화면이다.
- 한 레이아웃 안에 섞으면 정보 목적이 충돌한다.

### 초기 운영 방식 추천

1단계:

- 가이드: repo 기반 Markdown/MDX
- changelog: repo 기반 Markdown/MDX
- 짧은 공지: 앱 내 notice 영역 유지 또는 확장

장점:

- 가장 단순하다.
- PR로 검수 가능하다.
- 변경 이력이 남는다.
- 개발과 제품 릴리즈 흐름을 맞추기 쉽다.

2단계:

- 비개발자도 자주 수정해야 하거나
- 마케팅/운영팀이 직접 발행해야 한다면
- 그때 CMS 또는 DB 기반 관리로 분리 검토

### 현재 notice 모델에 대한 판단

현재 `DashboardNotice`는 짧은 운영 공지에는 적합하다.
하지만 구조상 본격적인 가이드 문서/릴리즈 노트 저장 모델로 쓰기에는 부족하다.

즉:

- `DashboardNotice`: 짧은 공지
- `GuideArticle` 또는 MDX docs: 긴 문서
- `ChangelogEntry` 또는 MDX entries: 릴리즈 노트

### 앞으로 정리할 것

- docs/changelog IA
- public docs layout 초안
- article metadata 규칙
- guide writing template
- changelog entry template

## 11. 구현 전 다음 대화에서 정리할 것

아래 항목을 단계별로 진행한다.

1. V2 서버 범위와 엔드포인트 설계안 정리
2. V2 모듈 뼈대와 `/v2` 네임스페이스 구성
3. dashboard / resources / bootstrap API 구현
4. 단건 SMS / 알림톡 V2 발송 API 구현
5. 벌크 SMS / 알림톡을 공통 비동기 파이프라인으로 전환
6. 헬스체크 / 운영 상태 / 로그 구조화
7. 배포 체크리스트와 env 전략 정리

## 12. 메모

- 현재 단계는 "단계적 구현 시작" 상태다.
- V2 문서는 계속 업데이트한다.
- 프론트 전용 원칙 문서는 `v2/frontend-principles.md`에 누적한다.
- 서버 전용 계획 문서는 `v2/server-v2-plan.md`에 누적한다.
