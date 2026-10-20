import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { createClient } from '@supabase/supabase-js'

// ── Environment Loading ──────────────────────────────────────────────────────
const projectRoot = process.cwd()
const envLocalPath = path.join(projectRoot, '.env.local')

if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8')
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim()
      const val = trimmed.slice(eqIdx + 1).trim()
      if (!process.env[key]) {
        process.env[key] = val
      }
    }
  }
}

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nlqrdxwyxmgdwawedweh.supabase.co'
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
export const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

export const QA_USERS = {
  admin: {
    email: process.env.QA_USER_ADMIN_EMAIL || 'octavio@nodoenergy.com',
    password: process.env.QA_USER_ADMIN_PASSWORD || '',
    role: 'nodo_admin',
  },
  analista: {
    email: process.env.QA_USER_ANALISTA_EMAIL || 'analista@prueba.com',
    password: process.env.QA_USER_ANALISTA_PASSWORD || 'ANALISTA',
    role: 'nodo_analista',
  },
  epc: {
    email: process.env.QA_USER_EPC_EMAIL || 'epc@prueba.com',
    password: process.env.QA_USER_EPC_PASSWORD || 'EPCISTA',
    role: 'epc',
  },
  cliente: {
    email: process.env.QA_USER_CLIENTE_EMAIL || 'cliente@prueba.com',
    password: process.env.QA_USER_CLIENTE_PASSWORD || 'Cliente123',
    role: 'cliente_final',
  },
  financiero: {
    email: process.env.QA_USER_FINANCIERO_EMAIL || 'financiero@prueba.com',
    password: process.env.QA_USER_FINANCIERO_PASSWORD || 'Financiero123',
    role: 'financiero',
  },
  suministrador: {
    email: process.env.QA_USER_SUMINISTRADOR_EMAIL || 'suministrador@prueba.com',
    password: process.env.QA_USER_SUMINISTRADOR_PASSWORD || 'Suministrador123',
    role: 'suministrador',
  },
}

// ── Supabase Client Factories ────────────────────────────────────────────────
export function getAnonClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}

export function getServiceRoleClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// Cache auth sessions
const sessionCache = {}

export async function getAuthSession(userType = 'admin') {
  if (sessionCache[userType]) return sessionCache[userType]
  const creds = QA_USERS[userType]
  if (!creds) throw new Error(`Unknown user type: ${userType}`)

  const anon = getAnonClient()
  const { data, error } = await anon.auth.signInWithPassword({
    email: creds.email,
    password: creds.password,
  })

  if (error || !data.session) {
    throw new Error(`Failed to authenticate as ${userType} (${creds.email}): ${error?.message}`)
  }

  sessionCache[userType] = data
  return data
}

// Mock next/headers cookie store for Server Actions
let activeCookies = []

export function setActiveSessionCookies(session) {
  if (!session) {
    activeCookies = []
    return
  }
  const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0]
  const cookieName = `sb-${projectRef}-auth-token`
  activeCookies = [
    {
      name: cookieName,
      value: JSON.stringify(session),
    },
  ]
}

export function clearActiveSessionCookies() {
  activeCookies = []
}

// Intercept next/headers cookies() in Node environment
try {
  const require = createRequire(path.join(projectRoot, 'package.json'))
  const nextHeaders = require('next/headers')
  if (nextHeaders) {
    nextHeaders.cookies = async () => ({
      getAll: () => activeCookies,
      get: (name) => activeCookies.find((c) => c.name === name),
      set: (name, value) => {
        activeCookies = activeCookies.filter((c) => c.name !== name)
        activeCookies.push({ name, value })
      },
    })
  }
} catch (e) {
  console.warn('Warning: Could not patch next/headers cookies():', e.message)
}

// ── Test Assertions ──────────────────────────────────────────────────────────
export function assert(condition, message = 'Assertion failed') {
  if (!condition) {
    const err = new Error(message)
    err.isAssertion = true
    throw err
  }
}

export function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    const msg = message
      ? `${message} (Expected: ${JSON.stringify(expected)}, Actual: ${JSON.stringify(actual)})`
      : `Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`
    const err = new Error(msg)
    err.isAssertion = true
    throw err
  }
}

export function assertIncludes(haystack, needle, message) {
  const str = String(haystack)
  if (!str.includes(needle)) {
    const msg = message
      ? `${message} (Expected string to include "${needle}", got: "${str}")`
      : `Expected string to include "${needle}", got: "${str}"`
    const err = new Error(msg)
    err.isAssertion = true
    throw err
  }
}

// ── Test Suite Runner ────────────────────────────────────────────────────────
export class TestSuite {
  constructor(name) {
    this.name = name
    this.tests = []
  }

  test(name, fn) {
    this.tests.push({ name, fn })
  }

  async run(verbose = true) {
    console.log(`\n\x1b[1m\x1b[36m▶ Running Suite: ${this.name}\x1b[0m`)
    let passed = 0
    let failed = 0
    const results = []

    for (const t of this.tests) {
      const startTime = performance.now()
      try {
        await t.fn()
        const duration = (performance.now() - startTime).toFixed(1)
        passed++
        if (verbose) {
          console.log(`  \x1b[32m✔ [PASS]\x1b[0m ${t.name} \x1b[90m(${duration}ms)\x1b[0m`)
        }
        results.push({ name: t.name, status: 'PASS', duration })
      } catch (err) {
        const duration = (performance.now() - startTime).toFixed(1)
        failed++
        console.log(`  \x1b[31m✖ [FAIL]\x1b[0m ${t.name} \x1b[90m(${duration}ms)\x1b[0m`)
        console.log(`    \x1b[31mError: ${err.message}\x1b[0m`)
        if (!err.isAssertion && err.stack) {
          const stackLine = err.stack.split('\n')[1] || ''
          console.log(`    \x1b[90m${stackLine.trim()}\x1b[0m`)
        }
        results.push({ name: t.name, status: 'FAIL', duration, error: err.message })
      }
    }

    console.log(
      `\x1b[1mSummary for ${this.name}: ` +
      `\x1b[32m${passed} passed\x1b[0m, ` +
      `${failed > 0 ? `\x1b[31m${failed} failed\x1b[0m` : `\x1b[90m0 failed\x1b[0m`}` +
      `\x1b[0m\n`
    )

    return { name: this.name, passed, failed, total: this.tests.length, results }
  }
}
