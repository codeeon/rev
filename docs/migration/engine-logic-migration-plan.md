# Reverse Saju 엔진 로직 전환 계획 (v4.1 데이터 기준) - Codex

## 1. 목적

현재 코드의 임시 질문/가중치 로직을 폐기하고, `docs/data/engine.json` + `docs/engine-data-description.md`를 단일 소스로 사용하는 엔진으로 전환한다.

## 2. 범위

이번 전환의 범위는 아래 4가지다.

1. 질문 데이터 소스 교체: 코드 하드코딩 -> `engine.json` 기반.
2. 점수 계산 교체: 단순 합산 -> `question_weight × option_score` 누적 + Softmax(T=1.2).
3. 판정 로직 추가: Top1/Top2 + CUSP(하이브리드) 판정 + 모니터링 지표.
4. 리포트 입력 개선: MOI 요구사항(미러링 근거 2~3개, 단정형 금지 지침)을 AI 프롬프트 입력으로 전달.

## 3. 현재 구현과의 핵심 갭

1. 질문 데이터 불일치

- 현재: `lib/survey/questions.ts`의 임시 12문항.
- 목표: `engine.json`의 20문항(Q1~Q20), `structure_role`, `question_weight`, `score_map` 사용.

2. 계산 수식 불일치

- 현재: 질문 타입별 가중치 사전 선택 후 단순 합산 (`lib/survey/weight-engine.ts`).
- 목표: `score[zishi] = Σ(question_weight × option_score)`.

3. 확률화 및 판정 불일치

- 현재: `score / totalScore` 비율(softmax 아님), confidence도 단순 gap 비율.
- 목표: Softmax(T=1.2), Top1/Top2 gap, CUSP 규칙 적용.

4. 입력 구조 불일치

- 현재: `yn/scale/choice` 혼합 타입.
- 목표: `engine.json`은 실질적으로 객관식 옵션 선택형 구조(각 옵션에 `score_map`).

5. 운영 가드레일 미구현

- 현재: role 영향도, 분포 모니터링, 이론 최대 편차 경고 없음.
- 목표: 스펙의 모니터링 항목 계산/로깅.

6. 리포트 근거 전달 부족

- 현재: 설문 요약을 `questionId: value` 문자열로만 전달.
- 목표: 점수 기여 상위 core 문항 2~3개를 근거로 미러링 가능한 구조화 텍스트 전달.

## 4. 목표 아키텍처

권장 모듈 분리:

1. `lib/engine/types.ts`

- engine.json 스키마 타입 정의.
- `structure_role` enum: `noise_reduction | core | fine_tune | closing`.
- 출력 타입: raw score, softmax prob, top candidates, cusp flag, monitoring.

2. `lib/engine/loader.ts`

- `docs/data/engine.json` 로드/정규화.
- 12시진 한글 키(`자시`)와 내부 지지 코드(`子`) 매핑.
- 질문/옵션 ID 인덱스 생성.

3. `lib/engine/scoring.ts`

- 누적 점수 계산.
- Softmax(T) 계산.
- confidence/gap/cusp 계산.
- role influence, max diff, top1 band 등 모니터링 지표 계산.

4. `lib/engine/mirroring.ts`

- core 문항 중 기여 절대값이 큰 2~3개 추출.
- LLM 프롬프트 입력용 근거 문장 생성(질문 텍스트 + 선택지 + 기여 시진).

5. 기존 설문 연결 레이어

- `lib/survey/questions.ts`: 엔진 데이터 기반으로 UI용 질문 리스트 생성.
- `lib/survey/weight-engine.ts`: 신규 엔진 호출 래퍼로 대체.

## 5. 데이터 계약 설계

## 5.1 입력(answer)

각 응답은 아래 정보만 있으면 계산 가능하도록 통일.

- `questionId: string` (예: Q1)
- `optionIndex: number` 또는 `optionText: string`

권장: `optionIndex` 저장.

- 이유: 옵션 텍스트 변경(카피 수정)에도 계산 안정성 유지.

## 5.2 내부 매핑

- `zishi_ko -> EarthlyBranch` 매핑 테이블 추가.
- 예: `자시 -> 子`, `축시 -> 丑` ...

## 5.3 출력(result)

- `scoresRaw`: 12시진 raw score.
- `probs`: 12시진 softmax 확률(0~1).
- `topCandidates`: 확률 순 상위 N.
- `inferredBranch`: Top1 branch.
- `confidence`: 백분율(정의 고정 필요, 아래 6.5 참고).
- `cusp`: `{ isCusp, gap, std, candidateA, candidateB }`.
- `monitoring`: role influence/max diff/top1 band 등.
- `mirroringSignals`: core 기여 상위 2~3 문항.

## 6. 계산 로직 상세

## 6.1 점수 누적

각 답변에 대해:

1. 질문 `q` 조회.
2. 선택 옵션 `o` 조회.
3. `weighted = q.question_weight * o.score_map[zishi]`.
4. 12개 시진에 누적.

점수가 없는 시진은 0으로 처리.

## 6.2 Softmax

`T = engine_settings.default_temperature(=1.2)` 사용.

- 수치 안정성을 위해 `x_i = (score_i - max_score) / T` 적용 후 exp.
- `prob_i = exp(x_i) / Σexp(x_j)`.

## 6.3 Top 후보

- `probs` 내림차순 정렬.
- 상위 3개를 결과에 포함.

## 6.4 CUSP 판정

스펙 조건:

- `(top1_prob - top2_prob < gap_threshold)`
- `std(12_zishi_softmax_scores) > min_score_std`

