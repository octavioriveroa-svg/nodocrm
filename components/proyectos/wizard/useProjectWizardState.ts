import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { parseNum } from '@/lib/format'
import type { Moneda, ModalidadFinanciamiento, Cliente, Sitio, Profile } from '@/lib/types'
import type {
  PortalType,
  WizardFormData,
  CreationConfig,
  CreationFinancingOption,
  NuevoSitioForm,
  ManualClienteForm,
  FVForm,
  BESSForm,
  Producto,
} from './types'
import {
  initialForm,
  emptyFv,
  emptyBess,
  emptyNuevoSitio,
  emptyManualCliente,
} from './constants'
import { getWizardCapabilities } from './capabilities'
import {
  validarPaso0,
  validarPaso1,
  validarPaso2,
  validarFvForm,
  validarBessForm,
} from './validation'

function createDefaultConfig(): CreationConfig {
  return {
    tempId: 'default',
    nombre: 'Alternativa A',
    descripcion: '',
    sitiosSeleccionados: [],
    productosMap: {},
    ahorro_estimado_anual: '',
    ahorro_moneda: 'MXN',
  }
}

function createDefaultFinancingOption(): CreationFinancingOption {
  return {
    tempId: 'fin-credito',
    nombre: 'Crédito Bancario / Debt Financing',
    vehiculo_inversion: 'credito',
    ahorro_estimado_anual: '',
    ahorro_moneda: 'MXN',
    plazo_meses: '',
    notas: '',
    linkedConfigIds: ['default'],
  }
}

function buildConfigInsertFields(c: CreationConfig, idx: number, defaultMoneda: Moneda) {
  const cfgProds = Object.values(c.productosMap).flat()
  const inversion_total = cfgProds.reduce((sum, p) => {
    const pCapex = p.tipo === 'fv' ? parseNum(p.fv?.capex) : parseNum(p.bess?.capex)
    return sum + pCapex
  }, 0)

  const cfgCurrencies = cfgProds
    .map(p => (p.tipo === 'fv' ? p.fv?.capex_moneda : p.bess?.capex_moneda))
    .filter(Boolean) as Moneda[]
  const moneda = cfgCurrencies.length > 0 ? cfgCurrencies[0] : defaultMoneda

  const ahorroAnual = c.ahorro_estimado_anual ? parseNum(c.ahorro_estimado_anual) : null
  const ahorroMensual = ahorroAnual ? Math.round((ahorroAnual / 12) * 100) / 100 : null

  return {
    nombre: c.nombre,
    descripcion: c.descripcion || null,
    inversion_total,
    moneda,
    ahorro_estimado_anual: ahorroAnual,
    ahorro_estimado_mensual: ahorroMensual,
    ahorro_moneda: c.ahorro_moneda || 'MXN',
    seleccionada: idx === 0,
  }
}

function buildFinancingInsertFields(o: CreationFinancingOption, idx: number) {
  const ahorroAnual = o.ahorro_estimado_anual ? parseNum(o.ahorro_estimado_anual) : null
  const ahorroMensual = ahorroAnual ? Math.round((ahorroAnual / 12) * 100) / 100 : null
  return {
    nombre: o.nombre,
    vehiculo_inversion: o.vehiculo_inversion,
    ahorro_estimado_anual: ahorroAnual,
    ahorro_estimado_mensual: ahorroMensual,
    moneda: o.ahorro_moneda || 'MXN',
    plazo_meses: o.plazo_meses ? parseNum(o.plazo_meses) : null,
    notas: o.notas || null,
    seleccionada: idx === 0,
  }
}

/**
 * Encapsulates multi-step state, Supabase catalog loading, site/product/financing handlers,
 * and RPC/fallback payload builders for ProjectWizard.
 */
