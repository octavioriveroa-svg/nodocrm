import {
  TestSuite,
  assert,
  assertEqual,
  assertIncludes,
  getAuthSession,
  setActiveSessionCookies,
  clearActiveSessionCookies,
} from './test-utils.mjs'

import {
  ROLE_TO_PORTAL_PREFIX,
  getPortalPrefix,
  getPortalPrefixForRole,
  isNodoRole,
  isAdminRole,
  isAnalystRole,
  isEpcRole,
  isFinderRole,
  isClienteRole,
  isFinancieroRole,
  canChangeProjectStage,
  canDeleteProject,
  canEditTechnicalSolution,
  canSelectWinningOption,
  canInviteRole,
  validateUserInvitationPermission,
  validateUserCreationPermission,
  VALID_USER_ROLES,
} from '../lib/domains/auth/permissions.ts'

export const domainAuthSuite = new TestSuite('Domain: Auth & Centralized RBAC')

// ── 1. Portal Prefix & Role Mapping ──────────────────────────────────────────
domainAuthSuite.test('Auth.1: Portal prefix mapping accurately resolves all 8 user roles', () => {
  const expectedMap = {
    nodo_admin: 'admin',
    nodo_analista: 'analista',
    epc: 'epc',
    finder: 'finder',
    cliente_final: 'cliente',
    financiero: 'financiero',
    suministrador: 'mem',
    pendiente: 'pendiente',
  }

  for (const [role, prefix] of Object.entries(expectedMap)) {
    assertEqual(
      ROLE_TO_PORTAL_PREFIX[role],
      prefix,
      `ROLE_TO_PORTAL_PREFIX for ${role} must equal "${prefix}"`
    )
    assertEqual(
      getPortalPrefix(role),
      prefix,
      `getPortalPrefix(${role}) must equal "${prefix}"`
    )
    assertEqual(
      getPortalPrefixForRole(role),
      prefix,
      `getPortalPrefixForRole(${role}) must equal "${prefix}"`
    )
  }

  assertEqual(getPortalPrefix(null), 'pendiente', 'Null role should default to pendiente')
  assertEqual(getPortalPrefix(undefined), 'pendiente', 'Undefined role should default to pendiente')
  assertEqual(getPortalPrefix('unknown_role'), 'pendiente', 'Unknown role should default to pendiente')
})

// ── 2. Role Classification Helpers ───────────────────────────────────────────
domainAuthSuite.test('Auth.2: Role classification helper predicates correctly classify roles', () => {
  assert(isNodoRole('nodo_admin'), 'nodo_admin must be Nodo role')
  assert(isNodoRole('nodo_analista'), 'nodo_analista must be Nodo role')
  assert(!isNodoRole('epc'), 'epc must not be Nodo role')
  assert(!isNodoRole('finder'), 'finder must not be Nodo role')
  assert(!isNodoRole('cliente_final'), 'cliente_final must not be Nodo role')
  assert(!isNodoRole('financiero'), 'financiero must not be Nodo role')
  assert(!isNodoRole(null), 'null must not be Nodo role')

  assert(isAdminRole('nodo_admin'), 'isAdminRole for nodo_admin')
  assert(!isAdminRole('nodo_analista'), 'isAdminRole for nodo_analista must be false')
  assert(isAnalystRole('nodo_analista'), 'isAnalystRole for nodo_analista')
  assert(!isAnalystRole('nodo_admin'), 'isAnalystRole for nodo_admin must be false')
  assert(isEpcRole('epc'), 'isEpcRole for epc')
  assert(isFinderRole('finder'), 'isFinderRole for finder')
  assert(isClienteRole('cliente_final'), 'isClienteRole for cliente_final')
  assert(isFinancieroRole('financiero'), 'isFinancieroRole for financiero')
})

// ── 3. Project Stage Changing Capabilities ───────────────────────────────────
domainAuthSuite.test('Auth.3: canChangeProjectStage permits only Nodo and EPC roles', () => {
  assert(canChangeProjectStage('nodo_admin'), 'nodo_admin can change stage')
  assert(canChangeProjectStage('nodo_analista'), 'nodo_analista can change stage')
  assert(canChangeProjectStage('epc'), 'epc can change stage')

  assert(!canChangeProjectStage('finder'), 'finder cannot change stage')
  assert(!canChangeProjectStage('cliente_final'), 'cliente_final cannot change stage')
  assert(!canChangeProjectStage('financiero'), 'financiero cannot change stage')
  assert(!canChangeProjectStage('suministrador'), 'suministrador cannot change stage')
  assert(!canChangeProjectStage('pendiente'), 'pendiente cannot change stage')
  assert(!canChangeProjectStage(null), 'null cannot change stage')
})

