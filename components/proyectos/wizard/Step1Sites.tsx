'use client'

import React from 'react'
import { Plus, X, Eye, Pencil, Trash2, Upload, FileText } from 'lucide-react'
import type { Sitio } from '@/lib/types'
import type { NuevoSitioForm } from './types'
import { ESTADOS_MX, inp } from './constants'

interface Step1SitesProps {
  sitiosCliente: Sitio[]
  selectedSiteIds: string[]
  toggleSitio: (id: string) => void
  mostrarNuevoSitio: boolean
  setMostrarNuevoSitio: (val: boolean) => void
  nuevoSitio: NuevoSitioForm
  setNuevoSitio: React.Dispatch<React.SetStateAction<NuevoSitioForm>>
  sitioError: string
  guardandoSitio: boolean
  reciboUrlNuevo: string | null
  subiendoPdfNuevo: boolean
  subirPdfNuevo: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  guardarNuevoSitio: () => Promise<void>
  viendoSitioId: string | null
  setViendoSitioId: (id: string | null) => void
  editandoSitioId: string | null
  abrirEditarSitio: (s: Sitio) => void
  setEditandoSitioId: (id: string | null) => void
  editSitioForm: NuevoSitioForm
  setEditSitioForm: React.Dispatch<React.SetStateAction<NuevoSitioForm>>
  editSitioReciboUrl: string | null
  subiendoPdfEdit: boolean
  subirPdfEdit: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  guardandoEditSitio: boolean
  actualizarSitio: () => Promise<void>
  deletingSitioId: string | null
  setDeletingSitioId: (id: string | null) => void
  eliminarSitio: (id: string) => Promise<void>
  fileRefNuevo: React.RefObject<HTMLInputElement | null>
  fileRefEdit: React.RefObject<HTMLInputElement | null>
  onOpenNuevoSitio: () => void
}

