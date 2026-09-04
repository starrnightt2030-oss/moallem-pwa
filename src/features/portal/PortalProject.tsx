import { useMemo } from 'react'
import { FolderKanban } from 'lucide-react'
import { Card, EmptyState, ListSkeleton, Progress } from '@/components/ui'
import { QuestionBadge } from '@/components/common/Status'
import { useAuth } from '@/store/auth'
import { useEnrollments, useProgress, useProjects, useQuestions } from '@/lib/hooks'
import { fmtDate } from '@/lib/format'

export default function PortalProject() {
  const { student } = useAuth()
  const { data: enrollments = [], isLoading } = useEnrollments()
  const { data: projects = [] } = useProjects()
  const mine = useMemo(() => enrollments.filter((e) => e.student_id === student?.id), [enrollments, student])
  const projectId = mine[0]?.project_id
  const project = projects.find((p) => p.id === projectId)
  const { data: questions = [] } = useQuestions(projectId)
  const { data: progress = [] } = useProgress({ studentId: student?.id })

  const byQ = useMemo(() => new Map(progress.map((p) => [p.question_id, p])), [progress])
  const done = questions.filter((q) => byQ.get(q.id)?.status === 'completed').length

  if (isLoading) return <ListSkeleton rows={4} />

  if (!project) {
    return (
      <Card>
        <EmptyState icon={FolderKanban} title="لست مسجّلًا في مشروع" description="مشاريع التخرج تظهر هنا عند تسجيلك فيها." />
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-ink">{project.title}</h1>
        {project.description && <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-ink-2">{project.description}</p>}
      </div>

      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px] font-semibold text-ink-2">التقدّم</span>
          <span className="num text-[15px] font-extrabold text-ink">{done} / {questions.length}</span>
        </div>
        <Progress value={questions.length ? (done / questions.length) * 100 : 0} tone={done === questions.length && questions.length > 0 ? 'success' : 'brand'} />
      </Card>

      {questions.length === 0 ? (
        <Card><EmptyState icon={FolderKanban} title="لم تُضف أسئلة بعد" /></Card>
      ) : (
        <Card className="divide-y divide-[var(--border)]">
          {questions.map((q) => {
            const p = byQ.get(q.id)
            return (
              <div key={q.id} className="flex items-start gap-3 p-3.5">
                <span className="num grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-[12px] font-bold text-ink-2">{q.idx}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-bold text-ink">{q.title}</p>
                  {q.description && <p className="mt-0.5 text-[12px] leading-relaxed text-ink-2">{q.description}</p>}
                  {p?.completed_at && <p className="mt-0.5 text-[11.5px] text-muted">اكتمل في {fmtDate(p.completed_at)}</p>}
                  {p?.notes && <p className="mt-1 rounded-lg bg-surface-2 p-2 text-[12px] text-ink-2">{p.notes}</p>}
                </div>
                <QuestionBadge status={p?.status ?? 'not_started'} />
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}
