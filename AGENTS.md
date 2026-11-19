<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project Context & Baseline References
- **Platform**: Nodo CRM (`Next.js 16.2.3` App Router + `proxy.ts` + Supabase PostgreSQL `nlqrdxwyxmgdwawedweh`).
- **Context & Handoff**: Read `nodo_crm_handoff.md`, `PROJECT.md`, `docs/architecture/EXECUTION_ROADMAP.md`, and `docs/savings-calculator-simulator-blueprint.md` for full portal, RBAC, data model, CFE tariff calculator, Declarative Savings Calculator & Simulator (`lib/calculator/*`, `components/calculator/*`, `20261119000000_v29_savings_calculator.sql`), UI primitive, and transactional RPC documentation.
- **Verification Gates**: Always run `npx tsc --noEmit`, `npm run lint` (`npx eslint . --max-warnings=0`), `npm run test:calculator` (`vitest run`), `npm test` (`npx tsx tests/test-runner.mjs`), `npx tsx tests/adversarial-m3-empirical.test.mjs`, and `npm run build` before finalizing changes.
