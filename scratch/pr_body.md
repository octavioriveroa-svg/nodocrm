## Summary of Changes

This PR delivers 4 comprehensive 360º platform updates spanning database schema, backend aggregations, types, creation forms, modals, and the project detail view:

---

### 1. Inversores Híbridos en BESS (Hybrid Inverters)
- **BESS Form Support**: Added the `Inversores híbridos (también manejan FV)` checkbox to the BESS creation and edit forms (`app/(portals)/{admin,epc,finder}/.../nuevo/page.tsx` and `components/EditarSolucionTecnicaModal.tsx`).
- **FV Form Inverter Validation**: When a hybrid BESS is configured on a site, the FV form automatically relaxes inverter requirements (making `num_inversores`, `potencia_inversores_kw`, and `marca_inversores` optional) and displays an informative banner: *"Los inversores del BESS híbrido en este sitio cubren la conversión FV. Los campos de inversores son opcionales."*
- **UI Display (`DetalleProyecto.tsx` & `ProductoCard`)**:
  - BESS cards display an `Híbrido` badge.
  - FV product cards with no inverter data on a hybrid site show `Inversores: Cubiertos por BESS híbrido` and omit redundant inverter capacity fields.

---

### 2. Ruta Condicional en Creación de Proyectos (`nodo_busca`)
- **2-Step Wizard**: When selecting *"Quiero que Nodo me ayude a encontrar un instalador"* (`nodo_busca`):
  - Step indicator changes from 3 steps to 2 steps: `['Información básica', 'Sitios']`.
  - In Step 1, technical configuration tabs and product creation forms are hidden. Users can upload/select site info (RPU, nombre en recibo, CFE PDF, demanda contratada, etc.) and create new sites inline.
  - Validation requires at least one selected site and skips product validation.
  - Submitting automatically generates a default pending configuration (`'Pendiente definición'`) and financing vehicle (`'Recomendación de Nodo'`), linking them in `config_financiamiento`.

---

### 3. Visualización y Consistencia de Moneda (USD)
- **Dynamic Currency Derivation**:
  - `proyectos.moneda` and `configuraciones_tecnicas.moneda` are now derived directly from product-level currencies (`capex_moneda`, defaulting to `USD`).
  - Active configuration views and technical summary cards in `DetalleProyecto.tsx` and modal editors consistently display total investment and CAPEX values in USD without incorrect MXN labels.

---

### 4. Reubicación del Ahorro (Gross vs. Net Savings)
- **Database Schema (`v27_hybrid_inverters_and_savings.sql`)**:
  - Added `ahorro_estimado_mensual` and `ahorro_moneda` to `configuraciones_tecnicas` for gross solution savings.
- **Sites & Products Step**:
  - Added Gross Estimated Monthly Savings (`Ahorro bruto estimado mensual`) input inside the Technical Configuration details panel in Step 1 and in `EditarSolucionTecnicaModal.tsx`.
- **Financing Step**:
  - Relabeled financing savings input to `Ahorro neto mensual (post-financiamiento)` and kept it optional.
- **Detail View & Dashboard Aggregations**:
  - In `DetalleProyecto.tsx`, gross monthly savings is displayed inside the **Solución Técnica** summary card.
  - `lib/dashboard-data.ts` calculates platform payback prioritizing gross savings from winning configurations.

---

## Migration Required
Run `supabase/v27_hybrid_inverters_and_savings.sql` in the Supabase SQL Editor.

## Verification
- Clean TypeScript compile via `npx tsc --noEmit` (0 errors).
