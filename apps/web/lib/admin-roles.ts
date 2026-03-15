export const ADMIN_ROLES = ['viewer', 'editor', 'owner'] as const
export const ADMIN_CAPABILITIES = [
  'analytics.read',
  'results.read',
  'questions.read',
  'questions.edit',
  'questions.publish',
  'roles.manage',
] as const

export type AdminRole = (typeof ADMIN_ROLES)[number]
export type AdminCapability = (typeof ADMIN_CAPABILITIES)[number]

export interface AdminRoleMatrixRow {
  role: AdminRole
  capabilities: AdminCapability[]
  pages: string[]
  apis: string[]
}

export const ADMIN_ROLE_MATRIX: AdminRoleMatrixRow[] = [
  {
    role: 'viewer',
    capabilities: ['analytics.read', 'results.read', 'questions.read'],
    pages: ['/admin/analytics', '/admin/results', '/admin/questions', '/admin/questions/[version]'],
    apis: ['/api/admin/analytics/summary', '/api/admin/results', '/api/admin/results/[sessionId]', '/api/admin/questions'],
  },
  {
    role: 'editor',
    capabilities: ['analytics.read', 'results.read', 'questions.read', 'questions.edit'],
    pages: [
      '/admin/analytics',
      '/admin/results',
      '/admin/questions',
      '/admin/questions/[version]',
      '/admin/questions/[version]/edit',
    ],
    apis: [
      '/api/admin/analytics/summary',
      '/api/admin/results',
      '/api/admin/results/[sessionId]',
      '/api/admin/questions',
      '/api/admin/questions/publish-preview',
      '/api/admin/questions/drafts/[draftId]/approval-requests',
    ],
  },
  {
    role: 'owner',
    capabilities: [
      'analytics.read',
      'results.read',
      'questions.read',
      'questions.edit',
      'questions.publish',
      'roles.manage',
    ],
    pages: [
      '/admin/analytics',
      '/admin/results',
      '/admin/questions',
      '/admin/questions/[version]',
      '/admin/questions/[version]/edit',
      '/admin/questions/publish',
      '/admin/approvals',
      '/admin/audit',
    ],
    apis: [
      '/api/admin/analytics/summary',
      '/api/admin/results',
      '/api/admin/results/[sessionId]',
      '/api/admin/questions',
      '/api/admin/questions/publish-preview',
      '/api/admin/questions/drafts/[draftId]/approval-requests',
      '/api/admin/questions/approval-requests/[requestId]/status',
      '/api/admin/approvals',
      '/api/admin/approvals/[approvalId]/rollback',
      '/api/admin/audit',
    ],
  },
]

export function getAdminRoleMatrix(): AdminRoleMatrixRow[] {
  return ADMIN_ROLE_MATRIX.map(row => ({
    ...row,
    capabilities: [...row.capabilities],
    pages: [...row.pages],
    apis: [...row.apis],
  }))
}

export function hasAdminCapability(role: AdminRole, capability: AdminCapability): boolean {
  const row = ADMIN_ROLE_MATRIX.find(candidate => candidate.role === role)
  return row?.capabilities.includes(capability) ?? false
}
