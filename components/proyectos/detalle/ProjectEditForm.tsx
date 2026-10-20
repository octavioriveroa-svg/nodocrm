'use client'

import React, { useState, useEffect } from 'react'
import { Pencil, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import { Seccion } from './common'
import type {
  Proyecto,
  Profile,
  TipoProyecto,
  TecnologiaBateria,
  TipoInstalacion,
  Moneda,
} from '@/lib/types'

const ESTADOS_MX = [
  'Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas','Chihuahua',
  'Ciudad de México','Coahuila','Colima','Durango','Estado de México','Guanajuato','Guerrero',
  'Hidalgo','Jalisco','Michoacán','Morelos','Nayarit','Nuevo León','Oaxaca','Puebla','Querétaro',
  'Quintana Roo','San Luis Potosí','Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala',
  'Veracruz','Yucatán','Zacatecas',
]

interface Props {
  proyecto: Proyecto
  currentUser: Profile
  onSaveSuccess: (updated: Proyecto) => void
  onCancelar: () => void
  onOpenEditTecnica: () => void
  onOpenEditFinanciamiento: () => void
}

export default function ProjectEditForm({
  proyecto,
  currentUser,
  onSaveSuccess,
  onCancelar,
  onOpenEditTecnica,
  onOpenEditFinanciamiento,
}: Props) {
  const supabase = createClient()
  const [form, setForm] = useState<Partial<Proyecto>>(proyecto)
  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null)

  const [nodoUsers, setNodoUsers] = useState<{ id: string; nombre: string; empresa: string }[]>([])
  const [allClientes, setAllClientes] = useState<{ id: string; razon_social: string }[]>([])
  const [allEpcistas, setAllEpcistas] = useState<{ id: string; nombre: string; empresa: string }[]>([])
  const [allFinders, setAllFinders] = useState<{ id: string; nombre: string; empresa: string }[]>([])

  const isAdmin = currentUser.rol === 'nodo_admin'
  const isAnalista = currentUser.rol === 'nodo_analista'
  const isEpcista = currentUser.rol === 'epc'
  const isFinder = currentUser.rol === 'finder'

  useEffect(() => {
    if (isAdmin || isAnalista) {
      supabase
        .from('profiles')
        .select('id, nombre, empresa')
        .in('rol', ['nodo_admin', 'nodo_analista'])
        .order('nombre')
        .then(({ data }) => { if (data) setNodoUsers(data) })

      supabase
        .from('clientes')
        .select('id, razon_social')
        .order('razon_social')
        .then(({ data }) => { if (data) setAllClientes(data) })

      supabase
        .from('profiles')
        .select('id, nombre, empresa')
        .eq('rol', 'finder')
        .order('nombre')
        .then(({ data }) => { if (data) setAllFinders(data) })
    }

    if (isAdmin || isAnalista || isFinder) {
      supabase
        .from('profiles')
        .select('id, nombre, empresa')
        .eq('rol', 'epc')
        .order('nombre')
        .then(({ data }) => { if (data) setAllEpcistas(data) })
    }
  }, [isAdmin, isAnalista, isFinder, supabase])

  const canEditGroup1 =
    isAdmin ||
    isAnalista ||
    (isEpcista && proyecto.epcista_id === currentUser.id) ||
    (isFinder && proyecto.finder_id === currentUser.id)

  const canEditTechnical =
    isAdmin || isAnalista || (isEpcista && proyecto.epcista_id === currentUser.id)

  const canEditAssignments = isAdmin || isAnalista || isFinder

  async function handleGuardar(exitsEditMode = true): Promise<boolean> {
    setGuardando(true)
    setErrorGuardar(null)

    const payload: Partial<Proyecto> = {
      nombre_proyecto: form.nombre_proyecto,
      cliente_final_nombre: form.cliente_final_nombre,
      cliente_final_empresa: form.cliente_final_empresa,
      cliente_final_contacto: form.cliente_final_contacto,
      capex_estimado: form.capex_estimado ? Number(form.capex_estimado) : null,
      ubicacion_estado: form.ubicacion_estado,
      notas_adicionales: form.notas_adicionales,
    }

    if (isAdmin || isAnalista) {
      payload.responsable_nodo_id = form.responsable_nodo_id || null
      payload.cliente_id = form.cliente_id || null
      payload.finder_id = form.finder_id || null
    }

    if (isAdmin || isAnalista || isFinder) {
      payload.epcista_id = form.epcista_id || null
    }

    if (isAdmin || isAnalista || isEpcista) {
      payload.tipo = form.tipo
      payload.demanda_kw = form.demanda_kw ?? null
      payload.capacidad_mwh = form.capacidad_mwh ?? null
      payload.capacidad_mw = form.capacidad_mw ?? null
      payload.tecnologia_bateria = form.tecnologia_bateria || null
      payload.duracion_descarga_hrs = form.duracion_descarga_hrs ?? null
      payload.punto_interconexion = form.punto_interconexion || null
      payload.tipo_participacion_mem = form.tipo_participacion_mem || null
      payload.volumen_energia_mwh_anual = form.volumen_energia_mwh_anual ?? null

      payload.tipo_instalacion = form.tipo_instalacion || null
      payload.incluye_mem = !!form.incluye_mem
      payload.modalidad_financiamiento = form.modalidad_financiamiento || []
      payload.moneda = form.moneda || 'MXN'
    }

    const { data, error } = await supabase
      .from('proyectos')
      .update(payload)
      .eq('id', proyecto.id)
      .select()
      .single()

    if (error) {
      setErrorGuardar('Error al guardar cambios: ' + error.message)
      setGuardando(false)
      return false
    }

    if (data) {
      onSaveSuccess(data as Proyecto)
    }

    if (exitsEditMode) {
      onCancelar()
    }
    setGuardando(false)
    return true
  }

  return (
    <Seccion title="Modo edición">
      {errorGuardar && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-800 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0 text-red-600" />
          <span>{errorGuardar}</span>
        </div>
      )}

      <div className="flex flex-col gap-6 mb-4">
        {/* Grupo 1: Información básica */}
        {canEditGroup1 && (
          <div className="border border-borde rounded-xl p-4 bg-fondo">
            <h4 className="font-bold text-xs uppercase tracking-wide text-gray-500 mb-3">
              Grupo 1: Información básica
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1">Nombre del proyecto *</label>
                <input
                  type="text"
                  value={form.nombre_proyecto || ''}
                  onChange={(e) => setForm((f) => ({ ...f, nombre_proyecto: e.target.value }))}
                  className="w-full border rounded p-2 text-sm bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Nombre contacto final</label>
                <input
                  type="text"
                  value={form.cliente_final_nombre || ''}
                  onChange={(e) => setForm((f) => ({ ...f, cliente_final_nombre: e.target.value }))}
                  className="w-full border rounded p-2 text-sm bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Empresa cliente final</label>
                <input
                  type="text"
                  value={form.cliente_final_empresa || ''}
                  onChange={(e) => setForm((f) => ({ ...f, cliente_final_empresa: e.target.value }))}
                  className="w-full border rounded p-2 text-sm bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Email / Teléfono de contacto</label>
                <input
                  type="text"
                  value={form.cliente_final_contacto || ''}
                  onChange={(e) => setForm((f) => ({ ...f, cliente_final_contacto: e.target.value }))}
                  className="w-full border rounded p-2 text-sm bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Estado (Ubicación)</label>
                <select
                  value={form.ubicacion_estado || ''}
                  onChange={(e) => setForm((f) => ({ ...f, ubicacion_estado: e.target.value }))}
                  className="w-full border rounded p-2 text-sm bg-white"
                >
                  <option value="">Selecciona un estado</option>
                  {ESTADOS_MX.map((est) => (
                    <option key={est} value={est}>
                      {est}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1">Notas adicionales</label>
                <textarea
                  rows={3}
                  value={form.notas_adicionales || ''}
                  onChange={(e) => setForm((f) => ({ ...f, notas_adicionales: e.target.value }))}
                  className="w-full border rounded p-2 text-sm bg-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* Grupo 2: Instalación y financiamiento */}
        {canEditTechnical && (
          <div className="border border-borde rounded-xl p-4 bg-fondo">
            <h4 className="font-bold text-xs uppercase tracking-wide text-gray-500 mb-3">
              Grupo 2: Instalación y financiamiento
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">Tipo de instalación</label>
                <select
                  value={form.tipo_instalacion || ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      tipo_instalacion: (e.target.value as TipoInstalacion) || null,
                    }))
                  }
                  className="w-full border rounded p-2 text-sm bg-white"
                >
                  <option value="">Selecciona</option>
                  <option value="nodo_busca">Nodo busca</option>
                  <option value="epcista_instala">EPCista instala</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">
                  CAPEX estimado ({form.moneda || 'MXN'})
                </label>
                <input
                  type="number"
                  value={form.capex_estimado ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      capex_estimado: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                  className="w-full border rounded p-2 text-sm bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Moneda</label>
                <select
                  value={form.moneda || 'MXN'}
                  onChange={(e) => setForm((f) => ({ ...f, moneda: e.target.value as Moneda }))}
                  className="w-full border rounded p-2 text-sm bg-white"
                >
                  <option value="MXN">MXN</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div className="flex items-center mt-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={!!form.incluye_mem}
                    onChange={(e) => setForm((f) => ({ ...f, incluye_mem: e.target.checked }))}
                    className="w-4 h-4 text-principal focus:ring-acento rounded border-gray-300"
                  />
                  <span>Incluye MEM</span>
                </label>
              </div>
              <div className="col-span-2 border-t border-gray-200/60 pt-4 mt-2">
                <label className="block text-xs font-bold text-gray-400 mb-2">
                  Vehículos de financiamiento
                </label>
                <div className="bg-white border border-borde rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm">
                  <div>
                    <p className="text-xs font-bold text-principal">
                      Opciones de financiamiento alternativas
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      Configura múltiples alternativas de financiamiento, plazos, y vincúlalos a configuraciones técnicas.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const saved = await handleGuardar(false)
                      if (saved) {
                        onOpenEditFinanciamiento()
                      }
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold bg-principal text-acento rounded-lg hover:opacity-90 transition-all whitespace-nowrap"
                  >
                    <Pencil size={12} /> Configurar Opciones de Financiamiento
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Grupo 3: Asignaciones */}
        {canEditAssignments && (
          <div className="border border-borde rounded-xl p-4 bg-fondo">
            <h4 className="font-bold text-xs uppercase tracking-wide text-gray-500 mb-3">
              Grupo 3: Asignaciones
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(isAdmin || isAnalista) && (
                <>
                  <div>
                    <label className="block text-xs font-medium mb-1">Responsable Nodo</label>
                    <select
                      value={form.responsable_nodo_id || ''}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, responsable_nodo_id: e.target.value || null }))
                      }
                      className="w-full border rounded p-2 text-sm bg-white"
                    >
                      <option value="">Sin asignar</option>
                      {nodoUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nombre} — {u.empresa}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Cliente</label>
                    <select
                      value={form.cliente_id || ''}
                      onChange={(e) => setForm((f) => ({ ...f, cliente_id: e.target.value || null }))}
                      className="w-full border rounded p-2 text-sm bg-white"
                    >
                      <option value="">Sin asignar</option>
                      {allClientes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.razon_social}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Finder / Originador</label>
                    <select
                      value={form.finder_id || ''}
                      onChange={(e) => setForm((f) => ({ ...f, finder_id: e.target.value || null }))}
                      className="w-full border rounded p-2 text-sm bg-white"
                    >
                      <option value="">Sin asignar</option>
                      {allFinders.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.nombre} — {f.empresa}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <div>
                <label className="block text-xs font-medium mb-1">EPC Asignado</label>
                <select
                  value={form.epcista_id || ''}
                  onChange={(e) => setForm((f) => ({ ...f, epcista_id: e.target.value || null }))}
                  className="w-full border rounded p-2 text-sm bg-white"
                >
                  <option value="">Sin asignar</option>
                  {allEpcistas.map((epc) => (
                    <option key={epc.id} value={epc.id}>
                      {epc.nombre} — {epc.empresa}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Grupo 4: Datos del Sitio */}
        {canEditTechnical && (
          <div className="border border-borde rounded-xl p-4 bg-fondo">
            <h4 className="font-bold text-xs uppercase tracking-wide text-gray-500 mb-3">
              Grupo 4: Datos del Sitio (Requerimientos de ingeniería)
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">Demanda contratada (kW)</label>
                <input
                  type="number"
                  step="any"
                  value={form.demanda_kw ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      demanda_kw: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  className="w-full border rounded p-2 text-sm bg-white"
                  placeholder="Ej: 500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Punto de interconexión</label>
                <input
                  type="text"
                  value={form.punto_interconexion || ''}
                  onChange={(e) => setForm((f) => ({ ...f, punto_interconexion: e.target.value || null }))}
                  className="w-full border rounded p-2 text-sm bg-white"
                  placeholder="Ej: Subestación A, 13.8 kV"
                />
              </div>

              <div className="col-span-2 border-t border-gray-200/60 pt-3 mt-1 grid grid-cols-2 gap-4">
                <p className="col-span-2 text-xs font-bold uppercase tracking-wide text-gray-400">
                  Requerimientos BESS del Sitio
                </p>
                <div>
                  <label className="block text-xs font-medium mb-1">Capacidad (MWh)</label>
                  <input
                    type="number"
                    step="any"
                    value={form.capacidad_mwh ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        capacidad_mwh: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                    className="w-full border rounded p-2 text-sm bg-white"
                    placeholder="Ej: 1.2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Potencia (MW)</label>
                  <input
                    type="number"
                    step="any"
                    value={form.capacidad_mw ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        capacidad_mw: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                    className="w-full border rounded p-2 text-sm bg-white"
                    placeholder="Ej: 0.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Tecnología de batería</label>
                  <select
                    value={form.tecnologia_bateria || ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        tecnologia_bateria: (e.target.value as TecnologiaBateria) || null,
                      }))
                    }
                    className="w-full border rounded p-2 text-sm bg-white"
                  >
                    <option value="">Selecciona</option>
                    <option value="Li-ion">Li-ion</option>
                    <option value="LFP">LFP</option>
                    <option value="NMC">NMC</option>
                    <option value="Otra">Otra</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Duración descarga (hrs)</label>
                  <input
                    type="number"
                    step="any"
                    value={form.duracion_descarga_hrs ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        duracion_descarga_hrs: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                    className="w-full border rounded p-2 text-sm bg-white"
                    placeholder="Ej: 4"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Grupo 5: Solución técnica */}
        {canEditTechnical && (
          <div className="border border-borde rounded-xl p-4 bg-fondo">
            <h4 className="font-bold text-xs uppercase tracking-wide text-gray-500 mb-3">
              Grupo 5: Solución técnica
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-medium mb-1">Tipo de proyecto *</label>
                <select
                  value={form.tipo || ''}
                  onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as TipoProyecto }))}
                  className="w-full border rounded p-2 text-sm bg-white font-semibold"
                >
                  <option value="FV">Fotovoltaico (FV)</option>
                  <option value="BESS">Baterías (BESS)</option>
                  <option value="FV+BESS">FV + BESS</option>
                  <option value="MEM">MEM</option>
                  <option value="BESS+MEM">BESS + MEM</option>
                </select>
              </div>

              {(form.tipo === 'MEM' || form.tipo === 'BESS+MEM') && (
                <div className="col-span-2 border-t border-gray-200/60 pt-4 mt-2 grid grid-cols-2 gap-4">
                  <p className="col-span-2 text-xs font-bold uppercase tracking-wide text-gray-400">
                    Datos MEM
                  </p>
                  <div>
                    <label className="block text-xs font-medium mb-1">Tipo de participación MEM</label>
                    <input
                      type="text"
                      value={form.tipo_participacion_mem || ''}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, tipo_participacion_mem: e.target.value || null }))
                      }
                      className="w-full border rounded p-2 text-sm bg-white"
                      placeholder="Ej: Usuario Calificado Co-representado"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Volumen de energía anual (MWh)</label>
                    <input
                      type="number"
                      step="any"
                      value={form.volumen_energia_mwh_anual ?? ''}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          volumen_energia_mwh_anual: e.target.value ? Number(e.target.value) : null,
                        }))
                      }
                      className="w-full border rounded p-2 text-sm bg-white"
                      placeholder="Ej: 1500"
                    />
                  </div>
                </div>
              )}

              {['FV', 'BESS', 'FV+BESS'].includes(form.tipo || '') && (
                <div className="col-span-2 border-t border-gray-200/60 pt-4 mt-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">
                    Configuraciones y productos
                  </p>
                  <div className="bg-white border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm">
                    <div>
                      <p className="text-xs font-semibold text-principal">Alternativas técnicas de la solución</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        Configura múltiples alternativas técnicas, sitios y productos (FV/BESS) asociados al proyecto.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const saved = await handleGuardar(false)
                        if (saved) {
                          onOpenEditTecnica()
                        }
                      }}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold bg-principal text-acento rounded-lg hover:opacity-90 transition-all whitespace-nowrap"
                    >
                      <Pencil size={12} /> Configurar Alternativas y Productos
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
        <Button variant="outline" size="sm" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button size="sm" onClick={() => handleGuardar(true)} disabled={guardando}>
          {guardando ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </div>
    </Seccion>
  )
}
