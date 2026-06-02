/* eslint-disable */
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Plus, Trash2, AlertCircle } from 'lucide-react'
import type { Proyecto, ConfiguracionTecnica, OpcionFinanciamiento, ConfigFinanciamiento, ModalidadFinanciamiento, Moneda } from '@/lib/types'
import { parseNum, formatNumberInput, fmtCurrency } from '@/lib/format'

interface CreationFinancingOption {
  id?: string
  tempId: string
  nombre: string
  vehiculo_inversion: string
  ahorro_estimado_mensual: string
  ahorro_moneda: Moneda
  plazo_meses: string
  notas: string
  linkedConfigIds: string[]
}

interface Props {
  isOpen: boolean
  onClose: () => void
  proyecto: Proyecto
  configuraciones: ConfiguracionTecnica[]
  opcionesFinanciamiento: OpcionFinanciamiento[]
  configFinanciamientoLinks: ConfigFinanciamiento[]
  onSave: () => void
}

const MODALIDAD_LABELS: Record<string, string> = {
  credito: 'Crédito',
  arrendamiento: 'Arrendamiento',
  ensaas: 'EnSaaS',
  mem: 'Mercado Eléctrico Mayorista',
  no_sabe: 'Analista define modalidad',
}

export default function EditarFinanciamientoModal({ isOpen, onClose, proyecto, configuraciones, opcionesFinanciamiento, configFinanciamientoLinks, onSave }: Props) {
  const supabase = createClient()
  const [options, setOptions] = useState<CreationFinancingOption[]>([])
  const [isRecomendacionNodo, setIsRecomendacionNodo] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      const list = opcionesFinanciamiento ?? []
      const links = configFinanciamientoLinks ?? []

      const hasNoSabe = list.some(o => o.vehiculo_inversion === 'no_sabe')
      setIsRecomendacionNodo(hasNoSabe)

      if (hasNoSabe) {
        setOptions([])
      } else {
                const mapped: CreationFinancingOption[] = list.map(o => {
          const linkedConfigIds = links.filter(l => l.opcion_financiamiento_id === o.id).map(l => l.configuracion_id)
          return {
            id: o.id,
            tempId: o.id,
            nombre: o.nombre,
            vehiculo_inversion: o.vehiculo_inversion,
            ahorro_estimado_mensual: o.ahorro_estimado_mensual !== null ? formatNumberInput(String(o.ahorro_estimado_mensual)) : '',
            ahorro_moneda: (o.moneda as Moneda) || 'MXN',
            plazo_meses: o.plazo_meses !== null ? String(o.plazo_meses) : '',
            notas: o.notas || '',
            linkedConfigIds
          }
        })

                if (mapped.length === 0) {
          mapped.push({
            tempId: 'default',
            nombre: 'Financiamiento 1',
            vehiculo_inversion: 'credito',
            ahorro_estimado_mensual: '',
            ahorro_moneda: 'MXN',
            plazo_meses: '',
            notas: '',
            linkedConfigIds: configuraciones.map(c => c.id)
          })
        }
        setOptions(mapped)
      }
    }
  }, [isOpen, opcionesFinanciamiento, configFinanciamientoLinks, configuraciones])

  if (!isOpen) return null

    function handleAddOption() {
    const newId = `fin-${Date.now()}`
    setOptions(prev => [
      ...prev,
      {
        tempId: newId,
        nombre: `Financiamiento ${prev.length + 1}`,
        vehiculo_inversion: 'credito',
        ahorro_estimado_mensual: '',
        ahorro_moneda: 'MXN',
        plazo_meses: '',
        notes: '',
        notas: '',
        linkedConfigIds: configuraciones.map(c => c.id)
      }
    ])
  }

  function handleRemoveOption(tempId: string) {
    setOptions(prev => prev.filter(o => o.tempId !== tempId))
  }

  function handleUpdateOption(tempId: string, fields: Partial<CreationFinancingOption>) {
    setOptions(prev => prev.map(o => o.tempId === tempId ? { ...o, ...fields } : o))
  }

  function handleToggleLink(tempId: string, configId: string) {
    setOptions(prev => prev.map(o => {
      if (o.tempId !== tempId) return o
      const list = o.linkedConfigIds.includes(configId)
        ? o.linkedConfigIds.filter(id => id !== configId)
        : [...o.linkedConfigIds, configId]
      return { ...o, linkedConfigIds: list }
    }))
  }

  async function handleSave() {
    setLoading(true)
    setError(null)

    try {
      // 1. Validation
      if (!isRecomendacionNodo) {
        if (options.length === 0) {
          throw new Error('Agrega al menos una opción de financiamiento o selecciona que Nodo te recomiende las mejores alternativas.')
        }

        for (let i = 0; i < options.length; i++) {
          const opt = options[i]
          if (!opt.nombre.trim()) {
            throw new Error(`La opción de financiamiento ${i + 1} requiere un nombre.`)
          }
          if (!opt.vehiculo_inversion) {
            throw new Error(`La opción de financiamiento "${opt.nombre}" requiere un vehículo de inversión.`)
          }
          if (opt.linkedConfigIds.length === 0) {
            throw new Error(`La opción de financiamiento "${opt.nombre}" debe estar vinculada a al menos una configuración técnica.`)
          }
        }
      }

      // 2. Perform DB Updates
      if (isRecomendacionNodo) {
        // A. Delete existing options
        const { error: delErr } = await supabase.from('opciones_financiamiento').delete().eq('proyecto_id', proyecto.id)
        if (delErr) throw delErr

        // B. Insert single no_sabe option
        const { data: insertedOpt, error: insErr } = await supabase.from('opciones_financiamiento').insert({
          proyecto_id: proyecto.id,
          nombre: 'Recomendación de Nodo',
          vehiculo_inversion: 'no_sabe',
          seleccionada: true
        }).select('id').single()
        if (insErr) throw insErr

        // C. Link to all configurations in junction table
        if (insertedOpt && configuraciones.length > 0) {
          const junctionRows = configuraciones.map(c => ({
            configuracion_id: c.id,
            opcion_financiamiento_id: insertedOpt.id
          }))
          const { error: jErr } = await supabase.from('config_financiamiento').insert(junctionRows)
          if (jErr) throw jErr
        }

        // D. Update project level modalidad_financiamiento
        await supabase.from('proyectos').update({
          modalidad_financiamiento: ['no_sabe']
        }).eq('id', proyecto.id)

      } else {
        // A. Identify existing, new and removed options
        const newOpts = options.filter(o => o.tempId.startsWith('fin-') || o.tempId === 'default')
        const existingOpts = options.filter(o => !o.tempId.startsWith('fin-') && o.tempId !== 'default')

        // Delete removed ones
        const keptIds = options.map(o => o.id).filter(Boolean) as string[]
        const toDelete = (opcionesFinanciamiento ?? []).filter(o => !keptIds.includes(o.id))
        if (toDelete.length > 0) {
          const { error: delErr } = await supabase.from('opciones_financiamiento').delete().in('id', toDelete.map(o => o.id))
          if (delErr) throw delErr
        }

                // B. Update existing ones
        for (const o of existingOpts) {
          const { error: updErr } = await supabase.from('opciones_financiamiento').update({
            nombre: o.nombre,
            vehiculo_inversion: o.vehiculo_inversion,
            ahorro_estimado_mensual: o.ahorro_estimado_mensual ? parseNum(o.ahorro_estimado_mensual) : null,
            moneda: o.ahorro_moneda || 'MXN',
            plazo_meses: o.plazo_meses ? Number(o.plazo_meses) : null,
            notas: o.notas || null
          }).eq('id', o.id!)
          if (updErr) throw updErr
        }

        // C. Insert new ones
        let insertedOpts: any[] = []
        if (newOpts.length > 0) {
          const payload = newOpts.map((o, idx) => ({
            proyecto_id: proyecto.id,
            nombre: o.nombre,
            vehiculo_inversion: o.vehiculo_inversion,
            ahorro_estimado_mensual: o.ahorro_estimado_mensual ? parseNum(o.ahorro_estimado_mensual) : null,
            moneda: o.ahorro_moneda || 'MXN',
            plazo_meses: o.plazo_meses ? Number(o.plazo_meses) : null,
            notas: o.notas || null,
            seleccionada: false // will preserve or let them select later
          }))
          const { data, error: insErr } = await supabase.from('opciones_financiamiento').insert(payload).select('*')
          if (insErr) throw insErr
          insertedOpts = data || []
        }

        // D. Create map of tempId -> DB UUID
        const idMap: Record<string, string> = {}
        existingOpts.forEach(o => { idMap[o.tempId] = o.id! })
        newOpts.forEach(o => {
          const dbOpt = insertedOpts.find(db => db.nombre === o.nombre && db.vehiculo_inversion === o.vehiculo_inversion)
          if (dbOpt) idMap[o.tempId] = dbOpt.id
        })

        // E. Sync Junction table config_financiamiento
        // Delete all old links for this project's configurations
        if (configuraciones.length > 0) {
          const { error: delLinksErr } = await supabase.from('config_financiamiento').delete().in('configuracion_id', configuraciones.map(c => c.id))
          if (delLinksErr) throw delLinksErr
        }

        // Insert current links
        const junctionRows: { configuracion_id: string; opcion_financiamiento_id: string }[] = []
        options.forEach(o => {
          const dbOptId = idMap[o.tempId]
          if (!dbOptId) return
          o.linkedConfigIds.forEach(cId => {
            junctionRows.push({
              configuracion_id: cId,
              opcion_financiamiento_id: dbOptId
            })
          })
        })

        if (junctionRows.length > 0) {
          const { error: insLinksErr } = await supabase.from('config_financiamiento').insert(junctionRows)
          if (insLinksErr) throw insLinksErr
        }

        // F. Sync project level unique list of investment vehicles
        const vehiclesArray = Array.from(new Set(options.map(o => o.vehiculo_inversion)))
        
        // Ensure there is at least one option selected as winner. If not, select first
        const hasSelected = options.some(o => {
          const orig = opcionesFinanciamiento.find(db => db.id === o.id)
          return orig?.seleccionada
        })
        if (!hasSelected && options.length > 0) {
          const firstDbId = idMap[options[0].tempId]
          if (firstDbId) {
            await supabase.from('opciones_financiamiento').update({ seleccionada: true }).eq('id', firstDbId)
          }
        }

        await supabase.from('proyectos').update({
          modalidad_financiamiento: vehiclesArray as ModalidadFinanciamiento[]
        }).eq('id', proyecto.id)
      }

      onSave()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Error al guardar opciones de financiamiento')
    } finally {
      setLoading(false)
    }
  }

  const inp = 'w-full border rounded-xl p-2 text-sm bg-white'
  const textCheck = 'text-xs font-semibold text-gray-700'

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl border border-borde">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-borde flex items-center justify-between bg-[#fafafa] rounded-t-2xl">
          <div>
            <h3 className="font-bold text-base text-principal">Editar Opciones de Financiamiento</h3>
            <p className="text-xs text-muted">Configura los vehículos de financiamiento, plazos y ahorros mensuales estimadas.</p>
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

          {/* Toggle Nodo Recomienda */}
          <div className="flex items-center gap-2 bg-[#fafff0] border border-[#e0f0c0] rounded-xl p-4">
            <input
              type="checkbox"
              id="no_sabe_edit"
              checked={isRecomendacionNodo}
              onChange={e => setIsRecomendacionNodo(e.target.checked)}
              className="w-4 h-4 text-principal focus:ring-acento rounded border-gray-300"
            />
            <label htmlFor="no_sabe_edit" className="text-xs font-bold text-[#4a5e1e] cursor-pointer">
              No sé / Recomendar opciones (Nodo definirá las mejores alternativas de financiamiento)
            </label>
          </div>

          {!isRecomendacionNodo && (
            <div className="flex flex-col gap-6">
              {options.map((opt, idx) => (
                <div key={opt.tempId} className="border border-borde rounded-xl p-4 bg-gray-50/50 flex flex-col gap-4 relative">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-principal">Opción #{idx + 1}</h4>
                    {options.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(opt.tempId)}
                        className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                        title="Eliminar opción"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Nombre de la opción *</label>
                      <input
                        type="text"
                        value={opt.nombre}
                        onChange={e => handleUpdateOption(opt.tempId, { nombre: e.target.value })}
                        className={inp}
                        placeholder="Ej: Crédito a 5 años"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Vehículo de inversión *</label>
                      <select
                        value={opt.vehiculo_inversion}
                        onChange={e => handleUpdateOption(opt.tempId, { vehiculo_inversion: e.target.value })}
                        className={inp}
                      >
                        <option value="credito">Crédito</option>
                        <option value="arrendamiento">Arrendamiento</option>
                        <option value="ensaas">EnSaaS</option>
                        <option value="mem">Mercado Eléctrico Mayorista</option>
                      </select>
                    </div>
                                        <div>
                      <label className="block text-xs font-medium mb-1">Ahorro estimado mensual</label>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <input
                            type="text"
                            value={opt.ahorro_estimado_mensual}
                            onChange={e => handleUpdateOption(opt.tempId, { ahorro_estimado_mensual: formatNumberInput(e.target.value) })}
                            className={inp}
                            placeholder="0"
                          />
                        </div>
                        <div className="w-24">
                          <select
                            value={opt.ahorro_moneda || 'MXN'}
                            onChange={e => handleUpdateOption(opt.tempId, { ahorro_moneda: e.target.value as Moneda })}
                            className={inp}
                          >
                            <option value="MXN">MXN</option>
                            <option value="USD">USD</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Plazo (meses)</label>
                      <input
                        type="number"
                        value={opt.plazo_meses}
                        onChange={e => handleUpdateOption(opt.tempId, { plazo_meses: e.target.value })}
                        className={inp}
                        placeholder="Ej: 60"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium mb-1">Notas / Detalles</label>
                      <input
                        type="text"
                        value={opt.notas}
                        onChange={e => handleUpdateOption(opt.tempId, { notas: e.target.value })}
                        className={inp}
                        placeholder="Ej: Tasa de interés FIDE, requiere enganche..."
                      />
                    </div>
                  </div>

                  {/* Linking configs checkboxes */}
                  <div className="mt-2 pt-3 border-t border-borde">
                    <label className="block text-xs font-bold text-gray-500 mb-2">Aplica para las configuraciones técnicas:</label>
                    <div className="flex flex-wrap gap-4">
                      {configuraciones.map(c => {
                        const isLinked = opt.linkedConfigIds.includes(c.id)
                        return (
                          <label key={c.id} className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isLinked}
                              onChange={() => handleToggleLink(opt.tempId, c.id)}
                              className="w-3.5 h-3.5 text-principal focus:ring-acento rounded border-gray-300"
                            />
                            <span className={textCheck}>{c.nombre}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={handleAddOption}
                className="w-full py-2.5 text-xs font-semibold rounded-lg border border-dashed border-borde bg-white hover:border-black transition-all flex items-center justify-center gap-1"
              >
                <Plus size={12} /> Agregar opción de financiamiento
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-borde flex justify-end gap-3 bg-[#fafafa] rounded-b-2xl">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold border border-borde rounded-lg bg-white hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-principal text-acento hover:opacity-90 transition-all flex items-center justify-center min-w-20"
          >
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
