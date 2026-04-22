import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const BUNDLE_DIR = join(process.cwd(), '.next', 'static')

const FORBIDDEN_PATTERNS: Array<{ name: string; matcher: RegExp }> = [
  { name: 'OpenAI API key', matcher: /sk-[A-Za-z0-9_\-]{20,}/ },
  { name: 'OpenAI project key', matcher: /sk-proj-[A-Za-z0-9_\-]{10,}/ },
]

const FORBIDDEN_ENV_NAMES = ['OPENAI_API_KEY', 'DB_PASSWORD']

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walk(path)))
    } else if (/\.(js|mjs|cjs|css|json|map)$/.test(entry.name)) {
      files.push(path)
    }
  }
  return files
}

async function main(): Promise<void> {
  let files: string[]
  try {
    files = await walk(BUNDLE_DIR)
  } catch (err) {
    console.error(`[check-bundle-secrets] Unable to read ${BUNDLE_DIR}. Run 'next build' first.`)
    console.error(err)
    process.exit(2)
  }

  const envValues = FORBIDDEN_ENV_NAMES.map((name) => {
    const v = process.env[name]
    return v && v.trim().length >= 8 ? { name, value: v } : null
  }).filter((x): x is { name: string; value: string } => x !== null)

  const violations: Array<{ file: string; reason: string }> = []

  for (const file of files) {
    const content = await readFile(file, 'utf8').catch(() => '')
    if (!content) continue
    for (const { name, matcher } of FORBIDDEN_PATTERNS) {
      if (matcher.test(content)) {
        violations.push({ file, reason: `${name} pattern match` })
      }
    }
    for (const { name, value } of envValues) {
      if (content.includes(value)) {
        violations.push({ file, reason: `literal value of ${name}` })
      }
    }
  }

  if (violations.length > 0) {
    console.error(`[check-bundle-secrets] Found ${violations.length} potential secret(s) in client bundle:`)
    for (const v of violations) {
      console.error(`  - ${v.file}: ${v.reason}`)
    }
    process.exit(1)
  }

  console.log(`[check-bundle-secrets] OK. Scanned ${files.length} bundle files, no secrets detected.`)
}

main()
