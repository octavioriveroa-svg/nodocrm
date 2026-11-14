# Task Specification: TASK-006 — CFE Engine Expansion & Currency Normalization

**Task ID**: `TASK-006`  
**Task Title**: CFE Engine Expansion: Industrial/Residential Tariffs, SEMARNAT Metric, Multi-Currency Normalization & Proyecto Type Alignment  
**Target Subsystem**: CFE Economics Engine (`lib/tariffs/cfe-calculator.ts`, `lib/types.ts`, `supabase/migrations/`)  
**Priority**: P1 (Calculation Completeness & Precision)  
**Severity**: Medium (Distorts savings calculations when currency is USD; lacks documented industrial tariffs)  
**Status**: Completed & Verified  

---

## 1. Problem Statement & Root Cause

### 1.1 Problem Statement
The CFE calculation engine exhibits five distinct discrepancies against the system specifications documented in `nodo_crm_handoff.md:65`:
1. **Missing Industrial & Residential Tariffs**: `nodo_crm_handoff.md` specifies coverage for industrial high-voltage tariffs `DIST` (Subtransmisión) and `DIT` (Transmisión), as well as standard tariffs `01` and `DAC`. Currently, `CFE_TARIFF_RATES_MXN` only defines 4 tariffs (`GDMTH`, `GDMTO`, `PDBT`, `GDBT`). Any project on `DIST` or `DIT` falls back to `GDMTH`, skewing rate projections by up to 30%.
2. **Missing Regulatory Thresholds in `resolveCfeTariffLabel`**: The resolution helper lacks explicit boundary conditions for:
   - `DIT`: Demanda Industrial en Transmisión (demand $\ge 1000\text{ kW}$ on transmission $\ge 230\text{ kV}$, or volume $\ge 8000\text{ MWh/año}$).
   - `DIST`: Demanda Industrial en Subtransmisión (demand $\ge 1000\text{ kW}$ on subtransmission $69\text{ kV} \le V < 230\text{ kV}$, or volume $\ge 4000\text{ MWh/año}$).
   - `01`: Residencial básica (demand $\le 5\text{ kW}$ and volume $\le 3\text{ MWh/año}$, or `tipoServicio = 'domestico'` with volume $\le 3\text{ MWh/año}$).
   - `DAC`: Doméstica de Alto Consumo (`tipoServicio = 'domestico'` with volume $> 3\text{ MWh/año}$).
3. **Missing SEMARNAT Environmental Factor**: `nodo_crm_handoff.md:65` claims inclusion of the official Mexican SEMARNAT factor (0.423 kg CO₂e/kWh). This constant and its calculation helper do not exist in the codebase.
4. **Multi-Currency Normalization Failure**: If an engineering configuration sets `ahorro_moneda = 'USD'`, `calculateProjectSavingsMxn` pro-rates the USD figure directly by 365 days:
   $$\text{Ahorro (MXN)} = \frac{\text{ahorro\_estimado\_anual (USD)}}{365}$$
   Because no exchange rate multiplier (e.g. 18.0 MXN/USD) is applied, daily savings in Mexican Pesos are undercalculated by roughly 18x.
5. **Database & Interface Asymmetry**: `proyectos.tarifa_actual_cfe` was stored as `NUMERIC` in archive scripts, but represents a string code (`'GDMTH'`). Furthermore, the TypeScript interface `Proyecto` in `lib/types.ts` omitted `tarifa_actual_cfe?: string | null`.

---

## 2. Scope Boundaries

### In-Scope
1. Update `lib/tariffs/cfe-calculator.ts`:
   - Expand `CFE_TARIFF_RATES_MXN` to include `DIST` (2.15), `DIT` (1.98), `01` (1.05), and `DAC` (5.80).
   - Export constant `SEMARNAT_EMISSIONS_FACTOR_KG_CO2_PER_KWH = 0.423`.
   - Export function `calculateCo2AvoidedTonnes(totalGeneratedKwh: number): number`.
   - In `calculateProjectSavingsMxn`, accept `exchangeRateUsdMxn?: number = 18.0` and normalize USD savings to MXN.
   - Update `resolveCfeTariffLabel` to support options (`ResolveCfeTariffOptions`) and implement regulatory thresholds for `DIT`, `DIST`, `01`, and `DAC`.
2. Update `lib/types.ts`:
   - Add `tarifa_actual_cfe?: string | null` to `interface Proyecto`.
3. Author migration `supabase/migrations/20261112000003_tarifa_cfe_varchar.sql` to alter `proyectos.tarifa_actual_cfe` to `VARCHAR(20)`.
4. Add comprehensive unit tests in `tests/tier2-boundary-corner-cases.test.mjs` verifying tariff rates, emissions calculations, USD normalization, and regulatory threshold resolution.

