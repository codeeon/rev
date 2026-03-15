import Link from 'next/link'
import type { StoredApprovalLogRecord } from '@workspace/spreadsheet-admin/server'

interface ApprovalTableProps {
  items: StoredApprovalLogRecord[]
  selectedApprovalId?: string
  actorEmail?: string
  draftId?: string
}

function buildApprovalHref(approvalId: string, actorEmail?: string, draftId?: string): string {
  const searchParams = new URLSearchParams()
  searchParams.set('approvalId', approvalId)
  if (actorEmail) {
    searchParams.set('actorEmail', actorEmail)
  }
  if (draftId) {
    searchParams.set('draftId', draftId)
  }

  const query = searchParams.toString()
  return `/admin/approvals${query ? `?${query}` : ''}`
}

export function ApprovalTable({ items, selectedApprovalId, actorEmail, draftId }: ApprovalTableProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-sm text-slate-500">
        조회된 approval log가 없습니다.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">승인 시각</th>
            <th className="px-4 py-3">Draft</th>
            <th className="px-4 py-3">버전</th>
            <th className="px-4 py-3">승인자</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">요약</th>
            <th className="px-4 py-3">코멘트</th>
            <th className="px-4 py-3">선택</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {items.map(item => (
            <tr
              key={`${item.rowNumber}-${item.approvalId}`}
              className={item.approvalId === selectedApprovalId ? 'bg-amber-50/70' : undefined}
            >
              <td className="px-4 py-3 align-top whitespace-nowrap">{item.approvedAt}</td>
              <td className="px-4 py-3 align-top font-medium text-slate-900">{item.draftId}</td>
              <td className="px-4 py-3 align-top">
                <div>{item.publishedVersion}</div>
                <div className="mt-1 text-xs text-slate-500">source {item.sourceVersion}</div>
              </td>
              <td className="px-4 py-3 align-top">{item.actorEmail ?? '-'}</td>
              <td className="px-4 py-3 align-top">{item.actorRole ?? '-'}</td>
              <td className="px-4 py-3 align-top">{item.changeSummary ?? '-'}</td>
              <td className="px-4 py-3 align-top whitespace-pre-wrap">{item.approvalComment ?? '-'}</td>
              <td className="px-4 py-3 align-top">
                <Link
                  href={buildApprovalHref(item.approvalId, actorEmail, draftId)}
                  className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                >
                  {item.approvalId === selectedApprovalId ? '선택됨' : '선택'}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
