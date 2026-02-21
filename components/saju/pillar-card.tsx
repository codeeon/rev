'use client'

import type { Pillar, FiveElement } from '@/lib/saju/types'
import { ELEMENT_KR } from '@/lib/saju/constants'
import { cn } from '@/lib/utils'

interface PillarCardProps {
  label: string
  pillar: Pillar
  isInferred?: boolean
  confidence?: number
}

const elementBg: Record<FiveElement, string> = {
  wood: 'bg-emerald-50',
  fire: 'bg-red-50',
  earth: 'bg-amber-50',
  metal: 'bg-slate-100',
  water: 'bg-blue-50',
}

const elementText: Record<FiveElement, string> = {
  wood: 'text-emerald-600',
  fire: 'text-red-500',
  earth: 'text-amber-600',
  metal: 'text-slate-500',
  water: 'text-blue-500',
}

const elementBorder: Record<FiveElement, string> = {
  wood: 'border-emerald-200',
  fire: 'border-red-200',
  earth: 'border-amber-200',
  metal: 'border-slate-200',
  water: 'border-blue-200',
}

export function PillarCard({ label, pillar, isInferred, confidence }: PillarCardProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[12px] font-medium text-muted-foreground">{label}</span>

      <div
        className={cn(
          'relative flex flex-col items-center gap-1 rounded-2xl border-2 px-3 py-4',
          elementBorder[pillar.stemElement]
        )}
      >
        {isInferred && (
          <span className="absolute -top-2.5 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
            추론
          </span>
        )}

        {/* 천간 (Heavenly Stem) */}
        <div
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-xl',
            elementBg[pillar.stemElement]
          )}
        >
          <span className={cn('text-[22px] font-bold', elementText[pillar.stemElement])}>
            {pillar.stem}
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {pillar.stemKr} ({ELEMENT_KR[pillar.stemElement].split('(')[0]})
        </span>

        {/* Divider */}
        <div className="my-1 h-px w-8 bg-border" />

        {/* 지지 (Earthly Branch) */}
        <div
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-xl',
            elementBg[pillar.branchElement]
          )}
        >
          <span className={cn('text-[22px] font-bold', elementText[pillar.branchElement])}>
            {pillar.branch}
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {pillar.branchKr} ({ELEMENT_KR[pillar.branchElement].split('(')[0]})
        </span>
      </div>

      {isInferred && confidence !== undefined && (
        <span className="text-[11px] text-primary">
          {'신뢰도 ' + confidence + '%'}
        </span>
      )}
    </div>
  )
}