export function Step1Sites({
  sitiosCliente,
  selectedSiteIds,
  toggleSitio,
  mostrarNuevoSitio,
  setMostrarNuevoSitio,
  nuevoSitio,
  setNuevoSitio,
  sitioError,
  guardandoSitio,
  reciboUrlNuevo,
  subiendoPdfNuevo,
  subirPdfNuevo,
  guardarNuevoSitio,
  viendoSitioId,
  setViendoSitioId,
  editandoSitioId,
  abrirEditarSitio,
  setEditandoSitioId,
  editSitioForm,
  setEditSitioForm,
  editSitioReciboUrl,
  subiendoPdfEdit,
  subirPdfEdit,
  guardandoEditSitio,
  actualizarSitio,
  deletingSitioId,
  setDeletingSitioId,
  eliminarSitio,
  fileRefNuevo,
  fileRefEdit,
  onOpenNuevoSitio,
}: Step1SitesProps) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-bold text-lg">1. Sitios del Cliente / Client Sites</h2>
        <p className="text-xs text-muted">
          Selecciona o agrega los sitios del cliente que formarán parte de este proyecto.
          <br />
          <span className="text-[11px] text-gray-400">
            Select or add the client sites that will be part of this project.
          </span>
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          Sitios a cotizar / Sites to quote *
        </label>

        {sitiosCliente.length === 0 && !mostrarNuevoSitio && (
          <p className="text-sm mb-3 text-muted">
            Este cliente no tiene sitios registrados / This client has no registered sites.
          </p>
        )}

        {/* Lista de sitios */}
        <div className="flex flex-col gap-2 mb-3">
          {sitiosCliente.map(s => {
            const selected = selectedSiteIds.includes(s.id)

            return (
              <div key={s.id}>
                {/* Fila sitio */}
                <div
                  className="flex items-center gap-3 border rounded-xl p-3 shadow-sm transition-all"
                  style={{
                    borderColor: selected ? 'var(--color-principal)' : 'var(--color-neutral-200)',
                    backgroundColor: selected ? 'var(--color-green-50)' : 'var(--color-white)',
                  }}
                >
                  <input
                    type="checkbox"
                    id={`s-${s.id}`}
                    checked={selected}
                    onChange={() => toggleSitio(s.id)}
                    className="w-4 h-4 flex-shrink-0 cursor-pointer"
                  />
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
                    <button
                      type="button"
                      onClick={() => {
                        setViendoSitioId(viendoSitioId === s.id ? null : s.id)
                        setEditandoSitioId(null)
                        setDeletingSitioId(null)
                      }}
                      className="p-1.5 border rounded-lg transition-colors hover:shadow-sm"
                      style={{
                        borderColor: viendoSitioId === s.id ? 'var(--color-principal)' : 'var(--color-neutral-200)',
                        backgroundColor: viendoSitioId === s.id ? 'var(--color-principal)' : 'var(--color-white)',
                        color: viendoSitioId === s.id ? 'var(--color-acento)' : 'var(--color-texto-suave)',
                      }}
                      title="Ver detalles"
                    >
                      <Eye size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirEditarSitio(s)}
                      className="p-1.5 border rounded-lg transition-colors hover:shadow-sm"
                      style={{
                        borderColor: editandoSitioId === s.id ? 'var(--color-principal)' : 'var(--color-neutral-200)',
                        backgroundColor: editandoSitioId === s.id ? 'var(--color-gray-100)' : 'var(--color-white)',
                        color: 'var(--color-texto-suave)',
                      }}
                      title="Editar sitio"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeletingSitioId(s.id)
                        setViendoSitioId(null)
                        setEditandoSitioId(null)
                      }}
                      className="p-1.5 border rounded-lg transition-colors hover:shadow-sm"
                      style={{ borderColor: 'var(--color-neutral-200)', color: 'var(--color-red-600)' }}
                      title="Eliminar sitio"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Confirmación eliminar */}
                {deletingSitioId === s.id && (
                  <div
                    className="border border-t-0 px-4 py-3 flex items-center justify-between"
                    style={{ borderColor: 'var(--color-red-600)', backgroundColor: 'var(--color-red-50)' }}
                  >
                    <p className="text-sm">
                      ¿Eliminar <strong>{s.nombre}</strong>?
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setDeletingSitioId(null)}
                        className="px-3 py-1 text-xs border border-borde rounded-xl"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => eliminarSitio(s.id)}
                        className="px-3 py-1 text-xs font-bold text-white rounded-xl"
                        style={{ backgroundColor: 'var(--color-red-600)' }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                )}

                {/* Panel Ver */}
                {viendoSitioId === s.id && (
                  <div
                    className="border border-t-0 px-4 py-3"
                    style={{ borderColor: 'var(--color-principal)', backgroundColor: 'var(--color-neutral-50)' }}
                  >
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                      {s.nombre_recibo && (
                        <div>
                          <span className="text-muted">Nombre en recibo: </span>
                          <span className="font-medium">{s.nombre_recibo}</span>
                        </div>
                      )}
                      {(s.ciudad || s.ubicacion_estado) && (
                        <div>
                          <span className="text-muted">Ubicación: </span>
                          <span className="font-medium">
                            {[s.ciudad, s.ubicacion_estado].filter(Boolean).join(', ')}
                          </span>
                        </div>
                      )}
                      {s.rpu && (
                        <div>
                          <span className="text-muted">RPU: </span>
                          <span className="font-medium">{s.rpu}</span>
                        </div>
                      )}
                      {s.demanda_contratada_kw != null && (
                        <div>
                          <span className="text-muted">Demanda: </span>
                          <span className="font-medium">
                            {s.demanda_contratada_kw.toLocaleString('es-MX')} kW
                          </span>
                        </div>
                      )}
                      {s.recibo_url && (
                        <div className="col-span-2">
                          <a
                            href={s.recibo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 underline font-medium"
                            style={{ color: 'var(--color-principal)' }}
                          >
                            <FileText size={11} /> Ver recibo CFE / View bill
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Panel Editar sitio */}
                {editandoSitioId === s.id && (
                  <div
                    className="border border-t-0 px-4 py-4"
                    style={{ borderColor: 'var(--color-principal)' }}
                  >
                    <p className="text-xs font-bold mb-3">Editar sitio / Edit site</p>
                    <div className="flex flex-col gap-3">
                      <input
                        type="text"
                        value={editSitioForm.nombre}
                        onChange={e => setEditSitioForm(f => ({ ...f, nombre: e.target.value }))}
                        className={inp}
                        placeholder="Nombre del sitio *"
                      />
                      <input
                        type="text"
                        value={editSitioForm.nombre_recibo}
                        onChange={e => setEditSitioForm(f => ({ ...f, nombre_recibo: e.target.value }))}
                        className={inp}
                        placeholder="Nombre como aparece en el recibo"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={editSitioForm.ciudad}
                          onChange={e => setEditSitioForm(f => ({ ...f, ciudad: e.target.value }))}
                          className={inp}
                          placeholder="Ciudad"
                        />
                        <select
                          value={editSitioForm.ubicacion_estado}
                          onChange={e => setEditSitioForm(f => ({ ...f, ubicacion_estado: e.target.value }))}
                          className={inp}
                        >
                          <option value="">Estado</option>
                          {ESTADOS_MX.map(est => (
                            <option key={est} value={est}>
                              {est}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={editSitioForm.rpu}
                          onChange={e => setEditSitioForm(f => ({ ...f, rpu: e.target.value }))}
                          className={inp}
                          placeholder="RPU"
                        />
                        <input
                          type="number"
                          min="0"
                          value={editSitioForm.demanda_contratada_kw}
                          onChange={e => setEditSitioForm(f => ({ ...f, demanda_contratada_kw: e.target.value }))}
                          className={inp}
                          placeholder="Demanda contratada (kW)"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          ref={fileRefEdit}
                          type="file"
                          accept=".pdf"
                          onChange={subirPdfEdit}
                          className="hidden"
                          id="edit-recibo-pdf"
                        />
                        <label
                          htmlFor="edit-recibo-pdf"
                          className="flex items-center gap-1.5 px-3 py-1.5 border text-xs font-medium cursor-pointer border-borde rounded-xl bg-white hover:bg-gray-50"
                        >
                          <Upload size={11} />
                          {subiendoPdfEdit ? 'Subiendo…' : 'Recibo CFE (PDF)'}
                        </label>
                        {editSitioReciboUrl && (
                          <a
                            href={editSitioReciboUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs underline flex items-center gap-1 text-principal"
                          >
                            <FileText size={11} /> Ver PDF
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between mt-3">
                      <button
                        type="button"
                        onClick={() => setEditandoSitioId(null)}
                        className="px-3 py-1.5 text-xs border border-borde rounded-xl"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={actualizarSitio}
                        disabled={guardandoEditSitio || !editSitioForm.nombre.trim()}
                        className="px-4 py-1.5 text-xs font-bold disabled:opacity-50 bg-acento text-principal rounded-xl"
                      >
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
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Nuevo sitio / New Site
              </p>
              <button
                type="button"
                onClick={() => setMostrarNuevoSitio(false)}
                className="text-muted hover:text-black"
              >
                <X size={14} />
              </button>
            </div>
            {sitioError && <p className="text-xs text-red-600 font-medium">{sitioError}</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Nombre del sitio *</label>
                <input
                  type="text"
                  value={nuevoSitio.nombre}
                  onChange={e => setNuevoSitio(f => ({ ...f, nombre: e.target.value }))}
                  className={inp}
                  placeholder="Planta Norte"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Nombre en recibo CFE</label>
                <input
                  type="text"
                  value={nuevoSitio.nombre_recibo}
                  onChange={e => setNuevoSitio(f => ({ ...f, nombre_recibo: e.target.value }))}
                  className={inp}
                  placeholder="Razón social en el recibo"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Ciudad</label>
                <input
                  type="text"
                  value={nuevoSitio.ciudad}
                  onChange={e => setNuevoSitio(f => ({ ...f, ciudad: e.target.value }))}
                  className={inp}
                  placeholder="Monterrey"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Estado</label>
                <select
                  value={nuevoSitio.ubicacion_estado}
                  onChange={e => setNuevoSitio(f => ({ ...f, ubicacion_estado: e.target.value }))}
                  className={inp}
                >
                  <option value="">Selecciona estado</option>
                  {ESTADOS_MX.map(est => (
                    <option key={est} value={est}>
                      {est}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">RPU</label>
                <input
                  type="text"
                  value={nuevoSitio.rpu}
                  onChange={e => setNuevoSitio(f => ({ ...f, rpu: e.target.value }))}
                  className={inp}
                  placeholder="Registro Permanente de Usuario"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Demanda contratada (kW)</label>
                <input
                  type="number"
                  min="0"
                  value={nuevoSitio.demanda_contratada_kw}
                  onChange={e => setNuevoSitio(f => ({ ...f, demanda_contratada_kw: e.target.value }))}
                  className={inp}
                  placeholder="Ej: 500"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                ref={fileRefNuevo}
                type="file"
                accept=".pdf"
                onChange={subirPdfNuevo}
                className="hidden"
                id="recibo-pdf-input"
              />
              <label
                htmlFor="recibo-pdf-input"
                className="flex items-center gap-1.5 px-3 py-2 border text-xs font-medium cursor-pointer border-borde rounded-xl bg-white hover:bg-gray-50"
              >
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
              <button
                type="button"
                onClick={() => setMostrarNuevoSitio(false)}
                className="px-3 py-1.5 text-xs border border-borde rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardarNuevoSitio}
                disabled={guardandoSitio}
                className="px-4 py-1.5 text-xs font-bold bg-principal text-acento rounded-xl disabled:opacity-50"
              >
                {guardandoSitio ? 'Guardando…' : 'Guardar sitio'}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenNuevoSitio}
            className="flex items-center gap-2 px-3 py-2 text-sm border font-medium w-full justify-center border-borde border-dashed rounded-xl hover:border-black transition-colors"
          >
            <Plus size={14} />
            {sitiosCliente.length === 0
              ? 'Agregar primer sitio / Add first site'
              : 'Agregar otro sitio / Add another site'}
          </button>
        )}
      </div>
    </div>
  )
}