주의: softmax 확률의 표준편차는 일반적으로 0~0.3 수준이므로, `min_score_std=0.8`은 현실적으로 발동 불가에 가깝다.

구현 계획:

1. 1차 구현은 스펙 그대로 계산.
2. 동시에 `std_softmax`와 `std_raw_score`를 모두 모니터링 값으로 기록.
3. 운영 데이터 수집 후 임계값 재보정(설정 파일화).

## 6.5 confidence 정의

기존 `(top1-top2)/top1` 대신 확률 기반으로 고정:

- 후보안 A: `confidence = top1_prob * 100`.
- 후보안 B: `confidence = (top1_prob - top2_prob) * 100`.

권장: UI 신뢰도 의미가 직관적인 A를 채택하고, B는 내부 모니터링으로 병행 노출.

## 6.6 모니터링(Guardrails)

매 요청마다 계산:

1. `zishi_max_diff = max(raw) - min(raw)`.
2. `role_influence_core = (core 절대기여합 / 전체 절대기여합)`.
3. `top1_prob`, `top2_gap`.
4. 경고 플래그:

- `zishi_max_diff > alert_if_zishi_max_diff_over`
- `role_influence_core > alert_if_role_influence_over`
- `top1_prob`이 `target_top1_band` 바깥

초기엔 서버 로그/콘솔에 JSON으로 기록하고, 이후 분석 저장소로 연결.

## 7. 화면/플로우 변경 계획

1. 설문 렌더링

- 현재 `yn/scale/choice` 컴포넌트 혼용 -> 옵션형 질문 1종 컴포넌트 중심으로 단순화.
- 질문 텍스트/옵션 텍스트는 `engine.json` 원문 사용.

2. 응답 저장 구조

- `SurveyAnswer`를 `questionId + optionIndex` 기반으로 변경.

3. 결과 표시

- 기존 `topCandidates`, `confidence` 영역 재사용.
- CUSP일 때는 “두 시진 경합” 안내 문구와 2개 후보 결합 설명 활성화.

4. 대략 시간대(approximate) 연동

- 현재 저장만 하고 계산 미반영 상태.
- 계획: approximate range를 prior로 사용해 해당 시간대 외 시진에 약한 패널티 또는 확률 사후정규화 적용.
- 이 부분은 제품 의사결정 필요(강한 마스킹 금지 권장).

## 8. AI 리포트(프롬프트) 변경 계획

`buildAnalysisPrompt` 입력에 아래 추가:

1. `inferenceMeta`

- top1/top2 확률, gap, cusp 여부.

2. `mirroringSignals`

- core 기여 상위 2~3개:
- 질문 문장
- 사용자 선택지
- 어떤 시진 점수에 어떤 방향으로 기여했는지

3. 문체 가드레일

- 단정형 금지 지침 명시: “~일 가능성이 높다/경향이 있다”.
- Therapist 톤 명시.

## 9. 구현 순서 (PR 단위)

PR1. 엔진 데이터 로더 + 타입 + 순수 계산기

- UI/기존 플로우 변경 없이 테스트 가능한 pure function 완성.

PR2. 설문 UI를 엔진 데이터 기반으로 교체

- 질문/옵션 렌더링, 응답 구조 교체.

PR3. 결과 화면 + CUSP UX + confidence 표기 정비

- 기존 결과 페이지 연결.

PR4. AI 프롬프트에 미러링 근거 주입

- 분석 텍스트 품질 개선.

PR5. 모니터링 로그 및 운영 임계값 점검

- 실제 분포 데이터 기반 threshold 재보정.

## 10. 테스트 계획

## 10.1 단위 테스트

1. 점수 누적 검증

- 샘플 답변 1세트로 raw score snapshot 테스트.

2. Softmax 검증

- 확률 합이 1(허용오차 내)인지 검증.

3. CUSP 판정 검증

- 인위적 score 세트로 true/false 케이스 분리 테스트.

4. 음수 점수(Soft-Elimination) 검증

- -6 가중 옵션이 기대대로 확률을 낮추는지 검증.

5. role influence 검증

- core 편향이 0.65 초과 시 경고 플래그 true 확인.

## 10.2 통합 테스트

1. 실제 설문 진행 -> 결과 페이지까지 e2e.
2. unknown/approximate/known 분기별 결과 생성 확인.
3. API analyze 호출 시 프롬프트 컨텍스트에 mirroringSignals 포함 여부 확인.

## 11. 오픈 이슈 (사전 합의 필요)

1. CUSP의 `min_score_std=0.8` 기준

- softmax std 기준이면 사실상 미발동 가능성이 높음.
- 운영 로그 수집 후 기준 재정의 필요.

2. confidence 공식 최종 선택

- 사용자 노출용은 `top1_prob` 권장 여부 확정.

3. approximate range 반영 강도

- 하드 마스킹 vs 소프트 prior 중 결정 필요.

4. 질문 문항 수

- 현재 20문항 고정으로 갈지, 역할별 랜덤 샘플링을 허용할지.

## 12. 완료 기준 (Definition of Done)

1. 코드상 질문/점수 하드코딩이 제거되고 `engine.json` 기반으로 동작한다.
2. 계산이 `question_weight × option_score -> softmax(T=1.2)`로 동작한다.
3. Top 후보 + CUSP + 모니터링 지표가 결과 객체로 생성된다.
4. 리포트 프롬프트에 core 기반 미러링 근거 2~3개가 전달된다.
5. 단위/통합 테스트가 통과한다.
