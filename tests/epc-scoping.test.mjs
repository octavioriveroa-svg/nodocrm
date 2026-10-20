import {
  TestSuite,
  assert,
  assertEqual,
  getAuthSession,
  getServiceRoleClient,
} from './test-utils.mjs'

import { fetchClienteDetalleCompleto } from '../lib/domains/clientes/queries.ts'

export const epcScopingSuite = new TestSuite('Security: EPC Client Detail Document & Project Scoping')

// ── 1. Query Scoping by Role (Mock / Structural Verification) ────────────────
epcScopingSuite.test('Scoping.1: fetchClienteDetalleCompleto strictly scopes projects by cliente_id and viewer role', async () => {
  const capturedFilters = []

  // Create a mock Supabase client that logs query filters
  const createMockClient = (proyectosData = []) => ({
    from: (table) => {
      const state = { table, filters: [] }
      const chain = {
        select: () => chain,
        eq: (col, val) => {
          state.filters.push({ op: 'eq', col, val })
          return chain
        },
        in: (col, vals) => {
          state.filters.push({ op: 'in', col, vals })
          return chain
        },
        order: () => chain,
        single: async () => {
          if (state.table === 'clientes') {
            return { data: { id: 'cliente-101', razon_social: 'Acme Solar', epcista_id: 'epc-user-1' }, error: null }
          }
          if (state.table === 'profiles') {
            return { data: { id: 'epc-user-1', nombre: 'EPC Installer', empresa: 'EPC Corp' }, error: null }
          }
          return { data: null, error: null }
        },
        then: (resolve) => {
          capturedFilters.push(state)
          if (state.table === 'proyectos') {
            resolve({ data: proyectosData })
          } else if (state.table === 'archivos') {
            resolve({ data: [] })
          } else {
            resolve({ data: [] })
          }
        },
      }
      return chain
    },
  })

  // 1.1 EPC Viewer
  capturedFilters.length = 0
  const mockEpcClient = createMockClient([{ id: 'p1', nombre_proyecto: 'Proj 1', estado: 'recibido' }])
  const epcViewer = { id: 'epc-user-1', rol: 'epc', nombre: 'EPC User' }

  await fetchClienteDetalleCompleto(mockEpcClient, 'cliente-101', epcViewer)

  const epcProjQuery = capturedFilters.find((q) => q.table === 'proyectos')
  assert(epcProjQuery, 'Must query proyectos table')
  const clientFilter = epcProjQuery.filters.find((f) => f.col === 'cliente_id')
  const epcFilter = epcProjQuery.filters.find((f) => f.col === 'epcista_id')

  assert(clientFilter && clientFilter.val === 'cliente-101', 'Must strictly filter by .eq("cliente_id", "cliente-101")')
  assert(epcFilter && epcFilter.val === 'epc-user-1', 'EPC viewer must strictly filter by .eq("epcista_id", "epc-user-1")')

  // 1.2 Finder Viewer
  capturedFilters.length = 0
  const mockFinderClient = createMockClient([{ id: 'p2', nombre_proyecto: 'Proj 2', estado: 'recibido' }])
  const finderViewer = { id: 'finder-user-1', rol: 'finder', nombre: 'Finder User' }

  await fetchClienteDetalleCompleto(mockFinderClient, 'cliente-101', finderViewer)

  const finderProjQuery = capturedFilters.find((q) => q.table === 'proyectos')
  const finderFilter = finderProjQuery.filters.find((f) => f.col === 'finder_id')
  assert(finderFilter && finderFilter.val === 'finder-user-1', 'Finder viewer must strictly filter by .eq("finder_id", "finder-user-1")')

  // 1.3 Admin Viewer (unrestricted EPC/Finder scoping, but strictly scoped to client_id)
  capturedFilters.length = 0
  const mockAdminClient = createMockClient([{ id: 'p3', nombre_proyecto: 'Proj 3', estado: 'recibido' }])
  const adminViewer = { id: 'admin-user-1', rol: 'nodo_admin', nombre: 'Admin User' }

  await fetchClienteDetalleCompleto(mockAdminClient, 'cliente-101', adminViewer)

  const adminProjQuery = capturedFilters.find((q) => q.table === 'proyectos')
  const adminClientFilter = adminProjQuery.filters.find((f) => f.col === 'cliente_id')
  const adminEpcFilter = adminProjQuery.filters.find((f) => f.col === 'epcista_id')
  assert(adminClientFilter && adminClientFilter.val === 'cliente-101', 'Admin must scope to cliente_id')
  assert(!adminEpcFilter, 'Admin must not restrict by epcista_id')
})

