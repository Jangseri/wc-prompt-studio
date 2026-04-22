import '@testing-library/jest-dom/vitest'
import { config as loadEnv } from 'dotenv'
import { resolve } from 'node:path'

loadEnv({ path: resolve(process.cwd(), '.env.test.local'), quiet: true })
