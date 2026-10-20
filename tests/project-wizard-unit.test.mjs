import {
  TestSuite,
  assertEqual,
  assertIncludes,
} from './test-utils.mjs'

import { getWizardCapabilities } from '../components/proyectos/wizard/capabilities.ts'
import {
  validarPaso0,
  validarPaso1,
  validarPaso2,
  validarPaso3,
  validarFvForm,
  validarBessForm,
} from '../components/proyectos/wizard/validation.ts'
import { calcFV, calcBESS, n2 } from '../components/proyectos/wizard/calculations.ts'

export const wizardSuite = new TestSuite('ProjectWizard Modular & Unified Comprehensive Tests')

wizardSuite.test('Capabilities: Admin & Analista have matching administration permissions', () => {
  for (const portal of ['admin', 'analista']) {
    const caps = getWizardCapabilities(portal)
    assertEqual(caps.portalType, portal)
    assertEqual(caps.canAssignEpc, true)
    assertEqual(caps.canAssignResponsableNodo, true)
    assertEqual(caps.canAssignFinder, true)
    assertEqual(caps.canUseManualClient, true)
    assertEqual(caps.canInviteEpc, false)
    assertEqual(caps.implicitEpc, false)
    assertEqual(caps.implicitFinder, false)
    assertEqual(caps.clientQueryFilter, 'by_selected_epc')
    assertEqual(caps.redirectPrefix, `/${portal}/proyectos`)
  }
})

wizardSuite.test('Capabilities: EPC has implicit creator and optional Finder assignment', () => {
  const caps = getWizardCapabilities('epc')
  assertEqual(caps.portalType, 'epc')
  assertEqual(caps.canAssignEpc, false)
  assertEqual(caps.canAssignResponsableNodo, false)
  assertEqual(caps.canAssignFinder, true)
  assertEqual(caps.canUseManualClient, false)
  assertEqual(caps.canInviteEpc, false)
  assertEqual(caps.implicitEpc, true)
  assertEqual(caps.implicitFinder, false)
  assertEqual(caps.clientQueryFilter, 'by_session_epc')
  assertEqual(caps.redirectPrefix, '/epc/proyectos')
})

wizardSuite.test('Capabilities: Finder has implicit creator, EPC selector, and EPC invitation modal', () => {
  const caps = getWizardCapabilities('finder')
  assertEqual(caps.portalType, 'finder')
  assertEqual(caps.canAssignEpc, true)
  assertEqual(caps.canAssignResponsableNodo, false)
  assertEqual(caps.canAssignFinder, false)
  assertEqual(caps.canUseManualClient, false)
  assertEqual(caps.canInviteEpc, true)
  assertEqual(caps.implicitEpc, false)
  assertEqual(caps.implicitFinder, true)
  assertEqual(caps.clientQueryFilter, 'by_session_finder')
  assertEqual(caps.redirectPrefix, '/finder/proyectos')
})

wizardSuite.test('Validation Step 0: Validates across all 4 portal types correctly', () => {
  const adminCaps = getWizardCapabilities('admin')
  const epcCaps = getWizardCapabilities('epc')
  const finderCaps = getWizardCapabilities('finder')

  // Empty project name
  const emptyForm = {
    nombre_proyecto: '',
    cliente_id: '',
    tipo_instalacion: '',
    modalidad_financiamiento: [],
    capex_estimado: '',
    moneda: 'MXN',
    notas_adicionales: '',
    incluye_mem: false,
  }
  assertIncludes(validarPaso0(emptyForm, adminCaps, '', false, { nombre: '', empresa: '', contacto: '' }), 'Enter project name')

  // Installation type missing
  const noInstallForm = { ...emptyForm, nombre_proyecto: 'Proyecto Solar', cliente_id: 'client-1' }
  assertIncludes(validarPaso0(noInstallForm, adminCaps, 'epc-1', false, { nombre: '', empresa: '', contacto: '' }), 'Select installation type')

  // EPC requires client and installation type, but NOT EPC selection
  const epcFormNoClient = { ...emptyForm, nombre_proyecto: 'Proyecto Solar', tipo_instalacion: 'epcista_instala' }
  assertIncludes(validarPaso0(epcFormNoClient, epcCaps, '', false, { nombre: '', empresa: '', contacto: '' }), 'Select a client')
  const epcFormValid = { ...epcFormNoClient, cliente_id: 'client-1' }
  assertEqual(validarPaso0(epcFormValid, epcCaps, '', false, { nombre: '', empresa: '', contacto: '' }), '')

  // Finder requires EPC selection and client selection
  const finderFormNoEpc = { ...emptyForm, nombre_proyecto: 'Proyecto Solar', cliente_id: 'client-1', tipo_instalacion: 'epcista_instala' }
  assertIncludes(validarPaso0(finderFormNoEpc, finderCaps, '', false, { nombre: '', empresa: '', contacto: '' }), 'Select an EPC')
  assertEqual(validarPaso0(finderFormNoEpc, finderCaps, 'epc-123', false, { nombre: '', empresa: '', contacto: '' }), '')
})

wizardSuite.test('Validation Step 1: Validates site requirements', () => {
  assertIncludes(validarPaso1([]), 'select at least one site')
  assertEqual(validarPaso1(['site-1']), '')
  assertEqual(validarPaso1(['site-1', 'site-2']), '')
})

