'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAppState } from '@/lib/store'
import { analyzeSaju, isValidBirthInfo, isValidInferredHour } from '@workspace/saju-core'

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
  const analysisStarted = useRef(false)

  // Rotating loading messages
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length)
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  // Animated dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'))
    }, 500)
    return () => clearInterval(interval)
  }, [])

  // Progress bar animation
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev
        return prev + Math.random() * 8
      })
    }, 600)
    return () => clearInterval(interval)
  }, [])

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

      // Calculate saju locally first
      const sajuResult = analyzeSaju(birthInfo, inferredHour)
      dispatch({ type: 'SET_SAJU_RESULT', payload: sajuResult })
      dispatch({ type: 'SET_ANALYZING', payload: true })

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

        if (!response.ok) throw new Error('Analysis failed')

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let fullText = ''

        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const chunk = decoder.decode(value, { stream: true })
            fullText += chunk
            dispatch({ type: 'APPEND_ANALYSIS_TEXT', payload: chunk })
          }
        }

        // Parse sections from the full text
        const sections = parseAnalysisSections(fullText)
        dispatch({
          type: 'SET_ANALYSIS_RESULT',
          payload: {
            sections,
            summary: sections[0]?.content.slice(0, 100) || '',
            rawText: fullText,
          },
        })

        setProgress(100)
        dispatch({ type: 'SET_ANALYZING', payload: false })

        setTimeout(() => {
          router.push('/result')
        }, 500)
      } catch {
        // On error, still navigate to result with saju data (without AI text)
        dispatch({ type: 'SET_ANALYZING', payload: false })
        setProgress(100)
        setTimeout(() => {
          router.push('/result')
        }, 500)
      }
    }

    runAnalysis()
  }, [])

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

function parseAnalysisSections(text: string): Array<{ title: string; content: string }> {
  const sections: Array<{ title: string; content: string }> = []
  const regex = /###\s*(.+?)(?:\n|$)([\s\S]*?)(?=###|$)/g
  let match

  while ((match = regex.exec(text)) !== null) {
    const title = match[1].trim()
    const content = match[2].trim()
    if (title && content) {
      sections.push({ title, content })
    }
  }

  // Fallback if no sections found
  if (sections.length === 0 && text.trim()) {
    sections.push({ title: '사주 분석', content: text.trim() })
  }

  return sections
}
