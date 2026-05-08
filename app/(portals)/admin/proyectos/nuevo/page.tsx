'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Eye, Pencil, Trash2, Upload, FileText, Zap, Battery, Wrench, HelpCircle } from 'lucide-react'
import type { Moneda, ModalidadFinanciamiento, Cliente, Sitio, Profile } from '@/lib/types'

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
}

interface BESSForm {
  potencia_kw: string
  capacidad_kwh: string
  marca: string
  uso: string
  capex: string
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

// ── Valores vacíos ─────────────────────────────────────────────
const inp = "w-full rounded-lg border border-borde px-4 py-2.5 text-sm bg-white focus:border-acento focus:ring-2 focus:ring-acento/30 transition-all";
const borde = {};

const emptyFv: FVForm = {
  num_modulos: '', potencia_modulos_w: '', marca_modulos: '',
  num_inversores: '', potencia_inversores_kw: '', marca_inversores: '',
  generacion_anual_kwh: '', capex: '',
}
const emptyBess: BESSForm = { potencia_kw: '', capacidad_kwh: '', marca: '', uso: '', capex: '' }
const emptyNuevoSitio = { nombre: '', nombre_recibo: '', ciudad: '', ubicacion_estado: '', rpu: '', demanda_contratada_kw: '' }
const initialForm: FormData = {
  nombre_proyecto: '', cliente_id: '', tipo_instalacion: '',
  modalidad_financiamiento: [], capex_estimado: '', moneda: 'MXN',
  notas_adicionales: '', incluye_mem: false,
}

// ── Helpers de cálculo ────────────────────────────────────────
function calcFV(fv: FVForm) {
  const n = Number(fv.num_modulos) || 0
  const pw = Number(fv.potencia_modulos_w) || 0
  const ni = Number(fv.num_inversores) || 0
  const pi = Number(fv.potencia_inversores_kw) || 0
  const capex = Number(fv.capex) || 0
  return {
    kwpSistema: n > 0 && pw > 0 ? n * pw / 1000 : null,
    kwpInversores: ni > 0 && pi > 0 ? ni * pi : null,
    precioWatt: capex > 0 && n > 0 && pw > 0 ? capex / (n * pw) : null,
  }
}

function calcBESS(bess: BESSForm) {
  const cap = Number(bess.capacidad_kwh) || 0
  const capex = Number(bess.capex) || 0
  return { precioKwh: capex > 0 && cap > 0 ? capex / cap : null }
}

function n2(v: number | null, dec = 2) {
  if (v === null) return '—'
  return v.toLocaleString('es-MX', { maximumFractionDigits: dec })
}

// ── StepIndicator ─────────────────────────────────────────────
function StepIndicator({ current }: { current: number }) {
  const labels = ['Información básica', 'Sitios y productos', 'Financiamiento']
  return (
    <div className="flex items-center gap-3 mb-8">
      {labels.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{
              backgroundColor: i < current ? '#000' : i === current ? '#D7FF2F' : '#CFCFCF',
              color: i < current ? '#D7FF2F' : '#000',
            }}>
            {i < current ? '✓' : i + 1}
          </div>
          <span className="text-xs font-medium hidden md:block"
            style={{ color: i === current ? '#000' : '#999' }}>
            {label}
          </span>
          {i < 2 && <div className="h-px w-5 flex-shrink-0" style={{ backgroundColor: i < current ? '#000' : '#CFCFCF' }} />}
        </div>
      ))}
    </div>
  )
}

