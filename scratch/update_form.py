import re
import sys

file_path = r"c:\Users\vmont\projects\Nodo\nodocrm\app\(portals)\admin\proyectos\nuevo\page.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update BESSForm interface
content = content.replace(
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
}""")

# 2. Update emptyBess
content = content.replace(
"const emptyBess: BESSForm = { potencia_kw: '', capacidad_kwh: '', marca: '', uso: '', capex: '', capex_moneda: 'USD' }",
"const emptyBess: BESSForm = { potencia_kw: '', capacidad_kwh: '', marca: '', uso: '', capex: '', capex_moneda: 'USD', inversores_hibridos: false }"
)

# 3. Update CreationConfig interface
content = content.replace(
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
)

# 4. Update initial configs state
content = content.replace(
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
)

# Also the one when clearing client
content = content.replace(
"setConfigs([{ tempId: 'default', nombre: 'Configuración A', descripcion: '', sitiosSeleccionados: [], productosMap: {} }])",
"setConfigs([{ tempId: 'default', nombre: 'Configuración A', descripcion: '', sitiosSeleccionados: [], productosMap: {}, ahorro_estimado_mensual: '', ahorro_moneda: 'MXN' }])"
)
content = content.replace(
"""setConfigs([{ tempId: 'default', nombre: 'Configuración A', descripcion: '', sitiosSeleccionados: [], productosMap: {}, ahorro_estimado_mensual: '', ahorro_moneda: 'MXN' }])""",
"""setConfigs([{ tempId: 'default', nombre: 'Configuración A', descripcion: '', sitiosSeleccionados: [], productosMap: {}, ahorro_estimado_mensual: '', ahorro_moneda: 'MXN' }])""" # this might match multiple times, should be fine. Wait, let's use re.sub for safety, but replace is simpler.
)

content = re.sub(r"setConfigs\(\[\{\s*tempId:\s*'default',\s*nombre:\s*'Configuración A',\s*descripcion:\s*'',\s*sitiosSeleccionados:\s*\[\],\s*productosMap:\s*\{\}\s*\}\]\)", "setConfigs([{ tempId: 'default', nombre: 'Configuración A', descripcion: '', sitiosSeleccionados: [], productosMap: {}, ahorro_estimado_mensual: '', ahorro_moneda: 'MXN' }])", content)

# active config adding alternative
content = content.replace(
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
)

# 5. BESS Form Checkbox
bess_checkbox_code = """
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
                                    <div className="flex items-center gap-2 mt-1">
                                      <input type="checkbox" id="inv_hib" checked={bessForm.inversores_hibridos} 
                                        onChange={e => setBessForm(f => ({...f, inversores_hibridos: e.target.checked}))} 
                                        className="w-4 h-4 rounded border-gray-300 text-principal focus:ring-principal" />
                                      <label htmlFor="inv_hib" className="text-xs font-medium cursor-pointer">Inversores híbridos (también manejan FV)</label>
                                    </div>"""

content = content.replace("""
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
                                    </div>""", bess_checkbox_code)

# 6. FV Validar form
content = content.replace("""  function validarFvForm(): string {
    if (!fvForm.num_modulos || !fvForm.potencia_modulos_w) return 'Ingresa número y potencia de módulos.'
    if (!fvForm.marca_modulos.trim()) return 'Ingresa la marca de los módulos.'
    if (!fvForm.num_inversores || !fvForm.potencia_inversores_kw) return 'Ingresa número y potencia de inversores.'
    if (!fvForm.marca_inversores.trim()) return 'Ingresa la marca de los inversores.'
    if (!fvForm.generacion_anual_kwh) return 'Ingresa la generación anual estimada.'
    if (!fvForm.capex) return 'Ingresa el CAPEX del sistema FV.'
    return ''
  }""", """  function validarFvForm(): string {
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
  }""")

# 7. isNodoBusca flag and Navigation
content = content.replace("""  const fvCalc = calcFV(fvForm)
  const bessCalc = calcBESS(bessForm)""", """  const fvCalc = calcFV(fvForm)
  const bessCalc = calcBESS(bessForm)
  const isNodoBusca = form.tipo_instalacion === 'nodo_busca'""")

content = content.replace("""      <StepIndicator steps={['Información básica', 'Sitios y productos', 'Financiamiento']} current={step} />""", """      <StepIndicator steps={isNodoBusca ? ['Información básica', 'Sitios'] : ['Información básica', 'Sitios y productos', 'Financiamiento']} current={step} />""")

# 8. Hide configs tab bar, details and products
content = content.replace("""            {/* Configurations Tab Bar */}""", """            {/* Configurations Tab Bar */}
            {!isNodoBusca && (""")

content = content.replace("""            {/* Active Configuration Details Form */}""", """            )}
            
            {/* Active Configuration Details Form */}
            {!isNodoBusca && (""")

# add savings input in config details
config_savings = """              <div className='text-xs text-muted flex justify-between items-center mt-1 pt-2 border-t border-borde'>
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

# Replace the end of config details form to include the savings input
# First, update the activeConfigCurrency derivation
content = content.replace("""  const activeConfigCapex = activeConfigProducts.reduce((sum, p) => {
    const pCapex = p.tipo === 'fv' ? parseNum(p.fv?.capex) : parseNum(p.bess?.capex)
    return sum + pCapex
  }, 0)""", """  const activeConfigCapex = activeConfigProducts.reduce((sum, p) => {
    const pCapex = p.tipo === 'fv' ? parseNum(p.fv?.capex) : parseNum(p.bess?.capex)
    return sum + pCapex
  }, 0)
  
  const activeProductCurrencies = activeConfigProducts.map(p => p.tipo === 'fv' ? p.fv?.capex_moneda : p.bess?.capex_moneda).filter(Boolean)
  const activeConfigMoneda = activeProductCurrencies.length > 0 ? activeProductCurrencies[0] : form.moneda""")

content = content.replace("""                <span className="font-bold text-sm text-principal">
                  ${activeConfigCapex.toLocaleString('es-MX')} {form.moneda}
                </span>
              </div>
            </div>""", """                <span className="font-bold text-sm text-principal">
                  ${activeConfigCapex.toLocaleString('es-MX')} {activeConfigMoneda}
                </span>
              </div>""" + config_savings)

# Hide products if nodo_busca
content = content.replace("""                      {/* Productos — solo cuando el sitio está seleccionado */}
                      {selected && (""", """                      {/* Productos — solo cuando el sitio está seleccionado */}
                      {selected && !isNodoBusca && (""")

# Nav buttons in paso 1
content = re.sub(r"\{\/\* ══ PASO 2 — Financiamiento ══════════════════════ \*\/\}.*", "", content, flags=re.DOTALL)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

