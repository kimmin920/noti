# publ-messaging (MVP)

Publ 내부 모듈이지만 별도 서비스처럼 동작하는 메시징 시스템입니다.

- `POST /v1/message-requests`로 Publ 이벤트를 비동기(202) 접수
- `Idempotency-Key(publEventId)` 멱등 처리
- 채널 전략: `SMS_ONLY | ALIMTALK_ONLY | ALIMTALK_THEN_SMS`
- SSO: Publ HS256 JWT -> `POST /v1/auth/sso/exchange` -> `pm_session` HttpOnly 쿠키
- 워커/큐: Redis + BullMQ (최대 8회 지수 백오프 + DEAD 격리)
- 결과 수집: 2분 주기 Poller로 `contact-delivery-results` 반영

## 1. Monorepo 구조

```
apps/
  api/      # NestJS API + webhook receiver + Swagger
  worker/   # BullMQ sender worker
  poller/   # delivery result poller
  admin/    # Next.js + shadcn-style UI
packages/
  shared/   # 공용 유틸(템플릿 변수 추출/렌더, backoff 상수)
  database/ # Prisma schema, migrations, seed
docker/
  *.Dockerfile
  start-*.sh
```

## 2. 기술 스택

- Backend: NestJS (TypeScript)
- Frontend: Next.js + shadcn-style components
- DB: PostgreSQL + Prisma
- Queue: Redis + BullMQ

## 3. 환경변수

1. 루트에서 `.env.example`을 복사해 `.env` 생성
2. 실 시크릿은 절대 커밋 금지

핵심 값:

- `PUBL_SSO_HS256_SECRET`
- `SESSION_SECRET`
- `DATABASE_URL`
- `REDIS_URL`
- `NHN_*`
- `NHN_WEBHOOK_SIGNATURE_SECRET`

## 4. 로컬 실행

### A. Docker Compose

```bash
docker compose up --build
```

실행 후:

- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/docs`
- Admin UI: `http://localhost:3001`

> API 컨테이너 시작 시 Prisma generate/migrate/seed를 수행합니다.

### B. 로컬 Node 실행

```bash
npm install
npm run prisma:generate
npm run build
npm run dev
```

## 5. 데이터베이스 마이그레이션

- Prisma schema: `packages/database/prisma/schema.prisma`
- Migration SQL: `packages/database/prisma/migrations/20260303180000_init/migration.sql`

운영 반영:

```bash
npm run prisma:migrate
npm run prisma:seed
```

## 6. 인증/권한

### SSO 교환

- Endpoint: `POST /v1/auth/sso/exchange`
- Header: `Authorization: Bearer <publ_hs256_jwt>`
- 검증: `iss=publ`, `aud=publ-messaging`, `role=TENANT_ADMIN`, `exp`
- 성공 시 `pm_session` 쿠키 발급

### Google OAuth 로그인 (선택)

- 시작: `GET /v1/auth/google/start` (Google로 redirect)
- 콜백: `GET /v1/auth/google/callback`
- 필요 환경변수: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, `GOOGLE_OAUTH_DEFAULT_TENANT_ID`
- 성공 시 `pm_session` 쿠키 발급

### 로그아웃

- `POST /v1/auth/logout`

## 7. 핵심 API

### Publ 이벤트 수신

- `POST /v1/message-requests`
- 필수 헤더: `Idempotency-Key`
- `requiredVariables` 누락 시 `422` + request 미생성
- 중복 `(tenantId, Idempotency-Key)`는 동일 `requestId` 반환

### 조회

- `GET /v1/message-requests/{requestId}`
- `GET /v1/admin/message-requests`

### 템플릿

- `GET/POST/PUT /v1/templates`
- `POST /v1/templates/:id/preview`
- `POST /v1/templates/:id/publish`
- `POST /v1/templates/:id/archive`
- `POST /v1/templates/:id/nhn-sync` (알림톡)

### 이벤트 규칙

- `GET /v1/event-rules`
- `POST /v1/event-rules/upsert`

### 발신번호

- `POST /v1/sender-numbers/apply` (서류 업로드)
- `GET /v1/admin/sender-number-reviews`
- `POST /v1/admin/sender-number-reviews/:id/approve`
- `POST /v1/admin/sender-number-reviews/:id/reject`
- `POST /v1/admin/sender-number-reviews/sync`

### 카카오 채널

- `GET /v1/sender-profiles/categories`
- `GET /v1/sender-profiles`
- `GET /v1/sender-profiles/:senderKey`
- `POST /v1/sender-profiles/apply`
- `POST /v1/sender-profiles/token`

### 웹훅

- `POST /v1/webhooks/nhn/kakao`
- `X-Toast-Webhook-Signature` 검증
- `TSC01~TSC04` -> `REG/REQ/APR/REJ` 반영

## 8. MVP 정책 반영

- `messagePurpose`는 `NORMAL`만 허용
- `ALIMTALK_ONLY`는 APR 템플릿 아니면 차단
- `ALIMTALK_THEN_SMS`는 APR 미충족 시 SMS fallback
- 발신번호 심사 요청 자동화는 **미구현** (NHN 콘솔 수동 운영 전제)

## 9. 샘플 이벤트 (seed 포함)

- `PUBL_USER_SIGNUP`
- `PUBL_TICKET_PURCHASED`
- `PUBL_PAYMENT_COMPLETED`

## 10. 테스트

```bash
npm test
```

포함 시나리오:

- 멱등키 중복 -> 동일 requestId 반환
- requiredVariables 누락 -> 422 예외
- ALIMTALK_ONLY + 미승인 템플릿 차단
- SSO exchange 성공/실패
- 샘플 이벤트 3종 처리

## 11. 운영 유의사항

- NHN 호출은 큐/워커 비동기 처리
- 429/5xx/timeout: 최대 8회 백오프 후 `DEAD` 격리
- 결과는 poller가 2분 간격 수집
- 시크릿은 `.env` 또는 Secret Manager 사용

## 12. Render 배포

- 루트의 `render.yaml` 기준으로 `api`, `admin`, `background(worker+poller)`, PostgreSQL, Redis를 함께 올릴 수 있습니다.
- `background`는 Render에서 free worker가 없어 `worker + poller`를 하나의 Starter 서비스로 묶었습니다.
- `api`는 웹훅/로그인 지연을 줄이기 위해 Starter, `admin`은 비용 절감을 위해 Free로 두었습니다.
- 실제 생성 전 `PUBL_SSO_HS256_SECRET`, `PUBL_SERVICE_TOKEN`, `NHN_*`, `NHN_WEBHOOK_SIGNATURE_SECRET` 값을 Render 대시보드에서 입력해야 합니다.
- Google OAuth를 쓸 경우 `GOOGLE_OAUTH_*` 값은 생성 후 서비스 URL이 확정된 다음 별도로 추가해야 합니다.
- 현재 시드는 테스트 계정과 고정 비밀번호를 넣기 때문에 운영 시작 커맨드에는 포함하지 않았습니다. 데모 계정이 필요할 때만 일회성으로 `npm run prisma:seed -w @publ/database`를 실행하세요.
