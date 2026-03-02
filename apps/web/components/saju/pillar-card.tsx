'use client'

import { ELEMENT_KR, type Pillar, type FiveElement } from '@workspace/saju-core'
import { cn, Card, CardContent, Badge, Separator } from '@workspace/base-ui'

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

      <Card className={cn('relative border-2', elementBorder[pillar.stemElement])}>
        {isInferred && (
          <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[10px] font-semibold">
            추론
          </Badge>
        )}

        <CardContent className="flex flex-col items-center gap-1 px-3 py-4">

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

          <Separator className="my-1 h-px w-8" />

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
        </CardContent>
      </Card>

      {isInferred && confidence !== undefined && (
        <span className="text-[11px] text-primary">
          {'신뢰도 ' + confidence + '%'}
        </span>
      )}
    </div>
  )
}
