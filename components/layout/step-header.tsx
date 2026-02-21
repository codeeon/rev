'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

interface StepHeaderProps {
  title?: string
  currentStep?: number
  totalSteps?: number
  showBack?: boolean
  backHref?: string
}

export function StepHeader({
  title,
  currentStep,
  totalSteps,
  showBack = true,
  backHref,
}: StepHeaderProps) {
  const router = useRouter()

  return (
    <header className="sticky top-0 z-10 flex flex-col gap-3 bg-background px-5 pb-3 pt-4">
      <div className="flex items-center gap-2">
        {showBack && (
          <button
            onClick={() => (backHref ? router.push(backHref) : router.back())}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-secondary"
            aria-label="뒤로 가기"
          >
            <ChevronLeft className="h-6 w-6 text-foreground" />
          </button>
        )}
        {title && (
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        )}
      </div>
      {currentStep !== undefined && totalSteps !== undefined && (
        <div className="flex items-center gap-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {currentStep}/{totalSteps}
          </span>
        </div>
      )}
    </header>
  )
}
