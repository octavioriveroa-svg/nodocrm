#!/usr/bin/env node
import { tier1Suite } from './tier1-feature-coverage.test.mjs'
import { tier2Suite } from './tier2-boundary-corner-cases.test.mjs'
import { tier3Suite } from './tier3-cross-feature.test.mjs'
import { tier4Suite } from './tier4-real-world-scenarios.test.mjs'

import { domainAuthSuite } from './domain-auth.test.mjs'
import { domainProyectosSuite } from './domain-proyectos.test.mjs'
import { modalValidationSuite } from './modal-validation.test.mjs'
import { epcScopingSuite } from './epc-scoping.test.mjs'
import { proxyDeeplinksSuite } from './proxy-deeplinks.test.mjs'

// Parse CLI arguments
const args = process.argv.slice(2)
let selectedTier = null
let selectedSuite = null
let verbose = true

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--tier' && args[i + 1]) {
    selectedTier = parseInt(args[i + 1], 10)
    i++
  } else if (args[i].startsWith('--tier=')) {
    selectedTier = parseInt(args[i].split('=')[1], 10)
  } else if (args[i] === '--suite' && args[i + 1]) {
    selectedSuite = args[i + 1]
    i++
  } else if (args[i].startsWith('--suite=')) {
    selectedSuite = args[i].split('=')[1]
  } else if (args[i] === '--quiet') {
    verbose = false
  }
}

const suites = [
  // Acceptance Tiers 1 - 4
  { id: 'tier1', tier: 1, suite: tier1Suite },
  { id: 'tier2', tier: 2, suite: tier2Suite },
  { id: 'tier3', tier: 3, suite: tier3Suite },
  { id: 'tier4', tier: 4, suite: tier4Suite },

  // Architecture & Domain Refactoring Suites (R1 - R4)
  { id: 'domain-auth', suite: domainAuthSuite },
  { id: 'domain-proyectos', suite: domainProyectosSuite },
  { id: 'modal-validation', suite: modalValidationSuite },
  { id: 'epc-scoping', suite: epcScopingSuite },
  { id: 'proxy-deeplinks', suite: proxyDeeplinksSuite },
]

async function runAll() {
  console.log('\n\x1b[1m\x1b[35m════════════════════════════════════════════════════════════════════════\x1b[0m')
  console.log('\x1b[1m\x1b[35m  NODO CRM PLATFORM REFACTORING & HARDENING — ACCEPTANCE TEST RUNNER    \x1b[0m')
  console.log('\x1b[1m\x1b[35m════════════════════════════════════════════════════════════════════════\x1b[0m\n')

  let suitesToRun = suites
  if (selectedTier) {
    suitesToRun = suites.filter((s) => s.tier === selectedTier)
    if (suitesToRun.length === 0) {
      console.error(`\x1b[31mError: Tier ${selectedTier} not recognized. Choose 1, 2, 3, or 4.\x1b[0m`)
      process.exit(1)
    }
  } else if (selectedSuite) {
    suitesToRun = suites.filter((s) => s.id === selectedSuite || s.suite.name.toLowerCase().includes(selectedSuite.toLowerCase()))
    if (suitesToRun.length === 0) {
      console.error(`\x1b[31mError: Suite "${selectedSuite}" not recognized.\x1b[0m`)
      process.exit(1)
    }
  }

  const overallStart = performance.now()
  const suiteResults = []

  for (const { suite } of suitesToRun) {
    const res = await suite.run(verbose)
    suiteResults.push(res)
  }

  const overallDuration = ((performance.now() - overallStart) / 1000).toFixed(2)

  // ── Overall Summary Table ──────────────────────────────────────────────────
  console.log('\x1b[1m\x1b[35m════════════════════════════════════════════════════════════════════════\x1b[0m')
  console.log('\x1b[1m  FINAL TEST RESULTS SUMMARY                                            \x1b[0m')
  console.log('\x1b[1m\x1b[35m════════════════════════════════════════════════════════════════════════\x1b[0m')

  let totalTests = 0
  let totalPassed = 0
  let totalFailed = 0

  for (const res of suiteResults) {
    totalTests += res.total
    totalPassed += res.passed
    totalFailed += res.failed
    const statusTag = res.failed === 0
      ? '\x1b[32m✔ PASS\x1b[0m'
      : '\x1b[31m✖ FAIL\x1b[0m'
    console.log(`  ${statusTag}  ${res.name.padEnd(52)} (${res.passed}/${res.total} passed)`)
  }

  console.log('────────────────────────────────────────────────────────────────────────')
  console.log(
    `  Total Tests: \x1b[1m${totalTests}\x1b[0m | ` +
    `Passed: \x1b[1m\x1b[32m${totalPassed}\x1b[0m | ` +
    `Failed: ${totalFailed > 0 ? `\x1b[1m\x1b[31m${totalFailed}\x1b[0m` : `\x1b[1m\x1b[32m0\x1b[0m`} | ` +
    `Time: \x1b[90m${overallDuration}s\x1b[0m`
  )
  console.log('\x1b[1m\x1b[35m════════════════════════════════════════════════════════════════════════\x1b[0m\n')

  if (totalFailed > 0) {
    console.error(`\x1b[31mTest run failed with ${totalFailed} failure(s).\x1b[0m`)
    process.exit(1)
  } else {
    console.log(`\x1b[32mAll ${totalTests} acceptance tests passed successfully!\x1b[0m\n`)
    process.exit(0)
  }
}

runAll().catch((err) => {
  console.error('\x1b[31mFatal test runner error:\x1b[0m', err)
  process.exit(1)
})
