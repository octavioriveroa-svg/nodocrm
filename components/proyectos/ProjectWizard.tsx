'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import StepIndicator from '@/components/ui/StepIndicator'
import { createClient } from '@/lib/supabase/client'
import { parseNum } from '@/lib/format'
import type { Moneda, ModalidadFinanciamiento, Cliente, Sitio, Profile } from '@/lib/types'

import type {
  ProjectWizardProps,
  WizardFormData,
  CreationConfig,
  CreationFinancingOption,
  NuevoSitioForm,
  ManualClienteForm,
  FVForm,
  BESSForm,
  Producto,
} from './wizard/types'
import {
  initialForm,
  emptyFv,
  emptyBess,
  emptyNuevoSitio,
  emptyManualCliente,
} from './wizard/constants'
import { getWizardCapabilities } from './wizard/capabilities'
import {
  validarPaso0,
  validarPaso1,
  validarPaso2,
  validarPaso3,
  validarFvForm,
  validarBessForm,
} from './wizard/validation'
import { Step0GeneralInfo } from './wizard/Step0GeneralInfo'
import { Step1Sites } from './wizard/Step1Sites'
import { Step2TechnicalConfigs } from './wizard/Step2TechnicalConfigs'
import { Step3Financing } from './wizard/Step3Financing'

