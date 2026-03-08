import { streamText } from 'ai'

type AnalyzeTextStreamer = (prompt: string) => AsyncIterable<string>

const defaultAnalyzeTextStreamer: AnalyzeTextStreamer = (prompt: string) =>
  streamText({
    model: 'google/gemini-2.0-flash',
    prompt,
    maxOutputTokens: 2000,
    temperature: 0.7,
  }).textStream

let analyzeTextStreamer: AnalyzeTextStreamer = defaultAnalyzeTextStreamer

export function getAnalyzeTextStreamer(): AnalyzeTextStreamer {
  return analyzeTextStreamer
}

export function setAnalyzeTextStreamerForTest(streamer: AnalyzeTextStreamer | null): void {
  analyzeTextStreamer = streamer ?? defaultAnalyzeTextStreamer
}
