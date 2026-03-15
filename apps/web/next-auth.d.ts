import type { DefaultSession } from 'next-auth'
import type { AdminRole } from '@/lib/admin-roles'

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      isAdmin: boolean
      role?: AdminRole
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    isAdmin?: boolean
    role?: AdminRole
  }
}
