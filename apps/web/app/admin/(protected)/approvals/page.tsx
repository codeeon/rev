import { ApprovalTable } from '@/components/admin/approval-table'
import { AdminStatCard } from '@/components/admin/stat-card'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { recordAdminAuditEvent } from '@/lib/admin-audit'
import { getRequiredCapabilityError } from '@/lib/admin-access'
import { listApprovalLogEntriesFromSpreadsheet, rollbackApprovalFromSpreadsheet } from '@workspace/spreadsheet-admin/server'

function readSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0]?.trim() || undefined
  }

  return value?.trim() || undefined
}

function buildApprovalsHref(params: {
  approvalId?: string
  actorEmail?: string
  draftId?: string
  error?: string
  notice?: string
}): string {
  const searchParams = new URLSearchParams()
  if (params.approvalId) {
    searchParams.set('approvalId', params.approvalId)
  }
  if (params.actorEmail) {
    searchParams.set('actorEmail', params.actorEmail)
  }
  if (params.draftId) {
    searchParams.set('draftId', params.draftId)
  }
  if (params.error) {
    searchParams.set('error', params.error)
  }
  if (params.notice) {
    searchParams.set('notice', params.notice)
  }

  const query = searchParams.toString()
  return `/admin/approvals${query ? `?${query}` : ''}`
}

