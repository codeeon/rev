import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const RESULT_SHEET_HEADERS = [
  'sessionId',
  'timestamp',
  'engineVersion',
  'questionVersion',
  'birthTimeKnowledge',
  'approximateRangeJson',
  'surveyAnswersJson',
  'inferenceResultJson',
  'monitoringJson',
  'feedbackJson',
]

async function main() {
  const args = process.argv.slice(2)
  const outputIndex = args.indexOf('--output')

  if (outputIndex === -1) {
    process.stdout.write(`${RESULT_SHEET_HEADERS.join('\t')}\n`)
    return
  }

  const outputArg = args[outputIndex + 1]
  if (!outputArg) {
    throw new Error('--output requires a file path')
  }

  const outputPath = path.resolve(process.cwd(), outputArg)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${RESULT_SHEET_HEADERS.join('\t')}\n`, 'utf8')
  process.stdout.write(`${outputPath}\n`)
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