// ── Tarjeta de producto (display) ────────────────────────────
function ProductoCard({ p, onRemove }: { p: Producto; onRemove: () => void }) {
  if (p.tipo === 'fv' && p.fv) {
    const { kwpSistema, kwpInversores, precioWatt } = calcFV(p.fv)
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
        <div className="grid grid-cols-2 gap-x-4 gap-y-1" style={{ color: '#444' }}>
          <span><span className="text-muted">Módulos: </span>{p.fv.num_modulos} × {p.fv.potencia_modulos_w} W · {p.fv.marca_modulos}</span>
          <span><span className="text-muted">kWp sistema: </span>{n2(kwpSistema, 1)} kWp</span>
          <span><span className="text-muted">Inversores: </span>{p.fv.num_inversores} × {p.fv.potencia_inversores_kw} kW · {p.fv.marca_inversores}</span>
          <span><span className="text-muted">kWp inversores: </span>{n2(kwpInversores, 1)} kW</span>
          <span><span className="text-muted">Generación: </span>{Number(p.fv.generacion_anual_kwh).toLocaleString('es-MX')} kWh/año</span>
          <span><span className="text-muted">CAPEX: </span>${Number(p.fv.capex).toLocaleString('es-MX')}</span>
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
          </div>
          <button type="button" onClick={onRemove} className="p-0.5 flex-shrink-0 text-muted">
            <X size={13} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1" style={{ color: '#444' }}>
          <span><span className="text-muted">Potencia: </span>{p.bess.potencia_kw} kW</span>
          <span><span className="text-muted">Capacidad: </span>{p.bess.capacidad_kwh} kWh</span>
          <span><span className="text-muted">Marca: </span>{p.bess.marca}</span>
          <span><span className="text-muted">Uso: </span>{usoLabel[p.bess.uso] ?? p.bess.uso}</span>
          <span><span className="text-muted">CAPEX: </span>${Number(p.bess.capex).toLocaleString('es-MX')}</span>
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
export default function NuevoProyectoPage() {
   
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormData>(initialForm)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sitioError, setSitioError] = useState('')

  // Admin: EPC + Responsable selectors
  const [epcList, setEpcList] = useState<Profile[]>([])
  const [nodoUsers, setNodoUsers] = useState<Profile[]>([])
  const [selectedEpcId, setSelectedEpcId] = useState('')
  const [selectedResponsableId, setSelectedResponsableId] = useState('')

  // Manual client toggle
  const [clienteManual, setClienteManual] = useState(false)
  const [manualCliente, setManualCliente] = useState({ nombre: '', empresa: '', contacto: '' })

  // Clientes y sitios
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clientesCargados, setClientesCargados] = useState(false)
  const [sitiosCliente, setSitiosCliente] = useState<Sitio[]>([])
  const [sitiosSeleccionados, setSitiosSeleccionados] = useState<string[]>([])

  // Productos por sitio (in-memory)
  const [productosMap, setProductosMap] = useState<Record<string, Producto[]>>({})
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

  // Load EPC users and Nodo users for admin assignment
  useEffect(() => {
    async function loadAdminData() {
      const { data: epcs } = await supabase.from('profiles').select('*').eq('rol', 'epc').order('nombre')
      setEpcList((epcs ?? []) as Profile[])
      const { data: nodos } = await supabase.from('profiles').select('*').in('rol', ['nodo_admin', 'nodo_analista']).order('nombre')
      setNodoUsers((nodos ?? []) as Profile[])
    }
    loadAdminData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When admin selects an EPC, load that EPC's clients
  async function handleSelectEpc(epcId: string) {
    setSelectedEpcId(epcId)
    setClienteManual(false)
    setForm(prev => ({ ...prev, cliente_id: '' }))
    setSitiosCliente([])
    setSitiosSeleccionados([])
    setProductosMap({})
    if (!epcId) { setClientes([]); setClientesCargados(true); return }
    const { data } = await supabase.from('clientes').select('*').eq('epcista_id', epcId).order('razon_social')
    setClientes((data ?? []) as Cliente[])
    setClientesCargados(true)
  }

  async function cargarSitios(clienteId: string) {
    if (!clienteId) { setSitiosCliente([]); setSitiosSeleccionados([]); return }
    const { data } = await supabase.from('sitios').select('*').eq('cliente_id', clienteId).order('nombre')
    setSitiosCliente((data ?? []) as Sitio[])
    setSitiosSeleccionados([])
    setProductosMap({})
  }

  function seleccionarCliente(clienteId: string) {
    setF('cliente_id', clienteId)
    cargarSitios(clienteId)
    setMostrarNuevoSitio(false)
    setViendoSitioId(null)
    setEditandoSitioId(null)
  }

  function toggleSitio(sitioId: string) {
    setSitiosSeleccionados(prev =>
      prev.includes(sitioId) ? prev.filter(id => id !== sitioId) : [...prev, sitioId]
    )
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
    if (!fvForm.marca_modulos.trim()) return 'Ingresa la marca de los módulos.'
    if (!fvForm.num_inversores || !fvForm.potencia_inversores_kw) return 'Ingresa número y potencia de inversores.'
    if (!fvForm.marca_inversores.trim()) return 'Ingresa la marca de los inversores.'
    if (!fvForm.generacion_anual_kwh) return 'Ingresa la generación anual estimada.'
    if (!fvForm.capex) return 'Ingresa el CAPEX del sistema FV.'
    return ''
  }

  function validarBessForm(): string {
    if (!bessForm.potencia_kw) return 'Ingresa la potencia del BESS.'
    if (!bessForm.capacidad_kwh) return 'Ingresa la capacidad del BESS.'
    if (!bessForm.marca.trim()) return 'Ingresa la marca del BESS.'
    if (!bessForm.uso) return 'Selecciona el uso del BESS.'
    if (!bessForm.capex) return 'Ingresa el CAPEX del BESS.'
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

  function removeProduct(sitioId: string, tempId: string) {
    setProductosMap(prev => ({
      ...prev,
      [sitioId]: (prev[sitioId] ?? []).filter(p => p.tempId !== tempId),
    }))
  }

  // ── Sitios inline ────────────────────────────────────────────
  async function subirPdfNuevo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !form.cliente_id) return
    setSubiendoPdfNuevo(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setSubiendoPdfNuevo(false); return }
    const path = `${session.user.id}/${form.cliente_id}/${Date.now()}_${file.name}`
    const { error: uploadErr } = await supabase.storage.from('recibos-cfe').upload(path, file)
    if (!uploadErr) {
      const { data: { publicUrl } } = supabase.storage.from('recibos-cfe').getPublicUrl(path)
      setReciboUrlNuevo(publicUrl)
    }
    setSubiendoPdfNuevo(false)
    if (fileRefNuevo.current) fileRefNuevo.current.value = ''
  }

  async function subirPdfEdit(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !form.cliente_id) return
    setSubiendoPdfEdit(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setSubiendoPdfEdit(false); return }
    const path = `${session.user.id}/${form.cliente_id}/${Date.now()}_${file.name}`
    const { error: uploadErr } = await supabase.storage.from('recibos-cfe').upload(path, file)
    if (!uploadErr) {
      const { data: { publicUrl } } = supabase.storage.from('recibos-cfe').getPublicUrl(path)
      setEditSitioReciboUrl(publicUrl)
    }
    setSubiendoPdfEdit(false)
    if (fileRefEdit.current) fileRefEdit.current.value = ''
  }

  async function guardarNuevoSitio() {
    if (!nuevoSitio.nombre.trim()) return
    setSitioError('')
    setGuardandoSitio(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setSitioError('Sesión expirada. Recarga la página.'); setGuardandoSitio(false); return }

    // If admin used manual client, auto-create the client record first
    let clienteId = form.cliente_id
    if (!clienteId && clienteManual) {
      if (!manualCliente.empresa.trim()) {
        setSitioError('Completa los datos del cliente en el paso anterior antes de agregar sitios.')
        setGuardandoSitio(false)
        return
      }
      const { data: newCliente, error: clienteErr } = await supabase.from('clientes').insert({
        epcista_id: selectedEpcId,
        razon_social: manualCliente.empresa,
        contacto_nombre: manualCliente.nombre || manualCliente.empresa,
        contacto_email: manualCliente.contacto.includes('@') ? manualCliente.contacto : null,
        contacto_telefono: !manualCliente.contacto.includes('@') ? manualCliente.contacto : null,
      }).select('id').single()
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
    const { data, error: insertErr } = await supabase.from('sitios').insert({
      cliente_id: clienteId, epcista_id: selectedEpcId || session.user.id,
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
    setSitiosSeleccionados(prev => prev.filter(sid => sid !== id))
    setProductosMap(prev => { const next = { ...prev }; delete next[id]; return next })
    setDeletingSitioId(null)
  }

  // ── Form helpers ─────────────────────────────────────────────
  function setF(field: keyof FormData, value: unknown) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function toggleModalidad(m: ModalidadFinanciamiento) {
    if (m === 'no_sabe') { setF('modalidad_financiamiento', ['no_sabe']); return }
    const current = form.modalidad_financiamiento.filter(x => x !== 'no_sabe')
    if (current.includes(m)) setF('modalidad_financiamiento', current.filter(x => x !== m))
    else setF('modalidad_financiamiento', [...current, m])
  }

  // ── Validaciones ─────────────────────────────────────────────
  function validarPaso0() {
    if (!form.nombre_proyecto.trim()) return 'Ingresa el nombre del proyecto.'
    if (!selectedEpcId) return 'Selecciona un EPCista.'
    if (!clienteManual && !form.cliente_id) return 'Selecciona un cliente o ingresa datos manualmente.'
    if (clienteManual && !manualCliente.nombre.trim()) return 'Ingresa el nombre del contacto del cliente.'
    if (clienteManual && !manualCliente.empresa.trim()) return 'Ingresa la empresa del cliente.'
    if (!form.tipo_instalacion) return 'Selecciona el tipo de instalación.'
    return ''
  }

  function validarPaso1() {
    if (sitiosSeleccionados.length === 0) return 'Selecciona al menos un sitio a cotizar (marca la casilla ☑ del sitio).'
    const sinProductos = sitiosSeleccionados
      .filter(sid => (productosMap[sid] ?? []).length === 0)
      .map(sid => sitiosCliente.find(s => s.id === sid)?.nombre ?? sid)
    if (sinProductos.length > 0) {
      return sinProductos.length === 1
        ? `El sitio "${sinProductos[0]}" no tiene productos. Agrega al menos un producto (FV o BESS) a cada sitio seleccionado.`
        : `Los sitios ${sinProductos.map(n => `"${n}"`).join(', ')} no tienen productos. Agrega al menos un producto a cada sitio seleccionado, o desmarca los que no necesites.`
    }
    return ''
  }

  function validarPaso2() {
    if (form.modalidad_financiamiento.length === 0) return 'Selecciona al menos una modalidad de financiamiento.'
    return ''
  }

  function handleNext() {
    setError('')
    const err = step === 0 ? validarPaso0() : step === 1 ? validarPaso1() : ''
    if (err) { setError(err); return }
    setStep(s => s + 1)
  }

  // ── Submit ───────────────────────────────────────────────────
  async function handleSubmit() {
    setError('')
    const err = validarPaso2()
    if (err) { setError(err); return }
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Sesión expirada.'); setLoading(false); return }

    const cliente = clientes.find(c => c.id === form.cliente_id)
    const allProds = sitiosSeleccionados.flatMap(sid => productosMap[sid] ?? [])
    const hasFV = allProds.some(p => p.tipo === 'fv')
    const hasBESS = allProds.some(p => p.tipo === 'bess')
    const tipo = hasFV && hasBESS ? 'FV+BESS' : hasFV ? 'FV' : 'BESS'

    const ubicacion_estado = sitiosCliente.find(s => s.id === sitiosSeleccionados[0])?.ubicacion_estado ?? ''

    const payload: Record<string, unknown> = {
      epcista_id: selectedEpcId,
      responsable_nodo_id: selectedResponsableId || null,
      cliente_id: clienteManual ? null : (form.cliente_id || null),
      tipo,
      nombre_proyecto: form.nombre_proyecto,
      estado: 'recibido',
      tipo_instalacion: form.tipo_instalacion,
      incluye_mem: form.incluye_mem,
      demanda_kw: null,
      cliente_final_nombre: clienteManual ? manualCliente.nombre : (cliente?.contacto_nombre ?? ''),
      cliente_final_empresa: clienteManual ? manualCliente.empresa : (cliente?.razon_social ?? ''),
      cliente_final_contacto: clienteManual ? manualCliente.contacto : (cliente?.contacto_email ?? cliente?.contacto_telefono ?? ''),
      capex_estimado: form.capex_estimado ? Number(form.capex_estimado) : null,
      moneda: form.moneda,
      ubicacion_estado,
      modalidad_financiamiento: form.modalidad_financiamiento,
      notas_adicionales: form.notas_adicionales || null,
      capacidad_mwh: null, capacidad_mw: null, tecnologia_bateria: null,
      duracion_descarga_hrs: null, punto_interconexion: null,
      tipo_participacion_mem: null, volumen_energia_mwh_anual: null,
    }

    const { data: proyecto, error: dbErr } = await supabase.from('proyectos').insert(payload).select('id').single()
    if (dbErr) { setError('Error al guardar: ' + dbErr.message); setLoading(false); return }

    // Insertar proyecto_sitios
    if (sitiosSeleccionados.length > 0) {
      await supabase.from('proyecto_sitios').insert(
        sitiosSeleccionados.map(sitio_id => ({ proyecto_id: proyecto.id, sitio_id }))
      )
    }

    // Insertar productos
    const productosRows = sitiosSeleccionados.flatMap(sitio_id =>
      (productosMap[sitio_id] ?? []).map(p => ({
        proyecto_id: proyecto.id,
        sitio_id,
        tipo: p.tipo,
        datos: p.tipo === 'fv' ? p.fv : p.bess,
      }))
    )
    if (productosRows.length > 0) {
      await supabase.from('proyecto_sitio_productos').insert(productosRows)
    }

    router.push(`/admin/proyectos/${proyecto.id}`)
  }

  const fvCalc = calcFV(fvForm)
  const bessCalc = calcBESS(bessForm)
  const anyHighDemanda = sitiosSeleccionados.some(id => (sitiosCliente.find(s => s.id === id)?.demanda_contratada_kw ?? 0) > 1000)

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black">Nuevo proyecto</h1>
        <p className="text-sm mt-1 text-muted">Completa los tres pasos para crear el proyecto</p>
      </div>

      <StepIndicator current={step} />

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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">EPCista *</label>
                <select value={selectedEpcId} onChange={e => handleSelectEpc(e.target.value)}
                  className={inp} style={borde}>
                  <option value="">Selecciona un EPCista</option>
                  {epcList.map(u => <option key={u.id} value={u.id}>{u.nombre} — {u.empresa}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Responsable Nodo</label>
                <select value={selectedResponsableId} onChange={e => setSelectedResponsableId(e.target.value)}
                  className={inp} style={borde}>
                  <option value="">Sin asignar</option>
                  {nodoUsers.map(u => <option key={u.id} value={u.id}>{u.nombre} ({u.rol === 'nodo_admin' ? 'Admin' : 'Analista'})</option>)}
                </select>
              </div>
            </div>

            <hr className="border-borde rounded-xl" />

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium">Cliente *</label>
                {selectedEpcId && (
                  <button type="button"
                    onClick={() => { setClienteManual(!clienteManual); setForm(prev => ({ ...prev, cliente_id: '' })) }}
                    className="text-xs font-medium underline transition-colors"
                    style={{ color: clienteManual ? '#15803D' : '#666' }}>
                    {clienteManual ? '← Elegir cliente existente' : 'Ingresar datos manualmente'}
                  </button>
                )}
              </div>

              {!clienteManual ? (
                <>
                  {!selectedEpcId && (
                    <p className="text-xs text-gray-400">Selecciona un EPCista primero para ver sus clientes.</p>
                  )}
                  {selectedEpcId && clientesCargados && (
                    <select value={form.cliente_id} onChange={e => seleccionarCliente(e.target.value)}
                      className={inp} style={borde}>
                      <option value="">Selecciona un cliente</option>
                      {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
                    </select>
                  )}
                  {selectedEpcId && clientesCargados && clientes.length === 0 && (
                    <p className="text-xs text-gray-400 mt-1">Este EPCista no tiene clientes. Puedes ingresar datos manualmente.</p>
                  )}
                </>
              ) : (
                <div className="border border-borde rounded-lg p-4 flex flex-col gap-3 bg-gray-50/50">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Datos del cliente (manual)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Nombre contacto *</label>
                      <input type="text" value={manualCliente.nombre}
                        onChange={e => setManualCliente(prev => ({ ...prev, nombre: e.target.value }))}
                        className={inp} style={borde} placeholder="Juan Pérez" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Empresa *</label>
                      <input type="text" value={manualCliente.empresa}
                        onChange={e => setManualCliente(prev => ({ ...prev, empresa: e.target.value }))}
                        className={inp} style={borde} placeholder="Empresa del cliente" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Email o teléfono de contacto</label>
                    <input type="text" value={manualCliente.contacto}
                      onChange={e => setManualCliente(prev => ({ ...prev, contacto: e.target.value }))}
                      className={inp} style={borde} placeholder="cliente@empresa.com" />
                  </div>
                </div>
              )}
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
                        borderColor: selected ? '#000' : '#E5E5E5',
                        backgroundColor: selected ? '#000' : '#fff',
                        boxShadow: selected ? '0 4px 12px rgba(0,0,0,0.1)' : '0 1px 2px rgba(0,0,0,0.02)'
                      }}>
                      <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ borderColor: selected ? '#D7FF2F' : '#CFCFCF' }}>
                        {selected && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#D7FF2F' }} />}
                      </div>
                      <div>
                        <div className="font-semibold text-sm" style={{ color: selected ? '#D7FF2F' : '#000' }}>
                          {opt.title}
                        </div>
                        <div className="text-xs mt-1.5" style={{ color: selected ? '#aaa' : '#666' }}>
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

        {/* ══ PASO 1 — Sitios y productos ══════════════════════ */}
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <h2 className="font-bold text-lg">Sitios y productos</h2>

            <div>
              <label className="block text-sm font-medium mb-2">Sitios a cotizar *</label>

              {sitiosCliente.length === 0 && !mostrarNuevoSitio && (
                <p className="text-sm mb-3 text-muted">Este cliente no tiene sitios registrados.</p>
              )}

              {/* Lista de sitios */}
              <div className="flex flex-col gap-1 mb-3">
                {sitiosCliente.map(s => {
                  const selected = sitiosSeleccionados.includes(s.id)
                  const productos = productosMap[s.id] ?? []
                  const isAdding = addingToSitioId === s.id

                  return (
                    <div key={s.id}>
                      {/* Fila sitio */}
                      <div className="flex items-center gap-3 border rounded-xl p-3 shadow-sm transition-all" style={{
                        borderColor: selected ? '#000' : '#E5E5E5',
                        backgroundColor: selected ? '#fafafa' : '#fff',
                      }}>
                        <input type="checkbox" id={`s-${s.id}`} checked={selected}
                          onChange={() => toggleSitio(s.id)} className="w-4 h-4 flex-shrink-0" />
                        <label htmlFor={`s-${s.id}`} className="flex-1 cursor-pointer min-w-0">
                          <div className="text-sm font-semibold">{s.nombre}</div>
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
                              borderColor: viendoSitioId === s.id ? '#000' : '#E5E5E5',
                              backgroundColor: viendoSitioId === s.id ? '#000' : '#fff',
                              color: viendoSitioId === s.id ? '#D7FF2F' : '#444',
                            }}>
                            <Eye size={13} />
                          </button>
                          <button type="button" onClick={() => abrirEditarSitio(s)}
                            className="p-1.5 border rounded-lg transition-colors hover:shadow-sm"
                            style={{
                              borderColor: editandoSitioId === s.id ? '#000' : '#E5E5E5',
                              backgroundColor: editandoSitioId === s.id ? '#f0f0f0' : '#fff',
                              color: '#444',
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
                        <div className="border border-t-0 px-4 py-3" style={{ borderColor: '#000', backgroundColor: '#fafafa' }}>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                            {s.nombre_recibo && <div><span className="text-muted">Nombre en recibo: </span><span className="font-medium">{s.nombre_recibo}</span></div>}
                            {(s.ciudad || s.ubicacion_estado) && <div><span className="text-muted">Ubicación: </span><span className="font-medium">{[s.ciudad, s.ubicacion_estado].filter(Boolean).join(', ')}</span></div>}
                            {s.rpu && <div><span className="text-muted">RPU: </span><span className="font-medium">{s.rpu}</span></div>}
                            {s.demanda_contratada_kw != null && <div><span className="text-muted">Demanda: </span><span className="font-medium">{s.demanda_contratada_kw.toLocaleString('es-MX')} kW</span></div>}
                            {s.recibo_url && (
                              <div className="col-span-2">
                                <a href={s.recibo_url} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1 underline font-medium" style={{ color: '#000' }}>
                                  <FileText size={11} /> Ver recibo CFE
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Panel Editar sitio */}
                      {editandoSitioId === s.id && (
                        <div className="border border-t-0 px-4 py-4" style={{ borderColor: '#000' }}>
                          <p className="text-xs font-bold mb-3">Editar sitio</p>
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

                      {/* Productos — solo cuando el sitio está seleccionado */}
                      {selected && (
                        <div className="border border-t-0 px-3 py-3" style={{ borderColor: '#000', backgroundColor: '#fafafa' }}>
                          <p className="text-xs font-bold uppercase tracking-wide mb-2 text-muted">
                            Productos del sitio
                          </p>

                          {/* Tarjetas de productos existentes */}
                          {productos.length > 0 && (
                            <div className="flex flex-col gap-2 mb-3">
                              {productos.map(p => (
                                <ProductoCard key={p.tempId} p={p}
                                  onRemove={() => removeProduct(s.id, p.tempId)} />
                              ))}
                            </div>
                          )}

                          {/* Formulario agregar producto */}
                          {isAdding ? (
                            <div className="border p-4" style={{ borderColor: '#000', backgroundColor: '#fff' }}>
                              {/* Selector de tipo */}
                              {!productTipo ? (
                                <div>
                                  <p className="text-xs font-bold mb-3">¿Qué tipo de producto?</p>
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
                                    <p className="text-sm font-bold flex items-center gap-2"><Zap size={14} /> Fotovoltaico</p>
                                    <button type="button" onClick={() => setProductTipo(null)}
                                      className="text-xs underline text-muted">← Cambiar tipo</button>
                                  </div>
                                  <div className="flex flex-col gap-3">
                                    {/* Módulos */}
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Módulos</p>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                                      <div>
                                        <label className="block text-xs font-medium mb-1">No. Módulos *</label>
                                        <input type="number" min="0" value={fvForm.num_modulos}
                                          onChange={e => setFvForm(f => ({ ...f, num_modulos: e.target.value }))}
                                          className={inp} style={borde} placeholder="0" />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium mb-1">Potencia (W) *</label>
                                        <input type="number" min="0" value={fvForm.potencia_modulos_w}
                                          onChange={e => setFvForm(f => ({ ...f, potencia_modulos_w: e.target.value }))}
                                          className={inp} style={borde} placeholder="0" />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium mb-1">Marca *</label>
                                        <input type="text" value={fvForm.marca_modulos}
                                          onChange={e => setFvForm(f => ({ ...f, marca_modulos: e.target.value }))}
                                          className={inp} style={borde} placeholder="Jinko, LONGi…" />
                                      </div>
                                    </div>
                                    {/* Calculados módulos */}
                                    <div className="grid grid-cols-2 gap-2">
                                      <CalcField label="kWp sistema" value={fvCalc.kwpSistema} unit="kWp" />
                                    </div>

                                    {/* Inversores */}
                                    <p className="text-xs font-semibold uppercase tracking-wide mt-1 text-muted">Inversores</p>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                                      <div>
                                        <label className="block text-xs font-medium mb-1">No. Inversores *</label>
                                        <input type="number" min="0" value={fvForm.num_inversores}
                                          onChange={e => setFvForm(f => ({ ...f, num_inversores: e.target.value }))}
                                          className={inp} style={borde} placeholder="0" />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium mb-1">Potencia (kW) *</label>
                                        <input type="number" min="0" value={fvForm.potencia_inversores_kw}
                                          onChange={e => setFvForm(f => ({ ...f, potencia_inversores_kw: e.target.value }))}
                                          className={inp} style={borde} placeholder="0" />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium mb-1">Marca *</label>
                                        <input type="text" value={fvForm.marca_inversores}
                                          onChange={e => setFvForm(f => ({ ...f, marca_inversores: e.target.value }))}
                                          className={inp} style={borde} placeholder="Huawei, SMA…" />
                                      </div>
                                    </div>
                                    {/* Calculado inversores */}
                                    <div className="grid grid-cols-2 gap-2">
                                      <CalcField label="kWp inversores" value={fvCalc.kwpInversores} unit="kW" />
                                    </div>

                                    {/* Energía y CAPEX */}
                                    <p className="text-xs font-semibold uppercase tracking-wide mt-1 text-muted">Energía y costos</p>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <label className="block text-xs font-medium mb-1">Generación anual (kWh) *</label>
                                        <input type="number" min="0" value={fvForm.generacion_anual_kwh}
                                          onChange={e => setFvForm(f => ({ ...f, generacion_anual_kwh: e.target.value }))}
                                          className={inp} style={borde} placeholder="0" />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium mb-1">CAPEX ($) *</label>
                                        <input type="number" min="0" value={fvForm.capex}
                                          onChange={e => setFvForm(f => ({ ...f, capex: e.target.value }))}
                                          className={inp} style={borde} placeholder="0" />
                                      </div>
                                    </div>
                                    {/* Precio/Wp calculado */}
                                    <CalcField label="Precio por Watt" value={fvCalc.precioWatt} unit="$/W" />
                                  </div>
                                </div>
                              ) : (
                                /* Formulario BESS */
                                <div>
                                  <div className="flex items-center justify-between mb-4">
                                    <p className="text-sm font-bold flex items-center gap-2"><Battery size={14} /> BESS</p>
                                    <button type="button" onClick={() => setProductTipo(null)}
                                      className="text-xs underline text-muted">← Cambiar tipo</button>
                                  </div>
                                  <div className="flex flex-col gap-3">
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                                      <div>
                                        <label className="block text-xs font-medium mb-1">Potencia (kW) *</label>
                                        <input type="number" min="0" value={bessForm.potencia_kw}
                                          onChange={e => setBessForm(f => ({ ...f, potencia_kw: e.target.value }))}
                                          className={inp} style={borde} placeholder="0" />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium mb-1">Capacidad (kWh) *</label>
                                        <input type="number" min="0" value={bessForm.capacidad_kwh}
                                          onChange={e => setBessForm(f => ({ ...f, capacidad_kwh: e.target.value }))}
                                          className={inp} style={borde} placeholder="0" />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium mb-1">Marca *</label>
                                        <input type="text" value={bessForm.marca}
                                          onChange={e => setBessForm(f => ({ ...f, marca: e.target.value }))}
                                          className={inp} style={borde} placeholder="BYD, Tesla…" />
                                      </div>
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium mb-1">Uso *</label>
                                      <select value={bessForm.uso}
                                        onChange={e => setBessForm(f => ({ ...f, uso: e.target.value }))}
                                        className={inp} style={borde}>
                                        <option value="">Selecciona el uso</option>
                                        <option value="load_shifting">Load Shifting</option>
                                        <option value="ups">UPS</option>
                                        <option value="load_shifting_ups">Load Shifting + UPS</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium mb-1">CAPEX ($) *</label>
                                      <input type="number" min="0" value={bessForm.capex}
                                        onChange={e => setBessForm(f => ({ ...f, capex: e.target.value }))}
                                        className={inp} style={borde} placeholder="0" />
                                    </div>
                                    {/* Precio/kWh calculado */}
                                    <CalcField label="Precio por kWh" value={bessCalc.precioKwh} unit="$/kWh" />
                                  </div>
                                </div>
                              )}

                              {addProductError && (
                                <p className="text-xs text-red-600 mt-3">{addProductError}</p>
                              )}

                              {productTipo && (
                                <div className="flex justify-between mt-4">
                                  <button type="button" onClick={() => { setAddingToSitioId(null); setAddProductError('') }}
                                    className="px-3 py-1.5 text-xs border border-borde rounded-xl">
                                    Cancelar
                                  </button>
                                  <button type="button" onClick={addProduct}
                                    className="px-4 py-1.5 text-xs font-bold bg-acento text-principal rounded-xl">
                                    Agregar producto
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <button type="button" onClick={() => startAddingProduct(s.id)}
                              className="flex items-center gap-2 px-3 py-2 text-xs border font-medium w-full justify-center border-borde border-dashed rounded-xl">
                              <Plus size={12} />
                              {productos.length === 0 ? 'Agregar producto' : 'Agregar otro producto'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Agregar nuevo sitio inline */}
              {mostrarNuevoSitio ? (
                <div className="border p-4" style={{ borderColor: '#000' }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold">Nuevo sitio</span>
                    <button type="button" onClick={() => { setMostrarNuevoSitio(false); setNuevoSitio(emptyNuevoSitio); setReciboUrlNuevo(null) }}>
                      <X size={14} />
                    </button>
                  </div>
                  <div className="flex flex-col gap-3">
                    <input type="text" value={nuevoSitio.nombre}
                      onChange={e => setNuevoSitio(f => ({ ...f, nombre: e.target.value }))}
                      className={inp} style={borde} placeholder="Nombre del sitio *" />
                    <input type="text" value={nuevoSitio.nombre_recibo}
                      onChange={e => setNuevoSitio(f => ({ ...f, nombre_recibo: e.target.value }))}
                      className={inp} style={borde} placeholder="Nombre como aparece en el recibo" />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <input type="text" value={nuevoSitio.ciudad}
                        onChange={e => setNuevoSitio(f => ({ ...f, ciudad: e.target.value }))}
                        className={inp} style={borde} placeholder="Ciudad" />
                      <select value={nuevoSitio.ubicacion_estado}
                        onChange={e => setNuevoSitio(f => ({ ...f, ubicacion_estado: e.target.value }))}
                        className={inp} style={borde}>
                        <option value="">Estado</option>
                        {ESTADOS_MX.map(est => <option key={est} value={est}>{est}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '12px' }}>
                      <input type="text" value={nuevoSitio.rpu}
                        onChange={e => setNuevoSitio(f => ({ ...f, rpu: e.target.value }))}
                        className={inp} style={borde} placeholder="RPU" />
                      <input type="number" min="0" value={nuevoSitio.demanda_contratada_kw}
                        onChange={e => setNuevoSitio(f => ({ ...f, demanda_contratada_kw: e.target.value }))}
                        className={inp} style={borde} placeholder="Demanda contratada (kW)" />
                    </div>
                    <div className="flex items-center gap-3">
                      <input ref={fileRefNuevo} type="file" accept=".pdf" onChange={subirPdfNuevo} className="hidden" id="nuevo-recibo-pdf" />
                      <label htmlFor="nuevo-recibo-pdf"
                        className="flex items-center gap-1.5 px-3 py-1.5 border text-xs font-medium cursor-pointer border-borde rounded-xl">
                        <Upload size={11} />
                        {subiendoPdfNuevo ? 'Subiendo…' : 'Recibo CFE (PDF)'}
                      </label>
                      {reciboUrlNuevo && (
                        <a href={reciboUrlNuevo} target="_blank" rel="noopener noreferrer"
                          className="text-xs underline flex items-center gap-1">
                          <FileText size={11} /> Ver PDF
                        </a>
                      )}
                    </div>
                  </div>
                  {sitioError && (
                    <p className="text-xs text-red-600 mt-2">{sitioError}</p>
                  )}
                  <div className="flex justify-end mt-3">
                    <button type="button" onClick={guardarNuevoSitio}
                      disabled={guardandoSitio || !nuevoSitio.nombre.trim()}
                      className="px-4 py-2 text-xs font-bold disabled:opacity-50 bg-acento text-principal rounded-xl">
                      {guardandoSitio ? 'Guardando…' : 'Agregar sitio'}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button"
                  onClick={() => { setMostrarNuevoSitio(true); setSitioError(''); setViendoSitioId(null); setEditandoSitioId(null); setAddingToSitioId(null) }}
                  className="flex items-center gap-2 px-3 py-2 text-sm border font-medium w-full justify-center border-borde border-dashed rounded-xl">
                  <Plus size={14} />
                  {sitiosCliente.length === 0 ? 'Agregar sitio' : 'Agregar otro sitio'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ══ PASO 2 — Financiamiento ═══════════════════════════ */}
        {step === 2 && (
          <div className="flex flex-col gap-5">
            <h2 className="font-bold text-lg">Financiamiento</h2>

            {anyHighDemanda && (
              <div className="border p-4" style={{ borderColor: '#D7FF2F', backgroundColor: '#fffff0' }}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.incluye_mem}
                    onChange={e => setF('incluye_mem', e.target.checked)}
                    className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold">Considerar alternativa de Mercado Eléctrico Mayorista</p>
                    <p className="text-xs mt-0.5 text-muted">
                      Uno o más sitios seleccionados tienen más de 1,000 kW de demanda contratada. El analista evaluará si conviene migrar al MEM.
                    </p>
                  </div>
                </label>
              </div>
            )}

            <hr className="border-borde rounded-xl" />

            {/* Modalidad */}
            <div>
              <label className="block text-sm font-medium mb-2">Modalidad de financiamiento *</label>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: 'credito', label: 'Crédito', desc: 'Financiamiento bancario o institucional' },
                  { value: 'arrendamiento', label: 'Arrendamiento', desc: 'Renta de equipos a largo plazo' },
                  { value: 'ensaas', label: 'EnSaaS', desc: 'Energy Storage as a Service' },
                  { value: 'mem', label: 'Mercado Eléctrico Mayorista', desc: 'Ingresos por participación MEM' },
                ] as { value: ModalidadFinanciamiento; label: string; desc: string }[]).map(opt => {
                  const selected = form.modalidad_financiamiento.includes(opt.value)
                  return (
                    <button key={opt.value} type="button"
                      onClick={() => toggleModalidad(opt.value)}
                      className="border rounded-xl p-4 text-left transition-all duration-200"
                      style={{ 
                        borderColor: selected ? '#000' : '#E5E5E5', 
                        backgroundColor: selected ? '#000' : '#fff', 
                        color: selected ? '#D7FF2F' : '#000',
                        boxShadow: selected ? '0 4px 12px rgba(0,0,0,0.1)' : '0 1px 2px rgba(0,0,0,0.02)'
                      }}>
                      <div className="font-semibold text-sm">{opt.label}</div>
                      <div className="text-xs mt-0.5 opacity-70">{opt.desc}</div>
                    </button>
                  )
                })}
              </div>
              <div className="mt-3">
                <button type="button" onClick={() => toggleModalidad('no_sabe')}
                  className="border rounded-xl p-4 text-left w-full transition-all duration-200"
                  style={{
                    borderColor: form.modalidad_financiamiento.includes('no_sabe') ? '#000' : '#E5E5E5',
                    backgroundColor: form.modalidad_financiamiento.includes('no_sabe') ? '#D7FF2F' : '#fff',
                    boxShadow: form.modalidad_financiamiento.includes('no_sabe') ? '0 4px 12px rgba(0,0,0,0.06)' : '0 1px 2px rgba(0,0,0,0.02)',
                    color: '#000',
                  }}>
                  <div className="font-semibold text-sm">Prefiero que Nodo me recomiende las mejores alternativas para este cliente</div>
                  <div className="text-xs mt-0.5 text-muted">El analista definirá la modalidad más adecuada</div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Notas adicionales</label>
              <textarea value={form.notas_adicionales} onChange={e => setF('notas_adicionales', e.target.value)}
                rows={3} className={inp} style={borde}
                placeholder="Cualquier información adicional relevante para el analista…" />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

        <div className="flex justify-between mt-10">
          <button type="button" onClick={() => { setError(''); setStep(s => s - 1) }}
            disabled={step === 0} className="px-5 py-2.5 text-sm font-medium border border-borde rounded-lg hover:bg-gray-50 transition-all disabled:opacity-30">
            Anterior
          </button>
          {step < 2 ? (
            <button type="button" onClick={handleNext}
              className="px-6 py-2.5 text-sm font-semibold rounded-lg shadow-sm hover:shadow-md transition-all active:scale-[0.98] bg-acento text-principal rounded-xl">
              Siguiente
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={loading}
              className="px-6 py-2.5 text-sm font-semibold rounded-lg shadow-sm hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-50 hover:bg-[#1a1a1a]"
              style={{ backgroundColor: '#000', color: '#D7FF2F' }}>
              {loading ? 'Enviando...' : 'Enviar proyecto'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
