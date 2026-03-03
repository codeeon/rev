export interface AccessToken {
  token: string
  expiresAt?: number
}

export interface TokenProvider {
  getAccessToken(): Promise<AccessToken>
}

export interface StaticTokenProviderOptions {
  token: string
  expiresAt?: number
}

export function createStaticTokenProvider(options: StaticTokenProviderOptions): TokenProvider {
  return {
    async getAccessToken() {
      return {
        token: options.token,
        expiresAt: options.expiresAt,
      }
    },
  }
}