export default async function AdminApprovalsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await auth()
  const capabilityError = getRequiredCapabilityError(session, 'roles.manage')
  if (capabilityError === 'insufficient-role') {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-6 text-sm text-amber-800">
        이 화면은 `owner` 역할이 필요합니다.
      </div>
    )
  }

  const resolvedSearchParams = (await searchParams) ?? {}
  const requestedApprovalId = readSearchParam(resolvedSearchParams.approvalId)
  const actorEmail = readSearchParam(resolvedSearchParams.actorEmail)
  const draftId = readSearchParam(resolvedSearchParams.draftId)
  const errorMessage = readSearchParam(resolvedSearchParams.error)
  const noticeMessage = readSearchParam(resolvedSearchParams.notice)

  async function rollbackApprovalAction(formData: FormData) {
    'use server'

    const actionSession = await auth()
    const actionCapabilityError = getRequiredCapabilityError(actionSession, 'questions.publish')
    const approvalId = String(formData.get('approvalId') ?? '').trim()
    const actorEmail = String(formData.get('actorEmail') ?? '').trim() || undefined
    const draftId = String(formData.get('draftId') ?? '').trim() || undefined
    const changeSummary = String(formData.get('changeSummary') ?? '').trim()
    const approvalComment = String(formData.get('approvalComment') ?? '').trim()

    if (actionCapabilityError) {
      await recordAdminAuditEvent({
        action: 'access.denied',
        session: actionSession,
        subjectType: 'admin-route',
        subjectId: 'action:/admin/approvals#rollback',
        metadata: { error: actionCapabilityError, approvalId },
      })
      redirect(
        buildApprovalsHref({
          approvalId,
          actorEmail,
          draftId,
          error: actionCapabilityError,
        }),
      )
    }

    if (!approvalId) {
      redirect(buildApprovalsHref({ actorEmail, draftId, error: 'approvalId가 비어 있습니다.' }))
    }

    try {
      const rolledBack = await rollbackApprovalFromSpreadsheet({
        approvalId,
        rolledBackBy: actionSession?.user?.email ?? 'unknown',
        rolledBackByRole: actionSession?.user?.role ?? null,
        changeSummary: changeSummary || undefined,
        approvalComment: approvalComment || undefined,
      })
      await recordAdminAuditEvent({
        action: 'draft.rollback',
        session: actionSession,
        subjectType: 'draft',
        subjectId: rolledBack.sourceDraftId,
        metadata: {
          sourceApprovalId: rolledBack.sourceApprovalId,
          sourcePublishedVersion: rolledBack.sourcePublishedVersion,
          rollbackApprovalId: rolledBack.rollbackApprovalId,
          approvalComment: approvalComment || null,
        },
      })

      redirect(
        buildApprovalsHref({
          approvalId,
          actorEmail,
          draftId,
          notice: `rolled back to ${rolledBack.sourcePublishedVersion}`,
        }),
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'rollback-failed'
      redirect(
        buildApprovalsHref({
          approvalId,
          actorEmail,
          draftId,
          error: message,
        }),
      )
    }
  }

  try {
    const payload = await listApprovalLogEntriesFromSpreadsheet({
      limit: 100,
      actorEmail,
      draftId,
    })
    let selectedApproval = requestedApprovalId ? payload.items.find(item => item.approvalId === requestedApprovalId) : payload.items[0]
    if (!selectedApproval && requestedApprovalId) {
      const selectedPayload = await listApprovalLogEntriesFromSpreadsheet({
        limit: 1,
        approvalId: requestedApprovalId,
      })
      selectedApproval = selectedPayload.items[0] ?? payload.items[0]
    }

    return (
      <div className="space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Approval Log</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">승인 기록</h2>
              <p className="mt-2 text-sm text-slate-600">publish 승인 시점의 승인자, 버전, 코멘트를 전용 로그로 조회합니다.</p>
            </div>
          </div>

          <form action="/admin/approvals" className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <input type="hidden" name="approvalId" value={requestedApprovalId} />
            <input
              type="text"
              name="actorEmail"
              defaultValue={actorEmail}
              placeholder="actor email"
              className="rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            />
            <input
              type="text"
              name="draftId"
              defaultValue={draftId}
              placeholder="draft id"
              className="rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            />
            <button
              type="submit"
              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              조회
            </button>
          </form>
        </div>

        {errorMessage ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-6 text-sm text-rose-700">{errorMessage}</div>
        ) : null}
        {noticeMessage ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-6 text-sm text-emerald-700">{noticeMessage}</div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <AdminStatCard label="Approvals" value={String(payload.items.length)} />
          <AdminStatCard label="Selected Draft" value={selectedApproval?.draftId ?? '-'} />
          <AdminStatCard label="Selected Version" value={selectedApproval?.publishedVersion ?? '-'} />
        </div>

        {selectedApproval ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900">Selected Approval</h3>
              <div className="mt-5 space-y-3 text-sm text-slate-700">
                <div className="rounded-2xl bg-slate-50 px-4 py-3">approvalId {selectedApproval.approvalId}</div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">draftId {selectedApproval.draftId}</div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">publishedVersion {selectedApproval.publishedVersion}</div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">sourceVersion {selectedApproval.sourceVersion}</div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">approvedAt {selectedApproval.approvedAt}</div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">actor {selectedApproval.actorEmail ?? '-'} / {selectedApproval.actorRole ?? '-'}</div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">changeSummary {selectedApproval.changeSummary ?? '-'}</div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 whitespace-pre-wrap">approvalComment {selectedApproval.approvalComment ?? '-'}</div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900">Rollback Action</h3>
              <p className="mt-2 text-sm text-slate-600">
                rollback은 선택한 approval의 draft snapshot을 현재 `Questions` 탭에 다시 publish합니다. 이 작업도 새 approval log와 audit
                event를 남깁니다.
              </p>

              <form action={rollbackApprovalAction} className="mt-5 space-y-3">
                <input type="hidden" name="approvalId" value={selectedApproval.approvalId} />
                <input type="hidden" name="actorEmail" value={actorEmail ?? ''} />
                <input type="hidden" name="draftId" value={draftId ?? ''} />
                <label className="block space-y-2 text-sm text-slate-700">
                  <span className="font-medium">rollback changeSummary</span>
                  <textarea
                    name="changeSummary"
                    rows={3}
                    defaultValue={`rollback to ${selectedApproval.publishedVersion}`}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                  />
                </label>
                <label className="block space-y-2 text-sm text-slate-700">
                  <span className="font-medium">rollback comment</span>
                  <textarea
                    name="approvalComment"
                    rows={3}
                    placeholder="왜 이 버전으로 되돌리는지, 이후 확인 포인트"
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  이 approval 기준으로 rollback publish
                </button>
              </form>
            </div>
          </div>
        ) : null}

        <ApprovalTable items={payload.items} selectedApprovalId={selectedApproval?.approvalId} actorEmail={actorEmail} draftId={draftId} />
      </div>
    )
  } catch (error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-6 text-sm text-rose-700">
        approval log를 읽지 못했습니다. {error instanceof Error ? error.message : 'Unknown approval log load error'}
      </div>
    )
  }
}
