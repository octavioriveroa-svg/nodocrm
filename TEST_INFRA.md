# Test Infrastructure Specification — Nodo CRM

## 1. Overview & Architecture

The testing infrastructure for **Nodo CRM** (`Next.js 16.2.3` App Router + Supabase PostgreSQL) is an end-to-end and integration test harness designed for rapid, deterministic execution, strict live-database safety, and zero external testing framework dependencies (no heavy Jest or Playwright overhead required for acceptance gates).

The runner is built natively on top of Node.js `performance.now()`, ES Modules (`.mjs`), and `npx tsx` to enable seamless execution across TypeScript source modules and domain boundaries.

```
tests/
├── test-runner.mjs                   # Main runner entrypoint (npm test)
├── test-utils.mjs                    # TestSuite class, assertions, env loader & session cache
├── domain-auth.test.mjs              # Domain: RBAC capability matrix, auth guards & error parity
├── domain-proyectos.test.mjs         # Domain: STAGE_ORDER, lifecycle rules, JSONB sanitization & hydration
├── modal-validation.test.mjs         # Modals: validarFvForm (hybrid BESS inverter omission) & validarBessForm
├── epc-scoping.test.mjs              # Security: Conjunctive EPC client document query isolation (.eq('cliente_id', id))
├── proxy-deeplinks.test.mjs          # Routing: Smart cross-portal deep-link rewriting & route aliases
├── tier1-feature-coverage.test.mjs   # Acceptance Tier 1: Core feature coverage
├── tier2-boundary-corner-cases.test.mjs # Acceptance Tier 2: Boundaries & malformed inputs
├── tier3-cross-feature.test.mjs      # Acceptance Tier 3: Cross-role and multi-feature interaction
└── tier4-real-world-scenarios.test.mjs  # Acceptance Tier 4: Real-world project creation & persistence checks
```

---

## 2. Test Suites & Coverage Inventory

The acceptance runner executes **9 distinct test suites** totaling **59 automated test cases**:

| Suite | File | Focus & Verified Invariants | Tests |
|---|---|---|---|
| **Tier 1** | `tests/tier1-feature-coverage.test.mjs` | • Server Action RBAC contracts (`adminDeleteUser`, `crearUsuarioAdmin`)<br/>• ProjectWizard capabilities & multi-step validations<br/>• Analyst directory queries & Sidebar active highlighting<br/>• MEM marketplace PostgREST query safety (`OfertasBoard`) | 13 |
| **Tier 2** | `tests/tier2-boundary-corner-cases.test.mjs` | • Unauthorized role matrices across unauthenticated callers, EPC & non-admins<br/>• Empty, null, and non-string parameter guards<br/>• Zero-match directory filtering & calculation boundary guards | 10 |
| **Tier 3** | `tests/tier3-cross-feature.test.mjs` | • Directory project discovery to full project detail inspection<br/>• EPC creator identity preservation & Finder attribution<br/>• Finder inviting EPC installer & MEM banner trigger on high demand | 5 |
| **Tier 4** | `tests/tier4-real-world-scenarios.test.mjs` | • Full multi-step hybrid solar + BESS project creation with DB persistence verification & cleanup<br/>• EPC project creation with Finder attribution<br/>• 2-step "Nodo busca instalador" flow | 3 |
| **Domain: Auth** | `tests/domain-auth.test.mjs` | • Role portal mapping (`ROLE_TO_PORTAL_PREFIX`, `getPortalPrefixForRole`) across all 8 roles<br/>• Stage changing capability (`canChangeProjectStage`)<br/>• Project deletion capability (`canDeleteProject`) scoped by admin/epc<br/>• Technical solution & winning option edit permissions<br/>• User invitation matrix (`canInviteRole`, `validateUserInvitationPermission`)<br/>• User creation privilege escalation guards (`validateUserCreationPermission`)<br/>• Server Action error parity against live Supabase auth | 8 |
| **Domain: Proyectos** | `tests/domain-proyectos.test.mjs` | • Complete 10-stage lifecycle sequence (`STAGE_ORDER`, `ESTADO_LABELS`, `SALES_CYCLE`)<br/>• Winning alternative & financing option requirement for approval (`validateStageTransition`)<br/>• State history updates (`calculateNextHistorialEstados`) and `plan_bloqueado` setting<br/>• Clean numeric parsing (`parseNum`) stripping formatting commas<br/>• Equipment JSONB sanitization (`sanitizeFvDatos`, `sanitizeBessDatos`)<br/>• Input hydration formatting (`hydrateFvForm`, `hydrateBessForm`) | 7 |
| **Modals: Validation** | `tests/modal-validation.test.mjs` | • `validarFvForm` with hybrid BESS on same site: valid when omitting FV inverters<br/>• `validarFvForm` without hybrid BESS: rejects omitted inverters with exact copy<br/>• Rejection of cross-site hybrid BESS inverter assumption<br/>• General FV required fields (modules, generation, capex)<br/>• `validarBessForm` required fields (power, capacity, brand, use, capex) | 4 |
| **Security: EPC Scoping** | `tests/epc-scoping.test.mjs` | • EPC client detail document query strictly scopes by `.eq('cliente_id', id)` and `.eq('epcista_id', callerId)`<br/>• Eliminates cross-client document leak from `.or()` query<br/>• Prevents document query execution when client has 0 assigned projects<br/>• Live Supabase read query verification using real QA sessions | 3 |
| **Routing: Proxy Deep-Links** | `tests/proxy-deeplinks.test.mjs` | • Cross-portal deep-link rewriting (e.g. `/analista/proyectos/[id]` → `/epc/proyectos/[id]` for EPC)<br/>• Sub-route preservation (`/plan`, `/instalaciones`)<br/>• Route alias translation (`/proyectos/nuevo` ↔ `/nuevo`)<br/>• Client route rewriting across supported portals<br/>• Safe fallback to `/${targetPath}` for unsupported routes<br/>• Query parameter and search string preservation | 6 |
| **TOTAL** | **9 Suites** | **Complete Platform Acceptance Suite** | **59** |

