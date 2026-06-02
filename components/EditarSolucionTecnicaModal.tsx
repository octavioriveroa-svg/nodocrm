/* eslint-disable */
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Plus, Zap, Battery, Trash2, Edit2, AlertCircle, Check } from 'lucide-react'
import type { Proyecto, Sitio, ProyectoSitioProducto, ConfiguracionTecnica, ModalidadFinanciamiento, Moneda } from '@/lib/types'
import { parseNum, formatNumberInput, fmtNum, fmtCurrency } from '@/lib/format'

interface FVForm {
  num_modulos: string
  potencia_modulos_w: string
  marca_modulos: string
  num_inversores: string
  potencia_inversores_kw: string
  marca_inversores: string
  generacion_anual_kwh: string
  capex: string
  capex_moneda: string
}

interface BESSForm {
  potencia_kw: string
  capacidad_kwh: string
  marca: string
  uso: string
  capex: string
  capex_moneda: string
}

interface Producto {
  id?: string
  tempId: string
  tipo: 'fv' | 'bess'
  fv?: FVForm
  bess?: BESSForm
}

interface CreationConfig {
  id?: string
  tempId: string
  nombre: string
  descripcion: string
  sitiosSeleccionados: string[]
  productosMap: Record<string, Producto[]>
}

interface Props {
  isOpen: boolean
  onClose: () => void
  proyecto: Proyecto
  configuraciones: ConfiguracionTecnica[]
  productos: ProyectoSitioProducto[]
  sitios: Sitio[] // current project sites
  onSave: () => void
}

const ESTADOS_MX = [
  'Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas','Chihuahua',
  'Ciudad de México','Coahuila','Colima','Durango','Estado de México','Guanajuato','Guerrero',
  'Hidalgo','Jalisco','Michoacán','Morelos','Nayarit','Nuevo León','Oaxaca','Puebla','Querétaro',
  'Quintana Roo','San Luis Potosí','Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala',
  'Veracruz','Yucatán','Zacatecas',
]

const emptyFv: FVForm = {
  num_modulos: '',
  potencia_modulos_w: '',
  marca_modulos: '',
  num_inversores: '',
  potencia_inversores_kw: '',
  marca_inversores: '',
  generacion_anual_kwh: '',
  capex: '',
  capex_moneda: 'USD',
}

const emptyBess: BESSForm = {
  potencia_kw: '',
  capacidad_kwh: '',
  marca: '',
  uso: 'load_shifting',
  capex: '',
  capex_moneda: 'USD',
}

