import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { AdminStatCard } from '@/components/admin/stat-card'
import { recordAdminAuditEvent } from '@/lib/admin-audit'
import { getAdminDraftModelContract } from '@/lib/admin-contracts'
import { getRequiredCapabilityError } from '@/lib/admin-access'
import {
  createQuestionDraftFromSpreadsheet,
  getQuestionDraftDetailFromSpreadsheet,
  listQuestionDraftsFromSpreadsheet,
  syncQuestionsFromSpreadsheet,
  updateQuestionDraftFromSpreadsheet,
} from '@workspace/spreadsheet-admin/server'

function readSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0]?.trim() || undefined
  }

  return value?.trim() || undefined
}

function buildEditHref(version: string, draftId?: string, error?: string): string {
  const searchParams = new URLSearchParams()
  if (draftId) {
    searchParams.set('draftId', draftId)
  }
  if (error) {
    searchParams.set('error', error)
  }

  const query = searchParams.toString()
  return `/admin/questions/${encodeURIComponent(version)}/edit${query ? `?${query}` : ''}`
}

function parsePositiveNumber(value: FormDataEntryValue | null): number {
  const parsed = Number(typeof value === 'string' ? value : '')
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('invalid-question-weight')
  }

  return parsed
}

function parseScoreMapJson(rawValue: string): Record<string, number> {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawValue)
  } catch {
    throw new Error('invalid-score-map-json')
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('invalid-score-map-json')
  }

  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>).map(([key, value]) => {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error('invalid-score-map-json')
      }

      return [key, value]
    }),
  )
}