// ── 4. Project Deletion Scoping ──────────────────────────────────────────────
domainAuthSuite.test('Auth.4: canDeleteProject permits Admin globally and EPC only on own projects', () => {
  const adminUser = { id: 'admin-uuid-1', rol: 'nodo_admin' }
  const epcUser = { id: 'epc-uuid-1', rol: 'epc' }
  const otherEpcUser = { id: 'epc-uuid-2', rol: 'epc' }
  const analystUser = { id: 'analyst-uuid-1', rol: 'nodo_analista' }
  const finderUser = { id: 'finder-uuid-1', rol: 'finder' }

  const projectOwnedByEpc1 = { epcista_id: 'epc-uuid-1' }
  const projectOwnedByEpc2 = { epcista_id: 'epc-uuid-2' }
  const projectWithNoEpc = { epcista_id: null }

  // Admin can delete any project
  assert(canDeleteProject(adminUser, projectOwnedByEpc1), 'Admin can delete EPC1 project')
  assert(canDeleteProject(adminUser, projectOwnedByEpc2), 'Admin can delete EPC2 project')
  assert(canDeleteProject(adminUser, projectWithNoEpc), 'Admin can delete unassigned project')

  // EPC can only delete their own project
  assert(canDeleteProject(epcUser, projectOwnedByEpc1), 'EPC1 can delete own project')
  assert(!canDeleteProject(epcUser, projectOwnedByEpc2), 'EPC1 cannot delete EPC2 project')
  assert(!canDeleteProject(epcUser, projectWithNoEpc), 'EPC1 cannot delete project without EPC')

  // Other roles cannot delete projects
  assert(!canDeleteProject(analystUser, projectOwnedByEpc1), 'Analyst cannot delete projects')
  assert(!canDeleteProject(finderUser, projectOwnedByEpc1), 'Finder cannot delete projects')
  assert(!canDeleteProject(otherEpcUser, projectOwnedByEpc1), 'Other EPC cannot delete project')
})

// ── 5. Technical Solution & Winning Option Permissions ────────────────────────
domainAuthSuite.test('Auth.5: canEditTechnicalSolution and canSelectWinningOption enforce scoped ownership', () => {
  const adminUser = { id: 'admin-1', rol: 'nodo_admin' }
  const analystUser = { id: 'analyst-1', rol: 'nodo_analista' }
  const epcUser = { id: 'epc-1', rol: 'epc' }
  const finderUser = { id: 'finder-1', rol: 'finder' }

  const ownProject = { epcista_id: 'epc-1' }
  const otherProject = { epcista_id: 'epc-2' }

  // Admin & Analyst have full permissions
  assert(canEditTechnicalSolution(adminUser, ownProject), 'Admin can edit technical solution')
  assert(canEditTechnicalSolution(analystUser, otherProject), 'Analyst can edit technical solution')
  assert(canSelectWinningOption(adminUser, ownProject), 'Admin can select winning option')
  assert(canSelectWinningOption(analystUser, otherProject), 'Analyst can select winning option')

  // EPC scoped to own projects
  assert(canEditTechnicalSolution(epcUser, ownProject), 'EPC can edit technical solution on own project')
  assert(!canEditTechnicalSolution(epcUser, otherProject), 'EPC cannot edit technical solution on other project')
  assert(canSelectWinningOption(epcUser, ownProject), 'EPC can select winning option on own project')
  assert(!canSelectWinningOption(epcUser, otherProject), 'EPC cannot select winning option on other project')

  // Finder cannot edit technical solutions or select winning options
  assert(!canEditTechnicalSolution(finderUser, ownProject), 'Finder cannot edit technical solution')
  assert(!canSelectWinningOption(finderUser, ownProject), 'Finder cannot select winning option')
})

