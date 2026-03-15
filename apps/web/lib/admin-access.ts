import { hasAdminCapability, type AdminCapability, type AdminRole } from './admin-roles'

export interface AdminSessionLike {
  user?: {
    email?: string | null
    isAdmin?: boolean | null
    role?: AdminRole | null
  } | null
}

export type AdminSessionStatus = 'authorized' | 'unauthorized' | 'forbidden'
type AdminAccessEnv = Record<string, string | undefined> & {
  ADMIN_ALLOWED_EMAILS?: string
  ADMIN_VIEWER_EMAILS?: string
  ADMIN_EDITOR_EMAILS?: string
  ADMIN_OWNER_EMAILS?: string
  ADMIN_DEFAULT_ROLE?: string
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
  return parseAdminEmailList(env.ADMIN_ALLOWED_EMAILS)
}

function parseAdminEmailList(rawValue: string | undefined): string[] {
  const trimmedValue = rawValue?.trim()
  if (!trimmedValue) {
    return []
  }

  return trimmedValue
    .split(',')
    .map(item => normalizeEmail(item))
    .filter((item): item is string => Boolean(item))
}

function getRoleScopedEmails(role: AdminRole, env: AdminAccessEnv = process.env): string[] {
  if (role === 'viewer') {
    return parseAdminEmailList(env.ADMIN_VIEWER_EMAILS)
  }

  if (role === 'editor') {
    return parseAdminEmailList(env.ADMIN_EDITOR_EMAILS)
  }

  return parseAdminEmailList(env.ADMIN_OWNER_EMAILS)
}

export function getConfiguredAdminEmails(env: AdminAccessEnv = process.env): string[] {
  return [...new Set([...getAllowedAdminEmails(env), ...getRoleScopedEmails('viewer', env), ...getRoleScopedEmails('editor', env), ...getRoleScopedEmails('owner', env)])]
}

export function getDefaultAdminRole(env: AdminAccessEnv = process.env): AdminRole {
  const rawValue = env.ADMIN_DEFAULT_ROLE?.trim()
  if (rawValue === 'viewer' || rawValue === 'editor' || rawValue === 'owner') {
    return rawValue
  }

  // Preserve phase 1 admin behavior until explicit role envs are supplied.
  return 'owner'
}

export function resolveAdminRole(email: string | null | undefined, env: AdminAccessEnv = process.env): AdminRole | null {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) {
    return null
  }

  if (getRoleScopedEmails('owner', env).includes(normalizedEmail)) {
    return 'owner'
  }

  if (getRoleScopedEmails('editor', env).includes(normalizedEmail)) {
    return 'editor'
  }

  if (getRoleScopedEmails('viewer', env).includes(normalizedEmail)) {
    return 'viewer'
  }

  if (getAllowedAdminEmails(env).includes(normalizedEmail)) {
    return getDefaultAdminRole(env)
  }

  return null
}

export function isAllowedAdminEmail(email: string | null | undefined, env: AdminAccessEnv = process.env): boolean {
  return resolveAdminRole(email, env) !== null
}

export function getAdminSessionRole(session: AdminSessionLike | null | undefined): AdminRole | null {
  const sessionRole = session?.user?.role
  if (sessionRole === 'viewer' || sessionRole === 'editor' || sessionRole === 'owner') {
    return sessionRole
  }

  if (session?.user?.isAdmin === true) {
    return 'owner'
  }

  return null
}

export function hasAdminCapabilityForSession(
  session: AdminSessionLike | null | undefined,
  capability: AdminCapability,
): boolean {
  const role = getAdminSessionRole(session)
  return role ? hasAdminCapability(role, capability) : false
}

export function hasAdminSessionAccess(session: AdminSessionLike | null | undefined): boolean {
  return getAdminSessionRole(session) !== null
}

export function getConfiguredAdminCount(env: AdminAccessEnv = process.env): number {
  return getConfiguredAdminEmails(env).length
}

export function getRequiredCapabilityError(
  session: AdminSessionLike | null | undefined,
  capability: AdminCapability,
): 'unauthorized' | 'forbidden' | 'insufficient-role' | null {
  const sessionStatus = getAdminSessionStatus(session)
  if (sessionStatus === 'unauthorized') {
    return 'unauthorized'
  }

  if (sessionStatus === 'forbidden') {
    return 'forbidden'
  }

  return hasAdminCapabilityForSession(session, capability) ? null : 'insufficient-role'
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