export function useProjectWizardState(portalType: PortalType) {
  const supabase = createClient()
  const capabilities = getWizardCapabilities(portalType)

  const [step, setStep] = useState(0)
  const [form, setForm] = useState<WizardFormData>(initialForm)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sitioError, setSitioError] = useState('')

  // Role attribution selectors
  const [epcList, setEpcList] = useState<Profile[]>([])
  const [nodoUsers, setNodoUsers] = useState<Profile[]>([])
  const [finderList, setFinderList] = useState<Profile[]>([])
  const [selectedEpcId, setSelectedEpcId] = useState('')
  const [selectedResponsableId, setSelectedResponsableId] = useState('')
  const [selectedFinderId, setSelectedFinderId] = useState('')

  // Manual client toggle (Admin / Analista)
  const [clienteManual, setClienteManual] = useState(false)
  const [manualCliente, setManualCliente] = useState<ManualClienteForm>(emptyManualCliente)

  // Clientes y sitios
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clientesCargados, setClientesCargados] = useState(false)
  const [sitiosCliente, setSitiosCliente] = useState<Sitio[]>([])
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([])

  // Alternativas técnicas (1:n)
  const [configs, setConfigs] = useState<CreationConfig[]>([createDefaultConfig()])
  const [activeConfigId, setActiveConfigId] = useState<string>('default')

  // Esquemas de financiamiento (n:n)
  const [financingOptions, setFinancingOptions] = useState<CreationFinancingOption[]>([
    createDefaultFinancingOption(),
  ])
  const [isRecomendacionNodo, setIsRecomendacionNodo] = useState(false)
  const [foldedCharacteristics, setFoldedCharacteristics] = useState<Record<string, boolean>>({})

  // Formulario agregar producto
  const [addingToSitioId, setAddingToSitioId] = useState<string | null>(null)
  const [productTipo, setProductTipo] = useState<'fv' | 'bess' | null>(null)
  const [fvForm, setFvForm] = useState<FVForm>(emptyFv)
  const [bessForm, setBessForm] = useState<BESSForm>(emptyBess)
  const [addProductError, setAddProductError] = useState('')

  // Inline nuevo sitio
  const [mostrarNuevoSitio, setMostrarNuevoSitio] = useState(false)
  const [nuevoSitio, setNuevoSitio] = useState<NuevoSitioForm>(emptyNuevoSitio)
  const [guardandoSitio, setGuardandoSitio] = useState(false)
  const [reciboUrlNuevo, setReciboUrlNuevo] = useState<string | null>(null)
  const [subiendoPdfNuevo, setSubiendoPdfNuevo] = useState(false)
  const fileRefNuevo = useRef<HTMLInputElement>(null)

  // Ver / editar / eliminar sitios
  const [viendoSitioId, setViendoSitioId] = useState<string | null>(null)
  const [editandoSitioId, setEditandoSitioId] = useState<string | null>(null)
  const [deletingSitioId, setDeletingSitioId] = useState<string | null>(null)
  const [editSitioForm, setEditSitioForm] = useState<NuevoSitioForm>(emptyNuevoSitio)
  const [editSitioReciboUrl, setEditSitioReciboUrl] = useState<string | null>(null)
  const [subiendoPdfEdit, setSubiendoPdfEdit] = useState(false)
  const [guardandoEditSitio, setGuardandoEditSitio] = useState(false)
  const fileRefEdit = useRef<HTMLInputElement>(null)

  function setF<K extends keyof WizardFormData>(field: K, value: WizardFormData[K]) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function resetConfigsAndFinancing() {
    setConfigs([createDefaultConfig()])
    setActiveConfigId('default')
    setFinancingOptions([createDefaultFinancingOption()])
    setIsRecomendacionNodo(false)
  }

  // Load catalogs based on portal capabilities
  useEffect(() => {
    async function loadCatalogos() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (capabilities.canAssignEpc) {
        const { data: epcs } = await supabase
          .from('profiles')
          .select('*')
          .eq('rol', 'epc')
          .order('nombre')
        setEpcList((epcs ?? []) as Profile[])
      }

      if (capabilities.canAssignResponsableNodo) {
        const { data: nodos } = await supabase
          .from('profiles')
          .select('*')
          .in('rol', ['nodo_admin', 'nodo_analista'])
          .order('nombre')
        setNodoUsers((nodos ?? []) as Profile[])
      }

      if (capabilities.canAssignFinder) {
        const { data: finders } = await supabase
          .from('profiles')
          .select('*')
          .eq('rol', 'finder')
          .order('nombre')
        setFinderList((finders ?? []) as Profile[])
      }

      if (capabilities.clientQueryFilter === 'by_session_epc' && session?.user) {
        const { data } = await supabase
          .from('clientes')
          .select('*')
          .eq('epcista_id', session.user.id)
          .order('razon_social')
        setClientes((data ?? []) as Cliente[])
        setClientesCargados(true)
      } else if (capabilities.clientQueryFilter === 'by_session_finder' && session?.user) {
        const { data } = await supabase
          .from('clientes')
          .select('*')
          .eq('finder_id', session.user.id)
          .order('razon_social')
        setClientes((data ?? []) as Cliente[])
        setClientesCargados(true)
      } else if (capabilities.clientQueryFilter === 'by_selected_epc') {
        setClientesCargados(true)
      }
    }

    loadCatalogos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleReloadEpcList() {
    const { data: epcs } = await supabase
      .from('profiles')
      .select('*')
      .eq('rol', 'epc')
      .order('nombre')
    setEpcList((epcs ?? []) as Profile[])
  }

  async function handleSelectEpc(epcId: string) {
    setSelectedEpcId(epcId)
    setClienteManual(false)
    setForm(prev => ({ ...prev, cliente_id: '' }))
    setSitiosCliente([])
    resetConfigsAndFinancing()

    if (!epcId) {
      setClientes([])
      setClientesCargados(true)
      return
    }

    if (capabilities.clientQueryFilter === 'by_selected_epc') {
      const { data } = await supabase
        .from('clientes')
        .select('*')
        .eq('epcista_id', epcId)
        .order('razon_social')
      setClientes((data ?? []) as Cliente[])
      setClientesCargados(true)
    }
  }

  async function cargarSitios(clienteId: string) {
    if (!clienteId) {
      setSitiosCliente([])
      resetConfigsAndFinancing()
      return
    }
    const { data } = await supabase
      .from('sitios')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('nombre')
    setSitiosCliente((data ?? []) as Sitio[])
    resetConfigsAndFinancing()
  }

  function seleccionarCliente(clienteId: string) {
    setF('cliente_id', clienteId)
    cargarSitios(clienteId)
    setMostrarNuevoSitio(false)
    setViendoSitioId(null)
    setEditandoSitioId(null)
  }

  function toggleSitio(sitioId: string) {
    setSelectedSiteIds(prev => {
      const next = prev.includes(sitioId)
        ? prev.filter(id => id !== sitioId)
        : [...prev, sitioId]
      setConfigs(prevConfigs =>
        prevConfigs.map(c => ({
          ...c,
          sitiosSeleccionados: next,
          productosMap: Object.fromEntries(next.map(sId => [sId, c.productosMap[sId] || []])),
        }))
      )
      return next
    })
    if (addingToSitioId === sitioId) setAddingToSitioId(null)
  }

  async function uploadReciboPdf(
    e: React.ChangeEvent<HTMLInputElement>,
    setSubiendo: (val: boolean) => void,
    onSuccessUrl: (url: string) => void,
    fileRef: React.RefObject<HTMLInputElement | null>,
    requireSessionError: boolean
  ) {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendo(true)
    setSitioError('')
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user) {
        if (requireSessionError) {
          setSitioError('Sesión expirada. Recarga la página.')
        }
        setSubiendo(false)
        return
      }
      const effectiveClientId = form.cliente_id || 'temp-client'
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${session.user.id}/${effectiveClientId}/${Date.now()}_${cleanFileName}`
      const { error: uploadErr } = await supabase.storage
        .from('recibos-cfe')
        .upload(path, file, { cacheControl: '3600', upsert: true })

      if (uploadErr) {
        console.error('Upload error:', uploadErr)
        setSitioError(`Error al subir recibo: ${uploadErr.message}`)
      } else {
        const {
          data: { publicUrl },
        } = supabase.storage.from('recibos-cfe').getPublicUrl(path)
        onSuccessUrl(publicUrl)
      }
    } catch (err: unknown) {
      console.error('Catch upload error:', err)
      const msg = err instanceof Error ? err.message : 'Error inesperado al subir el recibo.'
      setSitioError(msg)
    } finally {
      setSubiendo(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function subirPdfNuevo(e: React.ChangeEvent<HTMLInputElement>) {
    return uploadReciboPdf(e, setSubiendoPdfNuevo, setReciboUrlNuevo, fileRefNuevo, true)
  }

  function subirPdfEdit(e: React.ChangeEvent<HTMLInputElement>) {
    return uploadReciboPdf(e, setSubiendoPdfEdit, setEditSitioReciboUrl, fileRefEdit, false)
  }

  async function guardarNuevoSitio() {
    if (!nuevoSitio.nombre.trim()) return
    setSitioError('')
    setGuardandoSitio(true)
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user) {
      setSitioError('Sesión expirada. Recarga la página.')
      setGuardandoSitio(false)
      return
    }

    let clienteId = form.cliente_id
    if (!clienteId && clienteManual) {
      if (!manualCliente.empresa.trim()) {
        setSitioError('Completa los datos del cliente en el paso anterior antes de agregar sitios.')
        setGuardandoSitio(false)
        return
      }
      const { data: newCliente, error: clienteErr } = await supabase
        .from('clientes')
        .insert({
          epcista_id: selectedEpcId || session.user.id,
          razon_social: manualCliente.empresa,
          contacto_nombre: manualCliente.nombre || manualCliente.empresa,
          contacto_email: manualCliente.contacto.includes('@') ? manualCliente.contacto : null,
          contacto_telefono: !manualCliente.contacto.includes('@') ? manualCliente.contacto : null,
        })
        .select('id')
        .single()

      if (clienteErr) {
        setSitioError('Error al crear el cliente: ' + clienteErr.message)
        setGuardandoSitio(false)
        return
      }
      clienteId = newCliente.id
      setF('cliente_id', clienteId)
      setClienteManual(false)
    }

    if (!clienteId) {
      setSitioError('Selecciona un cliente antes de agregar sitios.')
      setGuardandoSitio(false)
      return
    }

    const assignedEpcId = capabilities.implicitEpc
      ? session.user.id
      : selectedEpcId || session.user.id

    const { data, error: insertErr } = await supabase
      .from('sitios')
      .insert({
        cliente_id: clienteId,
        epcista_id: assignedEpcId,
        nombre: nuevoSitio.nombre,
        nombre_recibo: nuevoSitio.nombre_recibo || null,
        ciudad: nuevoSitio.ciudad || null,
        ubicacion_estado: nuevoSitio.ubicacion_estado || null,
        rpu: nuevoSitio.rpu || null,
        demanda_contratada_kw: nuevoSitio.demanda_contratada_kw
          ? Number(nuevoSitio.demanda_contratada_kw)
          : null,
        recibo_url: reciboUrlNuevo,
      })
      .select()
      .single()

    if (insertErr) {
      setSitioError('Error al guardar el sitio: ' + insertErr.message)
      setGuardandoSitio(false)
      return
    }
    if (data) {
      setSitiosCliente(prev => [...prev, data as Sitio])
    }
    setNuevoSitio(emptyNuevoSitio)
    setReciboUrlNuevo(null)
    setMostrarNuevoSitio(false)
    setGuardandoSitio(false)
  }

  async function actualizarSitio() {
    if (!editandoSitioId || !editSitioForm.nombre.trim()) return
    setGuardandoEditSitio(true)
    const { data } = await supabase
      .from('sitios')
      .update({
        nombre: editSitioForm.nombre,
        nombre_recibo: editSitioForm.nombre_recibo || null,
        ciudad: editSitioForm.ciudad || null,
        ubicacion_estado: editSitioForm.ubicacion_estado || null,
        rpu: editSitioForm.rpu || null,
        demanda_contratada_kw: editSitioForm.demanda_contratada_kw
          ? Number(editSitioForm.demanda_contratada_kw)
          : null,
        recibo_url: editSitioReciboUrl,
      })
      .eq('id', editandoSitioId)
      .select()
      .single()

    if (data) {
      setSitiosCliente(prev => prev.map(s => (s.id === editandoSitioId ? (data as Sitio) : s)))
    }
    setEditandoSitioId(null)
    setEditSitioForm(emptyNuevoSitio)
    setEditSitioReciboUrl(null)
    setGuardandoEditSitio(false)
  }

  function abrirEditarSitio(s: Sitio) {
    setEditandoSitioId(editandoSitioId === s.id ? null : s.id)
    setEditSitioForm({
      nombre: s.nombre,
      nombre_recibo: s.nombre_recibo ?? '',
      ciudad: s.ciudad ?? '',
      ubicacion_estado: s.ubicacion_estado ?? '',
      rpu: s.rpu ?? '',
      demanda_contratada_kw: s.demanda_contratada_kw?.toString() ?? '',
    })
    setEditSitioReciboUrl(s.recibo_url ?? null)
    setViendoSitioId(null)
    setMostrarNuevoSitio(false)
    setAddingToSitioId(null)
    setDeletingSitioId(null)
  }

  async function eliminarSitio(id: string) {
    await supabase.from('sitios').delete().eq('id', id)
    setSitiosCliente(prev => prev.filter(s => s.id !== id))
    setSelectedSiteIds(prev => prev.filter(sid => sid !== id))
    setConfigs(prevConfigs =>
      prevConfigs.map(c => ({
        ...c,
        sitiosSeleccionados: c.sitiosSeleccionados.filter(sid => sid !== id),
        productosMap: Object.fromEntries(Object.entries(c.productosMap).filter(([sId]) => sId !== id)),
      }))
    )
    setDeletingSitioId(null)
  }

  const activeConfig = configs.find(c => c.tempId === activeConfigId) || configs[0]

  function startAddingProduct(sitioId: string) {
    setAddingToSitioId(sitioId)
    setProductTipo(null)
    setFvForm(emptyFv)
    setBessForm(emptyBess)
    setAddProductError('')
    setViendoSitioId(null)
    setEditandoSitioId(null)
  }

  function guardarProductoWithId(sitioId: string, tempId: string) {
    if (!sitioId || !productTipo) return
    const err =
      productTipo === 'fv'
        ? validarFvForm(fvForm, sitioId, activeConfig.productosMap)
        : validarBessForm(bessForm)
    if (err) {
      setAddProductError(err)
      return
    }

    const producto: Producto = {
      tempId,
      tipo: productTipo,
      ...(productTipo === 'fv' ? { fv: { ...fvForm } } : { bess: { ...bessForm } }),
    }

    setConfigs(prevConfigs =>
      prevConfigs.map(c => {
        if (c.tempId === activeConfigId) {
          return {
            ...c,
            productosMap: {
              ...c.productosMap,
              [sitioId]: [...(c.productosMap[sitioId] ?? []), producto],
            },
          }
        }
        return c
      })
    )
    setAddingToSitioId(null)
    setAddProductError('')
  }

  function removeProduct(sitioId: string, tempId: string) {
    setConfigs(prevConfigs =>
      prevConfigs.map(c => {
        if (c.tempId === activeConfigId) {
          return {
            ...c,
            productosMap: {
              ...c.productosMap,
              [sitioId]: (c.productosMap[sitioId] ?? []).filter(p => p.tempId !== tempId),
            },
          }
        }
        return c
      })
    )
  }

  function toggleVehiculo(vehiculoId: ModalidadFinanciamiento, nombreEs: string, nombreEn: string) {
    if (vehiculoId === 'no_sabe') {
      setIsRecomendacionNodo(true)
      setFinancingOptions([
        {
          tempId: 'fin-no_sabe',
          nombre: 'Recomendación de Nodo / Nodo Recommendation',
          vehiculo_inversion: 'no_sabe',
          ahorro_estimado_anual: '',
          ahorro_moneda: 'MXN',
          plazo_meses: '',
          notas: '',
          linkedConfigIds: configs.map(c => c.tempId),
        },
      ])
      return
    }

    setIsRecomendacionNodo(false)
    setFinancingOptions(prev => {
      const filtered = prev.filter(o => o.vehiculo_inversion !== 'no_sabe')
      const exists = filtered.some(o => o.vehiculo_inversion === vehiculoId)
      if (exists) {
        if (filtered.length === 1) return filtered
        return filtered.filter(o => o.vehiculo_inversion !== vehiculoId)
      }
      return [
        ...filtered,
        {
          tempId: `fin-${vehiculoId}-${Date.now()}`,
          nombre: `${nombreEs} / ${nombreEn}`,
          vehiculo_inversion: vehiculoId,
          ahorro_estimado_anual: '',
          ahorro_moneda: 'MXN',
          plazo_meses: '',
          notas: '',
          linkedConfigIds: configs.map(c => c.tempId),
        },
      ]
    })
  }

  function handleNext(onNodoBuscaSubmit: () => void) {
    setError('')
    if (step === 0) {
      const err = validarPaso0(form, capabilities, selectedEpcId, clienteManual, manualCliente)
      if (err) {
        setError(err)
        return
      }
    } else if (step === 1) {
      const err = validarPaso1(selectedSiteIds)
      if (err) {
        setError(err)
        return
      }
      if (form.tipo_instalacion === 'nodo_busca') {
        onNodoBuscaSubmit()
        return
      }
      setConfigs(prev =>
        prev.map(c => ({
          ...c,
          sitiosSeleccionados: selectedSiteIds,
          productosMap: Object.fromEntries(selectedSiteIds.map(sId => [sId, c.productosMap[sId] || []])),
        }))
      )
    } else if (step === 2) {
      const err = validarPaso2(configs)
      if (err) {
        setError(err)
        return
      }
      setFinancingOptions(prev =>
        prev.map(o => ({
          ...o,
          linkedConfigIds:
            o.linkedConfigIds.length > 0
              ? o.linkedConfigIds.filter(id => configs.some(c => c.tempId === id))
              : configs.map(c => c.tempId),
        }))
      )
    }
    setStep(s => s + 1)
  }

  function prepareSubmissionPayloads(sessionUserId: string) {
    const isNodoBuscaNow = form.tipo_instalacion === 'nodo_busca'
    const cliente = clientes.find(c => c.id === form.cliente_id)

    let hasFV = false
    let hasBESS = false
    for (const c of configs) {
      const prods = Object.values(c.productosMap).flat()
      if (prods.some(p => p.tipo === 'fv')) hasFV = true
      if (prods.some(p => p.tipo === 'bess')) hasBESS = true
    }
    const tipo = isNodoBuscaNow ? 'FV' : hasFV && hasBESS ? 'FV+BESS' : hasFV ? 'FV' : 'BESS'

    const primerSitioId =
      selectedSiteIds.length > 0 ? selectedSiteIds[0] : configs[0]?.sitiosSeleccionados?.[0]
    const ubicacion_estado =
      sitiosCliente.find(s => s.id === primerSitioId)?.ubicacion_estado ?? ''

    const firstConfigProducts = Object.values(configs[0].productosMap).flat()
    const firstConfigCapex = firstConfigProducts.reduce((sum, p) => {
      const pCapex = p.tipo === 'fv' ? parseNum(p.fv?.capex) : parseNum(p.bess?.capex)
      return sum + pCapex
    }, 0)

    const productCurrencies = firstConfigProducts
      .map(p => (p.tipo === 'fv' ? p.fv?.capex_moneda : p.bess?.capex_moneda))
      .filter(Boolean) as Moneda[]
    const configMoneda: Moneda = isNodoBuscaNow
      ? form.moneda
      : productCurrencies.length > 0
        ? productCurrencies[0]
        : form.moneda

    const vehiclesArray =
      isRecomendacionNodo || isNodoBuscaNow
        ? ['no_sabe']
        : Array.from(new Set(financingOptions.map(o => o.vehiculo_inversion)))

    const effectiveEpcId = capabilities.implicitEpc ? sessionUserId : selectedEpcId || null
    const effectiveFinderId = capabilities.implicitFinder
      ? sessionUserId
      : capabilities.canAssignFinder
        ? selectedFinderId || null
        : null
    const effectiveResponsableId = capabilities.canAssignResponsableNodo
      ? selectedResponsableId || null
      : null

    const proyectoPayload: Record<string, unknown> = {
      epcista_id: effectiveEpcId,
      responsable_nodo_id: effectiveResponsableId,
      finder_id: effectiveFinderId,
      cliente_id: clienteManual ? null : form.cliente_id || null,
      tipo,
      nombre_proyecto: form.nombre_proyecto,
      estado: 'recibido',
      tipo_instalacion: form.tipo_instalacion,
      incluye_mem: form.incluye_mem,
      demanda_kw: null,
      cliente_final_nombre: clienteManual ? manualCliente.nombre : cliente?.contacto_nombre ?? '',
      cliente_final_empresa: clienteManual ? manualCliente.empresa : cliente?.razon_social ?? '',
      cliente_final_contacto: clienteManual
        ? manualCliente.contacto
        : cliente?.contacto_email ?? cliente?.contacto_telefono ?? '',
      capex_estimado: isNodoBuscaNow ? null : firstConfigCapex,
      moneda: configMoneda,
      ubicacion_estado,
      modalidad_financiamiento: vehiclesArray as ModalidadFinanciamiento[],
      notas_adicionales: form.notas_adicionales || null,
      capacidad_mwh: null,
      capacidad_mw: null,
      tecnologia_bateria: null,
      duracion_descarga_hrs: null,
      punto_interconexion: null,
      tipo_participacion_mem: null,
      volumen_energia_mwh_anual: null,
    }

    const todosSitios =
      selectedSiteIds.length > 0
        ? selectedSiteIds
        : Array.from(new Set(configs.flatMap(c => c.sitiosSeleccionados)))

    const rpcConfiguraciones = isNodoBuscaNow
      ? [
          {
            temp_id: 'default',
            nombre: 'Pendiente definición',
            descripcion: null,
            inversion_total: null,
            moneda: form.moneda,
            ahorro_estimado_anual: null,
            ahorro_estimado_mensual: null,
            ahorro_moneda: 'MXN',
            seleccionada: true,
          },
        ]
      : configs.map((c, idx) => ({
          temp_id: c.tempId,
          ...buildConfigInsertFields(c, idx, form.moneda),
        }))

    const rpcOpcionesFinanciamiento =
      isNodoBuscaNow || isRecomendacionNodo
        ? [
            {
              temp_id: 'recomendacion-nodo',
              nombre: 'Recomendación de Nodo',
              vehiculo_inversion: 'no_sabe',
              ahorro_estimado_anual: null,
              ahorro_estimado_mensual: null,
              moneda: 'MXN',
              plazo_meses: null,
              notas: null,
              seleccionada: true,
            },
          ]
        : financingOptions.map((o, idx) => ({
            temp_id: o.tempId,
            ...buildFinancingInsertFields(o, idx),
          }))

    const rpcLinks: { config_temp_id: string; opcion_temp_id: string }[] = []
    if (isNodoBuscaNow || isRecomendacionNodo) {
      for (const rc of rpcConfiguraciones) {
        rpcLinks.push({ config_temp_id: rc.temp_id, opcion_temp_id: 'recomendacion-nodo' })
      }
    } else {
      for (const o of financingOptions) {
        for (const configTempId of o.linkedConfigIds) {
          rpcLinks.push({ config_temp_id: configTempId, opcion_temp_id: o.tempId })
        }
      }
    }

    const rpcProductos: {
      config_temp_id: string
      sitio_id: string
      tipo: 'fv' | 'bess'
      datos: Record<string, unknown>
    }[] = []

    if (!isNodoBuscaNow) {
      for (const c of configs) {
        for (const sitio_id of c.sitiosSeleccionados) {
          for (const p of c.productosMap[sitio_id] ?? []) {
            rpcProductos.push({
              config_temp_id: c.tempId,
              sitio_id,
              tipo: p.tipo,
              datos: (p.tipo === 'fv' ? p.fv : p.bess) as unknown as Record<string, unknown>,
            })
          }
        }
      }
    }

    return {
      proyectoPayload,
      todosSitios,
      rpcConfiguraciones,
      rpcOpcionesFinanciamiento,
      rpcLinks,
      rpcProductos,
    }
  }

  async function insertFallbackChildTables(proyectoId: string, todosSitios: string[]) {
    const isNodoBuscaNow = form.tipo_instalacion === 'nodo_busca'

    if (todosSitios.length > 0) {
      const { error: sitiosErr } = await supabase.from('proyecto_sitios').insert(
        todosSitios.map(sitio_id => ({ proyecto_id: proyectoId, sitio_id }))
      )
      if (sitiosErr) throw sitiosErr
    }

    const configsToInsert = isNodoBuscaNow
      ? [
          {
            proyecto_id: proyectoId,
            nombre: 'Pendiente definición',
            descripcion: null,
            inversion_total: null,
            moneda: form.moneda,
            seleccionada: true,
          },
        ]
      : configs.map((c, idx) => ({
          proyecto_id: proyectoId,
          ...buildConfigInsertFields(c, idx, form.moneda),
        }))

    const { data: insertedConfigs, error: configsErr } = await supabase
      .from('configuraciones_tecnicas')
      .insert(configsToInsert)
      .select('id, nombre')
    if (configsErr) throw configsErr

    const optionsToInsert =
      isNodoBuscaNow || isRecomendacionNodo
        ? [
            {
              proyecto_id: proyectoId,
              nombre: 'Recomendación de Nodo',
              vehiculo_inversion: 'no_sabe',
              ahorro_estimado_anual: null,
              ahorro_estimado_mensual: null,
              moneda: 'MXN',
              plazo_meses: null,
              notas: null,
              seleccionada: true,
            },
          ]
        : financingOptions.map((o, idx) => ({
            proyecto_id: proyectoId,
            ...buildFinancingInsertFields(o, idx),
          }))

    const { data: insertedOptions, error: optionsErr } = await supabase
      .from('opciones_financiamiento')
      .insert(optionsToInsert)
      .select('id, nombre, vehiculo_inversion')
    if (optionsErr) throw optionsErr

    const junctionRows: { configuracion_id: string; opcion_financiamiento_id: string }[] = []
    if (isNodoBuscaNow || isRecomendacionNodo) {
      const optId = insertedOptions?.[0]?.id
      if (optId && insertedConfigs) {
        for (const ic of insertedConfigs) {
          junctionRows.push({ configuracion_id: ic.id, opcion_financiamiento_id: optId })
        }
      }
    } else {
      for (const o of financingOptions) {
        const dbOpt = insertedOptions?.find(
          io => io.nombre === o.nombre && io.vehiculo_inversion === o.vehiculo_inversion
        )
        if (!dbOpt) continue
        for (const configTempId of o.linkedConfigIds) {
          const origConfig = configs.find(c => c.tempId === configTempId)
          if (!origConfig) continue
          const dbConfig = insertedConfigs?.find(ic => ic.nombre === origConfig.nombre)
          if (!dbConfig) continue
          junctionRows.push({ configuracion_id: dbConfig.id, opcion_financiamiento_id: dbOpt.id })
        }
      }
    }

    if (junctionRows.length > 0) {
      const { error: junctionErr } = await supabase.from('config_financiamiento').insert(junctionRows)
      if (junctionErr) throw junctionErr
    }

    if (!isNodoBuscaNow) {
      const productosRows: {
        proyecto_id: string
        configuracion_id: string
        sitio_id: string
        tipo: 'fv' | 'bess'
        datos: Record<string, unknown>
      }[] = []

      for (const c of configs) {
        const dbConfig = insertedConfigs?.find(ic => ic.nombre === c.nombre)
        if (!dbConfig) continue
        for (const sitio_id of c.sitiosSeleccionados) {
          for (const p of c.productosMap[sitio_id] ?? []) {
            productosRows.push({
              proyecto_id: proyectoId,
              configuracion_id: dbConfig.id,
              sitio_id,
              tipo: p.tipo,
              datos: (p.tipo === 'fv' ? p.fv : p.bess) as unknown as Record<string, unknown>,
            })
          }
        }
      }

      if (productosRows.length > 0) {
        const { error: prodErr } = await supabase
          .from('proyecto_sitio_productos')
          .insert(productosRows)
        if (prodErr) throw prodErr
      }
    }
  }

  const isNodoBusca = form.tipo_instalacion === 'nodo_busca'
  const anyHighDemanda = (
    selectedSiteIds.length > 0 ? selectedSiteIds : activeConfig.sitiosSeleccionados
  ).some(id => (sitiosCliente.find(s => s.id === id)?.demanda_contratada_kw ?? 0) > 1000)

  const activeConfigProducts = Object.values(activeConfig.productosMap).flat()
  const activeConfigCapex = activeConfigProducts.reduce((sum, p) => {
    const pCapex = p.tipo === 'fv' ? parseNum(p.fv?.capex) : parseNum(p.bess?.capex)
    return sum + pCapex
  }, 0)

  const activeProductCurrencies = activeConfigProducts
    .map(p => (p.tipo === 'fv' ? p.fv?.capex_moneda : p.bess?.capex_moneda))
    .filter(Boolean) as Moneda[]
  const activeConfigMoneda: Moneda =
    activeProductCurrencies.length > 0 ? activeProductCurrencies[0] : form.moneda

  return {
    supabase,
    capabilities,
    step,
    setStep,
    form,
    setF,
    error,
    setError,
    loading,
    setLoading,
    sitioError,
    setSitioError,
    epcList,
    nodoUsers,
    finderList,
    selectedEpcId,
    handleSelectEpc,
    selectedResponsableId,
    setSelectedResponsableId,
    selectedFinderId,
    setSelectedFinderId,
    clienteManual,
    setClienteManual,
    manualCliente,
    setManualCliente,
    clientes,
    clientesCargados,
    seleccionarCliente,
    handleReloadEpcList,
    sitiosCliente,
    selectedSiteIds,
    toggleSitio,
    mostrarNuevoSitio,
    setMostrarNuevoSitio,
    nuevoSitio,
    setNuevoSitio,
    guardandoSitio,
    reciboUrlNuevo,
    subiendoPdfNuevo,
    subirPdfNuevo,
    guardarNuevoSitio,
    viendoSitioId,
    setViendoSitioId,
    editandoSitioId,
    setEditandoSitioId,
    abrirEditarSitio,
    deletingSitioId,
    setDeletingSitioId,
    eliminarSitio,
    editSitioForm,
    setEditSitioForm,
    editSitioReciboUrl,
    subiendoPdfEdit,
    subirPdfEdit,
    guardandoEditSitio,
    actualizarSitio,
    fileRefNuevo,
    fileRefEdit,
    configs,
    setConfigs,
    activeConfigId,
    setActiveConfigId,
    activeConfig,
    addingToSitioId,
    setAddingToSitioId,
    productTipo,
    setProductTipo,
    fvForm,
    setFvForm,
    bessForm,
    setBessForm,
    addProductError,
    guardarProductoWithId,
    removeProduct,
    startAddingProduct,
    activeConfigCapex,
    activeConfigMoneda,
    financingOptions,
    setFinancingOptions,
    isRecomendacionNodo,
    toggleVehiculo,
    foldedCharacteristics,
    setFoldedCharacteristics,
    isNodoBusca,
    anyHighDemanda,
    handleNext,
    prepareSubmissionPayloads,
    insertFallbackChildTables,
  }
}
