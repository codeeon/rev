'use client'

import type { EngineOption } from '@/lib/engine/types'
import { Button } from '@workspace/base-ui'

interface QuestionChoiceProps {
  options: EngineOption[]
  onAnswer: (optionIndex: number) => void
}

export function QuestionChoice({ options, onAnswer }: QuestionChoiceProps) {
  return (
    <div className="flex flex-col gap-3">
      {options.map((opt, index) => (
        <Button
          key={index}
          onClick={() => onAnswer(index)}
          variant="secondary"
          className="min-h-[52px] rounded-2xl bg-card px-5 py-3.5 text-[15px] font-medium text-foreground shadow-sm active:scale-[0.98]"
        >
          {opt.text}
        </Button>
      ))}
    </div>
  )
}
