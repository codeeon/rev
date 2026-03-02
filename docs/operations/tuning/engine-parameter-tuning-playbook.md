# Engine Parameter Tuning Playbook (Toss-style)

## 1) Why this exists

현재 엔진은 스펙 준수 상태다. 다음 단계는 "맞는 수식"보다 "운영에서 더 좋은 해석 품질"을 만들기 위한 파라미터 튜닝이다.

이 문서는 아래를 한 번에 제공한다.

- 지표 정의표 (무엇을 성공으로 볼지)
- 실험 매트릭스 (어떤 값을 어떻게 바꿀지)
- 롤아웃/롤백 기준 (문제 생기면 언제 되돌릴지)

## 2) Toss-style 운영 원칙

1. 한 번에 하나만 바꾼다. (원인-결과 분리)
2. 배포 전에 성공/실패 기준을 숫자로 먼저 고정한다.
3. 빠르게 배포하되, 작은 트래픽으로 시작한다.
4. 롤백 기준을 먼저 써두고 시작한다.
5. 느낌이 아니라 로그+피드백으로 판단한다.

## 3) Current observable fields (code-aligned)

현재 코드에서 바로 수집 가능한 필드:

- Monitoring: `zishiMaxDiff`, `roleInfluence`, `top1Prob`, `top2Gap`, `stdSoftmax`, `stdRawScore`, `alerts.*` (`lib/engine/scoring.ts`)
- CUSP: `isCusp`, `gap`, `stdDev` (`lib/engine/scoring.ts`)
- Result UI: `inferredHour.confidence`, `inferredHour.isCusp`, 상위 후보 비율 (`app/result/page.tsx`)
- Feedback UI: 별점(1~5), 정확도 선택(`accurate|possible|unsure|inaccurate`) (`app/feedback/page.tsx`)

주의: 현재 피드백은 DB 저장이 없다(MVP). 튜닝 전 최소한 이벤트 저장이 필요하다.

## 4) KPI definition sheet (template)

아래 표를 실험 시작 전에 반드시 채운다.

| KPI | Definition | Source | Target | Guardrail |
| --- | --- | --- | --- | --- |
| CUSP Rate | `isCusp=true` 비율 | engine inference log | `__% ~ __%` | 급증 시 롤백 |
| Top1 Confidence Band Rate | `top1Prob`가 밴드 내 비율 | monitoring log | `>= __%` | 밴드 이탈 급증 금지 |
| High Core Dominance Rate | `roleInfluence.core > threshold` 비율 | monitoring log | `<= __%` | 임계 초과 지속 금지 |
| User Accuracy Positive Rate | `accurate + possible` 비율 | feedback event | `>= __%` | `inaccurate` 급증 금지 |
| Re-run Rate | 결과 보고 재시작(`/input` 재진입) 비율 | client event | `<= __%` | 급증 시 롤백 |

권장 최소 샘플:

- 일 단위 판단 금지
- 파라미터당 최소 `N >= 300` inference 세션 확보 후 판단

## 5) Parameter tuning backlog

| Parameter | Current | Risk | What to tune |
| --- | --- | --- | --- |
| `cusp_logic.min_score_std` | `0.8` | CUSP 미발동 가능성 | `stdSoftmax/stdRawScore` 분포 기반 재설정 |
| `cusp_logic.gap_threshold` | `0.05` | 과소/과대 CUSP 분류 | `top2Gap` + 피드백 상관 기반 조정 |
| `distribution_monitoring.target_top1_band` | `[0.5, 0.65]` | 과신/평탄 판정 불안정 | 실제 `top1Prob` 분포에 맞춰 밴드 보정 |
| `score_monitoring.alert_if_role_influence_over` | `0.65` | core 과지배 | 불만 케이스 집중 구간으로 임계 조정 |
| `approximate priorBoost` | `0.8` | 시간대 prior 과/소 영향 | with/without prior 변화율 기반 조정 |

## 6) Experiment matrix (template)

한 번에 1개 파라미터만 변경한다.

