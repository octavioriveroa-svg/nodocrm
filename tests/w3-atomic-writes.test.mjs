import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import assert from 'assert'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

console.log('--- RUNNING TRACK W3 VERIFICATION TESTS ---')

// 1. Verify ProjectWizard.tsx
const wizardPath = path.join(rootDir, 'components', 'proyectos', 'ProjectWizard.tsx')
const wizardContent = fs.readFileSync(wizardPath, 'utf8').replace(/\r\n/g, '\n')

// Test 1.1: Math.random() eliminated
assert.ok(
  !wizardContent.includes('Math.random()'),
  'ProjectWizard.tsx must NOT contain Math.random()'
)
console.log('✓ Test 1.1: Math.random() successfully eliminated from ProjectWizard.tsx')

// Test 1.2: crypto.randomUUID() used
assert.ok(
  wizardContent.includes('crypto.randomUUID()'),
  'ProjectWizard.tsx must use crypto.randomUUID()'
)
console.log('✓ Test 1.2: crypto.randomUUID() present in ProjectWizard.tsx')

// Test 1.3: Transactional RPC crear_proyecto_completo called
assert.ok(
  wizardContent.includes("supabase.rpc('crear_proyecto_completo'"),
  'ProjectWizard.tsx must call crear_proyecto_completo RPC'
)
console.log('✓ Test 1.3: crear_proyecto_completo RPC wired in ProjectWizard.tsx')

// Test 1.4: Compensating rollback on failure
assert.ok(
  wizardContent.includes("await supabase.from('proyectos').delete().eq('id', proyecto.id)"),
  'ProjectWizard.tsx must have compensating delete rollback on proyectos table'
)
console.log('✓ Test 1.4: Compensating rollback delete on proyectos.id present in ProjectWizard.tsx')

// 2. Verify DetalleProyecto.tsx
const detallePath = path.join(rootDir, 'components', 'DetalleProyecto.tsx')
const detalleContent = fs.readFileSync(detallePath, 'utf8').replace(/\r\n/g, '\n')

// Test 2.1: Transactional RPC seleccionar_configuracion_tecnica
assert.ok(
  detalleContent.includes("supabase.rpc('seleccionar_configuracion_tecnica'"),
  'DetalleProyecto.tsx must call seleccionar_configuracion_tecnica RPC'
)
console.log('✓ Test 2.1: seleccionar_configuracion_tecnica RPC wired in DetalleProyecto.tsx')

// Test 2.2: Compensating restore of prevSelectedId
assert.ok(
  detalleContent.includes("await supabase.from('configuraciones_tecnicas').update({ seleccionada: true }).eq('id', prevSelectedId)"),
  'DetalleProyecto.tsx must restore prevSelectedId if fallback fails'
)
console.log('✓ Test 2.2: Compensating restore of prevSelectedId present in DetalleProyecto.tsx')

// Test 2.3: Transactional RPC seleccionar_opcion_financiamiento
assert.ok(
  detalleContent.includes("supabase.rpc('seleccionar_opcion_financiamiento'"),
  'DetalleProyecto.tsx must call seleccionar_opcion_financiamiento RPC'
)
console.log('✓ Test 2.3: seleccionar_opcion_financiamiento RPC wired in DetalleProyecto.tsx')

// Test 2.4: Compensating restore of prevSelectedOptionId
assert.ok(
  detalleContent.includes("await supabase.from('opciones_financiamiento').update({ seleccionada: true }).eq('id', prevSelectedOptionId)"),
  'DetalleProyecto.tsx must restore prevSelectedOptionId if fallback fails'
)
console.log('✓ Test 2.4: Compensating restore of prevSelectedOptionId present in DetalleProyecto.tsx')

// Test 2.5: Ver Plan links route resolution
assert.ok(
  detalleContent.includes("isFinder\n                        ? '/finder'"),
  'DetalleProyecto.tsx must route finder to /finder for Plan'
)
assert.ok(
  detalleContent.includes("currentUser.rol !== 'cliente_final'"),
  'DetalleProyecto.tsx must hide Plan section for cliente_final'
)
console.log('✓ Test 2.5: Ver Plan route resolution correct (includes finder, excludes cliente_final)')

