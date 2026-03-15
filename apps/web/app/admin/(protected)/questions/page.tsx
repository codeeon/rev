import Link from 'next/link'
import { QuestionsTable } from '@/components/admin/questions-table'
import { DistributionCard } from '@/components/admin/distribution-card'
import { AdminStatCard } from '@/components/admin/stat-card'
import { summarizeQuestionSet } from '@/lib/admin-insights'
import { syncQuestionsFromSpreadsheet } from '@workspace/spreadsheet-admin/server'

export default async function AdminQuestionsPage() {
  try {
    const payload = await syncQuestionsFromSpreadsheet()
    const summary = summarizeQuestionSet(payload.questions)

    return (
      <div className="space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">질문 조회</h2>
              <p className="mt-2 text-sm text-slate-600">
                운영 스프레드시트에서 읽은 현재 질문 세트를 그대로 보여줍니다.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-100 px-4 py-3 text-right text-xs text-slate-600">
              <div>{payload.source}</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{payload.questionVersion}</div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-600">
            <span className="rounded-full bg-slate-100 px-3 py-1.5">질문 수 {payload.questions.length}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5">옵션 수 {summary.totalOptions}</span>
            <Link
              className="rounded-full border border-slate-300 px-3 py-1.5 font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              href={`/admin/questions/${encodeURIComponent(payload.questionVersion)}`}
            >
              버전 상세
            </Link>
            <Link
              className="rounded-full border border-slate-300 px-3 py-1.5 font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              href={`/admin/questions/${encodeURIComponent(payload.questionVersion)}/edit`}
            >
              편집 골격
            </Link>
            <Link
              className="rounded-full border border-slate-300 px-3 py-1.5 font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              href="/admin/questions/publish"
            >
              publish 확인
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AdminStatCard label="Questions" value={String(summary.totalQuestions)} detail="현재 published set 기준" />
          <AdminStatCard label="Options" value={String(summary.totalOptions)} detail={`질문당 평균 ${summary.averageOptionsPerQuestion.toFixed(1)}개`} />
          <AdminStatCard label="Roles" value={String(summary.roleDistribution.length)} detail={summary.missingRoles.length > 0 ? `누락 ${summary.missingRoles.join(', ')}` : '필수 role 모두 포함'} />
          <AdminStatCard label="Weight" value={summary.totalWeight.toFixed(1)} detail={`평균 ${summary.averageWeight.toFixed(1)}`} />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <DistributionCard
            title="Role 분포"
            description="현재 질문 세트의 structure role 구성입니다."
            items={summary.roleDistribution}
          />
          <DistributionCard
            title="Category 분포"
            description="편집 우선순위를 잡을 때 기준으로 삼을 category 묶음입니다."
            items={summary.categoryDistribution}
          />
        </div>

        <QuestionsTable questions={payload.questions} />
      </div>
    )
  } catch (error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-6 text-sm text-rose-700">
        질문 시트를 읽지 못했습니다. {error instanceof Error ? error.message : 'Unknown question sync error'}
      </div>
    )
  }
}
