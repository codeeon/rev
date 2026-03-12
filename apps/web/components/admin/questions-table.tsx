import type { EngineQuestion } from '@workspace/time-inference'

interface QuestionsTableProps {
  questions: EngineQuestion[]
}

export function QuestionsTable({ questions }: QuestionsTableProps) {
  if (questions.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-sm text-slate-500">
        조회된 질문이 없습니다.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">질문 ID</th>
            <th className="px-4 py-3">역할</th>
            <th className="px-4 py-3">카테고리</th>
            <th className="px-4 py-3">가중치</th>
            <th className="px-4 py-3">옵션 수</th>
            <th className="px-4 py-3">질문</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {questions.map(question => (
            <tr key={question.id}>
              <td className="px-4 py-3 align-top font-medium">{question.id}</td>
              <td className="px-4 py-3 align-top">{question.structure_role}</td>
              <td className="px-4 py-3 align-top">{question.category}</td>
              <td className="px-4 py-3 align-top">{question.question_weight}</td>
              <td className="px-4 py-3 align-top">{question.options.length}</td>
              <td className="px-4 py-3 align-top">{question.text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