wizardSuite.test('Validation Step 2: Enforces technical configuration rules & uniqueness', () => {
  assertIncludes(validarPaso2([]), 'at least one technical alternative')

  const nonUniqueConfigs = [
    { tempId: '1', nombre: 'Propuesta 1', descripcion: '', sitiosSeleccionados: [], productosMap: { s: [{ tempId: 'p1', tipo: 'fv' }] }, ahorro_estimado_anual: '', ahorro_moneda: 'MXN' },
    { tempId: '2', nombre: 'Propuesta 1', descripcion: '', sitiosSeleccionados: [], productosMap: { s: [{ tempId: 'p2', tipo: 'fv' }] }, ahorro_estimado_anual: '', ahorro_moneda: 'MXN' },
  ]
  assertIncludes(validarPaso2(nonUniqueConfigs), 'unique name')

  const noProductsConfig = [
    { tempId: '1', nombre: 'Propuesta A', descripcion: '', sitiosSeleccionados: [], productosMap: {}, ahorro_estimado_anual: '', ahorro_moneda: 'MXN' },
  ]
  assertIncludes(validarPaso2(noProductsConfig), 'at least one product')

  const validConfigs = [
    { tempId: '1', nombre: 'Propuesta A', descripcion: '', sitiosSeleccionados: [], productosMap: { s: [{ tempId: 'p1', tipo: 'fv' }] }, ahorro_estimado_anual: '', ahorro_moneda: 'MXN' },
    { tempId: '2', nombre: 'Propuesta B', descripcion: '', sitiosSeleccionados: [], productosMap: { s: [{ tempId: 'p2', tipo: 'bess' }] }, ahorro_estimado_anual: '', ahorro_moneda: 'MXN' },
  ]
  assertEqual(validarPaso2(validConfigs), '')
})

wizardSuite.test('Validation Step 3: Enforces financing rules and matrix linkage', () => {
  // Recommendation bypasses check
  assertEqual(validarPaso3([], true), '')

  // Zero options
  assertIncludes(validarPaso3([], false), 'at least one financing option')

  // Missing name
  const missingName = [{ tempId: '1', nombre: '', vehiculo_inversion: 'credito', ahorro_estimado_anual: '', ahorro_moneda: 'MXN', plazo_meses: '', notas: '', linkedConfigIds: ['c1'] }]
  assertIncludes(validarPaso3(missingName, false), 'must have a name')

  // Missing vehicle
  const missingVehicle = [{ tempId: '1', nombre: 'Financiamiento 1', vehiculo_inversion: '', ahorro_estimado_anual: '', ahorro_moneda: 'MXN', plazo_meses: '', notas: '', linkedConfigIds: ['c1'] }]
  assertIncludes(validarPaso3(missingVehicle, false), 'investment vehicle')

  // Missing link to alternative
  const missingLink = [{ tempId: '1', nombre: 'Financiamiento 1', vehiculo_inversion: 'credito', ahorro_estimado_anual: '', ahorro_moneda: 'MXN', plazo_meses: '', notas: '', linkedConfigIds: [] }]
  assertIncludes(validarPaso3(missingLink, false), 'linked to at least one technical alternative')

  // Valid option
  const validOption = [{ tempId: '1', nombre: 'Financiamiento 1', vehiculo_inversion: 'credito', ahorro_estimado_anual: '', ahorro_moneda: 'MXN', plazo_meses: '60', notas: '', linkedConfigIds: ['c1'] }]
  assertEqual(validarPaso3(validOption, false), '')
})

wizardSuite.test('Calculations: calcFV and calcBESS compute correctly', () => {
  const fv = {
    num_modulos: '200',
    potencia_modulos_w: '550',
    marca_modulos: 'Jinko',
    num_inversores: '2',
    potencia_inversores_kw: '50',
    marca_inversores: 'Huawei',
    generacion_anual_kwh: '180000',
    capex: '110000',
    capex_moneda: 'USD',
  }
  const fvRes = calcFV(fv)
  assertEqual(fvRes.kwpSistema, 110) // 200 * 550 / 1000 = 110 kWp
  assertEqual(fvRes.kwpInversores, 100) // 2 * 50 = 100 kW
  assertEqual(fvRes.precioWatt, 1) // 110000 / (200 * 550) = 1.0 USD/W

  const bess = {
    potencia_kw: '100',
    capacidad_kwh: '200',
    marca: 'CATL',
    uso: 'load_shifting',
    capex: '80000',
    capex_moneda: 'USD',
    inversores_hibridos: true,
  }
  const bessRes = calcBESS(bess)
  assertEqual(bessRes.precioKwh, 400) // 80000 / 200 = 400 USD/kWh

  assertEqual(n2(null), '—')
  assertEqual(n2(12.3456, 2), '12.35')
})

wizardSuite.test('Validation Product Forms: Validates FV and BESS and hybrid link', () => {
  const emptyFv = {
    num_modulos: '', potencia_modulos_w: '', marca_modulos: '',
    num_inversores: '', potencia_inversores_kw: '', marca_inversores: '',
    generacion_anual_kwh: '', capex: '', capex_moneda: 'USD',
  }
  assertIncludes(validarFvForm(emptyFv, 's1', {}), 'módulos')

  const emptyBess = {
    potencia_kw: '', capacidad_kwh: '', marca: '', uso: '', capex: '', capex_moneda: 'USD', inversores_hibridos: false,
  }
  assertIncludes(validarBessForm(emptyBess), 'potencia')

  const validBess = {
    potencia_kw: '50', capacidad_kwh: '100', marca: 'Tesla', uso: 'load_shifting', capex: '40000', capex_moneda: 'USD', inversores_hibridos: true,
  }
  assertEqual(validarBessForm(validBess), '')
})
