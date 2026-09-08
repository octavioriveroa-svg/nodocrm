'use client'

import { useState, useEffect, useRef } from 'react'
import StepIndicator from '@/components/ui/StepIndicator'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Eye, Pencil, Trash2, Upload, FileText, Zap, Battery, Wrench, HelpCircle } from 'lucide-react'
import type { Moneda, ModalidadFinanciamiento, Cliente, Sitio, Profile } from '@/lib/types'
import { parseNum, formatNumberInput, fmtNum, fmtCurrency } from '@/lib/format'

const ESTADOS_MX = [
  'Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas','Chihuahua',
  'Ciudad de México','Coahuila','Colima','Durango','Estado de México','Guanajuato','Guerrero',
  'Hidalgo','Jalisco','Michoacán','Morelos','Nayarit','Nuevo León','Oaxaca','Puebla','Querétaro',
  'Quintana Roo','San Luis Potosí','Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala',
  'Veracruz','Yucatán','Zacatecas',
]

// ── Tipos locales ──────────────────────────────────────────────
interface FVForm {
  num_modulos: string
  potencia_modulos_w: string
  marca_modulos: string
  num_inversores: string
  potencia_inversores_kw: string
  marca_inversores: string
  generacion_anual_kwh: string
  capex: string
  capex_moneda: Moneda
}

interface BESSForm {
  potencia_kw: string
  capacidad_kwh: string
  marca: string
  uso: string
  capex: string
  capex_moneda: Moneda
  inversores_hibridos: boolean
}

interface Producto {
  tempId: string
  tipo: 'fv' | 'bess'
  fv?: FVForm
  bess?: BESSForm
}

interface FormData {
  nombre_proyecto: string
  cliente_id: string
  tipo_instalacion: 'nodo_busca' | 'epcista_instala' | ''
  modalidad_financiamiento: ModalidadFinanciamiento[]
  capex_estimado: string
  moneda: Moneda
  notas_adicionales: string
  incluye_mem: boolean
}

interface CreationConfig {
  tempId: string
  nombre: string
  descripcion: string
  sitiosSeleccionados: string[]
  productosMap: Record<string, Producto[]>
  ahorro_estimado_anual: string
  ahorro_moneda: Moneda
}

interface CreationFinancingOption {
  tempId: string
  nombre: string
  vehiculo_inversion: string
  ahorro_estimado_anual: string
  ahorro_moneda: Moneda
  plazo_meses: string
  notas: string
  linkedConfigIds: string[]
}

// ── Valores vacíos ─────────────────────────────────────────────
const inp = "w-full rounded-lg border border-borde px-4 py-2.5 text-sm bg-white focus:border-acento focus:ring-2 focus:ring-acento/30 transition-all";
const borde = {};

const emptyFv: FVForm = {
  num_modulos: '', potencia_modulos_w: '', marca_modulos: '',
  num_inversores: '', potencia_inversores_kw: '', marca_inversores: '',
  generacion_anual_kwh: '', capex: '', capex_moneda: 'USD',
}
const emptyBess: BESSForm = { potencia_kw: '', capacidad_kwh: '', marca: '', uso: '', capex: '', capex_moneda: 'USD', inversores_hibridos: false }
const emptyNuevoSitio = { nombre: '', nombre_recibo: '', ciudad: '', ubicacion_estado: '', rpu: '', demanda_contratada_kw: '' }
const initialForm: FormData = {
  nombre_proyecto: '', cliente_id: '', tipo_instalacion: '',
  modalidad_financiamiento: [], capex_estimado: '', moneda: 'MXN',
  notas_adicionales: '', incluye_mem: false,
}

// ── Helpers de cálculo ────────────────────────────────────────
function calcFV(fv: FVForm) {
  const n = parseNum(fv.num_modulos)
  const pw = parseNum(fv.potencia_modulos_w)
  const ni = parseNum(fv.num_inversores)
  const pi = parseNum(fv.potencia_inversores_kw)
  const capex = parseNum(fv.capex)
  return {
    kwpSistema: n > 0 && pw > 0 ? n * pw / 1000 : null,
    kwpInversores: ni > 0 && pi > 0 ? ni * pi : null,
    precioWatt: capex > 0 && n > 0 && pw > 0 ? capex / (n * pw) : null,
  }
}

function calcBESS(bess: BESSForm) {
  const cap = parseNum(bess.capacidad_kwh)
  const capex = parseNum(bess.capex)
  return { precioKwh: capex > 0 && cap > 0 ? capex / cap : null }
}

function n2(v: number | null, dec = 2) {
  if (v === null) return '—'
  return fmtNum(v, dec)
}


function ProductoCard({ p, onRemove, hasHybridBess }: { p: Producto; onRemove: () => void; hasHybridBess?: boolean }) {
  if (p.tipo === 'fv' && p.fv) {
    const { kwpSistema, kwpInversores, precioWatt } = calcFV(p.fv)
    const isCoveredByHybrid = hasHybridBess && (!p.fv.num_inversores || parseNum(p.fv.num_inversores) === 0)
    return (
      <div className="border p-3 text-xs border-borde rounded-xl bg-white/60">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 font-bold text-sm mb-2">
            <Zap size={13} className="text-muted" />
            Fotovoltaico
          </div>
          <button type="button" onClick={onRemove} className="p-0.5 flex-shrink-0 text-muted">
            <X size={13} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1" style={{ color: 'var(--color-texto-suave)' }}>
          <span><span className="text-muted">Módulos: </span>{p.fv.num_modulos} × {p.fv.potencia_modulos_w} W · {p.fv.marca_modulos}</span>
          <span><span className="text-muted">kWp sistema: </span>{n2(kwpSistema, 1)} kWp</span>
          {isCoveredByHybrid ? (
            <span className="col-span-2 text-blue-600 font-medium">
              <span className="text-muted">Inversores: </span>Cubiertos por BESS híbrido
            </span>
          ) : (
            <>
              <span><span className="text-muted">Inversores: </span>{p.fv.num_inversores} × {p.fv.potencia_inversores_kw} kW · {p.fv.marca_inversores}</span>
              <span><span className="text-muted">kWp inversores: </span>{n2(kwpInversores, 1)} kW</span>
            </>
          )}
          <span><span className="text-muted">Generación: </span>{fmtNum(parseNum(p.fv.generacion_anual_kwh))} kWh/año</span>
          <span><span className="text-muted">CAPEX: </span>{fmtCurrency(parseNum(p.fv.capex), p.fv.capex_moneda || 'USD')}</span>
          <span className="col-span-2"><span className="text-muted">Precio/Wp: </span>${n2(precioWatt, 4)}/W</span>
        </div>
      </div>
    )
  }
  if (p.tipo === 'bess' && p.bess) {
    const { precioKwh } = calcBESS(p.bess)
    const usoLabel: Record<string, string> = {
      load_shifting: 'Load Shifting',
      ups: 'UPS',
      load_shifting_ups: 'Load Shifting + UPS',
    }
    return (
      <div className="border p-3 text-xs border-borde rounded-xl bg-white/60">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 font-bold text-sm mb-2">
            <Battery size={13} className="text-muted" />
            BESS
            {p.bess.inversores_hibridos && (
              <span className="text-[10px] font-bold uppercase bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full ml-1">
                Híbrido
              </span>
            )}
          </div>
          <button type="button" onClick={onRemove} className="p-0.5 flex-shrink-0 text-muted">
            <X size={13} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1" style={{ color: 'var(--color-texto-suave)' }}>
          <span><span className="text-muted">Potencia: </span>{p.bess.potencia_kw} kW</span>
          <span><span className="text-muted">Capacidad: </span>{p.bess.capacidad_kwh} kWh</span>
          <span><span className="text-muted">Marca: </span>{p.bess.marca}</span>
          <span><span className="text-muted">Uso: </span>{usoLabel[p.bess.uso] ?? p.bess.uso}</span>
          <span><span className="text-muted">CAPEX: </span>{fmtCurrency(parseNum(p.bess.capex), p.bess.capex_moneda || 'USD')}</span>
          <span><span className="text-muted">Precio/kWh: </span>${n2(precioKwh, 2)}/kWh</span>
        </div>
      </div>
    )
  }
  return null
}

