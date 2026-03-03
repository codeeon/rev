import assert from 'node:assert/strict'
import test from 'node:test'
import { GoogleSheetsConfigError } from '../errors'
import { loadServiceAccountCredentialsFromEnv } from './service-account'

test('service account env loader normalizes escaped newline and scopes', () => {
  const credentials = loadServiceAccountCredentialsFromEnv({
    GOOGLE_SERVICE_ACCOUNT_EMAIL: 'svc@example.iam.gserviceaccount.com',
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nLINE\\n-----END PRIVATE KEY-----\\n',
    GOOGLE_SERVICE_ACCOUNT_SCOPES: 'https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/drive.file',
  })

  assert.equal(credentials.clientEmail, 'svc@example.iam.gserviceaccount.com')
  assert.ok(credentials.privateKey.includes('\n'))
  assert.equal(credentials.scopes.length, 2)
})

test('service account env loader throws when required fields are missing', () => {
  assert.throws(
    () =>
      loadServiceAccountCredentialsFromEnv({
        GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: 'key',
      }),
    GoogleSheetsConfigError,
  )
})
