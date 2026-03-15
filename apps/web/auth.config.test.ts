import assert from 'node:assert/strict'
import test from 'node:test'
import authConfig from './auth.config'

const originalAllowedEmails = process.env.ADMIN_ALLOWED_EMAILS
const originalOwnerEmails = process.env.ADMIN_OWNER_EMAILS
const originalEditorEmails = process.env.ADMIN_EDITOR_EMAILS
const originalViewerEmails = process.env.ADMIN_VIEWER_EMAILS
const originalDefaultRole = process.env.ADMIN_DEFAULT_ROLE

function restoreAllowedEmails(): void {
  if (typeof originalAllowedEmails === 'string') {
    process.env.ADMIN_ALLOWED_EMAILS = originalAllowedEmails
  } else {
    delete process.env.ADMIN_ALLOWED_EMAILS
  }

  if (typeof originalOwnerEmails === 'string') {
    process.env.ADMIN_OWNER_EMAILS = originalOwnerEmails
  } else {
    delete process.env.ADMIN_OWNER_EMAILS
  }

  if (typeof originalEditorEmails === 'string') {
    process.env.ADMIN_EDITOR_EMAILS = originalEditorEmails
  } else {
    delete process.env.ADMIN_EDITOR_EMAILS
  }

  if (typeof originalViewerEmails === 'string') {
    process.env.ADMIN_VIEWER_EMAILS = originalViewerEmails
  } else {
    delete process.env.ADMIN_VIEWER_EMAILS
  }

  if (typeof originalDefaultRole === 'string') {
    process.env.ADMIN_DEFAULT_ROLE = originalDefaultRole
  } else {
    delete process.env.ADMIN_DEFAULT_ROLE
  }
}

function getCallbacks() {
  const callbacks = authConfig.callbacks
  if (!callbacks?.signIn || !callbacks.jwt || !callbacks.session) {
    throw new Error('Auth.js callbacks are not configured')
  }

  return callbacks
}

test.afterEach(() => {
  restoreAllowedEmails()
})

test('signIn callback allows emails in the admin allowlist', async () => {
  process.env.ADMIN_ALLOWED_EMAILS = 'owner@example.com,ops@example.com'
  const { signIn } = getCallbacks()

  const allowed = await signIn({
    user: {
      email: ' Ops@Example.com ',
    },
  } as Parameters<typeof signIn>[0])

  assert.equal(allowed, true)
})

test('signIn callback rejects emails outside the admin allowlist', async () => {
  process.env.ADMIN_ALLOWED_EMAILS = 'owner@example.com,ops@example.com'
  const { signIn } = getCallbacks()

  const allowed = await signIn({
    user: {
      email: 'guest@example.com',
    },
  } as Parameters<typeof signIn>[0])

  assert.equal(allowed, false)
})

test('jwt callback stores normalized admin status from the signed-in user', async () => {
  process.env.ADMIN_ALLOWED_EMAILS = 'owner@example.com'
  process.env.ADMIN_DEFAULT_ROLE = 'owner'
  const { jwt } = getCallbacks()

  const token = await jwt({
    token: {},
    user: {
      email: 'Owner@Example.com',
    },
  } as Parameters<typeof jwt>[0])

  assert.equal(token.email, 'Owner@Example.com')
  assert.equal(token.isAdmin, true)
  assert.equal(token.role, 'owner')
})

test('jwt callback falls back to existing token email when user is missing', async () => {
  process.env.ADMIN_ALLOWED_EMAILS = 'owner@example.com'
  const { jwt } = getCallbacks()

  const token = await jwt({
    token: {
      email: 'guest@example.com',
    },
  } as Parameters<typeof jwt>[0])

  assert.equal(token.email, 'guest@example.com')
  assert.equal(token.isAdmin, false)
  assert.equal(token.role, undefined)
})

test('jwt callback prefers explicit role mapping over default admin role', async () => {
  process.env.ADMIN_ALLOWED_EMAILS = 'owner@example.com,editor@example.com'
  process.env.ADMIN_EDITOR_EMAILS = 'editor@example.com'
  process.env.ADMIN_DEFAULT_ROLE = 'viewer'
  const { jwt } = getCallbacks()

  const token = await jwt({
    token: {},
    user: {
      email: 'editor@example.com',
    },
  } as Parameters<typeof jwt>[0])

  assert.equal(token.isAdmin, true)
  assert.equal(token.role, 'editor')
})

test('session callback copies token email and admin flag onto session.user', async () => {
  const { session } = getCallbacks()

  const nextSession = await session({
    session: {
      user: {
        name: 'Owner',
        email: null,
        image: null,
      },
      expires: '2099-01-01T00:00:00.000Z',
    },
    token: {
      email: 'owner@example.com',
      isAdmin: true,
      role: 'owner',
    },
  } as unknown as Parameters<typeof session>[0])

  assert.equal(nextSession.user.email, 'owner@example.com')
  assert.equal(nextSession.user.isAdmin, true)
  assert.equal(nextSession.user.role, 'owner')
})
