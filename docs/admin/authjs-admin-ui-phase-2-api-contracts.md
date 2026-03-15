# Auth.js Admin UI Phase 2 API Contracts

기준 시점: `2026-03-15`

## 1) 목적

phase 2에서 read-only로 먼저 고정한 admin API 계약과 draft/publish 데이터 모델 결정을 모은다.

현재 다루는 범위:

- `/api/admin/analytics/summary`
- `/api/admin/questions/drafts`
- `/api/admin/questions/drafts/[draftId]`
- `/api/admin/questions/drafts/[draftId]/status`
- `/api/admin/questions/drafts/[draftId]/approval-requests`
- `/api/admin/questions/drafts/[draftId]/publish`
- `/api/admin/questions/approval-requests/[requestId]/status`
- `/api/admin/questions/publish-preview`
- `/api/admin/audit`
- `/api/admin/approvals`
- `/api/admin/approvals/[approvalId]/rollback`
- draft 저장 단위
- publish diff 기준
- role matrix
- capability guard
- mutation audit event
- approval log

## 2) Analytics Summary

route:

- `GET /api/admin/analytics/summary`

query:

- `limit`
  - optional
  - 기본값은 현재 결과 조회와 동일하게 최근 100건 window

response 핵심 필드:

- `generatedAt`
- `sampleLimit`
- `supportedWindows`
  - 현재 계약: `7d`, `30d`, `90d`
- `currentQuestionVersion`
- `currentQuestionSource`
- `currentVersionResultCount`
- `kpis`
  - `sampleSize`
  - `last7dCount`
  - `last30dCount`
  - `latestResultAt`
  - `feedbackRate`
  - `averageRating`
  - `averageAccuracy`
- `distributions`
  - `questionVersion`
  - `birthTimeKnowledge`
  - `confidence`
  - `inferredZishi`
- `questionSetSummary`

의도:

- 차트/카드 UI가 같은 payload shape를 공유하게 한다.
- page와 API가 동일한 집계 helper를 사용하게 한다.

## 2.1) Admin Audit

route:

- `GET /api/admin/audit`
- `/admin/audit`

query:

- `limit`
- `actionFamily`
  - `access`
  - `mutation`
- `actorEmail`

접근 권한:

- 현재는 `roles.manage` capability, 즉 `owner` 역할만 허용한다.

응답 핵심 필드:

- `items[]`
  - `eventId`
  - `at`
  - `action`
  - `actionFamily`
  - `actorEmail`
  - `actorRole`
  - `subjectType`
  - `subjectId`
  - `metadata`

현재 목적:

- access / mutation을 한 화면에서 구분해 볼 수 있게 한다.
- 운영자가 publish 승인 코멘트와 deny 이벤트를 실제로 추적할 수 있게 한다.
- rollback 이벤트는 `draft.rollback` action으로 같은 mutation family에서 조회한다.

## 3) Publish Preview

route:

- `GET /api/admin/questions/publish-preview`

response 핵심 필드:

- `generatedAt`
- `publishedVersion`
- `questionSource`
- `questionSetSummary`
- `requiredRoles`
  - `read=viewer`
  - `editDraft=editor`
  - `publish=owner`
  - `rollback=owner`
- `roleMatrix`
- `draftModel`
- `checklist`

의도:

- publish 화면이 실제 mutation 없이도 필요한 정보 구조를 고정한다.
- 이후 draft 저장과 diff 계산이 붙더라도 UI 계약을 바꾸지 않게 한다.

## 3.1) Question Drafts

route:

- `GET /api/admin/questions/drafts`
- `POST /api/admin/questions/drafts`
- `GET /api/admin/questions/drafts/[draftId]`
- `PATCH /api/admin/questions/drafts/[draftId]`

GET query:

- `draftId`
- `version`
- `status`
  - exact match only

GET response 핵심 필드:

- `items[]`
  - `draftId`
  - `version`
  - `sourceVersion`
  - `status`
  - `changeSummary`
  - `updatedBy`
  - `updatedAt`
  - `questionCount`
  - `optionCount`
  - `missingRoles`

POST body 핵심 필드:

- `version`
- `sourceVersion`
  - optional, 비우면 현재 published version을 source로 사용
- `changeSummary`

POST 동작:

