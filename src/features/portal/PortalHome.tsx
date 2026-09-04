import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, CalendarCheck, ChevronLeft, ReceiptText, Sparkles } from 'lucide-react'
import { Badge, Card, EmptyState, ListSkeleton, Progress } from '@/components/ui'
import { useAuth } from '@/store/auth'
import { useSettings } from '@/store/settings'
import { useCharges, useCycles, useLookups, useStudentAttendance, useStudentSubjects, computeFinance } from '@/lib/hooks'
import { fmtMoney } from '@/lib/format'

export default function PortalHome() {
  const { student } = useAuth()
  const { settings } = useSettings()
  const id = student?.id
  const { data: charges = [], isLoading } = useCharges(id)
  const { data: ss = [] } = useStudentSubjects(id)
  const { data: cycles = [] } = useCycles(id)
  const { data: attendance = [] } = useStudentAttendance(id)
  const { yearName, groupName, subjectById } = useLookups()

  const fin = useMemo(() => computeFinance(charges), [charges])
  const att = useMemo(
    () => ({
      present: attendance.filter((a) => a.status === 'present').length,
      absent: attendance.filter((a) => a.status === 'absent').length,
      late: attendance.filter((a) => a.status === 'late').length,
    }),
    [attendance],
  )

  if (!student) return <ListSkeleton rows={3} />

  const firstName = student.full_name.split(' ')[0]

  return (
    <div className="space-y-4">
      <div className="animate-fade-up">
        <h1 className="text-xl font-extrabold text-ink">أهلًا بك، {firstName} 👋</h1>
        <p className="mt-1 text-[13px] text-ink-2">
          {student.year_id ? yearName.get(student.year_id) : ''}
          {student.group_id ? ` · ${groupName.get(student.group_id)}` : ''}
        </p>
      </div>

      {/* ============ المستحق ============ */}
      <Card
        className="animate-fade-up overflow-hidden p-5 text-center"
        style={{
          background: fin.outstanding > 0
            ? 'color-mix(in oklab, var(--danger) 10%, var(--surface))'
            : 'color-mix(in oklab, var(--success) 10%, var(--surface))',
        }}
      >
        <p className="text-[13px] font-semibold text-ink-2">المستحق عليك حاليًا</p>
        <p className={`num mt-1.5 text-[34px] font-extrabold leading-tight ${fin.outstanding > 0 ? 'text-danger' : 'text-success'}`}>
          {fmtMoney(fin.outstanding, settings.currency_symbol)}
        </p>
        {fin.outstanding === 0 && (
          <p className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-semibold text-success">
            <Sparkles className="size-4" /> حسابك خالص — شكرًا لك
          </p>
        )}
      </Card>

      {/* ============ البنود غير المدفوعة ============ */}
      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : fin.unpaid.length > 0 ? (
        <Card>
          <div className="flex items-center justify-between border-b border-line p-4">
            <p className="text-[14px] font-bold text-ink">البنود غير المدفوعة</p>
            <Link to="/portal/finance" className="inline-flex items-center text-[12.5px] font-semibold text-[var(--brand)]">
              التفاصيل <ChevronLeft className="size-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {fin.unpaid.slice(0, 5).map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-3.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-2">
                  <ReceiptText className="size-4" />
                </span>
                <p className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink">{c.title}</p>
                <span className="num text-[13.5px] font-bold text-danger">
                  {fmtMoney(Number(c.amount) - Number(c.paid_amount), settings.currency_symbol)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {/* ============ الحصص ============ */}
      {settings.student_can_view_attendance && (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[14px] font-bold text-ink">الحصص</p>
            <Link to="/portal/attendance" className="inline-flex items-center text-[12.5px] font-semibold text-[var(--brand)]">
              الكل <ChevronLeft className="size-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-xl bg-success-bg p-3 text-center">
              <p className="num text-xl font-extrabold text-success">{att.present}</p>
              <p className="text-[11.5px] text-success">حاضر</p>
            </div>
            <div className="rounded-xl bg-danger-bg p-3 text-center">
              <p className="num text-xl font-extrabold text-danger">{att.absent}</p>
              <p className="text-[11.5px] text-danger">غائب</p>
            </div>
            <div className="rounded-xl bg-warning-bg p-3 text-center">
              <p className="num text-xl font-extrabold text-warning">{att.late}</p>
              <p className="text-[11.5px] text-warning">متأخر</p>
            </div>
          </div>
        </Card>
      )}

      {/* ============ المواد ============ */}
      <Card>
        <div className="border-b border-line p-4">
          <p className="text-[14px] font-bold text-ink">المواد المسجّل بها</p>
        </div>
        {ss.length === 0 ? (
          <EmptyState icon={BookOpen} title="غير مسجّل في مواد بعد" className="py-8" />
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {ss.map((row) => {
              const subj = subjectById.get(row.subject_id)
              const open = cycles.find((c) => c.subject_id === row.subject_id && c.status === 'open')
              return (
                <div key={row.id} className="p-3.5">
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in oklab, ${subj?.color || '#2563eb'} 14%, transparent)`, color: subj?.color || '#2563eb' }}>
                      <BookOpen className="size-4" />
                    </span>
                    <p className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-ink">{subj?.name ?? 'مادة'}</p>
                    {open && <Badge tone="neutral" className="num">{open.sessions_done} / {open.sessions_target}</Badge>}
                  </div>
                  {open && (
                    <div className="mt-2">
                      <Progress value={(open.sessions_done / open.sessions_target) * 100} />
                      <p className="num mt-1.5 text-[11.5px] text-muted">
                        المتبقي في الدورة الحالية: {Math.max(0, open.sessions_target - open.sessions_done)} حصص
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
