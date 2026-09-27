import sys

file_path = r"c:\Users\vmont\projects\Nodo\nodocrm\app\(portals)\admin\proyectos\nuevo\page.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    original_content = f.read()

content = original_content

replacements = [
    (
"""interface BESSForm {
  potencia_kw: string
  capacidad_kwh: string
  marca: string
  uso: string
  capex: string
  capex_moneda: Moneda
}""", 
"""interface BESSForm {
  potencia_kw: string
  capacidad_kwh: string
  marca: string
  uso: string
  capex: string
  capex_moneda: Moneda
  inversores_hibridos: boolean
}"""
    ),
    (
"const emptyBess: BESSForm = { potencia_kw: '', capacidad_kwh: '', marca: '', uso: '', capex: '', capex_moneda: 'USD' }",
"const emptyBess: BESSForm = { potencia_kw: '', capacidad_kwh: '', marca: '', uso: '', capex: '', capex_moneda: 'USD', inversores_hibridos: false }"
    ),
    (
"""interface CreationConfig {
  tempId: string
  nombre: string
  descripcion: string
  sitiosSeleccionados: string[]
  productosMap: Record<string, Producto[]>
}""",
"""interface CreationConfig {
  tempId: string
  nombre: string
  descripcion: string
  sitiosSeleccionados: string[]
  productosMap: Record<string, Producto[]>
  ahorro_estimado_mensual: string
  ahorro_moneda: Moneda
}"""
    ),
    (
"""    {
      tempId: 'default',
      nombre: 'Configuración A',
      descripcion: '',
      sitiosSeleccionados: [],
      productosMap: {}
    }""",
"""    {
      tempId: 'default',
      nombre: 'Configuración A',
      descripcion: '',
      sitiosSeleccionados: [],
      productosMap: {},
      ahorro_estimado_mensual: '',
      ahorro_moneda: 'MXN'
    }"""
    ),
    (
"setConfigs([{ tempId: 'default', nombre: 'Configuración A', descripcion: '', sitiosSeleccionados: [], productosMap: {} }])",
"setConfigs([{ tempId: 'default', nombre: 'Configuración A', descripcion: '', sitiosSeleccionados: [], productosMap: {}, ahorro_estimado_mensual: '', ahorro_moneda: 'MXN' }])"
    ),
    (
"""                    {
                      tempId: newId,
                      nombre: `Configuración ${String.fromCharCode(65 + prev.length)}`,
                      descripcion: '',
                      sitiosSeleccionados: [],
                      productosMap: {}
                    }""",
"""                    {
                      tempId: newId,
                      nombre: `Configuración ${String.fromCharCode(65 + prev.length)}`,
                      descripcion: '',
                      sitiosSeleccionados: [],
                      productosMap: {},
                      ahorro_estimado_mensual: '',
                      ahorro_moneda: 'MXN'
                    }"""
    ),
    (
"""                                    <div>
                                      <label className="block text-xs font-medium mb-1">Uso *</label>
                                      <select value={bessForm.uso}
                                        onChange={e => setBessForm(f => ({ ...f, uso: e.target.value }))}
                                        className={inp} style={borde}>
                                        <option value="">Selecciona el uso</option>
                                        <option value="load_shifting">Load Shifting</option>
                                        <option value="ups">UPS</option>
                                        <option value="load_shifting_ups">Load Shifting + UPS</option>
                                      </select>
                                    </div>""",
"""                                    <div>
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
                                    <div className="flex items-center gap-2 mt-1">
                                      <input type="checkbox" id="inv_hib" checked={bessForm.inversores_hibridos} 
                                        onChange={e => setBessForm(f => ({...f, inversores_hibridos: e.target.checked}))} 
                                        className="w-4 h-4 rounded border-gray-300 text-principal focus:ring-principal" />
                                      <label htmlFor="inv_hib" className="text-xs font-medium cursor-pointer">Inversores híbridos (también manejan FV)</label>
                                    </div>"""
    ),
    (
"""  function validarFvForm(): string {
    if (!fvForm.num_modulos || !fvForm.potencia_modulos_w) return 'Ingresa número y potencia de módulos.'
    if (!fvForm.marca_modulos.trim()) return 'Ingresa la marca de los módulos.'
    if (!fvForm.num_inversores || !fvForm.potencia_inversores_kw) return 'Ingresa número y potencia de inversores.'
    if (!fvForm.marca_inversores.trim()) return 'Ingresa la marca de los inversores.'
    if (!fvForm.generacion_anual_kwh) return 'Ingresa la generación anual estimada.'
    if (!fvForm.capex) return 'Ingresa el CAPEX del sistema FV.'
    return ''
  }""",
"""  function validarFvForm(): string {
    if (!fvForm.num_modulos || !fvForm.potencia_modulos_w) return 'Ingresa número y potencia de módulos.'
    if (!fvForm.marca_modulos.trim()) return 'Ingresa la marca de los módulos.'
    
    const siteProducts = addingToSitioId ? (productosMap[addingToSitioId] ?? []) : []
    const hasHybrid = siteProducts.some(p => p.tipo === 'bess' && p.bess?.inversores_hibridos)
    
    if (!hasHybrid) {
      if (!fvForm.num_inversores || !fvForm.potencia_inversores_kw) return 'Ingresa número y potencia de inversores.'
      if (!fvForm.marca_inversores.trim()) return 'Ingresa la marca de los inversores.'
    }
    
    if (!fvForm.generacion_anual_kwh) return 'Ingresa la generación anual estimada.'
    if (!fvForm.capex) return 'Ingresa el CAPEX del sistema FV.'
    return ''
  }"""
    ),
    (
"""  const fvCalc = calcFV(fvForm)
  const bessCalc = calcBESS(bessForm)
  const anyHighDemanda = sitiosSeleccionados.some(id => (sitiosCliente.find(s => s.id === id)?.demanda_contratada_kw ?? 0) > 1000)""",
"""  const fvCalc = calcFV(fvForm)
  const bessCalc = calcBESS(bessForm)
  const anyHighDemanda = sitiosSeleccionados.some(id => (sitiosCliente.find(s => s.id === id)?.demanda_contratada_kw ?? 0) > 1000)
  const isNodoBusca = form.tipo_instalacion === 'nodo_busca'"""
    ),
    (
"""      <StepIndicator steps={['Información básica', 'Sitios y productos', 'Financiamiento']} current={step} />""",
"""      <StepIndicator steps={isNodoBusca ? ['Información básica', 'Sitios'] : ['Información básica', 'Sitios y productos', 'Financiamiento']} current={step} />"""
    ),
    (
"""            {/* Configurations Tab Bar */}""",
"""            {/* Configurations Tab Bar */}
            {!isNodoBusca && ("""
    ),
    (
"""            {/* Active Configuration Details Form */}""",
"""            )}
            
            {/* Active Configuration Details Form */}
            {!isNodoBusca && ("""
    ),
    (
"""  const activeConfigCapex = activeConfigProducts.reduce((sum, p) => {
    const pCapex = p.tipo === 'fv' ? parseNum(p.fv?.capex) : parseNum(p.bess?.capex)
    return sum + pCapex
  }, 0)""",
"""  const activeConfigCapex = activeConfigProducts.reduce((sum, p) => {
    const pCapex = p.tipo === 'fv' ? parseNum(p.fv?.capex) : parseNum(p.bess?.capex)
    return sum + pCapex
  }, 0)
  
  const activeProductCurrencies = activeConfigProducts.map(p => p.tipo === 'fv' ? p.fv?.capex_moneda : p.bess?.capex_moneda).filter(Boolean)
  const activeConfigMoneda = activeProductCurrencies.length > 0 ? activeProductCurrencies[0] : form.moneda"""
    ),
    (
"""                <span className="font-bold text-sm text-principal">
                  ${activeConfigCapex.toLocaleString('es-MX')} {form.moneda}
                </span>
              </div>
            </div>""",
"""                <span className="font-bold text-sm text-principal">
                  ${activeConfigCapex.toLocaleString('es-MX')} {activeConfigMoneda}
                </span>
              </div>
              <div className='text-xs text-muted flex justify-between items-center mt-1 pt-2 border-t border-borde'>
                <span>Ahorro bruto estimado mensual:</span>
                <div className='flex gap-2 items-center'>
                  <input type='text' value={activeConfig.ahorro_estimado_mensual} onChange={e => {
                    setConfigs(prev => prev.map(c => c.tempId === activeConfigId ? { ...c, ahorro_estimado_mensual: formatNumberInput(e.target.value) } : c))
                  }} className={inp} style={{ width: '140px' }} placeholder='0' />
                  <select value={activeConfig.ahorro_moneda} onChange={e => {
                    setConfigs(prev => prev.map(c => c.tempId === activeConfigId ? { ...c, ahorro_moneda: e.target.value as Moneda } : c))
                  }} className={inp} style={{ width: '90px' }}>
                    <option value='MXN'>MXN</option>
                    <option value='USD'>USD</option>
                  </select>
                </div>
              </div>
            </div>
            )}"""
    ),
    (
"""                      {/* Productos — solo cuando el sitio está seleccionado */}
                      {selected && (""",
"""                      {/* Productos — solo cuando el sitio está seleccionado */}
                      {selected && !isNodoBusca && ("""
    ),
    (
"""          <div className="flex items-center gap-1.5 font-bold text-sm mb-2">
            <Zap size={13} className="text-muted" />
            Fotovoltaico
          </div>""",
"""          <div className="flex items-center gap-1.5 font-bold text-sm mb-2">
            <Zap size={13} className="text-muted" />
            Fotovoltaico
          </div>"""
    ),
    (
"""        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 font-bold text-sm mb-2">
            <Battery size={13} className="text-muted" />
            BESS
          </div>""",
"""        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 font-bold text-sm mb-2">
            <Battery size={13} className="text-muted" />
            BESS
            {p.bess.inversores_hibridos && <span className='text-[10px] font-bold uppercase bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full ml-2'>Híbrido</span>}
          </div>"""
    ),
    (
"""          <span><span className="text-muted">Inversores: </span>{p.fv.num_inversores} × {p.fv.potencia_inversores_kw} kW · {p.fv.marca_inversores}</span>
          <span><span className="text-muted">kWp inversores: </span>{n2(kwpInversores, 1)} kW</span>""",
"""          {(!p.fv.num_inversores || p.fv.num_inversores === '0') ? (
            <span className="col-span-2"><span className="text-muted">Inversores: </span>Cubiertos por BESS híbrido</span>
          ) : (
            <>
              <span><span className="text-muted">Inversores: </span>{p.fv.num_inversores} × {p.fv.potencia_inversores_kw} kW · {p.fv.marca_inversores}</span>
              <span><span className="text-muted">kWp inversores: </span>{n2(kwpInversores, 1)} kW</span>
            </>
          )}"""
    ),
    (
"""                                    <p className="text-xs font-semibold uppercase tracking-wide mt-1 text-muted">Inversores</p>""",
"""                                    <p className="text-xs font-semibold uppercase tracking-wide mt-1 text-muted">Inversores</p>
                                    {addingToSitioId && (productosMap[addingToSitioId] ?? []).some(p => p.tipo === 'bess' && p.bess?.inversores_hibridos) && (
                                      <div className='text-xs text-blue-600 bg-blue-50 p-2 rounded-lg mb-2'>Los inversores del BESS híbrido cubren este producto FV. Los campos de inversores son opcionales.</div>
                                    )}"""
    ),
    (
"""  function validarPaso1() {
    const nombres = configs.map(c => c.nombre.trim())
    if (new Set(nombres).size !== nombres.length) {
      return 'Cada configuración debe tener un nombre único.'
    }
    for (let i = 0; i < configs.length; i++) {
      const err = validarConfig(configs[i], i)
      if (err) return err
    }
    return ''
  }""",
"""  function validarPaso1NodoBusca() {
    if (configs[0].sitiosSeleccionados.length === 0) {
      return 'Selecciona al menos un sitio.'
    }
    return ''
  }

  function validarPaso1() {
    if (form.tipo_instalacion === 'nodo_busca') return validarPaso1NodoBusca()
    
    const nombres = configs.map(c => c.nombre.trim())
    if (new Set(nombres).size !== nombres.length) {
      return 'Cada configuración debe tener un nombre único.'
    }
    for (let i = 0; i < configs.length; i++) {
      const err = validarConfig(configs[i], i)
      if (err) return err
    }
    return ''
  }"""
    ),
    (
"""  function handleNext() {
    setError('')
    const err = step === 0 ? validarPaso0() : step === 1 ? validarPaso1() : ''
    if (err) { setError(err); return }
    setStep(s => s + 1)
  }""",
"""  function handleNext() {
    setError('')
    const err = step === 0 ? validarPaso0() : step === 1 ? validarPaso1() : ''
    if (err) { setError(err); return }
    
    if (step === 1 && form.tipo_instalacion === 'nodo_busca') {
      handleSubmit()
      return
    }
    setStep(s => s + 1)
  }"""
    ),
    (
"""    const tipo = hasFV && hasBESS ? 'FV+BESS' : hasFV ? 'FV' : 'BESS'

    const primerSitioId = configs[0].sitiosSeleccionados[0]
    const ubicacion_estado = sitiosCliente.find(s => s.id === primerSitioId)?.ubicacion_estado ?? ''

    const firstConfigProducts = Object.values(configs[0].productosMap).flat()
    const firstConfigCapex = firstConfigProducts.reduce((sum, p) => {
      const pCapex = p.tipo === 'fv' ? parseNum(p.fv?.capex) : parseNum(p.bess?.capex)
      return sum + pCapex
    }, 0)""",
"""    const isNodoBusca = form.tipo_instalacion === 'nodo_busca'
    const tipo = isNodoBusca ? 'FV' : (hasFV && hasBESS ? 'FV+BESS' : hasFV ? 'FV' : 'BESS')

    const primerSitioId = configs[0].sitiosSeleccionados[0]
    const ubicacion_estado = sitiosCliente.find(s => s.id === primerSitioId)?.ubicacion_estado ?? ''

    const firstConfigProducts = Object.values(configs[0].productosMap).flat()
    const firstConfigCapex = firstConfigProducts.reduce((sum, p) => {
      const pCapex = p.tipo === 'fv' ? parseNum(p.fv?.capex) : parseNum(p.bess?.capex)
      return sum + pCapex
    }, 0)
    
    const productCurrencies = firstConfigProducts.map(p => p.tipo === 'fv' ? p.fv?.capex_moneda : p.bess?.capex_moneda).filter(Boolean)
    const configMoneda = isNodoBusca ? form.moneda : (productCurrencies.length > 0 ? productCurrencies[0] : form.moneda)
    """
    ),
    (
"""      capex_estimado: firstConfigCapex,
      moneda: form.moneda,""",
"""      capex_estimado: isNodoBusca ? null : firstConfigCapex,
      moneda: isNodoBusca ? form.moneda : configMoneda,"""
    ),
    (
"""    const configsToInsert = configs.map((c, idx) => {
      const activeConfigProducts = Object.values(c.productosMap).flat()
      const inversion_total = activeConfigProducts.reduce((sum, p) => {
        const pCapex = p.tipo === 'fv' ? parseNum(p.fv?.capex) : parseNum(p.bess?.capex)
        return sum + pCapex
      }, 0)

      return {
        proyecto_id: proyecto.id,
        nombre: c.nombre,
        descripcion: c.descripcion || null,
        inversion_total,
        moneda: form.moneda,
        seleccionada: idx === 0,
      }
    })""",
"""    const configsToInsert = isNodoBusca ? [{
      proyecto_id: proyecto.id,
      nombre: 'Pendiente definición',
      descripcion: null,
      inversion_total: null,
      moneda: form.moneda,
      seleccionada: true,
    }] : configs.map((c, idx) => {
      const activeConfigProducts = Object.values(c.productosMap).flat()
      const inversion_total = activeConfigProducts.reduce((sum, p) => {
        const pCapex = p.tipo === 'fv' ? parseNum(p.fv?.capex) : parseNum(p.bess?.capex)
        return sum + pCapex
      }, 0)
      
      const configProductCurrencies = activeConfigProducts.map(p => p.tipo === 'fv' ? p.fv?.capex_moneda : p.bess?.capex_moneda).filter(Boolean)
      const thisConfigMoneda = configProductCurrencies.length > 0 ? configProductCurrencies[0] : form.moneda

      return {
        proyecto_id: proyecto.id,
        nombre: c.nombre,
        descripcion: c.descripcion || null,
        inversion_total,
        moneda: thisConfigMoneda,
        ahorro_estimado_mensual: c.ahorro_estimado_mensual ? parseNum(c.ahorro_estimado_mensual) : null,
        seleccionada: idx === 0,
      }
    })"""
    ),
    (
"""    const optionsToInsert = isRecomendacionNodo 
      ? [{
          proyecto_id: proyecto.id,
          nombre: 'Recomendación de Nodo',
          vehiculo_inversion: 'no_sabe',
          ahorro_estimado_mensual: null,
          moneda: 'MXN',
          plazo_meses: null,
          notas: null,
          seleccionada: true
        }]
      : financingOptions.map((o, idx) => ({
          proyecto_id: proyecto.id,
          nombre: o.nombre,
          vehiculo_inversion: o.vehiculo_inversion,
          ahorro_estimado_mensual: o.ahorro_estimado_mensual ? parseNum(o.ahorro_estimado_mensual) : null,
          moneda: o.ahorro_moneda || 'MXN',
          plazo_meses: o.plazo_meses ? parseNum(o.plazo_meses) : null,
          notas: o.notas || null,
          seleccionada: idx === 0
        }))""",
"""    const optionsToInsert = isNodoBusca || isRecomendacionNodo 
      ? [{
          proyecto_id: proyecto.id,
          nombre: 'Recomendación de Nodo',
          vehiculo_inversion: 'no_sabe',
          ahorro_estimado_mensual: null,
          moneda: 'MXN',
          plazo_meses: null,
          notas: null,
          seleccionada: true
        }]
      : financingOptions.map((o, idx) => ({
          proyecto_id: proyecto.id,
          nombre: o.nombre,
          vehiculo_inversion: o.vehiculo_inversion,
          ahorro_estimado_mensual: o.ahorro_estimado_mensual ? parseNum(o.ahorro_estimado_mensual) : null,
          moneda: o.ahorro_moneda || 'MXN',
          plazo_meses: o.plazo_meses ? parseNum(o.plazo_meses) : null,
          notas: o.notas || null,
          seleccionada: idx === 0
        }))"""
    ),
    (
"""    if (isRecomendacionNodo) {""",
"""    if (isNodoBusca || isRecomendacionNodo) {"""
    ),
    (
"""    const productosRows: {
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
    }""",
"""    if (!isNodoBusca) {
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
    }"""
    ),
    (
"""          <div className="flex justify-between mt-8">
            <button type="button" onClick={() => setStep(0)}
              className="px-6 py-2.5 rounded-xl border border-borde font-semibold text-sm hover:bg-gray-50 transition-colors">
              Atrás
            </button>
            <button type="button" onClick={handleNext}
              className="px-6 py-2.5 rounded-xl font-bold text-sm bg-principal text-acento hover:bg-black transition-colors">
              Siguiente paso
            </button>
          </div>
        )}

        {/* ══ PASO 2 — Financiamiento ══════════════════════ */}
        {step === 2 && (""",
"""          <div className="flex justify-between mt-8">
            <button type="button" onClick={() => setStep(0)}
              className="px-6 py-2.5 rounded-xl border border-borde font-semibold text-sm hover:bg-gray-50 transition-colors">
              Atrás
            </button>
            <button type="button" onClick={handleNext} disabled={loading}
              className="px-6 py-2.5 rounded-xl font-bold text-sm bg-principal text-acento hover:bg-black transition-colors disabled:opacity-50">
              {isNodoBusca ? (loading ? 'Enviando...' : 'Enviar proyecto') : 'Siguiente paso'}
            </button>
          </div>
        )}

        {/* ══ PASO 2 — Financiamiento ══════════════════════ */}
        {step === 2 && !isNodoBusca && ("""
    )
]

# Rename 'Ahorro mensual estimado' to 'Ahorro neto mensual (post-financiamiento)'
replacements.append((
"""<label className="block text-xs font-medium mb-1">Ahorro mensual estimado</label>""",
"""<label className="block text-xs font-medium mb-1">Ahorro neto mensual (post-financiamiento)</label>"""
))

for old, new in replacements:
    if old in content:
        content = content.replace(old, new)
    else:
        print(f"Warning: Could not find block:\n{old}\n")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Done")
