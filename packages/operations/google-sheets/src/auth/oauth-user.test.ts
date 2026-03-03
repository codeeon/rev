import assert from 'node:assert/strict'
import test from 'node:test'
import { GoogleSheetsAuthError } from '../errors'
import { createOAuthUserTokenProvider } from './oauth-user'

test('oauth token provider returns static token before expiry', async () => {
  const provider = createOAuthUserTokenProvider({
    state: {
      accessToken: 'static-token',
      expiresAt: Date.now() + 120_000,
    },
  })

  const token = await provider.getAccessToken()
  assert.equal(token.token, 'static-token')
})

test('oauth token provider refreshes expired token', async () => {
  let refreshCalls = 0
  const provider = createOAuthUserTokenProvider({
    state: {
      accessToken: 'expired-token',
      expiresAt: Date.now() - 1_000,
      refreshToken: 'refresh-token',
    },
    refresh: async refreshToken => {
      refreshCalls += 1
      assert.equal(refreshToken, 'refresh-token')
      return {
        accessToken: 'fresh-token',
        expiresAt: Date.now() + 60_000,
      }
    },
  })

  const refreshed = await provider.getAccessToken()
  assert.equal(refreshCalls, 1)
  assert.equal(refreshed.token, 'fresh-token')
})

test('oauth token provider throws when refresh is required but unavailable', async () => {
  const provider = createOAuthUserTokenProvider({
    state: {
      accessToken: 'expired-token',
      expiresAt: Date.now() - 1_000,
    },
  })

  await assert.rejects(provider.getAccessToken(), GoogleSheetsAuthError)
})
