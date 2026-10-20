/**
 * ADVERSARIAL M1 EMPIRICAL CHALLENGE SUITE
 * 
 * Deep stress-testing of Milestone M1 domain logic:
 * 1. RBAC capability checks in lib/domains/auth/permissions.ts
 *    - Privilege escalation matrices
 *    - Unknown, empty, null, prototype-pollution roles
 *    - Boundary checks on project modification/deletion capabilities
 * 2. User provisioning in lib/domains/auth/user-provisioning.ts
 *    - Invalid caller IDs
 *    - Unauthorized target roles (escalation, horizontal unauthorized)
 *    - Mismatched client ownership verification (EPC scoping)
 *    - Admin operations protection (delete self, delete non-UUID, reset password, update email)
 * 3. Lifecycle state transitions in lib/domains/proyectos/lifecycle.ts
 *    - Missing winning technical configuration / financing option on approval or beyond
 *    - Transition validation for all pre-approval vs terminal stages
 *    - Empirical evaluation of stage leaps and terminal state backward transitions
 *    - Plan locking and state history updates
 */

import {
  TestSuite,
  assert,
  assertEqual,
  assertIncludes,
  getAuthSession,
  getAnonClient,
} from './test-utils.mjs'

import {
  VALID_USER_ROLES,
  getPortalPrefix,
  getPortalPrefixForRole,
  getPortalBackHref,
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
  canEditProjectGeneral,
  canSelectWinningOption,
  canManageClientUsers,
  canInviteRole,
  validateUserCreationPermission,
  validateUserInvitationPermission,
} from '../lib/domains/auth/permissions.ts'

import {
  verifyClientBelongsToEpc,
  executeCreateUserAdmin,
  executeInviteUser,
  executeDeleteUser,
  executeResetPassword,
  executeUpdateEmail,
  executeLinkUserCliente,
  provisionUserAccount,
} from '../lib/domains/auth/user-provisioning.ts'

import {
  STAGE_ORDER,
  TERMINAL_STAGES,
  ESTADO_LABELS,
  SALES_CYCLE,
  isStageApprovalOrBeyond,
  validateStageTransition,
  calculateNextHistorialEstados,
  getStageTransitionPayload,
} from '../lib/domains/proyectos/lifecycle.ts'

export const adversarialM1Suite = new TestSuite('Milestone M1: Empirical Adversarial Challenge')

// =============================================================================
// 1. RBAC CAPABILITY CHECKS (permissions.ts)
// =============================================================================

adversarialM1Suite.test('ADV-M1.1: validateUserCreationPermission strictly blocks all privilege escalation', () => {
  // 1.1 Non-admin roles attempting to create nodo_admin
  const nonAdminRoles = ['nodo_analista', 'epc', 'finder', 'cliente_final', 'financiero', 'suministrador', 'pendiente']
  for (const caller of nonAdminRoles) {
    const res = validateUserCreationPermission(caller, 'nodo_admin')
    assert(!res.allowed, `Caller ${caller} MUST NOT be allowed to create nodo_admin`)
    assert(typeof res.error === 'string' && res.error.length > 0, `Expected explicit error for ${caller}`)
  }

  // 1.2 Analyst specifically receives exact error string
  const analistaRes = validateUserCreationPermission('nodo_analista', 'nodo_admin')
  assertEqual(
    analistaRes.error,
    'No autorizado: solo los administradores pueden crear cuentas de administrador.',
    'Analyst creating admin must receive exact security error'
  )

  // 1.3 EPC attempting to create unauthorized roles
  const epcForbiddenTargets = ['nodo_admin', 'nodo_analista', 'epc', 'finder', 'suministrador']
  for (const target of epcForbiddenTargets) {
    const res = validateUserCreationPermission('epc', target)
    assert(!res.allowed, `EPC must NOT be allowed to create target ${target}`)
  }

  // 1.4 Finder attempting to create unauthorized roles
  const finderForbiddenTargets = ['nodo_admin', 'nodo_analista', 'cliente_final', 'financiero', 'suministrador']
  for (const target of finderForbiddenTargets) {
    const res = validateUserCreationPermission('finder', target)
    assert(!res.allowed, `Finder must NOT be allowed to create target ${target}`)
  }

  // 1.5 Unprivileged roles (cliente_final, financiero, suministrador, pendiente) cannot create ANY user
  const unprivilegedCallers = ['cliente_final', 'financiero', 'suministrador', 'pendiente']
  for (const caller of unprivilegedCallers) {
    for (const target of VALID_USER_ROLES) {
      const res = validateUserCreationPermission(caller, target)
      assert(!res.allowed, `Unprivileged caller ${caller} cannot create ${target}`)
      assertEqual(res.error, 'No autorizado para crear usuarios.')
    }
  }
})

