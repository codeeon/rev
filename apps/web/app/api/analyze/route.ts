import { streamText } from 'ai'
import { NextResponse } from 'next/server'
import { buildAnalysisPrompt } from '@/lib/ai/prompts'
import { analyzeSaju, parseAnalyzeInput } from '@workspace/saju-core'

export async function POST(req: Request) {
  let body: unknown

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsedInput = parseAnalyzeInput(body)
  if (!parsedInput) {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 })
  }

  const { birthInfo, inferredHour } = parsedInput

  try {
    const sajuResult = analyzeSaju(birthInfo, inferredHour)
    const prompt = buildAnalysisPrompt({ sajuResult, inferredHour })

    const result = streamText({
      model: 'google/gemini-2.0-flash',
      prompt,
      maxOutputTokens: 2000,
      temperature: 0.7,
    })

    return result.toTextStreamResponse()
  } catch {
    return NextResponse.json({ error: 'Failed to generate analysis' }, { status: 500 })
  }
}
