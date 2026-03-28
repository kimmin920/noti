# Frontend Principles For V2

Updated: 2026-03-20
Status: Living document

이 문서는 V2 프론트엔드를 "깔끔하고, 빠르고, 목적이 분명한 설정형 제품 UI"로 정리하기 위한 원칙 문서다.

목표 이미지는 다음에 가깝다.

- GitHub의 settings / billing / security 같은 화면
- Notion의 설정 패널처럼 조용하고 예측 가능한 화면
- Linear처럼 정보 밀도는 높지만 정신없지 않은 화면

이 프로젝트에서 중요한 것은 "화려함"보다 "정리감"이다.
즉, V2 프론트는 예쁜 카드보다 정보 구조가 먼저다.

## 1. 디자인 방향

### 기본 톤

- 조용함
- 명확함
- 안정감
- 관리형 제품 UI

### 피하고 싶은 것

- 한 화면에 너무 많은 카드와 강조 요소가 동시에 나오는 구성
- 통계, 가이드, 로그, 설정, 액션이 같은 레벨에서 경쟁하는 레이아웃
- 과도한 gradient, glass, shadow, 배지 남발
- route 목적과 맞지 않는 과도한 설명/요약/바로가기 패널

### 유지하고 싶은 것

- 깔끔한 타이포 계층
- 상태 배지의 명확한 의미
- 필요한 순간에만 강조되는 액션 버튼
- 설정형 제품다운 조밀한 레이아웃

## 2. 핵심 원칙

### 2-1. 한 페이지는 한 질문만 해결한다

예시:

- 문자 보내기: "지금 보낼 수 있는가?"
- 카카오메세지 보내기: "채널과 템플릿이 준비되었는가?"
- 템플릿 관리: "템플릿을 생성/수정/게시하는가?"
- 이벤트 규칙: "이벤트와 채널을 연결하는가?"

한 페이지가 동시에 아래를 다 하려고 하면 안 된다.

- 설정
- 운영 현황
- 최근 로그
- 사용 가이드
- 상세 통계
- 관련 링크 모음

### 2-2. 한 섹션은 한 행동만 가진다

좋은 예:

- 발신번호 선택
- 메시지 본문 입력
- 템플릿 선택
- 저장 버튼

나쁜 예:

- 발신번호 선택 + 도움말 + 관련 통계 + 최근 실패 로그 + 빠른 링크

### 2-3. 기본 화면은 최소 정보만 보여준다

- 처음부터 모든 정보를 펼쳐놓지 않는다.
- 우선 판단에 필요한 것만 보여준다.
- 부가 정보는 아래 중 하나로 분리한다.
  - 별도 탭
  - 별도 route
  - 접을 수 있는 advanced section
  - drawer / modal / detail panel

### 2-4. 시각적 강조는 항상 하나만

한 화면에서 주인공은 하나여야 한다.

- primary button 하나
- 현재 상태 badge 하나
- 필요한 경고 alert 하나

동시에 이것들이 다 튀면 안 된다.

- 큰 hero
- 큰 stats
- 강한 gradient
- 여러 배지
- 사이드 가이드 박스
- CTA 여러 개

## 3. 정보 구조 원칙

### 3-1. route를 역할별로 쪼갠다

현재보다 더 강하게 분리한다.

권장 route 범주:

- overview
- setup
- send
- templates
- rules
- logs
- campaigns
- internal operations

### 3-2. 로그와 작업 화면을 분리한다

보내기 화면에서 최근 로그를 같이 보여주는 것은 편해 보이지만,
실제로는 입력 집중을 방해하는 경우가 많다.

원칙:

- 발송 화면은 입력과 검증 중심
- 로그는 별도 route
- 실패 원인 확인은 링크로 이동

예외:

- 발송 직후 결과 확인을 위한 아주 작은 inline status
- 최근 1건 정도의 lightweight feedback

### 3-3. 대시보드는 "요약"만 한다

대시보드는 다른 화면의 내용을 복제하면 안 된다.

대시보드에는 아래만 둔다.

- 상태 요약
- 오늘/최근 기준 핵심 수치
- 장애/경고
- 바로 이동해야 하는 작업 링크

대시보드에서 하지 말 것:

- 전체 템플릿 편집
- 전체 이벤트 편집
- 세부 발송 작업
- 긴 설명성 가이드

## 4. Fetch 원칙

### 4-1. route별 데이터만 가져온다

공용 훅 하나가 모든 화면 데이터를 다 가져오는 구조는 금지한다.

권장 예시:

- `useDashboardOverview`
- `useSmsSendReadiness`
- `useSmsSendOptions`
- `useAlimtalkSendReadiness`
- `useAlimtalkTemplateOptions`
- `useSmsTemplates`
- `useEventRules`
- `useMessageLogs`

### 4-2. readiness-first

특히 보내기 화면은 반드시 2단계로 나눈다.

1. 먼저 "보낼 수 있는지"만 확인
2. 가능할 때만 실제 입력에 필요한 옵션을 fetch

