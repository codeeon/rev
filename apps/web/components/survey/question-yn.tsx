'use client'

import { Button } from '@workspace/base-ui'

interface QuestionYNProps {
  onAnswer: (value: 'yes' | 'no') => void
}

export function QuestionYN({ onAnswer }: QuestionYNProps) {
  return (
    <div className="flex flex-col gap-3">
      {[
        { label: '네', value: 'yes' as const },
        { label: '아니오', value: 'no' as const },
      ].map((opt) => (
        <Button
          key={opt.value}
          onClick={() => onAnswer(opt.value)}
          variant="secondary"
          className="h-14 rounded-2xl bg-card text-[16px] font-semibold text-foreground shadow-sm active:scale-[0.98]"
        >
          {opt.label}
        </Button>
      ))}
    </div>
  )
}
