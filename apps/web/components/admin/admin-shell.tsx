import type { AdminRole } from '@/lib/admin-roles'
import Link from 'next/link'
import { signOut } from '@/auth'

interface AdminShellProps {
  userEmail: string
  userRole: AdminRole | null
  children: React.ReactNode
}

export function AdminShell({ userEmail, userRole, children }: AdminShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Admin</p>
            <h1 className="text-lg font-semibold text-slate-900">역사주 운영 화면</h1>
          </div>
          <form
            action={async () => {
              'use server'
              await signOut({ redirectTo: '/admin/login' })
            }}
          >
            <button
              type="submit"
              className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              로그아웃
            </button>
          </form>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
          <nav className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <Link className="rounded-full px-3 py-1.5 hover:bg-slate-100 hover:text-slate-900" href="/admin/analytics">
              대시보드
            </Link>
            <Link className="rounded-full px-3 py-1.5 hover:bg-slate-100 hover:text-slate-900" href="/admin/results">
              결과 조회
            </Link>
            <Link className="rounded-full px-3 py-1.5 hover:bg-slate-100 hover:text-slate-900" href="/admin/questions">
              질문 조회
            </Link>
            {userRole === 'owner' ? (
              <>
                <Link className="rounded-full px-3 py-1.5 hover:bg-slate-100 hover:text-slate-900" href="/admin/approvals">
                  승인 기록
                </Link>
                <Link className="rounded-full px-3 py-1.5 hover:bg-slate-100 hover:text-slate-900" href="/admin/audit">
                  감사 로그
                </Link>
              </>
            ) : null}
          </nav>
          <p className="text-xs text-slate-500">
            {userEmail}
            {userRole ? ` · ${userRole}` : ''}
          </p>
        </div>
      </header>
      <div className="flex-1 px-4 py-5">{children}</div>
    </div>
  )
}
