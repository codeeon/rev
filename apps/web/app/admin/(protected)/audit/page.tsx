import { AuditTable } from '@/components/admin/audit-table'
import { AdminStatCard } from '@/components/admin/stat-card'
import { auth } from '@/auth'
import { getRequiredCapabilityError } from '@/lib/admin-access'
import { listAdminAuditEventsFromSpreadsheet } from '@workspace/spreadsheet-admin/server'

function readSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0]?.trim() || undefined
  }

  return value?.trim() || undefined
}

function parseActionFamily(value: string | undefined): 'access' | 'mutation' | undefined {
  if (value === 'access' || value === 'mutation') {
    return value
  }

  return undefined
}

export default async function AdminAuditPage({
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
  const actionFamily = parseActionFamily(readSearchParam(resolvedSearchParams.actionFamily))
  const actorEmail = readSearchParam(resolvedSearchParams.actorEmail)

  try {
    const payload = await listAdminAuditEventsFromSpreadsheet({
      limit: 100,
      actionFamily,
      actorEmail,
    })
    const mutationCount = payload.items.filter(item => item.actionFamily === 'mutation').length
    const accessCount = payload.items.filter(item => item.actionFamily === 'access').length

    return (
      <div className="space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Audit Log</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">운영 감사 로그</h2>
              <p className="mt-2 text-sm text-slate-600">
                최근 최대 100건의 `AdminAuditLog`를 보여주며, access / mutation을 분리해서 확인할 수 있습니다.
              </p>
            </div>
          </div>

          <form action="/admin/audit" className="mt-5 grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_auto]">
            <select
              name="actionFamily"
              defaultValue={actionFamily ?? ''}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            >
              <option value="">전체</option>
              <option value="mutation">mutation</option>
              <option value="access">access</option>
            </select>
            <input
              type="text"
              name="actorEmail"
              defaultValue={actorEmail}
              placeholder="actor email"
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

        <div className="grid gap-4 md:grid-cols-3">
          <AdminStatCard label="Events" value={String(payload.items.length)} />
          <AdminStatCard label="Mutation" value={String(mutationCount)} />
          <AdminStatCard label="Access" value={String(accessCount)} />
        </div>

        <AuditTable items={payload.items} />
      </div>
    )
  } catch (error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-6 text-sm text-rose-700">
        audit log를 읽지 못했습니다. {error instanceof Error ? error.message : 'Unknown audit load error'}
      </div>
    )
  }
}
