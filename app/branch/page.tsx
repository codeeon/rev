'use client'

import { useRouter } from 'next/navigation'
import { useAppState } from '@/lib/store'
import { StepHeader } from '@/components/layout/step-header'
import { Clock, HelpCircle, Clock4 } from 'lucide-react'

const options = [
  {
    icon: Clock,
    value: 'known' as const,
    title: '네, 정확히 알아요',
    description: '출생 기록이나 부모님에게 확인했어요',
  },
  {
    icon: HelpCircle,
    value: 'unknown' as const,
    title: '아니오, 모르겠어요',
    description: 'AI가 설문으로 추론해드릴게요',
  },
  {
    icon: Clock4,
    value: 'approximate' as const,
    title: '대략적으로만 알아요',
    description: '아침/오후/저녁 정도는 알고 있어요',
  },
]

export default function BranchPage() {
  const router = useRouter()
  const { dispatch } = useAppState()

  function handleSelect(value: 'known' | 'unknown' | 'approximate') {
    dispatch({ type: 'SET_BIRTH_TIME_KNOWLEDGE', payload: value })

    switch (value) {
      case 'known':
        router.push('/time')
        break
      case 'unknown':
        router.push('/survey')
        break
      case 'approximate':
        router.push('/time?mode=approximate')
        break
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <StepHeader backHref="/input" />

      <div className="flex flex-1 flex-col px-5 pt-6">
        <h1 className="mb-2 text-[24px] font-bold leading-tight text-foreground">
          태어난 시간을
          <br />
          알고 계신가요?
        </h1>
        <p className="mb-8 text-[15px] leading-relaxed text-muted-foreground">
          시주(時柱)는 사주의 중요한 한 축이에요.
          <br />
          정확한 시간을 몰라도 괜찮아요.
        </p>

        <div className="flex flex-col gap-3">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              className="flex items-center gap-4 rounded-2xl bg-card p-5 text-left shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.98]"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent">
                <opt.icon className="h-6 w-6 text-primary" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[16px] font-semibold text-foreground">
                  {opt.title}
                </span>
                <span className="text-[13px] text-muted-foreground">
                  {opt.description}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