### Out-of-Scope
- Implementing live scraping of the CFE official tariff portal.
- Implementing real-time Banxico USD/MXN exchange rate API feeds (a configurable static default of 18.0 MXN/USD is standard for pro-forma calculations).

---

## 3. Technical Prerequisites & Dependencies
- **Dependencies**: None. Operates directly on `lib/tariffs/cfe-calculator.ts` and `lib/types.ts`.

---

## 4. Inputs
- Target File: `lib/tariffs/cfe-calculator.ts`
- Type Definitions: `lib/types.ts`
- Specifications Reference: `nodo_crm_handoff.md` (lines 63–67)
- Database Entity: `public.proyectos.tarifa_actual_cfe`

---

## 5. Step-by-Step Implementation Instructions

### Step 1: Expand Tariff Catalog, Calculations & Thresholds in `lib/tariffs/cfe-calculator.ts`
In `lib/tariffs/cfe-calculator.ts`:

```typescript
export const CFE_TARIFF_RATES_MXN: Record<string, number> = {
  GDMTH: 2.85,
  GDMTO: 3.12,
  PDBT: 3.95,
  GDBT: 3.45,
  DIST: 2.15, // Demanda Industrial en Subtransmisión
  DIT: 1.98,  // Demanda Industrial en Transmisión
  '01': 1.05, // Residencial básica
  DAC: 5.80,  // Doméstica de Alto Consumo
}

/**
 * Official SEMARNAT Mexican national electric grid emission factor (kg CO2e / kWh)
 */
export const SEMARNAT_EMISSIONS_FACTOR_KG_CO2_PER_KWH = 0.423

/**
 * Calculates metric tonnes of CO2e avoided from total solar generation (kWh).
 */
export function calculateCo2AvoidedTonnes(totalGeneratedKwh: number): number {
  if (typeof totalGeneratedKwh !== 'number' || !Number.isFinite(totalGeneratedKwh) || totalGeneratedKwh <= 0) {
    return 0
  }
  return Math.round(((totalGeneratedKwh * SEMARNAT_EMISSIONS_FACTOR_KG_CO2_PER_KWH) / 1000) * 1000) / 1000
}

export interface ProjectSavingsInput {
  totalGeneratedKwh: number
  selectedConfig?: Pick<
    ConfiguracionTecnica,
    'ahorro_estimado_anual' | 'ahorro_estimado_mensual' | 'ahorro_moneda'
  > | null
  tarifaCfe?: string | null
  exchangeRateUsdMxn?: number // Default: 18.0
}

export function calculateProjectSavingsMxn({
  totalGeneratedKwh,
  selectedConfig,
  tarifaCfe,
  exchangeRateUsdMxn = 18.0,
}: ProjectSavingsInput): number {
  const genKwh =
    typeof totalGeneratedKwh === 'number' && Number.isFinite(totalGeneratedKwh)
      ? totalGeneratedKwh
      : 0

  if (genKwh <= 0) {
    const isUsd = selectedConfig?.ahorro_moneda === 'USD'
    const rateMultiplier = isUsd ? exchangeRateUsdMxn : 1.0

    const annualSavings = selectedConfig?.ahorro_estimado_anual
    if (typeof annualSavings === 'number' && Number.isFinite(annualSavings) && annualSavings > 0) {
      return Math.round(((annualSavings * rateMultiplier) / 365) * 100) / 100
    }
    const monthlySavings = selectedConfig?.ahorro_estimado_mensual
    if (typeof monthlySavings === 'number' && Number.isFinite(monthlySavings) && monthlySavings > 0) {
      return Math.round(((monthlySavings * rateMultiplier) / 30) * 100) / 100
    }
    return 0
  }

  const rate = CFE_TARIFF_RATES_MXN[tarifaCfe || 'GDMTH'] ?? CFE_TARIFF_RATES_MXN.GDMTH
  const result = Math.round(genKwh * rate * 100) / 100
  return Number.isFinite(result) ? result : 0
}

export type NivelTension = 'baja' | 'media' | 'subtransmision' | 'transmision'
export type TipoServicio = 'comercial' | 'industrial' | 'domestico'

export interface ResolveCfeTariffOptions {
  tension?: NivelTension | string | null
  tipoServicio?: TipoServicio | string | null
}

/**
 * Resolves the applicable CFE tariff category from contracted demand (kW) or annual volume (MWh).
 * Boundaries per CFE regulations & platform requirements:
 * - DIT: Demanda Industrial en Transmisión (demanda >= 1000 kW en transmisión OR demanda >= 1000 kW & volumen >= 8000 MWh)
 * - DIST: Demanda Industrial en Subtransmisión (demanda >= 1000 kW en subtransmisión OR demanda >= 1000 kW & volumen >= 4000 MWh)
 * - 01: Residencial básica en baja tensión (demanda <= 5 kW & volumen <= 3 MWh, o tipoServicio = 'domestico' con volumen <= 3 MWh)
 * - DAC: Doméstica de Alto Consumo (tipoServicio = 'domestico' con volumen > 3 MWh)
 * - GDMTH: Gran Demanda Media Tensión Horaria (demanda >= 100 kW OR volumen >= 500 MWh)
 * - GDMTO: Gran Demanda Media Tensión Ordinaria (demanda >= 25 kW with volumen >= 100 MWh, or demanda > 25 kW when volumen is null/unspecified)
 * - GDBT: Gran Demanda Baja Tensión (demanda > 25 kW AND volumen < 100 MWh)
 * - PDBT: Pequeña Demanda Baja Tensión (demanda <= 25 kW)
 * - Default fallback when neither metric is positive/valid: GDMTH
 */
export function resolveCfeTariffLabel(
  demandaKw?: number | null,
  volumenMwhAnual?: number | null,
  options?: ResolveCfeTariffOptions | string | null
): string {
  const opts: ResolveCfeTariffOptions =
    typeof options === 'string'
      ? options === 'domestico' || options === 'comercial' || options === 'industrial'
        ? { tipoServicio: options }
        : { tension: options }
      : options || {}

  const hasDemand = typeof demandaKw === 'number' && !Number.isNaN(demandaKw)
  const hasVolume = typeof volumenMwhAnual === 'number' && !Number.isNaN(volumenMwhAnual)

  const d = hasDemand ? demandaKw : null
  const v = hasVolume ? volumenMwhAnual : null

  // 1. Industrial High-Voltage: DIT (Transmisión) & DIST (Subtransmisión)
  if (d !== null && d >= 1000) {
    if (opts.tension === 'transmision' || (v !== null && v >= 8000)) {
      return 'DIT'
    }
    if (opts.tension === 'subtransmision' || (v !== null && v >= 4000)) {
      return 'DIST'
    }
    if (opts.tension === 'media') {
      return 'GDMTH'
    }
  }

  // 2. Residential / Domestic Tariffs: 01 (Básica) & DAC (Alto Consumo)
  if (opts.tipoServicio === 'domestico') {
    if (v !== null && v > 3) {
      return 'DAC'
    }
    return '01'
  }

  // Low demand domestic heuristic (demanda <= 5 kW and volumen <= 3 MWh)
  if (d !== null && d > 0 && d <= 5 && v !== null && v > 0 && v <= 3) {
    return '01'
  }

  // 3. GDMTH: High demand (>= 100 kW) OR high annual volume (>= 500 MWh)
  if ((d !== null && d >= 100) || (v !== null && v >= 500)) {
    return 'GDMTH'
  }

  // 4. Medium demand (> 25 kW and < 100 kW):
  if (d !== null && d > 25) {
    if (v !== null && v < 100) {
      return 'GDBT'
    }
    return 'GDMTO'
  }

  // Boundary condition: exactly 25 kW with >= 100 MWh volume -> GDMTO
  if (d === 25 && v !== null && v >= 100) {
    return 'GDMTO'
  }

  // 5. Small commercial low demand (<= 25 kW): Pequeña Demanda Baja Tensión (PDBT)
  if (d !== null && d > 0 && d <= 25) {
    return 'PDBT'
  }

  // 6. Fallback based solely on volume if demand is unspecified or non-positive
  if (v !== null && v > 0) {
    if (v >= 8000 && opts.tension === 'transmision') return 'DIT'
    if (v >= 4000 && opts.tension === 'subtransmision') return 'DIST'
    if (v >= 500) return 'GDMTH'
    if (v >= 100) return 'GDMTO'
    if (opts.tipoServicio === 'domestico') return v > 3 ? 'DAC' : '01'
    return 'GDBT'
  }

  // 7. Default reference tariff when neither metric is positive/valid
  return 'GDMTH'
}
```

