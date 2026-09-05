import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import {
  ArrowRight, ListChecks, Plus, Trash2, Users, Pencil, ReceiptText, UserPlus,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { QuestionBadge, QUESTION_LABEL } from '@/components/common/Status'
import {
  Avatar, Badge, Button, Card, EmptyState, Field, Input, Modal, PageLoader, Progress,
  Select, Textarea, useConfirm, Checkbox,
} from '@/components/ui'
import { SearchInput } from '@/components/common/SearchInput'
import { ChargeDialog } from '@/features/finance/dialogs'
import { useAction, useEnrollments, useLookups, useProgress, useProjects, useQuestions, useStudents } from '@/lib/hooks'
import * as api from '@/lib/api'
import type { ProjectQuestion, QuestionStatus } from '@/lib/database.types'
import { matches } from '@/lib/utils'
import { fmtDate, todayISO } from '@/lib/format'

export default function ProjectDetailPage() {
  const { id } = useParams()
  const { data: projects = [], isLoading } = useProjects()
  const project = projects.find((p) => p.id === id)
  const { data: questions = [] } = useQuestions(id)
  const { data: enrollments = [] } = useEnrollments(id)
  const { data: students = [] } = useStudents()
  const { yearName } = useLookups()
  const confirm = useConfirm()

  const questionIds = useMemo(() => questions.map((q) => q.id), [questions])
  const { data: progress = [] } = useProgress({ questionIds })

  const [tab, setTab] = useState('students')
  const [qOpen, setQOpen] = useState(false)
  const [editQ, setEditQ] = useState<ProjectQuestion | null>(null)
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [chargeOpen, setChargeOpen] = useState(false)
  const [tracking, setTracking] = useState<string | null>(null)

  const enrolled = useMemo(() => {
    const ids = new Set(enrollments.map((e) => e.student_id))
    return students.filter((s) => ids.has(s.id))
  }, [enrollments, students])

  const progressByStudent = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of progress) if (p.status === 'completed') m.set(p.student_id, (m.get(p.student_id) ?? 0) + 1)
    return m
  }, [progress])

  const delQ = useAction(api.deleteQuestion, { success: 'تم حذف السؤال', invalidate: [['questions'], ['progress']] })

  if (isLoading) return <PageLoader />
  if (!project) return <EmptyState title="المشروع غير موجود" />

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild className="-mr-2">
        <Link to="/projects"><ArrowRight className="size-4" /> كل المشاريع</Link>
      </Button>

      <PageHeader
        title={project.title}
        subtitle={
          <>
            {project.year_id ? `${yearName.get(project.year_id)} · ` : ''}
            <span className="num">{questions.length}</span> سؤال · <span className="num">{enrolled.length}</span> طالب
          </>
        }
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setChargeOpen(true)}>
              <ReceiptText className="size-4" /> تكاليف المشروع
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setEnrollOpen(true)}>
              <UserPlus className="size-4" /> تسجيل طلاب
            </Button>
            <Button size="sm" onClick={() => { setEditQ(null); setQOpen(true) }}>
              <Plus className="size-4" /> سؤال
            </Button>
          </>
        }
      />

      {project.description && (
        <Card className="p-4">
          <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-ink-2">{project.description}</p>
        </Card>
      )}

      <TabsPrimitive.Root value={tab} onValueChange={setTab}>
        <TabsPrimitive.List className="mb-4 flex gap-1 rounded-xl border border-line bg-surface p-1">
          {[
            { v: 'students', label: 'الطلاب', Icon: Users },
            { v: 'questions', label: 'الأسئلة', Icon: ListChecks },
          ].map((t) => (
            <TabsPrimitive.Trigger
              key={t.v}
              value={t.v}
              className="tap flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold text-ink-2 transition data-[state=active]:bg-[color-mix(in_oklab,var(--brand)_13%,transparent)] data-[state=active]:text-[var(--brand)]"
            >
              <t.Icon className="size-4" /> {t.label}
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>

        <TabsPrimitive.Content value="students" className="outline-none">
          {enrolled.length === 0 ? (
            <Card>
              <EmptyState
                icon={Users}
                title="لا يوجد طلاب مسجّلون"
                description="سجّل طلاب الصف الثالث في هذا المشروع لتتابع تقدّمهم."
                action={<Button onClick={() => setEnrollOpen(true)}><UserPlus className="size-4" /> تسجيل طلاب</Button>}
              />
            </Card>
          ) : (
            <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
              {enrolled.map((s) => {
                const done = progressByStudent.get(s.id) ?? 0
                const pct = questions.length ? (done / questions.length) * 100 : 0
                return (
                  <Card key={s.id} className="animate-fade-up p-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={s.full_name} size={40} />
                      <div className="min-w-0 flex-1">
                        <Link to={`/students/${s.id}`} className="truncate text-[14px] font-bold text-ink hover:text-[var(--brand)]">
                          {s.full_name}
                        </Link>
                        <p className="num text-[11.5px] text-muted">{s.code}</p>
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => setTracking(s.id)}>متابعة</Button>
                    </div>
                    <div className="mt-3">
                      <div className="mb-1.5 flex items-center justify-between text-[12px]">
                        <span className="text-ink-2">الأسئلة المكتملة</span>
                        <span className="num font-bold text-ink">{done} / {questions.length}</span>
                      </div>
                      <Progress value={pct} tone={pct >= 100 ? 'success' : 'brand'} />
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsPrimitive.Content>

        <TabsPrimitive.Content value="questions" className="outline-none">
          {questions.length === 0 ? (
            <Card>
              <EmptyState
                icon={ListChecks}
                title="لا توجد أسئلة بعد"
                description="أضف أسئلة/مراحل المشروع ليتم تتبّعها لكل طالب."
                action={<Button onClick={() => { setEditQ(null); setQOpen(true) }}><Plus className="size-4" /> إضافة سؤال</Button>}
              />
            </Card>
          ) : (
            <Card className="divide-y divide-[var(--border)]">
              {questions.map((q) => {
                const done = progress.filter((p) => p.question_id === q.id && p.status === 'completed').length
                return (
                  <div key={q.id} className="flex items-start gap-3 p-3.5">
                    <span className="num grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-[12px] font-bold text-ink-2">{q.idx}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-bold text-ink">{q.title}</p>
                      {q.description && <p className="mt-0.5 text-[12px] leading-relaxed text-ink-2">{q.description}</p>}
                      <p className="num mt-1 text-[11.5px] text-muted">أنجزه {done} من {enrolled.length} طالب</p>
                    </div>
                    <Button variant="ghost" size="iconSm" onClick={() => { setEditQ(q); setQOpen(true) }} aria-label="تعديل">
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="iconSm" aria-label="حذف"
                      onClick={() =>
                        confirm({
                          title: 'حذف السؤال',
                          message: `سيتم حذف «${q.title}» وسجلات تقدّم الطلاب فيه.`,
                          onConfirm: () => delQ.mutateAsync(q.id),
                        })
                      }
                    >
                      <Trash2 className="size-3.5 text-danger" />
                    </Button>
                  </div>
                )
              })}
            </Card>
          )}
        </TabsPrimitive.Content>
      </TabsPrimitive.Root>

      <QuestionForm open={qOpen} onOpenChange={setQOpen} question={editQ} projectId={project.id} nextIdx={questions.length + 1} />
      <EnrollDialog open={enrollOpen} onOpenChange={setEnrollOpen} projectId={project.id} current={enrollments.map((e) => e.student_id)} yearId={project.year_id} />
      <ChargeDialog
        open={chargeOpen}
        onOpenChange={setChargeOpen}
        projectId={project.id}
        projectTitle={project.title}
        projectStudentIds={enrollments.map((e) => e.student_id)}
      />
      <TrackDialog
        studentId={tracking}
        onClose={() => setTracking(null)}
        questions={questions}
        student={enrolled.find((s) => s.id === tracking)}
      />
    </div>
  )
}

/* ------------------------------ نموذج السؤال ------------------------------ */
function QuestionForm({
  open, onOpenChange, question, projectId, nextIdx,
}: {
  open: boolean; onOpenChange: (v: boolean) => void
  question: ProjectQuestion | null; projectId: string; nextIdx: number
}) {
  const [form, setForm] = useState({ idx: '1', title: '', description: '' })

  useEffect(() => {
    if (!open) return
    setForm({
      idx: String(question?.idx ?? nextIdx),
      title: question?.title ?? '',
      description: question?.description ?? '',
    })
  }, [open, question, nextIdx])

  const save = useAction(
    async () => {
      if (!form.title.trim()) throw new Error('عنوان السؤال مطلوب')
      return api.saveQuestion({
        ...(question ? { id: question.id } : {}),
        project_id: projectId,
        idx: Number(form.idx || nextIdx),
        title: form.title.trim(),
        description: form.description.trim() || null,
      })
    },
    { success: 'تم الحفظ ✓', invalidate: [['questions']], onDone: () => onOpenChange(false) },
  )

  return (
    <Modal
      open={open} onOpenChange={onOpenChange} size="sm"
      title={question ? 'تعديل السؤال' : 'سؤال / مرحلة جديدة'}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={() => save.mutate(undefined as never)} loading={save.isPending}>حفظ</Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <Field label="الترتيب">
          <Input dir="ltr" inputMode="numeric" className="num text-right" value={form.idx} onChange={(e) => setForm({ ...form, idx: e.target.value })} />
        </Field>
        <Field label="العنوان" required>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثال: تصميم الدائرة" />
        </Field>
        <Field label="التفاصيل">
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="المتطلبات…" />
        </Field>
      </div>
    </Modal>
  )
}

/* ------------------------------ تسجيل الطلاب ------------------------------ */
function EnrollDialog({
  open, onOpenChange, projectId, current, yearId,
}: {
  open: boolean; onOpenChange: (v: boolean) => void
  projectId: string; current: string[]; yearId: string | null
}) {
  const { data: students = [] } = useStudents()
  const [picked, setPicked] = useState<string[]>([])
  const [q, setQ] = useState('')

  useEffect(() => {
    if (open) { setPicked(current); setQ('') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const list = useMemo(
    () => students.filter((s) => s.status === 'active' && (!yearId || s.year_id === yearId) && matches(`${s.full_name} ${s.code}`, q)),
    [students, yearId, q],
  )

  const save = useAction(async () => api.setEnrollments(projectId, picked), {
    success: 'تم تحديث تسجيل الطلاب ✓',
    invalidate: [['enrollments'], ['progress']],
    onDone: () => onOpenChange(false),
  })

  return (
    <Modal
      open={open} onOpenChange={onOpenChange}
      title="تسجيل الطلاب في المشروع"
      description={`${picked.length} طالب محدد`}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={() => save.mutate(undefined as never)} loading={save.isPending}>حفظ</Button>
        </>
      }
    >
      <div className="space-y-3">
        <SearchInput value={q} onChange={setQ} placeholder="ابحث عن طالب…" />
        <button
          className="text-[12.5px] font-semibold text-[var(--brand)]"
          onClick={() => setPicked(picked.length === list.length ? [] : list.map((s) => s.id))}
        >
          {picked.length === list.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
        </button>
        <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
          {list.map((s) => (
            <label key={s.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg p-2 hover:bg-surface-2">
              <Checkbox
                checked={picked.includes(s.id)}
                onCheckedChange={() => setPicked(picked.includes(s.id) ? picked.filter((x) => x !== s.id) : [...picked, s.id])}
              />
              <span className="text-[13px] font-medium text-ink">{s.full_name}</span>
              <span className="num mr-auto text-[11px] text-muted">{s.code}</span>
            </label>
          ))}
        </div>
      </div>
    </Modal>
  )
}

/* --------------------------- متابعة تقدّم الطالب --------------------------- */
function TrackDialog({
  studentId, onClose, questions, student,
}: {
  studentId: string | null
  onClose: () => void
  questions: ProjectQuestion[]
  student?: { full_name: string; code: string }
}) {
  const { data: progress = [] } = useProgress({ studentId: studentId ?? undefined })
  const byQ = useMemo(() => new Map(progress.map((p) => [p.question_id, p])), [progress])

  const update = useAction(
    ({ questionId, status, notes, grade }: { questionId: string; status: QuestionStatus; notes?: string | null; grade?: number | null }) =>
      api.saveProgress({
        student_id: studentId!,
        question_id: questionId,
        status,
        notes: notes ?? null,
        grade: grade ?? null,
        completed_at: status === 'completed' ? todayISO() : null,
      }),
    { invalidate: [['progress']] },
  )

  const done = progress.filter((p) => p.status === 'completed').length

  return (
    <Modal
      open={!!studentId} onOpenChange={(v) => !v && onClose()}
      title={student ? `متابعة: ${student.full_name}` : 'متابعة الطالب'}
      description={`${done} من ${questions.length} أسئلة مكتملة`}
      size="lg"
      footer={<Button onClick={onClose} block>تم</Button>}
    >
      <div className="space-y-2.5">
        <Progress value={questions.length ? (done / questions.length) * 100 : 0} tone={done === questions.length && questions.length > 0 ? 'success' : 'brand'} />
        {questions.map((q) => {
          const p = byQ.get(q.id)
          return (
            <div key={q.id} className="rounded-xl border border-line p-3">
              <div className="flex items-start gap-2.5">
                <span className="num grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-[11.5px] font-bold text-ink-2">{q.idx}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-ink">{q.title}</p>
                  {p?.completed_at && <p className="text-[11px] text-muted">اكتمل في {fmtDate(p.completed_at)}</p>}
                </div>
                <QuestionBadge status={p?.status ?? 'not_started'} />
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {(Object.keys(QUESTION_LABEL) as QuestionStatus[]).map((st) => (
                  <button
                    key={st}
                    onClick={() => update.mutate({ questionId: q.id, status: st, notes: p?.notes, grade: p?.grade })}
                    className={`tap rounded-lg border px-2 py-1.5 text-[11.5px] font-semibold transition ${
                      (p?.status ?? 'not_started') === st
                        ? 'border-[var(--brand)] bg-[color-mix(in_oklab,var(--brand)_10%,transparent)] text-[var(--brand)]'
                        : 'border-line text-ink-2 hover:bg-surface-2'
                    }`}
                  >
                    {QUESTION_LABEL[st]}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
