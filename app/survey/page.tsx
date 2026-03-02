'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAppState } from '@/lib/store'
import { QuestionChoice } from '@/components/survey/question-choice'
import { ENGINE_QUESTIONS } from '@/lib/engine/loader'
import { inferZishi, toInferredHourPillar } from '@/lib/survey/weight-engine'
import type { SurveyAnswer } from '@/lib/survey/types'

export default function SurveyPage() {
  const router = useRouter()
  const { state, dispatch } = useAppState()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<SurveyAnswer[]>([])
  const [isAnimating, setIsAnimating] = useState(false)
  const [slideDirection, setSlideDirection] = useState<'in' | 'out'>('in')

  const totalQuestions = ENGINE_QUESTIONS.length  // 20
  const question = ENGINE_QUESTIONS[currentIndex]

  const handleAnswer = useCallback(
    (optionIndex: number) => {
      if (isAnimating) return

      const newAnswer: SurveyAnswer = {
        questionId: question.id,
        optionIndex,
      }
      const updatedAnswers = [...answers, newAnswer]
      setAnswers(updatedAnswers)

      if (currentIndex < totalQuestions - 1) {
        setIsAnimating(true)
        setSlideDirection('out')
        setTimeout(() => {
          setCurrentIndex(prev => prev + 1)
          setSlideDirection('in')
          setTimeout(() => setIsAnimating(false), 300)
        }, 200)
      } else {
        // 설문 완료 — 엔진 실행
        const surveyResult = inferZishi(updatedAnswers, {
          approximateRange: state.birthTimeKnowledge === 'approximate' ? state.approximateRange : null,
        })
        const inferredHour = toInferredHourPillar(surveyResult)

        dispatch({ type: 'SET_SURVEY_ANSWERS', payload: updatedAnswers })
        dispatch({ type: 'SET_INFERRED_HOUR', payload: inferredHour })

        router.push('/analyzing')
      }
    },
    [currentIndex, answers, dispatch, isAnimating, question, router, state.approximateRange, state.birthTimeKnowledge, totalQuestions]
  )

  function handleBack() {
    if (currentIndex > 0) {
      setIsAnimating(true)
      setSlideDirection('out')
      setTimeout(() => {
        setCurrentIndex(prev => prev - 1)
        setAnswers(prev => prev.slice(0, -1))
        setSlideDirection('in')
        setTimeout(() => setIsAnimating(false), 300)
      }, 200)
    } else {
      router.back()
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 flex flex-col gap-3 bg-background px-5 pb-3 pt-4">
        <div className="flex items-center gap-2">
          <button
            onClick={handleBack}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-secondary"
            aria-label="뒤로 가기"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
            />
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {currentIndex + 1}/{totalQuestions}
          </span>
        </div>
      </header>

      <div className="flex flex-1 flex-col px-5 pt-4">
        <div
          className={`transition-all duration-300 ${
            slideDirection === 'in' ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
          }`}
        >
          <p className="mb-2 text-[13px] font-semibold text-primary">
            Q{currentIndex + 1}
          </p>
          <h2 className="mb-8 whitespace-pre-line text-[22px] font-bold leading-tight text-foreground">
            {question.text}
          </h2>

          <QuestionChoice
            options={question.options}
            onAnswer={handleAnswer}
          />
        </div>
      </div>
    </div>
  )
}