### Step 2: Update `Proyecto` Interface in `lib/types.ts`
Add `tarifa_actual_cfe?: string | null` to `interface Proyecto` in `lib/types.ts`:

```typescript
export interface Proyecto {
  id: string
  nombre: string
  codigo_proyecto: string
  cliente_id: string
  // ...
  incluye_mem: boolean
  demanda_kw: number | null
  tarifa_actual_cfe?: string | null
  created_at: string
  updated_at: string
  historial_estados?: Record<string, string>
}
```

### Step 3: Create SQL Migration for `tarifa_actual_cfe`
Create `supabase/migrations/20261112000003_tarifa_cfe_varchar.sql`:
```sql
-- Migration: 20261112000003_tarifa_cfe_varchar.sql
-- Description: Idempotently ensures proyectos.tarifa_actual_cfe is VARCHAR(20) to store tariff codes (GDMTH, DIST, DIT, DAC, etc.)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'proyectos' AND column_name = 'tarifa_actual_cfe'
  ) THEN
    ALTER TABLE public.proyectos ADD COLUMN tarifa_actual_cfe VARCHAR(20);
  ELSE
    ALTER TABLE public.proyectos ALTER COLUMN tarifa_actual_cfe TYPE VARCHAR(20) USING tarifa_actual_cfe::text;
  END IF;
END $$;
```