- 현재 published Questions 탭을 읽는다.
- `QuestionDrafts` 탭이 없으면 생성한다.
- header가 없으면 `QuestionDrafts!A1:P1`에 기본 header를 쓴다.
- published question set을 append-only draft snapshot으로 저장한다.

detail/update 계약:

- `GET /api/admin/questions/drafts/[draftId]`
  - draft summary
  - editable question rows
  - published vs draft diff summary
- `PATCH /api/admin/questions/drafts/[draftId]`
  - 질문 1개 단위 업데이트
  - update 대상:
    - `structureRole`
    - `category`
    - `questionWeight`
    - `questionText`
    - `isActive`
    - option text / score map
    - `changeSummary`
  - current draft row를 inplace overwrite 하되, published Questions 탭은 수정하지 않는다.
- `PATCH /api/admin/questions/drafts/[draftId]/status`
  - 현재 구현 상태 전이:
    - `draft -> review-ready`
    - `draft -> archived`
    - `review-ready -> draft`
    - `review-ready -> archived`
    - `archived -> draft`
  - `changeSummary`, `updatedBy`, `updatedAt`를 전체 draft row에 같이 반영한다.
- `GET /api/admin/questions/drafts/[draftId]/approval-requests`
  - 해당 draft의 approval request thread를 최신순으로 조회한다.
  - `requestId`, `draftUpdatedAt`, `status`, `requestedBy`, `requestedAt`, `requestComment`, `reviewedBy`, `reviewedAt`, `reviewComment`를 포함한다.
- `POST /api/admin/questions/drafts/[draftId]/approval-requests`
  - `review-ready` draft snapshot에 대해 editor가 approval request를 생성한다.
  - 같은 draft snapshot(`draftUpdatedAt`)에 pending request가 이미 있으면 거절한다.
- `PATCH /api/admin/questions/approval-requests/[requestId]/status`
  - owner가 request를 `approved` 또는 `rejected`로 처리한다.
  - `reviewedBy`, `reviewedAt`, `reviewComment`를 함께 남긴다.
- `POST /api/admin/questions/drafts/[draftId]/publish`
  - `review-ready` draft이면서, 현재 draft snapshot과 일치하는 `approved` request가 있어야 publish 가능
  - `approvalRequestId`를 같이 전달한다.
  - Questions 탭을 draft version snapshot으로 overwrite
  - trailing old rows는 blank row로 정리
  - 성공 시 해당 draft status를 `published`로 전환
  - `approvalComment`는 audit metadata에 함께 남긴다.
- `POST /api/admin/approvals/[approvalId]/rollback`
  - 선택한 approval이 가리키는 `draftId` snapshot을 다시 publish
  - 현재 구현에서는 `published` 또는 `review-ready` draft snapshot을 rollback source로 허용
  - rollback 자체도 새 approval log row를 append
  - audit에는 `draft.rollback` action으로 남긴다.

## 4) Draft 저장 단위 결정

초기 결정:

- published 질문 세트는 기존 `Questions` 탭을 유지한다.
- draft는 같은 admin spreadsheet 안의 별도 탭 `QuestionDrafts`를 사용한다.

이유:

- 현재 service account / spreadsheet 접근 경계를 그대로 재사용할 수 있다.
- published source를 직접 수정하지 않아 immutable 원칙을 지키기 쉽다.
- 별도 DB 없이도 draft/publish 흐름을 먼저 만들 수 있다.

draft model 계약:

- storage: `sheet-tab`
- sheetName: `QuestionDrafts`
- identityFields:
  - `draftId`
  - `questionId`
  - `optionIndex`
- mutableFields:
  - `structureRole`
  - `category`
  - `questionWeight`
  - `questionText`
  - `optionText`
  - `scoreMapJson`
  - `isActive`
- metadataFields:
  - `version`
  - `sourceVersion`
  - `status`
  - `changeSummary`
  - `updatedBy`
  - `updatedAt`
- workflowStatuses:
  - `draft`
  - `review-ready`
  - `published`
  - `archived`

## 5) Diff / Publish / Rollback 기준

현재 결정:

