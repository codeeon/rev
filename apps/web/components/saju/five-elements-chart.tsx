'use client'

import { ELEMENT_KR, type FiveElementDistribution, type FiveElement } from '@workspace/saju-core'
import { Card, CardContent } from '@workspace/base-ui'

const COLORS: Record<FiveElement, string> = {
  wood: '#22c55e',
  fire: '#ef4444',
  earth: '#eab308',
  metal: '#94a3b8',
  water: '#0047AB',
}

interface FiveElementsChartProps {
  distribution: FiveElementDistribution
  dominantElement: FiveElement
  weakestElement: FiveElement
}

export function FiveElementsChart({
  distribution,
  dominantElement,
  weakestElement,
}: FiveElementsChartProps) {
  const data = (Object.entries(distribution) as [FiveElement, number][])
    .map(([element, value]) => ({
      name: ELEMENT_KR[element],
      value,
      element,
    }))
    .sort((a, b) => b.value - a.value)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {data.map((entry) => (
          <div key={entry.element} className="space-y-1">
            <div className="flex items-center justify-between text-[12px]">
              <span className="font-medium text-foreground">{entry.name}</span>
              <span className="font-semibold text-foreground">{entry.value.toFixed(1)}%</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(0, Math.min(100, entry.value))}%`,
                  backgroundColor: COLORS[entry.element],
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
        {data.map((entry) => (
          <div key={entry.element} className="flex items-center gap-1.5">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: COLORS[entry.element] }}
            />
            <span className="text-[13px] text-foreground">
              {entry.name}
            </span>
            <span className="text-[13px] font-semibold text-foreground">
              {entry.value.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="flex gap-2">
        <Card className="flex-1 bg-accent">
          <CardContent className="px-4 py-3 text-center">
            <p className="text-[11px] text-muted-foreground">가장 강한 오행</p>
            <p className="text-[15px] font-bold" style={{ color: COLORS[dominantElement] }}>
              {ELEMENT_KR[dominantElement]}
            </p>
          </CardContent>
        </Card>
        <Card className="flex-1 bg-secondary">
          <CardContent className="px-4 py-3 text-center">
            <p className="text-[11px] text-muted-foreground">보완이 필요한 오행</p>
            <p className="text-[15px] font-bold" style={{ color: COLORS[weakestElement] }}>
              {ELEMENT_KR[weakestElement]}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