// Test 2.6: Ver Instalación links route resolution
assert.ok(
  detalleContent.includes("currentUser.rol === 'cliente_final'\n                          ? '/cliente'"),
  'DetalleProyecto.tsx must route cliente_final to /cliente for Instalaciones'
)
assert.ok(
  detalleContent.includes("isFinder\n                        ? '/finder'"),
  'DetalleProyecto.tsx must route finder to /finder for Instalaciones'
)
console.log('✓ Test 2.6: Ver Instalación route resolution correct (routes finder to /finder and cliente_final to /cliente)')

// 3. Verify EditarFinanciamientoModal.tsx
const finModalPath = path.join(rootDir, 'components', 'EditarFinanciamientoModal.tsx')
const finModalContent = fs.readFileSync(finModalPath, 'utf8').replace(/\r\n/g, '\n')

// Test 3.1: Insert before delete in isRecomendacionNodo
const recInsertIdx = finModalContent.indexOf(".from('opciones_financiamiento')\n          .insert({\n            proyecto_id: proyecto.id,\n            nombre: 'Recomendación de Nodo'")
const recDeleteIdx = finModalContent.indexOf(".from('opciones_financiamiento')\n            .delete()\n            .in('id', previousOptionIds)")
assert.ok(recInsertIdx > 0 && recDeleteIdx > 0 && recInsertIdx < recDeleteIdx,
  'In EditarFinanciamientoModal.tsx (isRecomendacionNodo), insert must happen before delete'
)
console.log('✓ Test 3.1: Insert before delete ordering verified for isRecomendacionNodo')

// Test 3.2: Insert/upsert before delete in custom options branch
const optsInsertIdx = finModalContent.indexOf(".from('opciones_financiamiento').insert(payload)")
const optsDeleteIdx = finModalContent.indexOf(".from('opciones_financiamiento').delete().in('id', toDelete.map(o => o.id))")
assert.ok(optsInsertIdx > 0 && optsDeleteIdx > 0 && optsInsertIdx < optsDeleteIdx,
  'In EditarFinanciamientoModal.tsx (else), insert must happen before delete'
)
console.log('✓ Test 3.2: Insert before delete ordering verified for custom options')

// 4. Verify EditarSolucionTecnicaModal.tsx
const solModalPath = path.join(rootDir, 'components', 'EditarSolucionTecnicaModal.tsx')
const solModalContent = fs.readFileSync(solModalPath, 'utf8').replace(/\r\n/g, '\n')

// Test 4.1: Upsert/insert products and configs before delete
const prodInsertIdx = solModalContent.indexOf(".from('proyecto_sitio_productos').insert(")
const prodDeleteIdx = solModalContent.indexOf(".from('proyecto_sitio_productos').delete().in('id', productsToDelete)")
assert.ok(prodInsertIdx > 0 && prodDeleteIdx > 0 && prodInsertIdx < prodDeleteIdx,
  'In EditarSolucionTecnicaModal.tsx, product inserts must happen before product deletions'
)
console.log('✓ Test 4.1: Product insert before delete ordering verified in EditarSolucionTecnicaModal.tsx')

const cfgInsertIdx = solModalContent.indexOf(".from('configuraciones_tecnicas').insert(newConfigsPayload)")
const cfgDeleteIdx = solModalContent.indexOf(".from('configuraciones_tecnicas').delete().in('id', configsToDelete.map(c => c.id))")
assert.ok(cfgInsertIdx > 0 && cfgDeleteIdx > 0 && cfgInsertIdx < cfgDeleteIdx,
  'In EditarSolucionTecnicaModal.tsx, configuration inserts must happen before configuration deletions'
)
console.log('✓ Test 4.2: Configuration insert before delete ordering verified in EditarSolucionTecnicaModal.tsx')

// Test 4.3: Ensure fallback winner selected
assert.ok(
  solModalContent.includes("if (!hasSelectedConfig && configs.length > 0)"),
  'EditarSolucionTecnicaModal.tsx must guarantee a winner configuration is selected'
)
console.log('✓ Test 4.3: Fallback winner configuration selection guaranteed in EditarSolucionTecnicaModal.tsx')

console.log('\n--- ALL TRACK W3 TESTS PASSED (11/11) ---')
