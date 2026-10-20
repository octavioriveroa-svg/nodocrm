# TEST_READY — Nodo CRM Acceptance Test Suite

**Status**: Verified & Ready  
**Execution Command**: `npm test` (or `npx tsx tests/test-runner.mjs`)  
**Execution Time**: ~93.6s  
**Results**: 59 passed, 0 failed, 0 skipped (100% pass rate)  
**Exit Code**: `0`  

---

## Acceptance Test Suite Summary

The comprehensive automated acceptance test suite for Nodo CRM platform refactoring and hardening covers all original acceptance criteria (Tiers 1–4) plus the architectural domain refactoring requirements (R1–R4).

All 59 tests execute cleanly across 9 test suites:

| Suite | File | Tests | Pass | Fail |
|---|---|---|---|---|
| **Tier 1** | `tests/tier1-feature-coverage.test.mjs` | 13 | 13 | 0 |
| **Tier 2** | `tests/tier2-boundary-corner-cases.test.mjs` | 10 | 10 | 0 |
| **Tier 3** | `tests/tier3-cross-feature.test.mjs` | 5 | 5 | 0 |
| **Tier 4** | `tests/tier4-real-world-scenarios.test.mjs` | 3 | 3 | 0 |
| **Domain: Auth** | `tests/domain-auth.test.mjs` | 8 | 8 | 0 |
| **Domain: Proyectos** | `tests/domain-proyectos.test.mjs` | 7 | 7 | 0 |
| **Modals: Validation** | `tests/modal-validation.test.mjs` | 4 | 4 | 0 |
| **Security: EPC Scoping** | `tests/epc-scoping.test.mjs` | 3 | 3 | 0 |
| **Routing: Proxy Deep-Links** | `tests/proxy-deeplinks.test.mjs` | 6 | 6 | 0 |
| **TOTAL** | **9 Suites** | **59** | **59** | **0** |

---

## Detailed Breakdown of Test Suites

### 1. Domain: Auth & Centralized RBAC (`tests/domain-auth.test.mjs`) — 8 Tests
1. `Auth.1`: Portal prefix mapping accurately resolves all 8 user roles (`nodo_admin` → `'admin'`, `nodo_analista` → `'analista'`, `epc` → `'epc'`, `finder` → `'finder'`, `cliente_final` → `'cliente'`, `financiero` → `'financiero'`, `suministrador` → `'mem'`, `pendiente` → `'pendiente'`).
2. `Auth.2`: Role classification helper predicates (`isNodoRole`, `isAdminRole`, `isAnalystRole`, `isEpcRole`, `isFinderRole`, `isClienteRole`, `isFinancieroRole`) correctly classify roles.
3. `Auth.3`: `canChangeProjectStage` permits only Nodo staff and EPC roles.
4. `Auth.4`: `canDeleteProject` permits Admin globally and EPC only on their assigned projects; rejects Analyst, Finder, and non-owner EPCs.
5. `Auth.5`: `canEditTechnicalSolution` and `canSelectWinningOption` enforce scoped ownership (Admin & Analyst globally, EPC scoped to own project).
6. `Auth.6`: `validateUserInvitationPermission` and `canInviteRole` enforce complete RBAC matrix across all role pairs.
7. `Auth.7`: `validateUserCreationPermission` enforces strict privilege escalation guards (Analyst and EPC blocked from creating `nodo_admin`).
8. `Auth.8`: Server actions (`adminDeleteUser`, `crearUsuarioAdmin`, `invitarUsuario`) preserve exact contracts and error parity with live Supabase authentication.