export default async function AdminQuestionVersionEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ version: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { version } = await params
  const resolvedSearchParams = (await searchParams) ?? {}
  const requestedDraftId = readSearchParam(resolvedSearchParams.draftId)
  const errorMessage = readSearchParam(resolvedSearchParams.error)
  const session = await auth()
  const userEmail = session?.user?.email ?? 'unknown'
  const capabilityError = getRequiredCapabilityError(session, 'questions.edit')

  const publishedPayload = await syncQuestionsFromSpreadsheet()
  const draftModel = getAdminDraftModelContract()
  const isCurrentVersion = version === publishedPayload.questionVersion

  async function createDraftAction(formData: FormData) {
    'use server'

    const actionSession = await auth()
    const actionCapabilityError = getRequiredCapabilityError(actionSession, 'questions.edit')
    if (actionCapabilityError) {
      await recordAdminAuditEvent({
        action: 'access.denied',
        session: actionSession,
        subjectType: 'admin-route',
        subjectId: 'action:/admin/questions/[version]/edit#create-draft',
        metadata: { error: actionCapabilityError },
      })
      redirect(buildEditHref(version, undefined, actionCapabilityError))
    }

    const targetVersion = String(formData.get('targetVersion') ?? '').trim()
    const changeSummary = String(formData.get('changeSummary') ?? '').trim()
    const sourceVersion = String(formData.get('sourceVersion') ?? '').trim() || undefined
    if (!targetVersion || !changeSummary) {
      redirect(buildEditHref(version, undefined, 'draft version과 변경 사유를 입력해 주세요.'))
    }

    try {
      const createdDraft = await createQuestionDraftFromSpreadsheet({
        version: targetVersion,
        sourceVersion,
        changeSummary,
        updatedBy: userEmail,
      })
      await recordAdminAuditEvent({
        action: 'draft.create',
        session: actionSession,
        subjectType: 'draft',
        subjectId: createdDraft.draftId,
        metadata: {
          version: createdDraft.version,
          sourceVersion: createdDraft.sourceVersion,
        },
      })

      redirect(buildEditHref(version, createdDraft.draftId))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'draft-create-failed'
      redirect(buildEditHref(version, undefined, message))
    }
  }

  async function updateQuestionAction(formData: FormData) {
    'use server'

    const actionSession = await auth()
    const actionCapabilityError = getRequiredCapabilityError(actionSession, 'questions.edit')
    if (actionCapabilityError) {
      await recordAdminAuditEvent({
        action: 'access.denied',
        session: actionSession,
        subjectType: 'admin-route',
        subjectId: 'action:/admin/questions/[version]/edit#update-question',
        metadata: { error: actionCapabilityError },
      })
      redirect(buildEditHref(version, requestedDraftId, actionCapabilityError))
    }

    const draftId = String(formData.get('draftId') ?? '').trim()
    const questionId = String(formData.get('questionId') ?? '').trim()
    const draftVersion = String(formData.get('draftVersion') ?? '').trim()
    const sourceVersion = String(formData.get('sourceVersion') ?? '').trim()
    const structureRole = String(formData.get('structureRole') ?? '').trim()
    const category = String(formData.get('category') ?? '').trim()
    const questionText = String(formData.get('questionText') ?? '').trim()
    const changeSummary = String(formData.get('changeSummary') ?? '').trim()
    const optionCount = Number(String(formData.get('optionCount') ?? '0'))

    if (!draftId || !questionId || !draftVersion || !sourceVersion || !category || !questionText || !changeSummary) {
      redirect(buildEditHref(version, draftId || undefined, '필수 draft 필드가 비어 있습니다.'))
    }

    if (
      structureRole !== 'noise_reduction' &&
      structureRole !== 'core' &&
      structureRole !== 'fine_tune' &&
      structureRole !== 'closing'
    ) {
      redirect(buildEditHref(version, draftId, '지원하지 않는 structureRole입니다.'))
    }

    try {
      const options = Array.from({ length: optionCount }, (_, index) => ({
        optionIndex: Number(String(formData.get(`optionIndex:${index}`) ?? index)),
        optionText: String(formData.get(`optionText:${index}`) ?? '').trim(),
        scoreMap: parseScoreMapJson(String(formData.get(`scoreMapJson:${index}`) ?? '{}')),
      }))

      await updateQuestionDraftFromSpreadsheet({
        draftId,
        questionId,
        version: draftVersion,
        sourceVersion,
        structureRole,
        category,
        questionWeight: parsePositiveNumber(formData.get('questionWeight')),
        questionText,
        isActive: formData.get('isActive') === 'on',
        changeSummary,
        updatedBy: userEmail,
        options,
      })
      await recordAdminAuditEvent({
        action: 'draft.update',
        session: actionSession,
        subjectType: 'question',
        subjectId: `${draftId}:${questionId}`,
        metadata: {
          version: draftVersion,
          sourceVersion,
        },
      })

      redirect(buildEditHref(version, draftId))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'draft-update-failed'
      redirect(buildEditHref(version, draftId, message))
    }
  }

  if (capabilityError === 'insufficient-role') {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-6 text-sm text-amber-800">
        이 화면은 `editor` 이상 역할이 필요합니다. 현재 세션 role을 확인해 주세요.
      </div>
    )
  }

  try {
    const draftList = await listQuestionDraftsFromSpreadsheet({ version })
    const activeDraftId = requestedDraftId ?? draftList.items[0]?.draftId
    const activeDraft = activeDraftId ? await getQuestionDraftDetailFromSpreadsheet(activeDraftId) : null

    return (
      <div className="space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Draft Editor</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">{version} draft 편집</h2>
              <p className="mt-2 text-sm text-slate-600">
                QuestionDrafts 탭 기준으로 draft snapshot을 읽고, 질문 단위 편집을 바로 반영합니다.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-100 px-4 py-3 text-right text-xs text-slate-600">
              <div>현재 published</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{publishedPayload.questionVersion}</div>
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
              href="/admin/questions/publish"
            >
              publish 확인
            </Link>
          </div>
        </div>

        {!isCurrentVersion ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-6 text-sm text-amber-800">
            현재 published version은{' '}
            <Link className="font-semibold underline" href={`/admin/questions/${encodeURIComponent(publishedPayload.questionVersion)}/edit`}>
              {publishedPayload.questionVersion}
            </Link>
            입니다. 이 화면은 현재 시점의 published snapshot을 source로 draft를 만듭니다.
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-6 text-sm text-rose-700">{errorMessage}</div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AdminStatCard
            label="Draft Count"
            value={String(draftList.items.length)}
            detail={activeDraft ? `선택된 draft ${activeDraft.draftId}` : '아직 생성된 draft 없음'}
          />
          <AdminStatCard
            label="Draft Store"
            value={draftModel.sheetName}
            detail={`${draftModel.storage} · ${draftModel.diffKeyFields.join(' + ')}`}
          />
          <AdminStatCard
            label="Current Diff"
            value={String(activeDraft?.diff.totalChangedQuestions ?? 0)}
            detail={activeDraft ? `updated ${activeDraft.diff.updatedQuestionCount} / removed ${activeDraft.diff.removedQuestionCount}` : 'draft 선택 전'}
          />
          <AdminStatCard
            label="Role Coverage"
            value={String(activeDraft?.summary.missingRoles.length ?? 0)}
            detail={activeDraft?.summary.missingRoles.length ? activeDraft.summary.missingRoles.join(', ') : '필수 role 모두 충족'}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Draft Snapshots</h3>
            {draftList.items.length === 0 ? (
              <form action={createDraftAction} className="mt-5 space-y-4">
                <input type="hidden" name="sourceVersion" value={publishedPayload.questionVersion} />
                <label className="block space-y-2 text-sm text-slate-700">
                  <span className="font-medium">draft version</span>
                  <input
                    name="targetVersion"
                    defaultValue={version}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                  />
                </label>
                <label className="block space-y-2 text-sm text-slate-700">
                  <span className="font-medium">변경 사유</span>
                  <textarea
                    name="changeSummary"
                    rows={4}
                    defaultValue="현재 published 질문 세트를 draft snapshot으로 복사"
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  draft snapshot 생성
                </button>
              </form>
            ) : (
              <div className="mt-5 space-y-3">
                {draftList.items.map(item => (
                  <Link
                    key={item.draftId}
                    href={buildEditHref(version, item.draftId)}
                    className={`block rounded-2xl border px-4 py-4 text-sm transition ${
                      item.draftId === activeDraft?.draftId
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
            <h3 className="text-base font-semibold text-slate-900">Draft Summary</h3>
            {activeDraft ? (
              <div className="mt-5 space-y-3 text-sm text-slate-700">
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  version {activeDraft.version} · source {activeDraft.sourceVersion} · {activeDraft.status}
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  {activeDraft.summary.questionCount} questions / {activeDraft.summary.optionCount} options
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">updatedBy {activeDraft.updatedBy}</div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">updatedAt {activeDraft.updatedAt}</div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">changeSummary {activeDraft.changeSummary}</div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
                선택된 draft가 없습니다. 먼저 snapshot을 생성해 주세요.
              </div>
            )}
          </div>
        </div>

        {activeDraft ? (
          <>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900">Draft Diff Summary</h3>
              <div className="mt-5 grid gap-4 md:grid-cols-4">
                <AdminStatCard label="Changed" value={String(activeDraft.diff.totalChangedQuestions)} />
                <AdminStatCard label="Added" value={String(activeDraft.diff.addedQuestionCount)} />
                <AdminStatCard label="Removed" value={String(activeDraft.diff.removedQuestionCount)} />
                <AdminStatCard label="Updated" value={String(activeDraft.diff.updatedQuestionCount)} />
              </div>
              <div className="mt-5 space-y-3">
                {activeDraft.diff.items.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
                    published와 차이가 없습니다.
                  </div>
                ) : (
                  activeDraft.diff.items.map(item => (
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

            <div className="space-y-4">
              {activeDraft.questions.map(question => (
                <form key={question.id} action={updateQuestionAction} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <input type="hidden" name="draftId" value={activeDraft.draftId} />
                  <input type="hidden" name="draftVersion" value={activeDraft.version} />
                  <input type="hidden" name="sourceVersion" value={activeDraft.sourceVersion} />
                  <input type="hidden" name="questionId" value={question.id} />
                  <input type="hidden" name="optionCount" value={question.options.length} />

                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">{question.id}</h3>
                      <p className="mt-2 text-sm text-slate-600">row numbers {question.options.map(option => option.rowNumber).join(', ')}</p>
                    </div>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        name="isActive"
                        defaultChecked={question.isActive}
                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                      active
                    </label>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-[160px_1fr_140px]">
                    <label className="space-y-2 text-sm text-slate-700">
                      <span className="font-medium">structureRole</span>
                      <select
                        name="structureRole"
                        defaultValue={question.structureRole}
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                      >
                        <option value="noise_reduction">noise_reduction</option>
                        <option value="core">core</option>
                        <option value="fine_tune">fine_tune</option>
                        <option value="closing">closing</option>
                      </select>
                    </label>
                    <label className="space-y-2 text-sm text-slate-700">
                      <span className="font-medium">category</span>
                      <input
                        name="category"
                        defaultValue={question.category}
                        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-slate-700">
                      <span className="font-medium">questionWeight</span>
                      <input
                        name="questionWeight"
                        type="number"
                        step="0.1"
                        min="0"
                        defaultValue={question.questionWeight}
                        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                      />
                    </label>
                  </div>

                  <label className="mt-4 block space-y-2 text-sm text-slate-700">
                    <span className="font-medium">questionText</span>
                    <textarea
                      name="questionText"
                      rows={3}
                      defaultValue={question.text}
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                    />
                  </label>

                  <div className="mt-5 space-y-4">
                    {question.options.map((option, index) => (
                      <div key={`${question.id}-${option.optionIndex}`} className="rounded-2xl border border-slate-200 p-4">
                        <input type="hidden" name={`optionIndex:${index}`} value={option.optionIndex} />
                        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                          <label className="space-y-2 text-sm text-slate-700">
                            <span className="font-medium">optionText #{option.optionIndex}</span>
                            <input
                              name={`optionText:${index}`}
                              defaultValue={option.text}
                              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                            />
                          </label>
                          <label className="space-y-2 text-sm text-slate-700">
                            <span className="font-medium">scoreMapJson</span>
                            <textarea
                              name={`scoreMapJson:${index}`}
                              rows={3}
                              defaultValue={JSON.stringify(option.scoreMap)}
                              className="w-full rounded-2xl border border-slate-300 px-4 py-3 font-mono text-xs text-slate-900 outline-none transition focus:border-slate-500"
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>

                  <label className="mt-5 block space-y-2 text-sm text-slate-700">
                    <span className="font-medium">changeSummary</span>
                    <textarea
                      name="changeSummary"
                      rows={2}
                      defaultValue={activeDraft.changeSummary}
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                    />
                  </label>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="submit"
                      className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      이 질문 저장
                    </button>
                  </div>
                </form>
              ))}
            </div>
          </>
        ) : null}
      </div>
    )
  } catch (error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-6 text-sm text-rose-700">
        draft 편집 화면을 읽지 못했습니다. {error instanceof Error ? error.message : 'Unknown draft editor load error'}
      </div>
    )
  }
}