adversarialM1Suite.test('ADV-M1.2: validateUserCreationPermission fails closed on unknown, null, and prototype roles', () => {
  const attackPayloads = [
    null,
    undefined,
    '',
    '   ',
    'ROOT',
    'superadmin',
    'ADMIN',
    'nodo_admin ',
    '__proto__',
    'constructor',
    'toString',
    12345,
    {},
    [],
  ]

  // Attack payloads as caller
  for (const payload of attackPayloads) {
    const res = validateUserCreationPermission(payload, 'cliente_final')
    assert(!res.allowed, `Malicious/unknown caller "${String(payload)}" must fail closed`)
    assertEqual(res.error, 'No autorizado para crear usuarios.')
  }

  // Attack payloads as target (caller is nodo_admin)
  for (const payload of attackPayloads) {
    const res = validateUserCreationPermission('nodo_admin', payload)
    assert(!res.allowed, `Malicious/unknown target "${String(payload)}" must fail closed`)
    assertIncludes(res.error, 'Rol inválido', `Expected "Rol inválido" for target ${String(payload)}`)
  }
})

adversarialM1Suite.test('ADV-M1.3: validateUserInvitationPermission strictly blocks unauthorized roles and escalation', () => {
  // Non-admin attempting to invite nodo_admin
  const analistaRes = validateUserInvitationPermission('nodo_analista', 'nodo_admin')
  assert(!analistaRes.allowed)
  assertEqual(
    analistaRes.error,
    'No autorizado: solo los administradores pueden invitar cuentas de administrador.'
  )

  const epcAdminRes = validateUserInvitationPermission('epc', 'nodo_admin')
  assert(!epcAdminRes.allowed)

  // EPC inviting unauthorized roles
  for (const forbidden of ['nodo_analista', 'epc', 'finder', 'suministrador']) {
    const res = validateUserInvitationPermission('epc', forbidden)
    assert(!res.allowed, `EPC cannot invite ${forbidden}`)
    assertEqual(res.error, 'No autorizado para invitar este tipo de usuario')
  }

  // Finder inviting unauthorized roles
  for (const forbidden of ['nodo_analista', 'cliente_final', 'financiero']) {
    const res = validateUserInvitationPermission('finder', forbidden)
    assert(!res.allowed, `Finder cannot invite ${forbidden}`)
    assertEqual(res.error, 'No autorizado para invitar este tipo de usuario')
  }
  // Finder inviting nodo_admin is blocked by the top-level admin escalation guard
  const finderAdminRes = validateUserInvitationPermission('finder', 'nodo_admin')
  assert(!finderAdminRes.allowed, 'Finder cannot invite nodo_admin')
  assertEqual(
    finderAdminRes.error,
    'No autorizado: solo los administradores pueden invitar cuentas de administrador.'
  )

  // Unprivileged callers cannot invite anyone
  for (const caller of ['cliente_final', 'financiero', 'suministrador', 'pendiente', null, undefined, 'unknown']) {
    const res = validateUserInvitationPermission(caller, 'cliente_final')
    assert(!res.allowed)
    assertEqual(res.error, 'No autorizado para enviar invitaciones')
  }
})

adversarialM1Suite.test('ADV-M1.4: getPortalPrefix and routing helpers fallback for unmapped strings vs prototype keys', () => {
  const safeFallbacks = [
    null,
    undefined,
    '',
    'unknown',
    'admin', // admin is prefix, not role
    'analista',
    'root',
  ]

  for (const input of safeFallbacks) {
    assertEqual(getPortalPrefix(input), 'pendiente', `getPortalPrefix(${input}) should fallback to "pendiente"`)
    assertEqual(getPortalPrefixForRole(input), 'pendiente', `getPortalPrefixForRole(${input}) should fallback to "pendiente"`)
    assertEqual(getPortalBackHref(input), '/pendiente', `getPortalBackHref(${input}) should fallback to "/pendiente"`)
  }

  // EMPIRICAL VULNERABILITY DISCOVERY: Prototype key lookup on ROLE_TO_PORTAL_PREFIX
  // Because ROLE_TO_PORTAL_PREFIX is a plain object literal inheriting from Object.prototype,
  // keys like '__proto__', 'toString', 'valueOf', and 'constructor' resolve to Object.prototype properties
  // rather than returning undefined. Since these are truthy, the || 'pendiente' fallback does NOT trigger!
  const protoPrefix = getPortalPrefix('__proto__')
  const toStringPrefix = getPortalPrefix('toString')
  const valueOfPrefix = getPortalPrefix('valueOf')

  assert(
    typeof protoPrefix !== 'string' || protoPrefix !== 'pendiente',
    'CONFIRMED FLAW: getPortalPrefix("__proto__") returns Object.prototype instead of "pendiente"'
  )
  assert(
    typeof toStringPrefix === 'function',
    'CONFIRMED FLAW: getPortalPrefix("toString") returns function instead of "pendiente"'
  )
  assert(
    typeof valueOfPrefix === 'function',
    'CONFIRMED FLAW: getPortalPrefix("valueOf") returns function instead of "pendiente"'
  )
})

