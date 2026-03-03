import { GoogleSheetsAuthError } from '../errors'
import type { AccessToken, TokenProvider } from './types'

export interface OAuthUserTokenState {
  accessToken: string
  expiresAt?: number
  refreshToken?: string
}

export interface OAuthUserRefreshResult {
  accessToken: string
  expiresAt?: number
  refreshToken?: string
}

export type OAuthUserTokenRefresher = (refreshToken: string) => Promise<OAuthUserRefreshResult>

export interface CreateOAuthUserTokenProviderOptions {
  state: OAuthUserTokenState
  refresh?: OAuthUserTokenRefresher
  eagerRefreshSeconds?: number
}

function shouldRefresh(state: OAuthUserTokenState, eagerRefreshSeconds: number): boolean {
  if (typeof state.expiresAt !== 'number') {
    return false
  }

  const refreshThreshold = Date.now() + eagerRefreshSeconds * 1000
  return refreshThreshold >= state.expiresAt
}

export function createOAuthUserTokenProvider(options: CreateOAuthUserTokenProviderOptions): TokenProvider {
  const state: OAuthUserTokenState = {
    accessToken: options.state.accessToken,
    expiresAt: options.state.expiresAt,
    refreshToken: options.state.refreshToken,
  }
  const eagerRefreshSeconds = Math.max(0, options.eagerRefreshSeconds ?? 60)

  return {
    async getAccessToken(): Promise<AccessToken> {
      if (!state.accessToken) {
        throw new GoogleSheetsAuthError('OAuth access token is missing')
      }

      if (!shouldRefresh(state, eagerRefreshSeconds)) {
        return {
          token: state.accessToken,
          expiresAt: state.expiresAt,
        }
      }

      if (!options.refresh || !state.refreshToken) {
        throw new GoogleSheetsAuthError('OAuth access token is expired and no refresh strategy is configured')
      }

      const refreshed = await options.refresh(state.refreshToken)
      if (!refreshed.accessToken) {
        throw new GoogleSheetsAuthError('OAuth refresh did not return an access token')
      }

      state.accessToken = refreshed.accessToken
      state.expiresAt = refreshed.expiresAt
      state.refreshToken = refreshed.refreshToken ?? state.refreshToken

      return {
        token: state.accessToken,
        expiresAt: state.expiresAt,
      }
    },
  }
}
