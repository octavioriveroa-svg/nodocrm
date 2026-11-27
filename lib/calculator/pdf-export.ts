import type {
  CalculadoraTemplate,
  ConfiguracionTecnica,
  MemFinancialEvaluation,
  MemSimulatorInputs,
  MemYear1Results,
  Moneda,
  OfertaMem,
  OpcionFinanciamiento,
  Proyecto,
  ProyectoSitioProducto,
  SimulacionAhorro,
  SimulationEvaluationResult,
  Sitio,
  VistaFinanciamiento,
} from '@/lib/types'
import { aggregateSeries } from '@/lib/calculator/aggregate'
import { runSimulation } from '@/lib/calculator/engine'
import { fmtCurrency, fmtNum, fmtPct, fmtUnit } from '@/lib/format'

const BRAND_PETROL: [number, number, number] = [7, 43, 49]
const BRAND_LIME: [number, number, number] = [206, 220, 0]
const BRAND_MENTA: [number, number, number] = [0, 193, 159]
const BRAND_BG: [number, number, number] = [244, 247, 246]
const BRAND_BORDER: [number, number, number] = [227, 232, 230]
const BRAND_MUTED: [number, number, number] = [95, 122, 119]
const BRAND_AMBER_BG: [number, number, number] = [254, 243, 199]
const BRAND_AMBER_TEXT: [number, number, number] = [146, 64, 14]
const WHITE: [number, number, number] = [255, 255, 255]

export interface PdfKpiCard {
  label: string
  value: string
  sublabel?: string
  accent?: boolean
}

export interface PdfAssumptionRow {
  label: string
  value: string
}

export interface PdfReportModel {
  filename: string
  title: string
  subtitle: string
  modeLabel: string
  originLabel: string
  moneda: Moneda
  vistaFinanciamiento: VistaFinanciamiento
  horizonteAnios: number
  generatedAtLabel: string
  regulatoryWarning: string | null
  kpis: PdfKpiCard[]
  assumptions: PdfAssumptionRow[]
  tableHeaders: string[]
  tableRows: string[][]
}

export type PdfReportInput =
  | {
      kind: 'mem_horaria'
      title: string
      subtitle?: string
      originLabel: string
      moneda: Moneda
      vistaFinanciamiento: VistaFinanciamiento
      inputs: MemSimulatorInputs
      year1: MemYear1Results
      financial: MemFinancialEvaluation
      datasetLabel?: string
      regulatoryWarning?: string | null
      generatedAt?: Date
    }
  | {
      kind: 'cfe_tarifario'
      title: string
      subtitle?: string
      originLabel: string
      moneda: Moneda
      vistaFinanciamiento: VistaFinanciamiento
      horizonteAnios: number
      proyecto: Pick<
        Proyecto,
        | 'nombre_proyecto'
        | 'cliente_final_empresa'
        | 'tipo'
        | 'demanda_kw'
        | 'capacidad_mw'
        | 'capacidad_mwh'
        | 'tarifa_actual_cfe'
        | 'volumen_energia_mwh_anual'
      >
      outcome: SimulationEvaluationResult
      financingLabel?: string | null
      fxUsed: number
      templateVersion: number
      regulatoryWarning?: string | null
      generatedAt?: Date
    }
  | {
      kind: 'saved_snapshot'
      simulacion: SimulacionAhorro
      proyecto: Proyecto
      sitios?: Sitio[]
      productos?: ProyectoSitioProducto[]
      configuraciones?: ConfiguracionTecnica[]
      opcionesFinanciamiento?: OpcionFinanciamiento[]
      ofertasMem?: OfertaMem[]
      template?: CalculadoraTemplate
      regulatoryWarning?: string | null
      generatedAt?: Date
    }

function safeCurrency(val: number | null | undefined, moneda: Moneda): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—'
  return fmtCurrency(val, moneda)
}

function safeNum(val: number | null | undefined, decimals = 2): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—'
  return fmtNum(val, decimals)
}

function safePct(val: number | null | undefined, decimals = 2): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—'
  return fmtPct(val, decimals)
}

