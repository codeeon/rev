# Google Sheets Package Architecture

## 1) 목적

운영 스프레드시트를 Source of Truth로 사용하되, 앱 런타임이 시트 포맷 변화에 직접 노출되지 않도록
`시트 -> 정규화 계층 -> 앱` 경계를 패키지 단위로 고정한다.

이 문서는 다음 두 패키지의 책임과 경계를 정의한다.

- `@workspace/google-sheets` (`packages/operations/google-sheets`)
- `@workspace/spreadsheet-admin` (`packages/operations/spreadsheet-admin`)

실제 운영 설정/검증 절차는 아래 사용 가이드를 함께 참고한다.

- `docs/operations/integration/google-sheets-usage-guide.md`

## 2) 설계 원칙

`docs/operations/integration/spreadsheet-admin-integration-principles.md`의 비협상 원칙을 구현 계층에 그대로 반영한다.

- 계산 규칙(도메인)과 운영 데이터(시트)는 분리
- 시트 스키마 검증 없이 반영 금지
- 버전 없는 운영 변경 금지
- 저장 실패가 사용자 UX를 막지 않도록 분리 설계
- 비밀값은 서버 환경변수로만 관리

## 3) 패키지 배치와 경계

### 3.1 패키지 트리

```text
packages/
  operations/
    google-sheets/
    spreadsheet-admin/
```

### 3.2 책임 분리

#### `@workspace/google-sheets`

- Google Sheets API 호출 전용 인프라 패키지
- 인증 토큰 공급자, HTTP transport, retry/backoff, resource helper 제공
- 도메인 필드(`questionId`, `scoreMapJson`)를 알지 못함
- 서버 전용 패키지(browser import 방지)

#### `@workspace/spreadsheet-admin`

- 운영 시트 스키마 검증 및 정규화
- last-known-good fallback 정책
- 결과 저장 row 직렬화 및 append 유스케이스
- `@workspace/time-inference` 타입을 목표 스키마로 사용

### 3.3 의존성 방향

- `apps/web` -> `@workspace/spreadsheet-admin` / `@workspace/google-sheets`
- `@workspace/spreadsheet-admin` -> `@workspace/google-sheets`, `@workspace/time-inference`
- `@workspace/domain/*` -> (operations 패키지 의존 금지)

## 4) 폴더 구조

```text
packages/operations/google-sheets/
  src/
    auth/
      types.ts
      oauth-user.ts
      service-account.ts
    transport/
      types.ts
      retry.ts
      googleapis-transport.ts
    resources/
      values.ts
      spreadsheets.ts
    errors.ts
    index.ts
    server.ts
    server-only.ts
    browser.ts

packages/operations/spreadsheet-admin/
  src/
    question-source/
      admin-sheet-schema.ts
      normalize.ts
      load-question-set.ts
    result-sink/
      result-schema.ts
      append-result.ts
    sync/
      last-known-good.ts
      sync-from-sheet.ts
    index.ts
    server.ts
    server-only.ts
    browser.ts
```

## 5) 공개 API 계약

### 5.1 `@workspace/google-sheets`

- `createSheetsClient(options)`
- `values.get`, `values.batchGet`, `values.batchUpdate`, `values.append`
- `spreadsheets.batchUpdate`
- `createOAuthUserTokenProvider`, `createServiceAccountTokenProvider`

### 5.2 `@workspace/spreadsheet-admin`

- `loadQuestionSetFromSheet(options)`
- `normalizeAdminSheetRows(rows)`
- `syncQuestionSetWithFallback({ loadLatest, store })`
- `appendAnalysisResult(options)`

## 6) 런타임 데이터 흐름

### 6.1 질문 세트 동기화

1. `google-sheets.values.get`으로 운영 시트 조회
2. `admin-sheet-schema`에서 row 단위 검증/파싱
3. `normalize`에서 `EngineQuestion[]` 정규화
4. 성공 시 last-known-good 저장, 실패 시 기존 last-known-good fallback

### 6.2 결과 저장

1. 분석 결과를 `result-schema` 계약으로 검증
2. 시트 row 포맷으로 직렬화
3. `google-sheets.values.append`로 저장

## 7) 보안/서버 전용 가드

- 두 패키지 모두 `server-only.ts`와 `browser.ts`로 클라이언트 import를 방지
- `package.json#exports.browser`를 throw 모듈로 매핑
- 서비스 계정 키, OAuth 토큰은 서버 환경변수/서버 저장소에서만 사용
- 클라이언트 전달이 가능한 `NEXT_PUBLIC_*` 경로로 비밀값을 노출하지 않음

## 8) 실패 처리 정책

- 질문 로드 실패: last-known-good 존재 시 fallback, 없으면 오류 전파
- 결과 저장 실패: 호출자에서 UX 분리(비동기 재시도/큐 연결 가능)
- 네트워크/429/5xx: transport retry 정책으로 완화

## 9) 테스트 전략

- `@workspace/google-sheets`
  - retry/backoff 단위 테스트
  - auth provider 만료/갱신 경로 테스트
- `@workspace/spreadsheet-admin`
  - 스키마/정규화(중복 option, 필수 role 누락) 테스트
  - latest 실패 + fallback 복구 테스트

## 10) 운영 시 체크리스트

- [ ] 운영 시트 헤더가 `ADMIN_SHEET_HEADERS`와 일치하는지 확인
- [ ] `version` 컬럼이 모든 active row에 동일한지 확인
- [ ] `scoreMapJson` 키가 12시진 집합만 사용하는지 확인
- [ ] 결과 저장 range 권한(append) 분리 여부 확인
- [ ] 비밀값이 서버 환경변수 경로에서만 사용되는지 확인
