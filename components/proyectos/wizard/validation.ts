import type {
  WizardFormData,
  WizardCapabilities,
  ManualClienteForm,
  CreationConfig,
  CreationFinancingOption,
} from './types'


export function validarPaso0(
  form: WizardFormData,
  capabilities: WizardCapabilities,
  selectedEpcId: string,
  clienteManual: boolean,
  manualCliente: ManualClienteForm
): string {
  if (!form.nombre_proyecto.trim()) {
    return 'Ingresa el nombre del proyecto / Enter project name.'
  }

  if (capabilities.canAssignEpc && !selectedEpcId) {
    return 'Selecciona un EPCista / Select an EPC.'
  }

  if (capabilities.canUseManualClient && clienteManual) {
    if (!manualCliente.nombre.trim()) {
      return 'Ingresa el nombre del contacto del cliente / Enter client contact name.'
    }
    if (!manualCliente.empresa.trim()) {
      return 'Ingresa la empresa del cliente / Enter client company name.'
    }
  } else {
    if (!form.cliente_id) {
      return capabilities.canUseManualClient
        ? 'Selecciona un cliente o ingresa datos manualmente / Select a client or enter manually.'
        : 'Selecciona un cliente / Select a client.'
    }
  }

  if (!form.tipo_instalacion) {
    return 'Selecciona el tipo de instalación / Select installation type.'
  }

  return ''
}

export function validarPaso1(selectedSiteIds: string[]): string {
  if (selectedSiteIds.length === 0) {
    return 'Debes seleccionar al menos un sitio para el proyecto / You must select at least one site for the project.'
  }
  return ''
}

export function validarConfig(c: CreationConfig, idx: number): string {
  if (!c.nombre.trim()) {
    return `La alternativa ${idx + 1} debe tener un nombre / Alternative ${idx + 1} must have a name.`
  }
  const prods = Object.values(c.productosMap).flat()
  if (prods.length === 0) {
    return `La alternativa "${c.nombre}" debe tener al menos un producto (FV o BESS) / Alternative "${c.nombre}" must have at least one product (PV or BESS).`
  }
  return ''
}

export function validarPaso2(configs: CreationConfig[]): string {
  if (configs.length === 0) {
    return 'Debes definir al menos una alternativa técnica / You must define at least one technical alternative.'
  }
  const nombres = configs.map(c => c.nombre.trim())
  if (new Set(nombres).size !== nombres.length) {
    return 'Cada alternativa técnica debe tener un nombre único / Each technical alternative must have a unique name.'
  }
  for (let i = 0; i < configs.length; i++) {
    const err = validarConfig(configs[i], i)
    if (err) return err
  }
  return ''
}

export function validarPaso3(
  financingOptions: CreationFinancingOption[],
  isRecomendacionNodo: boolean
): string {
  if (isRecomendacionNodo) return ''
  if (financingOptions.length === 0) {
    return 'Selecciona al menos una opción de financiamiento / Select at least one financing option.'
  }

  for (let i = 0; i < financingOptions.length; i++) {
    const opt = financingOptions[i]
    if (!opt.nombre.trim()) {
      return `La opción de financiamiento ${i + 1} debe tener un nombre / Option ${i + 1} must have a name.`
    }
    if (!opt.vehiculo_inversion) {
      return `La opción de financiamiento "${opt.nombre}" debe tener un vehículo de inversión / Option "${opt.nombre}" must have an investment vehicle.`
    }
    if (opt.linkedConfigIds.length === 0) {
      return `La opción "${opt.nombre}" debe estar vinculada a al menos una alternativa técnica / Option "${opt.nombre}" must be linked to at least one technical alternative.`
    }
  }
  return ''
}

export { validarFvForm, validarBessForm } from '@/lib/domains/proyectos/schemas'