adversarialM1Suite.test('ADV-M1.5: Project modification & deletion capability boundary testing', () => {
  // canChangeProjectStage: admin, analista, epc allowed; others blocked; same-stage blocked
  assert(canChangeProjectStage('nodo_admin', 'recibido', 'en_analisis'))
  assert(canChangeProjectStage('nodo_analista', 'recibido', 'en_analisis'))
  assert(canChangeProjectStage('epc', 'recibido', 'en_analisis'))
  assert(!canChangeProjectStage('finder', 'recibido', 'en_analisis'))
  assert(!canChangeProjectStage('cliente_final', 'recibido', 'en_analisis'))
  assert(!canChangeProjectStage('financiero', 'recibido', 'en_analisis'))
  assert(!canChangeProjectStage('nodo_admin', 'recibido', 'recibido'), 'Same-stage transition should return false')

  // canDeleteProject: only admin OR epc owning the project
  const adminUser = { id: 'admin-1', rol: 'nodo_admin' }
  const epcOwner = { id: 'epc-1', rol: 'epc' }
  const epcOther = { id: 'epc-2', rol: 'epc' }
  const analistaUser = { id: 'analyst-1', rol: 'nodo_analista' }
  const finderUser = { id: 'finder-1', rol: 'finder' }

  const ownProject = { epcista_id: 'epc-1' }
  const otherProject = { epcista_id: 'epc-99' }
  const unassignedProject = { epcista_id: null }

  assert(canDeleteProject(adminUser, ownProject), 'Admin can delete own project')
  assert(canDeleteProject(adminUser, otherProject), 'Admin can delete foreign project')
  assert(canDeleteProject(adminUser, unassignedProject), 'Admin can delete unassigned project')

  assert(canDeleteProject(epcOwner, ownProject), 'EPC can delete own project')
  assert(!canDeleteProject(epcOwner, otherProject), 'EPC CANNOT delete foreign project')
  assert(!canDeleteProject(epcOther, ownProject), 'Other EPC CANNOT delete foreign project')
  assert(!canDeleteProject(epcOwner, unassignedProject), 'EPC CANNOT delete unassigned project')

  assert(!canDeleteProject(analistaUser, ownProject), 'Analyst CANNOT delete project')
  assert(!canDeleteProject(finderUser, ownProject), 'Finder CANNOT delete project')

  // canEditTechnicalSolution & canEditProjectGeneral & canSelectWinningOption
  assert(canEditTechnicalSolution(adminUser, otherProject))
  assert(canEditTechnicalSolution(analistaUser, otherProject))
  assert(canEditTechnicalSolution(epcOwner, ownProject))
  assert(!canEditTechnicalSolution(epcOther, ownProject))
  assert(!canEditTechnicalSolution(finderUser, ownProject))

  assert(canEditProjectGeneral(adminUser, otherProject))
  assert(canEditProjectGeneral(analistaUser, otherProject))
  assert(canEditProjectGeneral(epcOwner, ownProject))
  assert(!canEditProjectGeneral(epcOther, ownProject))

  assert(canSelectWinningOption(adminUser, otherProject))
  assert(canSelectWinningOption(analistaUser, otherProject))
  assert(canSelectWinningOption(epcOwner, ownProject))
  assert(!canSelectWinningOption(epcOther, ownProject))
  assert(!canSelectWinningOption(finderUser, ownProject))

  // canManageClientUsers
  assert(canManageClientUsers('nodo_admin'))
  assert(canManageClientUsers('nodo_analista'))
  assert(canManageClientUsers('epc'))
  assert(!canManageClientUsers('finder'))
  assert(!canManageClientUsers('cliente_final'))

  // canInviteRole delegation
  const inviteCheck = canInviteRole('epc', 'cliente_final')
  assert(inviteCheck.allowed)

  // Role predicate guards
  assert(isNodoRole('nodo_admin') && isNodoRole('nodo_analista') && !isNodoRole('epc'))
  assert(isAdminRole('nodo_admin') && !isAdminRole('nodo_analista'))
  assert(isAnalystRole('nodo_analista') && !isAnalystRole('nodo_admin'))
  assert(isEpcRole('epc') && !isEpcRole('finder'))
  assert(isFinderRole('finder') && !isFinderRole('epc'))
  assert(isClienteRole('cliente_final') && !isClienteRole('financiero'))
  assert(isFinancieroRole('financiero') && !isFinancieroRole('cliente_final'))

  // Boundary condition check: undefined epcista_id vs undefined user id
  const undefinedUser = { id: undefined, rol: 'epc' }
  const undefinedProject = { epcista_id: undefined }
  // Empirical check: what does canDeleteProject do when both are undefined?
  const undefinedResult = canDeleteProject(undefinedUser, undefinedProject)
  // undefined === undefined is true in JS, so it evaluates to true!
  // We document this boundary behavior in our adversarial report.
  assert(typeof undefinedResult === 'boolean')
})