// ── 6. Invitation Permission Rules Across All Roles ───────────────────────────
domainAuthSuite.test('Auth.6: validateUserInvitationPermission and canInviteRole enforce RBAC matrix', () => {
  // Admin can invite all 7 roles
  for (const role of VALID_USER_ROLES) {
    const res = canInviteRole('nodo_admin', role)
    const resDirect = validateUserInvitationPermission('nodo_admin', role)
    assert(res.allowed && resDirect.allowed, `Admin must be allowed to invite ${role}`)
  }

  // Analyst can invite all except nodo_admin
  for (const role of VALID_USER_ROLES) {
    const res = canInviteRole('nodo_analista', role)
    if (role === 'nodo_admin') {
      assert(!res.allowed, 'Analyst must NOT be allowed to invite nodo_admin')
      assertEqual(
        res.error,
        'No autorizado: solo los administradores pueden invitar cuentas de administrador.'
      )
    } else {
      assert(res.allowed, `Analyst should be allowed to invite ${role}`)
    }
  }

  // EPC can invite only cliente_final and financiero
  for (const role of VALID_USER_ROLES) {
    const res = canInviteRole('epc', role)
    if (role === 'cliente_final' || role === 'financiero') {
      assert(res.allowed, `EPC must be allowed to invite ${role}`)
    } else {
      if (role === 'nodo_admin') {
        assert(!res.allowed, 'EPC cannot invite nodo_admin')
        assertEqual(res.error, 'No autorizado: solo los administradores pueden invitar cuentas de administrador.')
      } else {
        assert(!res.allowed, `EPC cannot invite ${role}`)
        assertEqual(res.error, 'No autorizado para invitar este tipo de usuario')
      }
    }
  }

  // Finder can invite only epc
  for (const role of VALID_USER_ROLES) {
    const res = canInviteRole('finder', role)
    if (role === 'epc') {
      assert(res.allowed, 'Finder must be allowed to invite epc')
    } else {
      if (role === 'nodo_admin') {
        assert(!res.allowed, 'Finder cannot invite nodo_admin')
        assertEqual(res.error, 'No autorizado: solo los administradores pueden invitar cuentas de administrador.')
      } else {
        assert(!res.allowed, `Finder cannot invite ${role}`)
        assertEqual(res.error, 'No autorizado para invitar este tipo de usuario')
      }
    }
  }

  // Cliente, Financiero, Suministrador, Pendiente cannot invite anyone
  const nonInvitingRoles = ['cliente_final', 'financiero', 'suministrador', 'pendiente']
  for (const actor of nonInvitingRoles) {
    const res = canInviteRole(actor, 'cliente_final')
    assert(!res.allowed, `${actor} cannot invite users`)
    assertEqual(res.error, 'No autorizado para enviar invitaciones')
  }
})

// ── 7. User Creation Permission Rules Across All Roles ────────────────────────
domainAuthSuite.test('Auth.7: validateUserCreationPermission enforces strict privilege escalation guards', () => {
  // Admin can create all valid roles
  for (const role of VALID_USER_ROLES) {
    const res = validateUserCreationPermission('nodo_admin', role)
    assert(res.allowed, `Admin must be allowed to create ${role}`)
  }

  // Analyst can create non-admin roles, but NEVER nodo_admin
  const analystAdminCheck = validateUserCreationPermission('nodo_analista', 'nodo_admin')
  assert(!analystAdminCheck.allowed, 'Analyst cannot create nodo_admin')
  assertEqual(
    analystAdminCheck.error,
    'No autorizado: solo los administradores pueden crear cuentas de administrador.'
  )

  const analystEpcCheck = validateUserCreationPermission('nodo_analista', 'epc')
  assert(analystEpcCheck.allowed, 'Analyst can create epc')

  // EPC can only create cliente_final and financiero
  const epcClientCheck = validateUserCreationPermission('epc', 'cliente_final')
  assert(epcClientCheck.allowed, 'EPC can create cliente_final')
  const epcFinCheck = validateUserCreationPermission('epc', 'financiero')
  assert(epcFinCheck.allowed, 'EPC can create financiero')

  const epcAdminCheck = validateUserCreationPermission('epc', 'nodo_admin')
  assert(!epcAdminCheck.allowed, 'EPC cannot create nodo_admin')
  assertEqual(epcAdminCheck.error, 'No autorizado: solo los administradores pueden crear cuentas de administrador.')

  const epcEpcCheck = validateUserCreationPermission('epc', 'epc')
  assert(!epcEpcCheck.allowed, 'EPC cannot create epc')
  assertEqual(epcEpcCheck.error, 'No autorizado para crear este tipo de usuario.')

  // Finder can only create epc
  const finderEpcCheck = validateUserCreationPermission('finder', 'epc')
  assert(finderEpcCheck.allowed, 'Finder can create epc')
  const finderClientCheck = validateUserCreationPermission('finder', 'cliente_final')
  assert(!finderClientCheck.allowed, 'Finder cannot create cliente_final')
  assertEqual(finderClientCheck.error, 'No autorizado para crear este tipo de usuario.')

  // Invalid role check
  const invalidRoleCheck = validateUserCreationPermission('nodo_admin', 'super_hacker')
  assert(!invalidRoleCheck.allowed, 'Invalid role must be rejected')
  assertEqual(invalidRoleCheck.error, 'Rol inválido: super_hacker')

  // Non-creator role check
  const clienteCheck = validateUserCreationPermission('cliente_final', 'cliente_final')
  assert(!clienteCheck.allowed, 'cliente_final cannot create users')
  assertEqual(clienteCheck.error, 'No autorizado para crear usuarios.')
})