// ── 2. Cross-Client Document Leak Prevention ──────────────────────────────────
epcScopingSuite.test('Scoping.2: Documents are strictly scoped to matching projects, preventing cross-client leak', async () => {
  let archivosFilter = null

  const mockDb = {
    from: (table) => {
      const state = { table, filters: [] }
      const chain = {
        select: () => chain,
        eq: (col, val) => {
          state.filters.push({ col, val })
          return chain
        },
        in: (col, vals) => {
          state.filters.push({ col, vals })
          archivosFilter = { col, vals }
          return chain
        },
        order: () => chain,
        single: async () => ({
          data: { id: 'cliente-alpha', razon_social: 'Alpha Industries' },
          error: null,
        }),
        then: (resolve) => {
          if (table === 'proyectos') {
            // Client Alpha only has Project Alpha-1 (Client Beta has Project Beta-2)
            resolve({ data: [{ id: 'proj-alpha-1', nombre_proyecto: 'Solar Alpha', estado: 'en_analisis' }] })
          } else if (table === 'archivos') {
            resolve({
              data: [
                {
                  id: 'file-1',
                  nombre: 'CFE_Receipt_Alpha.pdf',
                  proyecto_id: 'proj-alpha-1',
                  profiles: { nombre: 'Uploader' },
                },
              ],
            })
          } else {
            resolve({ data: [] })
          }
        },
      }
      return chain
    },
  }

  const epcProfile = { id: 'epc-user-1', rol: 'epc', nombre: 'EPC' }
  const result = await fetchClienteDetalleCompleto(mockDb, 'cliente-alpha', epcProfile)

  assert(archivosFilter, 'Archivos query must be executed for client with projects')
  assertEqual(archivosFilter.col, 'proyecto_id', 'Must filter archivos by proyecto_id')
  assertEqual(archivosFilter.vals.length, 1, 'Only projects of target client must be queried')
  assertEqual(archivosFilter.vals[0], 'proj-alpha-1', 'Project Beta-2 must never be included')

  assertEqual(result.archivos.length, 1, 'Must return only Client Alpha files')
  assertEqual(result.archivos[0].proyecto_nombre, 'Solar Alpha')

  // 2.2 Client with 0 projects: archivos must be empty array without executing query
  let archivosExecutedWhenZeroProjects = false
  const emptyDb = {
    from: (table) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () => {
          archivosExecutedWhenZeroProjects = true
          return chain
        },
        order: () => chain,
        single: async () => ({ data: { id: 'cliente-empty', razon_social: 'Empty' }, error: null }),
        then: (resolve) => {
          if (table === 'proyectos') resolve({ data: [] })
          else resolve({ data: [] })
        },
      }
      return chain
    },
  }

  const resultEmpty = await fetchClienteDetalleCompleto(emptyDb, 'cliente-empty', epcProfile)
  assertEqual(resultEmpty.proyectos.length, 0)
  assertEqual(resultEmpty.archivos.length, 0)
  assert(!archivosExecutedWhenZeroProjects, 'Archivos query must not execute when 0 projects belong to client')
})

// ── 3. Live Read-Only Verification Against Supabase ───────────────────────────
epcScopingSuite.test('Scoping.3: Live Supabase read queries verify strict scoping across real production accounts', async () => {
  const serviceClient = getServiceRoleClient()

  // Find a real client and project from the database
  const { data: realClientes, error: clientErr } = await serviceClient
    .from('clientes')
    .select('id, razon_social, epcista_id')
    .limit(5)

  assert(!clientErr, `Failed to query clientes: ${clientErr?.message}`)
  assert(realClientes && realClientes.length > 0, 'Must have at least one real client')

  const targetClient = realClientes[0]

  // Query as admin
  const adminAuth = await getAuthSession('admin')
  const adminProfile = { id: adminAuth.user.id, rol: 'nodo_admin', nombre: 'Octavio' }

  const adminResult = await fetchClienteDetalleCompleto(serviceClient, targetClient.id, adminProfile)
  assert(adminResult, 'adminResult must not be null')
  assertEqual(adminResult.cliente.id, targetClient.id)

  for (const proj of adminResult.proyectos) {
    const { data: dbProj } = await serviceClient
      .from('proyectos')
      .select('cliente_id')
      .eq('id', proj.id)
      .single()
    assertEqual(
      dbProj?.cliente_id,
      targetClient.id,
      `Project ${proj.id} in client detail must belong to client ${targetClient.id}`
    )
  }

  for (const arch of adminResult.archivos) {
    const allowedProjectIds = adminResult.proyectos.map((p) => p.id)
    assert(
      allowedProjectIds.includes(arch.proyecto_id),
      `Document ${arch.id} (proyecto_id: ${arch.proyecto_id}) must belong to one of target client's projects`
    )
  }

  // Query as EPC
  const epcAuth = await getAuthSession('epc')
  const epcProfile = { id: epcAuth.user.id, rol: 'epc', nombre: 'EPC Tester' }

  const epcResult = await fetchClienteDetalleCompleto(serviceClient, targetClient.id, epcProfile)
  assert(epcResult, 'epcResult must not be null')

  // If projects returned for this EPC, verify each project is assigned to this EPC
  for (const proj of epcResult.proyectos) {
    const { data: dbProj } = await serviceClient
      .from('proyectos')
      .select('cliente_id, epcista_id')
      .eq('id', proj.id)
      .single()
    assertEqual(dbProj?.cliente_id, targetClient.id, 'Project must belong to target client')
    assertEqual(dbProj?.epcista_id, epcAuth.user.id, 'EPC must only see projects assigned to them')
  }
})

if (process.argv[1] && process.argv[1].endsWith('epc-scoping.test.mjs')) {
  epcScopingSuite.run().catch((err) => {
    console.error('Test suite failed:', err)
    process.exit(1)
  })
}