- draft vs published diff는 `questionId + optionIndex` 키 기준 row diff로 계산한다.
- publish는 existing published row를 inplace update 하지 않는다.
- pre-publish approval은 `ApprovalRequests` sheet에 thread로 남긴다.
- rollback은 이전 published snapshot을 새 version으로 재배포하는 방식으로 간다.
- rollback 기준 선택 단위는 `ApprovalLog.approvalId`다.

publish checklist 항목:

- 필수 role coverage
- draft 저장 단위 확인
- diff / reviewer 확인
- audit metadata 필드 확인
- rollback 정책 확인

## 6) Role Matrix

현재 role matrix:

- `viewer`
  - capabilities: `analytics.read`, `results.read`, `questions.read`
- `editor`
  - capabilities: `viewer` 권한 포함
  - 추가: `questions.edit`
- `owner`
  - capabilities: `editor` 권한 포함
  - 추가: `questions.publish`, `roles.manage`

현재 기준:

- Auth.js `jwt` / `session` callback이 `session.user.role`까지 주입한다.
- explicit role env(`ADMIN_VIEWER_EMAILS`, `ADMIN_EDITOR_EMAILS`, `ADMIN_OWNER_EMAILS`)가 있으면 그 값이 우선한다.
- explicit role env가 없으면 allowlist admin은 transition 기본값으로 `ADMIN_DEFAULT_ROLE`을 받는다.
- page/API guard는 현재 capability 기준으로 동작한다.

현재 capability mapping:

- `analytics.read`
  - `/admin/analytics`
  - `/api/admin/analytics/summary`
- `results.read`
  - `/admin/results`
  - `/api/admin/results*`
- `questions.read`
  - `/admin/questions`
  - `/admin/questions/[version]`
  - `/api/admin/questions`
  - `/api/admin/questions/publish-preview`
- `questions.edit`
  - `/admin/questions/[version]/edit`
  - `/admin/questions/publish`
  - `/api/admin/questions/drafts*`
- `questions.publish`
  - draft publish mutation
  - publish button 노출

## 6.1) Audit Event

현재 구현:

- 서버에서 `draft.create`, `draft.update`, `draft.status.update`, `draft.approval.requested`, `draft.approval.reviewed`, `draft.publish`, `draft.rollback`, `access.denied` 이벤트를 구조화해 기록한다.
- payload는 `console.info('[admin-audit]', event)`로 남고, 가능하면 아래 시트에 append-only로 저장한다.
  - combined view: `AdminAuditLog!A:H`
  - access sink: `AdminAccessLog!A:H`
  - mutation sink: `AdminMutationLog!A:H`

event 공통 필드:

- `eventId`
- `at`
- `action`
- `actorEmail`
- `actorRole`
- `subjectType`
- `subjectId`
- `metadata`

현재 한계:

- access log와 mutation log를 별도 sink로 저장하지만, UI는 아직 단일 audit view 안에서 필터로만 구분한다.
- approval request stale 처리와 auto-expire 정책은 아직 없다.

## 6.2) Approval Log

현재 구현:

- publish 성공 시 `ApprovalLog!A:J`에 append-only row를 남긴다.
- `/admin/approvals`, `/api/admin/approvals`에서 owner가 조회할 수 있다.

record 필드:

- `approvalId`
- `approvedAt`
- `draftId`
- `draftVersion`
- `sourceVersion`
- `publishedVersion`
- `actorEmail`
- `actorRole`
- `changeSummary`
- `approvalComment`

## 6.3) Approval Request Thread

현재 구현:

- pre-publish 승인 요청은 `ApprovalRequests!A:L`에 append/update 한다.
- `/admin/questions/publish`에서 editor가 request를 생성하고, owner가 approve/reject를 처리한다.
- publish는 현재 draft snapshot과 일치하는 `approved` request가 있어야 통과한다.

record 필드:

- `requestId`
- `draftId`
- `version`
- `sourceVersion`
- `draftUpdatedAt`
- `status`
- `requestedBy`
- `requestedAt`
- `requestComment`
- `reviewedBy`
- `reviewedAt`
- `reviewComment`

## 7) 다음 작업

1. explicit role env에서 별도 role source로 이행할 기준 확정
2. approval request stale / auto-expire 정책 정의
3. approval thread와 audit/approval log 조회 UX를 더 세분화할지 결정
4. rollback / approval thread runbook을 UI 링크와 운영 체크리스트에 더 직접 연결할지 결정
