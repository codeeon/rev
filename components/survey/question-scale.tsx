'use client'

import { useState } from 'react'

interface QuestionScaleProps {
  labels?: { low: string; high: string }
  onAnswer: (value: number) => void
}

export function QuestionScale({ labels, onAnswer }: QuestionScaleProps) {
  const [selected, setSelected] = useState<number | null>(null)

  function handleSelect(val: number) {
    setSelected(val)
    setTimeout(() => onAnswer(val), 300)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-center gap-3">
        {[1, 2, 3, 4, 5].map((val) => (
          <button
            key={val}
            onClick={() => handleSelect(val)}
            className={`flex h-14 w-14 items-center justify-center rounded-2xl text-[18px] font-bold transition-all duration-200 ${
              selected === val
                ? 'scale-110 bg-primary text-primary-foreground shadow-lg'
                : 'bg-card text-foreground shadow-sm hover:bg-secondary'
            }`}
          >
            {val}
          </button>
        ))}
      </div>
      {labels && (
        <div className="flex justify-between px-2">
          <span className="text-[12px] text-muted-foreground">{labels.low}</span>
          <span className="text-[12px] text-muted-foreground">{labels.high}</span>
        </div>
      )}
    </div>
  )
}