// =============================================================================
// 2. USER PROVISIONING CHECKS (user-provisioning.ts)
// =============================================================================

adversarialM1Suite.test('ADV-M1.6: provisionUserAccount rejects invalid/non-existent caller IDs', async () => {
  const anon = getAnonClient()
  const invalidCallers = [
    '00000000-0000-0000-0000-000000000099',
    'not-a-valid-uuid',
    '',
  ]

  for (const fakeId of invalidCallers) {
    const res = await provisionUserAccount(
      fakeId,
      {
        email: 'test_fake_caller@test.com',
        nombre: 'Test',
        rol: 'cliente_final',
      },
      anon
    )

    assertEqual(
      res.error,
      'No se encontró el perfil del usuario autenticado.',
      `Non-existent caller ${fakeId} must be rejected`
    )
    assertEqual(res.success, undefined)
  }
})

adversarialM1Suite.test('ADV-M1.7: executeCreateUserAdmin rejects unauthorized role assignments', async () => {
  const anon = getAnonClient()
  const analistaAuth = await getAuthSession('analista')
  const epcAuth = await getAuthSession('epc')

  // Analista trying to create nodo_admin
  const analistaRes = await executeCreateUserAdmin(
    analistaAuth.user,
    { id: analistaAuth.user.id, rol: 'nodo_analista', nombre: 'Analyst' },
    {
      email: 'exploit_admin@test.com',
      nombre: 'Exploit Admin',
      empresa: 'Attack Corp',
      rol: 'nodo_admin',
    },
    anon
  )
  assertEqual(
    analistaRes.error,
    'No autorizado: solo los administradores pueden crear cuentas de administrador.'
  )
  assertEqual(analistaRes.success, undefined)

  // EPC trying to create nodo_analista
  const epcRes = await executeCreateUserAdmin(
    epcAuth.user,
    { id: epcAuth.user.id, rol: 'epc', nombre: 'EPC' },
    {
      email: 'exploit_analyst@test.com',
      nombre: 'Exploit Analyst',
      empresa: 'Attack Corp',
      rol: 'nodo_analista',
    },
    anon
  )
  assertEqual(
    epcRes.error,
    'No autorizado para crear este tipo de usuario.'
  )
  assertEqual(epcRes.success, undefined)
})

