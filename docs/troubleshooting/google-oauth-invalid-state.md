# Google OAuth `Invalid OAuth state` 장애 기록

작성일: 2026-03-11

## 개요

Google 로그인 시 아래 오류가 반복적으로 발생했다.

```json
{
  "message": "Invalid OAuth state",
  "error": "Unauthorized",
  "statusCode": 401
}
```

이 에러는 Google이 반환한 에러가 아니라, 우리 API가 OAuth 보안 검증 단계에서 요청을 차단한 것이다.

## 증상

- Google 계정 선택까지는 정상 진행됨
- `GET /v1/auth/google/callback`에서 401 반환
- API 로그에 `Invalid OAuth state` 출력
- 일부 시점에는 Google 로그인 성공 후에도 Admin 화면에 기존 `test` 계정 세션이 남아 있었음

대표 로그:

```text
[Auth] Google Callback:
  - Cookies Object: {"cf_clearance":"..."}
  - Raw State Cookie: undefined
[Auth] State mismatch! received=<state>, expected=undefined
```

수정 이후 로그:

```text
[Auth] State mismatch! received=<state>, expected=<server-side state store>
```

## 원인 정리

이번 장애는 원인이 하나가 아니라 연속으로 겹쳐 있었다.

### 1. `state`를 쿠키에 저장하던 방식이 실제 브라우저 흐름에서 깨짐

초기 구현은:

- `/v1/auth/google/start`에서 `pm_oauth_state` 쿠키 발급
- `/v1/auth/google/callback`에서 해당 쿠키와 query string `state` 비교

하지만 실제 callback 요청에는 `pm_oauth_state`가 실리지 않았다.

결과:

- 서버는 이전에 발급한 `state`를 찾지 못함
- `UnauthorizedException('Invalid OAuth state')` 발생

관련 파일:

- `apps/api/src/auth/auth.controller.ts`

### 2. 소스 코드를 고쳐도 실제 서비스에는 반영되지 않고 있었음

처음에는 로컬 `src`를 수정했지만, 실제 `3000` 포트는 로컬 Node 프로세스가 아니라 Docker `api` 컨테이너가 점유하고 있었다.

즉:

- 수정 대상: 호스트의 `apps/api/src/*`, `apps/api/dist/*`
- 실제 응답 주체: `docker compose`로 올라간 `nhn-notification-api-1`

그래서 컨테이너를 재빌드하기 전까지는 계속 예전 코드가 응답했다.

확인 포인트:

- `lsof -nP -iTCP:3000 -sTCP:LISTEN`
- `docker compose logs api`

### 3. 쿠키 의존을 제거하고 서버 메모리 기반 `state` 저장으로 바꾼 뒤에도 host mismatch가 발생함

쿠키 대신 서버 메모리에 `state`를 저장하고 callback에서 소비하도록 바꿨다.

그런데 첫 구현은 브라우저 fingerprint를 만들 때 `host`를 포함하고 있었다.

실제 요청 흐름은 다음과 같았다.

- `/v1/auth/google/start` 요청 host: `localhost:3000`
- `/v1/auth/google/callback` 요청 host: `api-speed-demon.vizuo.work`

같은 브라우저인데도 host가 다르기 때문에 다른 요청으로 판단되어 state 검증이 실패했다.

결과:

- `expected=<server-side state store>` 로그는 보이지만 여전히 401

최종 조치:

- fingerprint 계산에서 `host` 제외

관련 파일:

- `apps/api/src/auth/google-oauth-state.service.ts`

### 4. Google 로그인은 성공했지만 Admin UI는 계속 localhost 세션을 보고 있었음

이 시점부터는 DB에 Google 세션이 정상 생성되고 있었다.

예:

- `publUserId = google:...`
- `role = OPERATOR`
- `email = contact@vizuo.work`

그런데 브라우저 화면에는 기존 `local:test1@vizuo.work` 세션이 계속 보였다.

원인은 Admin 프런트가 실제로 public API가 아니라 `http://localhost:3000` fallback을 사용하고 있었기 때문이다.

왜 이런 일이 생겼는지:

- Admin 코드는 `process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'`
- Docker build 시 `.dockerignore`에 `.env`가 포함되어 있었음
- 그래서 Admin 번들 생성 시 `NEXT_PUBLIC_API_BASE_URL`이 주입되지 않음
- 결과적으로 public Admin 화면에서도 localhost API를 호출

즉 브라우저 안에서 두 흐름이 동시에 섞였다.

- Google callback은 public API 쪽 세션 생성
- Admin 화면의 `/v1/auth/me`는 localhost API 쪽 기존 test 세션 조회

