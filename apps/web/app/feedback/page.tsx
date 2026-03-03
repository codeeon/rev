'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAppState } from '@/lib/store'
import { StepHeader } from '@/components/layout/step-header'
import { BottomButton } from '@/components/layout/bottom-button'
import { Star, Check } from 'lucide-react'
import { ENGINE_SETTINGS } from '@workspace/time-inference'

const ACCURACY_OPTIONS = [
  { label: '정확히 맞는 것 같아요', value: 'accurate' },
  { label: '가능성이 있어요', value: 'possible' },
  { label: '잘 모르겠어요', value: 'unsure' },
  { label: '아닌 것 같아요', value: 'inaccurate' },
]

export default function FeedbackPage() {
  const router = useRouter()
  const { state } = useAppState()
  const [rating, setRating] = useState(0)
  const [accuracy, setAccuracy] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isInferred = !!state.inferredHour

  async function handleSubmit() {
    if (isSubmitting) {
      return
    }

    setIsSubmitting(true)

    const topCandidates = state.inferredHour?.topCandidates ?? []
    const top1Percentage = topCandidates[0]?.percentage ?? 0
    const top2Percentage = topCandidates[1]?.percentage ?? top1Percentage

    const payload = {
      sessionId:
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `session-${Date.now()}`,
      timestamp: new Date().toISOString(),
      engineVersion: ENGINE_SETTINGS.version,
      questionVersion: ENGINE_SETTINGS.version,
      birthTimeKnowledge: state.birthTimeKnowledge ?? 'unknown',
      approximateRange: state.birthTimeKnowledge === 'approximate' ? state.approximateRange : undefined,
      surveyAnswers: state.surveyAnswers,
      inferenceResult: {
        inferredZishi: state.inferredHour?.branchKr ?? 'known-hour',
        confidence: state.inferredHour?.confidence ?? 100,
        isCusp: !!state.inferredHour?.isCusp,
        topCandidates: topCandidates.map(candidate => ({
          branch: candidate.branch,
          branchKr: candidate.branchKr,
          score: candidate.score,
          percentage: candidate.percentage,
        })),
      },
      monitoring: {
        top1Prob: top1Percentage / 100,
        top2Gap: Math.max(0, (top1Percentage - top2Percentage) / 100),
        stdSoftmax: 0,
        stdRawScore: 0,
        roleInfluence: {},
        alerts: {},
      },
      feedback: {
        rating,
        accuracy: accuracy || undefined,
      },
    }

    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }).catch(() => null)
    } finally {
      setIsSubmitting(false)
      setSubmitted(true)
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-8">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-accent">
          <Check className="h-8 w-8 text-primary" />
        </div>
        <h1 className="mb-2 text-[22px] font-bold text-foreground">
          감사합니다!
        </h1>
        <p className="mb-8 text-center text-[15px] text-muted-foreground">
          소중한 피드백이 서비스 개선에
          <br />
          큰 도움이 됩니다.
        </p>
        <button
          onClick={() => router.push('/')}
          className="rounded-xl bg-primary px-8 py-3 text-[15px] font-semibold text-primary-foreground transition-all hover:opacity-90"
        >
          처음으로 돌아가기
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <StepHeader title="피드백" backHref="/result" />

      <div className="flex flex-1 flex-col gap-8 px-5 pt-4">
        {/* Rating */}
        <div className="flex flex-col gap-3">
          <h2 className="text-[18px] font-bold text-foreground">
            분석 결과가 본인과
            <br />
            일치한다고 느끼셨나요?
          </h2>
          <p className="text-[14px] text-muted-foreground">
            별점으로 정확도를 평가해주세요
          </p>
          <div className="flex justify-center gap-2 py-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className="p-1 transition-transform hover:scale-110"
                aria-label={`${star}점`}
              >
                <Star
                  className={`h-10 w-10 ${
                    star <= rating
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-border'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Hour Accuracy (only for inferred cases) */}
        {isInferred && (
          <div className="flex flex-col gap-3">
            <h3 className="text-[16px] font-bold text-foreground">
              추론된 생시가 맞다고
              <br />
              생각하시나요?
            </h3>
            <p className="text-[13px] text-muted-foreground">
              추론 결과: {state.inferredHour?.branchKr}시 (신뢰도 {state.inferredHour?.confidence}%)
            </p>
            <div className="flex flex-col gap-2">
              {ACCURACY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAccuracy(opt.value)}
                  className={`flex h-12 items-center justify-center rounded-xl text-[15px] font-medium transition-all ${
                    accuracy === opt.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card text-foreground shadow-sm hover:bg-secondary'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <BottomButton
        onClick={handleSubmit}
        disabled={rating === 0 || isSubmitting}
      >
        {isSubmitting ? '전송 중...' : '피드백 보내기'}
      </BottomButton>
    </div>
  )
}
