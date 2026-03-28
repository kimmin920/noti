# V2 Deployment Checklist

Updated: 2026-03-25

이 문서는 `apps/admin-noti-v2`와 `/v2` API를 local / dev / prod에 올릴 때 확인할 항목을 정리한 체크리스트다.

## 1. 실행 구성

V2 1차 기준 실행 단위:

- `apps/api`
- `apps/worker`
- `apps/poller`
- `apps/admin-noti-v2`
- `postgres`
- `redis`

로컬 전체 실행:

- `npm run dev:v2:stack`

프론트만 실행:

- `npm run dev:v2`

## 2. 환경 변수

### 2-1. Frontend

- `NEXT_PUBLIC_API_BASE_URL`
  - local: `http://localhost:3000`
  - dev/prod: 실제 API origin

### 2-2. API / Worker / Poller 공통

- `REDIS_URL`
- `BULLMQ_QUEUE_NAME`
- `NHN_NOTIFICATION_HUB_APP_KEY`
- `NHN_USER_ACCESS_KEY_ID`
- `NHN_SECRET_ACCESS_KEY`
- `NHN_SMS_APP_KEY`
- `NHN_SMS_SECRET_KEY`
- `NHN_ALIMTALK_APP_KEY`
- `NHN_ALIMTALK_SECRET_KEY`
- `NHN_DEFAULT_SENDER_GROUP_KEY`
- `NHN_WEBHOOK_SIGNATURE_SECRET`

### 2-3. 세션 / 브라우저 연동

- `CORS_ALLOW_ORIGINS`
  - `admin-v2` origin 포함 필수
- `COOKIE_SECURE`
  - prod는 `true`
- `COOKIE_SAMESITE`
  - cross-site 운영이면 `none`
- `COOKIE_DOMAIN`
  - 상용 쿠키 공유 도메인 사용 시 설정
- `SESSION_SECRET`
- `PUBL_SSO_HS256_SECRET`

### 2-4. 운영 URL

- `ADMIN_BASE_URL`
  - 현재 관리자 기준 URL
- `PORT`
  - API 포트

## 3. Local Preflight

- `postgres`, `redis`가 떠 있는지 확인
- `npm run dev:v2:stack` 실행
- `http://localhost:3000/health/live` 응답 확인
- `http://localhost:3000/health/ready` 응답 확인
- `http://localhost:3000/v2/ops/health` 응답 확인
- `http://localhost:3010`에서 로그인 후 V2 화면 진입 확인

페이지 smoke test:

- 대시보드가 `/v2/bootstrap`, `/v2/dashboard` 기준으로 렌더링되는지 확인
- 발신 자원 화면이 `/v2/resources/*` 기준으로 실제 상태를 보여주는지 확인
- 템플릿 화면이 `/v2/templates/*` 기준으로 실제 목록을 보여주는지 확인
- 이벤트 / 로그 / 설정 / 캠페인 화면이 각각 `/v2/events`, `/v2/logs`, `/v2/ops/health`, `/v2/campaigns`를 보는지 확인
- SMS 보내기 화면이 readiness를 먼저 확인하고, 준비되지 않으면 options를 부르지 않는지 확인
- 알림톡 보내기 화면이 readiness를 먼저 확인하고, 준비되지 않으면 options를 부르지 않는지 확인

발송 smoke test:

- SMS 단건 발송 버튼으로 `/v2/send/sms/requests`가 `202`를 반환하는지 확인
- 알림톡 단건 발송 버튼으로 `/v2/send/kakao/requests`가 `202`를 반환하는지 확인
- 발송 후 `/v2/logs`에 요청이 기록되는지 확인
- worker가 실제 NHN 호출 또는 mock mode 처리 후 상태를 갱신하는지 확인

## 4. Dev / Prod Preflight

- API, worker, poller가 같은 `REDIS_URL`, `BULLMQ_QUEUE_NAME`을 바라보는지 확인
- `admin-v2`가 올바른 `NEXT_PUBLIC_API_BASE_URL`을 바라보는지 확인
- `CORS_ALLOW_ORIGINS`에 `admin-v2` origin이 포함되어 있는지 확인
- 세션 쿠키가 브라우저에서 정상 저장되는지 확인
- prod에서 `COOKIE_SECURE=true`인지 확인
- cross-site 구조면 `COOKIE_SAMESITE=none`인지 확인
- `NHN_*` 키가 placeholder가 아닌지 확인
- `v2/ops/health`의 `config`가 `ok` 또는 의도한 `warning(mock mode)`인지 확인

## 5. 배포 순서

권장 순서:

1. `api`
2. `worker`
3. `poller`
4. `admin-noti-v2`

배포 직후 확인:

1. `/health/live`
2. `/health/ready`
3. `/v2/ops/health`
4. V2 로그인
5. 대시보드 진입
6. SMS / 알림톡 단건 발송 접수
7. 로그 반영 확인

## 6. 컷오버 체크

- 기존 V1 admin은 유지한 채 `admin-v2`를 별도 경로 또는 서브도메인에서 먼저 검증
- 운영자 확인 후 main admin 진입점을 V2로 전환
- 전환 직후 30분 동안 아래 지표 모니터링
  - `/v2/ops/health`
  - queue backlog
  - Redis 연결 오류
  - NHN 인증 오류
  - 발송 실패율
  - 세션 / CORS 오류

## 7. 장애 시 즉시 확인

- `/health/ready`가 `error`인지
- `/v2/ops/health`에서 `database`, `redis`, `queue`, `config` 중 어느 컴포넌트가 깨졌는지
- `admin-v2` 브라우저 콘솔에서 `401`, `403`, `CORS` 오류가 나는지
- worker / poller 프로세스가 실제로 떠 있는지
- queue backlog가 급격히 쌓였는지
- NHN 자격 증명 또는 webhook secret이 바뀌지 않았는지
