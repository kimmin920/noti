# V2 Server Plan

Updated: 2026-03-25
Status: Stage 7 completed

이 문서는 현재 레포 기준으로 V2 서버를 어떤 구조로 가져갈지, 어떤 순서로 바꿀지 정리한 작업 문서다.
Redis는 V2 1차 구현에서 유지하고, 대신 발송 경로를 하나의 공통 비동기 파이프라인으로 통일한다.

## 1. 확정된 방향

- V2 서버는 새 레포가 아니라 기존 `apps/api` 안에 `/v2` 네임스페이스로 추가한다.
- 인증, Prisma, NHN 연동, worker, poller는 우선 기존 것을 재사용한다.
- V2 프론트 `apps/admin-noti-v2`는 V2 전용 API만 사용하도록 점진 전환한다.
- Redis/BullMQ는 V2 1차에서 유지한다.
- 단건 SMS, 단건 알림톡, 이벤트 발송, 벌크 SMS, 벌크 알림톡을 공통 비동기 파이프라인으로 통일한다.

## 2. 현재 구조와 문제

현재 구조는 다음처럼 갈라져 있다.

- 이벤트 발송: `API -> Redis/BullMQ -> worker -> NHN`
- 직접 단건 SMS / 알림톡 발송: `API -> Redis/BullMQ -> worker -> NHN`
- 벌크 SMS / 벌크 알림톡: `API -> NHN 직접 호출`
- 결과 확인: `worker result-check queue + poller`

이 구조의 문제는 다음과 같다.

- 발송 종류에 따라 동작 방식이 다르다.
- 어떤 발송은 `202 Accepted` 비동기 처리이고, 어떤 발송은 API가 외부 호출을 직접 끝낼 때까지 기다린다.
- 재시도, 로그, 운영 추적, 실패 처리 기준이 단건과 벌크에서 다르다.
- 프론트 입장에서 발송 상태 모델을 통일하기 어렵다.

## 3. V2 목표 구조

모든 발송은 아래 흐름으로 맞춘다.

1. API가 요청을 받는다.
2. readiness / 권한 / 입력 검증을 수행한다.
3. DB에 `messageRequest` 또는 `campaign`을 저장한다.
4. Redis/BullMQ에 job을 enqueue 한다.
5. API는 즉시 `202 Accepted`를 반환한다.
6. worker가 NHN 호출을 수행한다.
7. worker / poller가 상태와 결과 로그를 갱신한다.

이렇게 되면 발송 종류와 상관없이 사용자에게는 다음 상태 흐름이 보인다.

- `ACCEPTED`
- `PROCESSING`
- `SENT_TO_PROVIDER`
- `DELIVERED` 또는 `DELIVERY_FAILED`
- 필요 시 `SEND_FAILED` 또는 `DEAD`

## 4. Redis는 어디에 쓰는가

현재 Redis는 NHN 때문에 필요한 것이 아니라, 우리 서비스의 비동기 실행 계층으로 쓰인다.

주요 역할:

- 발송 job queue
- retry / backoff
- 예약 발송 delay
- rate limit
- result-check queue
- dead-letter 전 단계 보호

현재 Redis를 타는 경로:

- 이벤트 발송
- 직접 단건 SMS 발송
- 직접 단건 알림톡 발송
- result-check job
- poller의 result-check worker

현재 Redis를 타지 않는 경로:

- 벌크 SMS 발송
- 벌크 알림톡 발송

V2에서 바꿀 핵심은 "Redis 제거"가 아니라 "벌크도 같은 큐 파이프라인에 합류"다.
레거시 V1의 직접 NHN 호출 경로는 컷오버 전까지 호환성 때문에 일시 유지한다.

## 5. V2 API 네임스페이스

V2는 페이지 기준 BFF 스타일로 나눈다.

### 5-1. 공통 / shell

- `GET /v2/bootstrap`
  - 로그인 사용자
  - tenant 기본 정보
  - capability 요약
  - notice count 또는 최소 badge 정보

### 5-2. dashboard

- `GET /v2/dashboard`
  - 상단 요약 지표
  - 발송 readiness 요약
  - 최근 공지
  - 최근 실패 카운트

### 5-3. resources

- `GET /v2/resources/summary`
- `GET /v2/resources/sms`
- `GET /v2/resources/kakao`
- `POST /v2/resources/sms/applications`
- `POST /v2/resources/kakao/connections`

### 5-4. send / SMS

- `GET /v2/send/sms/readiness`
- `GET /v2/send/sms/options`
- `POST /v2/send/sms/requests`
- `GET /v2/send/sms/requests/:requestId`

