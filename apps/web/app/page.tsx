'use client'

import { useRouter } from 'next/navigation'
import { Sparkles, Clock, Brain, BarChart3 } from 'lucide-react'
import { ENGINE_QUESTIONS } from '@workspace/time-inference'
import { trackFunnelEvent } from '@/lib/analytics'

const steps = [
  {
    icon: Clock,
    title: '기본 정보 입력',
    description: '생년월일과 간단한 정보만',
  },
  {
    icon: Brain,
    title: 'AI 성향 분석',
    description: `${ENGINE_QUESTIONS.length}개의 짧은 질문에 답하기`,
  },
  {
    icon: BarChart3,
    title: '사주 리포트',
    description: 'AI가 분석한 맞춤 사주 결과',
  },
]

export default function LandingPage() {
  const router = useRouter()

  return (
    <div className="flex flex-1 flex-col">
      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center px-6 pb-8 pt-16">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h1 className="mb-4 text-center text-[28px] font-bold leading-tight tracking-tight text-foreground text-balance">
          {'태어난 시간을 몰라도\n사주를 알 수 있어요'}
        </h1>
        <p className="mb-10 text-center text-[16px] leading-relaxed text-muted-foreground text-balance">
          AI가 당신의 삶의 패턴을 분석해
          <br />
          생시를 추론하고, 사주를 풀어드립니다
        </p>

        {/* Process Steps */}
        <div className="mb-12 flex w-full flex-col gap-3">
          {steps.map((step, i) => (
            <div
              key={step.title}
              className="flex items-center gap-4 rounded-2xl bg-card p-4 shadow-sm"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent">
                <step.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="text-[13px] font-medium text-muted-foreground">
                  {'STEP ' + (i + 1)}
                </span>
                <span className="text-[15px] font-semibold text-foreground">
                  {step.title}
                </span>
                <span className="text-[13px] text-muted-foreground">
                  {step.description}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className="sticky bottom-0 bg-linear-to-t from-background via-background to-background/0 px-5 pb-8 pt-4">
        <button
          onClick={() => {
            trackFunnelEvent('start_analysis')
            router.push('/input')
          }}
          className="flex h-14 w-full items-center justify-center rounded-2xl bg-primary text-[17px] font-semibold text-primary-foreground transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
        >
          무료로 시작하기
        </button>
        <p className="mt-3 text-center text-[12px] text-muted-foreground">
          약 3~5분 소요 / 회원가입 없이 바로 시작
        </p>
      </div>
    </div>
  )
}
