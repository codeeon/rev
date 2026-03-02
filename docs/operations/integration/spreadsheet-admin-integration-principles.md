# Spreadsheet Admin Integration Principles

## 1) Why this document

이 문서는 앞으로의 운영 구조에서 변하지 않아야 할 원칙을 먼저 고정하기 위한 선행 문서다.

핵심 전제:

1. 질문/점수 데이터는 바뀔 수 있다.
2. 앱은 계산 엔진 역할에 집중한다.
3. 운영자는 스프레드시트 기반으로 질문/점수를 관리한다.
4. 사용자 입력과 결과는 운영자 스프레드시트로 저장된다.

## 2) North Star Architecture

### 2.1 Question Source of Truth

- Source of Truth는 코드 하드코딩이 아니라 운영자 스프레드시트다.
- 앱은 스프레드시트에서 동기화된 데이터(또는 캐시)를 읽어 계산만 수행한다.
- 엔진 로직(가중치 누적, softmax, CUSP)은 코드에서 유지한다.

### 2.2 Result Sink

- 사용자 응답/추론 결과/피드백은 운영자 스프레드시트(또는 그 백엔드 파이프라인)에 기록한다.
- 저장 목적: 품질 모니터링, 운영 튜닝, 질문 개선.

## 3) Non-negotiable Principles

1. 계산 규칙과 운영 데이터는 분리한다.
   - 규칙: 코드
   - 질문/점수/운영 파라미터: 데이터
2. 버전 없는 운영 변경 금지.
   - 질문 세트는 반드시 `version` 필드를 가진다.
3. 스키마 검증 없이 반영 금지.
   - 잘못된 시트 값은 즉시 reject하고 이전 안정 버전 유지.
4. 저장 실패가 사용자 경험을 막지 않게 설계한다.
   - 결과 저장은 비동기/재시도 전략 적용.
5. 개인정보 최소수집 원칙을 지킨다.

## 4) Spreadsheet-driven Question Model (minimum)

운영 시트는 최소 아래 필드를 가져야 한다.

- `version`
- `questionId` (Q1~)
- `structureRole` (`noise_reduction|core|fine_tune|closing`)
- `category`
- `questionWeight`
- `questionText`
- `optionIndex`
- `optionText`
- `scoreMapJson` (12시진 키-값)
- `isActive`
- `updatedAt`

검증 규칙:

- 중복 `questionId + optionIndex` 금지
- `scoreMapJson` 키는 허용된 시진 집합만 사용
- `questionWeight` 음수 금지
- 필수 role 누락 금지

## 5) Runtime Loading Strategy

권장 흐름:

1. Admin 시트 편집
2. 동기화 작업이 내부 정규 JSON 생성
3. 앱은 정규 JSON만 로드
4. 검증 실패 시 last-known-good 버전 유지

이유:

- 앱이 외부 시트 포맷 변화에 직접 노출되면 장애 위험이 커진다.
- "시트 -> 정규화 계층 -> 앱" 구조가 운영 안정성이 가장 높다.

## 6) User Data Save Scope (minimum)

저장 대상(권장):

- `sessionId`
- `timestamp`
- `engineVersion`
- `questionVersion`
- `birthTimeKnowledge` (`known|unknown|approximate`)
- `approximateRange` (있을 때만)
- `surveyAnswers` (`questionId`, `optionIndex`)
- `inferenceResult` (`inferredZishi`, `confidence`, `isCusp`, `topCandidates`)
- `monitoring` (`top1Prob`, `top2Gap`, `stdSoftmax`, `stdRawScore`, `roleInfluence`, `alerts`)
- `feedback` (`rating`, `accuracy`) - 제출 시점

## 7) Privacy and Security Guardrails

1. 개인식별 정보 최소화
   - 이름/정확한 생년월일 원문 저장 여부는 정책으로 분리
2. 시트 접근권한 최소화
   - 읽기/쓰기 계정 분리
3. 감사 로그 필수
   - 누가 질문을 바꿨는지 추적 가능해야 함
4. 키/토큰은 서버 환경변수로만 관리

## 8) Failure Handling Policy

### 8.1 Question load failure

- 동작: 마지막 정상 버전으로 fallback
- 알림: 운영자 채널에 즉시 경고

### 8.2 Result save failure

- 동작: 사용자 플로우는 성공 처리, 저장 작업은 재시도 큐로 이동
- 정책: 재시도 횟수/TTL 초과 시 dead-letter로 분리

## 9) Operational Workflow

1. 운영자: 시트에서 질문/점수 수정
2. 시스템: 스키마 검증 + 버전 발행
3. 앱: 새 버전 로드
4. 사용자: 설문/분석 진행
5. 시스템: 결과/피드백 저장
6. 운영팀: 대시보드 확인 후 파라미터/질문 개선

## 10) Definition of Done (for this direction)

- [ ] 질문 하드코딩 제거 또는 운영 데이터 우선 로드 구조 확정
- [ ] 시트 스키마 문서 + 검증기 규격 정의
- [ ] 질문 버전 관리 전략 확정
- [ ] 결과 저장 스키마 확정
- [ ] 저장 실패 재시도 정책 확정
- [ ] 개인정보 처리 방침과 저장 항목 정렬

## 11) What to avoid

- 시트 포맷을 앱에서 직접 파싱해 즉시 사용
- 질문 변경 시 버전 없이 덮어쓰기
- 결과 저장 실패를 사용자 실패로 전파
- 분석 튜닝 지표 없이 질문만 빈번히 교체
