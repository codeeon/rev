import assert from 'node:assert/strict'
import test from 'node:test'
import { createAdminAuditEvent } from './admin-audit'

test('createAdminAuditEvent includes normalized actor identity and role', () => {
  const event = createAdminAuditEvent({
    action: 'draft.rollback',
    session: {
      user: {
        email: ' Owner@Example.com ',
        isAdmin: true,
        role: 'owner',
      },
    },
    subjectType: 'draft',
    subjectId: 'draft-1',
    metadata: { version: '2026.03.16' },
  })

  assert.equal(event.action, 'draft.rollback')
  assert.equal(event.actorEmail, 'owner@example.com')
  assert.equal(event.actorRole, 'owner')
  assert.equal(event.subjectId, 'draft-1')
  assert.equal(event.metadata?.version, '2026.03.16')
})
