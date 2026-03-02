# 사주 역추론 엔진 마이그레이션 계획 (v4.1)

본 문서는 `docs/data/engine.json` 및 `docs/engine-data-description.md`의 "Reverse Saju MVP 엔진 데이터 v4.1" 명세에 따라 현재 임시 데이터로 구현된 사주 역추론 로직을 실제 서비스 기준으로 마이그레이션하기 위한 상세 계획 문서입니다.

## 1. 개요 및 설계 철학
기존의 단순 합산(Linear Summation) 방식에서 벗어나, 사용자의 현대적 라이프스타일(습관)을 통해 타고난 명리학적 기운을 역추론하는 **확률 기반 엔진**으로 고도화합니다.
목표는 점술 앱이 아닌, 심리테스트 형태의 설문을 통해 도출된 결과를 "당신만의 특별한 강점"으로 치환하여 위로(Therapeutic)하는 **미러링(Mirroring) 사주 서비스**를 구축하는 것입니다. 신뢰도는 항상 %로 투명하게 제시됩니다.

## 2. 핵심 알고리즘 변경 (`lib/survey/weight-engine.ts`)

엔진은 다음의 3단계 파이프라인으로 재구성됩니다: **[가중치 누적 -> Softmax 변환 -> CUSP 판정]**

### 1단계: 가중치 누적 점수 (Weight Accumulation)
*   **공식:** `S_{zishi} = Σ(question_weight × option_score)`
*   각 문항은 `structure_role`에 따라 고유의 가중치(`question_weight`)를 가집니다.
    *   `noise_reduction`: 0.8 (초기 웜업 및 이탈 방지)
    *   `core`: 1.5 (강력한 판별, 특정 시진에 대한 강한 긍정(+4) 및 음수(-6) 점수 포함)
    *   `fine_tune`: 1.2 (1, 2위 경합 시진 간의 미세한 격차 조정)
    *   `closing`: 1.0 (마무리)

### 2단계: 확률 변환 (Softmax Transformation)
*   단순 점수 합산이 아닌, 결과의 확신도를 명확하게 드러내는 Softmax 함수를 적용합니다.
*   **공식:** `P_i = exp(S_i / T) / Σ(exp(S_j / T))`
*   **Temperature (T):** `1.2` (기본값). 결과의 확신도를 조절하는 상수로 환경변수 처리를 권장합니다.

### 3단계: 하이브리드 판정 (CUSP Logic)
실제 두 시진이 강력하게 경합할 때만 하이브리드 리포트를 제공하기 위한 로직입니다.
*   **발동 조건:** 
    1.  `(Top 1 확률 - Top 2 확률) < 0.05` (gap_threshold)
    2.  `StandardDeviation(12개 시진의 Softmax 확률) > 0.8` (min_score_std)
*   의미 없는 평탄한 분포가 아닌, 실제 유의미한 경합 상태에서만 발동됩니다.

## 3. 모니터링 및 안정성 (Guardrails)
*   **지배력 제한:** 특정 질문군(Core)의 영향력이 전체 잠재 점수의 **65%**를 넘지 않도록 설계 및 모니터링합니다. (`alert_if_role_influence_over`: 0.65)
*   **Soft-Elimination:** -6 점수는 강력한 소거 장치이지만, 다른 답변들에 의해 복구 가능한 유연한 차단 방식임을 인지하고 엔진을 구현합니다.

## 4. 데이터 및 타입 마이그레이션 (`lib/survey/types.ts`, `lib/survey/questions.ts`)

### 타입 업데이트 (`types.ts`)
*   `SurveyQuestion` 인터페이스에 `id`, `structure_role`, `category`, `question_weight` 필드를 추가합니다.
*   옵션 데이터의 `score_map` 구조를 명확히 정의합니다. (12지신 키와 숫자 값)
*   엔진 분석 결과 타입에 Softmax 확률(`probabilities`), CUSP 판정 여부(`isCusp`), 경합 시진(Top 2) 정보를 추가합니다.

### 설문 데이터 교체 (`questions.ts`)
*   기존 임시 설문 데이터를 모두 삭제하고 `engine.json`에 정의된 20개 문항 데이터를 이식합니다.

## 5. AI 리포트 및 미러링 로직 (`app/api/analyze/route.ts`, `lib/ai/prompts.ts`)

AI 리포트는 "당신은 ~입니다"라는 단정적 어조(X)를 피하고, "~할 확률이 높습니다 / ~하는 경향을 보입니다"(O)와 같이 분석적이되 차갑지 않은 '따뜻한 상담가(Therapist)'의 톤앤매너를 유지해야 합니다.

### 미러링 데이터 추출 로직
1.  분석 엔진 파이프라인에서, **점수 변동폭에 가장 크게 기여한 `core` 문항 2~3개**의 응답값을 식별합니다.
2.  해당 문항의 질문과 사용자의 선택을 AI 프롬프트의 컨텍스트로 주입합니다.

### AI 프롬프트 수정 (`prompts.ts`)
*   **미러링 지시어 추가:** "유저가 설문에서 선택한 답변(데이터)을 사주 명리학과 연결하여, '당신이 ~하게 행동했던 이유는 당신의 사주에 품어진 당신만의 특별한 강점이다'라고 미러링하여 위로할 것."
*   **CUSP 대응 프롬프트:** CUSP 로직이 발동된 경우(gap < 0.05), 두 시진의 특성을 융합한 조건부 문장(Fallback) 구조를 제시하도록 프롬프트를 구성합니다.

## 6. UX 및 마이크로카피 가이드라인
*   선택지 마이크로카피 작성 시 유저가 예외적 상황이 아닌 **'장기적 리듬'**을 선택하도록 유도해야 합니다.
*   질문과 답변의 과정 자체가 흥미로운 심리테스트처럼 느껴지도록 포장합니다.

## 7. 단계별 작업 순서

1.  **[Types]** `lib/survey/types.ts` 업데이트 (엔진 설정, 문항 구조, 결과 타입 반영)
2.  **[Data]** `lib/survey/questions.ts`에 `engine.json` 데이터 20문항 이관
3.  **[Engine]** `lib/survey/weight-engine.ts` 알고리즘 전면 개편 (가중치 누적, Softmax 변환, T=1.2, CUSP 로직 적용)
4.  **[Engine]** 최다 기여 문항(Mirroring Data) 추출 로직 추가
5.  **[Store/State]** 변경된 엔진 결과를 전역 상태에 반영할 수 있도록 리듀서 업데이트 (`lib/store.tsx`)
6.  **[AI Prompt]** `lib/ai/prompts.ts` 미러링, 단정형 금지, CUSP 대응 프롬프트 적용
7.  **[UI]** 최종 결과 페이지에 신뢰도(%) 표시 및 CUSP 상태일 때의 UI/UX 대응 (`app/result/page.tsx`)
8.  **[Test]** 모니터링 기준(Core 영향력 등) 검증 및 T=1.2 환경에서의 확률 분포 테스트
