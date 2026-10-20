import type { SupabaseClient } from '@supabase/supabase-js'
import type { EstadoProyecto, ModalidadFinanciamiento, Proyecto, ConfiguracionTecnica, Moneda } from '@/lib/types'
import type { CreationConfig, CreationFinancingOption } from '@/components/proyectos/wizard/types'
import { validateStageTransition, getStageTransitionPayload } from './lifecycle'
import { sanitizeFvDatos, sanitizeBessDatos, parseNum } from './schemas'

export async function selectTechnicalConfiguration(
  supabase: SupabaseClient,
  proyectoId: string,
  configId: string,
  prevSelectedId?: string
): Promise<{ success: boolean; data?: ConfiguracionTecnica; error?: string }> {
  try {
    // 1. First attempt transactional RPC
    const { error: rpcErr } = await supabase.rpc('seleccionar_configuracion_tecnica', {
      p_proyecto_id: proyectoId,
      p_config_id: configId,
    })

    if (!rpcErr) {
      const { data: updatedConfig } = await supabase
        .from('configuraciones_tecnicas')
        .select('*')
        .eq('id', configId)
        .single()

      return { success: true, data: updatedConfig as ConfiguracionTecnica }
    }

    // If RPC failed with non-missing function error, return error
    if (!rpcErr.message.includes('seleccionar_configuracion_tecnica')) {
      return { success: false, error: rpcErr.message }
    }

    // 2. Fallback: sequential update with compensating restore
    const { error: err1 } = await supabase
      .from('configuraciones_tecnicas')
      .update({ seleccionada: false })
      .eq('proyecto_id', proyectoId)

    if (err1) return { success: false, error: err1.message }

    const { data: updatedConfig, error: err2 } = await supabase
      .from('configuraciones_tecnicas')
      .update({ seleccionada: true })
      .eq('id', configId)
      .select()
      .single()

    if (err2) {
      if (prevSelectedId) {
        await supabase.from('configuraciones_tecnicas').update({ seleccionada: true }).eq('id', prevSelectedId)
      }
      return { success: false, error: err2.message }
    }

    if (updatedConfig) {
      await supabase
        .from('proyectos')
        .update({
          capex_estimado: updatedConfig.inversion_total,
          moneda: (updatedConfig.moneda || 'MXN') as Moneda,
        })
        .eq('id', proyectoId)
    }

    return { success: true, data: updatedConfig as ConfiguracionTecnica }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg }
  }
}

export async function selectFinancingOption(
  supabase: SupabaseClient,
  proyectoId: string,
  optionId: string,
  targetVehiculo: ModalidadFinanciamiento,
  prevSelectedId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. First attempt transactional RPC
    const { error: rpcErr } = await supabase.rpc('seleccionar_opcion_financiamiento', {
      p_proyecto_id: proyectoId,
      p_opcion_id: optionId,
    })

    if (!rpcErr) {
      return { success: true }
    }

    // If RPC failed with non-missing function error, return error
    if (!rpcErr.message.includes('seleccionar_opcion_financiamiento')) {
      return { success: false, error: rpcErr.message }
    }

    // 2. Fallback: sequential update with compensating restore
    const { error: err1 } = await supabase
      .from('opciones_financiamiento')
      .update({ seleccionada: false })
      .eq('proyecto_id', proyectoId)

    if (err1) return { success: false, error: err1.message }

    const { error: err2 } = await supabase
      .from('opciones_financiamiento')
      .update({ seleccionada: true })
      .eq('id', optionId)

    if (err2) {
      if (prevSelectedId) {
        await supabase.from('opciones_financiamiento').update({ seleccionada: true }).eq('id', prevSelectedId)
      }
      return { success: false, error: err2.message }
    }

    await supabase
      .from('proyectos')
      .update({
        modalidad_financiamiento: [targetVehiculo],
      })
      .eq('id', proyectoId)

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg }
  }
}

export async function transitionProjectStage(
  supabase: SupabaseClient,
  proyecto: Proyecto,
  targetStage: EstadoProyecto,
  configs: { seleccionada?: boolean }[],
  financingOptions: { seleccionada?: boolean }[]
): Promise<{ success: boolean; data?: Proyecto; error?: string }> {
  const validation = validateStageTransition(proyecto, targetStage, configs, financingOptions)
  if (!validation.valid) {
    return { success: false, error: validation.error }
  }

  const payload = getStageTransitionPayload(targetStage, proyecto.historial_estados)
  const { data, error } = await supabase
    .from('proyectos')
    .update(payload)
    .eq('id', proyecto.id)
    .select()
    .single()

  if (error) {
    return { success: false, error: 'Error al cambiar de estado: ' + error.message }
  }
  return { success: true, data: data as Proyecto }
}

