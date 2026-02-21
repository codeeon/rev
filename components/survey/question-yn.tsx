'use client'

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
        <button
          key={opt.value}
          onClick={() => onAnswer(opt.value)}
          className="flex h-14 items-center justify-center rounded-2xl bg-card text-[16px] font-semibold text-foreground shadow-sm transition-all duration-200 hover:bg-secondary active:scale-[0.98]"
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
