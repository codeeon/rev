import { streamText } from 'ai'
import { buildAnalysisPrompt } from '@/lib/ai/prompts'
import { analyzeSaju } from '@/lib/saju/calculator'
import type { BirthInfo, InferredHourPillar } from '@/lib/saju/types'

export async function POST(req: Request) {
  const body = await req.json()
  const { birthInfo, inferredHour, surveyAnswers } = body as {
    birthInfo: BirthInfo
    inferredHour?: InferredHourPillar
    surveyAnswers?: Array<{ questionId: string; value: string | number }>
  }

  // Calculate saju
  const sajuResult = analyzeSaju(birthInfo, inferredHour)

  // Build survey summary if available
  let surveySummary: string | undefined
  if (surveyAnswers && surveyAnswers.length > 0) {
    surveySummary = surveyAnswers
      .map((a) => `${a.questionId}: ${a.value}`)
      .join('\n')
  }

  // Build prompt
  const prompt = buildAnalysisPrompt(sajuResult, surveySummary)

  // Stream response from AI
  const result = streamText({
    model: 'google/gemini-2.0-flash',
    prompt,
    maxOutputTokens: 2000,
    temperature: 0.7,
  })

  return result.toTextStreamResponse()
}
