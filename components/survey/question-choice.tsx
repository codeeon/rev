'use client'

import type { EngineOption } from '@/lib/engine/types'

interface QuestionChoiceProps {
  options: EngineOption[]
  onAnswer: (optionIndex: number) => void
}

export function QuestionChoice({ options, onAnswer }: QuestionChoiceProps) {
  return (
    <div className="flex flex-col gap-3">
      {options.map((opt, index) => (
        <button
          key={index}
          onClick={() => onAnswer(index)}
          className="flex min-h-[52px] items-center justify-center rounded-2xl bg-card px-5 py-3.5 text-[15px] font-medium text-foreground shadow-sm transition-all duration-200 hover:bg-secondary active:scale-[0.98]"
        >
          {opt.text}
        </button>
      ))}
    </div>
  )
}