SMS 예시:

- 1차:
  - 승인된 발신번호 존재 여부
- 2차:
  - 발신번호 목록
  - 템플릿 목록
  - 필요 시 최근 발송 상태

알림톡 예시:

- 1차:
  - 사용 가능한 sender profile 존재 여부
- 2차:
  - sender profile 목록
  - 선택된 profile 기준 사용 가능한 템플릿 목록
  - 기본 그룹 템플릿 사용 가능 여부

### 4-3. above-the-fold 우선 로드

첫 화면에서 보이지 않는 정보는 뒤로 미룬다.

예시:

- summary 먼저
- 테이블/로그는 뒤
- 부가 도움말은 lazy
- 통계 그래프는 선택적 로드

### 4-4. 화면 전용 aggregator API는 허용

dashboard처럼 "한 화면에 꼭 같이 나와야 하는 요약 정보"는 서버에서 묶어도 된다.

좋은 API:

- 특정 화면 전용
- 필요한 필드만 반환
- 최근 N개 / count / boolean readiness 중심

나쁜 API:

- admin 전체에서 쓸 수도 있을 것 같은 걸 전부 모은 giant endpoint

## 5. 페이지 유형 규칙

V2 페이지는 아래 5가지 패턴으로 제한하는 것이 좋다.

### 5-1. Overview Page

용도:

- 전체 현황
- 경고와 이동 포인트

구성:

- 제목
- 핵심 상태 카드 3~5개
- 경고/notice
- 주요 이동 링크

### 5-2. Setup Page

용도:

- 발신번호 등록
- 채널 연결
- 템플릿 승인 전 준비

구성:

- 현재 readiness
- setup step list
- 필요한 문서/상태
- primary CTA

### 5-3. Edit Page

용도:

- 템플릿 작성
- 이벤트 규칙 편집

구성:

- 제목
- 현재 상태
- form
- save / publish / archive

### 5-4. Send Page

용도:

- 단건 메시지 발송

구성:

- readiness gate
- form
- inline validation
- submit result

### 5-5. Log/List Page

용도:

- 발송 이력
- campaign 목록

구성:

- filter
- table/list
- row detail
- retry / inspect action

## 6. 레이아웃 원칙

### 6-1. 본문 폭을 줄인다

설정/폼 화면은 너무 넓으면 산만해진다.

권장:

- form page: 더 좁은 `max-width`
- table page: 넓은 영역 허용
- overview page: 중간 폭

### 6-2. 사이드바는 항상 같은 역할만

사이드바는 네비게이션이면 네비게이션만 해야 한다.
본문 우측 aside는 필요한 페이지에만 제한적으로 쓴다.

현재처럼 많은 화면에 공통 aside를 붙이면, 실제 작업보다 부가 설명이 더 눈에 띄기 쉽다.

### 6-3. Hero 영역을 기본값으로 쓰지 않는다

현재 `SendPageShell`, `EventPageShell`은 다음 요소가 기본으로 많이 붙어 있다.

- 큰 제목 헤더
- stats 3개
- 우측 가이드 aside
- 우측 바로가기 aside

이 패턴은 "전용 랜딩"처럼 보이게 만들 수는 있지만,
설정형 제품 UI 기준으로는 반복될수록 피로도가 쌓인다.

V2 원칙:

- hero는 overview나 onboarding에만 제한적으로 사용
- edit/send/settings 화면은 더 평평한 header로 간다

## 7. 컴포넌트 원칙

### 7-1. 카드보다 섹션을 우선한다

모든 것을 card로 싸지 않는다.

우선순위:

1. plain section
2. bordered section
3. card
4. accent card

### 7-2. 상태 색상은 의미가 있을 때만 쓴다

- green: 정상/준비 완료
- yellow: 대기/주의
- red: 실패/위험
- blue or neutral: 일반 정보

색을 장식으로 쓰지 않는다.

### 7-3. 아이콘은 정보 구조를 돕는 정도만

아이콘이 페이지 정체성을 대신하면 안 된다.

- 메뉴
- 상태
- 위험 액션
- 짧은 보조 시각 단서

정도에만 사용한다.

## 8. 카피 원칙

### 8-1. 제목은 짧고 직접적으로

좋은 예:

- 문자 보내기
- 알림톡 보내기
- SMS 템플릿
- 이벤트 규칙
- 발송 로그

### 8-2. 설명은 한 줄만

설명은 사용자가 "이 화면에서 뭘 하는지"만 알려주면 된다.

불필요한 것:

- 브랜드성 수사
- 긴 운영 설명
- 다른 페이지 기능까지 한 번에 소개

### 8-3. 버튼 라벨은 행동으로

좋은 예:

- 저장
- 게시
- 승인 요청
- 발송
- 테스트 보내기

## 9. 현재 코드 기준 개선 포인트

현재 확인된 개선 포인트:

