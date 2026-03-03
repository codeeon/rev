export class GoogleSheetsError extends Error {
  readonly code: string

  constructor(message: string, code = 'GOOGLE_SHEETS_ERROR') {
    super(message)
    this.name = 'GoogleSheetsError'
    this.code = code
  }
}

export class GoogleSheetsConfigError extends GoogleSheetsError {
  constructor(message: string) {
    super(message, 'GOOGLE_SHEETS_CONFIG_ERROR')
    this.name = 'GoogleSheetsConfigError'
  }
}

export class GoogleSheetsAuthError extends GoogleSheetsError {
  constructor(message: string) {
    super(message, 'GOOGLE_SHEETS_AUTH_ERROR')
    this.name = 'GoogleSheetsAuthError'
  }
}

export class GoogleSheetsHttpError extends GoogleSheetsError {
  readonly status: number
  readonly details: unknown

  constructor(status: number, message: string, details: unknown = null) {
    super(message, 'GOOGLE_SHEETS_HTTP_ERROR')
    this.name = 'GoogleSheetsHttpError'
    this.status = status
    this.details = details
  }
}
