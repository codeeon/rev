import { listAdminResultsFromSpreadsheet } from '@workspace/spreadsheet-admin/server'
import { ResultsTable } from '@/components/admin/results-table'

function readSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0]?.trim() || undefined
  }

  return value?.trim() || undefined
}

export default async function AdminResultsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const sessionId = readSearchParam(resolvedSearchParams.sessionId)

  try {
    const payload = await listAdminResultsFromSpreadsheet({
      limit: 100,
      sessionId,
    })

    return (
      <div className="space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">결과 조회</h2>
              <p className="mt-2 text-sm text-slate-600">
                최근 최대 100건을 조회합니다. `sessionId`를 입력하면 정확히 일치하는 결과만 필터링합니다.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-100 px-4 py-3 text-right text-xs text-slate-600">
              <div>표시 건수</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{payload.items.length}</div>
            </div>
          </div>

          <form action="/admin/results" className="mt-5 flex gap-3">
            <input
              type="text"
              name="sessionId"
              defaultValue={sessionId}
              placeholder="sessionId exact match"
              className="min-w-0 flex-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            />
            <button
              type="submit"
              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              조회
            </button>
          </form>
        </div>

        <ResultsTable items={payload.items} />
      </div>
    )
  } catch (error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-6 text-sm text-rose-700">
        결과 시트를 읽지 못했습니다. {error instanceof Error ? error.message : 'Unknown results load error'}
      </div>
    )
  }
}
