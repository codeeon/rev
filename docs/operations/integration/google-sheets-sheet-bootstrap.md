# Google Sheets 시트 초기화 빠른 시작

질문지 원본과 결과 저장 헤더를 Google Sheets에 처음 붙여 넣을 때 필요한 최소 절차만 정리한 문서다.

- 대상: 운영 스프레드시트를 처음 만드는 사람
- 목적: `Questions` 시트와 `Results` 시트를 코드 기준 스키마로 빠르게 초기화

관련 상세 문서:

- `docs/operations/integration/google-sheets-usage-guide.md`
- `docs/operations/env-registration-guide.md`

## 1) 준비

- Google Sheets 문서 하나 생성
- 시트 이름을 `Questions`, `Results`로 준비
- 저장소 루트에서 명령 실행

## 2) Questions 시트 생성

엔진 원본 질문을 시트 포맷 TSV로 내보낸다.

```bash
pnpm run export:questions-sheet --output tmp/rev-questions.tsv
```

출력 파일:

- `tmp/rev-questions.tsv`

붙여 넣는 방법:

1. 생성된 TSV 파일을 텍스트 편집기로 연다.
2. 전체 내용을 복사한다.
3. Google Sheets의 `Questions` 시트 `A1`에 붙여 넣는다.

포함 내용:

- 헤더 1줄
- 현재 `engine.json` 기준 질문/선택지 전체
- `scoreMapJson` 컬럼의 JSON 값
- `isActive=true`
- 실행 시각 기준 `updatedAt`

고정 시각으로 만들고 싶으면:

```bash
pnpm run export:questions-sheet --output tmp/rev-questions.tsv --updated-at 2026-03-10T00:00:00.000Z
```

## 3) Results 시트 생성

결과 저장 헤더만 TSV로 내보낸다.

```bash
pnpm run export:results-sheet --output tmp/rev-results.tsv
```

출력 파일:

- `tmp/rev-results.tsv`

붙여 넣는 방법:

1. 생성된 TSV 파일을 연다.
2. 전체 내용을 복사한다.
3. Google Sheets의 `Results` 시트 `A1`에 붙여 넣는다.

포함 내용:

- 헤더 1줄만 포함

## 4) 현재 컬럼 스키마

### Questions

- `version`
- `questionId`
- `structureRole`
- `category`
- `questionWeight`
- `questionText`
- `optionIndex`
- `optionText`
- `scoreMapJson`
- `isActive`
- `updatedAt`

### Results

- `sessionId`
- `timestamp`
- `engineVersion`
- `questionVersion`
- `birthTimeKnowledge`
- `approximateRangeJson`
- `surveyAnswersJson`
- `inferenceResultJson`
- `monitoringJson`
- `feedbackJson`

## 5) 다음 단계

시트 초기화 후에는 아래 순서로 연결을 마무리한다.

1. 서비스 계정 이메일을 해당 스프레드시트에 공유
2. `apps/web/.env.local` 또는 배포 환경에 Sheets 관련 env 등록
3. `/survey`에서 질문 로드 확인
4. `/feedback` 제출 후 `Results` 시트 append 확인

## 6) 자주 틀리는 점

- `Questions` 시트 이름이 다르면 기본 range `Questions!A:K`와 맞지 않는다.
- `Results` 시트 이름이 다르면 기본 range `Results!A:J`와 맞지 않는다.
- `Questions`는 헤더만이 아니라 질문 행 전체를 붙여 넣어야 한다.
- `Results`는 헤더만 먼저 있어도 된다.
- 서비스 계정에 Editor 권한이 없으면 결과 저장이 실패한다.