export default function EditarSolucionTecnicaModal({ isOpen, onClose, proyecto, configuraciones, productos, sitios, onSave }: Props) {
  const supabase = createClient()
  const [configs, setConfigs] = useState<CreationConfig[]>([])
  const [activeConfigId, setActiveConfigId] = useState<string>('')
  const [sitiosCliente, setSitiosCliente] = useState<Sitio[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Product form states
  const [addingToSitioId, setAddingToSitioId] = useState<string | null>(null)
  const [productTipo, setProductTipo] = useState<'fv' | 'bess' | null>(null)
  const [editingProduct, setEditingProduct] = useState<Producto | null>(null)
  const [fvForm, setFvForm] = useState<FVForm>(emptyFv)
  const [bessForm, setBessForm] = useState<BESSForm>(emptyBess)

  // Fetch all sites of the client
  useEffect(() => {
    if (proyecto.cliente_id && isOpen) {
      supabase.from('sitios').select('*').eq('cliente_id', proyecto.cliente_id).order('nombre')
        .then(({ data }) => {
          if (data) setSitiosCliente(data as Sitio[])
        })
    }
  }, [proyecto.cliente_id, isOpen])

  // Load and map configurations and products on open
  useEffect(() => {
    if (isOpen) {
      const list = configuraciones ?? []
      const mapped: CreationConfig[] = list.map(c => {
        const configProducts = (productos ?? []).filter(p => p.configuracion_id === c.id || (c.id === 'legacy' && !p.configuracion_id))
        const sitiosSeleccionados = Array.from(new Set(configProducts.map(p => p.sitio_id)))

        const productosMap: Record<string, Producto[]> = {}
        for (const p of configProducts) {
          if (!productosMap[p.sitio_id]) productosMap[p.sitio_id] = []
          const d = p.datos as any
          productosMap[p.sitio_id].push({
            id: p.id,
            tempId: p.id,
            tipo: p.tipo,
                        fv: p.tipo === 'fv' ? {
              num_modulos: formatNumberInput(String(d.num_modulos ?? '')),
              potencia_modulos_w: formatNumberInput(String(d.potencia_modulos_w ?? '')),
              marca_modulos: String(d.marca_modulos ?? ''),
              num_inversores: formatNumberInput(String(d.num_inversores ?? '')),
              potencia_inversores_kw: formatNumberInput(String(d.potencia_inversores_kw ?? '')),
              marca_inversores: String(d.marca_inversores ?? ''),
              generacion_anual_kwh: formatNumberInput(String(d.generacion_anual_kwh ?? '')),
              capex: formatNumberInput(String(d.capex ?? '')),
              capex_moneda: String(d.capex_moneda ?? 'USD'),
            } : undefined,
            bess: p.tipo === 'bess' ? {
              potencia_kw: formatNumberInput(String(d.potencia_kw ?? '')),
              capacidad_kwh: formatNumberInput(String(d.capacidad_kwh ?? '')),
              marca: String(d.marca ?? ''),
              uso: String(d.uso ?? 'load_shifting'),
              capex: formatNumberInput(String(d.capex ?? '')),
              capex_moneda: String(d.capex_moneda ?? 'USD'),
            } : undefined
          })
        }

        return {
          id: c.id,
          tempId: c.id,
          nombre: c.nombre,
          descripcion: c.descripcion || '',
          sitiosSeleccionados,
          productosMap
        }
      })

      if (mapped.length === 0) {
        mapped.push({
          tempId: 'default',
          nombre: 'Configuración A',
          descripcion: '',
          sitiosSeleccionados: [],
          productosMap: {}
        })
      }

      setConfigs(mapped)
      setActiveConfigId(mapped[0].tempId)
    }
  }, [isOpen, configuraciones, productos])

  if (!isOpen) return null

  const activeConfig = configs.find(c => c.tempId === activeConfigId) || configs[0]
  if (!activeConfig) return null

  // Calculate active config capex
  const activeProducts = Object.values(activeConfig.productosMap).flat()
  const activeConfigCapex = activeProducts.reduce((sum, p) => {
    const pCapex = p.tipo === 'fv' ? parseNum(p.fv?.capex) : parseNum(p.bess?.capex)
    return sum + pCapex
  }, 0)

  // Calculations for FV
  const fvCalc = {
    kwpSistema: parseNum(fvForm.num_modulos) * parseNum(fvForm.potencia_modulos_w) / 1000 || null,
    kwpInversores: parseNum(fvForm.num_inversores) * parseNum(fvForm.potencia_inversores_kw) || null,
    precioWatt: parseNum(fvForm.capex) && parseNum(fvForm.num_modulos) && parseNum(fvForm.potencia_modulos_w) 
      ? parseNum(fvForm.capex) / (parseNum(fvForm.num_modulos) * parseNum(fvForm.potencia_modulos_w)) 
      : null
  }

  // Calculations for BESS
  const bessCalc = {
    precioKwh: parseNum(bessForm.capex) && parseNum(bessForm.capacidad_kwh)
      ? parseNum(bessForm.capex) / parseNum(bessForm.capacidad_kwh)
      : null
  }

  function handleSaveProduct() {
    if (!addingToSitioId) return
    setError(null)

    if (productTipo === 'fv') {
      if (!fvForm.num_modulos || !fvForm.potencia_modulos_w || !fvForm.marca_modulos.trim() || !fvForm.num_inversores || !fvForm.potencia_inversores_kw || !fvForm.marca_inversores.trim() || !fvForm.generacion_anual_kwh || !fvForm.capex) {
        setError('Completa todos los campos obligatorios del Fotovoltaico.')
        return
      }
    } else {
      if (!bessForm.potencia_kw || !bessForm.capacidad_kwh || !bessForm.marca.trim() || !bessForm.capex) {
        setError('Completa todos los campos obligatorios de BESS.')
        return
      }
    }

    const newProd: Producto = {
      tempId: editingProduct?.tempId || `prod-${Date.now()}`,
      id: editingProduct?.id,
      tipo: productTipo!,
      fv: productTipo === 'fv' ? { ...fvForm } : undefined,
      bess: productTipo === 'bess' ? { ...bessForm } : undefined
    }

    setConfigs(prev => prev.map(c => {
      if (c.tempId !== activeConfigId) return c
      const list = c.productosMap[addingToSitioId] || []
      const exists = list.some(item => item.tempId === newProd.tempId)
      const nextList = exists
        ? list.map(item => item.tempId === newProd.tempId ? newProd : item)
        : [...list, newProd]

      return {
        ...c,
        productosMap: {
          ...c.productosMap,
          [addingToSitioId]: nextList
        }
      }
    }))

    // Reset forms
    setAddingToSitioId(null)
    setProductTipo(null)
    setEditingProduct(null)
    setFvForm(emptyFv)
    setBessForm(emptyBess)
  }

  function handleEditProduct(sitioId: string, p: Producto) {
    setAddingToSitioId(sitioId)
    setProductTipo(p.tipo)
    setEditingProduct(p)
    if (p.tipo === 'fv' && p.fv) {
      setFvForm(p.fv)
    } else if (p.tipo === 'bess' && p.bess) {
      setBessForm(p.bess)
    }
  }

  function handleRemoveProduct(sitioId: string, tempId: string) {
    setConfigs(prev => prev.map(c => {
      if (c.tempId !== activeConfigId) return c
      const list = c.productosMap[sitioId] || []
      return {
        ...c,
        productosMap: {
          ...c.productosMap,
          [sitioId]: list.filter(item => item.tempId !== tempId)
        }
      }
    }))
  }

  async function handleSave() {
    setLoading(true)
    setError(null)
    try {
      // 1. Validate all configs
      for (let i = 0; i < configs.length; i++) {
        const c = configs[i]
        if (!c.nombre.trim()) {
          throw new Error(`La alternativa ${i + 1} requiere un nombre.`)
        }
        if (c.sitiosSeleccionados.length === 0) {
          throw new Error(`La alternativa "${c.nombre}" debe tener al menos un sitio seleccionado.`)
        }
        // Verify that selected sites have at least one product
        for (const sId of c.sitiosSeleccionados) {
          const list = c.productosMap[sId] || []
          if (list.length === 0) {
            const sitioNombre = sitiosCliente.find(s => s.id === sId)?.nombre ?? 'Sitio'
            throw new Error(`El sitio "${sitioNombre}" en la alternativa "${c.nombre}" no tiene productos. Agrega al menos uno.`)
          }
        }
      }

      // 2. Insert new configs & update existing configs
      const newConfigs = configs.filter(c => c.tempId.startsWith('config-') || c.tempId === 'default')
      const existingConfigs = configs.filter(c => !c.tempId.startsWith('config-') && c.tempId !== 'default')

      // A. Update existing configurations
      for (const c of existingConfigs) {
        const configProducts = Object.values(c.productosMap).flat()
        const inversion_total = configProducts.reduce((sum, p) => sum + (p.tipo === 'fv' ? parseNum(p.fv?.capex) : parseNum(p.bess?.capex)), 0)

        const { error: err } = await supabase.from('configuraciones_tecnicas').update({
          nombre: c.nombre,
          descripcion: c.descripcion || null,
          inversion_total
        }).eq('id', c.id!)
        if (err) throw err
      }

      // B. Insert new configurations
      const newConfigsPayload = newConfigs.map(c => {
        const configProducts = Object.values(c.productosMap).flat()
        const inversion_total = configProducts.reduce((sum, p) => sum + (p.tipo === 'fv' ? parseNum(p.fv?.capex) : parseNum(p.bess?.capex)), 0)

        return {
          proyecto_id: proyecto.id,
          nombre: c.nombre,
          descripcion: c.descripcion || null,
          inversion_total,
          moneda: proyecto.moneda || 'MXN',
          seleccionada: false
        }
      })

      let insertedConfigs: any[] = []
      if (newConfigsPayload.length > 0) {
        const { data, error: err } = await supabase.from('configuraciones_tecnicas').insert(newConfigsPayload).select('*')
        if (err) throw err
        insertedConfigs = data || []
      }

      // Map tempId to DB UUID
      const idMap: Record<string, string> = {}
      existingConfigs.forEach(c => { idMap[c.tempId] = c.id! })
      newConfigs.forEach(c => {
        const dbConfig = insertedConfigs.find(db => db.nombre === c.nombre)
        if (dbConfig) idMap[c.tempId] = dbConfig.id
      })

      // C. Delete removed configurations
      const configIdsToKeep = configs.map(c => c.id).filter(Boolean) as string[]
      const configsToDelete = (configuraciones ?? []).filter(c => !configIdsToKeep.includes(c.id))
      if (configsToDelete.length > 0) {
        const { error: err } = await supabase.from('configuraciones_tecnicas').delete().in('id', configsToDelete.map(c => c.id))
        if (err) throw err
      }

      // 3. Sync project sites (proyecto_sitios relation)
      const activeSitesUnion = Array.from(new Set(configs.flatMap(c => c.sitiosSeleccionados)))
      const existingSiteIds = (sitios ?? []).map(s => s.id)

      const sitesToInsert = activeSitesUnion.filter(id => !existingSiteIds.includes(id))
      if (sitesToInsert.length > 0) {
        const { error: err } = await supabase.from('proyecto_sitios').insert(
          sitesToInsert.map(sitio_id => ({ proyecto_id: proyecto.id, sitio_id }))
        )
        if (err) throw err
      }

      const sitesToDelete = existingSiteIds.filter(id => !activeSitesUnion.includes(id))
      if (sitesToDelete.length > 0) {
        const { error: err } = await supabase.from('proyecto_sitios').delete().eq('proyecto_id', proyecto.id).in('sitio_id', sitesToDelete)
        if (err) throw err
      }

      // 4. Sync products (proyecto_sitio_productos)
      const activeProductsList: any[] = []
      configs.forEach(c => {
        const configDbId = idMap[c.tempId]
        Object.entries(c.productosMap).forEach(([siteId, prods]) => {
          prods.forEach(p => {
            activeProductsList.push({
              id: p.id && !p.id.startsWith('prod-') ? p.id : undefined,
              proyecto_id: proyecto.id,
              sitio_id: siteId,
              configuracion_id: configDbId,
              tipo: p.tipo,
              datos: p.tipo === 'fv' ? p.fv : p.bess
            })
          })
        })
      })

      // Delete removed products
      const activeProductIds = activeProductsList.map(p => p.id).filter(Boolean) as string[]
      const productsToDelete = (productos ?? []).map(p => p.id).filter(id => !activeProductIds.includes(id))
      if (productsToDelete.length > 0) {
        const { error: err } = await supabase.from('proyecto_sitio_productos').delete().in('id', productsToDelete)
        if (err) throw err
      }

      // Upsert current products
      const upsertPayload = activeProductsList.map(p => ({
        id: p.id || undefined,
        proyecto_id: p.proyecto_id,
        sitio_id: p.sitio_id,
        configuracion_id: p.configuracion_id,
        tipo: p.tipo,
        datos: p.datos
      }))
      if (upsertPayload.length > 0) {
        const { error: err } = await supabase.from('proyecto_sitio_productos').upsert(upsertPayload)
        if (err) throw err
      }

      // 5. Update summary fields on the project using the selected config (or first config)
      const selectedConfig = configs.find(c => {
        if (c.id) {
          const orig = configuraciones?.find(o => o.id === c.id)
          return orig?.seleccionada
        }
        return false
      }) || configs[0]
      const winningInversion = Object.values(selectedConfig.productosMap).flat().reduce((sum, p) => sum + (p.tipo === 'fv' ? parseNum(p.fv?.capex) : parseNum(p.bess?.capex)), 0)

      await supabase.from('proyectos').update({
        capex_estimado: winningInversion
      }).eq('id', proyecto.id)

      onSave()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Error al guardar los cambios.')
    } finally {
      setLoading(false)
    }
  }

  const inp = 'w-full border rounded-xl p-2 text-sm bg-white'
  const borde = { borderColor: '#E5E5E5' }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl border border-borde">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-borde flex items-center justify-between bg-[#fafafa] rounded-t-2xl">
          <div>
            <h3 className="font-bold text-base text-principal">Editar Solución Técnica</h3>
            <p className="text-xs text-muted">Configura las alternativas técnicas, los sitios y los productos del proyecto.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-muted hover:text-principal transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-5 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Client check warning */}
          {!proyecto.cliente_id && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-xs font-semibold flex flex-col gap-1">
              <span className="font-bold">⚠️ Cliente requerido</span>
              <span>Debes asignar un cliente al proyecto antes de poder vincular sitios y productos. Cancela y edita los campos del proyecto primero.</span>
            </div>
          )}

          {proyecto.cliente_id && (
            <>
              {/* Configurations Tab Bar */}
              <div className="flex flex-wrap gap-2 pb-2 border-b border-borde">
                {configs.map((c, idx) => {
                  const isActive = activeConfigId === c.tempId
                  return (
                    <button
                      key={c.tempId}
                      type="button"
                      onClick={() => {
                        setActiveConfigId(c.tempId)
                        setAddingToSitioId(null)
                        setProductTipo(null)
                      }}
                      className="px-4 py-2 text-xs font-semibold rounded-lg border transition-all flex items-center gap-2"
                      style={{
                        backgroundColor: isActive ? '#000' : '#fff',
                        color: isActive ? '#D7FF2F' : '#666',
                        borderColor: isActive ? '#000' : '#E5E5E5',
                      }}
                    >
                      <span>{c.nombre || `Alt ${idx + 1}`}</span>
                      {configs.length > 1 && (
                        <X
                          size={12}
                          onClick={(e) => {
                            e.stopPropagation()
                            const next = configs.filter(item => item.tempId !== c.tempId)
                            setConfigs(next)
                            if (activeConfigId === c.tempId) {
                              setActiveConfigId(next[0].tempId)
                            }
                          }}
                          className="hover:text-red-500 transition-colors"
                        />
                      )}
                    </button>
                  )
                })}
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
                        sitiosSeleccionados: [],
                        productosMap: {}
                      }
                    ])
                    setActiveConfigId(newId)
                  }}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-dashed border-borde bg-white hover:border-black transition-all flex items-center gap-1"
                >
                  <Plus size={12} /> Nueva alternativa
                </button>
              </div>

              {/* Active Config Fields */}
              <div className="bg-fondo/30 p-4 rounded-xl border border-borde flex flex-col gap-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Detalles de la alternativa seleccionada</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Nombre *</label>
                    <input
                      type="text"
                      value={activeConfig.nombre}
                      onChange={e => {
                        setConfigs(prev => prev.map(c => c.tempId === activeConfigId ? { ...c, nombre: e.target.value } : c))
                      }}
                      className={inp}
                      placeholder="Ej: Opción A - Solo FV"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Descripción</label>
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
                    {fmtCurrency(activeConfigCapex, proyecto.moneda as any)}
                  </span>
                </div>
              </div>

              {/* Sites selector */}
              <div>
                <label className="block text-sm font-semibold mb-2">Selecciona los sitios para esta alternativa:</label>
                {sitiosCliente.length === 0 ? (
                  <p className="text-xs text-muted">Este cliente no tiene sitios creados. Por favor, crea sitios en el portal de Clientes.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {sitiosCliente.map(s => {
                      const selected = activeConfig.sitiosSeleccionados.includes(s.id)
                      return (
                        <div key={s.id} className="border border-borde rounded-xl p-3 bg-white flex flex-col justify-between">
                          <label className="flex items-start gap-2.5 cursor-pointer text-xs font-semibold select-none">
                            <input
                              type="checkbox"
                              checked={selected}
                              className="mt-0.5"
                              onChange={e => {
                                setConfigs(prev => prev.map(c => {
                                  if (c.tempId !== activeConfigId) return c
                                  const list = e.target.checked
                                    ? [...c.sitiosSeleccionados, s.id]
                                    : c.sitiosSeleccionados.filter(id => id !== s.id)
                                  return { ...c, sitiosSeleccionados: list }
                                }))
                              }}
                            />
                            <div>
                              <p className="font-bold text-principal text-sm">{s.nombre}</p>
                              <p className="text-muted text-xs mt-0.5">{s.ubicacion_estado}</p>
                            </div>
                          </label>

                          {/* Site product list */}
                          {selected && (
                            <div className="mt-3 pt-3 border-t border-borde flex flex-col gap-2">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">Productos:</p>
                              
                              {/* Current products in configuration */}
                              {(activeConfig.productosMap[s.id] ?? []).map(p => {
                                return (
                                  <div key={p.tempId} className="bg-fondo/45 p-2 rounded-lg border border-borde text-xs flex justify-between items-center">
                                    <div className="flex items-center gap-1.5 font-bold">
                                      {p.tipo === 'fv' ? <Zap size={11} className="text-yellow-500" /> : <Battery size={11} className="text-green-500" />}
                                      <span>{p.fv ? `${p.fv.num_modulos} Mód` : `${p.bess?.potencia_kw} kW`}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button type="button" onClick={() => handleEditProduct(s.id, p)} className="p-1 hover:text-principal transition-colors text-muted">
                                        <Edit2 size={11} />
                                      </button>
                                      <button type="button" onClick={() => handleRemoveProduct(s.id, p.tempId)} className="p-1 hover:text-red-500 transition-colors text-muted">
                                        <Trash2 size={11} />
                                      </button>
                                    </div>
                                  </div>
                                )
                              })}

                              {/* Add product triggers */}
                              {addingToSitioId !== s.id && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAddingToSitioId(s.id)
                                    setProductTipo(null)
                                  }}
                                  className="text-[10px] font-bold text-[#000] border border-dashed border-borde rounded-lg p-1.5 text-center hover:border-black transition-colors"
                                >
                                  + Agregar producto
                                </button>
                              )}

                              {/* Inline add/edit form */}
                              {addingToSitioId === s.id && (
                                <div className="border border-borde p-3 rounded-xl bg-white flex flex-col gap-3 mt-1">
                                  {!productTipo ? (
                                    <div className="flex flex-col gap-2">
                                      <p className="text-[10px] font-bold mb-1">¿Qué tipo de producto?</p>
                                      <div className="flex gap-2">
                                        <button type="button" onClick={() => setProductTipo('fv')} className="border border-borde hover:border-black transition-colors rounded-lg p-2 flex-1 flex flex-col items-center gap-1 text-[10px] font-bold">
                                          <Zap size={14} /> Fotovoltaico
                                        </button>
                                        <button type="button" onClick={() => setProductTipo('bess')} className="border border-borde hover:border-black transition-colors rounded-lg p-2 flex-1 flex flex-col items-center gap-1 text-[10px] font-bold">
                                          <Battery size={14} /> BESS
                                        </button>
                                      </div>
                                      <button type="button" onClick={() => setAddingToSitioId(null)} className="text-[10px] text-center text-muted hover:underline mt-1">Cancelar</button>
                                    </div>
                                  ) : productTipo === 'fv' ? (
                                    /* Formulario FV inside card */
                                    <div className="flex flex-col gap-2 text-xs">
                                      <div className="flex justify-between items-center">
                                        <span className="font-bold flex items-center gap-1 text-[10px] uppercase text-muted"><Zap size={11} /> FV</span>
                                        <button type="button" onClick={() => setProductTipo(null)} className="text-[10px] text-muted hover:underline">Cambiar</button>
                                      </div>

                                      <div>
                                        <label className="block text-[10px] font-medium mb-0.5">No. Módulos *</label>
                                        <input type="text" value={fvForm.num_modulos} onChange={e => setFvForm(f => ({ ...f, num_modulos: formatNumberInput(e.target.value) }))} className="w-full border rounded p-1 text-xs" />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-medium mb-0.5">Potencia (W) *</label>
                                        <input type="text" value={fvForm.potencia_modulos_w} onChange={e => setFvForm(f => ({ ...f, potencia_modulos_w: formatNumberInput(e.target.value) }))} className="w-full border rounded p-1 text-xs" />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-medium mb-0.5">Marca *</label>
                                        <input type="text" value={fvForm.marca_modulos} onChange={e => setFvForm(f => ({ ...f, marca_modulos: e.target.value }))} className="w-full border rounded p-1 text-xs" placeholder="Jinko, Longi..." />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-medium mb-0.5">No. Inversores *</label>
                                        <input type="text" value={fvForm.num_inversores} onChange={e => setFvForm(f => ({ ...f, num_inversores: formatNumberInput(e.target.value) }))} className="w-full border rounded p-1 text-xs" />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-medium mb-0.5">Potencia Inversores (kW) *</label>
                                        <input type="text" value={fvForm.potencia_inversores_kw} onChange={e => setFvForm(f => ({ ...f, potencia_inversores_kw: formatNumberInput(e.target.value) }))} className="w-full border rounded p-1 text-xs" />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-medium mb-0.5">Marca Inversores *</label>
                                        <input type="text" value={fvForm.marca_inversores} onChange={e => setFvForm(f => ({ ...f, marca_inversores: e.target.value }))} className="w-full border rounded p-1 text-xs" placeholder="Solis, SMA..." />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-medium mb-0.5">Generación anual (kWh) *</label>
                                        <input type="text" value={fvForm.generacion_anual_kwh} onChange={e => setFvForm(f => ({ ...f, generacion_anual_kwh: formatNumberInput(e.target.value) }))} className="w-full border rounded p-1 text-xs" />
                                      </div>
                                                                            <div>
                                        <label className="block text-[10px] font-medium mb-0.5">CAPEX *</label>
                                        <div className="flex gap-1">
                                          <input type="text" value={fvForm.capex} onChange={e => setFvForm(f => ({ ...f, capex: formatNumberInput(e.target.value) }))} className="flex-1 border rounded p-1 text-xs" />
                                          <select value={fvForm.capex_moneda || 'USD'} onChange={e => setFvForm(f => ({ ...f, capex_moneda: e.target.value }))} className="w-16 border rounded p-1 text-xs bg-white">
                                            <option value="USD">USD</option>
                                            <option value="MXN">MXN</option>
                                          </select>
                                        </div>
                                      </div>

                                      {/* Calculations */}
                                      <div className="bg-fondo p-2 rounded-lg text-[9px] text-muted flex flex-col gap-0.5">
                                        <div>kWp sistema: <span className="font-bold text-principal">{fvCalc.kwpSistema !== null ? `${fmtNum(fvCalc.kwpSistema, 1)} kWp` : '—'}</span></div>
                                        <div>Precio/Wp: <span className="font-bold text-principal">{fvCalc.precioWatt !== null ? `$${fmtNum(fvCalc.precioWatt, 4)}` : '—'}</span></div>
                                      </div>

                                      <div className="flex justify-between mt-2 pt-2 border-t border-borde">
                                        <button type="button" onClick={() => { setAddingToSitioId(null); setEditingProduct(null) }} className="px-2 py-1 border rounded text-[10px]">Cancelar</button>
                                        <button type="button" onClick={handleSaveProduct} className="px-3 py-1 bg-principal text-acento font-bold rounded text-[10px]">Listo</button>
                                      </div>
                                    </div>
                                  ) : (
                                    /* BESS Form inside card */
                                    <div className="flex flex-col gap-2 text-xs">
                                      <div className="flex justify-between items-center">
                                        <span className="font-bold flex items-center gap-1 text-[10px] uppercase text-muted"><Battery size={11} /> BESS</span>
                                        <button type="button" onClick={() => setProductTipo(null)} className="text-[10px] text-muted hover:underline">Cambiar</button>
                                      </div>

                                      <div>
                                        <label className="block text-[10px] font-medium mb-0.5">Potencia (kW) *</label>
                                        <input type="text" value={bessForm.potencia_kw} onChange={e => setBessForm(f => ({ ...f, potencia_kw: formatNumberInput(e.target.value) }))} className="w-full border rounded p-1 text-xs" />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-medium mb-0.5">Capacidad (kWh) *</label>
                                        <input type="text" value={bessForm.capacidad_kwh} onChange={e => setBessForm(f => ({ ...f, capacidad_kwh: formatNumberInput(e.target.value) }))} className="w-full border rounded p-1 text-xs" />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-medium mb-0.5">Marca *</label>
                                        <input type="text" value={bessForm.marca} onChange={e => setBessForm(f => ({ ...f, marca: e.target.value }))} className="w-full border rounded p-1 text-xs" placeholder="Tesla, BYD..." />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-medium mb-0.5">Uso *</label>
                                        <select value={bessForm.uso} onChange={e => setBessForm(f => ({ ...f, uso: e.target.value }))} className="w-full border rounded p-1 text-xs bg-white">
                                          <option value="load_shifting">Load Shifting</option>
                                          <option value="ups">UPS</option>
                                          <option value="load_shifting_ups">Load Shifting + UPS</option>
                                        </select>
                                      </div>
                                                                            <div>
                                        <label className="block text-[10px] font-medium mb-0.5">CAPEX *</label>
                                        <div className="flex gap-1">
                                          <input type="text" value={bessForm.capex} onChange={e => setBessForm(f => ({ ...f, capex: formatNumberInput(e.target.value) }))} className="flex-1 border rounded p-1 text-xs" />
                                          <select value={bessForm.capex_moneda || 'USD'} onChange={e => setBessForm(f => ({ ...f, capex_moneda: e.target.value }))} className="w-16 border rounded p-1 text-xs bg-white">
                                            <option value="USD">USD</option>
                                            <option value="MXN">MXN</option>
                                          </select>
                                        </div>
                                      </div>

                                      {/* Calculations */}
                                      <div className="bg-fondo p-2 rounded-lg text-[9px] text-muted">
                                        Precio/kWh: <span className="font-bold text-principal">{bessCalc.precioKwh !== null ? `$${fmtNum(bessCalc.precioKwh, 2)}` : '—'}</span>
                                      </div>

                                      <div className="flex justify-between mt-2 pt-2 border-t border-borde">
                                        <button type="button" onClick={() => { setAddingToSitioId(null); setEditingProduct(null) }} className="px-2 py-1 border rounded text-[10px]">Cancelar</button>
                                        <button type="button" onClick={handleSaveProduct} className="px-3 py-1 bg-principal text-acento font-bold rounded text-[10px]">Listo</button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-borde flex justify-end gap-3 bg-[#fafafa] rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-borde text-xs font-semibold rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || !proyecto.cliente_id}
            className="px-5 py-2 bg-principal text-acento text-xs font-bold rounded-xl disabled:opacity-50 hover:opacity-90 transition-all flex items-center gap-1.5"
          >
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>

      </div>
    </div>
  )
}
