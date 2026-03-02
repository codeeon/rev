'use client'

import { createContext, useContext, useReducer, type ReactNode } from 'react'
import type { BirthInfo, SajuResult, AnalysisResult, InferredHourPillar } from '@workspace/saju-core'
import type { SurveyAnswer } from '@workspace/time-inference'

// State
export interface AppState {
  step: number
  birthInfo: Partial<BirthInfo>
  birthTimeKnowledge: 'known' | 'unknown' | 'approximate' | null
  approximateRange: { start: number; end: number } | null
  surveyAnswers: SurveyAnswer[]
  sajuResult: SajuResult | null
  inferredHour: InferredHourPillar | null
  analysisResult: AnalysisResult | null
  analysisText: string
  isAnalyzing: boolean
}

export const initialState: AppState = {
  step: 0,
  birthInfo: {},
  birthTimeKnowledge: null,
  approximateRange: null,
  surveyAnswers: [],
  sajuResult: null,
  inferredHour: null,
  analysisResult: null,
  analysisText: '',
  isAnalyzing: false,
}

// Actions
type Action =
  | { type: 'SET_BIRTH_INFO'; payload: Partial<BirthInfo> }
  | { type: 'SET_BIRTH_TIME_KNOWLEDGE'; payload: 'known' | 'unknown' | 'approximate' }
  | { type: 'SET_APPROXIMATE_RANGE'; payload: { start: number; end: number } | null }
  | { type: 'SET_SURVEY_ANSWERS'; payload: SurveyAnswer[] }
  | { type: 'SET_SAJU_RESULT'; payload: SajuResult }
  | { type: 'SET_INFERRED_HOUR'; payload: InferredHourPillar | null }
  | { type: 'SET_ANALYSIS_RESULT'; payload: AnalysisResult | null }
  | { type: 'APPEND_ANALYSIS_TEXT'; payload: string }
  | { type: 'SET_ANALYZING'; payload: boolean }
  | { type: 'RESET' }

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_BIRTH_INFO':
      return { ...state, birthInfo: { ...state.birthInfo, ...action.payload } }
    case 'SET_BIRTH_TIME_KNOWLEDGE':
      return { ...state, birthTimeKnowledge: action.payload }
    case 'SET_APPROXIMATE_RANGE':
      return { ...state, approximateRange: action.payload }
    case 'SET_SURVEY_ANSWERS':
      return { ...state, surveyAnswers: action.payload }
    case 'SET_SAJU_RESULT':
      return { ...state, sajuResult: action.payload }
    case 'SET_INFERRED_HOUR':
      return { ...state, inferredHour: action.payload }
    case 'SET_ANALYSIS_RESULT':
      return { ...state, analysisResult: action.payload }
    case 'APPEND_ANALYSIS_TEXT':
      return { ...state, analysisText: state.analysisText + action.payload }
    case 'SET_ANALYZING':
      return {
        ...state,
        isAnalyzing: action.payload,
        ...(action.payload ? { analysisText: '', analysisResult: null } : {}),
      }
    case 'RESET':
      return initialState
    default:
      return state
  }
}

// Context
const AppContext = createContext<{
  state: AppState
  dispatch: React.Dispatch<Action>
} | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppState() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useAppState must be used within an AppProvider')
  }
  return context
}
