'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAppState } from '@/lib/store'
import { StepHeader } from '@/components/layout/step-header'
import { PillarCard } from '@/components/saju/pillar-card'
import { FiveElementsChart } from '@/components/saju/five-elements-chart'
import { ELEMENT_KR, STEM_KR } from '@/lib/saju/constants'
import { ChevronDown, ChevronUp, RotateCcw, MessageSquare } from 'lucide-react'

export default function ResultPage() {
  const router = useRouter()
  const { state } = useAppState()
  const [openSections, setOpenSections] = useState<Record<number, boolean>>({ 0: true })

  const { sajuResult, analysisResult, analysisText } = state

  // Redirect if no result
  if (!sajuResult) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-8">
        <p className="mb-4 text-center text-[17px] text-foreground">
          분석 결과가 없습니다
        </p>
        <button
          onClick={() => router.push('/')}
          className="rounded-xl bg-primary px-6 py-3 text-[15px] font-semibold text-primary-foreground"
        >
          처음으로 돌아가기
        </button>
      </div>
    )
  }

  const { fourPillars, fiveElements, dominantElement, weakestElement, dayMaster, dayMasterElement, dayMasterYinYang, inferredHour } = sajuResult
  const isInferred = !!inferredHour
  const name = state.birthInfo.name

  function toggleSection(index: number) {
    setOpenSections(prev => ({ ...prev, [index]: !prev[index] }))
  }

  // Parse sections from analysis text or use analysisResult
  const sections = analysisResult?.sections || []

  return (
    <div className="flex flex-1 flex-col pb-8">
      <StepHeader title="사주 분석 결과" showBack={false} />

      <div className="flex flex-col gap-6 px-5 pt-2">
        {/* Header */}
        <div className="rounded-2xl bg-card p-5 shadow-sm">
          <h2 className="mb-1 text-[20px] font-bold text-foreground">
            {name ? `${name}님의 사주` : '당신의 사주'}
          </h2>
          <p className="text-[14px] text-muted-foreground">
            일간(日干): {dayMaster} {STEM_KR[dayMaster]} - {ELEMENT_KR[dayMasterElement]} ({dayMasterYinYang === 'yang' ? '양' : '음'})
          </p>
        </div>

        {/* Four Pillars */}
        <div className="rounded-2xl bg-card p-5 shadow-sm">
          <h3 className="mb-5 text-[16px] font-bold text-foreground">사주 원국 (四柱原局)</h3>
          <div className="flex justify-center gap-4">
            <PillarCard label="시주" pillar={fourPillars.hour} isInferred={isInferred} confidence={inferredHour?.confidence} />
            <PillarCard label="일주" pillar={fourPillars.day} />
            <PillarCard label="월주" pillar={fourPillars.month} />
            <PillarCard label="년주" pillar={fourPillars.year} />
          </div>
        </div>

        {/* Five Elements Chart */}
        <div className="rounded-2xl bg-card p-5 shadow-sm">
          <h3 className="mb-4 text-[16px] font-bold text-foreground">오행 분포 (五行)</h3>
          <FiveElementsChart
            distribution={fiveElements}
            dominantElement={dominantElement}
            weakestElement={weakestElement}
          />
        </div>

        {/* AI Analysis Sections */}
        {sections.length > 0 ? (
          <div className="flex flex-col gap-3">
            <h3 className="text-[16px] font-bold text-foreground">AI 사주 분석</h3>
            {sections.map((section, i) => (
              <div key={i} className="overflow-hidden rounded-2xl bg-card shadow-sm">
                <button
                  onClick={() => toggleSection(i)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left"
                >
                  <span className="text-[15px] font-semibold text-foreground">
                    {section.title}
                  </span>
                  {openSections[i] ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
                {openSections[i] && (
                  <div className="border-t border-border px-5 pb-5 pt-4">
                    <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground">
                      {section.content}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : analysisText ? (
          <div className="rounded-2xl bg-card p-5 shadow-sm">
            <h3 className="mb-3 text-[16px] font-bold text-foreground">AI 사주 분석</h3>
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground">
              {analysisText}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-card p-5 shadow-sm">
            <h3 className="mb-3 text-[16px] font-bold text-foreground">AI 분석</h3>
            <p className="text-[14px] text-muted-foreground">
              AI 분석을 불러오지 못했습니다. 사주 원국과 오행 분포를 참고해주세요.
            </p>
          </div>
        )}

        {/* Inferred Hour Info */}
        {isInferred && inferredHour && (
          <div className="rounded-2xl border-2 border-primary/20 bg-accent/50 p-5">
            <h3 className="mb-2 text-[15px] font-bold text-foreground">
              시주 추론 정보
            </h3>
            <p className="mb-3 text-[13px] text-muted-foreground">
              설문 응답을 기반으로 추론된 생시입니다.
            </p>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">추론 시진</span>
                <span className="text-[14px] font-semibold text-foreground">
                  {inferredHour.branchKr}시
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">신뢰도</span>
                <span className="text-[14px] font-semibold text-primary">
                  {inferredHour.confidence}%
                </span>
              </div>
              {inferredHour.topCandidates.length > 1 && (
                <div className="mt-2 flex gap-2">
                  {inferredHour.topCandidates.map((c, i) => (
                    <div
                      key={c.branch}
                      className={`flex flex-1 flex-col items-center rounded-xl py-2 ${i === 0 ? 'bg-primary/10' : 'bg-secondary'}`}
                    >
                      <span className={`text-[14px] font-bold ${i === 0 ? 'text-primary' : 'text-foreground'}`}>
                        {c.branchKr}시
                      </span>
                      <span className="text-[11px] text-muted-foreground">{c.percentage}%</span>
                    </div>
                  ))}
                </div>
              )}
              {inferredHour.isCusp && (
                <div className="mt-3 rounded-xl bg-primary/5 px-4 py-3">
                  <p className="text-[13px] font-semibold text-primary">
                    두 시진이 경합 중이에요
                  </p>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    두 시진의 기운이 거의 동등하게 나타났습니다.
                    위 두 시진 모두 당신의 기운을 담고 있을 수 있어요.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/feedback')}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-[15px] font-semibold text-primary-foreground transition-all hover:opacity-90"
          >
            <MessageSquare className="h-4 w-4" />
            결과가 맞나요?
          </button>
          <button
            onClick={() => router.push('/input')}
            className="flex items-center justify-center gap-2 rounded-2xl bg-secondary px-5 py-4 text-[15px] font-semibold text-secondary-foreground transition-all hover:bg-secondary/80"
          >
            <RotateCcw className="h-4 w-4" />
            다시
          </button>
        </div>
      </div>
    </div>
  )
}
