# Session Handoff - 2026-03-15 Admin UI

## 1) 현재 상태 요약

완료:

- Auth.js 기반 `/admin` 조회 UI 1차 구현 완료
- `/admin/results`, `/admin/questions` 구현 완료
- `/admin/analytics`, question version detail/edit/publish 골격 구현 완료
- `/api/admin/analytics/summary`, `/api/admin/questions/publish-preview` 추가
- `QuestionDrafts` schema/parser와 `GET/POST /api/admin/questions/drafts` 추가
- `GET/PATCH /api/admin/questions/drafts/[draftId]`, diff helper, edit 화면 연결 완료
- `PATCH /api/admin/questions/drafts/[draftId]/status`, review-ready 전환, publish 화면 actual diff 연결 완료
- `POST /api/admin/questions/drafts/[draftId]/publish`와 실제 Questions snapshot publish 완료
- `session.user.role`, capability guard, mutation audit log 추가
- `AdminAuditLog` append-only 저장과 publish approval comment metadata 추가
- owner 전용 `/admin/audit`, `/api/admin/audit` 조회 추가
- `ApprovalLog` append-only 저장과 owner 전용 `/admin/approvals`, `/api/admin/approvals` 조회 추가
- `AdminAccessLog` / `AdminMutationLog` 분리 저장 추가
- `POST /api/admin/approvals/[approvalId]/rollback`과 `/admin/approvals` rollback action 추가
- rollback runbook 문서 추가
- `ApprovalRequests` 시트 기반 multi-step approval thread 추가
- `/api/admin/questions/drafts/[draftId]/approval-requests`, `/api/admin/questions/approval-requests/[requestId]/status` 추가
- `/admin/questions/publish`에서 request / approve / reject / publish gating 연결
- `sessionId`, `questionVersion`, `birthTimeKnowledge` exact filter 구현 완료
- Results 목록/상세 조회 모두 bounded recent-scan으로 제한
- `pnpm ci:monorepo` 통과
- admin 문서 세트 최신화 완료

보류:

- 실제 Google OAuth 운영값 등록
- `ADMIN_ALLOWED_EMAILS` 운영값 등록
- 실제 로그인 플로우 수동 검증

## 2) 다음 세션에서 먼저 읽을 문서

1. `docs/admin/authjs-admin-ui-phase-1-checklist.md`
2. `docs/admin/authjs-admin-ui-phase-2-expansion-plan.md`
3. `docs/admin/authjs-admin-ui-phase-2-api-contracts.md`
4. `docs/admin/question-approval-thread-runbook.md`
5. `docs/admin/question-publish-rollback-runbook.md`
6. `docs/admin/authjs-admin-ui-authoring-guide.md`

## 3) 현재 의사결정

- 인증/인가의 운영값 세팅은 뒤로 미룬다.
- 다음 구현 우선순위는 `관리자 웹` 자체를 먼저 확장하는 것이다.
- 즉, 실제 Google OAuth 수동 검증이 아직 없어도 phase 2 UI 작업은 계속 진행한다.

## 4) 다음 세션 권장 시작 순서

1. explicit role env에서 별도 role source로 이행할 기준 확정
2. approval request stale / auto-expire 정책 정의
3. approval / audit 조회 UX를 더 세분화할지 결정
4. rollback 후 smoke test 자동화가 필요한지 결정

권장 이유:

- read-only 화면 골격과 API 계약은 이미 있으므로, 다음부터는 실제 상태 전이와 mutation 경계를 굳히는 편이 효율적이다.
- 인증 운영값이 없어도 draft/publish 모델링과 role guard 준비를 계속 진행할 수 있다.

## 5) 현재 남은 운영 작업

- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `ADMIN_ALLOWED_EMAILS`

로컬 production mode 검증 시 권장:

- `AUTH_URL=http://localhost:3000`

주의:

- 위 값이 없으면 `/admin/login`에서 로그인 버튼이 비활성화된다.
- `pnpm --filter web start` 기준으로 `AUTH_URL`이 없으면 `UntrustedHost`가 발생할 수 있다.

## 6) 다음 세션 시작 명령 제안

```bash
pnpm --filter web test
pnpm --filter web typecheck
pnpm ci:monorepo
```

그 다음 첫 구현 타겟 하나를 잡는다.

예:

- `/admin/questions/[version]/edit`
- `/admin/questions/publish`
- `/api/admin/questions/drafts/[draftId]`
- `/api/admin/questions/drafts/[draftId]/status`
- `/api/admin/questions/drafts/[draftId]/approval-requests`
- `/api/admin/questions/drafts/[draftId]/publish`
- `/api/admin/questions/approval-requests/[requestId]/status`
- `/admin/audit`
- `/admin/approvals`
- `/api/admin/approvals/[approvalId]/rollback`

## 7) 최근 관련 커밋

- `a6d763d` `docs(admin): phase 1 현황과 phase 2 계획 정리`
- `15df9b0` `feat(admin): 결과 필터와 제한 조회 정책 확장`
- `c36e8ea` `fix(web): admin auth 테스트와 빌드 의존성 보정`
