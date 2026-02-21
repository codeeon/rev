'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import type { FiveElementDistribution, FiveElement } from '@/lib/saju/types'
import { ELEMENT_KR } from '@/lib/saju/constants'

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
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry) => (
                <Cell key={entry.element} fill={COLORS[entry.element]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [`${value.toFixed(1)}%`, '']}
              contentStyle={{
                borderRadius: '12px',
                border: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                fontSize: '13px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
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
        <div className="flex-1 rounded-xl bg-accent px-4 py-3 text-center">
          <p className="text-[11px] text-muted-foreground">가장 강한 오행</p>
          <p className="text-[15px] font-bold" style={{ color: COLORS[dominantElement] }}>
            {ELEMENT_KR[dominantElement]}
          </p>
        </div>
        <div className="flex-1 rounded-xl bg-secondary px-4 py-3 text-center">
          <p className="text-[11px] text-muted-foreground">보완이 필요한 오행</p>
          <p className="text-[15px] font-bold" style={{ color: COLORS[weakestElement] }}>
            {ELEMENT_KR[weakestElement]}
          </p>
        </div>
      </div>
    </div>
  )
}
