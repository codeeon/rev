import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getAdminSessionRole, getAdminSessionStatus } from '@/lib/admin-access'
import { AdminShell } from '@/components/admin/admin-shell'

export default async function AdminProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await auth()
  const sessionStatus = getAdminSessionStatus(session)

  if (sessionStatus === 'unauthorized') {
    redirect('/admin/login')
  }

  if (sessionStatus === 'forbidden') {
    redirect('/admin/login?error=AccessDenied')
  }

  return (
    <AdminShell userEmail={session?.user?.email ?? 'unknown'} userRole={getAdminSessionRole(session)}>
      {children}
    </AdminShell>
  )
}
