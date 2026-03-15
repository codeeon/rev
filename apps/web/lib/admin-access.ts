export interface AdminSessionLike {
  user?: {
    email?: string | null
    isAdmin?: boolean | null
  } | null
}

export type AdminSessionStatus = 'authorized' | 'unauthorized' | 'forbidden'
type AdminAccessEnv = Record<string, string | undefined> & {
  ADMIN_ALLOWED_EMAILS?: string
  AUTH_SECRET?: string
  AUTH_GOOGLE_ID?: string
  AUTH_GOOGLE_SECRET?: string
}

function normalizeEmailValue(email: string): string {
  return email.trim().toLowerCase()
}

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email || !email.trim()) {
    return null
  }

  return normalizeEmailValue(email)
}

export function getAllowedAdminEmails(env: AdminAccessEnv = process.env): string[] {
  const rawValue = env.ADMIN_ALLOWED_EMAILS?.trim()
  if (!rawValue) {
    return []
  }

  return rawValue
    .split(',')
    .map(item => normalizeEmail(item))
    .filter((item): item is string => Boolean(item))
}

export function isAllowedAdminEmail(email: string | null | undefined, env: AdminAccessEnv = process.env): boolean {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) {
    return false
  }

  return getAllowedAdminEmails(env).includes(normalizedEmail)
}

export function hasAdminSessionAccess(session: AdminSessionLike | null | undefined): boolean {
  return session?.user?.isAdmin === true
}

export function getAdminSessionStatus(session: AdminSessionLike | null | undefined): AdminSessionStatus {
  if (!session?.user) {
    return 'unauthorized'
  }

  return hasAdminSessionAccess(session) ? 'authorized' : 'forbidden'
}

export function isAdminAuthConfigured(env: AdminAccessEnv = process.env): boolean {
  return Boolean(env.AUTH_SECRET?.trim() && env.AUTH_GOOGLE_ID?.trim() && env.AUTH_GOOGLE_SECRET?.trim())
}
