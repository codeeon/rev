import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

const SOURCE_PATH = path.join(repoRoot, 'packages/domain/engine-data/src/data/engine.json')
const DOCS_PATH = path.join(repoRoot, 'docs/data/engine.json')

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize)
  }

  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out = {}
    for (const key of Object.keys(value).sort()) {
      const next = value[key]
      if (next !== undefined) {
        out[key] = canonicalize(next)
      }
    }
    return out
  }

  return value
}

function hashJsonFile(filePath) {
  const raw = readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n')
  const parsed = JSON.parse(raw)
  const canonical = JSON.stringify(canonicalize(parsed))
  return createHash('sha256').update(canonical, 'utf8').digest('hex')
}

const sourceHash = hashJsonFile(SOURCE_PATH)
const docsHash = hashJsonFile(DOCS_PATH)

if (sourceHash !== docsHash) {
  console.error('engine.json SoT checksum mismatch detected.')
  console.error(`- ${SOURCE_PATH}: ${sourceHash}`)
  console.error(`- ${DOCS_PATH}: ${docsHash}`)
  console.error('Sync docs/data/engine.json with packages/domain/engine-data/src/data/engine.json.')
  process.exit(1)
}

console.log(`engine.json SoT checksum OK (${sourceHash})`)