- 공용 훅 `useAdminDashboard`가 너무 많은 데이터를 한 번에 로드함
- send/event 계열 shell이 공통적으로 과한 header + stats + aside를 반복함
- route별 책임보다 "보여줄 수 있는 것 최대한 다 보여주기"에 가까운 흔적이 있음

V2에서는 아래를 우선적으로 바꾼다.

1. route별 fetch 분리
2. readiness-first 도입
3. hero/aside 남발 축소
4. overview와 work page 분리
5. logs/campaigns 분리

## 10. 프론트 구현 체크리스트

새 route를 만들 때마다 아래를 확인한다.

- 이 화면의 단 하나의 목적이 명확한가
- 첫 화면에 꼭 필요한 데이터만 fetch 하는가
- readiness 실패 시 나머지 fetch를 멈추는가
- 설명 문장이 1~2줄을 넘지 않는가
- primary action이 하나로 보이는가
- 로그/통계/가이드가 본문 입력을 방해하지 않는가
- 이 화면은 overview/setup/edit/send/log 중 어느 패턴인가

## 11. 다음에 계속 정리할 항목

앞으로 이 문서에 계속 추가할 것:

1. route map 초안
2. sidebar IA
3. page template 예시
4. component density 규칙
5. typography/token 방향
6. dashboard wireframe 메모
7. SMS/알림톡 send page wireframe 메모

## 12. UI Library Notes

### 12-1. Tremor

기본 판단:

- 대시보드/KPI/차트 중심 영역에는 잘 맞는다.
- 설정형 폼 중심 화면에는 메인 시스템으로 쓰기보다 보조적으로 쓰는 편이 낫다.

잘 맞는 영역:

- 대시보드 overview
- KPI 카드
- 차트
- 필터가 있는 데이터 뷰
- 리포트형 페이지
- 운영 상태판

안 맞는 영역:

- GitHub settings 같은 조용한 설정 화면 전체를 Tremor 톤으로 통일하는 용도
- 복잡한 승인/설정/문서 제출 플로우의 메인 UI 시스템
- 템플릿 편집기 같은 세밀한 form-heavy 화면의 전체 기반

도입 시 장점:

- 차트와 dashboard 시각화 기본값이 좋다.
- 데이터 중심 화면을 빠르게 만들 수 있다.
- 현재 프로젝트 스택과 기술적으로 크게 충돌하지 않는다.

도입 시 주의점:

- Tremor를 전면 도입하면 product settings UI와 dashboard UI의 톤이 쉽게 분리될 수 있다.
- 따라서 "전면 UI 시스템"보다 "dashboard/analytics 레이어 전용"으로 쓰는 편이 안전하다.
- 프로젝트 전체에 Tremor 스타일을 퍼뜨리기보다, overview/internal/analytics 계열 route에 제한적으로 사용하는 것이 좋다.

현재 프로젝트 기준 메모:

- admin은 이미 Tailwind 기반이다.
- Tremor 공식 문서는 Tailwind CSS `v3.4+`를 요구한다.
- 현재 프로젝트의 admin도 Tailwind `3.4.17`을 사용하고 있어 버전 조건은 맞는다.

실무 추천:

- `dashboard`, `internal/system`, `reports` 같은 화면에는 도입 검토 가능
- `send`, `templates`, `rules`, `settings`에는 기본 UI 시스템으로 채택하지 않는 쪽을 우선 검토

### 12-2. Tremor + shadcn/ui + Radix 조합 원칙

결론:

- 같이 쓸 수는 있다.
- 하지만 "같은 역할의 컴포넌트"를 여러 시스템에서 섞으면 금방 일관성이 깨진다.

권장 구조:

- `Radix`: low-level primitive layer
- `shadcn/ui` 또는 자체 UI: product/settings/form/list의 기본 레이어
- `Tremor`: dashboard/charts/analytics 전용 레이어

좋은 사용 방식:

- settings/send/templates/rules 화면은 shadcn 기반으로 통일
- dashboard/operations/report 화면에서 Tremor 카드와 차트를 제한적으로 사용
- Dialog, Select, Input, Button, Table 같은 기본 인터랙션 컴포넌트는 한 시스템으로 통일

피해야 할 방식:

- 같은 페이지에서 Tremor 버튼 + shadcn 버튼을 같이 사용
- 설정 페이지에서 Tremor의 카드/폼 스타일을 기본 패턴처럼 쓰기
- 테이블, badge, input, modal의 시각 언어가 화면마다 바뀌는 상태

디자인 일관성을 유지하려면:

- typography token 하나로 통일
- color token 하나로 통일
- radius/shadow/spacing token 하나로 통일
- "어떤 UI는 어느 라이브러리가 담당하는가"를 문서로 고정

현재 프로젝트 기준 추천:

- 기본 선택:
  - `Radix + shadcn/ui 방식 + 자체 스타일 시스템`
- 선택 도입:
  - `Tremor`는 dashboard와 internal analytics 계열에만 사용

즉, Tremor를 "전면 디자인 시스템"으로 쓰기보다 "데이터 시각화 특화 레이어"로 두는 것이 더 안전하다.