관련 파일:

- `.dockerignore`
- `apps/admin/lib/api.ts`
- `apps/admin/hooks/use-admin-dashboard.ts`
- `apps/admin/app/internal/page.tsx`

### 5. 기존 `pm_session` 쿠키도 같이 정리해야 했음

Google callback 시점에 브라우저가 기존 `pm_session`을 같이 보내는 경우가 있었다.

따라서 callback 성공 후:

- 기존 세션 revoke
- host-only / domain 세션 쿠키 모두 clear
- 새 Google 세션 쿠키 재발급

순서로 정리하도록 수정했다.

## 최종 수정 내용

### API

- OAuth `state` 저장 방식을 쿠키 기반에서 서버 메모리 기반으로 변경
- `host` 차이로 인해 같은 브라우저 요청이 거부되지 않도록 fingerprint 계산 수정
- Google callback 성공 시 기존 `pm_session` revoke 후 새 세션 재발급
- 세션 쿠키 clear 시 host-only / domain 케이스를 모두 정리

관련 파일:

- `apps/api/src/auth/auth.controller.ts`
- `apps/api/src/auth/google-oauth-state.service.ts`
- `apps/api/src/auth/auth.module.ts`

### Admin

- `NEXT_PUBLIC_API_BASE_URL`가 빌드 시점에 빠져도 런타임에서 현재 origin 기준으로 API 주소를 추론하도록 변경
- `admin-*` 호스트에서는 자동으로 `api-*` 호스트를 사용
- localhost 개발 환경은 기존대로 `http://localhost:3000` 유지
- localhost에서 실행 중이면 배포용 `NEXT_PUBLIC_API_BASE_URL`보다 로컬 API를 우선 사용

관련 파일:

- `apps/admin/lib/api-base.ts`
- `apps/admin/lib/api.ts`
- `apps/admin/hooks/use-admin-dashboard.ts`
- `apps/admin/app/internal/page.tsx`

## 디버깅 체크리스트

같은 증상이 다시 발생하면 아래 순서로 확인한다.

### A. 현재 응답 중인 코드가 최신인지

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
docker compose logs api --tail=100
docker compose up -d --build api
```

확인 포인트:

- 실제 `3000` 포트를 누가 점유하는지
- Docker 컨테이너가 예전 이미지인지

### B. `/google/start`와 `/google/callback`이 같은 흐름으로 이어지는지

로그에서 확인:

- `/google/start`의 발급 `state`
- `/google/callback`의 `received=<state>`

같은 값이어야 한다.

### C. callback 요청이 쿠키 기반 검증을 타는지, 서버 저장소 기반 검증을 타는지

로그 문구로 구분:

- 예전 코드: `expected=undefined`
- 현재 코드: `expected=<server-side state store>`

### D. Admin UI가 실제로 어느 API를 보고 있는지

다음 로그가 나오면 아직 localhost 경로가 섞여 있는 것이다.

```text
[Auth] Google Start:
  - Host: localhost:3000
```

public Admin에서 정상이라면 기대값은 아래와 가깝다.

```text
[Auth] Google Start:
  - Host: api-speed-demon.vizuo.work
```

### E. 세션이 어느 계정에 매핑되는지

Postgres에서 최신 세션을 보면 Google 세션이 실제로 생성되었는지 확인할 수 있다.

```bash
docker compose exec postgres psql -U postgres -d publ_messaging -c \
  "select s.\"createdAt\", u.\"publUserId\", u.email, u.role from \"Session\" s join \"AdminUser\" u on u.id = s.\"userId\" order by s.\"createdAt\" desc limit 10;"
```

## 운영상 주의사항

- `NEXT_PUBLIC_*` 값은 Next.js에서 빌드 시점에 번들에 들어간다.
- Docker build context에서 `.env`가 제외되면 런타임 env를 넣어도 클라이언트 번들은 fallback 값을 쓸 수 있다.
- public Admin과 public API를 같이 쓸 때는 브라우저가 localhost fallback을 보지 않도록 해야 한다.
- OAuth callback URL을 수동 재실행해서는 안 된다.
  이미 소비된 `state`는 재사용할 수 없다.

## 재발 방지 포인트

- public Admin은 런타임 기반 API 호스트 추론을 사용한다.
- Google OAuth state는 브라우저 쿠키에 의존하지 않는다.
- 로그인 전환 시 기존 세션을 먼저 정리한다.
- Docker로 운영 중이면 소스 수정 후 컨테이너 재빌드를 항상 같이 확인한다.
