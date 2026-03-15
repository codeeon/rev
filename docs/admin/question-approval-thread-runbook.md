# Question Approval Thread Runbook

기준 시점: `2026-03-15`

## 목적

질문 draft를 publish하기 전에 `ApprovalRequests` 기준으로 어떤 순서로 요청, 승인, 반려를 처리하는지 운영 절차를 정리한다.

현재 approval thread 방식:

- editor가 `review-ready` draft snapshot에 대해 approval request를 생성한다.
- owner가 request를 `approved` 또는 `rejected`로 처리한다.
- publish는 현재 draft snapshot과 일치하는 `approved` request가 있어야만 가능하다.

## 저장 위치

- draft snapshot: `QuestionDrafts!A:P`
- pre-publish approval thread: `ApprovalRequests!A:L`
- final publish approval log: `ApprovalLog!A:J`
- audit log:
  - combined: `AdminAuditLog!A:H`
  - access: `AdminAccessLog!A:H`
  - mutation: `AdminMutationLog!A:H`

## 역할

- `editor`
  - draft 편집
  - `review-ready` 전환
  - approval request 생성

- `owner`
  - approval request 승인/반려
  - 최종 publish
  - rollback

## UI 절차

1. `/admin/questions/[version]/edit`에서 draft를 수정한다.
2. `/admin/questions/publish`에서 draft를 `review-ready`로 전환한다.
3. editor가 `approval request 생성`을 실행한다.
4. owner가 같은 화면에서 request를 선택하고 `승인` 또는 `반려`를 처리한다.
5. `approved` request가 현재 draft snapshot과 일치하는 상태에서만 publish를 실행한다.

## API 절차

request 생성:

- `POST /api/admin/questions/drafts/[draftId]/approval-requests`

body:

- `requestComment`

request 조회:

- `GET /api/admin/questions/drafts/[draftId]/approval-requests`

query:

- `status`
- `limit`

request 승인/반려:

- `PATCH /api/admin/questions/approval-requests/[requestId]/status`

body:

- `nextStatus`
  - `approved`
  - `rejected`
- `reviewComment`

final publish:

- `POST /api/admin/questions/drafts/[draftId]/publish`

body:

- `approvalRequestId`
- `changeSummary`
- `approvalComment`

## request 생성 규칙

- draft status가 `review-ready`여야 한다.
- 같은 draft snapshot(`draftUpdatedAt`)에 `requested` 상태 request가 이미 있으면 새 request를 만들지 않는다.
- request는 snapshot 기준으로 저장되므로, draft를 다시 수정하면 기존 승인 상태와 분리해서 본다.

## 승인/반려 규칙

- owner만 처리할 수 있다.
- `requested` 상태 request만 `approved` 또는 `rejected`로 바꿀 수 있다.
- 승인/반려 코멘트는 `reviewComment`로 남긴다.

## publish gating 규칙

- draft status가 `review-ready`여야 한다.
- `approvalRequestId`가 있어야 한다.
- 해당 request가 `approved` 상태여야 한다.
- request의 `draftUpdatedAt`이 현재 draft의 `updatedAt`과 같아야 한다.

즉, 승인 후 draft가 다시 바뀌면 기존 승인으로는 publish되지 않는다.

## 반려 후 처리

- editor가 draft를 수정한다.
- 필요하면 다시 `review-ready`로 전환한다.
- 새 snapshot 기준으로 새 approval request를 만든다.

## 운영 확인 항목

- `/admin/questions/publish`
  - 현재 draft snapshot의 approval state 확인
  - request 목록에서 최신 request와 snapshot timestamp 확인
- `/admin/audit?actionFamily=mutation`
  - `draft.approval.requested`
  - `draft.approval.reviewed`
  - `draft.publish`
- `/admin/approvals`
  - 실제 publish 이후 `ApprovalLog` row 확인

## 실패 시 점검

- `approval-request-not-allowed-for-draft-status:*`
  - draft가 `review-ready`가 아님
- `approval-request-already-pending`
  - 같은 snapshot에 pending request가 이미 있음
- `approval-request-not-found`
  - 선택한 requestId가 없음
- `approval-request-not-approved:*`
  - request가 아직 승인되지 않음
- `approval-request-stale`
  - 승인 후 draft가 다시 수정되어 snapshot이 달라짐
- `approval-request-required`
  - publish 호출에 `approvalRequestId`가 없음

## 현재 미정 정책

- 오래된 `requested` request를 자동 만료시킬지
- 오래된 `approved` request를 자동 무효화할지
- request가 여러 개 쌓였을 때 UI에서 archive/hide를 할지

이 정책은 별도 `stale / auto-expire` 기준으로 후속 결정한다.
