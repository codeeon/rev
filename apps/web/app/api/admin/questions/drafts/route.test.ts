import assert from 'node:assert/strict'
import test from 'node:test'
import { setAdminRouteDepsForTest } from '../../route-deps'
import { GET, POST } from './route'

test.afterEach(() => {
  setAdminRouteDepsForTest(null)
})

test('GET returns 401 when admin session is missing', async () => {
  setAdminRouteDepsForTest({
    auth: async () => null,
  })

  const response = await GET(new Request('http://localhost/api/admin/questions/drafts') as never)
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { error: 'unauthorized' })
})

test('GET returns 400 when draft status filter is invalid', async () => {
  setAdminRouteDepsForTest({
    auth: async () => ({ user: { email: 'owner@example.com', isAdmin: true } }) as never,
  })

  const response = await GET(new Request('http://localhost/api/admin/questions/drafts?status=invalid') as never)
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: 'invalid-draft-status' })
})

test('GET returns draft summaries for admin session', async () => {
  let receivedOptions: Record<string, unknown> | undefined

  setAdminRouteDepsForTest({
    auth: async () => ({ user: { email: 'owner@example.com', isAdmin: true } }) as never,
    listDrafts: async options => {
      receivedOptions = options
      return {
        items: [
          {
            draftId: 'draft-1',
            version: '2026.03.16',
            sourceVersion: '2026.03.15',
            status: 'draft',
            changeSummary: 'copy',
            updatedBy: 'owner@example.com',
            updatedAt: '2026-03-15T00:00:00.000Z',
            questionCount: 4,
            optionCount: 4,
            missingRoles: [],
          },
        ],
      }
    },
  })

  const response = await GET(new Request('http://localhost/api/admin/questions/drafts?version=2026.03.16&status=draft') as never)
  assert.equal(response.status, 200)

  const payload = await response.json()
  assert.deepEqual(receivedOptions, {
    draftId: undefined,
    version: '2026.03.16',
    status: 'draft',
  })
  assert.equal(payload.items[0]?.draftId, 'draft-1')
})

test('GET returns 403 when session lacks questions.edit capability', async () => {
  setAdminRouteDepsForTest({
    auth: async () => ({ user: { email: 'viewer@example.com', isAdmin: true, role: 'viewer' } }) as never,
  })

  const response = await GET(new Request('http://localhost/api/admin/questions/drafts') as never)
  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), { error: 'insufficient-role' })
})

test('POST returns 400 for malformed JSON body', async () => {
  setAdminRouteDepsForTest({
    auth: async () => ({ user: { email: 'owner@example.com', isAdmin: true } }) as never,
  })

  const response = await POST(
    new Request('http://localhost/api/admin/questions/drafts', {
      method: 'POST',
      body: '{',
      headers: { 'content-type': 'application/json' },
    }) as never,
  )

  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: 'invalid-json' })
})

test('POST returns 400 for invalid payload', async () => {
  setAdminRouteDepsForTest({
    auth: async () => ({ user: { email: 'owner@example.com', isAdmin: true } }) as never,
  })

  const response = await POST(
    new Request('http://localhost/api/admin/questions/drafts', {
      method: 'POST',
      body: JSON.stringify({ version: '', changeSummary: '' }),
      headers: { 'content-type': 'application/json' },
    }) as never,
  )

  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: 'invalid-draft-payload' })
})

test('POST creates a draft snapshot with session email', async () => {
  let receivedInput:
    | {
        version: string
        sourceVersion?: string
        changeSummary: string
        updatedBy: string
      }
    | undefined

  setAdminRouteDepsForTest({
    auth: async () => ({ user: { email: 'owner@example.com', isAdmin: true } }) as never,
    createDraft: async input => {
      receivedInput = input
      return {
        draftId: 'draft-1',
        version: '2026.03.16',
        sourceVersion: '2026.03.15',
        status: 'draft',
        changeSummary: 'copy published set',
        updatedBy: 'owner@example.com',
        updatedAt: '2026-03-15T00:00:00.000Z',
        questionCount: 4,
        optionCount: 4,
        appendedRowCount: 4,
        missingRoles: [],
      }
    },
  })

  const response = await POST(
    new Request('http://localhost/api/admin/questions/drafts', {
      method: 'POST',
      body: JSON.stringify({ version: '2026.03.16', sourceVersion: '2026.03.15', changeSummary: 'copy published set' }),
      headers: { 'content-type': 'application/json' },
    }) as never,
  )

  assert.equal(response.status, 201)
  assert.deepEqual(receivedInput, {
    version: '2026.03.16',
    sourceVersion: '2026.03.15',
    changeSummary: 'copy published set',
    updatedBy: 'owner@example.com',
  })

  const payload = await response.json()
  assert.equal(payload.draftId, 'draft-1')
  assert.equal(payload.appendedRowCount, 4)
})

test('POST returns 503 when draft creation fails', async () => {
  setAdminRouteDepsForTest({
    auth: async () => ({ user: { email: 'owner@example.com', isAdmin: true } }) as never,
    createDraft: async () => {
      throw new Error('draft create failed')
    },
  })

  const response = await POST(
    new Request('http://localhost/api/admin/questions/drafts', {
      method: 'POST',
      body: JSON.stringify({ version: '2026.03.16', changeSummary: 'copy' }),
      headers: { 'content-type': 'application/json' },
    }) as never,
  )

  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), {
    error: 'question-draft-create-failed',
    message: 'draft create failed',
  })
})
