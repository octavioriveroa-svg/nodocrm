<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project Context & Baseline References
- **Platform**: Nodo CRM (`Next.js 16.2.3` App Router + `proxy.ts` + Supabase PostgreSQL `nlqrdxwyxmgdwawedweh`).
- **Context & Handoff**: Read `nodo_crm_handoff.md` for full portal, RBAC, data model, CFE tariff calculator, and transactional RPC documentation.
- **Verification Gates**: Always run `npx tsc --noEmit`, `npm run lint`, `npm test` (`npx tsx tests/test-runner.mjs`), and `npm run build` before finalizing changes.
