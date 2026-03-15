import Link from 'next/link'
import { DistributionCard } from '@/components/admin/distribution-card'
import { QuestionsTable } from '@/components/admin/questions-table'
import { AdminStatCard } from '@/components/admin/stat-card'
import { summarizeQuestionSet } from '@/lib/admin-insights'
import { syncQuestionsFromSpreadsheet } from '@workspace/spreadsheet-admin/server'

export default async function AdminQuestionVersionDetailPage({
  params,
}: {
  params: Promise<{ version: string }>
}) {
  const { version } = await params

  try {
    const payload = await syncQuestionsFromSpreadsheet()
    const summary = summarizeQuestionSet(payload.questions)
    const isCurrentVersion = version === payload.questionVersion

    return (
      <div className="space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Question Version</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">{version}</h2>
              <p className="mt-2 text-sm text-slate-600">
                현재 구조에서는 published 질문 세트 1개만 유지합니다. 이 화면은 version 상세와 이후 draft/edit 흐름의 기준 정보를 보여줍니다.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-100 px-4 py-3 text-right text-xs text-slate-600">
              <div>질문 source</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{payload.source}</div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-600">
            <Link
              className="rounded-full border border-slate-300 px-3 py-1.5 font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              href={`/admin/questions/${encodeURIComponent(payload.questionVersion)}/edit`}
            >
              draft 편집 골격
            </Link>
            <Link
              className="rounded-full border border-slate-300 px-3 py-1.5 font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              href="/admin/questions/publish"
            >
              publish 확인
            </Link>
          </div>
        </div>

        {!isCurrentVersion ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-6 text-sm text-amber-800">
            요청한 version은 아직 별도 저장소가 없습니다. 현재 조회 가능한 published version은{' '}
            <Link className="font-semibold underline" href={`/admin/questions/${encodeURIComponent(payload.questionVersion)}`}>
              {payload.questionVersion}
            </Link>
            입니다.
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AdminStatCard label="Questions" value={String(summary.totalQuestions)} detail="현재 published set" />
          <AdminStatCard label="Options" value={String(summary.totalOptions)} detail={`질문당 평균 ${summary.averageOptionsPerQuestion.toFixed(1)}개`} />
          <AdminStatCard
            label="Roles"
            value={String(summary.roleDistribution.length)}
            detail={summary.missingRoles.length > 0 ? `누락 ${summary.missingRoles.join(', ')}` : '필수 role 모두 충족'}
          />
          <AdminStatCard label="Weight" value={summary.totalWeight.toFixed(1)} detail={`상위 가중치 ${summary.heaviestQuestionIds.join(', ') || '-'}`} />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <DistributionCard title="Role 분포" description="version 구조가 균형을 갖추고 있는지 확인합니다." items={summary.roleDistribution} />
          <DistributionCard title="Category 분포" description="category별 질문 비중을 먼저 확인합니다." items={summary.categoryDistribution} />
        </div>

        <QuestionsTable questions={payload.questions} />
      </div>
    )
  } catch (error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-6 text-sm text-rose-700">
        질문 version 상세를 읽지 못했습니다. {error instanceof Error ? error.message : 'Unknown question version load error'}
      </div>
    )
  }
}
