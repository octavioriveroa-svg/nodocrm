# TEST_READY — Platform Refactoring Acceptance Suite

**Status**: Verified & Ready  
**Execution Command**: `npx tsx tests/test-runner.mjs`  
**Execution Time**: ~21.1s  
**Results**: 31 passed, 0 failed, 0 skipped (100% pass rate)  
**Exit Code**: `0`  

---

## Acceptance Test Suite Summary

The comprehensive automated acceptance test suite for Nodo CRM platform refactoring and hardening is fully assembled, runnable, and verified across 4 distinct tiers:

| Tier | Focus Area | Tests | Pass | Fail |
|---|---|---|---|---|
| **Tier 1** | **Feature Coverage (R1 - R4)**<br/>• R1 RBAC security tests (unauthorized delete & admin creation by analyst)<br/>• R2 ProjectWizard step transitions, validations & hybrid BESS inverter linking<br/>• R3 Analyst directory listing, profile normalization & Sidebar active highlighting<br/>• R4 MEM marketplace PostgREST query safety (`OfertasBoard.tsx`) | 13 | 13 | 0 |
| **Tier 2** | **Boundary & Corner Cases**<br/>• Unauthorized roles matrix (EPC, unauthenticated, non-admins)<br/>• Malformed target IDs & invalid role strings<br/>• Missing CFE receipt file handling<br/>• Empty filters & zero-match directory search queries<br/>• Zero/negative power/capex calculation boundaries<br/>• Extreme demand (> 1000 kW) MEM trigger boundaries | 10 | 10 | 0 |
| **Tier 3** | **Cross-Feature Combinations**<br/>• Analyst directory discovery to project detail graph inspection<br/>• EPC project creation with Finder attribution<br/>• Finder inviting EPC user<br/>• High demand site triggering MEM banner in Step 3<br/>• 2-step "Nodo busca instalador" direct submission flow | 5 | 5 | 0 |
| **Tier 4** | **Real-World Multi-Step Scenarios**<br/>• Full hybrid solar + BESS project creation across Admin with live Supabase persistence check (`proyectos`, `proyecto_sitios`, `configuraciones_tecnicas`, `opciones_financiamiento`, `config_financiamiento`, `proyecto_sitio_productos`) + cleanup<br/>• EPC multi-step project creation with Finder attribution persistence<br/>• 2-step Nodo busca project creation with pending defaults | 3 | 3 | 0 |
| **TOTAL** | **Complete Platform Acceptance Suite** | **31** | **31** | **0** |

---

## How to Run the Tests

### Run All Tiers (Default)
```bash
npx tsx tests/test-runner.mjs
```
*or via Node native ESM:*
```bash
node --env-file=.env.local tests/test-runner.mjs
```

### Run by Specific Tier
```bash
npx tsx tests/test-runner.mjs --tier 1
npx tsx tests/test-runner.mjs --tier 2
npx tsx tests/test-runner.mjs --tier 3
npx tsx tests/test-runner.mjs --tier 4
```

---

## Detailed Specifications
See full platform architecture, database RPC contracts, and portal capabilities in:
- [`nodo_crm_handoff.md`](./nodo_crm_handoff.md)
- [`MASTER_IMPLEMENTATION_PLAN.md`](./MASTER_IMPLEMENTATION_PLAN.md)
