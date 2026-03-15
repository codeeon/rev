# Question Publish Rollback Runbook

기준 시점: `2026-03-15`

## 목적

질문 version publish 이후 문제가 발견됐을 때, 기존 승인 이력 기준으로 이전 snapshot을 다시 배포하는 운영 절차를 정리한다.

현재 rollback 방식:

- `ApprovalLog`에서 기준 approval 1건을 선택한다.
- 해당 approval이 가리키는 `draftId` snapshot을 다시 `Questions` 탭에 publish한다.
- rollback도 새 `ApprovalLog` row와 `AdminMutationLog` / `AdminAuditLog` event를 남긴다.

approval request 선행 절차는 별도 [question-approval-thread-runbook.md](/Volumes/sean/projects/side/rev/docs/admin/question-approval-thread-runbook.md) 기준을 따른다.

## 사전 조건

- 작업자는 `owner` 역할이어야 한다.
- 대상 approval의 `draftId`가 `QuestionDrafts` 탭에 남아 있어야 한다.
- rollback 사유와 확인 포인트를 `approvalComment`에 적는다.

## UI 절차

1. `/admin/approvals`로 이동한다.
2. 되돌릴 대상 approval을 선택한다.
3. `rollback changeSummary`에 되돌릴 버전을 명시한다.
4. `rollback comment`에 사유와 후속 확인 포인트를 남긴다.
5. `이 approval 기준으로 rollback publish`를 실행한다.

## API 절차

route:

- `POST /api/admin/approvals/[approvalId]/rollback`

body:

- `changeSummary`
- `approvalComment`

성공 시:

- `Questions` 탭이 선택한 approval의 draft snapshot으로 overwrite된다.
- 새 approval log row가 append된다.
- `draft.rollback` audit event가 append된다.

## 확인 항목

- `/admin/questions`에서 현재 published version이 기대한 버전인지 확인
- `/admin/questions/publish`에서 diff와 현재 published version을 다시 확인
- `/admin/approvals`에서 rollback approval row가 새로 추가됐는지 확인
- `/admin/audit?actionFamily=mutation`에서 `draft.rollback` 이벤트가 남았는지 확인

## 실패 시 점검

- `approval-log-entry-not-found`
  - 선택한 approvalId가 `ApprovalLog`에 없는 상태
- `question-draft-not-found`
  - approval이 가리키는 draft snapshot이 `QuestionDrafts`에 없는 상태
- `spreadsheet-question-drafts-not-configured`
  - spreadsheet env 또는 service account 설정 누락

## 주의

- 현재 rollback은 질문 sheet 전체를 snapshot 기준으로 다시 쓰는 방식이다.
- 일부 질문만 부분 복구하는 절차는 지원하지 않는다.
- rollback도 새로운 publish로 취급하므로, 이후 최신 상태는 rollback 직후 Questions snapshot이다.
