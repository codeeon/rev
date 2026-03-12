import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getAdminSessionStatus,
  getAllowedAdminEmails,
  hasAdminSessionAccess,
  isAdminAuthConfigured,
  isAllowedAdminEmail,
  normalizeEmail,
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

test('hasAdminSessionAccess requires explicit isAdmin flag', () => {
  assert.equal(hasAdminSessionAccess({ user: { email: 'owner@example.com', isAdmin: true } }), true)
  assert.equal(hasAdminSessionAccess({ user: { email: 'owner@example.com', isAdmin: false } }), false)
  assert.equal(hasAdminSessionAccess(null), false)
})

test('getAdminSessionStatus distinguishes unauthorized and forbidden sessions', () => {
  assert.equal(getAdminSessionStatus(null), 'unauthorized')
  assert.equal(getAdminSessionStatus({ user: { email: 'guest@example.com', isAdmin: false } }), 'forbidden')
  assert.equal(getAdminSessionStatus({ user: { email: 'owner@example.com', isAdmin: true } }), 'authorized')
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
