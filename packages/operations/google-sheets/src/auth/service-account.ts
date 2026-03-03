import { createSign } from 'node:crypto'
import { GoogleSheetsAuthError, GoogleSheetsConfigError } from '../errors'
import type { AccessToken, TokenProvider } from './types'

const DEFAULT_TOKEN_URI = 'https://oauth2.googleapis.com/token'
const DEFAULT_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const DEFAULT_EAGER_REFRESH_SECONDS = 90
const TOKEN_LIFETIME_SECONDS = 3600

interface ServiceAccountTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

export interface ServiceAccountCredentials {
  clientEmail: string
  privateKey: string
  privateKeyId?: string
  tokenUri?: string
  scopes: string[]
  subject?: string
}

export interface CreateServiceAccountTokenProviderOptions {
  credentials: ServiceAccountCredentials
  fetchFn?: typeof fetch
  eagerRefreshSeconds?: number
}

export interface ServiceAccountEnv {
  [key: string]: string | undefined
}

function encodeBase64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function createJwtAssertion(credentials: ServiceAccountCredentials, issuedAtSeconds: number): string {
  const tokenUri = credentials.tokenUri ?? DEFAULT_TOKEN_URI
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: credentials.privateKeyId,
  }
  const payload = {
    iss: credentials.clientEmail,
    scope: credentials.scopes.join(' '),
    aud: tokenUri,
    iat: issuedAtSeconds,
    exp: issuedAtSeconds + TOKEN_LIFETIME_SECONDS,
    sub: credentials.subject,
  }

  const unsignedToken = `${encodeBase64UrlJson(header)}.${encodeBase64UrlJson(payload)}`
  const signer = createSign('RSA-SHA256')
  signer.update(unsignedToken)
  signer.end()

  let signature: string
  try {
    signature = signer.sign(credentials.privateKey, 'base64url')
  } catch {
    throw new GoogleSheetsAuthError('Failed to sign JWT assertion for service account')
  }

  return `${unsignedToken}.${signature}`
}

function parseTokenResponse(payload: unknown): ServiceAccountTokenResponse {
  if (!payload || typeof payload !== 'object') {
    throw new GoogleSheetsAuthError('Service account token response has invalid shape')
  }

  const tokenPayload = payload as Partial<ServiceAccountTokenResponse>
  if (!tokenPayload.access_token || !tokenPayload.token_type || typeof tokenPayload.expires_in !== 'number') {
    throw new GoogleSheetsAuthError('Service account token response is missing required fields')
  }

  return {
    access_token: tokenPayload.access_token,
    token_type: tokenPayload.token_type,
    expires_in: tokenPayload.expires_in,
  }
}

function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, '\n')
}

function parseScopes(rawScopes: string | undefined): string[] {
  if (!rawScopes) {
    return [DEFAULT_SCOPE]
  }

  const scopes = rawScopes
    .split(/[\s,]+/)
    .map(scope => scope.trim())
    .filter(Boolean)

  if (scopes.length === 0) {
    throw new GoogleSheetsConfigError('GOOGLE_SERVICE_ACCOUNT_SCOPES is set but empty')
  }

  return scopes
}

function readRequiredEnv(env: ServiceAccountEnv, key: string): string {
  const value = env[key]?.trim()
  if (!value) {
    throw new GoogleSheetsConfigError(`${key} is required for service account auth`)
  }
  return value
}

export function loadServiceAccountCredentialsFromEnv(env: ServiceAccountEnv = process.env): ServiceAccountCredentials {
  return {
    clientEmail: readRequiredEnv(env, 'GOOGLE_SERVICE_ACCOUNT_EMAIL'),
    privateKey: normalizePrivateKey(readRequiredEnv(env, 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')),
    privateKeyId: env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_ID?.trim(),
    tokenUri: env.GOOGLE_SERVICE_ACCOUNT_TOKEN_URI?.trim() || DEFAULT_TOKEN_URI,
    scopes: parseScopes(env.GOOGLE_SERVICE_ACCOUNT_SCOPES),
    subject: env.GOOGLE_SERVICE_ACCOUNT_SUBJECT?.trim(),
  }
}

export function createServiceAccountTokenProvider(options: CreateServiceAccountTokenProviderOptions): TokenProvider {
  const credentials = options.credentials
  const fetchFn = options.fetchFn ?? fetch
  const eagerRefreshMs = Math.max(0, (options.eagerRefreshSeconds ?? DEFAULT_EAGER_REFRESH_SECONDS) * 1000)
  let cachedToken: AccessToken | null = null

  return {
    async getAccessToken(): Promise<AccessToken> {
      const now = Date.now()
      if (cachedToken?.token && typeof cachedToken.expiresAt === 'number' && now + eagerRefreshMs < cachedToken.expiresAt) {
        return cachedToken
      }

      const assertion = createJwtAssertion(credentials, Math.floor(now / 1000))
      const body = new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      })

      const response = await fetchFn(credentials.tokenUri ?? DEFAULT_TOKEN_URI, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      })

      const responseText = await response.text()
      let responsePayload: unknown = null
      if (responseText) {
        try {
          responsePayload = JSON.parse(responseText)
        } catch {
          responsePayload = responseText
        }
      }

      if (!response.ok) {
        throw new GoogleSheetsAuthError(`Service account token exchange failed with status ${response.status}`)
      }

      const parsedPayload = parseTokenResponse(responsePayload)
      cachedToken = {
        token: parsedPayload.access_token,
        expiresAt: now + parsedPayload.expires_in * 1000,
      }

      return cachedToken
    },
  }
}
