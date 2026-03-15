import Link from 'next/link'
import { DistributionCard } from '@/components/admin/distribution-card'
import { AdminStatCard } from '@/components/admin/stat-card'
import { buildAdminAnalyticsSummaryResponse } from '@/lib/admin-contracts'
import { listAdminResultsFromSpreadsheet, syncQuestionsFromSpreadsheet } from '@workspace/spreadsheet-admin/server'

function formatNullableMetric(value: number | null, suffix = ''): string {
  if (value === null) {
    return '-'
  }

  return `${value.toFixed(1)}${suffix}`
}

export default async function AdminAnalyticsPage() {
  try {
    const [resultsPayload, questionPayload] = await Promise.all([
      listAdminResultsFromSpreadsheet({ limit: 100 }),
      syncQuestionsFromSpreadsheet(),
    ])
    const summary = buildAdminAnalyticsSummaryResponse(resultsPayload, questionPayload)

    return (
      <div className="space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Analytics</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">운영 대시보드</h2>
              <p className="mt-2 text-sm text-slate-600">
                최근 최대 {summary.sampleLimit}건의 결과와 현재 published 질문 세트를 기준으로 핵심 분포를 먼저 보여줍니다.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-100 px-4 py-3 text-right text-xs text-slate-600">
              <div>현재 질문 version</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{summary.currentQuestionVersion}</div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-600">
            <Link
              className="rounded-full border border-slate-300 px-3 py-1.5 font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              href={`/admin/results?questionVersion=${encodeURIComponent(summary.currentQuestionVersion)}`}
            >
              현재 version 결과 보기
            </Link>
            <Link
              className="rounded-full border border-slate-300 px-3 py-1.5 font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              href={`/admin/questions/${encodeURIComponent(summary.currentQuestionVersion)}`}
            >
              질문 version 상세
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <AdminStatCard label="Sample" value={String(summary.kpis.sampleSize)} detail="최근 조회 window 기준" />
          <AdminStatCard label="Last 7d" value={String(summary.kpis.last7dCount)} detail="현재 시각 기준 7일 이내" />
          <AdminStatCard label="Last 30d" value={String(summary.kpis.last30dCount)} detail="현재 시각 기준 30일 이내" />
          <AdminStatCard label="Feedback" value={`${summary.kpis.feedbackRate.toFixed(1)}%`} detail={`평균 평점 ${formatNullableMetric(summary.kpis.averageRating)}`} />
          <AdminStatCard
            label="Published Set"
            value={String(summary.questionSetSummary.totalQuestions)}
            detail={`${summary.currentQuestionVersion} 결과 ${summary.currentVersionResultCount}건`}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <DistributionCard
            title="questionVersion 분포"
            description={`마지막 결과 시각 ${summary.kpis.latestResultAt ?? '없음'}`}
            items={summary.distributions.questionVersion}
          />
          <DistributionCard
            title="birthTimeKnowledge 분포"
            description="사용자가 생시를 어느 수준으로 알고 있는지의 분포입니다."
            items={summary.distributions.birthTimeKnowledge}
          />
          <DistributionCard
            title="confidence 분포"
            description="신뢰도를 4개 구간으로 묶어 빠르게 확인합니다."
            items={summary.distributions.confidence}
          />
          <DistributionCard
            title="추론 결과 분포"
            description={`평균 accuracy ${formatNullableMetric(summary.kpis.averageAccuracy, '')}`}
            items={summary.distributions.inferredZishi}
          />
        </div>
      </div>
    )
  } catch (error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-6 text-sm text-rose-700">
        통계 대시보드를 읽지 못했습니다. {error instanceof Error ? error.message : 'Unknown analytics load error'}
      </div>
    )
  }
}
