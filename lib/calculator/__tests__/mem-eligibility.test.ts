import { describe, expect, it } from 'vitest'
import {
  evaluateManualMemEligibility,
  evaluateMemEligibility,
  MEM_DEMAND_THRESHOLD_KW,
  resolveProjectContractedDemandKw,
} from '@/lib/calculator/mem-eligibility'

describe('MEM Legal Eligibility Guardrail (LIE >= 1 MW / incluye_mem)', () => {
  it('resolves contracted demand from sites first, falling back to proyecto.demanda_kw', () => {
    expect(
      resolveProjectContractedDemandKw(
        { demanda_kw: 450 },
        [
          { demanda_contratada_kw: 600 },
          { demanda_contratada_kw: 550 },
        ],
      ),
    ).toBe(1150)

    expect(resolveProjectContractedDemandKw({ demanda_kw: 750 }, [])).toBe(750)
  })

  it('defaults to CFE Tarifario and emits non-blocking warning for sub-1MW projects without incluye_mem', () => {
    const res = evaluateMemEligibility({
      proyecto: { tipo: 'FV+BESS', incluye_mem: false, demanda_kw: 650 },
      sitios: [{ demanda_contratada_kw: 650 }],
    })

    expect(MEM_DEMAND_THRESHOLD_KW).toBe(1000)
    expect(res.isEligible).toBe(false)
    expect(res.defaultMode).toBe('cfe_tarifario')
    expect(res.warningTitle).toBeTruthy()
    expect(res.warningMessage).toContain('1 MW')
  })

  it('defaults to MEM Horario when aggregated site demand >= 1,000 kW', () => {
    const res = evaluateMemEligibility({
      proyecto: { tipo: 'FV+BESS', incluye_mem: false, demanda_kw: 400 },
      sitios: [
        { demanda_contratada_kw: 600 },
        { demanda_contratada_kw: 500 },
      ],
    })

    expect(res.isEligible).toBe(true)
    expect(res.meetsDemandThreshold).toBe(true)
    expect(res.defaultMode).toBe('mem_horaria')
    expect(res.warningMessage).toBeNull()
  })

  it('defaults to MEM Horario when incluye_mem is true or tipo is MEM / BESS+MEM', () => {
    const flagEligible = evaluateMemEligibility({
      proyecto: { tipo: 'BESS', incluye_mem: true, demanda_kw: 400 },
    })
    expect(flagEligible.isEligible).toBe(true)
    expect(flagEligible.hasMemFlag).toBe(true)
    expect(flagEligible.defaultMode).toBe('mem_horaria')

    const typeEligible = evaluateMemEligibility({
      proyecto: { tipo: 'BESS+MEM', incluye_mem: false, demanda_kw: 200 },
    })
    expect(typeEligible.isEligible).toBe(true)
    expect(typeEligible.isMemProjectType).toBe(true)
    expect(typeEligible.defaultMode).toBe('mem_horaria')
  })

  it('evaluates manual MEM simulation demand against the 1.00 MW threshold', () => {
    const sub1Mw = evaluateManualMemEligibility(0.45)
    expect(sub1Mw.isEligible).toBe(false)
    expect(sub1Mw.warningMessage).toContain('1.00 MW')

    const valid1Mw = evaluateManualMemEligibility(1.25)
    expect(valid1Mw.isEligible).toBe(true)
    expect(valid1Mw.warningMessage).toBeNull()
  })
})
