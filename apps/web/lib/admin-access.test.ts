import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getAdminSessionRole,
  getAdminSessionStatus,
  getConfiguredAdminCount,
  getConfiguredAdminEmails,
  getDefaultAdminRole,
  getAllowedAdminEmails,
  getRequiredCapabilityError,
  hasAdminCapabilityForSession,
  hasAdminSessionAccess,
  isAdminAuthConfigured,
  isAllowedAdminEmail,
  normalizeEmail,
  resolveAdminRole,
} from './admin-access'

test('normalizeEmail lowercases and trims email values', () => {
  assert.equal(normalizeEmail('  Owner@Example.com '), 'owner@example.com')
  assert.equal(normalizeEmail('   '), null)
})

test('getAllowedAdminEmails parses comma-separated allowlist', () => {
  const emails = getAllowedAdminEmails({
    ADMIN_ALLOWED_EMAILS: 'owner@example.com, Ops@Example.com ,  ',
  })

  assert.deepEqual(emails, ['owner@example.com', 'ops@example.com'])
})

test('getConfiguredAdminEmails merges allowlist and explicit role lists', () => {
  const emails = getConfiguredAdminEmails({
    ADMIN_ALLOWED_EMAILS: 'owner@example.com',
    ADMIN_EDITOR_EMAILS: 'editor@example.com',
    ADMIN_VIEWER_EMAILS: 'viewer@example.com',
    ADMIN_OWNER_EMAILS: 'owner@example.com,lead@example.com',
  })

  assert.deepEqual(emails, ['owner@example.com', 'viewer@example.com', 'editor@example.com', 'lead@example.com'])
})

test('isAllowedAdminEmail matches normalized emails', () => {
  assert.equal(
    isAllowedAdminEmail('OPS@example.com', {
      ADMIN_ALLOWED_EMAILS: 'owner@example.com,ops@example.com',
    }),
    true,
  )
  assert.equal(
    isAllowedAdminEmail('guest@example.com', {
      ADMIN_ALLOWED_EMAILS: 'owner@example.com,ops@example.com',
    }),
    false,
  )
})

test('resolveAdminRole prefers explicit role map and falls back to default role for legacy allowlist', () => {
  assert.equal(
    resolveAdminRole('editor@example.com', {
      ADMIN_ALLOWED_EMAILS: 'owner@example.com,editor@example.com',
      ADMIN_EDITOR_EMAILS: 'editor@example.com',
      ADMIN_DEFAULT_ROLE: 'viewer',
    }),
    'editor',
  )

  assert.equal(
    resolveAdminRole('owner@example.com', {
      ADMIN_ALLOWED_EMAILS: 'owner@example.com',
      ADMIN_DEFAULT_ROLE: 'viewer',
    }),
    'viewer',
  )
})

test('getDefaultAdminRole falls back to owner for transition compatibility', () => {
  assert.equal(getDefaultAdminRole({ ADMIN_DEFAULT_ROLE: 'editor' }), 'editor')
  assert.equal(getDefaultAdminRole({}), 'owner')
})

test('hasAdminSessionAccess requires explicit isAdmin flag', () => {
  assert.equal(hasAdminSessionAccess({ user: { email: 'owner@example.com', isAdmin: true } }), true)
  assert.equal(hasAdminSessionAccess({ user: { email: 'owner@example.com', isAdmin: false } }), false)
  assert.equal(hasAdminSessionAccess(null), false)
})

test('getAdminSessionRole falls back to owner for legacy isAdmin sessions', () => {
  assert.equal(getAdminSessionRole({ user: { email: 'owner@example.com', isAdmin: true, role: 'editor' } }), 'editor')
  assert.equal(getAdminSessionRole({ user: { email: 'owner@example.com', isAdmin: true } }), 'owner')
  assert.equal(getAdminSessionRole({ user: { email: 'guest@example.com', isAdmin: false } }), null)
})

test('hasAdminCapabilityForSession checks current session role', () => {
  assert.equal(hasAdminCapabilityForSession({ user: { email: 'viewer@example.com', isAdmin: true, role: 'viewer' } }, 'analytics.read'), true)
  assert.equal(hasAdminCapabilityForSession({ user: { email: 'viewer@example.com', isAdmin: true, role: 'viewer' } }, 'questions.edit'), false)
  assert.equal(hasAdminCapabilityForSession({ user: { email: 'editor@example.com', isAdmin: true, role: 'editor' } }, 'questions.edit'), true)
})

test('getAdminSessionStatus distinguishes unauthorized and forbidden sessions', () => {
  assert.equal(getAdminSessionStatus(null), 'unauthorized')
  assert.equal(getAdminSessionStatus({ user: { email: 'guest@example.com', isAdmin: false } }), 'forbidden')
  assert.equal(getAdminSessionStatus({ user: { email: 'owner@example.com', isAdmin: true } }), 'authorized')
})

test('getRequiredCapabilityError distinguishes insufficient role from missing auth', () => {
  assert.equal(getRequiredCapabilityError(null, 'questions.edit'), 'unauthorized')
  assert.equal(getRequiredCapabilityError({ user: { email: 'guest@example.com', isAdmin: false } }, 'questions.edit'), 'forbidden')
  assert.equal(
    getRequiredCapabilityError({ user: { email: 'viewer@example.com', isAdmin: true, role: 'viewer' } }, 'questions.edit'),
    'insufficient-role',
  )
  assert.equal(
    getRequiredCapabilityError({ user: { email: 'editor@example.com', isAdmin: true, role: 'editor' } }, 'questions.edit'),
    null,
  )
})

test('isAdminAuthConfigured checks required Auth.js envs', () => {
  assert.equal(
    isAdminAuthConfigured({
      AUTH_SECRET: 'secret',
      AUTH_GOOGLE_ID: 'google-id',
      AUTH_GOOGLE_SECRET: 'google-secret',
    }),
    true,
  )

  assert.equal(
    isAdminAuthConfigured({
      AUTH_SECRET: 'secret',
      AUTH_GOOGLE_ID: 'google-id',
    }),
    false,
  )
})

test('getConfiguredAdminCount counts explicit role envs too', () => {
  assert.equal(
    getConfiguredAdminCount({
      ADMIN_VIEWER_EMAILS: 'viewer@example.com',
      ADMIN_EDITOR_EMAILS: 'editor@example.com',
    }),
    2,
  )
})