export async function deleteProject(
  supabase: SupabaseClient,
  proyectoId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('proyectos').delete().eq('id', proyectoId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export interface SaveTechnicalConfigParams {
  proyectoId: string
  configs: (CreationConfig & { id?: string })[]
  existingConfigs: { id: string }[]
  existingProducts: { id: string }[]
  allSiteIds: string[]
}

export async function saveTechnicalConfigurationsAndProducts(
  supabase: SupabaseClient,
  params: SaveTechnicalConfigParams
): Promise<{ success: boolean; error?: string }> {
  try {
    const { proyectoId, configs, existingConfigs, existingProducts, allSiteIds } = params

    // 1. Process and save configurations
    const idMap: Record<string, string> = {}

    for (const c of configs) {
      // Calculate total capex from products
      let totalCapex = 0
      let detectedMoneda: Moneda = 'MXN'
      Object.values(c.productosMap).forEach((prods) => {
        prods.forEach((p) => {
          if (p.tipo === 'fv' && p.fv) {
            totalCapex += parseNum(p.fv.capex)
            detectedMoneda = p.fv.capex_moneda || detectedMoneda
          } else if (p.tipo === 'bess' && p.bess) {
            totalCapex += parseNum(p.bess.capex)
            detectedMoneda = p.bess.capex_moneda || detectedMoneda
          }
        })
      })

      const ahorroAnual = parseNum(c.ahorro_estimado_anual)
      const ahorroMensual = ahorroAnual ? ahorroAnual / 12 : null

      const configPayload = {
        proyecto_id: proyectoId,
        nombre: c.nombre,
        descripcion: c.descripcion || null,
        inversion_total: totalCapex,
        moneda: detectedMoneda,
        ahorro_estimado_anual: ahorroAnual || null,
        ahorro_estimado_mensual: ahorroMensual,
        ahorro_moneda: c.ahorro_moneda || detectedMoneda,
      }

      if (c.id && !c.id.startsWith('cfg-') && c.id !== 'legacy') {
        const { error: err } = await supabase.from('configuraciones_tecnicas').update(configPayload).eq('id', c.id)
        if (err) throw err
        idMap[c.tempId] = c.id
      } else {
        const { data: newCfg, error: err } = await supabase
          .from('configuraciones_tecnicas')
          .insert(configPayload)
          .select()
          .single()
        if (err) throw err
        if (newCfg) idMap[c.tempId] = newCfg.id
      }
    }

    // 2. Prepare and save products with clean numeric sanitization
    const activeProductsList: Array<{
      id?: string
      proyecto_id: string
      sitio_id: string
      configuracion_id: string
      tipo: 'fv' | 'bess'
      datos: Record<string, unknown>
    }> = []

    configs.forEach((c) => {
      const configDbId = idMap[c.tempId]
      Object.entries(c.productosMap).forEach(([siteId, prods]) => {
        prods.forEach((p) => {
          const rawId = (p as unknown as { id?: string }).id
          activeProductsList.push({
            id: rawId && !rawId.startsWith('prod-') ? rawId : undefined,
            proyecto_id: proyectoId,
            sitio_id: siteId,
            configuracion_id: configDbId,
            tipo: p.tipo,
            datos: p.tipo === 'fv' ? sanitizeFvDatos(p.fv || {}) : sanitizeBessDatos(p.bess || {}),
          })
        })
      })
    })

    const prodsToUpdate = activeProductsList.filter((p) => p.id && !p.id.startsWith('prod-'))
    const prodsToInsert = activeProductsList.filter((p) => !p.id || p.id.startsWith('prod-'))

    for (const p of prodsToUpdate) {
      const { error: err } = await supabase
        .from('proyecto_sitio_productos')
        .update({
          sitio_id: p.sitio_id,
          configuracion_id: p.configuracion_id,
          tipo: p.tipo,
          datos: p.datos,
        })
        .eq('id', p.id as string)
      if (err) throw err
    }

    if (prodsToInsert.length > 0) {
      const { error: err } = await supabase.from('proyecto_sitio_productos').insert(
        prodsToInsert.map((p) => ({
          proyecto_id: p.proyecto_id,
          sitio_id: p.sitio_id,
          configuracion_id: p.configuracion_id,
          tipo: p.tipo,
          datos: p.datos,
        }))
      )
      if (err) throw err
    }

    // 3. Delete removed products
    const activeProductIds = activeProductsList.map((p) => p.id).filter(Boolean) as string[]
    const productsToDelete = (existingProducts ?? []).map((p) => p.id).filter((id) => !activeProductIds.includes(id))
    if (productsToDelete.length > 0) {
      const { error: err } = await supabase.from('proyecto_sitio_productos').delete().in('id', productsToDelete)
      if (err) throw err
    }

    // 4. Delete removed configurations
    const configIdsToKeep = configs.map((c) => c.id).filter((id) => id && id !== 'legacy') as string[]
    const configsToDelete = (existingConfigs ?? []).filter(
      (c) => c.id && c.id !== 'legacy' && !configIdsToKeep.includes(c.id)
    )
    if (configsToDelete.length > 0) {
      const { error: err } = await supabase
        .from('configuraciones_tecnicas')
        .delete()
        .in('id', configsToDelete.map((c) => c.id))
      if (err) throw err
    }

    // 5. Sync project sites (proyecto_sitios relation)
    const activeSitesUnion = Array.from(new Set(configs.flatMap((c) => c.sitiosSeleccionados)))
    const { data: dbLinks, error: linksErr } = await supabase
      .from('proyecto_sitios')
      .select('sitio_id')
      .eq('proyecto_id', proyectoId)
    if (linksErr) throw linksErr

    const dbSiteIds = (dbLinks ?? []).map((l: { sitio_id: string }) => l.sitio_id)
    const sitesToAdd = activeSitesUnion.filter((sId) => !dbSiteIds.includes(sId) && allSiteIds.includes(sId))
    const sitesToRemove = dbSiteIds.filter((sId) => !activeSitesUnion.includes(sId))

    if (sitesToAdd.length > 0) {
      const { error: addErr } = await supabase
        .from('proyecto_sitios')
        .insert(sitesToAdd.map((sId) => ({ proyecto_id: proyectoId, sitio_id: sId })))
      if (addErr) throw addErr
    }

    if (sitesToRemove.length > 0) {
      const { error: rmErr } = await supabase
        .from('proyecto_sitios')
        .delete()
        .eq('proyecto_id', proyectoId)
        .in('sitio_id', sitesToRemove)
      if (rmErr) throw rmErr
    }

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg }
  }
}

export interface SaveFinancingParams {
  proyectoId: string
  options: (CreationFinancingOption & { id?: string; linkedConfigIds?: string[] })[]
  existingOptions: { id: string }[]
  isRecomendacionNodo: boolean
  allConfigIds: string[]
}

export async function saveFinancingOptionsAndLinks(
  supabase: SupabaseClient,
  params: SaveFinancingParams
): Promise<{ success: boolean; error?: string }> {
  try {
    const { proyectoId, options, existingOptions, isRecomendacionNodo } = params

    if (isRecomendacionNodo) {
      await supabase.from('opciones_financiamiento').delete().eq('proyecto_id', proyectoId)
      await supabase
        .from('proyectos')
        .update({ modalidad_financiamiento: ['no_sabe'] })
        .eq('id', proyectoId)
      return { success: true }
    }

    const savedOptionIds: string[] = []

    for (const opt of options) {
      const ahorroAnual = parseNum(opt.ahorro_estimado_anual)
      const ahorroMensual = ahorroAnual ? ahorroAnual / 12 : null

      const optionPayload = {
        proyecto_id: proyectoId,
        nombre: opt.nombre,
        vehiculo_inversion: opt.vehiculo_inversion,
        ahorro_estimado_anual: ahorroAnual || null,
        ahorro_estimado_mensual: ahorroMensual,
        moneda: opt.ahorro_moneda || 'MXN',
        plazo_meses: parseNum((opt as unknown as { plazo_meses?: unknown }).plazo_meses) || null,
        notas: (opt as unknown as { notas?: string }).notas || null,
      }

      let optionDbId = opt.id
      if (optionDbId && !optionDbId.startsWith('opt-') && optionDbId !== 'legacy') {
        const { error: err } = await supabase.from('opciones_financiamiento').update(optionPayload).eq('id', optionDbId)
        if (err) throw err
      } else {
        const { data: newOpt, error: err } = await supabase
          .from('opciones_financiamiento')
          .insert(optionPayload)
          .select()
          .single()
        if (err) throw err
        if (newOpt) optionDbId = newOpt.id
      }

      if (optionDbId) {
        savedOptionIds.push(optionDbId)
        // Sync config_financiamiento links
        const linkedConfigs = opt.linkedConfigIds ?? []
        await supabase.from('config_financiamiento').delete().eq('opcion_financiamiento_id', optionDbId)
        if (linkedConfigs.length > 0) {
          const linksToInsert = linkedConfigs.map((cfgId) => ({
            opcion_financiamiento_id: optionDbId,
            configuracion_id: cfgId,
          }))
          const { error: linkErr } = await supabase.from('config_financiamiento').insert(linksToInsert)
          if (linkErr) throw linkErr
        }
      }
    }

    // Delete removed options
    const optionsToDelete = (existingOptions ?? []).filter((o) => !savedOptionIds.includes(o.id))
    if (optionsToDelete.length > 0) {
      const { error: err } = await supabase
        .from('opciones_financiamiento')
        .delete()
        .in('id', optionsToDelete.map((o) => o.id))
      if (err) throw err
    }

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg }
  }
}
