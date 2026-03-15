import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { AdminStatCard } from '@/components/admin/stat-card'
import { recordAdminAuditEvent } from '@/lib/admin-audit'
import { buildAdminDraftPublishReviewResponse, buildAdminPublishPreviewResponse } from '@/lib/admin-contracts'
import { getRequiredCapabilityError, hasAdminCapabilityForSession } from '@/lib/admin-access'
import {
  createApprovalRequestFromSpreadsheet,
  getQuestionDraftDetailFromSpreadsheet,
  listApprovalRequestsFromSpreadsheet,
  listQuestionDraftsFromSpreadsheet,
  publishQuestionDraftFromSpreadsheet,
  syncQuestionsFromSpreadsheet,
  updateApprovalRequestStatusFromSpreadsheet,
  updateQuestionDraftStatusFromSpreadsheet,
} from '@workspace/spreadsheet-admin/server'

function readSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0]?.trim() || undefined
  }

  return value?.trim() || undefined
}

function buildPublishHref(params: {
  draftId?: string
  requestId?: string
  error?: string
  notice?: string
}): string {
  const searchParams = new URLSearchParams()
  if (params.draftId) {
    searchParams.set('draftId', params.draftId)
  }
  if (params.requestId) {
    searchParams.set('requestId', params.requestId)
  }
  if (params.error) {
    searchParams.set('error', params.error)
  }
  if (params.notice) {
    searchParams.set('notice', params.notice)
  }

  const query = searchParams.toString()
  return `/admin/questions/publish${query ? `?${query}` : ''}`
}