function formatDateEsMx(date: Date): string {
  try {
    return date.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

export function buildPdfFilename(title: string, date: Date = new Date()): string {
  const normalized = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)
  const slug = normalized || 'reporte'
  const isoDay = date.toISOString().slice(0, 10)
  return `Nodo_Simulacion_${slug}_${isoDay}.pdf`
}

function formatPaybackLabel(
  estado: string,
  anios: number | null | undefined,
  meses?: number | null | undefined,
): { value: string; sublabel: string } {
  if (estado === 'inmediato') {
    return { value: 'Inmediato', sublabel: 'Sin desembolso inicial' }
  }
  if ((estado === 'ok' || estado === 'en_horizonte') && anios != null && Number.isFinite(anios)) {
    const m = meses != null && Number.isFinite(meses) ? meses : anios * 12
    return {
      value: `${fmtNum(anios, 2)} años`,
      sublabel: `${fmtNum(m, 1)} meses`,
    }
  }
  if (estado === 'fuera_horizonte') {
    return { value: 'Fuera de horizonte', sublabel: 'Supera el horizonte configurado' }
  }
  return { value: 'No recuperable', sublabel: 'Flujos insuficientes' }
}

function buildMemReportModel(
  input: Extract<PdfReportInput, { kind: 'mem_horaria' }>,
  generatedAt: Date,
): PdfReportModel {
  const { inputs, year1, financial, moneda, vistaFinanciamiento } = input
  const payback = formatPaybackLabel(
    financial.payback_simple_estado,
    financial.payback_simple_anios,
  )
  const totalY1 = Math.abs(financial.ahorro_total_y1)
  const pctEnergia = totalY1 > 0 ? (financial.ahorro_energia_y1 / totalY1) * 100 : 0
  const pctPotencia = totalY1 > 0 ? (financial.ahorro_potencia_y1 / totalY1) * 100 : 0
  const includeDebt = vistaFinanciamiento === 'neto'

  const tableHeaders = includeDebt
    ? [
        'Año',
        `Ahorro Energía (${moneda})`,
        `Ahorro Potencia (${moneda})`,
        `O&M (${moneda})`,
        `Deuda / Cuota (${moneda})`,
        `Flujo Neto (${moneda})`,
        `Acumulado (${moneda})`,
      ]
    : [
        'Año',
        `Ahorro Energía (${moneda})`,
        `Ahorro Potencia (${moneda})`,
        `O&M (${moneda})`,
        `Flujo Neto (${moneda})`,
        `Acumulado (${moneda})`,
      ]

  const activeRows = financial.rows.filter(
    (r) => r.anio === 0 || (r.anio >= 1 && r.anio <= inputs.fin_horizonte_anios && r.activo === 1),
  )

  const tableRows = activeRows.map((row) =>
    includeDebt
      ? [
          row.anio === 0 ? 'Año 0' : `Año ${row.anio}`,
          safeCurrency(row.ahorro_energia, moneda),
          safeCurrency(row.ahorro_potencia, moneda),
          safeCurrency(row.opex, moneda),
          safeCurrency(row.cuota_financiamiento, moneda),
          safeCurrency(row.flujo_neto, moneda),
          safeCurrency(row.flujo_acumulado, moneda),
        ]
      : [
          row.anio === 0 ? 'Año 0' : `Año ${row.anio}`,
          safeCurrency(row.ahorro_energia, moneda),
          safeCurrency(row.ahorro_potencia, moneda),
          safeCurrency(row.opex, moneda),
          safeCurrency(row.flujo_neto, moneda),
          safeCurrency(row.flujo_acumulado, moneda),
        ],
  )

  return {
    filename: buildPdfFilename(input.title, generatedAt),
    title: input.title,
    subtitle:
      input.subtitle ||
      `${inputs.cliente || 'Cliente'} · FV ${safeNum(inputs.fv_potencia_mw, 2)} MWp + BESS ${safeNum(inputs.bess_potencia_mw, 2)} MW / ${safeNum(inputs.bess_capacidad_mwh, 2)} MWh`,
    modeLabel: 'MEM Horario (8,760h PML + 100HC)',
    originLabel: input.originLabel,
    moneda,
    vistaFinanciamiento,
    horizonteAnios: inputs.fin_horizonte_anios,
    generatedAtLabel: formatDateEsMx(generatedAt),
    regulatoryWarning: input.regulatoryWarning ?? null,
    kpis: [
      {
        label: 'Ahorro Año 1',
        value: safeCurrency(financial.ahorro_total_y1, moneda),
        sublabel: `Energía ${safePct(pctEnergia, 0)} · Potencia ${safePct(pctPotencia, 0)}`,
        accent: true,
      },
      {
        label: `Ahorro Total (${inputs.fin_horizonte_anios}a)`,
        value: safeCurrency(financial.ahorro_total_horizonte, moneda),
        sublabel: `Flujo neto: ${safeCurrency(financial.flujo_neto_total, moneda)}`,
      },
      {
        label: includeDebt ? 'Desembolso Inicial' : 'CAPEX Total',
        value: safeCurrency(includeDebt ? financial.desembolso_inicial : financial.capex_total, moneda),
        sublabel: `CAPEX total: ${safeCurrency(financial.capex_total, moneda)}`,
      },
      {
        label: 'Payback Simple',
        value: payback.value,
        sublabel:
          financial.payback_descontado_anios != null && Number.isFinite(financial.payback_descontado_anios)
            ? `${payback.sublabel} · Desc: ${safeNum(financial.payback_descontado_anios, 2)} años`
            : payback.sublabel,
      },
      {
        label: 'VAN (WACC)',
        value: safeCurrency(financial.vpn, moneda),
        sublabel: `WACC: ${safePct(inputs.fin_tasa_descuento_pct * 100, 1)}`,
      },
      {
        label: 'TIR / ROI',
        value: safePct(financial.tir_pct, 2),
        sublabel: `ROI s/CAPEX: ${safePct(financial.roi_pct, 1)}`,
      },
    ],
    assumptions: [
      { label: 'Cliente', value: inputs.cliente || '—' },
      { label: 'Demanda contratada', value: `${safeNum(inputs.demanda_contratada_mw, 2)} MW` },
      { label: 'Sistema FV', value: `${safeNum(inputs.fv_potencia_mw, 2)} MWp (Gen Y1: ${safeNum(year1.res_gen_fv_mwh, 1)} MWh)` },
      {
        label: 'Sistema BESS',
        value: `${safeNum(inputs.bess_potencia_mw, 2)} MW / ${safeNum(inputs.bess_capacidad_mwh, 2)} MWh (${safeNum(year1.bess_duracion_h, 2)} h)`,
      },
      {
        label: 'Reducción 100HC / Ciclos',
        value: `${safeNum(year1.res_rap_reduccion_mw, 2)} MW RAP · ${safeNum(year1.res_ciclos, 0)} ciclos/año`,
      },
      {
        label: 'Tipo de cambio / MBP',
        value: `${safeNum(inputs.tc_mxn_usd, 2)} MXN/USD · MBP ${safeCurrency(inputs.mbp_precio_mxn_mw_anio, 'MXN')}/MW-año`,
      },
      {
        label: 'Base horaria',
        value: input.datasetLabel || '2025 CENACE MEM Baseline',
      },
      {
        label: 'Horizonte / Vista',
        value: `${inputs.fin_horizonte_anios} años · ${includeDebt ? 'Neto Financiado' : 'Bruto / Contado'}`,
      },
    ],
    tableHeaders,
    tableRows,
  }
}

function buildCfeReportModel(
  input: Extract<PdfReportInput, { kind: 'cfe_tarifario' }>,
  generatedAt: Date,
): PdfReportModel {
  const { proyecto, outcome, moneda, vistaFinanciamiento, horizonteAnios } = input
  const annualRows = aggregateSeries(outcome.serie_mensual, 'anual')
  const payback = formatPaybackLabel(
    outcome.payback_estado,
    outcome.payback_simple_anios,
    outcome.payback_simple_meses,
  )
  const includeDebt = vistaFinanciamiento === 'neto'

  const tableHeaders = includeDebt
    ? [
        'Año',
        'Energía (kWh)',
        `Ahorro Bruto (${moneda})`,
        `O&M (${moneda})`,
        `Cuota (${moneda})`,
        `Flujo Neto (${moneda})`,
        `Acumulado (${moneda})`,
      ]
    : [
        'Año',
        'Energía (kWh)',
        `Ahorro Bruto (${moneda})`,
        `O&M (${moneda})`,
        `Flujo Neto (${moneda})`,
        `Acumulado (${moneda})`,
      ]

  const tableRows = annualRows.map((r) =>
    includeDebt
      ? [
          r.etiqueta,
          safeNum(r.energia_total_kwh, 0),
          safeCurrency(r.ahorro_bruto, moneda),
          safeCurrency(r.costo_om, moneda),
          safeCurrency(r.cuota_financiamiento, moneda),
          safeCurrency(r.flujo_neto, moneda),
          safeCurrency(r.flujo_acumulado, moneda),
        ]
      : [
          r.etiqueta,
          safeNum(r.energia_total_kwh, 0),
          safeCurrency(r.ahorro_bruto, moneda),
          safeCurrency(r.costo_om, moneda),
          safeCurrency(r.flujo_neto, moneda),
          safeCurrency(r.flujo_acumulado, moneda),
        ],
  )

  return {
    filename: buildPdfFilename(input.title, generatedAt),
    title: input.title,
    subtitle:
      input.subtitle ||
      `${proyecto.cliente_final_empresa || proyecto.nombre_proyecto} · Tecnología ${proyecto.tipo}`,
    modeLabel: 'CFE Tarifario',
    originLabel: input.originLabel,
    moneda,
    vistaFinanciamiento,
    horizonteAnios,
    generatedAtLabel: formatDateEsMx(generatedAt),
    regulatoryWarning: input.regulatoryWarning ?? null,
    kpis: [
      {
        label: 'Ahorro Monetario Año 1',
        value: safeCurrency(outcome.ahorro_monetario_y1, moneda),
        sublabel: `Energía Y1: ${fmtUnit(outcome.ahorro_energia_y1_kwh, 'kWh', 0)}`,
        accent: true,
      },
      {
        label: `Ahorro Total (${horizonteAnios}a)`,
        value: safeCurrency(outcome.ahorro_monetario_total, moneda),
        sublabel: `Flujo neto: ${safeCurrency(outcome.flujo_neto_total, moneda)}`,
      },
      {
        label: includeDebt ? 'Desembolso Inicial' : 'CAPEX Total',
        value: safeCurrency(includeDebt ? outcome.desembolso_inicial : outcome.capex_total, moneda),
        sublabel: `CAPEX total: ${safeCurrency(outcome.capex_total, moneda)}`,
      },
      {
        label: 'Payback Simple',
        value: payback.value,
        sublabel:
          outcome.payback_descontado_meses != null && Number.isFinite(outcome.payback_descontado_meses)
            ? `${payback.sublabel} · Desc: ${safeNum(outcome.payback_descontado_meses / 12, 2)} años`
            : payback.sublabel,
      },
      {
        label: 'VAN (WACC)',
        value: safeCurrency(outcome.van, moneda),
        sublabel: `Fuente: ${outcome.fuente_calculo === 'ahorro_declarado' ? 'Ahorro declarado' : 'Físico-tarifario'}`,
      },
      {
        label: 'TIR / ROI',
        value: safePct(outcome.tir_pct, 2),
        sublabel: `ROI s/CAPEX: ${safePct(outcome.roi_pct, 1)}`,
      },
    ],
    assumptions: [
      { label: 'Proyecto / Cliente', value: proyecto.cliente_final_empresa || proyecto.nombre_proyecto },
      { label: 'Tecnología', value: proyecto.tipo },
      { label: 'Tarifa CFE', value: String(proyecto.tarifa_actual_cfe || 'Por defecto plantilla') },
      {
        label: 'Demanda contratada',
        value: proyecto.demanda_kw != null ? `${safeNum(proyecto.demanda_kw, 0)} kW` : '—',
      },
      {
        label: 'Capacidad FV / BESS',
        value: `${safeNum(proyecto.capacidad_mw, 2)} MW / ${safeNum(proyecto.capacidad_mwh, 2)} MWh`,
      },
      {
        label: 'Financiamiento',
        value: input.financingLabel || (includeDebt ? 'Financiado' : 'Contado'),
      },
      {
        label: 'Tipo de cambio / Plantilla',
        value: `${safeNum(input.fxUsed, 2)} MXN/USD · Plantilla v${input.templateVersion}`,
      },
      {
        label: 'Horizonte / Vista',
        value: `${horizonteAnios} años · ${includeDebt ? 'Neto Financiado' : 'Bruto / Contado'}`,
      },
    ],
    tableHeaders,
    tableRows,
  }
}

export function buildPdfReportModel(input: PdfReportInput): PdfReportModel {
  const generatedAt = input.generatedAt ?? new Date()

  if (input.kind === 'mem_horaria') {
    return buildMemReportModel(input, generatedAt)
  }
  if (input.kind === 'cfe_tarifario') {
    return buildCfeReportModel(input, generatedAt)
  }

  const { simulacion, proyecto, template } = input
  const isMem = simulacion.parametros_override?.modo_motor === 'mem_horaria'

  if (template) {
    const activeConfig =
      (simulacion.configuracion_id
        ? input.configuraciones?.find((c) => c.id === simulacion.configuracion_id)
        : undefined) ??
      input.configuraciones?.find((c) => c.seleccionada) ??
      input.configuraciones?.[0] ??
      null

    const configProducts = activeConfig
      ? (input.productos ?? []).filter(
          (p) => p.configuracion_id === activeConfig.id || p.configuracion_id === null,
        )
      : input.productos ?? []

    const activeFinancing =
      (simulacion.opcion_financiamiento_id
        ? input.opcionesFinanciamiento?.find((o) => o.id === simulacion.opcion_financiamiento_id)
        : undefined) ??
      input.opcionesFinanciamiento?.find((o) => o.seleccionada) ??
      input.opcionesFinanciamiento?.[0] ??
      null

    const reevaluated = runSimulation({
      mode: isMem ? 'mem_horaria' : 'cfe_tarifario',
      proyecto,
      activeConfig,
      configProducts,
      activeFinancing,
      sitios: input.sitios ?? [],
      ofertasMem: input.ofertasMem ?? [],
      template,
      monedaCalculo: simulacion.moneda_calculo,
      horizonteAnios: simulacion.horizonte_anios,
      vistaFinanciamiento: simulacion.vista_financiamiento,
      overrides: (simulacion.parametros_override ?? {}) as Record<string, unknown>,
      ignoreProjectGating: isMem,
    })

    if (reevaluated.status === 'ok') {
      if ('financial' in reevaluated) {
        return buildMemReportModel(
          {
            kind: 'mem_horaria',
            title: `${proyecto.nombre_proyecto} — ${simulacion.nombre}`,
            subtitle: `${proyecto.cliente_final_empresa} · Escenario guardado`,
            originLabel: `Proyecto vinculado: ${proyecto.nombre_proyecto}`,
            moneda: simulacion.moneda_calculo,
            vistaFinanciamiento: simulacion.vista_financiamiento,
            inputs: reevaluated.inputs,
            year1: reevaluated.year1,
            financial: reevaluated.financial,
            regulatoryWarning: input.regulatoryWarning,
            generatedAt,
          },
          generatedAt,
        )
      }
      return buildCfeReportModel(
        {
          kind: 'cfe_tarifario',
          title: `${proyecto.nombre_proyecto} — ${simulacion.nombre}`,
          subtitle: `${proyecto.cliente_final_empresa} · Escenario guardado`,
          originLabel: `Proyecto vinculado: ${proyecto.nombre_proyecto}`,
          moneda: simulacion.moneda_calculo,
          vistaFinanciamiento: simulacion.vista_financiamiento,
          horizonteAnios: simulacion.horizonte_anios,
          proyecto,
          outcome: reevaluated,
          financingLabel: activeFinancing ? `${activeFinancing.nombre} (${activeFinancing.vehiculo_inversion})` : null,
          fxUsed: simulacion.tipo_cambio_usado,
          templateVersion: simulacion.template_version,
          regulatoryWarning: input.regulatoryWarning,
          generatedAt,
        },
        generatedAt,
      )
    }
  }

  // Fallback purely from persisted SimulacionAhorro KPI snapshot
  const payback = formatPaybackLabel(
    simulacion.payback_estado,
    simulacion.payback_simple_anios,
    simulacion.payback_simple_meses,
  )

  return {
    filename: buildPdfFilename(`${proyecto.nombre_proyecto}_${simulacion.nombre}`, generatedAt),
    title: `${proyecto.nombre_proyecto} — ${simulacion.nombre}`,
    subtitle: `${proyecto.cliente_final_empresa || proyecto.nombre_proyecto} · ${simulacion.descripcion || 'Resumen guardado'}`,
    modeLabel: isMem ? 'MEM Horario (8,760h + 100HC)' : 'CFE Tarifario',
    originLabel: `Proyecto vinculado: ${proyecto.nombre_proyecto}`,
    moneda: simulacion.moneda_calculo,
    vistaFinanciamiento: simulacion.vista_financiamiento,
    horizonteAnios: simulacion.horizonte_anios,
    generatedAtLabel: formatDateEsMx(generatedAt),
    regulatoryWarning: input.regulatoryWarning ?? null,
    kpis: [
      {
        label: 'Ahorro Monetario Año 1',
        value: safeCurrency(simulacion.ahorro_monetario_y1, simulacion.moneda_calculo),
        sublabel: `Energía Y1: ${fmtUnit(simulacion.ahorro_energia_y1_kwh, 'kWh', 0)}`,
        accent: true,
      },
      {
        label: `Ahorro Total (${simulacion.horizonte_anios}a)`,
        value: safeCurrency(simulacion.ahorro_monetario_total, simulacion.moneda_calculo),
        sublabel: `Flujo neto: ${safeCurrency(simulacion.flujo_neto_total, simulacion.moneda_calculo)}`,
      },
      {
        label: simulacion.vista_financiamiento === 'neto' ? 'Desembolso Inicial' : 'CAPEX Snapshot',
        value: safeCurrency(
          simulacion.vista_financiamiento === 'neto'
            ? simulacion.desembolso_inicial
            : simulacion.capex_snapshot,
          simulacion.moneda_calculo,
        ),
        sublabel: `CAPEX: ${safeCurrency(simulacion.capex_snapshot, simulacion.moneda_calculo)}`,
      },
      {
        label: 'Payback Simple',
        value: payback.value,
        sublabel: payback.sublabel,
      },
      {
        label: 'VAN',
        value: safeCurrency(simulacion.van, simulacion.moneda_calculo),
        sublabel: `Plantilla v${simulacion.template_version}`,
      },
      {
        label: 'TIR / ROI',
        value: safePct(simulacion.tir_pct, 2),
        sublabel: `ROI s/CAPEX: ${safePct(simulacion.roi_pct, 1)}`,
      },
    ],
    assumptions: [
      { label: 'Proyecto', value: proyecto.nombre_proyecto },
      { label: 'Cliente', value: proyecto.cliente_final_empresa || '—' },
      { label: 'Tecnología', value: proyecto.tipo },
      { label: 'Moneda / TC', value: `${simulacion.moneda_calculo} (${safeNum(simulacion.tipo_cambio_usado, 2)})` },
      { label: 'Horizonte', value: `${simulacion.horizonte_anios} años` },
      {
        label: 'Vista financiera',
        value: simulacion.vista_financiamiento === 'neto' ? 'Neto Financiado' : 'Bruto / Contado',
      },
    ],
    tableHeaders: ['Indicador', 'Valor'],
    tableRows: [
      ['CAPEX', safeCurrency(simulacion.capex_snapshot, simulacion.moneda_calculo)],
      ['Ahorro Año 1', safeCurrency(simulacion.ahorro_monetario_y1, simulacion.moneda_calculo)],
      ['Ahorro Total Horizonte', safeCurrency(simulacion.ahorro_monetario_total, simulacion.moneda_calculo)],
      ['Flujo Neto Total', safeCurrency(simulacion.flujo_neto_total, simulacion.moneda_calculo)],
      ['VAN', safeCurrency(simulacion.van, simulacion.moneda_calculo)],
      ['TIR / ROI', `${safePct(simulacion.tir_pct, 2)} / ${safePct(simulacion.roi_pct, 1)}`],
    ],
  }
}

/**
 * Generates and downloads a branded Nodo Energy PDF report for either a live (manual/linked)
 * or saved simulation. Dynamically imports jsPDF + jspdf-autotable only when invoked.
 */
export async function exportSimulationToPdf(input: PdfReportInput): Promise<string> {
  const model = buildPdfReportModel(input)
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const autoTable = autoTableMod.default ?? autoTableMod.autoTable

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = 14
  const contentWidth = pageWidth - marginX * 2

  // Branded petrol header banner
  doc.setFillColor(...BRAND_PETROL)
  doc.rect(0, 0, pageWidth, 34, 'F')
  doc.setFillColor(...BRAND_LIME)
  doc.rect(0, 34, pageWidth, 2, 'F')

  doc.setTextColor(...BRAND_LIME)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('nodo.', marginX, 13)

  doc.setTextColor(...WHITE)
  doc.setFontSize(13)
  doc.text(model.title, marginX, 22, { maxWidth: contentWidth - 45 })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(220, 232, 230)
  doc.text(model.subtitle, marginX, 29, { maxWidth: contentWidth - 45 })

  doc.setFontSize(8)
  doc.text(model.modeLabel, pageWidth - marginX, 13, { align: 'right' })
  doc.text(`${model.originLabel}`, pageWidth - marginX, 19, { align: 'right' })
  doc.text(`Generado: ${model.generatedAtLabel}`, pageWidth - marginX, 25, { align: 'right' })

  let cursorY = 42

  if (model.regulatoryWarning) {
    const lines = doc.splitTextToSize(model.regulatoryWarning, contentWidth - 8)
    const bannerH = Math.max(12, lines.length * 4 + 6)
    doc.setFillColor(...BRAND_AMBER_BG)
    doc.roundedRect(marginX, cursorY, contentWidth, bannerH, 2, 2, 'F')
    doc.setTextColor(...BRAND_AMBER_TEXT)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(lines, marginX + 4, cursorY + 5.5)
    cursorY += bannerH + 5
  }

  // Executive KPI 3x2 grid
  const cols = 3
  const gapX = 4
  const gapY = 4
  const cardW = (contentWidth - gapX * (cols - 1)) / cols
  const cardH = 20

  model.kpis.forEach((kpi, idx) => {
    const col = idx % cols
    const row = Math.floor(idx / cols)
    const x = marginX + col * (cardW + gapX)
    const y = cursorY + row * (cardH + gapY)

    if (kpi.accent) {
      doc.setFillColor(...BRAND_PETROL)
      doc.roundedRect(x, y, cardW, cardH, 2.5, 2.5, 'F')
      doc.setTextColor(210, 224, 220)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.text(kpi.label.toUpperCase(), x + 3.5, y + 5.5, { maxWidth: cardW - 7 })

      doc.setTextColor(...BRAND_LIME)
      doc.setFontSize(12)
      doc.text(kpi.value, x + 3.5, y + 12.2, { maxWidth: cardW - 7 })

      if (kpi.sublabel) {
        doc.setTextColor(220, 232, 230)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6.8)
        doc.text(kpi.sublabel, x + 3.5, y + 17, { maxWidth: cardW - 7 })
      }
    } else {
      doc.setFillColor(...BRAND_BG)
      doc.setDrawColor(...BRAND_BORDER)
      doc.roundedRect(x, y, cardW, cardH, 2.5, 2.5, 'FD')
      doc.setTextColor(...BRAND_MUTED)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.text(kpi.label.toUpperCase(), x + 3.5, y + 5.5, { maxWidth: cardW - 7 })

      doc.setTextColor(...BRAND_PETROL)
      doc.setFontSize(11)
      doc.text(kpi.value, x + 3.5, y + 12.2, { maxWidth: cardW - 7 })

      if (kpi.sublabel) {
        doc.setTextColor(...BRAND_MUTED)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6.8)
        doc.text(kpi.sublabel, x + 3.5, y + 17, { maxWidth: cardW - 7 })
      }
    }
  })

  cursorY += Math.ceil(model.kpis.length / cols) * (cardH + gapY) + 4

  // Assumptions summary section (2-column paired table)
  doc.setTextColor(...BRAND_PETROL)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Parámetros y Supuestos Clave', marginX, cursorY)
  cursorY += 3

  const pairedAssumptions: string[][] = []
  for (let i = 0; i < model.assumptions.length; i += 2) {
    const left = model.assumptions[i]
    const right = model.assumptions[i + 1]
    pairedAssumptions.push([
      left.label,
      left.value,
      right ? right.label : '',
      right ? right.value : '',
    ])
  }

  autoTable(doc, {
    startY: cursorY,
    margin: { left: marginX, right: marginX },
    head: [['Parámetro', 'Valor', 'Parámetro', 'Valor']],
    body: pairedAssumptions,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: BRAND_PETROL,
      lineColor: BRAND_BORDER,
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: BRAND_PETROL,
      textColor: WHITE,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: BRAND_MUTED, cellWidth: 34 },
      1: { cellWidth: contentWidth / 2 - 34 },
      2: { fontStyle: 'bold', textColor: BRAND_MUTED, cellWidth: 34 },
      3: { cellWidth: contentWidth / 2 - 34 },
    },
  })

  const afterAssumptionsY =
    ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? cursorY + 30) + 7

  // Annual cashflow / projection table
  doc.setTextColor(...BRAND_PETROL)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Proyección Financiera y Energética', marginX, afterAssumptionsY)

  autoTable(doc, {
    startY: afterAssumptionsY + 3,
    margin: { left: marginX, right: marginX, bottom: 16 },
    head: [model.tableHeaders],
    body: model.tableRows,
    theme: 'striped',
    styles: {
      fontSize: 7.3,
      cellPadding: 2,
      textColor: BRAND_PETROL,
      lineColor: BRAND_BORDER,
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: BRAND_PETROL,
      textColor: WHITE,
      fontStyle: 'bold',
      halign: 'right',
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'head' && hookData.column.index === 0) {
        hookData.cell.styles.halign = 'left'
      }
      if (hookData.section === 'body') {
        hookData.cell.styles.halign = hookData.column.index === 0 ? 'left' : 'right'
        if (hookData.column.index === model.tableHeaders.length - 1) {
          hookData.cell.styles.fontStyle = 'bold'
        }
      }
    },
    alternateRowStyles: {
      fillColor: BRAND_BG,
    },
    didDrawPage: () => {
      doc.setDrawColor(...BRAND_MENTA)
      doc.setLineWidth(0.4)
      doc.line(marginX, pageHeight - 11, pageWidth - marginX, pageHeight - 11)
    },
  })

  // Page numbering footer pass
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...BRAND_MUTED)
    doc.text(
      `Nodo Energy · Reporte de Simulación (${model.modeLabel})`,
      marginX,
      pageHeight - 6.5,
    )
    doc.text(`Página ${p} de ${totalPages}`, pageWidth - marginX, pageHeight - 6.5, {
      align: 'right',
    })
  }

  doc.save(model.filename)
  return model.filename
}
