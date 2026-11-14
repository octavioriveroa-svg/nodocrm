'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import StepIndicator from '@/components/ui/StepIndicator'
import type { ProjectWizardProps } from './wizard/types'
import { validarPaso3 } from './wizard/validation'
import { useProjectWizardState } from './wizard/useProjectWizardState'
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
  const state = useProjectWizardState(portalType)
  const { supabase, capabilities, step, setStep, form, error, setError, loading, setLoading } = state

  function guardarProducto(sitioId: string) {
    const tempId =
      typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`
    state.guardarProductoWithId(sitioId, tempId)
  }

  async function handleSubmit() {
    setError('')
    const isNodoBuscaNow = form.tipo_instalacion === 'nodo_busca'
    if (!isNodoBuscaNow) {
      const err = validarPaso3(state.financingOptions, state.isRecomendacionNodo)
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

    const {
      proyectoPayload,
      todosSitios,
      rpcConfiguraciones,
      rpcOpcionesFinanciamiento,
      rpcLinks,
      rpcProductos,
    } = state.prepareSubmissionPayloads(session.user.id)

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
      router.push(
        onSuccessRedirect
          ? onSuccessRedirect(rpcProyectoId as string)
          : `${capabilities.redirectPrefix}/${rpcProyectoId as string}`
      )
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
      await state.insertFallbackChildTables(proyecto.id, todosSitios)
      router.push(
        onSuccessRedirect
          ? onSuccessRedirect(proyecto.id)
          : `${capabilities.redirectPrefix}/${proyecto.id}`
      )
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

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black">{title}</h1>
        <p className="text-sm mt-1 text-muted">
          {state.isNodoBusca
            ? 'Completa los 2 pasos para crear el proyecto / Complete 2 steps'
            : 'Completa los 4 pasos para crear el proyecto / Complete 4 steps'}
        </p>
      </div>

      <StepIndicator
        steps={
          state.isNodoBusca
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
            setF={state.setF}
            epcList={state.epcList}
            nodoUsers={state.nodoUsers}
            finderList={state.finderList}
            selectedEpcId={state.selectedEpcId}
            handleSelectEpc={state.handleSelectEpc}
            selectedResponsableId={state.selectedResponsableId}
            setSelectedResponsableId={state.setSelectedResponsableId}
            selectedFinderId={state.selectedFinderId}
            setSelectedFinderId={state.setSelectedFinderId}
            clienteManual={state.clienteManual}
            setClienteManual={state.setClienteManual}
            manualCliente={state.manualCliente}
            setManualCliente={state.setManualCliente}
            clientes={state.clientes}
            clientesCargados={state.clientesCargados}
            seleccionarCliente={state.seleccionarCliente}
            onInviteEpcSuccess={state.handleReloadEpcList}
          />
        )}

        {step === 1 && (
          <Step1Sites
            sitiosCliente={state.sitiosCliente}
            selectedSiteIds={state.selectedSiteIds}
            toggleSitio={state.toggleSitio}
            mostrarNuevoSitio={state.mostrarNuevoSitio}
            setMostrarNuevoSitio={state.setMostrarNuevoSitio}
            nuevoSitio={state.nuevoSitio}
            setNuevoSitio={state.setNuevoSitio}
            sitioError={state.sitioError}
            guardandoSitio={state.guardandoSitio}
            reciboUrlNuevo={state.reciboUrlNuevo}
            subiendoPdfNuevo={state.subiendoPdfNuevo}
            subirPdfNuevo={state.subirPdfNuevo}
            guardarNuevoSitio={state.guardarNuevoSitio}
            viendoSitioId={state.viendoSitioId}
            setViendoSitioId={state.setViendoSitioId}
            editandoSitioId={state.editandoSitioId}
            abrirEditarSitio={state.abrirEditarSitio}
            setEditandoSitioId={state.setEditandoSitioId}
            editSitioForm={state.editSitioForm}
            setEditSitioForm={state.setEditSitioForm}
            editSitioReciboUrl={state.editSitioReciboUrl}
            subiendoPdfEdit={state.subiendoPdfEdit}
            subirPdfEdit={state.subirPdfEdit}
            guardandoEditSitio={state.guardandoEditSitio}
            actualizarSitio={state.actualizarSitio}
            deletingSitioId={state.deletingSitioId}
            setDeletingSitioId={state.setDeletingSitioId}
            eliminarSitio={state.eliminarSitio}
            fileRefNuevo={state.fileRefNuevo}
            fileRefEdit={state.fileRefEdit}
            onOpenNuevoSitio={() => {
              state.setMostrarNuevoSitio(true)
              state.setSitioError('')
              state.setViendoSitioId(null)
              state.setEditandoSitioId(null)
              state.setAddingToSitioId(null)
            }}
          />
        )}

        {step === 2 && !state.isNodoBusca && (
          <Step2TechnicalConfigs
            configs={state.configs}
            setConfigs={state.setConfigs}
            activeConfigId={state.activeConfigId}
            setActiveConfigId={state.setActiveConfigId}
            selectedSiteIds={state.selectedSiteIds}
            sitiosCliente={state.sitiosCliente}
            activeConfig={state.activeConfig}
            addingToSitioId={state.addingToSitioId}
            setAddingToSitioId={state.setAddingToSitioId}
            productTipo={state.productTipo}
            setProductTipo={state.setProductTipo}
            fvForm={state.fvForm}
            setFvForm={state.setFvForm}
            bessForm={state.bessForm}
            setBessForm={state.setBessForm}
            addProductError={state.addProductError}
            guardarProducto={guardarProducto}
            removeProduct={state.removeProduct}
            activeConfigCapex={state.activeConfigCapex}
            activeConfigMoneda={state.activeConfigMoneda}
            startAddingProduct={state.startAddingProduct}
          />
        )}

        {step === 3 && !state.isNodoBusca && (
          <Step3Financing
            anyHighDemanda={state.anyHighDemanda}
            form={form}
            setF={state.setF}
            financingOptions={state.financingOptions}
            setFinancingOptions={state.setFinancingOptions}
            toggleVehiculo={state.toggleVehiculo}
            configs={state.configs}
            foldedCharacteristics={state.foldedCharacteristics}
            setFoldedCharacteristics={state.setFoldedCharacteristics}
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
          {step < (state.isNodoBusca ? 1 : 3) ? (
            <button
              type="button"
              onClick={() => state.handleNext(handleSubmit)}
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
