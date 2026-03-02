import { streamText } from 'ai'
import { buildAnalysisPrompt } from '@/lib/ai/prompts'
import { analyzeSaju, type BirthInfo, type InferredHourPillar } from '@workspace/saju-core'

export async function POST(req: Request) {
  const body = await req.json()
  const { birthInfo, inferredHour } = body as {
    birthInfo: BirthInfo
    inferredHour?: InferredHourPillar
  }

  const sajuResult = analyzeSaju(birthInfo, inferredHour)
  const prompt = buildAnalysisPrompt({ sajuResult, inferredHour })

  const result = streamText({
    model: 'google/gemini-2.0-flash',
    prompt,
    maxOutputTokens: 2000,
    temperature: 0.7,
  })

  return result.toTextStreamResponse()
}
