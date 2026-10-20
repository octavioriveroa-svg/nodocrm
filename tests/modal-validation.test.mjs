import {
  TestSuite,
  assertEqual,
} from './test-utils.mjs'

import {
  validarFvForm as domainValidarFvForm,
  validarBessForm as domainValidarBessForm,
} from '../lib/domains/proyectos/schemas.ts'

import {
  validarFvForm as wizardValidarFvForm,
  validarBessForm as wizardValidarBessForm,
} from '../components/proyectos/wizard/validation.ts'

export const modalValidationSuite = new TestSuite('Modals: FV + Hybrid BESS Validation & Required Fields')

const validBaseFv = {
  num_modulos: '1,000',
  potencia_modulos_w: '550',
  marca_modulos: 'Jinko Solar',
  generacion_anual_kwh: '850,000',
  capex: '12,000,000',
  capex_moneda: 'MXN',
}

const validBaseBess = {
  potencia_kw: '200',
  capacidad_kwh: '400',
  marca: 'CATL',
  uso: 'peak_shaving',
  capex: '4,500,000',
  capex_moneda: 'MXN',
  inversores_hibridos: true,
}

// ── 1. Hybrid BESS Inverter Omission Validation ──────────────────────────────
modalValidationSuite.test('Modal.1: validarFvForm allows omitting FV inverters when hybrid BESS is present on same site', () => {
  const sitioId = 'sitio-central-1'

  // FV form without inverters
  const fvWithoutInverters = {
    ...validBaseFv,
    num_inversores: '',
    potencia_inversores_kw: '',
    marca_inversores: '',
  }

  // 1.1 Wizard-style product map (p.bess.inversores_hibridos = true)
  const wizardProductsMap = {
    [sitioId]: [
      {
        id: 'prod-bess-1',
        tipo: 'bess',
        bess: {
          potencia_kw: '250',
          capacidad_kwh: '500',
          marca: 'Tesla',
          uso: 'arbitrage',
          capex: '6000000',
          capex_moneda: 'MXN',
          inversores_hibridos: true,
        },
      },
    ],
  }

  const resWizard = domainValidarFvForm(fvWithoutInverters, sitioId, wizardProductsMap)
  assertEqual(resWizard, '', 'Omitting FV inverters must be valid when hybrid BESS (p.bess) exists on same site')

  // 1.2 Detail/Modal-style product map (p.datos.inversores_hibridos = true)
  const modalProductsMap = {
    [sitioId]: [
      {
        id: 'prod-bess-2',
        tipo: 'bess',
        datos: {
          potencia_kw: 250,
          capacidad_kwh: 500,
          marca: 'Tesla',
          uso: 'arbitrage',
          capex: 6000000,
          capex_moneda: 'MXN',
          inversores_hibridos: true,
        },
      },
    ],
  }

  const resModal = domainValidarFvForm(fvWithoutInverters, sitioId, modalProductsMap)
  assertEqual(resModal, '', 'Omitting FV inverters must be valid when hybrid BESS (p.datos) exists on same site')

  // Also verify wizardValidarFvForm matches
  const resWizardOrig = wizardValidarFvForm(fvWithoutInverters, sitioId, wizardProductsMap)
  assertEqual(resWizardOrig, '', 'wizard validation must also allow omitting inverters')
})

// ── 2. Rejection When Hybrid BESS is NOT Present ─────────────────────────────
modalValidationSuite.test('Modal.2: validarFvForm rejects omitted inverters when NO hybrid BESS is on the same site', () => {
  const sitioId = 'sitio-central-1'
  const otherSitioId = 'sitio-remote-2'

  const fvWithoutInverters = {
    ...validBaseFv,
    num_inversores: '',
    potencia_inversores_kw: '',
    marca_inversores: '',
  }

  // 2.1 No products on site at all
  const emptyProductsMap = { [sitioId]: [] }
  const resEmpty = domainValidarFvForm(fvWithoutInverters, sitioId, emptyProductsMap)
  assertEqual(resEmpty, 'Ingresa número y potencia de inversores.')

  // 2.2 BESS present on site, but AC-coupled (inversores_hibridos = false)
  const acBessProductsMap = {
    [sitioId]: [
      {
        id: 'prod-bess-ac',
        tipo: 'bess',
        bess: {
          ...validBaseBess,
          inversores_hibridos: false,
        },
      },
    ],
  }
  const resAc = domainValidarFvForm(fvWithoutInverters, sitioId, acBessProductsMap)
  assertEqual(resAc, 'Ingresa número y potencia de inversores.')

  // 2.3 Hybrid BESS exists, but on a DIFFERENT site (must not leak cross-site)
  const crossSiteProductsMap = {
    [otherSitioId]: [
      {
        id: 'prod-bess-other',
        tipo: 'bess',
        bess: { ...validBaseBess, inversores_hibridos: true },
      },
    ],
    [sitioId]: [],
  }
  const resCrossSite = domainValidarFvForm(fvWithoutInverters, sitioId, crossSiteProductsMap)
  assertEqual(resCrossSite, 'Ingresa número y potencia de inversores.', 'Hybrid BESS on other site must not validate current site')

  // 2.4 Number/power provided, but missing inverter brand
  const fvMissingBrand = {
    ...validBaseFv,
    num_inversores: '8',
    potencia_inversores_kw: '50',
    marca_inversores: '   ',
  }
  const resMissingBrand = domainValidarFvForm(fvMissingBrand, sitioId, emptyProductsMap)
  assertEqual(resMissingBrand, 'Ingresa la marca de los inversores.')
})

