# Engine Tuning Next Actions Plan

## 1) Objective

`engine-parameter-tuning-playbook.md`를 실제 운영 루프로 연결하기 위해, 바로 착수 가능한 후속 작업을 단계별로 정의한다.

범위:

- 문서/운영 준비
- 이벤트 수집 설계
- baseline 리포트 설계
- 실험 운영 준비

비범위:

- 파라미터 값 자체 변경
- 엔진 알고리즘 수정

## 2) Workstream Overview

| Stream | Goal | Owner | ETA | Deliverable |
| --- | --- | --- | --- | --- |
| S1. Tracking Spec | 이벤트 정의 확정 | Eng + Data | D+2 | 추적 스펙 문서 v1 |
| S2. Event Pipeline | inference/feedback 저장 경로 마련 | Eng | D+5 | 이벤트 전송 + 저장 검증 |
| S3. Baseline Report | 실험 전 기준선 확보 | Data | D+10 | baseline 리포트 v1 |
| S4. Experiment Ops | canary/rollback 운영체계 | Eng + PM | D+12 | 실험 체크리스트 + 런북 |

## 3) Detailed Plan

### S1. Tracking Spec (문서 확정)

목표: "무엇을 어떤 필드로 수집할지"를 팀 합의 상태로 고정.

작업:

1. 이벤트 2종 확정
   - `inference_completed`
   - `feedback_submitted`
2. 필수 필드/옵션 필드 분리
3. PII 비포함 규칙 명시
4. 이벤트 버전 필드(`schemaVersion`) 추가

완료 기준:

- 이벤트별 필수 필드 정의 완료
- 샘플 payload와 validation rule 문서화 완료

### S2. Event Pipeline (수집 경로)

목표: 이벤트가 유실 없이 저장되고, 재현 가능한 형태로 조회 가능.

작업:

1. 전송 지점 정의
   - 추론 완료 시점
   - 피드백 제출 시점
2. 실패 재시도 정책
   - 1회 즉시 재시도 + 백오프
3. 저장소 스키마 매핑
4. QA 시나리오
   - 정상 저장
   - 네트워크 오류
   - 중복 제출

완료 기준:

- 샘플 100건에서 유실률 0%
- 중복 키 정책(sessionId + timestamp bucket) 정의 완료

### S3. Baseline Report (7일 기준선)

목표: 실험 전 현재 상태를 숫자로 고정.

필수 지표:

- `isCusp` 비율
- `top1Prob` 분포 (p50/p75/p90)
- `top2Gap` 분포
- `stdSoftmax`, `stdRawScore` 분포
- `roleInfluence.core` 분포
- `alerts.top1OutOfBand`, `alerts.roleInfluenceOver`, `alerts.zishiMaxDiffOver` 비율
- 피드백: `accurate|possible|unsure|inaccurate` 비율 + 평점 평균

완료 기준:

- 7일 rolling 리포트 자동 생성
- 실험 판단용 baseline snapshot 고정

### S4. Experiment Ops (실험 운영)

목표: 파라미터 실험을 안전하게 반복 가능하도록 운영 절차 확립.

작업:

1. 실험 템플릿 고정
   - 실험 ID
   - 단일 파라미터
   - success/guardrail/rollback 기준
2. 단계 배포 플랜
   - 10% -> 30% -> 50% -> 100%
3. 중단/롤백 실행 책임자 지정
4. 주간 운영 캘린더 고정

완료 기준:

- 실험 시작 전 체크리스트 100% 충족
- 롤백 드릴 1회 수행 및 기록

## 4) Immediate Backlog (순서 고정)

1. Tracking Spec v1 승인
2. `feedback_submitted` 저장 연결
3. `inference_completed` 저장 연결
4. Baseline 대시보드 쿼리 확정
5. Baseline 7일 수집 시작
6. E-001 실험 계획서 작성 (`priorBoost` 우선)

## 5) Risk Register

| Risk | Impact | Mitigation |
| --- | --- | --- |
| 이벤트 미저장/유실 | 실험 판단 불가 | 전송 실패 재시도 + 유실 알림 |
| 여러 변경 동시 반영 | 원인 분리 실패 | 1실험 1파라미터 원칙 강제 |
| 샘플 부족 | 통계 왜곡 | 최소 표본(`N>=300`) 미달 시 보류 |
| 피드백 편향 | 의사결정 왜곡 | rating + accuracy 동시 해석 |

## 6) Deliverable Checklist

- [ ] Tracking Spec 문서 v1
- [ ] Event schema validation rule
- [ ] Baseline 리포트 템플릿
- [ ] 실험 체크리스트 템플릿
- [ ] 롤백 런북

## 7) Definition of Ready (for first tuning experiment)

아래를 모두 충족해야 첫 실험(E-001) 시작 가능:

1. 이벤트 저장이 운영 환경에서 안정화됨
2. baseline 7일 데이터 확보됨
3. success/guardrail/rollback 수치가 문서로 고정됨
4. 실험 오너/승인자/롤백 담당자가 지정됨
