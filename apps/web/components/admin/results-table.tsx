import Link from 'next/link'
import type { StoredAnalysisResultRecord } from '@workspace/spreadsheet-admin/server'

interface ResultsTableProps {
  items: StoredAnalysisResultRecord[]
}

export function ResultsTable({ items }: ResultsTableProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-sm text-slate-500">
        조회된 결과가 없습니다.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Session</th>
            <th className="px-4 py-3">시각</th>
            <th className="px-4 py-3">질문 버전</th>
            <th className="px-4 py-3">생시 인지</th>
            <th className="px-4 py-3">추론 결과</th>
            <th className="px-4 py-3">신뢰도</th>
            <th className="px-4 py-3">피드백</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {items.map(item => (
            <tr key={`${item.rowNumber}-${item.sessionId}`}>
              <td className="px-4 py-3 align-top">
                <Link className="font-medium text-blue-600 hover:text-blue-700 hover:underline" href={`/admin/results/${encodeURIComponent(item.sessionId)}`}>
                  {item.sessionId}
                </Link>
              </td>
              <td className="px-4 py-3 align-top whitespace-nowrap">{item.timestamp}</td>
              <td className="px-4 py-3 align-top whitespace-nowrap">{item.questionVersion}</td>
              <td className="px-4 py-3 align-top">{item.birthTimeKnowledge}</td>
              <td className="px-4 py-3 align-top">{item.inferenceResult.inferredZishi}</td>
              <td className="px-4 py-3 align-top">{item.inferenceResult.confidence}%</td>
              <td className="px-4 py-3 align-top">
                {item.feedback ? `${item.feedback.rating ?? '-'} / ${item.feedback.accuracy ?? '-'}` : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