// ── 3. General FV Required Fields ────────────────────────────────────────────
modalValidationSuite.test('Modal.3: validarFvForm validates required modules, generation, and capex', () => {
  const sitioId = 'sitio-1'
  const emptyMap = { [sitioId]: [] }

  // Missing num_modulos
  const fvNoModulos = { ...validBaseFv, num_modulos: '', num_inversores: '5', potencia_inversores_kw: '50', marca_inversores: 'Huawei' }
  assertEqual(domainValidarFvForm(fvNoModulos, sitioId, emptyMap), 'Ingresa número y potencia de módulos.')

  // Missing potencia_modulos_w
  const fvNoPotencia = { ...validBaseFv, potencia_modulos_w: '', num_inversores: '5', potencia_inversores_kw: '50', marca_inversores: 'Huawei' }
  assertEqual(domainValidarFvForm(fvNoPotencia, sitioId, emptyMap), 'Ingresa número y potencia de módulos.')

  // Missing marca_modulos
  const fvNoMarca = { ...validBaseFv, marca_modulos: '   ', num_inversores: '5', potencia_inversores_kw: '50', marca_inversores: 'Huawei' }
  assertEqual(domainValidarFvForm(fvNoMarca, sitioId, emptyMap), 'Ingresa la marca de los módulos.')

  // Missing generacion_anual_kwh
  const fvNoGen = { ...validBaseFv, generacion_anual_kwh: '', num_inversores: '5', potencia_inversores_kw: '50', marca_inversores: 'Huawei' }
  assertEqual(domainValidarFvForm(fvNoGen, sitioId, emptyMap), 'Ingresa la generación anual estimada.')

  // Missing capex
  const fvNoCapex = { ...validBaseFv, capex: '', num_inversores: '5', potencia_inversores_kw: '50', marca_inversores: 'Huawei' }
  assertEqual(domainValidarFvForm(fvNoCapex, sitioId, emptyMap), 'Ingresa el CAPEX del sistema FV.')

  // Fully valid standalone FV
  const fvFull = { ...validBaseFv, num_inversores: '5', potencia_inversores_kw: '50', marca_inversores: 'Huawei' }
  assertEqual(domainValidarFvForm(fvFull, sitioId, emptyMap), '')
})

// ── 4. BESS Required Fields Validation ───────────────────────────────────────
modalValidationSuite.test('Modal.4: validarBessForm enforces required fields for battery storage', () => {
  // Missing potencia_kw
  const bessNoPotencia = { ...validBaseBess, potencia_kw: '' }
  assertEqual(domainValidarBessForm(bessNoPotencia), 'Ingresa la potencia del BESS.')

  // Missing capacidad_kwh
  const bessNoCapacidad = { ...validBaseBess, capacidad_kwh: '' }
  assertEqual(domainValidarBessForm(bessNoCapacidad), 'Ingresa la capacidad del BESS.')

  // Missing marca
  const bessNoMarca = { ...validBaseBess, marca: '   ' }
  assertEqual(domainValidarBessForm(bessNoMarca), 'Ingresa la marca del BESS.')

  // Missing uso
  const bessNoUso = { ...validBaseBess, uso: '' }
  assertEqual(domainValidarBessForm(bessNoUso), 'Selecciona el uso del BESS.')

  // Missing capex
  const bessNoCapex = { ...validBaseBess, capex: '' }
  assertEqual(domainValidarBessForm(bessNoCapex), 'Ingresa el CAPEX del BESS.')

  // Fully valid BESS
  assertEqual(domainValidarBessForm(validBaseBess), '')
  assertEqual(wizardValidarBessForm(validBaseBess), '')
})

if (process.argv[1] && process.argv[1].endsWith('modal-validation.test.mjs')) {
  modalValidationSuite.run().catch((err) => {
    console.error('Test suite failed:', err)
    process.exit(1)
  })
}
