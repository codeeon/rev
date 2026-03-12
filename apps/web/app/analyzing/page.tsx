'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAppState } from '@/lib/store'
import { parseAnalysisSections } from '@/lib/ai/analysis-sections'
import { resolveAnalyzeStreamBuffer } from '@/lib/ai/stream-protocol'
import type { SajuResult } from '@workspace/saju-core'
import { isValidBirthInfo, isValidInferredHour } from '@workspace/saju-core'
import { trackFunnelEvent } from '@/lib/analytics'

const LOADING_MESSAGES = [
  '사주 원국을 세우고 있어요...',
  '천간과 지지를 읽고 있어요...',
  '오행의 조화를 살피고 있어요...',
  '일간의 힘을 가늠하고 있어요...',
  '당신만의 운세를 정리하고 있어요...',
]

export default function AnalyzingPage() {
  const router = useRouter()
  const { state, dispatch } = useAppState()
  const [messageIndex, setMessageIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [dots, setDots] = useState('')
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const analysisStarted = useRef(false)

  function readAnalyzeErrorBody(payload: unknown): { message: string | null; sajuResult: SajuResult | null } {
    if (!payload || typeof payload !== 'object') {
      return { message: null, sajuResult: null }
    }

    const record = payload as { message?: unknown; sajuResult?: unknown }
    return {
      message: typeof record.message === 'string' && record.message.trim() ? record.message : null,
      sajuResult: (record.sajuResult ?? null) as SajuResult | null,
    }
  }

  // Rotating loading messages
  useEffect(() => {
    if (analysisError) return
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length)
    }, 2500)
    return () => clearInterval(interval)
  }, [analysisError])

  // Animated dots
  useEffect(() => {
    if (analysisError) return
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'))
    }, 500)
    return () => clearInterval(interval)
  }, [analysisError])

  // Progress bar animation
  useEffect(() => {
    if (analysisError) return
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev
        return prev + Math.random() * 8
      })
    }, 600)
    return () => clearInterval(interval)
  }, [analysisError])

  // Run analysis
  useEffect(() => {
    if (analysisStarted.current) return
    analysisStarted.current = true

    async function runAnalysis() {
      const birthInfoCandidate: unknown = state.birthInfo
      const inferredHourCandidate: unknown = state.birthTimeKnowledge === 'known' ? undefined : (state.inferredHour ?? undefined)

      if (!isValidBirthInfo(birthInfoCandidate)) {
        router.push('/input')
        return
      }

      if (!isValidInferredHour(inferredHourCandidate)) {
        router.push('/time')
        return
      }

      const birthInfo = birthInfoCandidate
      const inferredHour = inferredHourCandidate
      dispatch({ type: 'SET_ANALYZING', payload: true })
      setAnalysisError(null)
      let hasAuthoritativeSajuResult = false

      try {
        // Call AI API
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            birthInfo,
            inferredHour,
            surveyAnswers: state.surveyAnswers,
          }),
        })

        if (!response.ok) {
          const errorBody = readAnalyzeErrorBody(await response.json().catch(() => null))

          if (errorBody.sajuResult) {
            dispatch({ type: 'SET_SAJU_RESULT', payload: errorBody.sajuResult })
            trackFunnelEvent('analysis_failure', {
              birth_time_knowledge: state.birthTimeKnowledge ?? 'unknown',
            })
            dispatch({ type: 'SET_ANALYZING', payload: false })
            setProgress(100)
            setTimeout(() => {
              router.push('/result')
            }, 500)
            return
          }

          throw new Error(errorBody.message ?? 'Analysis failed')
        }

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let fullText = ''
        let protocolBuffer = ''
        let protocolResolved = false

        const appendVisibleText = (incomingChunk: string, flush = false) => {
          if (protocolResolved) {
            if (incomingChunk) {
              fullText += incomingChunk
              dispatch({ type: 'APPEND_ANALYSIS_TEXT', payload: incomingChunk })
            }
            return
          }

          protocolBuffer += incomingChunk
          const resolved = resolveAnalyzeStreamBuffer(protocolBuffer, flush)
          if (!resolved) {
            return
          }

          protocolResolved = true
          protocolBuffer = ''

          if (resolved.meta) {
            hasAuthoritativeSajuResult = true
            dispatch({ type: 'SET_SAJU_RESULT', payload: resolved.meta.sajuResult })
          }

          if (resolved.text) {
            fullText += resolved.text
            dispatch({ type: 'APPEND_ANALYSIS_TEXT', payload: resolved.text })
          }
        }

        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const chunk = decoder.decode(value, { stream: true })
            appendVisibleText(chunk)
          }

          appendVisibleText(decoder.decode(), true)
        } else {
          throw new Error('Missing response body stream')
        }

        // Parse sections from the full text
        if (!hasAuthoritativeSajuResult) {
          throw new Error('Missing analysis metadata')
        }

        const parsedSections = parseAnalysisSections(fullText)
        dispatch({
          type: 'SET_ANALYSIS_RESULT',
          payload: {
            sections: parsedSections.sections,
            summary: parsedSections.sections[0]?.content.slice(0, 100) || '',
            rawText: fullText,
            parser: {
              usedFallback: parsedSections.usedFallback,
              sectionCount: parsedSections.sections.length,
            },
          },
        })
        trackFunnelEvent('analysis_success', {
          value: parsedSections.sections.length,
          birth_time_knowledge: state.birthTimeKnowledge ?? 'unknown',
        })

        setProgress(100)
        dispatch({ type: 'SET_ANALYZING', payload: false })

        setTimeout(() => {
          router.push('/result')
        }, 500)
      } catch (error) {
        trackFunnelEvent('analysis_failure', {
          birth_time_knowledge: state.birthTimeKnowledge ?? 'unknown',
        })
        dispatch({ type: 'SET_ANALYZING', payload: false })
        setProgress(100)
        if (hasAuthoritativeSajuResult) {
          setTimeout(() => {
            router.push('/result')
          }, 500)
          return
        }

        setAnalysisError(error instanceof Error ? error.message : '분석을 완료하지 못했습니다.')
      }
    }

    runAnalysis()
  }, [dispatch, router, state.birthInfo, state.birthTimeKnowledge, state.inferredHour, state.surveyAnswers])

  if (analysisError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-8">
        <div className="w-full max-w-[320px] rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center">
          <h2 className="mb-3 text-[20px] font-bold text-foreground">
            분석을 완료하지 못했습니다
          </h2>
          <p className="mb-6 whitespace-pre-wrap text-[14px] leading-relaxed text-muted-foreground">
            {analysisError}
          </p>
          <button
            onClick={() => router.push('/input')}
            className="w-full rounded-xl bg-primary px-6 py-3 text-[15px] font-semibold text-primary-foreground"
          >
            처음부터 다시 하기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8">
      {/* Saju Characters Animation */}
      <div className="mb-10 flex gap-3">
        {['年', '月', '日', '時'].map((char, i) => (
          <div
            key={char}
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card text-[24px] font-bold text-primary shadow-sm"
            style={{
              animation: `pulse 2s ease-in-out ${i * 0.3}s infinite`,
            }}
          >
            {char}
          </div>
        ))}
      </div>

      {/* Loading Text */}
      <p className="mb-6 text-center text-[17px] font-medium text-foreground">
        사주를 분석하고 있습니다{dots}
      </p>
      <p
        className="mb-8 text-center text-[14px] text-muted-foreground transition-opacity duration-500"
        key={messageIndex}
      >
        {LOADING_MESSAGES[messageIndex]}
      </p>

      {/* Progress Bar */}
      <div className="h-1.5 w-full max-w-[240px] overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: translateY(0); opacity: 0.7; }
          50% { transform: translateY(-8px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