원칙:

- `readiness`가 실패하면 `options`는 굳이 호출하지 않는다.
- 프론트는 발신번호가 준비되지 않았을 때 템플릿/기타 부가 fetch를 생략한다.

### 5-5. send / Kakao

- `GET /v2/send/kakao/readiness`
- `GET /v2/send/kakao/options`
- `POST /v2/send/kakao/requests`
- `GET /v2/send/kakao/requests/:requestId`

원칙:

- 사용 가능한 sender profile 또는 채널이 없으면 상세 fetch를 중단한다.
- 템플릿 목록은 선택 가능한 채널 기준으로 제한한다.

### 5-6. templates

- `GET /v2/templates/summary`
- `GET /v2/templates/sms`
- `GET /v2/templates/kakao`

### 5-7. events

- `GET /v2/events`
- `POST /v2/events`
- `PATCH /v2/events/:eventRuleId`

### 5-8. logs

- `GET /v2/logs`
- `GET /v2/logs/:requestId`

### 5-9. bulk / campaigns

- `GET /v2/campaigns`
- `POST /v2/campaigns/sms`
- `POST /v2/campaigns/kakao`
- `GET /v2/campaigns/:campaignId`

V2에서는 이 두 발송도 즉시 NHN 호출하지 않고, campaign 저장 후 큐 처리로 전환한다.

### 5-10. health / operations

- `GET /health/live`
- `GET /health/ready`
- `GET /v2/ops/health`

`/v2/ops/health`는 화면 표시용 상세 상태를 반환한다.

후보 필드:

- DB 연결 상태
- Redis 연결 상태
- worker heartbeat
- poller heartbeat
- queue backlog
- dead-letter count
- 최근 NHN 오류 건수
- NHN SMS / AlimTalk 필수 설정 존재 여부

## 6. 단계별 구현 계획

### Stage 1. 설계 문서 정리

- 이 문서와 `v2/README.md`를 최신 합의 기준으로 정리한다.
- Redis 유지 / 발송 파이프라인 통일 방향을 명확히 기록한다.

Status: completed

### Stage 2. V2 모듈 뼈대 생성

- `apps/api/src/v2/*` 디렉터리 생성
- `V2Module` 및 하위 모듈 골격 추가
- 공통 라우트 prefix 정리

Status: completed

### Stage 3. 조회성 API 우선 구현

- `bootstrap`
- `dashboard`
- `resources`

이 단계는 프론트가 실제 API와 붙기 시작하는 첫 지점이다.

Status: completed

### Stage 4. 단건 발송 API V2 연결

- SMS readiness / options / create
- Kakao readiness / options / create

이 단계에서는 기존 `messageRequest + QueueService + worker`를 재사용한다.

Status: completed

### Stage 5. 벌크 발송 경로 통일

- bulk SMS
- bulk Kakao

V2의 벌크 발송 경로를 campaign 저장 후 queue 기반 worker 처리로 전환한다.
레거시 V1 직접 호출 경로는 컷오버 전까지 유지한다.

Status: completed

### Stage 6. 운영 관측성 강화

- live / ready / ops health
- queue backlog 표시
- 템플릿 / 이벤트 / 로그 조회 API 정리
- worker / poller heartbeat는 현재 저장 구조가 없어 후속 단계로 보류

Status: completed

### Stage 7. 배포 문서와 preflight

- local / dev / prod env 전략 정리
- 배포 체크리스트 작성
- preflight 체크 후보 정리

Status: completed

현재 기준 완료 범위:

- `apps/admin-noti-v2`가 `/v2/bootstrap`, `/v2/dashboard`, `/v2/resources/*`, `/v2/templates/*`, `/v2/events`, `/v2/logs`, `/v2/ops/health`, `/v2/campaigns`를 실제로 사용한다.
- `send/sms`, `send/kakao` 화면은 readiness를 먼저 조회하고, 준비된 경우에만 options를 추가 fetch 한다.
- `send/sms`, `send/kakao`의 단건 발송 버튼은 `/v2/send/*/requests`에 실제로 접수 요청을 보낸다.
- 배포 및 smoke test 문서는 `v2/deployment-checklist.md`에 정리했다.

## 7. Stage 1 완료 기준

다음 질문에 문서로 답할 수 있으면 1단계 완료다.

- V2 서버는 어디에 붙는가
- Redis는 유지하는가
- 어떤 발송이 큐를 타는가
- 어떤 API를 먼저 만들 것인가
- 어떤 순서로 구현할 것인가

이 기준은 현재 충족한다.