---

## 3. Database Safety & Test Isolation Protocol

The connected Supabase database (`nlqrdxwyxmgdwawedweh`) contains live business operations data from real customers and stakeholders. The test suite enforces strict data-safety rules:

1. **Read-Only Inspection**: Tests inspecting profiles, projects, clients, or telemetry query existing rows using standard PostgREST queries without mutations.
2. **Deterministic Temporary Records**: Tests requiring database writes (such as Tier 4 project creation) generate isolated UUIDs and names prefixed with `[E2E-TEST-...]`.
3. **Immediate Teardown**: Write tests execute a `finally` cleanup block that deletes only the newly created row IDs from dependent tables (`comentarios`, `archivos`, `proyecto_sitio_productos`, `config_financiamiento`, `opciones_financiamiento`, `configuraciones_tecnicas`, `proyecto_sitios`, `proyectos`), leaving all pre-existing production records intact.
4. **No Destructive DDL/DML**: No `DROP`, `TRUNCATE`, mass `DELETE`, or schema mutations are executed by any test.

---

## 4. How to Execute Tests

### Complete Acceptance Suite (Default)
```powershell
npm test
```
*or directly via `npx tsx`:*
```powershell
npx tsx tests/test-runner.mjs
```

### Run by Tier
```powershell
npx tsx tests/test-runner.mjs --tier=1
npx tsx tests/test-runner.mjs --tier=2
npx tsx tests/test-runner.mjs --tier=3
npx tsx tests/test-runner.mjs --tier=4
```

### Run by Specific Suite
```powershell
npx tsx tests/test-runner.mjs --suite=domain-auth
npx tsx tests/test-runner.mjs --suite=domain-proyectos
npx tsx tests/test-runner.mjs --suite=modal-validation
npx tsx tests/test-runner.mjs --suite=epc-scoping
npx tsx tests/test-runner.mjs --suite=proxy-deeplinks
```

### Standalone Suite Execution
Each test suite is self-executable via `npx tsx`:
```powershell
npx tsx tests/domain-auth.test.mjs
npx tsx tests/domain-proyectos.test.mjs
npx tsx tests/modal-validation.test.mjs
npx tsx tests/epc-scoping.test.mjs
npx tsx tests/proxy-deeplinks.test.mjs
```
