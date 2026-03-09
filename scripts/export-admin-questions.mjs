import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ADMIN_SHEET_HEADERS = [
  'version',
  'questionId',
  'structureRole',
  'category',
  'questionWeight',
  'questionText',
  'optionIndex',
  'optionText',
  'scoreMapJson',
  'isActive',
  'updatedAt',
]

function parseArgs(argv) {
  const args = {
    output: null,
    updatedAt: new Date().toISOString(),
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]

    if (token === '--output') {
      args.output = argv[index + 1] ?? null
      index += 1
      continue
    }

    if (token === '--updated-at') {
      args.updatedAt = argv[index + 1] ?? args.updatedAt
      index += 1
      continue
    }

    throw new Error(`Unsupported argument: ${token}`)
  }

  if (Number.isNaN(Date.parse(args.updatedAt))) {
    throw new Error(`Invalid ISO datetime for --updated-at: ${args.updatedAt}`)
  }

  return args
}

function normalizeCell(value) {
  return String(value).replace(/\r?\n/g, ' ').replace(/\t/g, ' ').trim()
}

function compareQuestionId(left, right) {
  const leftNumber = Number(left.replace(/[^0-9]/g, ''))
  const rightNumber = Number(right.replace(/[^0-9]/g, ''))

  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
    return leftNumber - rightNumber
  }

  return left.localeCompare(right)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const scriptDir = path.dirname(fileURLToPath(import.meta.url))
  const repoRoot = path.resolve(scriptDir, '..')
  const engineJsonPath = path.join(repoRoot, 'packages/domain/engine-data/src/data/engine.json')
  const raw = await readFile(engineJsonPath, 'utf8')
  const engine = JSON.parse(raw)

  if (!engine?.engine_settings?.version || !Array.isArray(engine?.questions)) {
    throw new Error(`Unexpected engine.json shape: ${engineJsonPath}`)
  }

  const version = String(engine.engine_settings.version)
  const questions = [...engine.questions].sort((left, right) => compareQuestionId(left.id, right.id))

  const lines = [ADMIN_SHEET_HEADERS.join('\t')]

  for (const question of questions) {
    question.options.forEach((option, optionIndex) => {
      const row = [
        version,
        question.id,
        question.structure_role,
        question.category,
        question.question_weight,
        question.text,
        optionIndex,
        option.text,
        JSON.stringify(option.score_map),
        'true',
        args.updatedAt,
      ]

      lines.push(row.map(normalizeCell).join('\t'))
    })
  }

  const output = `${lines.join('\n')}\n`

  if (args.output) {
    const outputPath = path.resolve(process.cwd(), args.output)
    await mkdir(path.dirname(outputPath), { recursive: true })
    await writeFile(outputPath, output, 'utf8')
    process.stdout.write(`${outputPath}\n`)
    return
  }

  process.stdout.write(output)
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