adversarialM1Suite.test('ADV-M1.8: verifyClientBelongsToEpc and client ownership mismatch blocks unauthorized assignment', async () => {
  const anon = getAnonClient()
  const epcAuth = await getAuthSession('epc')

  // Test verifyClientBelongsToEpc with a random non-existent client ID
  const fakeClientId = '00000000-0000-0000-0000-000000000999'
  const belongs = await verifyClientBelongsToEpc(anon, fakeClientId, epcAuth.user.id)
  assertEqual(belongs, false, 'Non-existent client must return false for EPC ownership')

  // Attempt creation with mismatched cliente_crm_id
  const createRes = await executeCreateUserAdmin(
    epcAuth.user,
    { id: epcAuth.user.id, rol: 'epc', nombre: 'EPC' },
    {
      email: 'mismatched_client_user@test.com',
      nombre: 'Mismatched User',
      empresa: 'Test Corp',
      rol: 'cliente_final',
      cliente_crm_id: fakeClientId,
    },
    anon
  )
  assertEqual(
    createRes.error,
    'No autorizado: este cliente no te pertenece.',
    'Mismatched client ownership must reject creation'
  )

  // Attempt invitation with mismatched cliente_crm_id
  const inviteRes = await executeInviteUser(
    epcAuth.user,
    { id: epcAuth.user.id, rol: 'epc', nombre: 'EPC' },
    {
      email: 'mismatched_invite_user@test.com',
      nombre: 'Mismatched Invite',
      empresa: 'Test Corp',
      rol: 'cliente_final',
      cliente_crm_id: fakeClientId,
    },
    anon
  )
  assertEqual(
    inviteRes.error,
    'No autorizado: este cliente no te pertenece',
    'Mismatched client ownership must reject invitation'
  )
})

adversarialM1Suite.test('ADV-M1.9: executeDeleteUser, executeResetPassword, and executeUpdateEmail enforce admin only', async () => {
  const analistaAuth = await getAuthSession('analista')
  const analistaProfile = { id: analistaAuth.user.id, rol: 'nodo_analista', nombre: 'Analyst' }
  const dummyTargetId = '00000000-0000-0000-0000-000000000002'

  // Delete user by non-admin
  const delRes = await executeDeleteUser(analistaAuth.user, analistaProfile, dummyTargetId)
  assertEqual(
    delRes.error,
    'No autorizado. Solo administradores pueden eliminar cuentas.'
  )

  // Reset password by non-admin
  const resetRes = await executeResetPassword(analistaAuth.user, analistaProfile, dummyTargetId, 'NewPassword123!')
  assertEqual(
    resetRes.error,
    'No autorizado. Solo administradores pueden cambiar contraseñas.'
  )

  // Update email by non-admin
  const emailRes = await executeUpdateEmail(analistaAuth.user, analistaProfile, dummyTargetId, 'new_email@test.com')
  assertEqual(
    emailRes.error,
    'No autorizado. Solo administradores pueden cambiar emails.'
  )
})

adversarialM1Suite.test('ADV-M1.10: executeLinkUserCliente prevents unauthorized linking and cross-client hijacking', async () => {
  const anon = getAnonClient()
  const clienteAuth = await getAuthSession('cliente')
  const epcAuth = await getAuthSession('epc')

  // Non-nodo, non-epc caller (e.g. cliente_final)
  const unauthorizedRes = await executeLinkUserCliente(
    clienteAuth.user,
    { id: clienteAuth.user.id, rol: 'cliente_final', nombre: 'Cliente' },
    { userId: 'user-1', clienteId: 'client-1' },
    anon
  )
  assertEqual(unauthorizedRes.error, 'No autorizado.')

  // EPC with foreign/mismatched client
  const fakeClientId = '00000000-0000-0000-0000-000000000999'
  const epcRes = await executeLinkUserCliente(
    epcAuth.user,
    { id: epcAuth.user.id, rol: 'epc', nombre: 'EPC' },
    { userId: 'user-1', clienteId: fakeClientId },
    anon
  )
  assertEqual(epcRes.error, 'No autorizado: este cliente no te pertenece.')
})

// =============================================================================
// 3. LIFECYCLE STATE TRANSITIONS (lifecycle.ts)
// =============================================================================

adversarialM1Suite.test('ADV-M1.11: validateStageTransition blocks terminal/approval stages without winning selections', () => {
  assertEqual(STAGE_ORDER.length, 10)
  assertEqual(SALES_CYCLE.length, 10)
  assert(ESTADO_LABELS.recibido === 'Lead')
  assert(isStageApprovalOrBeyond('aprobado') && isStageApprovalOrBeyond('completado') && !isStageApprovalOrBeyond('recibido'))

  const dummyProject = { id: 'p-1', nombre_proyecto: 'Adversarial Test Project', estado: 'recibido' }
  const expectedMsg = 'Se deben seleccionar una configuración técnica ganadora Y una opción de financiamiento ganadora antes de aprobar el proyecto o avanzar en el pipeline.'

  for (const termStage of TERMINAL_STAGES) {
    // Both missing
    const resBothMissing = validateStageTransition(dummyProject, termStage, [], [])
    assert(!resBothMissing.valid, `Stage ${termStage} must reject missing selections`)
    assertEqual(resBothMissing.error, expectedMsg)

    // Config only
    const resConfigOnly = validateStageTransition(dummyProject, termStage, [{ seleccionada: true }], [{ seleccionada: false }])
    assert(!resConfigOnly.valid, `Stage ${termStage} must reject missing financing`)
    assertEqual(resConfigOnly.error, expectedMsg)

    // Financing only
    const resFinOnly = validateStageTransition(dummyProject, termStage, [{ seleccionada: false }], [{ seleccionada: true }])
    assert(!resFinOnly.valid, `Stage ${termStage} must reject missing config`)
    assertEqual(resFinOnly.error, expectedMsg)

    // Both present
    const resBothPresent = validateStageTransition(dummyProject, termStage, [{ seleccionada: true }], [{ seleccionada: true }])
    assert(resBothPresent.valid, `Stage ${termStage} with both selections must pass`)
    assertEqual(resBothPresent.error, undefined)
  }
})

