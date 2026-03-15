import type { StoredAdminAuditRecord } from '@workspace/spreadsheet-admin/server'

interface AuditTableProps {
  items: StoredAdminAuditRecord[]
}

export function AuditTable({ items }: AuditTableProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-sm text-slate-500">
        조회된 audit event가 없습니다.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">시각</th>
            <th className="px-4 py-3">Action</th>
            <th className="px-4 py-3">Actor</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Subject</th>
            <th className="px-4 py-3">Metadata</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {items.map(item => (
            <tr key={`${item.rowNumber}-${item.eventId}`}>
              <td className="px-4 py-3 align-top whitespace-nowrap">{item.at}</td>
              <td className="px-4 py-3 align-top">
                <div className="font-medium text-slate-900">{item.action}</div>
                <div className="mt-1 text-xs text-slate-500">{item.actionFamily}</div>
              </td>
              <td className="px-4 py-3 align-top">{item.actorEmail ?? '-'}</td>
              <td className="px-4 py-3 align-top">{item.actorRole ?? '-'}</td>
              <td className="px-4 py-3 align-top">
                <div className="font-medium text-slate-900">{item.subjectType}</div>
                <div className="mt-1 text-xs text-slate-500">{item.subjectId}</div>
              </td>
              <td className="px-4 py-3 align-top">
                <pre className="max-w-[420px] whitespace-pre-wrap break-words text-xs text-slate-600">
                  {JSON.stringify(item.metadata ?? null, null, 2)}
                </pre>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