### 2. Domain: Proyectos Lifecycle & Data Sanitization (`tests/domain-proyectos.test.mjs`) — 7 Tests
1. `Proyectos.1`: `STAGE_ORDER` (10 stages), `ESTADO_LABELS`, and `TERMINAL_STAGES` define complete sales cycle and construction pipeline.
2. `Proyectos.2`: `validateStageTransition` enforces that advancing to approval or beyond (`aprobado`, `en_construccion`, `operativo`, `completado`) strictly requires BOTH a selected technical configuration and financing option.
3. `Proyectos.3`: `calculateNextHistorialEstados` and `getStageTransitionPayload` preserve state change history and set `plan_bloqueado = true` on `en_construccion`.
4. `Proyectos.4`: `parseNum` strictly sanitizes formatted strings, stripping formatting commas (`"1,500"` → `1500`, `"250,000"` → `250000`, `"12,345,678.90"` → `12345678.90`) and handling null/empty/invalid values gracefully.
5. `Proyectos.5`: `sanitizeFvDatos` produces clean numeric JSONB without formatting commas for `num_modulos`, `potencia_modulos_w`, `num_inversores`, `potencia_inversores_kw`, `generacion_anual_kwh`, and `capex`.
6. `Proyectos.6`: `sanitizeBessDatos` produces clean numeric JSONB without formatting commas for `potencia_kw`, `capacidad_kwh`, and `capex`.
7. `Proyectos.7`: `hydrateFvForm` and `hydrateBessForm` format stored clean numbers into localized strings for UI inputs and handle null/empty states.

### 3. Modals: FV + Hybrid BESS Validation & Required Fields (`tests/modal-validation.test.mjs`) — 4 Tests
1. `Modal.1`: `validarFvForm` allows omitting FV inverters when a hybrid BESS (`inversores_hibridos = true`) is present on the same site across both wizard (`p.bess`) and modal (`p.datos`) structures.
2. `Modal.2`: `validarFvForm` strictly rejects omitted inverters when NO hybrid BESS is on the site (including when hybrid BESS is on a different site in the same project).
3. `Modal.3`: `validarFvForm` validates required modules, generation, and capex fields.
4. `Modal.4`: `validarBessForm` enforces required fields (`potencia_kw`, `capacidad_kwh`, `marca`, `uso`, `capex`).

### 4. Security: EPC Client Detail Document & Project Scoping (`tests/epc-scoping.test.mjs`) — 3 Tests
1. `Scoping.1`: `fetchClienteDetalleCompleto` strictly scopes project queries by `.eq('cliente_id', clienteId)` and conjunctively filters by `.eq('epcista_id', viewerId)` for EPC (and `.eq('finder_id', viewerId)` for Finder).
2. `Scoping.2`: Documents are strictly scoped to matching projects, preventing cross-client and cross-EPC document leaks.
3. `Scoping.3`: Live Supabase read queries verify strict scoping across real production accounts and documents without data alteration.

### 5. Routing: Proxy Smart Cross-Portal Deep-Links (`tests/proxy-deeplinks.test.mjs`) — 6 Tests
1. `Proxy.1`: Cross-portal project detail links (e.g. `/analista/proyectos/[id]` accessed by EPC) rewrite to the user's portal (`/epc/proyectos/[id]`).
2. `Proxy.2`: Project sub-routes (`/plan`, `/instalaciones`) rewrite cleanly to user portal paths.
3. `Proxy.3`: Route aliases (`/proyectos/nuevo` ↔ `/nuevo`) are accurately translated between Admin/Analyst and EPC/Finder.
4. `Proxy.4`: Client detail and directory routes rewrite across supported portals.
5. `Proxy.5`: Unsupported routes fall back safely to `/${targetPath}` root (e.g. EPC accessing `/admin/usuarios` falls back to `/epc`).
6. `Proxy.6`: Query parameters and filter search strings are strictly preserved across rewrites.

### 6. Acceptance Tiers 1–4 (`tests/tier1`..`tier4`) — 31 Tests
- Core security, privilege escalation prevention, ProjectWizard multi-step state machine, CFE calculations, directory searching, and live multi-step project persistence with automatic teardown.

---

## How to Run the Test Suite

### Full Suite (All 59 Tests)
```powershell
npm test
```
*or:*
```powershell
npx tsx tests/test-runner.mjs
```

### Run by Specific Tier
```powershell
npx tsx tests/test-runner.mjs --tier=1
npx tsx tests/test-runner.mjs --tier=2
npx tsx tests/test-runner.mjs --tier=3
npx tsx tests/test-runner.mjs --tier=4
```

### Run by Specific Refactoring Suite
```powershell
npx tsx tests/test-runner.mjs --suite=domain-auth
npx tsx tests/test-runner.mjs --suite=domain-proyectos
npx tsx tests/test-runner.mjs --suite=modal-validation
npx tsx tests/test-runner.mjs --suite=epc-scoping
npx tsx tests/test-runner.mjs --suite=proxy-deeplinks
```