### Step 4: Add Automated Tests
In `tests/tier2-boundary-corner-cases.test.mjs`, add:
```javascript
// ── 7. CFE Tariff Engine Expansion & Currency Normalization ────────────────
tier2Suite.test('7.1: CFE Calculator handles all 8 tariffs, CO2 avoidance, and USD normalization', async () => {
  const {
    CFE_TARIFF_RATES_MXN,
    SEMARNAT_EMISSIONS_FACTOR_KG_CO2_PER_KWH,
    calculateCo2AvoidedTonnes,
    calculateProjectSavingsMxn,
    resolveCfeTariffLabel,
  } = await import('../lib/tariffs/cfe-calculator.ts')

  // 1. All 8 tariffs defined with positive non-zero rates
  const tariffs = ['GDMTH', 'GDMTO', 'PDBT', 'GDBT', 'DIST', 'DIT', '01', 'DAC']
  assertEqual(Object.keys(CFE_TARIFF_RATES_MXN).length, 8, 'Catalog must contain exactly 8 tariffs')
  tariffs.forEach((t) => {
    assert(CFE_TARIFF_RATES_MXN[t] > 0, `Tariff rate for ${t} must be > 0`)
    const savings = calculateProjectSavingsMxn({ totalGeneratedKwh: 1000, tarifaCfe: t })
    assert(savings > 0, `Savings for tariff ${t} must be positive`)
  })
  assertEqual(CFE_TARIFF_RATES_MXN.DIST, 2.15, 'DIST rate must be 2.15')
  assertEqual(CFE_TARIFF_RATES_MXN.DIT, 1.98, 'DIT rate must be 1.98')
  assertEqual(CFE_TARIFF_RATES_MXN['01'], 1.05, '01 rate must be 1.05')
  assertEqual(CFE_TARIFF_RATES_MXN.DAC, 5.80, 'DAC rate must be 5.80')

  // 2. SEMARNAT CO2 Avoidance
  assertEqual(SEMARNAT_EMISSIONS_FACTOR_KG_CO2_PER_KWH, 0.423, 'SEMARNAT factor must be 0.423 kg CO2e/kWh')
  assertEqual(calculateCo2AvoidedTonnes(1000), 0.423, '1,000 kWh should avoid 0.423 tonnes of CO2')
  assertEqual(calculateCo2AvoidedTonnes(0), 0, '0 kWh should avoid 0 tonnes')
  assertEqual(calculateCo2AvoidedTonnes(-100), 0, 'Negative kWh should return 0')
  assertEqual(calculateCo2AvoidedTonnes(NaN), 0, 'NaN should return 0')

  // 3. USD Multi-Currency Normalization
  const usdSavings = calculateProjectSavingsMxn({
    totalGeneratedKwh: 0,
    selectedConfig: { ahorro_estimado_anual: 36500, ahorro_moneda: 'USD' },
    exchangeRateUsdMxn: 18.0,
  })
  assertEqual(usdSavings, 1800.0, '36,500 USD annual savings pro-rates to 1,800 MXN daily at 18.0 exchange rate')

  const usdMonthly = calculateProjectSavingsMxn({
    totalGeneratedKwh: 0,
    selectedConfig: { ahorro_estimado_mensual: 3000, ahorro_moneda: 'USD' },
    exchangeRateUsdMxn: 20.0,
  })
  assertEqual(usdMonthly, 2000.0, '3,000 USD monthly savings pro-rates to 2,000 MXN daily at 20.0 exchange rate')

  // 4. Tariff Label Resolution Thresholds (DIST, DIT, 01, DAC)
  assertEqual(resolveCfeTariffLabel(1200, 9000), 'DIT', 'Demand >= 1000 kW and volume >= 8000 MWh resolves to DIT')
  assertEqual(resolveCfeTariffLabel(1500, 5000), 'DIST', 'Demand >= 1000 kW and volume >= 4000 MWh resolves to DIST')
  assertEqual(resolveCfeTariffLabel(1000, 2000, { tension: 'transmision' }), 'DIT', 'Demand >= 1000 kW with transmision tension resolves to DIT')
  assertEqual(resolveCfeTariffLabel(1000, 2000, { tension: 'subtransmision' }), 'DIST', 'Demand >= 1000 kW with subtransmision tension resolves to DIST')
  assertEqual(resolveCfeTariffLabel(1000, 2000, { tension: 'media' }), 'GDMTH', 'Demand >= 1000 kW with media tension resolves to GDMTH')
  assertEqual(resolveCfeTariffLabel(3, 2.5), '01', 'Demand <= 5 kW and volume <= 3 MWh resolves to residential 01')
  assertEqual(resolveCfeTariffLabel(5, 2.0, { tipoServicio: 'domestico' }), '01', 'Domestic service with volume <= 3 MWh resolves to 01')
  assertEqual(resolveCfeTariffLabel(8, 12, { tipoServicio: 'domestico' }), 'DAC', 'Domestic service with volume > 3 MWh resolves to DAC')
  assertEqual(resolveCfeTariffLabel(120, 100), 'GDMTH', 'Demand >= 100 kW resolves to GDMTH')
  assertEqual(resolveCfeTariffLabel(35, 100), 'GDMTO', 'Demand >= 25 kW and volume >= 100 MWh resolves to GDMTO')
  assertEqual(resolveCfeTariffLabel(35, 50), 'GDBT', 'Demand > 25 kW and volume < 100 MWh resolves to GDBT')
  assertEqual(resolveCfeTariffLabel(10, 50), 'PDBT', 'Demand <= 25 kW commercial resolves to PDBT')
  assertEqual(resolveCfeTariffLabel(null, null), 'GDMTH', 'Null inputs resolve to default GDMTH')
})
```

