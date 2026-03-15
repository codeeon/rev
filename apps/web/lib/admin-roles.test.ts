import assert from 'node:assert/strict'
import test from 'node:test'
import { getAdminRoleMatrix, hasAdminCapability } from './admin-roles'

test('hasAdminCapability reflects the current role matrix', () => {
  assert.equal(hasAdminCapability('viewer', 'analytics.read'), true)
  assert.equal(hasAdminCapability('viewer', 'questions.edit'), false)
  assert.equal(hasAdminCapability('editor', 'questions.edit'), true)
  assert.equal(hasAdminCapability('editor', 'questions.publish'), false)
  assert.equal(hasAdminCapability('owner', 'questions.publish'), true)
  assert.equal(hasAdminCapability('owner', 'roles.manage'), true)
})

test('getAdminRoleMatrix returns a copy safe to inspect in UI contracts', () => {
  const matrix = getAdminRoleMatrix()
  assert.equal(matrix.length, 3)
  assert.deepEqual(matrix.map(row => row.role), ['viewer', 'editor', 'owner'])

  matrix[0]?.capabilities.push('questions.edit')

  const reloaded = getAdminRoleMatrix()
  assert.equal(reloaded[0]?.capabilities.includes('questions.edit'), false)
})