export default async function AdminQuestionsPublishPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const requestedDraftId = readSearchParam(resolvedSearchParams.draftId)
  const requestedRequestId = readSearchParam(resolvedSearchParams.requestId)
  const errorMessage = readSearchParam(resolvedSearchParams.error)
  const noticeMessage = readSearchParam(resolvedSearchParams.notice)
  const session = await auth()
  const userEmail = session?.user?.email ?? 'unknown'
  const pageCapabilityError = getRequiredCapabilityError(session, 'questions.edit')
  const canPublishDraft = hasAdminCapabilityForSession(session, 'questions.publish')

  async function markReviewReadyAction(formData: FormData) {
    'use server'

    const actionSession = await auth()
    const actionCapabilityError = getRequiredCapabilityError(actionSession, 'questions.edit')
    if (actionCapabilityError) {
      await recordAdminAuditEvent({
        action: 'access.denied',
        session: actionSession,
        subjectType: 'admin-route',
        subjectId: 'action:/admin/questions/publish#review-ready',
        metadata: { error: actionCapabilityError },
      })
      redirect(buildPublishHref({ error: actionCapabilityError }))
    }

    const draftId = String(formData.get('draftId') ?? '').trim()
    const changeSummary = String(formData.get('changeSummary') ?? '').trim()
    if (!draftId) {
      redirect(buildPublishHref({ error: 'draftId가 비어 있습니다.' }))
    }

    try {
      await updateQuestionDraftStatusFromSpreadsheet({
        draftId,
        nextStatus: 'review-ready',
        updatedBy: userEmail,
        changeSummary,
      })
      await recordAdminAuditEvent({
        action: 'draft.status.update',
        session: actionSession,
        subjectType: 'draft',
        subjectId: draftId,
        metadata: { nextStatus: 'review-ready', changeSummary },
      })

      redirect(buildPublishHref({ draftId }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'review-ready-failed'
      redirect(buildPublishHref({ draftId, error: message }))
    }
  }

  async function requestApprovalAction(formData: FormData) {
    'use server'

    const actionSession = await auth()
    const actionCapabilityError = getRequiredCapabilityError(actionSession, 'questions.edit')
    if (actionCapabilityError) {
      await recordAdminAuditEvent({
        action: 'access.denied',
        session: actionSession,
        subjectType: 'admin-route',
        subjectId: 'action:/admin/questions/publish#request-approval',
        metadata: { error: actionCapabilityError },
      })
      redirect(buildPublishHref({ error: actionCapabilityError }))
    }

    const draftId = String(formData.get('draftId') ?? '').trim()
    const requestComment = String(formData.get('requestComment') ?? '').trim()
    if (!draftId) {
      redirect(buildPublishHref({ error: 'draftId가 비어 있습니다.' }))
    }

    try {
      const request = await createApprovalRequestFromSpreadsheet({
        draftId,
        requestedBy: actionSession?.user?.email ?? 'unknown',
        requestComment,
      })
      await recordAdminAuditEvent({
        action: 'draft.approval.requested',
        session: actionSession,
        subjectType: 'draft',
        subjectId: draftId,
        metadata: {
          requestId: request.requestId,
          requestComment: request.requestComment ?? null,
        },
      })

      redirect(buildPublishHref({ draftId, requestId: request.requestId, notice: `approval requested ${request.requestId}` }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'approval-request-failed'
      redirect(buildPublishHref({ draftId, error: message }))
    }
  }

  async function reviewApprovalRequestAction(formData: FormData) {
    'use server'

    const actionSession = await auth()
    const actionCapabilityError = getRequiredCapabilityError(actionSession, 'questions.publish')
    if (actionCapabilityError) {
      await recordAdminAuditEvent({
        action: 'access.denied',
        session: actionSession,
        subjectType: 'admin-route',
        subjectId: 'action:/admin/questions/publish#review-approval',
        metadata: { error: actionCapabilityError },
      })
      redirect(buildPublishHref({ error: actionCapabilityError }))
    }

    const draftId = String(formData.get('draftId') ?? '').trim()
    const requestId = String(formData.get('requestId') ?? '').trim()
    const nextStatus = String(formData.get('nextStatus') ?? '').trim()
    const reviewComment = String(formData.get('reviewComment') ?? '').trim()
    if (!draftId || !requestId || (nextStatus !== 'approved' && nextStatus !== 'rejected')) {
      redirect(buildPublishHref({ draftId, error: 'approval request 입력이 올바르지 않습니다.' }))
    }

    try {
      const reviewed = await updateApprovalRequestStatusFromSpreadsheet({
        requestId,
        nextStatus,
        reviewedBy: actionSession?.user?.email ?? 'unknown',
        reviewComment,
      })
      await recordAdminAuditEvent({
        action: 'draft.approval.reviewed',
        session: actionSession,
        subjectType: 'draft',
        subjectId: reviewed.draftId,
        metadata: {
          requestId,
          nextStatus: reviewed.status,
          reviewComment: reviewed.reviewComment ?? null,
        },
      })

      redirect(buildPublishHref({ draftId, requestId, notice: `${reviewed.status} ${requestId}` }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'approval-review-failed'
      redirect(buildPublishHref({ draftId, requestId, error: message }))
    }
  }

  async function publishDraftAction(formData: FormData) {
    'use server'

    const actionSession = await auth()
    const actionCapabilityError = getRequiredCapabilityError(actionSession, 'questions.publish')
    if (actionCapabilityError) {
      await recordAdminAuditEvent({
        action: 'access.denied',
        session: actionSession,
        subjectType: 'admin-route',
        subjectId: 'action:/admin/questions/publish#publish',
        metadata: { error: actionCapabilityError },
      })
      redirect(buildPublishHref({ error: actionCapabilityError }))
    }

    const draftId = String(formData.get('draftId') ?? '').trim()
    const approvalRequestId = String(formData.get('approvalRequestId') ?? '').trim()
    const changeSummary = String(formData.get('changeSummary') ?? '').trim()
    const approvalComment = String(formData.get('approvalComment') ?? '').trim()
    if (!draftId) {
      redirect(buildPublishHref({ error: 'draftId가 비어 있습니다.' }))
    }
    if (!approvalRequestId) {
      redirect(buildPublishHref({ draftId, error: 'approved approval request가 필요합니다.' }))
    }

    try {
      const published = await publishQuestionDraftFromSpreadsheet({
        draftId,
        approvalRequestId,
        publishedBy: userEmail,
        publishedByRole: actionSession?.user?.role ?? null,
        changeSummary,
        approvalComment,
      })
      await recordAdminAuditEvent({
        action: 'draft.publish',
        session: actionSession,
        subjectType: 'draft',
        subjectId: draftId,
        metadata: {
          approvalRequestId,
          publishedVersion: published.publishedVersion,
          updatedRowCount: published.updatedRowCount,
          approvalComment: approvalComment || null,
        },
      })

      redirect(buildPublishHref({ draftId, requestId: approvalRequestId, notice: `published ${published.publishedVersion}` }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'publish-failed'
      redirect(buildPublishHref({ draftId, requestId: approvalRequestId, error: message }))
    }
  }

  try {
    const publishedPayload = await syncQuestionsFromSpreadsheet()
    const preview = buildAdminPublishPreviewResponse(publishedPayload)
    const draftList = await listQuestionDraftsFromSpreadsheet()
    const selectedDraftId =
      requestedDraftId ?? draftList.items.find(item => item.status === 'review-ready')?.draftId ?? draftList.items[0]?.draftId
    const selectedDraft = selectedDraftId ? await getQuestionDraftDetailFromSpreadsheet(selectedDraftId) : null
    const draftReview = selectedDraft ? buildAdminDraftPublishReviewResponse(selectedDraft) : null
    const approvalRequestPayload = selectedDraftId
      ? await listApprovalRequestsFromSpreadsheet({
          draftId: selectedDraftId,
          limit: 20,
        })
      : { items: [], limit: 20 }
    const selectedApprovalRequest =
      approvalRequestPayload.items.find(item => item.requestId === requestedRequestId) ?? approvalRequestPayload.items[0] ?? null
    const currentRequestedRequest =
      selectedDraft
        ? approvalRequestPayload.items.find(
            item => item.status === 'requested' && item.draftUpdatedAt === selectedDraft.updatedAt,
          ) ?? null
        : null
    const currentApprovedRequest =
      selectedDraft
        ? approvalRequestPayload.items.find(
            item => item.status === 'approved' && item.draftUpdatedAt === selectedDraft.updatedAt,
          ) ?? null
        : null
    const currentRejectedRequest =
      selectedDraft
        ? approvalRequestPayload.items.find(
            item => item.status === 'rejected' && item.draftUpdatedAt === selectedDraft.updatedAt,
          ) ?? null
        : null
    const approvalState = currentApprovedRequest
      ? 'approved'
      : currentRequestedRequest
        ? 'requested'
        : currentRejectedRequest
          ? 'rejected'
          : 'missing'

    if (pageCapabilityError === 'insufficient-role') {
      return (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-6 text-sm text-amber-800">
          이 화면은 `editor` 이상 역할이 필요합니다. publish 버튼은 `owner`에게만 열립니다.
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Publish Review</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">질문 version publish 검토</h2>
              <p className="mt-2 text-sm text-slate-600">
                draft 상태와 diff를 실제 데이터로 검토하고, approval request 생성, owner 승인/반려, 최종 publish까지 이 화면에서 진행합니다.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-100 px-4 py-3 text-right text-xs text-slate-600">
              <div>현재 published</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{preview.publishedVersion}</div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-600">
            <Link
              className="rounded-full border border-slate-300 px-3 py-1.5 font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              href={`/admin/questions/${encodeURIComponent(publishedPayload.questionVersion)}`}
            >
              version 상세
            </Link>
            <Link
              className="rounded-full border border-slate-300 px-3 py-1.5 font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              href={`/admin/questions/${encodeURIComponent(publishedPayload.questionVersion)}/edit${selectedDraftId ? `?draftId=${encodeURIComponent(selectedDraftId)}` : ''}`}
            >
              draft 편집
            </Link>
          </div>
        </div>

        {errorMessage ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-6 text-sm text-rose-700">{errorMessage}</div>
        ) : null}
        {noticeMessage ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-6 text-sm text-emerald-700">{noticeMessage}</div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AdminStatCard label="Published" value={preview.publishedVersion} detail={preview.questionSource} />
          <AdminStatCard
            label="Drafts"
            value={String(draftList.items.length)}
            detail={selectedDraft ? `선택된 draft ${selectedDraft.draftId}` : '선택된 draft 없음'}
          />
          <AdminStatCard
            label="Approval State"
            value={approvalState}
            detail={currentApprovedRequest ? `request ${currentApprovedRequest.requestId}` : '현재 snapshot 기준'}
          />
          <AdminStatCard label="Required Role" value={preview.requiredRoles.publish} detail="publish / rollback은 owner 기준" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Draft Candidates</h3>
            {draftList.items.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
                아직 생성된 draft가 없습니다. 먼저 edit 화면에서 draft snapshot을 만들어 주세요.
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {draftList.items.map(item => (
                  <Link
                    key={item.draftId}
                    href={buildPublishHref({ draftId: item.draftId })}
                    className={`block rounded-2xl border px-4 py-4 text-sm transition ${
                      item.draftId === selectedDraftId
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-semibold">{item.draftId}</div>
                    <div className="mt-1">
                      version {item.version} · source {item.sourceVersion} · {item.status}
                    </div>
                    <div className="mt-1">{item.changeSummary}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Publish Check List</h3>
            <div className="mt-5 space-y-3">
              {(draftReview?.checklist ?? preview.checklist).map(item => (
                <div key={item.id} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <div className="font-medium text-slate-900">{item.label}</div>
                  <div className="mt-1 text-slate-600">{item.status}</div>
                  <div className="mt-1 text-slate-500">{item.detail}</div>
                </div>
              ))}
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <div className="font-medium text-slate-900">approval request</div>
                <div className="mt-1 text-slate-600">{approvalState}</div>
                <div className="mt-1 text-slate-500">
                  {currentApprovedRequest
                    ? `approved request ${currentApprovedRequest.requestId}가 현재 draft snapshot(${currentApprovedRequest.draftUpdatedAt})과 일치합니다.`
                    : currentRequestedRequest
                      ? `request ${currentRequestedRequest.requestId}가 승인 대기 중입니다.`
                      : currentRejectedRequest
                        ? `request ${currentRejectedRequest.requestId}가 반려되었습니다.`
                        : '현재 draft snapshot에 대한 approval request가 없습니다.'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {selectedDraft && draftReview ? (
          <>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-semibold text-slate-900">Selected Draft</h3>
                <div className="mt-5 space-y-3 text-sm text-slate-700">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    {draftReview.draftId} · {draftReview.version} · {draftReview.status}
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    {draftReview.questionCount} questions / {draftReview.optionCount} options
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">updatedBy {draftReview.updatedBy}</div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">updatedAt {draftReview.updatedAt}</div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">changeSummary {selectedDraft.changeSummary}</div>
                </div>

                <form action={markReviewReadyAction} className="mt-5 space-y-3">
                  <input type="hidden" name="draftId" value={selectedDraft.draftId} />
                  <label className="block space-y-2 text-sm text-slate-700">
                    <span className="font-medium">review-ready 전환 사유</span>
                    <textarea
                      name="changeSummary"
                      rows={3}
                      defaultValue={selectedDraft.changeSummary}
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={selectedDraft.status === 'review-ready'}
                    className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                      selectedDraft.status === 'review-ready'
                        ? 'cursor-not-allowed bg-slate-300 text-slate-600'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {selectedDraft.status === 'review-ready' ? '이미 review-ready' : 'review-ready 전환'}
                  </button>
                </form>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-semibold text-slate-900">Diff Summary</h3>
                <div className="mt-5 grid gap-4 md:grid-cols-4">
                  <AdminStatCard label="Changed" value={String(draftReview.diff.totalChangedQuestions)} />
                  <AdminStatCard label="Added" value={String(draftReview.diff.addedQuestionCount)} />
                  <AdminStatCard label="Removed" value={String(draftReview.diff.removedQuestionCount)} />
                  <AdminStatCard label="Updated" value={String(draftReview.diff.updatedQuestionCount)} />
                </div>
                <div className="mt-5 space-y-3">
                  {draftReview.diff.items.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
                      published와 차이가 없습니다.
                    </div>
                  ) : (
                    draftReview.diff.items.map(item => (
                      <div key={`${item.questionId}-${item.changeType}`} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        <div className="font-medium text-slate-900">
                          {item.questionId} · {item.changeType}
                        </div>
                        <div className="mt-1">{item.changedFields.join(', ')}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-semibold text-slate-900">Approval Requests</h3>
                {approvalRequestPayload.items.length === 0 ? (
                  <div className="mt-5 rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
                    아직 approval request가 없습니다.
                  </div>
                ) : (
                  <div className="mt-5 space-y-3">
                    {approvalRequestPayload.items.map(item => (
                      <Link
                        key={item.requestId}
                        href={buildPublishHref({ draftId: selectedDraft.draftId, requestId: item.requestId })}
                        className={`block rounded-2xl border px-4 py-4 text-sm transition ${
                          item.requestId === selectedApprovalRequest?.requestId
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className="font-semibold">{item.requestId}</div>
                        <div className="mt-1">
                          {item.status} · requestedAt {item.requestedAt}
                        </div>
                        <div className="mt-1">snapshot {item.draftUpdatedAt}</div>
                        <div className="mt-1">{item.requestComment ?? '-'}</div>
                        {item.reviewedBy ? <div className="mt-1">reviewedBy {item.reviewedBy}</div> : null}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-semibold text-slate-900">Approval Workflow</h3>
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    현재 snapshot 상태: <span className="font-semibold text-slate-900">{approvalState}</span>
                  </div>

                  <form action={requestApprovalAction} className="space-y-3">
                    <input type="hidden" name="draftId" value={selectedDraft.draftId} />
                    <label className="block space-y-2 text-sm text-slate-700">
                      <span className="font-medium">approval request comment</span>
                      <textarea
                        name="requestComment"
                        rows={3}
                        placeholder="검토 포인트, 변경 이유, 주의사항"
                        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={selectedDraft.status !== 'review-ready' || Boolean(currentRequestedRequest)}
                      className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                        selectedDraft.status === 'review-ready' && !currentRequestedRequest
                          ? 'bg-slate-900 text-white hover:bg-slate-800'
                          : 'cursor-not-allowed bg-slate-300 text-slate-600'
                      }`}
                    >
                      {selectedDraft.status === 'review-ready'
                        ? currentRequestedRequest
                          ? '현재 snapshot은 승인 대기 중'
                          : 'approval request 생성'
                        : 'review-ready 상태에서만 요청 가능'}
                    </button>
                  </form>

                  {selectedApprovalRequest ? (
                    <form action={reviewApprovalRequestAction} className="space-y-3">
                      <input type="hidden" name="draftId" value={selectedDraft.draftId} />
                      <input type="hidden" name="requestId" value={selectedApprovalRequest.requestId} />
                      <label className="block space-y-2 text-sm text-slate-700">
                        <span className="font-medium">review comment</span>
                        <textarea
                          name="reviewComment"
                          rows={3}
                          defaultValue={selectedApprovalRequest.reviewComment ?? ''}
                          placeholder="승인 또는 반려 사유"
                          className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                        />
                      </label>
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="submit"
                          name="nextStatus"
                          value="approved"
                          disabled={!canPublishDraft || selectedApprovalRequest.status !== 'requested'}
                          className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                            canPublishDraft && selectedApprovalRequest.status === 'requested'
                              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                              : 'cursor-not-allowed bg-slate-300 text-slate-600'
                          }`}
                        >
                          {canPublishDraft ? '선택 request 승인' : 'owner role에서만 승인 가능'}
                        </button>
                        <button
                          type="submit"
                          name="nextStatus"
                          value="rejected"
                          disabled={!canPublishDraft || selectedApprovalRequest.status !== 'requested'}
                          className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                            canPublishDraft && selectedApprovalRequest.status === 'requested'
                              ? 'bg-rose-600 text-white hover:bg-rose-500'
                              : 'cursor-not-allowed bg-slate-300 text-slate-600'
                          }`}
                        >
                          반려
                        </button>
                      </div>
                    </form>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900">Approval Slot</h3>
              <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {currentApprovedRequest
                  ? `approved request ${currentApprovedRequest.requestId}가 현재 draft snapshot과 일치합니다. 이제 owner가 publish할 수 있습니다.`
                  : '현재 draft snapshot에 대한 approved request가 있어야 publish할 수 있습니다.'}
              </div>

              <form action={publishDraftAction} className="mt-5 space-y-3">
                <input type="hidden" name="draftId" value={selectedDraft.draftId} />
                <input type="hidden" name="approvalRequestId" value={currentApprovedRequest?.requestId ?? ''} />
                <label className="block space-y-2 text-sm text-slate-700">
                  <span className="font-medium">publish changeSummary</span>
                  <textarea
                    name="changeSummary"
                    rows={3}
                    defaultValue={selectedDraft.changeSummary}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                  />
                </label>
                <label className="block space-y-2 text-sm text-slate-700">
                  <span className="font-medium">approval comment</span>
                  <textarea
                    name="approvalComment"
                    rows={3}
                    placeholder="승인 근거, 검토 메모, 배포 주의사항"
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                  />
                </label>
                <button
                  type="submit"
                  disabled={selectedDraft.status !== 'review-ready' || !canPublishDraft || !currentApprovedRequest}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    selectedDraft.status === 'review-ready' && canPublishDraft && currentApprovedRequest
                      ? 'bg-slate-900 text-white hover:bg-slate-800'
                      : 'cursor-not-allowed bg-slate-300 text-slate-600'
                  }`}
                >
                  {selectedDraft.status !== 'review-ready'
                    ? 'review-ready 상태에서만 publish 가능'
                    : !currentApprovedRequest
                      ? 'approved request가 있어야 publish 가능'
                      : canPublishDraft
                        ? '이 draft publish'
                        : 'owner role에서만 publish 가능'}
                </button>
              </form>
            </div>
          </>
        ) : null}
      </div>
    )
  } catch (error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-6 text-sm text-rose-700">
        publish 검토 화면을 읽지 못했습니다. {error instanceof Error ? error.message : 'Unknown publish review load error'}
      </div>
    )
  }
}