---

## 6. Outputs
- **Modified File**: `lib/tariffs/cfe-calculator.ts`
- **Modified File**: `lib/types.ts`
- **New Migration**: `supabase/migrations/20261112000003_tarifa_cfe_varchar.sql`
- **Updated Test**: `tests/tier2-boundary-corner-cases.test.mjs`

---

## 7. Acceptance Criteria & Exact Verification Commands

### Criteria
- [x] `CFE_TARIFF_RATES_MXN` exports rates for all 8 tariffs (`GDMTH`, `GDMTO`, `PDBT`, `GDBT`, `DIST`, `DIT`, `01`, `DAC`).
- [x] `calculateCo2AvoidedTonnes(1000)` returns `0.423`.
- [x] `calculateProjectSavingsMxn` normalizes USD configuration savings using exchange rate.
- [x] `resolveCfeTariffLabel` resolves `DIT`, `DIST`, `01`, `DAC` per regulatory thresholds.
- [x] `interface Proyecto` includes `tarifa_actual_cfe?: string | null`.
- [x] `npm test` passes all tests.

### Verification Command
```bash
npx tsx --env-file=.env.local --input-type=module -e "import { calculateCo2AvoidedTonnes, calculateProjectSavingsMxn, CFE_TARIFF_RATES_MXN, resolveCfeTariffLabel } from './lib/tariffs/cfe-calculator.ts'; (async () => { console.log('Tariff count:', Object.keys(CFE_TARIFF_RATES_MXN).length); console.log('CO2 for 1000 kWh:', typeof calculateCo2AvoidedTonnes === 'function' ? calculateCo2AvoidedTonnes(1000) : 'MISSING'); console.log('USD pro-rata daily MXN:', calculateProjectSavingsMxn({ totalGeneratedKwh: 0, selectedConfig: { ahorro_estimado_anual: 36500, ahorro_moneda: 'USD' }, exchangeRateUsdMxn: 18.0 })); console.log('DIT:', resolveCfeTariffLabel(1200, 9000)); console.log('DIST:', resolveCfeTariffLabel(1500, 5000)); console.log('01:', resolveCfeTariffLabel(3, 2.5)); console.log('DAC:', resolveCfeTariffLabel(8, 12, { tipoServicio: 'domestico' })); })();"
```
**Expected Output**:
`Tariff count: 8`, `CO2 for 1000 kWh: 0.423`, `USD pro-rata daily MXN: 1800`, `DIT: DIT`, `DIST: DIST`, `01: 01`, `DAC: DAC` (Exit code 0).