| Exp ID | Param | Control | Variant | Traffic | Primary KPI | Stop Rule |
| --- | --- | --- | --- | --- | --- | --- |
| E-001 | `min_score_std` | `0.8` | `__` | 10% -> 30% -> 50% | CUSP Rate, Accuracy Positive | Guardrail 1개라도 초과 시 즉시 중단 |
| E-002 | `gap_threshold` | `0.05` | `__` | 동일 | Accuracy Positive, Re-run Rate | 동일 |
| E-003 | `target_top1_band` | `[0.5,0.65]` | `[__,__]` | 동일 | Band Rate, Inaccurate Rate | 동일 |
| E-004 | `role_influence_over` | `0.65` | `__` | 동일 | High Core Dominance Rate | 동일 |
| E-005 | `priorBoost` | `0.8` | `__` | approximate 유저만 | Accuracy Positive (approx only) | 동일 |

## 7) Rollout plan (template)

1. Baseline 수집 (변경 없음, 7일)
2. 10% canary (24시간)
3. 30% 확장 (24~48시간)
4. 50% 또는 100% 확대
5. 종료 후 RCA(무엇이 개선/악화됐는지 1페이지 요약)

필수 규칙:

- baseline 기간 없이 파라미터 변경 금지
- 동시에 2개 이상 실험 금지
- 실험 중 문구/UX 대규모 변경 금지 (혼입 방지)

## 8) Rollback policy (template)

아래 중 하나라도 충족하면 즉시 롤백:

- `inaccurate` 비율이 baseline 대비 `+__%p` 이상 증가
- `top1OutOfBand` 비율이 baseline 대비 `+__%p` 이상 증가
- `roleInfluenceOver` 비율이 baseline 대비 `+__%p` 이상 증가
- 에러/장애(분석 실패, API 실패) 비율이 baseline 대비 `+__%p` 이상 증가

롤백 실행 체크:

1. 파라미터를 이전 값으로 즉시 복구
2. 영향 범위(세션 수, 시간대, 유입 채널) 기록
3. 24시간 내 회고 문서 작성

## 9) Event schema (minimal)

튜닝을 하려면 최소 아래 이벤트 저장이 필요하다.

### 9.1 inference_completed

```json
{
  "event": "inference_completed",
  "timestamp": "ISO-8601",
  "sessionId": "string",
  "engineVersion": "4.1",
  "params": {
    "gap_threshold": 0.05,
    "min_score_std": 0.8,
    "top1_band": [0.5, 0.65],
    "role_influence_over": 0.65,
    "prior_boost": 0.8
  },
  "monitoring": {
    "top1Prob": 0.0,
    "top2Gap": 0.0,
    "stdSoftmax": 0.0,
    "stdRawScore": 0.0,
    "zishiMaxDiff": 0.0,
    "roleInfluence": {
      "noise_reduction": 0.0,
      "core": 0.0,
      "fine_tune": 0.0,
      "closing": 0.0
    },
    "alerts": {
      "top1OutOfBand": false,
      "zishiMaxDiffOver": false,
      "roleInfluenceOver": false
    }
  },
  "result": {
    "isCusp": false,
    "confidence": 0
  }
}
```

### 9.2 feedback_submitted

```json
{
  "event": "feedback_submitted",
  "timestamp": "ISO-8601",
  "sessionId": "string",
  "rating": 1,
  "accuracy": "accurate"
}
```

## 10) Weekly operating cadence

주간 고정 루틴:

1. 월요일: baseline/실험 리포트 자동 생성
2. 화요일: 실험 지속/중단 의사결정
3. 수요일: 단일 파라미터 수정 배포
4. 목요일: 모니터링 + 피드백 샘플 리뷰
5. 금요일: 결과 회고 및 다음 실험 등록

## 11) Decision record template

```md
## Decision: E-00X
- Date:
- Owner:
- Parameter:
- Change: from __ to __
- Why now:
- Baseline window:
- Result summary:
- Rollback triggered?:
- Next action:
```

## 12) First recommended run (practical)

첫 사이클은 아래 순서를 권장한다.

1. 로그 저장 먼저 붙이기 (`inference_completed`, `feedback_submitted`)
2. baseline 7일 수집
3. `priorBoost`부터 실험 (approximate 사용자군 한정이라 blast radius 작음)
4. 그 다음 `gap_threshold`
5. 마지막으로 `min_score_std` 재정의

이 순서를 권장하는 이유:

- 영향 범위가 작은 파라미터부터 시작하면 리스크가 작다.
- CUSP 기준(`min_score_std`)은 가장 해석 영향이 커서 충분한 관측 후 조정해야 안전하다.
