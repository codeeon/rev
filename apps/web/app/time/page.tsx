'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAppState } from '@/lib/store'
import { StepHeader } from '@/components/layout/step-header'
import { BottomButton } from '@/components/layout/bottom-button'
import { BRANCH_HOURS, BRANCH_KR, hourToBranch, type EarthlyBranch } from '@workspace/saju-core'
import { trackFunnelEvent } from '@/lib/analytics'

const HOURS = Array.from({ length: 24 }, (_, i) => i)

const APPROXIMATE_RANGES = [
  { label: '새벽 (1~5시)', start: 1, end: 5 },
  { label: '아침 (5~9시)', start: 5, end: 9 },
  { label: '오전 (9~12시)', start: 9, end: 12 },
  { label: '오후 (12~15시)', start: 12, end: 15 },
  { label: '늦은 오후 (15~19시)', start: 15, end: 19 },
  { label: '저녁 (19~23시)', start: 19, end: 23 },
  { label: '밤 (23~1시)', start: 23, end: 1 },
]

export default function TimePage() {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center"><span className="text-muted-foreground">로딩중...</span></div>}>
      <TimePageContent />
    </Suspense>
  )
}

function TimePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isApproximate = searchParams.get('mode') === 'approximate'
  const { dispatch } = useAppState()

  const [hour, setHour] = useState<number | ''>('')
  const [minute, setMinute] = useState<number>(0)
  const [selectedRange, setSelectedRange] = useState<number | null>(null)

  const mappedBranch: EarthlyBranch | null = typeof hour === 'number' ? hourToBranch(hour) : null
  const branchLabel = mappedBranch ? `${BRANCH_KR[mappedBranch]}시 (${BRANCH_HOURS[mappedBranch].label})` : null

  function handleExactSubmit() {
    if (typeof hour !== 'number') return
    trackFunnelEvent('submit_known_time', { value: hour })
    dispatch({ type: 'SET_INFERRED_HOUR', payload: null })
    dispatch({ type: 'SET_SURVEY_ANSWERS', payload: [] })
    dispatch({ type: 'SET_APPROXIMATE_RANGE', payload: null })
    dispatch({
      type: 'SET_BIRTH_INFO',
      payload: { hour, minute },
    })
    dispatch({
      type: 'SET_BIRTH_TIME_KNOWLEDGE',
      payload: 'known',
    })
    router.push('/analyzing')
  }

  function handleApproximateSubmit() {
    if (selectedRange === null) return
    const range = APPROXIMATE_RANGES[selectedRange]
    trackFunnelEvent('submit_approximate_time', { label: range.label })
    dispatch({
      type: 'SET_APPROXIMATE_RANGE',
      payload: { start: range.start, end: range.end },
    })
    dispatch({
      type: 'SET_BIRTH_TIME_KNOWLEDGE',
      payload: 'approximate',
    })
    router.push('/survey')
  }

  if (isApproximate) {
    return (
      <div className="flex flex-1 flex-col">
        <StepHeader backHref="/branch" />

        <div className="flex flex-1 flex-col px-5 pt-6">
          <h1 className="mb-2 text-[24px] font-bold leading-tight text-foreground">
            대략적인 시간대를
            <br />
            선택해주세요
          </h1>
          <p className="mb-8 text-[15px] text-muted-foreground">
            정확하지 않아도 괜찮아요.
            <br />
            추가 설문으로 더 정확하게 추론할게요.
          </p>

          <div className="flex flex-col gap-2">
            {APPROXIMATE_RANGES.map((range, i) => (
              <button
                key={range.label}
                onClick={() => setSelectedRange(i)}
                className={`flex h-12 items-center justify-center rounded-xl text-[15px] font-medium transition-all ${
                  selectedRange === i
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-foreground shadow-sm hover:bg-secondary'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        <BottomButton onClick={handleApproximateSubmit} disabled={selectedRange === null}>
          다음 - 추가 질문 응답하기
        </BottomButton>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <StepHeader backHref="/branch" />

      <div className="flex flex-1 flex-col px-5 pt-6">
        <h1 className="mb-2 text-[24px] font-bold leading-tight text-foreground">
          태어난 시간을
          <br />
          알려주세요
        </h1>
        <p className="mb-8 text-[15px] text-muted-foreground">
          출생 기록 또는 부모님에게 확인한 시간을 입력해주세요.
        </p>

        <div className="mb-6 flex gap-3">
          <div className="flex flex-1 flex-col gap-2">
            <label className="text-[13px] font-medium text-muted-foreground">시</label>
            <select
              value={hour}
              onChange={(e) => setHour(e.target.value ? Number(e.target.value) : '')}
              className="h-14 rounded-xl border border-input bg-card px-4 text-center text-[20px] font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">--</option>
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end pb-3 text-[24px] font-bold text-muted-foreground">:</div>
          <div className="flex flex-1 flex-col gap-2">
            <label className="text-[13px] font-medium text-muted-foreground">분</label>
            <select
              value={minute}
              onChange={(e) => setMinute(Number(e.target.value))}
              className="h-14 rounded-xl border border-input bg-card px-4 text-center text-[20px] font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                <option key={m} value={m}>
                  {String(m).padStart(2, '0')}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 시진 매핑 표시 */}
        {branchLabel && (
          <div className="rounded-xl bg-accent px-5 py-4">
            <p className="text-center text-[15px] font-medium text-accent-foreground">
              {branchLabel}
            </p>
          </div>
        )}
      </div>

      <BottomButton onClick={handleExactSubmit} disabled={typeof hour !== 'number'}>
        사주 분석하기
      </BottomButton>
    </div>
  )
}