export default function ProjectWizard({
  portalType,
  onSuccessRedirect,
  title = 'Nuevo proyecto / New Project',
}: ProjectWizardProps) {
  const router = useRouter()
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
  const [configs, setConfigs] = useState<CreationConfig[]>([
    {
      tempId: 'default',
      nombre: 'Alternativa A',
      descripcion: '',
      sitiosSeleccionados: [],
      productosMap: {},
      ahorro_estimado_anual: '',
      ahorro_moneda: 'MXN',
    },
  ])
  const [activeConfigId, setActiveConfigId] = useState<string>('default')

  // Esquemas de financiamiento (n:n)
  const [financingOptions, setFinancingOptions] = useState<CreationFinancingOption[]>([
    {
      tempId: 'fin-credito',
      nombre: 'Crédito Bancario / Debt Financing',
      vehiculo_inversion: 'credito',
      ahorro_estimado_anual: '',
      ahorro_moneda: 'MXN',
      plazo_meses: '',
      notas: '',
      linkedConfigIds: ['default'],
    },
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
        // Admin / Analista: wait for EPC selection
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
    setConfigs([
      {
        tempId: 'default',
        nombre: 'Alternativa A',
        descripcion: '',
        sitiosSeleccionados: [],
        productosMap: {},
        ahorro_estimado_anual: '',
        ahorro_moneda: 'MXN',
      },
    ])
    setActiveConfigId('default')
    setFinancingOptions([
      {
        tempId: 'fin-credito',
        nombre: 'Crédito Bancario / Debt Financing',
        vehiculo_inversion: 'credito',
        ahorro_estimado_anual: '',
        ahorro_moneda: 'MXN',
        plazo_meses: '',
        notas: '',
        linkedConfigIds: ['default'],
      },
    ])
    setIsRecomendacionNodo(false)

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
      setConfigs([
        {
          tempId: 'default',
          nombre: 'Alternativa A',
          descripcion: '',
          sitiosSeleccionados: [],
          productosMap: {},
          ahorro_estimado_anual: '',
          ahorro_moneda: 'MXN',
        },
      ])
      setActiveConfigId('default')
      setFinancingOptions([
        {
          tempId: 'fin-credito',
          nombre: 'Crédito Bancario / Debt Financing',
          vehiculo_inversion: 'credito',
          ahorro_estimado_anual: '',
          ahorro_moneda: 'MXN',
          plazo_meses: '',
          notas: '',
          linkedConfigIds: ['default'],
        },
      ])
      setIsRecomendacionNodo(false)
      return
    }
    const { data } = await supabase
      .from('sitios')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('nombre')
    setSitiosCliente((data ?? []) as Sitio[])
    setConfigs([
      {
        tempId: 'default',
        nombre: 'Alternativa A',
        descripcion: '',
        sitiosSeleccionados: [],
        productosMap: {},
        ahorro_estimado_anual: '',
        ahorro_moneda: 'MXN',
      },
    ])
    setActiveConfigId('default')
    setFinancingOptions([
      {
        tempId: 'fin-credito',
        nombre: 'Crédito Bancario / Debt Financing',
        vehiculo_inversion: 'credito',
        ahorro_estimado_anual: '',
        ahorro_moneda: 'MXN',
        plazo_meses: '',
        notas: '',
        linkedConfigIds: ['default'],
      },
    ])
    setIsRecomendacionNodo(false)
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

  // ── Sitios inline y CFE PDF ──────────────────────────────────
  async function subirPdfNuevo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendoPdfNuevo(true)
    setSitioError('')
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user) {
        setSitioError('Sesión expirada. Recarga la página.')
        setSubiendoPdfNuevo(false)
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
        setReciboUrlNuevo(publicUrl)
      }
    } catch (err: unknown) {
      console.error('Catch upload error:', err)
      const msg = err instanceof Error ? err.message : 'Error inesperado al subir el recibo.'
      setSitioError(msg)
    } finally {
      setSubiendoPdfNuevo(false)
      if (fileRefNuevo.current) fileRefNuevo.current.value = ''
    }
  }

  async function subirPdfEdit(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendoPdfEdit(true)
    setSitioError('')
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user) {
        setSubiendoPdfEdit(false)
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
        setEditSitioReciboUrl(publicUrl)
      }
    } catch (err: unknown) {
      console.error('Catch upload error:', err)
      const msg = err instanceof Error ? err.message : 'Error inesperado al subir el recibo.'
      setSitioError(msg)
    } finally {
      setSubiendoPdfEdit(false)
      if (fileRefEdit.current) fileRefEdit.current.value = ''
    }
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

    // Auto-crear cliente si admin utilizó modo manual
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
      const sitio = data as Sitio
      setSitiosCliente(prev => [...prev, sitio])
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

  // ── Productos (Step 2) ───────────────────────────────────────
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

  function guardarProducto(sitioId: string) {
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
      tempId: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
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

  // ── Financiamiento (Step 3) ──────────────────────────────────
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
      } else {
        const newOption: CreationFinancingOption = {
          tempId: `fin-${vehiculoId}-${Date.now()}`,
          nombre: `${nombreEs} / ${nombreEn}`,
          vehiculo_inversion: vehiculoId,
          ahorro_estimado_anual: '',
          ahorro_moneda: 'MXN',
          plazo_meses: '',
          notas: '',
          linkedConfigIds: configs.map(c => c.tempId),
        }
        return [...filtered, newOption]
      }
    })
  }

  // ── Navegación entre pasos ───────────────────────────────────
  function handleNext() {
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
        handleSubmit()
        return
      }
      // Inicializar sitios y mapas de productos para todas las configuraciones
      setConfigs(prev =>
        prev.map(c => ({
          ...c,
          sitiosSeleccionados: selectedSiteIds,
          productosMap: Object.fromEntries(selectedSiteIds.map(sId => [sId, c.productosMap[sId] || []])),
        }))
      )
    } else if (step === 2) {
      // NOTE: Fix the EPC validation bug — Step 2 calls validarPaso2(configs)
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

  // ── Guardado en las 6 tablas relacionales ─────────────────────
  async function handleSubmit() {
    setError('')
    const isNodoBusca = form.tipo_instalacion === 'nodo_busca'
    if (!isNodoBusca) {
      const err = validarPaso3(financingOptions, isRecomendacionNodo)
      if (err) {
        setError(err)
        return
      }
    }
    setLoading(true)

    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user) {
      setError('Sesión expirada. Por favor, recarga e inicia sesión.')
      setLoading(false)
      return
    }

    const cliente = clientes.find(c => c.id === form.cliente_id)

    // 1. Determinar tipo de proyecto y métricas agregadas
    let hasFV = false
    let hasBESS = false
    for (const c of configs) {
      const prods = Object.values(c.productosMap).flat()
      if (prods.some(p => p.tipo === 'fv')) hasFV = true
      if (prods.some(p => p.tipo === 'bess')) hasBESS = true
    }
    const tipo = isNodoBusca ? 'FV' : hasFV && hasBESS ? 'FV+BESS' : hasFV ? 'FV' : 'BESS'

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
    const configMoneda: Moneda = isNodoBusca
      ? form.moneda
      : productCurrencies.length > 0
      ? productCurrencies[0]
      : form.moneda

    const vehiclesArray =
      isRecomendacionNodo || isNodoBusca
        ? ['no_sabe']
        : Array.from(new Set(financingOptions.map(o => o.vehiculo_inversion)))

    // Derivación limpia de atribución por portal
    const effectiveEpcId = capabilities.implicitEpc
      ? session.user.id
      : selectedEpcId || null

    const effectiveFinderId = capabilities.implicitFinder
      ? session.user.id
      : capabilities.canAssignFinder
      ? selectedFinderId || null
      : null

    const effectiveResponsableId = capabilities.canAssignResponsableNodo
      ? selectedResponsableId || null
      : null

    const finalClientNombre = clienteManual
      ? manualCliente.nombre
      : cliente?.contacto_nombre ?? ''
    const finalClientEmpresa = clienteManual
      ? manualCliente.empresa
      : cliente?.razon_social ?? ''
    const finalClientContacto = clienteManual
      ? manualCliente.contacto
      : cliente?.contacto_email ?? cliente?.contacto_telefono ?? ''

    // ── PAYLOAD UNIFICADO PARA TRANSACCIÓN ATÓMICA (RPC) ─────────
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
      cliente_final_nombre: finalClientNombre,
      cliente_final_empresa: finalClientEmpresa,
      cliente_final_contacto: finalClientContacto,
      capex_estimado: isNodoBusca ? null : firstConfigCapex,
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

    const rpcConfiguraciones = isNodoBusca
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
      : configs.map((c, idx) => {
          const cfgProds = Object.values(c.productosMap).flat()
          const inversion_total = cfgProds.reduce((sum, p) => {
            const pCapex = p.tipo === 'fv' ? parseNum(p.fv?.capex) : parseNum(p.bess?.capex)
            return sum + pCapex
          }, 0)

          const cfgCurrencies = cfgProds
            .map(p => (p.tipo === 'fv' ? p.fv?.capex_moneda : p.bess?.capex_moneda))
            .filter(Boolean) as Moneda[]
          const thisConfigMoneda =
            cfgCurrencies.length > 0 ? cfgCurrencies[0] : form.moneda

          const ahorroAnual = c.ahorro_estimado_anual ? parseNum(c.ahorro_estimado_anual) : null
          const ahorroMensual = ahorroAnual ? Math.round((ahorroAnual / 12) * 100) / 100 : null

          return {
            temp_id: c.tempId,
            nombre: c.nombre,
            descripcion: c.descripcion || null,
            inversion_total,
            moneda: thisConfigMoneda,
            ahorro_estimado_anual: ahorroAnual,
            ahorro_estimado_mensual: ahorroMensual,
            ahorro_moneda: c.ahorro_moneda || 'MXN',
            seleccionada: idx === 0,
          }
        })

    const rpcOpcionesFinanciamiento =
      isNodoBusca || isRecomendacionNodo
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
        : financingOptions.map((o, idx) => {
            const ahorroAnual = o.ahorro_estimado_anual ? parseNum(o.ahorro_estimado_anual) : null
            const ahorroMensual = ahorroAnual ? Math.round((ahorroAnual / 12) * 100) / 100 : null
            return {
              temp_id: o.tempId,
              nombre: o.nombre,
              vehiculo_inversion: o.vehiculo_inversion,
              ahorro_estimado_anual: ahorroAnual,
              ahorro_estimado_mensual: ahorroMensual,
              moneda: o.ahorro_moneda || 'MXN',
              plazo_meses: o.plazo_meses ? parseNum(o.plazo_meses) : null,
              notas: o.notas || null,
              seleccionada: idx === 0,
            }
          })

    const rpcLinks: { config_temp_id: string; opcion_temp_id: string }[] = []
    if (isNodoBusca || isRecomendacionNodo) {
      for (const rc of rpcConfiguraciones) {
        rpcLinks.push({
          config_temp_id: rc.temp_id,
          opcion_temp_id: 'recomendacion-nodo',
        })
      }
    } else {
      for (const o of financingOptions) {
        for (const configTempId of o.linkedConfigIds) {
          rpcLinks.push({
            config_temp_id: configTempId,
            opcion_temp_id: o.tempId,
          })
        }
      }
    }

    const rpcProductos: {
      config_temp_id: string
      sitio_id: string
      tipo: 'fv' | 'bess'
      datos: Record<string, unknown>
    }[] = []

    if (!isNodoBusca) {
      for (const c of configs) {
        for (const sitio_id of c.sitiosSeleccionados) {
          const products = c.productosMap[sitio_id] ?? []
          for (const p of products) {
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

    const { data: rpcProyectoId, error: rpcErr } = await supabase.rpc('crear_proyecto_completo', {
      p_payload: {
        proyecto: proyectoPayload,
        sitios_ids: todosSitios,
        configuraciones: rpcConfiguraciones,
        opciones_financiamiento: rpcOpcionesFinanciamiento,
        config_financiamiento_links: rpcLinks,
        productos: rpcProductos,
      },
    })

    if (!rpcErr && rpcProyectoId) {
      if (onSuccessRedirect) {
        router.push(onSuccessRedirect(rpcProyectoId as string))
      } else {
        router.push(`${capabilities.redirectPrefix}/${rpcProyectoId as string}`)
      }
      return
    }

    // If RPC failed with a validation/permission error (not missing function), surface it immediately and abort
    if (rpcErr && !rpcErr.message.includes('crear_proyecto_completo')) {
      setError('Error al crear el proyecto: ' + rpcErr.message)
      setLoading(false)
      return
    }

    // ── FALLBACK SECUENCIAL CON ROLLBACK COMPENSATORIO ───────────
    const { data: proyecto, error: dbErr } = await supabase
      .from('proyectos')
      .insert(proyectoPayload)
      .select('id')
      .single()

    if (dbErr) {
      setError('Error al guardar proyecto: ' + dbErr.message)
      setLoading(false)
      return
    }

    try {
      // ── TABLA 2: proyecto_sitios ─────────────────────────────────
      if (todosSitios.length > 0) {
        const { error: sitiosErr } = await supabase.from('proyecto_sitios').insert(
          todosSitios.map(sitio_id => ({
            proyecto_id: proyecto.id,
            sitio_id,
          }))
        )
        if (sitiosErr) throw sitiosErr
      }

      // ── TABLA 3: configuraciones_tecnicas ────────────────────────
      const configsToInsert = isNodoBusca
        ? [
            {
              proyecto_id: proyecto.id,
              nombre: 'Pendiente definición',
              descripcion: null,
              inversion_total: null,
              moneda: form.moneda,
              seleccionada: true,
            },
          ]
        : configs.map((c, idx) => {
            const cfgProds = Object.values(c.productosMap).flat()
            const inversion_total = cfgProds.reduce((sum, p) => {
              const pCapex = p.tipo === 'fv' ? parseNum(p.fv?.capex) : parseNum(p.bess?.capex)
              return sum + pCapex
            }, 0)

            const cfgCurrencies = cfgProds
              .map(p => (p.tipo === 'fv' ? p.fv?.capex_moneda : p.bess?.capex_moneda))
              .filter(Boolean) as Moneda[]
            const thisConfigMoneda =
              cfgCurrencies.length > 0 ? cfgCurrencies[0] : form.moneda

            const ahorroAnual = c.ahorro_estimado_anual ? parseNum(c.ahorro_estimado_anual) : null
            const ahorroMensual = ahorroAnual ? Math.round((ahorroAnual / 12) * 100) / 100 : null

            return {
              proyecto_id: proyecto.id,
              nombre: c.nombre,
              descripcion: c.descripcion || null,
              inversion_total,
              moneda: thisConfigMoneda,
              ahorro_estimado_anual: ahorroAnual,
              ahorro_estimado_mensual: ahorroMensual,
              ahorro_moneda: c.ahorro_moneda || 'MXN',
              seleccionada: idx === 0,
            }
          })

      const { data: insertedConfigs, error: configsErr } = await supabase
        .from('configuraciones_tecnicas')
        .insert(configsToInsert)
        .select('id, nombre')

      if (configsErr) throw configsErr

      // ── TABLA 4: opciones_financiamiento ─────────────────────────
      const optionsToInsert =
        isNodoBusca || isRecomendacionNodo
          ? [
              {
                proyecto_id: proyecto.id,
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
          : financingOptions.map((o, idx) => {
              const ahorroAnual = o.ahorro_estimado_anual ? parseNum(o.ahorro_estimado_anual) : null
              const ahorroMensual = ahorroAnual ? Math.round((ahorroAnual / 12) * 100) / 100 : null
              return {
                proyecto_id: proyecto.id,
                nombre: o.nombre,
                vehiculo_inversion: o.vehiculo_inversion,
                ahorro_estimado_anual: ahorroAnual,
                ahorro_estimado_mensual: ahorroMensual,
                moneda: o.ahorro_moneda || 'MXN',
                plazo_meses: o.plazo_meses ? parseNum(o.plazo_meses) : null,
                notas: o.notas || null,
                seleccionada: idx === 0,
              }
            })

      const { data: insertedOptions, error: optionsErr } = await supabase
        .from('opciones_financiamiento')
        .insert(optionsToInsert)
        .select('id, nombre, vehiculo_inversion')

      if (optionsErr) throw optionsErr

      // ── TABLA 5: config_financiamiento (n:n) ─────────────────────
      const junctionRows: { configuracion_id: string; opcion_financiamiento_id: string }[] = []

      if (isNodoBusca || isRecomendacionNodo) {
        const optId = insertedOptions?.[0]?.id
        if (optId && insertedConfigs) {
          for (const ic of insertedConfigs) {
            junctionRows.push({
              configuracion_id: ic.id,
              opcion_financiamiento_id: optId,
            })
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

            junctionRows.push({
              configuracion_id: dbConfig.id,
              opcion_financiamiento_id: dbOpt.id,
            })
          }
        }
      }

      if (junctionRows.length > 0) {
        const { error: junctionErr } = await supabase
          .from('config_financiamiento')
          .insert(junctionRows)

        if (junctionErr) throw junctionErr
      }

      // ── TABLA 6: proyecto_sitio_productos ────────────────────────
      if (!isNodoBusca) {
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
            const products = c.productosMap[sitio_id] ?? []
            for (const p of products) {
              productosRows.push({
                proyecto_id: proyecto.id,
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

      // Redirección exitosa
      if (onSuccessRedirect) {
        router.push(onSuccessRedirect(proyecto.id))
      } else {
        router.push(`${capabilities.redirectPrefix}/${proyecto.id}`)
      }
    } catch (fallbackErr: unknown) {
      // Compensating delete rollback on failure:
      // Delete child junction records in `proyecto_sitios` before `proyectos`
      // because `proyecto_sitios` lacks ON DELETE CASCADE in the live schema.
      try {
        await supabase.from('proyecto_sitios').delete().eq('proyecto_id', proyecto.id)
      } catch (cleanupErr) {
        console.warn('Error cleaning up proyecto_sitios during rollback:', cleanupErr)
      }
      await supabase.from('proyectos').delete().eq('id', proyecto.id)

      const msg =
        fallbackErr &&
        typeof fallbackErr === 'object' &&
        'message' in fallbackErr &&
        typeof (fallbackErr as { message: unknown }).message === 'string'
          ? (fallbackErr as { message: string }).message
          : fallbackErr instanceof Error
            ? fallbackErr.message
            : String(fallbackErr)
      setError('Error al guardar componentes del proyecto: ' + msg)
      setLoading(false)
      return
    }
  }

  const isNodoBusca = form.tipo_instalacion === 'nodo_busca'
  const anyHighDemanda = (selectedSiteIds.length > 0 ? selectedSiteIds : activeConfig.sitiosSeleccionados).some(
    id => (sitiosCliente.find(s => s.id === id)?.demanda_contratada_kw ?? 0) > 1000
  )

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

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black">{title}</h1>
        <p className="text-sm mt-1 text-muted">
          {isNodoBusca
            ? 'Completa los 2 pasos para crear el proyecto / Complete 2 steps'
            : 'Completa los 4 pasos para crear el proyecto / Complete 4 steps'}
        </p>
      </div>

      <StepIndicator
        steps={
          isNodoBusca
            ? ['Información básica / Basic info', 'Sitios / Sites']
            : [
                'Información básica / Basic info',
                'Sitios / Sites',
                'Alternativas / Alternatives',
                'Financiamiento / Financing',
              ]
        }
        current={step}
      />

      <div className="rounded-2xl border border-borde p-8 shadow-sm bg-white mt-6">
        {step === 0 && (
          <Step0GeneralInfo
            capabilities={capabilities}
            form={form}
            setF={setF}
            epcList={epcList}
            nodoUsers={nodoUsers}
            finderList={finderList}
            selectedEpcId={selectedEpcId}
            handleSelectEpc={handleSelectEpc}
            selectedResponsableId={selectedResponsableId}
            setSelectedResponsableId={setSelectedResponsableId}
            selectedFinderId={selectedFinderId}
            setSelectedFinderId={setSelectedFinderId}
            clienteManual={clienteManual}
            setClienteManual={setClienteManual}
            manualCliente={manualCliente}
            setManualCliente={setManualCliente}
            clientes={clientes}
            clientesCargados={clientesCargados}
            seleccionarCliente={seleccionarCliente}
            onInviteEpcSuccess={handleReloadEpcList}
          />
        )}

        {step === 1 && (
          <Step1Sites
            sitiosCliente={sitiosCliente}
            selectedSiteIds={selectedSiteIds}
            toggleSitio={toggleSitio}
            mostrarNuevoSitio={mostrarNuevoSitio}
            setMostrarNuevoSitio={setMostrarNuevoSitio}
            nuevoSitio={nuevoSitio}
            setNuevoSitio={setNuevoSitio}
            sitioError={sitioError}
            guardandoSitio={guardandoSitio}
            reciboUrlNuevo={reciboUrlNuevo}
            subiendoPdfNuevo={subiendoPdfNuevo}
            subirPdfNuevo={subirPdfNuevo}
            guardarNuevoSitio={guardarNuevoSitio}
            viendoSitioId={viendoSitioId}
            setViendoSitioId={setViendoSitioId}
            editandoSitioId={editandoSitioId}
            abrirEditarSitio={abrirEditarSitio}
            setEditandoSitioId={setEditandoSitioId}
            editSitioForm={editSitioForm}
            setEditSitioForm={setEditSitioForm}
            editSitioReciboUrl={editSitioReciboUrl}
            subiendoPdfEdit={subiendoPdfEdit}
            subirPdfEdit={subirPdfEdit}
            guardandoEditSitio={guardandoEditSitio}
            actualizarSitio={actualizarSitio}
            deletingSitioId={deletingSitioId}
            setDeletingSitioId={setDeletingSitioId}
            eliminarSitio={eliminarSitio}
            fileRefNuevo={fileRefNuevo}
            fileRefEdit={fileRefEdit}
            onOpenNuevoSitio={() => {
              setMostrarNuevoSitio(true)
              setSitioError('')
              setViendoSitioId(null)
              setEditandoSitioId(null)
              setAddingToSitioId(null)
            }}
          />
        )}

        {step === 2 && !isNodoBusca && (
          <Step2TechnicalConfigs
            configs={configs}
            setConfigs={setConfigs}
            activeConfigId={activeConfigId}
            setActiveConfigId={setActiveConfigId}
            selectedSiteIds={selectedSiteIds}
            sitiosCliente={sitiosCliente}
            activeConfig={activeConfig}
            addingToSitioId={addingToSitioId}
            setAddingToSitioId={setAddingToSitioId}
            productTipo={productTipo}
            setProductTipo={setProductTipo}
            fvForm={fvForm}
            setFvForm={setFvForm}
            bessForm={bessForm}
            setBessForm={setBessForm}
            addProductError={addProductError}
            guardarProducto={guardarProducto}
            removeProduct={removeProduct}
            activeConfigCapex={activeConfigCapex}
            activeConfigMoneda={activeConfigMoneda}
            startAddingProduct={startAddingProduct}
          />
        )}

        {step === 3 && !isNodoBusca && (
          <Step3Financing
            anyHighDemanda={anyHighDemanda}
            form={form}
            setF={setF}
            financingOptions={financingOptions}
            setFinancingOptions={setFinancingOptions}
            toggleVehiculo={toggleVehiculo}
            configs={configs}
            foldedCharacteristics={foldedCharacteristics}
            setFoldedCharacteristics={setFoldedCharacteristics}
          />
        )}

        {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

        {/* Botones de navegación */}
        <div className="flex justify-between mt-10">
          <button
            type="button"
            onClick={() => {
              setError('')
              setStep(s => s - 1)
            }}
            disabled={step === 0}
            className="px-5 py-2.5 text-sm font-medium border border-borde rounded-lg hover:bg-gray-50 transition-all disabled:opacity-30"
          >
            Anterior
          </button>
          {step < (isNodoBusca ? 1 : 3) ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2.5 text-sm font-semibold rounded-xl shadow-sm hover:shadow-md transition-all active:scale-[0.98] bg-acento text-principal"
            >
              Siguiente / Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2.5 text-sm font-semibold rounded-xl shadow-sm hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-50 hover:bg-slate-900"
              style={{ backgroundColor: 'var(--color-principal)', color: 'var(--color-acento)' }}
            >
              {loading ? 'Enviando... / Submitting...' : 'Enviar proyecto / Submit project'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
