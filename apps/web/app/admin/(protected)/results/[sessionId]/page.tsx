import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAdminResultBySessionIdFromSpreadsheet } from '@workspace/spreadsheet-admin/server'

export default async function AdminResultDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params

  try {
    const result = await getAdminResultBySessionIdFromSpreadsheet(sessionId)

    if (!result) {
      notFound()
    }

    return (
      <div className="space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <Link className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline" href="/admin/results">
            결과 목록으로 돌아가기
          </Link>
          <h2 className="mt-3 text-lg font-semibold text-slate-900">{result.sessionId}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {result.timestamp} · {result.birthTimeKnowledge} · {result.questionVersion}
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">원본 데이터</h3>
          <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      </div>
    )
  } catch (error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-6 text-sm text-rose-700">
        상세 결과를 읽지 못했습니다. {error instanceof Error ? error.message : 'Unknown result load error'}
      </div>
    )
  }
}
