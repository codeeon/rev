'use client'

import type { QuestionOption } from '@/lib/survey/types'

interface QuestionChoiceProps {
  options: QuestionOption[]
  onAnswer: (value: string) => void
}

export function QuestionChoice({ options, onAnswer }: QuestionChoiceProps) {
  return (
    <div className="flex flex-col gap-3">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onAnswer(opt.value)}
          className="flex min-h-[52px] items-center justify-center rounded-2xl bg-card px-5 py-3.5 text-[15px] font-medium text-foreground shadow-sm transition-all duration-200 hover:bg-secondary active:scale-[0.98]"
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
