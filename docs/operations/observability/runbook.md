# Observability Runbook

## 장애 대응 절차

1. Sentry에서 신규 이슈 확인
2. 릴리즈(`NEXT_PUBLIC_APP_RELEASE`)와 배포 시점 대조
3. 영향 페이지/플로우 확인 (`/input`, `/survey`, `/analyzing`, `/result`)
4. 동일 시점 GA 지표 이탈 여부 확인
5. 완화 조치 후 회귀 모니터링

## 체크리스트

- Sentry DSN이 잘못 비어있지 않은가
- 환경값(`NEXT_PUBLIC_APP_ENV`)이 맞는가
- 샘플링 값이 과도하지 않은가
- GA 측정 ID가 잘못된 속성을 가리키지 않는가

## 사후 분석 템플릿

- Incident ID:
- 발생 시각:
- 최초 탐지 채널:
- 영향 범위:
- 근본 원인:
- 임시 조치:
- 영구 조치:
- 재발 방지 항목:
