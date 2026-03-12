import { auth, signIn, signOut } from '@/auth'
import { getAllowedAdminEmails, hasAdminSessionAccess, isAdminAuthConfigured } from '@/lib/admin-access'
import { redirect } from 'next/navigation'

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: '허용되지 않은 관리자 계정입니다. allowlist를 확인하세요.',
  Configuration: 'Auth.js 설정이 완료되지 않았습니다. 환경 변수를 확인하세요.',
  Default: '로그인 중 문제가 발생했습니다. 설정을 확인한 뒤 다시 시도하세요.',
}

function resolveErrorMessage(error: string | string[] | undefined): string | null {
  if (!error) {
    return null
  }

  const key = Array.isArray(error) ? error[0] : error
  if (!key) {
    return null
  }

  return ERROR_MESSAGES[key] ?? ERROR_MESSAGES.Default
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await auth()
  if (hasAdminSessionAccess(session)) {
    redirect('/admin')
  }

  const resolvedSearchParams = (await searchParams) ?? {}
  const errorMessage = resolveErrorMessage(resolvedSearchParams.error)
  const authConfigured = isAdminAuthConfigured()
  const allowedAdminCount = getAllowedAdminEmails().length

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full rounded-[32px] border border-slate-200 bg-white p-7 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Admin Access</p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">운영 화면 로그인</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          관리자 allowlist에 등록된 Google 계정만 접근할 수 있습니다.
        </p>

        {errorMessage ? (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        {!authConfigured ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`가 아직 설정되지 않았습니다.
          </div>
        ) : null}

        {allowedAdminCount === 0 ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            `ADMIN_ALLOWED_EMAILS`가 비어 있습니다. 현재는 어떤 계정도 admin에 들어갈 수 없습니다.
          </div>
        ) : null}

        {session?.user && !session.user.isAdmin ? (
          <form
            action={async () => {
              'use server'
              await signOut({ redirectTo: '/admin/login' })
            }}
            className="mt-6"
          >
            <button
              type="submit"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              다른 계정으로 다시 로그인
            </button>
          </form>
        ) : (
          <form
            action={async () => {
              'use server'
              await signIn('google', { redirectTo: '/admin' })
            }}
            className="mt-6"
          >
            <button
              type="submit"
              disabled={!authConfigured || allowedAdminCount === 0}
              className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Google 계정으로 로그인
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