// ── 8. Server Actions Error Parity with Live Auth Sessions ───────────────────
domainAuthSuite.test('Auth.8: Server actions (adminDeleteUser, crearUsuarioAdmin, invitarUsuario) preserve exact contracts', async () => {
  const { adminDeleteUser } = await import('../app/actions/adminDeleteUser.ts')
  const { crearUsuarioAdmin } = await import('../app/actions/crearUsuario.ts')
  const { invitarUsuario } = await import('../app/actions/invitar.ts')

  // 8.1 Unauthenticated calls
  clearActiveSessionCookies()
  const unauthDel = await adminDeleteUser('00000000-0000-0000-0000-000000000001')
  assertIncludes(unauthDel.error, 'No autenticado', 'Unauthenticated delete must return "No autenticado"')

  const unauthCreate = await crearUsuarioAdmin({
    email: 'test@unauth.com',
    nombre: 'Unauth',
    empresa: 'Test',
    rol: 'epc',
  })
  assertIncludes(unauthCreate.error, 'No autenticado', 'Unauthenticated create must return "No autenticado"')

  const unauthInvite = await invitarUsuario({
    email: 'test@unauth.com',
    nombre: 'Unauth',
    empresa: 'Test',
    rol: 'epc',
  })
  assertIncludes(
    ['No autenticado', 'No autorizado para enviar invitaciones'],
    unauthInvite.error,
    'Unauthenticated invite must be rejected'
  )

  // 8.2 Analyst caller: cannot delete user, cannot create admin, cannot invite admin
  const analystAuth = await getAuthSession('analista')
  setActiveSessionCookies(analystAuth.session)

  const analystDelete = await adminDeleteUser('00000000-0000-0000-0000-000000000001')
  assertEqual(
    analystDelete.error,
    'No autorizado. Solo administradores pueden eliminar cuentas.',
    'Analyst delete must return strict unauthorized error'
  )

  const analystCreateAdmin = await crearUsuarioAdmin({
    email: 'escalation_test@prueba.com',
    nombre: 'Escalation Test',
    empresa: 'Nodo',
    rol: 'nodo_admin',
    password: 'Password123!',
  })
  assertEqual(
    analystCreateAdmin.error,
    'No autorizado: solo los administradores pueden crear cuentas de administrador.',
    'Analyst creating admin must return privilege escalation error'
  )

  const analystInviteAdmin = await invitarUsuario({
    email: 'escalation_invite@prueba.com',
    nombre: 'Escalation Invite',
    empresa: 'Nodo',
    rol: 'nodo_admin',
  })
  assertEqual(
    analystInviteAdmin.error,
    'No autorizado: solo los administradores pueden invitar cuentas de administrador.',
    'Analyst inviting admin must return privilege escalation error'
  )

  // 8.3 Admin caller: self-deletion prevented & invalid target ID rejected
  const adminAuth = await getAuthSession('admin')
  setActiveSessionCookies(adminAuth.session)

  const adminSelfDel = await adminDeleteUser(adminAuth.user.id)
  assertEqual(
    adminSelfDel.error,
    'No puedes eliminar tu propia cuenta.',
    'Admin self-deletion must be blocked'
  )

  const adminEmptyId = await adminDeleteUser('')
  assertEqual(
    adminEmptyId.error,
    'ID de usuario inválido.',
    'Empty targetId must be rejected'
  )

  const adminNullId = await adminDeleteUser(null)
  assertEqual(
    adminNullId.error,
    'ID de usuario inválido.',
    'Null targetId must be rejected'
  )

  clearActiveSessionCookies()
})

if (process.argv[1] && process.argv[1].endsWith('domain-auth.test.mjs')) {
  domainAuthSuite.run().catch((err) => {
    console.error('Test suite failed:', err)
    process.exit(1)
  })
}
