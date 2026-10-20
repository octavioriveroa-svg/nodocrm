'use client'

import React from 'react'
import { MapPin, HelpCircle, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Seccion, Campo } from './common'
import type {
  Proyecto,
  Profile,
  Sitio,
  Archivo,
  HitoConstruccion,
  ConfiguracionTecnica,
  OpcionFinanciamiento,
} from '@/lib/types'
import { fmtCurrency, fmtUnit } from '@/lib/format'
import GanttChart from '@/components/gantt/GanttChart'
import DocumentCenter from '@/components/DocumentCenter'

interface Props {
  proyecto: Proyecto
  currentUser: Profile
  sitios: Sitio[]
  archivos: Archivo[]
  setArchivos: React.Dispatch<React.SetStateAction<Archivo[]>>
  hitosLocales: HitoConstruccion[]
  generandoCronograma: boolean
  onGenerarCronograma: () => Promise<void>
  onSelectHito: (hito: HitoConstruccion) => void
  hasProducts: boolean
  configsList?: ConfiguracionTecnica[]
  opcionesFin?: OpcionFinanciamiento[]
}

export default function ProjectOverviewSections({
  proyecto,
  currentUser,
  sitios,
  archivos,
  setArchivos,
  hitosLocales,
  generandoCronograma,
  onGenerarCronograma,
  onSelectHito,
  hasProducts,
  configsList = [],
  opcionesFin = [],
}: Props) {
  const isAdmin = currentUser.rol === 'nodo_admin'
  const isEpcista = currentUser.rol === 'epc'

  const leadingConfig = configsList.find((c) => c.seleccionada) || configsList[0]
  const leadingOpt = opcionesFin.find((o) => o.seleccionada) || opcionesFin[0]

  const leadingNetSavings = leadingOpt
    ? leadingOpt.ahorro_estimado_anual != null
      ? Number(leadingOpt.ahorro_estimado_anual)
      : leadingOpt.ahorro_estimado_mensual != null
        ? Number(leadingOpt.ahorro_estimado_mensual) * 12
        : null
    : null

  const leadingGrossSavings = leadingConfig
    ? leadingConfig.ahorro_estimado_anual != null
      ? Number(leadingConfig.ahorro_estimado_anual)
      : leadingConfig.ahorro_estimado_mensual != null
        ? Number(leadingConfig.ahorro_estimado_mensual) * 12
        : null
    : null

  const effectiveSavings =
    leadingNetSavings != null && leadingNetSavings > 0
      ? leadingNetSavings
      : leadingGrossSavings || null
  const isNetSavings = leadingNetSavings != null && leadingNetSavings > 0
  const effectiveSavingsMoneda = isNetSavings
    ? leadingOpt?.moneda || 'MXN'
    : leadingConfig?.ahorro_moneda || leadingConfig?.moneda || proyecto.moneda || 'MXN'

  const effectiveCapex = proyecto.capex_estimado || leadingConfig?.inversion_total || 0
  const effectiveCapexMoneda = proyecto.moneda || leadingConfig?.moneda || 'MXN'

  const hasEngineeringSpecs =
    proyecto.demanda_kw != null ||
    proyecto.capacidad_mwh != null ||
    proyecto.capacidad_mw != null ||
    Boolean(proyecto.tecnologia_bateria) ||
    proyecto.duracion_descarga_hrs != null ||
    Boolean(proyecto.punto_interconexion)

  return (
    <div className="flex flex-col gap-4">
      {/* Sitios del proyecto */}
      {sitios.length > 0 && (
        <Seccion title="Sitios del proyecto">
          <div className="flex flex-col gap-3">
            {sitios.map((s) => (
              <div key={s.id} className="border border-borde rounded-xl p-4 shadow-sm bg-fondo">
                <p className="font-bold text-sm text-principal">{s.nombre}</p>
                {s.nombre_recibo && (
                  <p className="text-xs mt-0.5 text-gray-500">{s.nombre_recibo}</p>
                )}
                <div className="flex flex-wrap gap-4 mt-2 pt-2 border-t border-gray-200/60">
                  {(s.ciudad || s.ubicacion_estado) && (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                      <MapPin size={12} />
                      {[s.ciudad, s.ubicacion_estado].filter(Boolean).join(', ')}
                    </span>
                  )}
                  {s.rpu && <span className="text-xs font-medium text-gray-500">RPU: {s.rpu}</span>}
                  {s.demanda_contratada_kw != null && (
                    <span className="text-xs font-medium text-gray-500">
                      Demanda: {fmtUnit(s.demanda_contratada_kw, 'kW')}
                    </span>
                  )}
                  {s.recibo_url && (
                    <a
                      href={s.recibo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold underline text-principal hover:text-gray-700 transition-colors"
                    >
                      Ver recibo CFE
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Seccion>
      )}

      {/* Tipo de instalación */}
      {proyecto.tipo_instalacion && (
        <Seccion title="Tipo de instalación">
          <div className="flex items-start gap-3">
            {proyecto.tipo_instalacion === 'nodo_busca' ? (
              <HelpCircle size={16} className="text-gray-400 shrink-0 mt-0.5" />
            ) : (
              <Wrench size={16} className="text-gray-400 shrink-0 mt-0.5" />
            )}
            <p className="text-sm font-medium">
              {proyecto.tipo_instalacion === 'nodo_busca'
                ? 'Quiero que Nodo me ayude a encontrar un instalador'
                : 'La empresa EPCista realizará la instalación'}
            </p>
          </div>
        </Seccion>
      )}

      {/* Datos del sitio (Requerimientos de ingeniería) */}
      {hasEngineeringSpecs && (
        <Seccion title="Datos del sitio (Requerimientos de ingeniería)">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {proyecto.demanda_kw != null && (
              <Campo label="Demanda contratada" value={fmtUnit(proyecto.demanda_kw, 'kW')} />
            )}
            {proyecto.punto_interconexion && (
              <Campo label="Punto de interconexión" value={proyecto.punto_interconexion} />
            )}
            {proyecto.capacidad_mwh != null && (
              <Campo label="Capacidad requerida (MWh)" value={`${proyecto.capacidad_mwh} MWh`} />
            )}
            {proyecto.capacidad_mw != null && (
              <Campo label="Potencia requerida (MW)" value={`${proyecto.capacidad_mw} MW`} />
            )}
            {proyecto.tecnologia_bateria && (
              <Campo label="Tecnología de batería" value={proyecto.tecnologia_bateria} />
            )}
            {proyecto.duracion_descarga_hrs != null && (
              <Campo label="Duración de descarga" value={`${proyecto.duracion_descarga_hrs} hrs`} />
            )}
          </div>
        </Seccion>
      )}

      {/* MEM */}
      {proyecto.incluye_mem && (
        <Seccion title="Mercado Eléctrico Mayorista">
          <span className="inline-flex items-center px-3 py-1 text-xs font-semibold bg-acento text-principal rounded-md">
            Alternativa MEM solicitada
          </span>
        </Seccion>
      )}

      {/* Datos técnicos — MEM (Legacy) */}
      {(proyecto.tipo === 'MEM' || proyecto.tipo === 'BESS+MEM') && !hasProducts && (
        <Seccion title="Datos técnicos — MEM">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Campo label="Tipo de participación MEM" value={proyecto.tipo_participacion_mem} />
            <Campo
              label="Volumen de energía anual"
              value={proyecto.volumen_energia_mwh_anual ? `${proyecto.volumen_energia_mwh_anual} MWh` : null}
            />
          </div>
        </Seccion>
      )}

      {/* Ubicación y Notas */}
      <Seccion title="Ubicación y Notas">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <Campo
            label="CAPEX estimado (Ganador)"
            value={effectiveCapex ? fmtCurrency(effectiveCapex, effectiveCapexMoneda) : null}
          />
          <Campo
            label="Ahorro anual estimado (Ganador)"
            value={effectiveSavings ? fmtCurrency(effectiveSavings, effectiveSavingsMoneda) : null}
          />
          <Campo label="Estado" value={proyecto.ubicacion_estado} />
        </div>
        {proyecto.notas_adicionales && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="text-xs font-medium mb-1 text-gray-400">Notas adicionales</div>
            <p className="text-sm whitespace-pre-wrap">{proyecto.notas_adicionales}</p>
          </div>
        )}
      </Seccion>

      {/* Cronograma Gantt (legacy) */}
      <Seccion title="Cronograma de Construcción (Legacy)">
        {hitosLocales.length === 0 && (isEpcista || isAdmin) ? (
          <div className="flex flex-col items-center justify-center py-10 bg-white/40 border border-dashed border-borde rounded-xl">
            <p className="text-sm font-medium text-gray-500 mb-4">
              Aún no se ha definido el cronograma de obra.
            </p>
            <Button onClick={onGenerarCronograma} disabled={generandoCronograma}>
              {generandoCronograma ? 'Generando...' : 'Generar Cronograma Base'}
            </Button>
          </div>
        ) : (
          <GanttChart
            hitos={hitosLocales}
            readOnly={!isEpcista && !isAdmin}
            onHitoClick={onSelectHito}
          />
        )}
      </Seccion>

      {/* Documentos y Anexos */}
      <Seccion title="Documentos y Anexos">
        <DocumentCenter
          archivos={archivos}
          proyectoId={proyecto.id}
          currentUser={currentUser}
          onUploadSuccess={(newA) => setArchivos((prev) => [newA, ...prev])}
          onDeleteSuccess={(id) => setArchivos((prev) => prev.filter((a) => a.id !== id))}
        />
      </Seccion>
    </div>
  )
}
