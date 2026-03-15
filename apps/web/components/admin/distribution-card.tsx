import type { DistributionItem } from '@/lib/admin-insights'

interface DistributionCardProps {
  title: string
  description?: string
  items: DistributionItem[]
  emptyMessage?: string
}

export function DistributionCard({
  title,
  description,
  items,
  emptyMessage = '표시할 데이터가 없습니다.',
}: DistributionCardProps) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {description ? <p className="mt-2 text-sm text-slate-600">{description}</p> : null}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
          {emptyMessage}
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {items.map(item => (
            <div key={item.label} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm text-slate-700">
                <span className="font-medium text-slate-900">{item.label}</span>
                <span>
                  {item.count}건 · {item.share.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-slate-900 transition-[width]"
                  style={{ width: `${Math.max(item.share, item.share > 0 ? 6 : 0)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
