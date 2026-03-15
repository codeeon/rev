import type { NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'
import { resolveAdminRole } from '@/lib/admin-access'

const googleProvider =
  process.env.AUTH_GOOGLE_ID?.trim() && process.env.AUTH_GOOGLE_SECRET?.trim()
    ? [
        Google({
          clientId: process.env.AUTH_GOOGLE_ID,
          clientSecret: process.env.AUTH_GOOGLE_SECRET,
        }),
      ]
    : []

export default {
  providers: googleProvider,
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/admin/login',
    error: '/admin/login',
  },
  callbacks: {
    async signIn({ user }) {
      return resolveAdminRole(user.email) !== null
    },
    async jwt({ token, user }) {
      const email = typeof user?.email === 'string' ? user.email : token.email
      token.email = email
      const role = resolveAdminRole(email)
      token.role = role ?? undefined
      token.isAdmin = role !== null
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = typeof token.email === 'string' ? token.email : session.user.email
        session.user.isAdmin = token.isAdmin === true
        session.user.role = token.role === 'viewer' || token.role === 'editor' || token.role === 'owner' ? token.role : undefined
      }

      return session
    },
  },
} satisfies NextAuthConfig