// ── Campo calculado (display) ─────────────────────────────────
function CalcField({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div className="border px-3 py-2 text-xs border-borde rounded-xl bg-fondo">
      <div className="text-muted">{label}</div>
      <div className="font-bold text-sm mt-0.5">
        {value !== null ? `${n2(value, 4)} ${unit}` : '—'}
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────
// ── Esquemas de financiamiento predefinidos (Bilingüe) ───────
const VEHICULOS_FINANCIAMIENTO: {
  id: ModalidadFinanciamiento
  nombreEs: string
  nombreEn: string
  descEs: string
  descEn: string
}[] = [
  {
    id: 'credito',
    nombreEs: 'Crédito Bancario',
    nombreEn: 'Debt Financing / Bank Loan',
    descEs: 'Financiamiento mediante crédito tradicional o bancario.',
    descEn: 'Funding through traditional bank or credit loan.',
  },
  {
    id: 'arrendamiento',
    nombreEs: 'Arrendamiento Puro / Financiero',
    nombreEn: 'Lease Financing (Operating / Capital)',
    descEs: 'Esquema de arrendamiento con opción a compra o deducción fiscal.',
    descEn: 'Lease structure with purchase option or tax deduction.',
  },
  {
    id: 'ensaas',
    nombreEs: 'EnSaaS / PPA (Energía como Servicio)',
    nombreEn: 'EnSaaS / PPA (Energy as a Service)',
    descEs: 'Venta de energía generada o tarifa por servicio sin desembolso inicial de CAPEX.',
    descEn: 'Pay-per-kWh or service fee model with zero initial CAPEX outlay.',
  },
  {
    id: 'mem',
    nombreEs: 'Mercado Eléctrico Mayorista (MEM)',
    nombreEn: 'Wholesale Electricity Market (MEM)',
    descEs: 'Participación y suministro calificado en el MEM.',
    descEn: 'Qualified supplier participation in the wholesale electricity market.',
  },
  {
    id: 'no_sabe',
    nombreEs: 'Recomendación de Nodo',
    nombreEn: 'Nodo Recommendation',
    descEs: 'Nodo analizará el proyecto y recomendará el vehículo óptimo.',
    descEn: 'Nodo will evaluate the project and recommend the optimal structure.',
  },
]

export default function NuevoProyectoPage() {
   
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormData>(initialForm)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sitioError, setSitioError] = useState('')

  // Clientes, sitios y finders
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clientesCargados, setClientesCargados] = useState(false)
  const [sitiosCliente, setSitiosCliente] = useState<Sitio[]>([])
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([])
  const [finderList, setFinderList] = useState<Profile[]>([])
  const [selectedFinderId, setSelectedFinderId] = useState('')

  // Alternative Technical Configurations
  const [configs, setConfigs] = useState<CreationConfig[]>([
    {
      tempId: 'default',
      nombre: 'Alternativa A',
      descripcion: '',
      sitiosSeleccionados: [],
      productosMap: {},
      ahorro_estimado_anual: '',
      ahorro_moneda: 'MXN',
    }
  ])
  const [activeConfigId, setActiveConfigId] = useState<string>('default')

  const [financingOptions, setFinancingOptions] = useState<CreationFinancingOption[]>([
    {
      tempId: 'fin-credito',
      nombre: 'Crédito Bancario / Debt Financing',
      vehiculo_inversion: 'credito',
      ahorro_estimado_anual: '',
      ahorro_moneda: 'MXN',
      plazo_meses: '',
      notas: '',
      linkedConfigIds: ['default']
    }
  ])
  const [isRecomendacionNodo, setIsRecomendacionNodo] = useState(false)
  const [foldedCharacteristics, setFoldedCharacteristics] = useState<Record<string, boolean>>({})

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
          linkedConfigIds: configs.map(c => c.tempId)
        }
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
          linkedConfigIds: configs.map(c => c.tempId)
        }
        return [...filtered, newOption]
      }
    })
  }

  const activeConfig = configs.find(c => c.tempId === activeConfigId) || configs[0]
  const isNodoBusca = form.tipo_instalacion === 'nodo_busca'
  const sitiosSeleccionados = activeConfig.sitiosSeleccionados
  const productosMap = activeConfig.productosMap

  const setSitiosSeleccionados = (updateFnOrVal: string[] | ((prev: string[]) => string[])) => {
    setConfigs(prevConfigs => prevConfigs.map(c => {
      if (c.tempId === activeConfigId) {
        const nextVal = typeof updateFnOrVal === 'function' ? updateFnOrVal(c.sitiosSeleccionados) : updateFnOrVal
        return { ...c, sitiosSeleccionados: nextVal }
      }
      return c
    }))
  }

  const setProductosMap = (updateFnOrVal: Record<string, Producto[]> | ((prev: Record<string, Producto[]>) => Record<string, Producto[]>)) => {
    setConfigs(prevConfigs => prevConfigs.map(c => {
      if (c.tempId === activeConfigId) {
        const nextMap = typeof updateFnOrVal === 'function' ? updateFnOrVal(c.productosMap) : updateFnOrVal
        return { ...c, productosMap: nextMap }
      }
      return c
    }))
  }
  const [addingToSitioId, setAddingToSitioId] = useState<string | null>(null)
  const [productTipo, setProductTipo] = useState<'fv' | 'bess' | null>(null)
  const [fvForm, setFvForm] = useState<FVForm>(emptyFv)
  const [bessForm, setBessForm] = useState<BESSForm>(emptyBess)
  const [addProductError, setAddProductError] = useState('')

  // Inline nuevo sitio
  const [mostrarNuevoSitio, setMostrarNuevoSitio] = useState(false)
  const [nuevoSitio, setNuevoSitio] = useState(emptyNuevoSitio)
  const [guardandoSitio, setGuardandoSitio] = useState(false)
  const [reciboUrlNuevo, setReciboUrlNuevo] = useState<string | null>(null)
  const [subiendoPdfNuevo, setSubiendoPdfNuevo] = useState(false)
  const fileRefNuevo = useRef<HTMLInputElement>(null)

  // Ver / editar / eliminar sitios
  const [viendoSitioId, setViendoSitioId] = useState<string | null>(null)
  const [editandoSitioId, setEditandoSitioId] = useState<string | null>(null)
  const [deletingSitioId, setDeletingSitioId] = useState<string | null>(null)
  const [editSitioForm, setEditSitioForm] = useState(emptyNuevoSitio)
  const [editSitioReciboUrl, setEditSitioReciboUrl] = useState<string | null>(null)
  const [subiendoPdfEdit, setSubiendoPdfEdit] = useState(false)
  const [guardandoEditSitio, setGuardandoEditSitio] = useState(false)
  const fileRefEdit = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { setClientesCargados(true); return }
      const { data } = await supabase.from('clientes').select('*').eq('epcista_id', session.user.id).order('razon_social')
      setClientes((data ?? []) as Cliente[])
      setClientesCargados(true)
      const { data: finders } = await supabase.from('profiles').select('*').eq('rol', 'finder').order('nombre')
      setFinderList((finders ?? []) as Profile[])
    }
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function cargarSitios(clienteId: string) {
    if (!clienteId) {
      setSitiosCliente([])
      setConfigs([{ tempId: 'default', nombre: 'Alternativa A', descripcion: '', sitiosSeleccionados: [], productosMap: {}, ahorro_estimado_anual: '', ahorro_moneda: 'MXN' as Moneda }])
      setActiveConfigId('default')
      setFinancingOptions([{ tempId: 'fin-default', nombre: 'Financiamiento 1', vehiculo_inversion: 'credito', ahorro_estimado_anual: '', ahorro_moneda: 'MXN', plazo_meses: '', notas: '', linkedConfigIds: ['default'] }])
      setIsRecomendacionNodo(false)
      return
    }
    const { data } = await supabase.from('sitios').select('*').eq('cliente_id', clienteId).order('nombre')
    setSitiosCliente((data ?? []) as Sitio[])
    setConfigs([{ tempId: 'default', nombre: 'Alternativa A', descripcion: '', sitiosSeleccionados: [], productosMap: {}, ahorro_estimado_anual: '', ahorro_moneda: 'MXN' as Moneda }])
    setActiveConfigId('default')
    setFinancingOptions([{ tempId: 'fin-default', nombre: 'Financiamiento 1', vehiculo_inversion: 'credito', ahorro_estimado_anual: '', ahorro_moneda: 'MXN', plazo_meses: '', notas: '', linkedConfigIds: ['default'] }])
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
      const next = prev.includes(sitioId) ? prev.filter(id => id !== sitioId) : [...prev, sitioId]
      setConfigs(prevConfigs => prevConfigs.map(c => ({
        ...c,
        sitiosSeleccionados: next,
        productosMap: Object.fromEntries(next.map(sId => [sId, c.productosMap[sId] || []]))
      })))
      return next
    })
    // Cerrar el form de producto si se está agregando a este sitio
    if (addingToSitioId === sitioId) setAddingToSitioId(null)
  }

  // ── Productos ────────────────────────────────────────────────
  function startAddingProduct(sitioId: string) {
    setAddingToSitioId(sitioId)
    setProductTipo(null)
    setFvForm(emptyFv)
    setBessForm(emptyBess)
    setAddProductError('')
    setViendoSitioId(null)
    setEditandoSitioId(null)
  }

  function validarFvForm(): string {
    if (!fvForm.num_modulos || !fvForm.potencia_modulos_w) return 'Ingresa número y potencia de módulos.'
    if (!fvForm.num_inversores || !fvForm.potencia_inversores_kw) {
      const siteProducts = productosMap[addingToSitioId || ''] ?? []
      const hasHybridBessOnSite = siteProducts.some(p => p.tipo === 'bess' && p.bess?.inversores_hibridos)
      if (!hasHybridBessOnSite) {
        return 'Ingresa número y potencia de inversores.'
      }
    }
    return ''
  }

  function validarBessForm(): string {
    if (!bessForm.potencia_kw || !bessForm.capacidad_kwh) return 'Ingresa potencia y capacidad del BESS.'
    return ''
  }

  function addProduct() {
    if (!addingToSitioId || !productTipo) return
    const err = productTipo === 'fv' ? validarFvForm() : validarBessForm()
    if (err) { setAddProductError(err); return }

    const producto: Producto = {
      tempId: `${Date.now()}-${Math.random()}`,
      tipo: productTipo,
      ...(productTipo === 'fv' ? { fv: { ...fvForm } } : { bess: { ...bessForm } }),
    }
    setProductosMap(prev => ({
      ...prev,
      [addingToSitioId]: [...(prev[addingToSitioId] ?? []), producto],
    }))
    setAddingToSitioId(null)
    setAddProductError('')
  }

  function guardarProducto(_sId?: string) {
    addProduct()
  }

  function removeProduct(sitioId: string, tempId: string) {
    setProductosMap(prev => ({
      ...prev,
      [sitioId]: (prev[sitioId] ?? []).filter(p => p.tempId !== tempId),
    }))
  }

  // ── Sitios inline ────────────────────────────────────────────
  async function subirPdfNuevo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendoPdfNuevo(true)
    setSitioError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { setSitioError('Sesión expirada. Recarga la página.'); setSubiendoPdfNuevo(false); return }
      const effectiveClientId = form.cliente_id || 'temp-client'
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${session.user.id}/${effectiveClientId}/${Date.now()}_${cleanFileName}`
      const { error: uploadErr } = await supabase.storage.from('recibos-cfe').upload(path, file, {
        cacheControl: '3600',
        upsert: true
      })
      if (uploadErr) {
        console.error('Upload error:', uploadErr)
        setSitioError(`Error al subir recibo: ${uploadErr.message}`)
      } else {
        const { data: { publicUrl } } = supabase.storage.from('recibos-cfe').getPublicUrl(path)
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
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { setSubiendoPdfEdit(false); return }
      const effectiveClientId = form.cliente_id || 'temp-client'
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${session.user.id}/${effectiveClientId}/${Date.now()}_${cleanFileName}`
      const { error: uploadErr } = await supabase.storage.from('recibos-cfe').upload(path, file, {
        cacheControl: '3600',
        upsert: true
      })
      if (uploadErr) {
        console.error('Upload error:', uploadErr)
        setSitioError(`Error al subir recibo: ${uploadErr.message}`)
      } else {
        const { data: { publicUrl } } = supabase.storage.from('recibos-cfe').getPublicUrl(path)
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
    if (!nuevoSitio.nombre.trim() || !form.cliente_id) return
    setSitioError('')
    setGuardandoSitio(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setSitioError('Sesión expirada. Recarga la página.'); setGuardandoSitio(false); return }
    const { data, error: insertErr } = await supabase.from('sitios').insert({
      cliente_id: form.cliente_id, epcista_id: session.user.id,
      nombre: nuevoSitio.nombre, nombre_recibo: nuevoSitio.nombre_recibo || null,
      ciudad: nuevoSitio.ciudad || null, ubicacion_estado: nuevoSitio.ubicacion_estado || null,
      rpu: nuevoSitio.rpu || null,
      demanda_contratada_kw: nuevoSitio.demanda_contratada_kw ? Number(nuevoSitio.demanda_contratada_kw) : null,
      recibo_url: reciboUrlNuevo,
    }).select().single()
    if (insertErr) {
      setSitioError('Error al guardar el sitio: ' + insertErr.message)
      setGuardandoSitio(false)
      return
    }
    if (data) {
      const sitio = data as Sitio
      setSitiosCliente(prev => [...prev, sitio])
      // Don't auto-select — let the user choose which sites to include
    }
    setNuevoSitio(emptyNuevoSitio)
    setReciboUrlNuevo(null)
    setMostrarNuevoSitio(false)
    setGuardandoSitio(false)
  }

  async function actualizarSitio() {
    if (!editandoSitioId || !editSitioForm.nombre.trim()) return
    setGuardandoEditSitio(true)
    const { data } = await supabase.from('sitios').update({
      nombre: editSitioForm.nombre, nombre_recibo: editSitioForm.nombre_recibo || null,
      ciudad: editSitioForm.ciudad || null, ubicacion_estado: editSitioForm.ubicacion_estado || null,
      rpu: editSitioForm.rpu || null,
      demanda_contratada_kw: editSitioForm.demanda_contratada_kw ? Number(editSitioForm.demanda_contratada_kw) : null,
      recibo_url: editSitioReciboUrl,
    }).eq('id', editandoSitioId).select().single()
    if (data) setSitiosCliente(prev => prev.map(s => s.id === editandoSitioId ? data as Sitio : s))
    setEditandoSitioId(null)
    setEditSitioForm(emptyNuevoSitio)
    setEditSitioReciboUrl(null)
    setGuardandoEditSitio(false)
  }

  function abrirEditarSitio(s: Sitio) {
    setEditandoSitioId(editandoSitioId === s.id ? null : s.id)
    setEditSitioForm({
      nombre: s.nombre, nombre_recibo: s.nombre_recibo ?? '',
      ciudad: s.ciudad ?? '', ubicacion_estado: s.ubicacion_estado ?? '',
      rpu: s.rpu ?? '', demanda_contratada_kw: s.demanda_contratada_kw?.toString() ?? '',
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
    setConfigs(prevConfigs => prevConfigs.map(c => ({
      ...c,
      sitiosSeleccionados: c.sitiosSeleccionados.filter(sid => sid !== id),
      productosMap: Object.fromEntries(Object.entries(c.productosMap).filter(([sId]) => sId !== id))
    })))
    setDeletingSitioId(null)
  }

  // ── Form helpers ─────────────────────────────────────────────
  function setF(field: keyof FormData, value: unknown) {
    setForm(prev => ({ ...prev, [field]: value }))
  }


  // ── Validaciones ─────────────────────────────────────────────
  function validarPaso0() {
    if (!form.nombre_proyecto.trim()) return 'Ingresa el nombre del proyecto.'
    if (!form.cliente_id) return 'Selecciona un cliente.'
    if (!form.tipo_instalacion) return 'Selecciona el tipo de instalación.'
    return ''
  }

  function validarPaso1() {
    if (selectedSiteIds.length === 0) {
      return 'Debes seleccionar al menos un sitio para el proyecto / You must select at least one site for the project.'
    }
    return ''
  }

  function validarConfig(c: CreationConfig, idx: number): string {
    if (!c.nombre.trim()) return `La alternativa ${idx + 1} debe tener un nombre / Alternative ${idx + 1} must have a name.`
    const prods = Object.values(c.productosMap).flat()
    if (prods.length === 0) {
      return `La alternativa "${c.nombre}" debe tener al menos un producto (FV o BESS) / Alternative "${c.nombre}" must have at least one product (PV or BESS).`
    }
    return ''
  }

  function validarPaso2() {
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

  function validarPaso3() {
    if (isRecomendacionNodo) return ''
    if (financingOptions.length === 0) return 'Selecciona al menos una opción de financiamiento / Select at least one financing option.'
    
    for (let i = 0; i < financingOptions.length; i++) {
      const opt = financingOptions[i]
      if (!opt.nombre.trim()) return `La opción de financiamiento ${i + 1} debe tener un nombre / Option ${i + 1} must have a name.`
      if (!opt.vehiculo_inversion) return `La opción de financiamiento "${opt.nombre}" debe tener un vehículo de inversión / Option "${opt.nombre}" must have an investment vehicle.`
      if (opt.linkedConfigIds.length === 0) {
        return `La opción "${opt.nombre}" debe estar vinculada a al menos una alternativa técnica / Option "${opt.nombre}" must be linked to at least one technical alternative.`
      }
    }
    return ''
  }

  function handleNext() {
    setError('')
    if (step === 0) {
      const err = validarPaso0()
      if (err) { setError(err); return }
    } else if (step === 1) {
      const err = validarPaso1()
      if (err) { setError(err); return }
      if (form.tipo_instalacion === 'nodo_busca') {
        handleSubmit()
        return
      }
      setConfigs(prev => prev.map(c => ({
        ...c,
        sitiosSeleccionados: selectedSiteIds,
        productosMap: Object.fromEntries(selectedSiteIds.map(sId => [sId, c.productosMap[sId] || []]))
      })))
    } else if (step === 2) {
      const err = validarPaso3()
      if (err) { setError(err); return }
      setFinancingOptions(prev => prev.map(o => ({
        ...o,
        linkedConfigIds: o.linkedConfigIds.length > 0
          ? o.linkedConfigIds.filter(id => configs.some(c => c.tempId === id))
          : configs.map(c => c.tempId)
      })))
    }
    setStep(s => s + 1)
  }

  // ── Submit ───────────────────────────────────────────────────
  async function handleSubmit() {
    setError('')
    if (!isNodoBusca) {
      const err = validarPaso3()
      if (err) { setError(err); return }
    }
    setLoading(true)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setError('Sesión expirada.'); setLoading(false); return }

    const cliente = clientes.find(c => c.id === form.cliente_id)
    
    let hasFV = false
    let hasBESS = false
    for (const c of configs) {
      const prods = Object.values(c.productosMap).flat()
      if (prods.some(p => p.tipo === 'fv')) hasFV = true
      if (prods.some(p => p.tipo === 'bess')) hasBESS = true
    }
    const tipo = isNodoBusca ? 'FV' : (hasFV && hasBESS ? 'FV+BESS' : hasFV ? 'FV' : 'BESS')

    const primerSitioId = configs[0]?.sitiosSeleccionados[0]
    const ubicacion_estado = sitiosCliente.find(s => s.id === primerSitioId)?.ubicacion_estado ?? ''

    const firstConfigProducts = Object.values(configs[0]?.productosMap ?? {}).flat()
    const firstConfigCapex = firstConfigProducts.reduce((sum, p) => {
      const pCapex = p.tipo === 'fv' ? parseNum(p.fv?.capex) : parseNum(p.bess?.capex)
      return sum + pCapex
    }, 0)

    // Derive currency from products
    const allFirstProds = Object.values(configs[0]?.productosMap ?? {}).flat()
    const firstProdCurrencies = allFirstProds.map(p => p.tipo === 'fv' ? p.fv?.capex_moneda : p.bess?.capex_moneda).filter(Boolean)
    const projectMoneda: Moneda = (firstProdCurrencies.length > 0 ? firstProdCurrencies[0] : 'USD') as Moneda

    const vehiclesArray = (isRecomendacionNodo || isNodoBusca)
      ? ['no_sabe'] 
      : Array.from(new Set(financingOptions.map(o => o.vehiculo_inversion)))

    const payload = {
      epcista_id: session.user.id,
      finder_id: selectedFinderId || null,
      cliente_id: form.cliente_id,
      tipo,
      nombre_proyecto: form.nombre_proyecto,
      estado: 'recibido',
      tipo_instalacion: form.tipo_instalacion,
      incluye_mem: form.incluye_mem,
      demanda_kw: null,
      cliente_final_nombre: cliente?.contacto_nombre ?? '',
      cliente_final_empresa: cliente?.razon_social ?? '',
      cliente_final_contacto: cliente?.contacto_email ?? cliente?.contacto_telefono ?? '',
      capex_estimado: isNodoBusca ? null : firstConfigCapex,
      moneda: projectMoneda,
      ubicacion_estado,
      modalidad_financiamiento: vehiclesArray as ModalidadFinanciamiento[],
      notas_adicionales: form.notas_adicionales || null,
      capacidad_mwh: null, capacidad_mw: null, tecnologia_bateria: null,
      duracion_descarga_hrs: null, punto_interconexion: null,
      tipo_participacion_mem: null, volumen_energia_mwh_anual: null,
    }

    const { data: proyecto, error: dbErr } = await supabase.from('proyectos').insert(payload).select('id').single()
    if (dbErr) { setError('Error al guardar: ' + dbErr.message); setLoading(false); return }

    const todosSitios = selectedSiteIds.length > 0 ? selectedSiteIds : Array.from(new Set(configs.flatMap(c => c.sitiosSeleccionados)))
    if (todosSitios.length > 0) {
      const { error: sitiosErr } = await supabase.from('proyecto_sitios').insert(
        todosSitios.map(sitio_id => ({ proyecto_id: proyecto.id, sitio_id }))
      )
      if (sitiosErr) { setError('Error al vincular sitios: ' + sitiosErr.message); setLoading(false); return }
    }

    if (isNodoBusca) {
      // Create single default config and financing option for Nodo busca
      const { data: insertedConfigs, error: configsErr } = await supabase
        .from('configuraciones_tecnicas')
        .insert([{
          proyecto_id: proyecto.id,
          nombre: 'Pendiente definición',
          descripcion: 'Nodo definirá la solución técnica óptima',
          inversion_total: null,
          moneda: 'USD',
          ahorro_estimado_mensual: null,
          ahorro_moneda: 'MXN',
          seleccionada: true,
        }])
        .select('id, nombre')

      if (configsErr) {
        setError('Error al guardar configuración: ' + configsErr.message)
        setLoading(false)
        return
      }

      const { data: insertedOptions, error: optionsErr } = await supabase
        .from('opciones_financiamiento')
        .insert([{
          proyecto_id: proyecto.id,
          nombre: 'Recomendación de Nodo',
          vehiculo_inversion: 'no_sabe',
          ahorro_estimado_mensual: null,
          moneda: 'MXN',
          plazo_meses: null,
          notas: null,
          seleccionada: true
        }])
        .select('id, nombre, vehiculo_inversion')

      if (optionsErr) {
        setError('Error al guardar opciones de financiamiento: ' + optionsErr.message)
        setLoading(false)
        return
      }

      if (insertedConfigs?.[0]?.id && insertedOptions?.[0]?.id) {
        await supabase.from('config_financiamiento').insert([{
          configuracion_id: insertedConfigs[0].id,
          opcion_financiamiento_id: insertedOptions[0].id
        }])
      }

      router.push(`/epc/proyectos/${proyecto.id}`)
      return
    }

    const configsToInsert = configs.map((c, idx) => {
      const activeConfigProducts = Object.values(c.productosMap).flat()
      const inversion_total = activeConfigProducts.reduce((sum, p) => {
        const pCapex = p.tipo === 'fv' ? parseNum(p.fv?.capex) : parseNum(p.bess?.capex)
        return sum + pCapex
      }, 0)

      const configCurrencies = activeConfigProducts.map(p => p.tipo === 'fv' ? p.fv?.capex_moneda : p.bess?.capex_moneda).filter(Boolean)
      const configMoneda = configCurrencies.length > 0 ? configCurrencies[0] : 'USD'

      const ahorroAnual = c.ahorro_estimado_anual ? parseNum(c.ahorro_estimado_anual) : null
      const ahorroMensual = ahorroAnual ? Math.round((ahorroAnual / 12) * 100) / 100 : null

      return {
        proyecto_id: proyecto.id,
        nombre: c.nombre,
        descripcion: c.descripcion || null,
        inversion_total,
        moneda: configMoneda,
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

    if (configsErr) {
      setError('Error al guardar configuraciones: ' + configsErr.message)
      setLoading(false)
      return
    }

    const optionsToInsert = isRecomendacionNodo 
      ? [{
          proyecto_id: proyecto.id,
          nombre: 'Recomendación de Nodo',
          vehiculo_inversion: 'no_sabe',
          ahorro_estimado_anual: null,
          ahorro_estimado_mensual: null,
          moneda: 'MXN',
          plazo_meses: null,
          notas: null,
          seleccionada: true
        }]
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
            seleccionada: idx === 0
          }
        })

    const { data: insertedOptions, error: optionsErr } = await supabase
      .from('opciones_financiamiento')
      .insert(optionsToInsert)
      .select('id, nombre, vehiculo_inversion')

    if (optionsErr) {
      setError('Error al guardar opciones de financiamiento: ' + optionsErr.message)
      setLoading(false)
      return
    }

    const junctionRows: { configuracion_id: string; opcion_financiamiento_id: string }[] = []
    
    if (isRecomendacionNodo) {
      const optId = insertedOptions?.[0]?.id
      if (optId && insertedConfigs) {
        for (const ic of insertedConfigs) {
          junctionRows.push({
            configuracion_id: ic.id,
            opcion_financiamiento_id: optId
          })
        }
      }
    } else {
      for (const o of financingOptions) {
        const dbOpt = insertedOptions?.find(io => io.nombre === o.nombre && io.vehiculo_inversion === o.vehiculo_inversion)
        if (!dbOpt) continue
        
        for (const configTempId of o.linkedConfigIds) {
          const origConfig = configs.find(c => c.tempId === configTempId)
          if (!origConfig) continue
          const dbConfig = insertedConfigs?.find(ic => ic.nombre === origConfig.nombre)
          if (!dbConfig) continue
          
          junctionRows.push({
            configuracion_id: dbConfig.id,
            opcion_financiamiento_id: dbOpt.id
          })
        }
      }
    }

    if (junctionRows.length > 0) {
      const { error: junctionErr } = await supabase
        .from('config_financiamiento')
        .insert(junctionRows)
      
      if (junctionErr) {
        setError('Error al vincular financiamiento y configuraciones: ' + junctionErr.message)
        setLoading(false)
        return
      }
    }

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
      const { error: prodErr } = await supabase.from('proyecto_sitio_productos').insert(productosRows)
      if (prodErr) { setError('Error al guardar productos: ' + prodErr.message); setLoading(false); return }
    }

    router.push(`/epc/proyectos/${proyecto.id}`)
  }

  const fvCalc = calcFV(fvForm)
  const bessCalc = calcBESS(bessForm)
  const anyHighDemanda = (selectedSiteIds.length > 0 ? selectedSiteIds : sitiosSeleccionados).some(id => (sitiosCliente.find(s => s.id === id)?.demanda_contratada_kw ?? 0) > 1000)

  const activeConfigProducts = Object.values(activeConfig.productosMap).flat()
  const activeConfigCapex = activeConfigProducts.reduce((sum, p) => {
    const pCapex = p.tipo === 'fv' ? parseNum(p.fv?.capex) : parseNum(p.bess?.capex)
    return sum + pCapex
  }, 0)

  const activeProductCurrencies = activeConfigProducts.map(p => p.tipo === 'fv' ? p.fv?.capex_moneda : p.bess?.capex_moneda).filter(Boolean)
  const activeConfigMoneda = activeProductCurrencies.length > 0 ? activeProductCurrencies[0] : 'USD'

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black">Nuevo proyecto</h1>
        <p className="text-sm mt-1 text-muted">Completa los tres pasos para enviar tu solicitud</p>
      </div>

      <StepIndicator
        steps={isNodoBusca 
          ? ['Información básica / Basic info', 'Sitios / Sites'] 
          : ['Información básica / Basic info', 'Sitios / Sites', 'Alternativas / Alternatives', 'Financiamiento / Financing']}
        current={step}
      />

      <div className="rounded-2xl border border-borde p-8 shadow-sm bg-white">

        {/* ══ PASO 0 — Información básica ══════════════════════ */}
        {step === 0 && (
          <div className="flex flex-col gap-5">
            <h2 className="font-bold text-lg">Información básica</h2>

            <div>
              <label className="block text-sm font-medium mb-1">Nombre del proyecto *</label>
              <input type="text" value={form.nombre_proyecto}
                onChange={e => setF('nombre_proyecto', e.target.value)}
                className={inp} style={borde} placeholder="Ej: Proyecto Energía Norte" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Cliente *</label>
                {clientesCargados && (
                  <select value={form.cliente_id} onChange={e => seleccionarCliente(e.target.value)}
                    className={inp} style={borde}>
                    <option value="">Selecciona un cliente</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Finder / Originador</label>
                <select value={selectedFinderId} onChange={e => setSelectedFinderId(e.target.value)}
                  className={inp} style={borde}>
                  <option value="">Sin asignar (opcional)</option>
                  {finderList.map(u => <option key={u.id} value={u.id}>{u.nombre} — {u.empresa}</option>)}
                </select>
              </div>
            </div>

            <hr className="border-borde rounded-xl" />

            <div>
              <label className="block text-sm font-medium mb-3">Tipo de instalación *</label>
              <div className="flex flex-col gap-3">
                {([
                  {
                    value: 'nodo_busca',
                    icon: HelpCircle,
                    title: 'Quiero que Nodo me ayude a encontrar un instalador',
                    desc: 'Nodo buscará una empresa certificada que se encargue de la instalación del proyecto.',
                  },
                  {
                    value: 'epcista_instala',
                    icon: Wrench,
                    title: 'Tenemos la capacidad para realizar la instalación',
                    desc: 'Nuestra empresa cuenta con la experiencia y certificaciones para instalar de acuerdo a normativas.',
                  },
                ] as { value: 'nodo_busca' | 'epcista_instala'; icon: React.ElementType; title: string; desc: string }[]).map(opt => {
                  const selected = form.tipo_instalacion === opt.value
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
const Icon = opt.icon
                  return (
                    <button key={opt.value} type="button"
                      onClick={() => setF('tipo_instalacion', opt.value)}
                      className="flex items-start gap-4 rounded-xl border p-4 text-left w-full transition-all duration-200"
                      style={{
                        borderColor: selected ? 'var(--color-principal)' : '#E5E5E5',
                        backgroundColor: selected ? 'var(--color-principal)' : '#fff',
                        boxShadow: selected ? '0 4px 12px rgba(0,0,0,0.1)' : '0 1px 2px rgba(0,0,0,0.02)'
                      }}>
                      <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ borderColor: selected ? 'var(--color-acento)' : 'var(--color-linea)' }}>
                        {selected && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--color-acento)' }} />}
                      </div>
                      <div>
                        <div className="font-semibold text-sm" style={{ color: selected ? 'var(--color-acento)' : 'var(--color-principal)' }}>
                          {opt.title}
                        </div>
                        <div className="text-xs mt-1.5" style={{ color: selected ? '#aaa' : 'var(--color-texto-suave)' }}>
                          {opt.desc}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ══ PASO 1 — Sitios del Cliente / Client Sites ════════ */}
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="font-bold text-lg">1. Sitios del Cliente / Client Sites</h2>
              <p className="text-xs text-muted">
                Selecciona o agrega los sitios del cliente que formarán parte de este proyecto.
                <br />
                <span className="text-[11px] text-gray-400">Select or add the client sites that will be part of this project.</span>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Sitios a cotizar / Sites to quote *</label>

              {sitiosCliente.length === 0 && !mostrarNuevoSitio && (
                <p className="text-sm mb-3 text-muted">Este cliente no tiene sitios registrados / This client has no registered sites.</p>
              )}

              {/* Lista de sitios */}
              <div className="flex flex-col gap-2 mb-3">
                {sitiosCliente.map(s => {
                  const selected = selectedSiteIds.includes(s.id)

                  return (
                    <div key={s.id}>
                      {/* Fila sitio */}
                      <div className="flex items-center gap-3 border rounded-xl p-3 shadow-sm transition-all" style={{
                        borderColor: selected ? 'var(--color-principal)' : '#E5E5E5',
                        backgroundColor: selected ? '#fbfdf9' : '#fff',
                      }}>
                        <input type="checkbox" id={`s-${s.id}`} checked={selected}
                          onChange={() => toggleSitio(s.id)} className="w-4 h-4 flex-shrink-0 cursor-pointer" />
                        <label htmlFor={`s-${s.id}`} className="flex-1 cursor-pointer min-w-0">
                          <div className="text-sm font-semibold flex items-center gap-2">
                            <span>{s.nombre}</span>
                            {selected && (
                              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-principal text-acento">
                                Incluido / Included
                              </span>
                            )}
                          </div>
                          {(s.ciudad || s.ubicacion_estado) && (
                            <div className="text-xs truncate text-muted">
                              {[s.ciudad, s.ubicacion_estado].filter(Boolean).join(', ')}
                            </div>
                          )}
                        </label>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button type="button" onClick={() => {
                            setViendoSitioId(viendoSitioId === s.id ? null : s.id)
                            setEditandoSitioId(null)
                            setDeletingSitioId(null)
                          }}
                            className="p-1.5 border rounded-lg transition-colors hover:shadow-sm"
                            style={{
                              borderColor: viendoSitioId === s.id ? 'var(--color-principal)' : '#E5E5E5',
                              backgroundColor: viendoSitioId === s.id ? 'var(--color-principal)' : '#fff',
                              color: viendoSitioId === s.id ? 'var(--color-acento)' : 'var(--color-texto-suave)',
                            }}>
                            <Eye size={13} />
                          </button>
                          <button type="button" onClick={() => abrirEditarSitio(s)}
                            className="p-1.5 border rounded-lg transition-colors hover:shadow-sm"
                            style={{
                              borderColor: editandoSitioId === s.id ? 'var(--color-principal)' : '#E5E5E5',
                              backgroundColor: editandoSitioId === s.id ? '#f0f0f0' : '#fff',
                              color: 'var(--color-texto-suave)',
                            }}>
                            <Pencil size={13} />
                          </button>
                          <button type="button" onClick={() => { setDeletingSitioId(s.id); setViendoSitioId(null); setEditandoSitioId(null) }}
                            className="p-1.5 border rounded-lg transition-colors hover:shadow-sm"
                            style={{ borderColor: '#E5E5E5', color: '#dc2626' }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Confirmación eliminar */}
                      {deletingSitioId === s.id && (
                        <div className="border border-t-0 px-4 py-3 flex items-center justify-between" style={{ borderColor: '#c00', backgroundColor: '#fff5f5' }}>
                          <p className="text-sm">¿Eliminar <strong>{s.nombre}</strong>?</p>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => setDeletingSitioId(null)}
                              className="px-3 py-1 text-xs border border-borde rounded-xl">Cancelar</button>
                            <button type="button" onClick={() => eliminarSitio(s.id)}
                              className="px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: '#c00' }}>Eliminar</button>
                          </div>
                        </div>
                      )}

                      {/* Panel Ver */}
                      {viendoSitioId === s.id && (
                        <div className="border border-t-0 px-4 py-3" style={{ borderColor: 'var(--color-principal)', backgroundColor: '#fafafa' }}>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                            {s.nombre_recibo && <div><span className="text-muted">Nombre en recibo: </span><span className="font-medium">{s.nombre_recibo}</span></div>}
                            {(s.ciudad || s.ubicacion_estado) && <div><span className="text-muted">Ubicación: </span><span className="font-medium">{[s.ciudad, s.ubicacion_estado].filter(Boolean).join(', ')}</span></div>}
                            {s.rpu && <div><span className="text-muted">RPU: </span><span className="font-medium">{s.rpu}</span></div>}
                            {s.demanda_contratada_kw != null && <div><span className="text-muted">Demanda: </span><span className="font-medium">{s.demanda_contratada_kw.toLocaleString('es-MX')} kW</span></div>}
                            {s.recibo_url && (
                              <div className="col-span-2">
                                <a href={s.recibo_url} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1 underline font-medium" style={{ color: 'var(--color-principal)' }}>
                                  <FileText size={11} /> Ver recibo CFE / View bill
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Panel Editar sitio */}
                      {editandoSitioId === s.id && (
                        <div className="border border-t-0 px-4 py-4" style={{ borderColor: 'var(--color-principal)' }}>
                          <p className="text-xs font-bold mb-3">Editar sitio / Edit site</p>
                          <div className="flex flex-col gap-3">
                            <input type="text" value={editSitioForm.nombre}
                              onChange={e => setEditSitioForm(f => ({ ...f, nombre: e.target.value }))}
                              className={inp} style={borde} placeholder="Nombre del sitio *" />
                            <input type="text" value={editSitioForm.nombre_recibo}
                              onChange={e => setEditSitioForm(f => ({ ...f, nombre_recibo: e.target.value }))}
                              className={inp} style={borde} placeholder="Nombre como aparece en el recibo" />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                              <input type="text" value={editSitioForm.ciudad}
                                onChange={e => setEditSitioForm(f => ({ ...f, ciudad: e.target.value }))}
                                className={inp} style={borde} placeholder="Ciudad" />
                              <select value={editSitioForm.ubicacion_estado}
                                onChange={e => setEditSitioForm(f => ({ ...f, ubicacion_estado: e.target.value }))}
                                className={inp} style={borde}>
                                <option value="">Estado</option>
                                {ESTADOS_MX.map(est => <option key={est} value={est}>{est}</option>)}
                              </select>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '12px' }}>
                              <input type="text" value={editSitioForm.rpu}
                                onChange={e => setEditSitioForm(f => ({ ...f, rpu: e.target.value }))}
                                className={inp} style={borde} placeholder="RPU" />
                              <input type="number" min="0" value={editSitioForm.demanda_contratada_kw}
                                onChange={e => setEditSitioForm(f => ({ ...f, demanda_contratada_kw: e.target.value }))}
                                className={inp} style={borde} placeholder="Demanda contratada (kW)" />
                            </div>
                            <div className="flex items-center gap-3">
                              <input ref={fileRefEdit} type="file" accept=".pdf" onChange={subirPdfEdit} className="hidden" id="edit-recibo-pdf" />
                              <label htmlFor="edit-recibo-pdf"
                                className="flex items-center gap-1.5 px-3 py-1.5 border text-xs font-medium cursor-pointer border-borde rounded-xl">
                                <Upload size={11} />
                                {subiendoPdfEdit ? 'Subiendo…' : 'Recibo CFE (PDF)'}
                              </label>
                              {editSitioReciboUrl && (
                                <a href={editSitioReciboUrl} target="_blank" rel="noopener noreferrer"
                                  className="text-xs underline flex items-center gap-1">
                                  <FileText size={11} /> Ver PDF
                                </a>
                              )}
                            </div>
                          </div>
                          <div className="flex justify-between mt-3">
                            <button type="button" onClick={() => setEditandoSitioId(null)}
                              className="px-3 py-1.5 text-xs border border-borde rounded-xl">
                              Cancelar
                            </button>
                            <button type="button" onClick={actualizarSitio}
                              disabled={guardandoEditSitio || !editSitioForm.nombre.trim()}
                              className="px-4 py-1.5 text-xs font-bold disabled:opacity-50 bg-acento text-principal rounded-xl">
                              {guardandoEditSitio ? 'Guardando…' : 'Guardar cambios'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Formulario nuevo sitio */}
              {mostrarNuevoSitio ? (
                <div className="border border-borde rounded-xl p-4 flex flex-col gap-3 bg-gray-50/50">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Nuevo sitio / New Site</p>
                    <button type="button" onClick={() => setMostrarNuevoSitio(false)} className="text-muted"><X size={14} /></button>
                  </div>
                  {sitioError && <p className="text-xs text-red-600 font-medium">{sitioError}</p>}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Nombre del sitio *</label>
                      <input type="text" value={nuevoSitio.nombre}
                        onChange={e => setNuevoSitio(f => ({ ...f, nombre: e.target.value }))}
                        className={inp} placeholder="Planta Norte" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Nombre en recibo CFE</label>
                      <input type="text" value={nuevoSitio.nombre_recibo}
                        onChange={e => setNuevoSitio(f => ({ ...f, nombre_recibo: e.target.value }))}
                        className={inp} placeholder="Razón social en el recibo" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Ciudad</label>
                      <input type="text" value={nuevoSitio.ciudad}
                        onChange={e => setNuevoSitio(f => ({ ...f, ciudad: e.target.value }))}
                        className={inp} placeholder="Monterrey" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Estado</label>
                      <select value={nuevoSitio.ubicacion_estado}
                        onChange={e => setNuevoSitio(f => ({ ...f, ubicacion_estado: e.target.value }))}
                        className={inp}>
                        <option value="">Selecciona estado</option>
                        {ESTADOS_MX.map(est => <option key={est} value={est}>{est}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">RPU</label>
                      <input type="text" value={nuevoSitio.rpu}
                        onChange={e => setNuevoSitio(f => ({ ...f, rpu: e.target.value }))}
                        className={inp} placeholder="Registro Permanente de Usuario" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Demanda contratada (kW)</label>
                      <input type="number" min="0" value={nuevoSitio.demanda_contratada_kw}
                        onChange={e => setNuevoSitio(f => ({ ...f, demanda_contratada_kw: e.target.value }))}
                        className={inp} placeholder="Ej: 500" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input ref={fileRefNuevo} type="file" accept=".pdf" onChange={subirPdfNuevo} className="hidden" id="recibo-pdf-input" />
                    <label htmlFor="recibo-pdf-input"
                      className="flex items-center gap-1.5 px-3 py-2 border text-xs font-medium cursor-pointer border-borde rounded-xl bg-white hover:bg-gray-50">
                      <Upload size={12} />
                      {subiendoPdfNuevo ? 'Subiendo recibo…' : 'Subir recibo CFE (PDF)'}
                    </label>
                    {reciboUrlNuevo && (
                      <span className="text-xs text-green-700 font-medium flex items-center gap-1">
                        <FileText size={12} /> Recibo cargado
                      </span>
                    )}
                  </div>
                  <div className="flex justify-end gap-2 mt-2">
                    <button type="button" onClick={() => setMostrarNuevoSitio(false)}
                      className="px-3 py-1.5 text-xs border border-borde rounded-xl">Cancelar</button>
                    <button type="button" onClick={guardarNuevoSitio} disabled={guardandoSitio}
                      className="px-4 py-1.5 text-xs font-bold bg-principal text-acento rounded-xl disabled:opacity-50">
                      {guardandoSitio ? 'Guardando…' : 'Guardar sitio'}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button"
                  onClick={() => { setMostrarNuevoSitio(true); setSitioError(''); setViendoSitioId(null); setEditandoSitioId(null); setAddingToSitioId(null) }}
                  className="flex items-center gap-2 px-3 py-2 text-sm border font-medium w-full justify-center border-borde border-dashed rounded-xl hover:border-black transition-colors">
                  <Plus size={14} />
                  {sitiosCliente.length === 0 ? 'Agregar primer sitio / Add first site' : 'Agregar otro sitio / Add another site'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ══ PASO 2 — Alternativas Técnicas por Sitio (1:n) ═════ */}
        {step === 2 && !isNodoBusca && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="font-bold text-lg">2. Alternativas Técnicas / Technical Alternatives</h2>
              <p className="text-xs text-muted">
                Define una o varias propuestas técnicas para los sitios seleccionados (relación 1:n).
                <br />
                <span className="text-[11px] text-gray-400">Define one or more technical proposals for the selected sites (1:n relationship).</span>
              </p>
            </div>

            {/* Configurations Tab Bar */}
            <div className="flex flex-wrap gap-2 pb-2 border-b border-borde">
              {configs.map((c, idx) => (
                <button
                  key={c.tempId}
                  type="button"
                  onClick={() => {
                    setActiveConfigId(c.tempId)
                    setAddingToSitioId(null)
                  }}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border transition-all flex items-center gap-2"
                  style={{
                    backgroundColor: activeConfigId === c.tempId ? 'var(--color-principal)' : '#fff',
                    color: activeConfigId === c.tempId ? 'var(--color-acento)' : 'var(--color-texto-suave)',
                    borderColor: activeConfigId === c.tempId ? 'var(--color-principal)' : '#E5E5E5',
                  }}
                >
                  <span>{c.nombre || `Alternativa ${idx + 1}`}</span>
                  {configs.length > 1 && (
                    <X
                      size={14}
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfigs(prev => {
                          const next = prev.filter(item => item.tempId !== c.tempId)
                          if (activeConfigId === c.tempId) {
                            setActiveConfigId(next[0].tempId)
                          }
                          return next
                        })
                      }}
                      className="hover:text-red-500 transition-colors"
                    />
                  )}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  const newId = `config-${Date.now()}`
                  setConfigs(prev => [
                    ...prev,
                    {
                      tempId: newId,
                      nombre: `Alternativa ${String.fromCharCode(65 + prev.length)}`,
                      descripcion: '',
                      sitiosSeleccionados: selectedSiteIds,
                      productosMap: Object.fromEntries(selectedSiteIds.map(sId => [sId, []])),
                      ahorro_estimado_anual: '',
                      ahorro_moneda: 'MXN'
                    }
                  ])
                  setActiveConfigId(newId)
                }}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-dashed border-borde bg-white hover:border-black transition-all flex items-center gap-1"
              >
                <Plus size={14} /> Nueva alternativa / New Alternative
              </button>
            </div>

            {/* Active Configuration Details Form */}
            <div className="bg-fondo/35 p-4 rounded-xl border border-borde flex flex-col gap-4">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">
                Detalles de esta alternativa / Alternative Details
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Nombre de la alternativa / Name *</label>
                  <input
                    type="text"
                    value={activeConfig.nombre}
                    onChange={e => {
                      setConfigs(prev => prev.map(c => c.tempId === activeConfigId ? { ...c, nombre: e.target.value } : c))
                    }}
                    className={inp}
                    placeholder="Ej: Alternativa A - Solo FV 100 kWp"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Descripción / Description <span className="text-muted text-[10px]">(opcional)</span></label>
                  <input
                    type="text"
                    value={activeConfig.descripcion}
                    onChange={e => {
                      setConfigs(prev => prev.map(c => c.tempId === activeConfigId ? { ...c, descripcion: e.target.value } : c))
                    }}
                    className={inp}
                    placeholder="Ej: Opción con 150 kWp y sin baterías"
                  />
                </div>
              </div>

              <div className="text-xs text-muted flex justify-between items-center mt-1 pt-2 border-t border-borde">
                <span>Inversión total estimada (CAPEX acumulado):</span>
                <span className="font-bold text-sm text-principal">
                  ${activeConfigCapex.toLocaleString('es-MX')} {activeConfigMoneda}
                </span>
              </div>

              <div className="text-xs text-muted flex justify-between items-center mt-1 pt-2 border-t border-borde">
                <span>Ahorro bruto estimado anual / Estimated Gross Annual Savings:</span>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={activeConfig.ahorro_estimado_anual}
                    onChange={e => {
                      setConfigs(prev => prev.map(c => c.tempId === activeConfigId ? { ...c, ahorro_estimado_anual: formatNumberInput(e.target.value) } : c))
                    }}
                    className={inp}
                    style={{ width: '140px' }}
                    placeholder="0"
                  />
                  <select
                    value={activeConfig.ahorro_moneda}
                    onChange={e => {
                      setConfigs(prev => prev.map(c => c.tempId === activeConfigId ? { ...c, ahorro_moneda: e.target.value as Moneda } : c))
                    }}
                    className={inp}
                    style={{ width: '90px' }}
                  >
                    <option value="MXN">MXN</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Sites & Products under this active alternative */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                Productos por Sitio / Products per Site
              </label>

              <div className="flex flex-col gap-4">
                {(selectedSiteIds.length > 0 ? selectedSiteIds : sitiosSeleccionados).map(sId => {
                  const s = sitiosCliente.find(site => site.id === sId)
                  if (!s) return null
                  const productos = productosMap[sId] ?? []
                  const isAdding = addingToSitioId === sId

                  return (
                    <div key={sId} className="border border-borde rounded-xl p-4 bg-white shadow-sm flex flex-col gap-3">
                      <div className="flex items-center justify-between pb-2 border-b border-borde">
                        <div>
                          <span className="font-bold text-sm text-principal">{s.nombre}</span>
                          {(s.ciudad || s.ubicacion_estado) && (
                            <span className="text-xs text-muted ml-2">
                              {[s.ciudad, s.ubicacion_estado].filter(Boolean).join(', ')}
                            </span>
                          )}
                          {s.demanda_contratada_kw && (
                            <span className="text-xs font-semibold text-gray-500 ml-2">
                              · {s.demanda_contratada_kw.toLocaleString('es-MX')} kW
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted font-medium">
                          {productos.length} {productos.length === 1 ? 'producto' : 'productos'}
                        </span>
                      </div>

                      {/* Lista de productos para este sitio */}
                      {productos.length > 0 && (
                        <div className="flex flex-col gap-2">
                          {productos.map(p => (
                            <ProductoCard
                              key={p.tempId}
                              p={p}
                              onRemove={() => {
                                setProductosMap(prev => ({
                                  ...prev,
                                  [sId]: (prev[sId] ?? []).filter(item => item.tempId !== p.tempId)
                                }))
                              }}
                            />
                          ))}
                        </div>
                      )}

                      {/* Botón / Formulario agregar producto */}
                      {!isAdding ? (
                        <button
                          type="button"
                          onClick={() => {
                            setAddingToSitioId(sId)
                            setProductTipo(null)
                            setFvForm(emptyFv)
                            setBessForm(emptyBess)
                            setAddProductError('')
                          }}
                          className="flex items-center justify-center gap-1.5 py-2 px-3 border border-dashed border-borde rounded-xl text-xs font-medium text-muted hover:border-principal hover:text-principal transition-colors bg-gray-50/50"
                        >
                          <Plus size={13} />
                          {productos.length === 0 ? 'Agregar primer producto (FV o BESS) / Add product' : 'Agregar otro producto / Add another product'}
                        </button>
                      ) : (
                        <div className="border p-4 rounded-xl" style={{ borderColor: 'var(--color-principal)', backgroundColor: '#fff' }}>
                          {/* Selector de tipo */}
                          {!productTipo ? (
                            <div>
                              <p className="text-xs font-bold mb-3">¿Qué tipo de producto? / Product type</p>
                              <div className="grid grid-cols-2 gap-3">
                                <button type="button" onClick={() => setProductTipo('fv')}
                                  className="border p-4 flex flex-col items-center gap-2 transition-colors hover:border-black border-borde rounded-xl">
                                  <Zap size={20} />
                                  <span className="text-sm font-bold">Fotovoltaico</span>
                                  <span className="text-xs text-center text-muted">Paneles solares e inversores</span>
                                </button>
                                <button type="button" onClick={() => setProductTipo('bess')}
                                  className="border p-4 flex flex-col items-center gap-2 transition-colors hover:border-black border-borde rounded-xl">
                                  <Battery size={20} />
                                  <span className="text-sm font-bold">BESS</span>
                                  <span className="text-xs text-center text-muted">Sistema de almacenamiento</span>
                                </button>
                              </div>
                              <div className="flex justify-end mt-3">
                                <button type="button" onClick={() => setAddingToSitioId(null)}
                                  className="px-3 py-1.5 text-xs border border-borde rounded-xl">
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : productTipo === 'fv' ? (
                            /* Formulario FV */
                            <div>
                              <div className="flex items-center justify-between mb-4">
                                <p className="text-sm font-bold flex items-center gap-2"><Zap size={14} /> Fotovoltaico / Solar PV</p>
                                <button type="button" onClick={() => setProductTipo(null)}
                                  className="text-xs underline text-muted">← Cambiar tipo</button>
                              </div>
                              <div className="flex flex-col gap-3">
                                {/* Módulos */}
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Módulos</p>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                                  <div>
                                    <label className="block text-xs font-medium mb-1">No. Módulos *</label>
                                    <input type="text" value={fvForm.num_modulos}
                                      onChange={e => setFvForm(f => ({ ...f, num_modulos: formatNumberInput(e.target.value) }))}
                                      className={inp} style={borde} placeholder="0" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium mb-1">Potencia (W) *</label>
                                    <input type="text" value={fvForm.potencia_modulos_w}
                                      onChange={e => setFvForm(f => ({ ...f, potencia_modulos_w: formatNumberInput(e.target.value) }))}
                                      className={inp} style={borde} placeholder="0" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium mb-1">Marca *</label>
                                    <input type="text" value={fvForm.marca_modulos}
                                      onChange={e => setFvForm(f => ({ ...f, marca_modulos: e.target.value }))}
                                      className={inp} style={borde} placeholder="Jinko, LONGi…" />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <CalcField label="kWp sistema" value={fvCalc.kwpSistema} unit="kWp" />
                                </div>

                                {/* Inversores */}
                                <p className="text-xs font-semibold uppercase tracking-wide mt-1 text-muted">Inversores</p>
                                {addingToSitioId && (productosMap[addingToSitioId] ?? []).some(p => p.tipo === 'bess' && p.bess?.inversores_hibridos) && (
                                  <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded-lg mb-2">Los inversores del BESS híbrido cubren este producto FV. Los campos de inversores son opcionales.</div>
                                )}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                                  <div>
                                    <label className="block text-xs font-medium mb-1">No. Inversores *</label>
                                    <input type="text" value={fvForm.num_inversores}
                                      onChange={e => setFvForm(f => ({ ...f, num_inversores: formatNumberInput(e.target.value) }))}
                                      className={inp} style={borde} placeholder="0" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium mb-1">Potencia (kW) *</label>
                                    <input type="text" value={fvForm.potencia_inversores_kw}
                                      onChange={e => setFvForm(f => ({ ...f, potencia_inversores_kw: formatNumberInput(e.target.value) }))}
                                      className={inp} style={borde} placeholder="0" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium mb-1">Marca *</label>
                                    <input type="text" value={fvForm.marca_inversores}
                                      onChange={e => setFvForm(f => ({ ...f, marca_inversores: e.target.value }))}
                                      className={inp} style={borde} placeholder="Huawei, SMA…" />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <CalcField label="kWp inversores" value={fvCalc.kwpInversores} unit="kW" />
                                </div>

                                {/* Generación y CAPEX */}
                                <p className="text-xs font-semibold uppercase tracking-wide mt-1 text-muted">Generación y CAPEX</p>
                                <div>
                                  <label className="block text-xs font-medium mb-1">Generación anual estimada (kWh) *</label>
                                  <input type="text" value={fvForm.generacion_anual_kwh}
                                    onChange={e => setFvForm(f => ({ ...f, generacion_anual_kwh: formatNumberInput(e.target.value) }))}
                                    className={inp} style={borde} placeholder="0" />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: '10px' }}>
                                  <div>
                                    <label className="block text-xs font-medium mb-1">CAPEX *</label>
                                    <input type="text" value={fvForm.capex}
                                      onChange={e => setFvForm(f => ({ ...f, capex: formatNumberInput(e.target.value) }))}
                                      className={inp} style={borde} placeholder="0" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium mb-1">Moneda</label>
                                    <select value={fvForm.capex_moneda}
                                      onChange={e => setFvForm(f => ({ ...f, capex_moneda: e.target.value as Moneda }))}
                                      className={inp} style={borde}>
                                      <option value="USD">USD</option>
                                      <option value="MXN">MXN</option>
                                    </select>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <CalcField label="Precio / Watt" value={fvCalc.precioWatt} unit={`USD/W`} />
                                </div>

                                {addProductError && <p className="text-xs text-red-600 font-medium">{addProductError}</p>}

                                <div className="flex justify-end gap-2 mt-2">
                                  <button type="button" onClick={() => setAddingToSitioId(null)}
                                    className="px-3 py-1.5 text-xs border border-borde rounded-xl">Cancelar</button>
                                  <button type="button" onClick={() => guardarProducto(sId)}
                                    className="px-4 py-1.5 text-xs font-bold bg-principal text-acento rounded-xl">
                                    Guardar producto
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            /* Formulario BESS */
                            <div>
                              <div className="flex items-center justify-between mb-4">
                                <p className="text-sm font-bold flex items-center gap-2"><Battery size={14} /> BESS / Energy Storage</p>
                                <button type="button" onClick={() => setProductTipo(null)}
                                  className="text-xs underline text-muted">← Cambiar tipo</button>
                              </div>
                              <div className="flex flex-col gap-3">
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                  <div>
                                    <label className="block text-xs font-medium mb-1">Potencia (kW) *</label>
                                    <input type="text" value={bessForm.potencia_kw}
                                      onChange={e => setBessForm(f => ({ ...f, potencia_kw: formatNumberInput(e.target.value) }))}
                                      className={inp} style={borde} placeholder="0" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium mb-1">Capacidad (kWh) *</label>
                                    <input type="text" value={bessForm.capacidad_kwh}
                                      onChange={e => setBessForm(f => ({ ...f, capacidad_kwh: formatNumberInput(e.target.value) }))}
                                      className={inp} style={borde} placeholder="0" />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium mb-1">Marca *</label>
                                  <input type="text" value={bessForm.marca}
                                    onChange={e => setBessForm(f => ({ ...f, marca: e.target.value }))}
                                    className={inp} style={borde} placeholder="Tesla, BYD, CATL…" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium mb-1">Uso *</label>
                                  <select value={bessForm.uso}
                                    onChange={e => setBessForm(f => ({ ...f, uso: e.target.value }))}
                                    className={inp} style={borde}>
                                    <option value="load_shifting">Load shifting</option>
                                    <option value="ups">Respaldo (UPS)</option>
                                    <option value="load_shifting_ups">Load shifting + Respaldo</option>
                                  </select>
                                </div>
                                <div className="pt-1">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={bessForm.inversores_hibridos}
                                      onChange={e => setBessForm(f => ({ ...f, inversores_hibridos: e.target.checked }))}
                                      className="w-4 h-4 rounded border-gray-300 text-principal focus:ring-acento"
                                    />
                                    <span className="text-xs font-medium text-principal">
                                      Inversores híbridos (también manejan FV)
                                    </span>
                                  </label>
                                  <p className="text-[11px] text-muted ml-6 mt-0.5">
                                    Si se activa, los productos FV en este mismo sitio no requerirán especificar inversores adicionales.
                                  </p>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: '10px' }}>
                                  <div>
                                    <label className="block text-xs font-medium mb-1">CAPEX *</label>
                                    <input type="text" value={bessForm.capex}
                                      onChange={e => setBessForm(f => ({ ...f, capex: formatNumberInput(e.target.value) }))}
                                      className={inp} style={borde} placeholder="0" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium mb-1">Moneda</label>
                                    <select value={bessForm.capex_moneda}
                                      onChange={e => setBessForm(f => ({ ...f, capex_moneda: e.target.value as Moneda }))}
                                      className={inp} style={borde}>
                                      <option value="USD">USD</option>
                                      <option value="MXN">MXN</option>
                                    </select>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <CalcField label="Precio / kWh" value={bessCalc.precioKwh} unit={`USD/kWh`} />
                                </div>

                                {addProductError && <p className="text-xs text-red-600 font-medium">{addProductError}</p>}

                                <div className="flex justify-end gap-2 mt-2">
                                  <button type="button" onClick={() => setAddingToSitioId(null)}
                                    className="px-3 py-1.5 text-xs border border-borde rounded-xl">Cancelar</button>
                                  <button type="button" onClick={() => guardarProducto(sId)}
                                    className="px-4 py-1.5 text-xs font-bold bg-principal text-acento rounded-xl">
                                    Guardar producto
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ══ PASO 3 — Esquemas de Financiamiento (n:n) ════════ */}
        {step === 3 && !isNodoBusca && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="font-bold text-lg">3. Esquemas de Financiamiento / Financing Schemes</h2>
              <p className="text-xs text-muted">
                Selecciona los esquemas de financiamiento a cotizar para las alternativas técnicas (relación n:n).
                <br />
                <span className="text-[11px] text-gray-400">Select the financing schemes to quote for the technical alternatives (n:n relationship).</span>
              </p>
            </div>

            {anyHighDemanda && (
              <div className="border p-4 rounded-xl" style={{ borderColor: 'var(--color-acento)', backgroundColor: '#fffff0' }}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.incluye_mem}
                    onChange={e => setF('incluye_mem', e.target.checked)}
                    className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold">Considerar alternativa de Mercado Eléctrico Mayorista (MEM)</p>
                    <p className="text-xs mt-0.5 text-muted">
                      Uno o más sitios seleccionados tienen más de 1,000 kW de demanda contratada. El analista evaluará si conviene migrar al MEM.
                    </p>
                  </div>
                </label>
              </div>
            )}

            {/* Simple Multi-Choice Selection */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                Selecciona los esquemas de financiamiento / Select financing schemes *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                {VEHICULOS_FINANCIAMIENTO.map(v => {
                  const isSelected = financingOptions.some(o => o.vehiculo_inversion === v.id)
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => toggleVehiculo(v.id, v.nombreEs, v.nombreEn)}
                      className="border rounded-xl p-3.5 text-left transition-all flex items-start gap-3"
                      style={{
                        borderColor: isSelected ? 'var(--color-principal)' : '#E5E5E5',
                        backgroundColor: isSelected ? '#f8fbf5' : '#fff',
                      }}
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center mt-0.5 shrink-0 border font-bold text-xs ${isSelected ? 'bg-principal text-acento border-principal' : 'border-gray-300'}`}>
                        {isSelected ? '✓' : ''}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-principal">{v.nombreEs}</p>
                        <p className="text-xs text-muted">{v.nombreEn}</p>
                        <p className="text-[11px] text-gray-400 mt-1">{v.descEs}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Selected Options List with Folded Characteristics */}
            <div className="flex flex-col gap-3">
              <label className="block text-sm font-semibold">
                Esquemas Seleccionados / Selected Schemes ({financingOptions.length})
              </label>

              {financingOptions.map((opt) => {
                const isFolded = foldedCharacteristics[opt.tempId] !== false // folded by default!
                return (
                  <div key={opt.tempId} className="border border-borde rounded-xl p-4 bg-white shadow-sm flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-principal" />
                        <span className="font-bold text-sm text-principal">{opt.nombre}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFoldedCharacteristics(prev => ({ ...prev, [opt.tempId]: !isFolded }))}
                        className="text-xs font-semibold text-principal px-3 py-1.5 rounded-lg border border-borde hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                      >
                        {isFolded ? (
                          <>
                            <span>▸</span>
                            <span>Características de Financiamiento (Opcional) / Financing Characteristics (Optional)</span>
                          </>
                        ) : (
                          <>
                            <span>▾</span>
                            <span>Ocultar Características / Hide Characteristics</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Folded content */}
                    {!isFolded && (
                      <div className="pt-3 border-t border-borde flex flex-col gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-medium mb-1">
                              Plazo (meses) / Term (months) <span className="text-muted text-[10px]">(opcional)</span>
                            </label>
                            <input
                              type="text"
                              value={opt.plazo_meses}
                              onChange={e => setFinancingOptions(prev => prev.map(o => o.tempId === opt.tempId ? { ...o, plazo_meses: formatNumberInput(e.target.value) } : o))}
                              className={inp}
                              placeholder="60"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-xs font-medium mb-1">
                              Ahorro neto anual estimado / Estimated Net Annual Savings <span className="text-muted text-[10px]">(opcional)</span>
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={opt.ahorro_estimado_anual}
                                onChange={e => setFinancingOptions(prev => prev.map(o => o.tempId === opt.tempId ? { ...o, ahorro_estimado_anual: formatNumberInput(e.target.value) } : o))}
                                className={inp}
                                placeholder="0"
                              />
                              <select
                                value={opt.ahorro_moneda || 'MXN'}
                                onChange={e => setFinancingOptions(prev => prev.map(o => o.tempId === opt.tempId ? { ...o, ahorro_moneda: e.target.value as Moneda } : o))}
                                className={inp}
                                style={{ width: '90px' }}
                              >
                                <option value="MXN">MXN</option>
                                <option value="USD">USD</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium mb-1">
                            Notas y condiciones / Notes & Terms <span className="text-muted text-[10px]">(opcional)</span>
                          </label>
                          <input
                            type="text"
                            value={opt.notas}
                            onChange={e => setFinancingOptions(prev => prev.map(o => o.tempId === opt.tempId ? { ...o, notas: e.target.value } : o))}
                            className={inp}
                            placeholder="Tasa, enganche, condiciones de compra..."
                          />
                        </div>

                        <div>
                          <span className="block text-xs font-semibold mb-1.5 text-muted uppercase tracking-wider">
                            Vincular a Alternativas Técnicas / Link to Technical Alternatives (n:n)
                          </span>
                          <div className="flex flex-wrap gap-3 bg-gray-50 p-2.5 rounded-lg border border-borde">
                            {configs.map(c => {
                              const isLinked = opt.linkedConfigIds.includes(c.tempId)
                              return (
                                <label key={c.tempId} className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isLinked}
                                    onChange={() => {
                                      setFinancingOptions(prev => prev.map(o => {
                                        if (o.tempId === opt.tempId) {
                                          const next = o.linkedConfigIds.includes(c.tempId)
                                            ? o.linkedConfigIds.filter(id => id !== c.tempId)
                                            : [...o.linkedConfigIds, c.tempId]
                                          return { ...o, linkedConfigIds: next }
                                        }
                                        return o
                                      }))
                                    }}
                                    className="w-3.5 h-3.5"
                                  />
                                  <span>{c.nombre}</span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Notas adicionales / Additional Notes <span className="text-muted text-[10px]">(opcional)</span>
              </label>
              <textarea value={form.notas_adicionales} onChange={e => setF('notas_adicionales', e.target.value)}
                rows={3} className={inp} style={borde}
                placeholder="Cualquier información adicional relevante para el analista de Nodo…" />
            </div>
          </div>
        )}


        {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

          <div className="flex justify-between mt-10">
            <button type="button" onClick={() => { setError(''); setStep(s => s - 1) }}
              disabled={step === 0} className="px-5 py-2.5 text-sm font-medium border border-borde rounded-lg hover:bg-gray-50 transition-all disabled:opacity-30">
              Anterior / Back
            </button>
            {step < (isNodoBusca ? 1 : 3) ? (
              <button type="button" onClick={handleNext}
                className="px-6 py-2.5 text-sm font-semibold rounded-xl shadow-sm hover:shadow-md transition-all active:scale-[0.98] bg-acento text-principal">
                Siguiente / Next
              </button>
            ) : (
              <button type="button" onClick={handleSubmit} disabled={loading}
                className="px-6 py-2.5 text-sm font-semibold rounded-xl shadow-sm hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-50 hover:bg-[#1a1a1a]"
                style={{ backgroundColor: 'var(--color-principal)', color: 'var(--color-acento)' }}>
                {loading ? 'Enviando... / Submitting...' : 'Enviar proyecto / Submit project'}
              </button>
            )}
          </div>
      </div>
    </div>
  )
}