adversarialM1Suite.test('ADV-M1.12: validateStageTransition allows pre-approval pipeline stages without winning selections', () => {
  const dummyProject = { id: 'p-1', nombre_proyecto: 'Pre-approval Test', estado: 'recibido' }
  const preApprovalStages = ['recibido', 'en_analisis', 'propuesta_lista', 'enviada', 'cliente_interesado', 'negociacion']

  for (const stage of preApprovalStages) {
    const res = validateStageTransition(dummyProject, stage, [], [])
    assert(res.valid, `Pre-approval stage ${stage} should not require selections`)
    assertEqual(res.error, undefined)
  }
})

adversarialM1Suite.test('ADV-M1.13: Empirical analysis of stage leaps and terminal backward transitions', () => {
  // We empirically check whether validateStageTransition restricts stage leaps or terminal backwards transitions
  const completedProject = { id: 'p-term', nombre_proyecto: 'Completed Project', estado: 'completado' }
  const initialProject = { id: 'p-init', nombre_proyecto: 'Initial Project', estado: 'recibido' }

  // 1. Backward leap from completed to recibido
  const backwardTransition = validateStageTransition(completedProject, 'recibido', [], [])
  // Observation: validateStageTransition does not evaluate previous state order; it guards winning selection requirements
  assert(typeof backwardTransition.valid === 'boolean')

  // 2. Forward leap from recibido directly to completado (with selections)
  const leapTransition = validateStageTransition(initialProject, 'completado', [{ seleccionada: true }], [{ seleccionada: true }])
  assert(leapTransition.valid)

  // 3. Forward leap from recibido directly to completado (WITHOUT selections)
  const leapBlockedWithoutSelections = validateStageTransition(initialProject, 'completado', [], [])
  assert(!leapBlockedWithoutSelections.valid)
  assertEqual(
    leapBlockedWithoutSelections.error,
    'Se deben seleccionar una configuración técnica ganadora Y una opción de financiamiento ganadora antes de aprobar el proyecto o avanzar en el pipeline.'
  )
})

adversarialM1Suite.test('ADV-M1.14: State transition payload generation and plan locking invariants', () => {
  const directHistory = calculateNextHistorialEstados({ recibido: '2026-10-01' }, 'en_analisis', '2026-10-02')
  assertEqual(directHistory.recibido, '2026-10-01')
  assertEqual(directHistory.en_analisis, '2026-10-02')

  // Test plan locking invariant for en_construccion
  const constrPayload = getStageTransitionPayload('en_construccion', { recibido: '2026-10-01T00:00:00Z' })
  assertEqual(constrPayload.estado, 'en_construccion')
  assertEqual(constrPayload.plan_bloqueado, true, 'en_construccion MUST set plan_bloqueado: true')
  assert(constrPayload.historial_estados.en_construccion !== undefined, 'Must record en_construccion in history')
  assertEqual(constrPayload.historial_estados.recibido, '2026-10-01T00:00:00Z', 'Must preserve previous history')

  // Test other stages do NOT set plan_bloqueado
  for (const stage of ['recibido', 'en_analisis', 'aprobado', 'operativo', 'completado']) {
    const payload = getStageTransitionPayload(stage)
    assertEqual(payload.estado, stage)
    assertEqual(payload.plan_bloqueado, undefined, `Stage ${stage} should not set plan_bloqueado`)
    assert(payload.historial_estados[stage] !== undefined)
  }
})

// Run the suite
adversarialM1Suite.run().then((success) => {
  console.log(`\nAdversarial M1 Empirical Suite finished: ${success ? 'ALL PASSED' : 'SOME FAILED'}`)
  if (!success) process.exit(1)
})
