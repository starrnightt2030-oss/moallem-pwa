import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import {
  ArrowRight, BookOpen, CalendarCheck, Copy, FileText, FolderKanban, KeyRound,
  MessageSquare, Pencil, Phone, Plus, ReceiptText, Trash2, TrendingUp, Wallet, ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Avatar, Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, KeyValue,
  Modal, PageLoader, Progress, Field, Input, useConfirm,
} from '@/components/ui'
import { Money } from '@/components/common/Money'
import { AttendanceBadge, ChargeBadge, PAYMENT_METHOD_LABEL, QuestionBadge, StudentStatusBadge } from '@/components/common/Status'
import { StudentForm } from './StudentForm'
import { PaymentDialog, ChargeDialog } from '@/features/finance/dialogs'
import {
  useAction, useCharges, useCycles, useLookups, usePayments, useProgress,
  useStudent, useStudentAttendance, useStudentSubjects, computeFinance,
} from '@/lib/hooks'
import * as api from '@/lib/api'
import { createStudentAccount, resetStudentPin } from '@/lib/accounts'
import { fmtDate, fmtMoney, phoneHref, waHref } from '@/lib/format'
import { copyText, cn } from '@/lib/utils'
import { useSettings } from '@/store/settings'
import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'

const TABS = [
  { v: 'overview', label: 'نظرة عامة', icon: TrendingUp },
  { v: 'subjects', label: 'المواد', icon: BookOpen },
  { v: 'attendance', label: 'الحضور', icon: CalendarCheck },
  { v: 'finance', label: 'الحسابات', icon: Wallet },
  { v: 'payments', label: 'المدفوعات', icon: ReceiptText },
  { v: 'project', label: 'المشروع', icon: FolderKanban },
  { v: 'messages', label: 'الرسائل', icon: MessageSquare },
]

export default function StudentProfilePage() {
  const { id } = useParams()
  const { settings } = useSettings()
  const confirm = useConfirm()
  const { data: student, isLoading } = useStudent(id)
  const { yearName, groupName, subjectById, subjectName } = useLookups()
  const { data: ss = [] } = useStudentSubjects(id)
  const { data: cycles = [] } = useCycles(id)
  const { data: charges = [] } = useCharges(id)
  const { data: payments = [] } = usePayments(id)
  const { data: attendance = [] } = useStudentAttendance(id)

  const [tab, setTab] = useState('overview')
  const [editOpen, setEditOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [chargeOpen, setChargeOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [pinResult, setPinResult] = useState<{ code: string; pin: string } | null>(null)

  const fin = useMemo(() => computeFinance(charges), [charges])

  const { data: sessionsMap = new Map<string, { date: string; subject: string }>() } = useQuery({
    queryKey: ['sessions-map', id],
    enabled: attendance.length > 0,
    queryFn: async () => {
      const ids = [...new Set(attendance.map((a) => a.session_id))]
      const { data } = await supabase.from('class_sessions').select('id, session_date, subject_id, status').in('id', ids)
      const m = new Map<string, { date: string; subject: string; status: string }>()
      for (const s of data ?? []) m.set(s.id, { date: s.session_date, subject: s.subject_id, status: s.status })
      return m as Map<string, { date: string; subject: string }>
    },
  })

  const { data: myMessages = [] } = useQuery({
    queryKey: ['student-messages', id],
    enabled: !!id && tab === 'messages',
    queryFn: () => api.listMyMessages(id!),
  })

  const { data: progress = [] } = useProgress({ studentId: id })
  const { data: allQuestions = [] } = useQuery({
    queryKey: ['questions', 'all'],
    queryFn: () => api.listQuestions(),
    enabled: tab === 'project',
  })

  const recompute = useAction(api.recomputeStudent, {
    success: 'تم تحديث الدورات والمستحقات',
    invalidate: [['cycles'], ['charges'], ['dashboard']],
  })

  const makeAccount = useAction(
    async (custom?: string) => createStudentAccount(id!, custom || undefined),
    {
      invalidate: [['students'], ['student', id!]],
      onDone: (r) => {
        setPinResult({ code: r.code!, pin: r.pin! })
        setAccountOpen(false)
      },
    },
  )
  const resetPin = useAction(async (custom?: string) => resetStudentPin(id!, custom || undefined), {
    onDone: (r) => {
      setPinResult({ code: r.code!, pin: r.pin! })
      setAccountOpen(false)
    },
  })

  const voidCharge = useAction(({ cid, reason }: { cid: string; reason: string }) => api.voidCharge(cid, reason), {
    success: 'تم إلغاء البند',
    invalidate: [['charges'], ['dashboard']],
  })
  const voidPayment = useAction(({ pid, reason }: { pid: string; reason: string }) => api.voidPayment(pid, reason), {
    success: 'تم إلغاء الدفعة',
    invalidate: [['payments'], ['charges'], ['dashboard']],
  })

  if (isLoading) return <PageLoader />
  if (!student) return <EmptyState title="الطالب غير موجود" description="ربما تم حذفه." />

  const attendanceStats = {
    present: attendance.filter((a) => a.status === 'present').length,
    absent: attendance.filter((a) => a.status === 'absent').length,
    late: attendance.filter((a) => a.status === 'late').length,
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild className="no-print -mr-2">
        <Link to="/students"><ArrowRight className="size-4" /> كل الطلاب</Link>
      </Button>

      {/* ============ ترويسة الطالب ============ */}
      <Card className="p-4">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar name={student.full_name} size={64} />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-extrabold text-ink">{student.full_name}</h1>
            <button
              onClick={() => copyText(student.code).then(() => toast.success('تم نسخ كود الطالب'))}
              className="num tap mt-0.5 inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-2 py-1 text-[12px] font-semibold text-ink-2 hover:bg-surface-3"
            >
              {student.code} <Copy className="size-3" />
            </button>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {student.year_id && <Badge tone="neutral">{yearName.get(student.year_id)}</Badge>}
              {student.group_id && <Badge tone="neutral">{groupName.get(student.group_id)}</Badge>}
              <StudentStatusBadge status={student.status} />
              {student.has_account ? <Badge tone="info">له حساب دخول</Badge> : <Badge tone="warning">بدون حساب</Badge>}
            </div>
          </div>

          <div className="no-print flex flex-wrap gap-2">
            {student.phone && (
              <Button variant="secondary" size="icon" asChild aria-label="اتصال">
                <a href={phoneHref(student.phone)}><Phone className="size-4" /></a>
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" /> تعديل
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link to={`/reports/student/${student.id}`}><FileText className="size-4" /> تقرير</Link>
            </Button>
            <Button size="sm" onClick={() => setPayOpen(true)}>
              <Plus className="size-4" /> دفعة
            </Button>
          </div>
        </div>

        {/* ============ الملخص المالي ============ */}
        <div className="mt-4 grid grid-cols-3 gap-2.5 border-t border-line pt-4">
          <div className="rounded-xl bg-surface-2 p-3 text-center">
            <p className="text-[11.5px] text-ink-2">إجمالي المستحق</p>
            <p className="mt-1 text-[16px] font-extrabold text-ink"><Money value={fin.due} /></p>
          </div>
          <div className="rounded-xl bg-success-bg p-3 text-center">
            <p className="text-[11.5px] text-success">المدفوع</p>
            <p className="mt-1 text-[16px] font-extrabold text-success"><Money value={fin.paid} /></p>
          </div>
          <div className={cn('rounded-xl p-3 text-center', fin.outstanding > 0 ? 'bg-danger-bg' : 'bg-surface-2')}>
            <p className={cn('text-[11.5px]', fin.outstanding > 0 ? 'text-danger' : 'text-ink-2')}>المتبقي</p>
            <p className={cn('mt-1 text-[16px] font-extrabold', fin.outstanding > 0 ? 'text-danger' : 'text-ink')}>
              <Money value={fin.outstanding} />
            </p>
          </div>
        </div>
      </Card>

      {/* ============ التبويبات ============ */}
      <TabsPrimitive.Root value={tab} onValueChange={setTab}>
        <TabsPrimitive.List className="no-scrollbar mb-4 flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1">
          {TABS.map((t) => (
            <TabsPrimitive.Trigger
              key={t.v}
              value={t.v}
              className="tap flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold text-ink-2 transition data-[state=active]:bg-[color-mix(in_oklab,var(--brand)_13%,transparent)] data-[state=active]:text-[var(--brand)]"
            >
              <t.icon className="size-4" /> {t.label}
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>

        {/* ---------------- نظرة عامة ---------------- */}
        <TabsPrimitive.Content value="overview" className="space-y-4 outline-none">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>بيانات الطالب</CardTitle></CardHeader>
              <CardContent className="divide-y divide-[var(--border)]">
                <KeyValue label="كود الطالب"><span className="num">{student.code}</span></KeyValue>
                <KeyValue label="الهاتف">
                  {student.phone ? (
                    <a className="num text-[var(--brand)]" href={waHref(student.phone)} target="_blank" rel="noreferrer">{student.phone}</a>
                  ) : '—'}
                </KeyValue>
                <KeyValue label="هاتف ولي الأمر"><span className="num">{student.guardian_phone || '—'}</span></KeyValue>
                <KeyValue label="السنة الدراسية">{student.year_id ? yearName.get(student.year_id) : '—'}</KeyValue>
                <KeyValue label="المجموعة">{student.group_id ? groupName.get(student.group_id) : '—'}</KeyValue>
                <KeyValue label="تاريخ التسجيل">{fmtDate(student.enrolled_at)}</KeyValue>
                {student.notes ? <KeyValue label="ملاحظات">{student.notes}</KeyValue> : null}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle>الحضور</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="rounded-xl bg-success-bg p-3 text-center">
                      <p className="num text-xl font-extrabold text-success">{attendanceStats.present}</p>
                      <p className="text-[11.5px] text-success">حاضر</p>
                    </div>
                    <div className="rounded-xl bg-danger-bg p-3 text-center">
                      <p className="num text-xl font-extrabold text-danger">{attendanceStats.absent}</p>
                      <p className="text-[11.5px] text-danger">غائب</p>
                    </div>
                    <div className="rounded-xl bg-warning-bg p-3 text-center">
                      <p className="num text-xl font-extrabold text-warning">{attendanceStats.late}</p>
                      <p className="text-[11.5px] text-warning">متأخر</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="no-print">
                <CardHeader><CardTitle>إجراءات سريعة</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={() => setPayOpen(true)}><Wallet className="size-4" /> تسجيل دفعة</Button>
                  <Button variant="secondary" onClick={() => setChargeOpen(true)}><ReceiptText className="size-4" /> إضافة بند</Button>
                  <Button variant="secondary" onClick={() => setAccountOpen(true)}>
                    <KeyRound className="size-4" /> {student.has_account ? 'تغيير الرمز' : 'إنشاء حساب'}
                  </Button>
                  <Button variant="ghost" onClick={() => recompute.mutate(student.id)} loading={recompute.isPending}>
                    <ShieldCheck className="size-4" /> تحديث الدورات
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsPrimitive.Content>

        {/* ---------------- المواد ---------------- */}
        <TabsPrimitive.Content value="subjects" className="outline-none">
          {ss.length === 0 ? (
            <Card><EmptyState icon={BookOpen} title="غير مسجّل في أي مادة" description="عدّل بيانات الطالب لإضافة المواد."
              action={<Button size="sm" onClick={() => setEditOpen(true)}>تسجيل مواد</Button>} /></Card>
          ) : (
            <div className="grid gap-2.5 md:grid-cols-2">
              {ss.map((row) => {
                const subj = subjectById.get(row.subject_id)
                const cyc = cycles.filter((c) => c.subject_id === row.subject_id)
                const open = cyc.find((c) => c.status === 'open')
                const done = cyc.filter((c) => c.status === 'completed').length
                const price = row.price_override ?? subj?.price ?? 0
                return (
                  <Card key={row.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[14.5px] font-bold text-ink">{subj?.name ?? 'مادة'}</p>
                        <p className="num text-[12px] text-muted">
                          {fmtMoney(price, settings.currency_symbol)} / دورة
                          {row.price_override != null ? ' (سعر خاص)' : ''}
                        </p>
                      </div>
                      <Badge tone={row.is_active ? 'success' : 'neutral'}>{row.is_active ? 'مفعّل' : 'موقوف'}</Badge>
                    </div>
                    <div className="mt-3">
                      <div className="mb-1.5 flex items-center justify-between text-[12px]">
                        <span className="text-ink-2">الدورة الحالية</span>
                        <span className="num font-bold text-ink">
                          {open ? `${open.sessions_done} / ${open.sessions_target}` : '—'}
                        </span>
                      </div>
                      <Progress value={open ? (open.sessions_done / open.sessions_target) * 100 : 0} />
                      <p className="num mt-2 text-[11.5px] text-muted">دورات مكتملة: {done}</p>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsPrimitive.Content>

        {/* ---------------- الحضور ---------------- */}
        <TabsPrimitive.Content value="attendance" className="outline-none">
          {attendance.length === 0 ? (
            <Card><EmptyState icon={CalendarCheck} title="لا يوجد سجل حضور بعد" description="سيظهر هنا بعد تسجيل أول حصة." /></Card>
          ) : (
            <Card className="divide-y divide-[var(--border)]">
              {attendance
                .slice()
                .sort((a, b) => (sessionsMap.get(b.session_id)?.date ?? '').localeCompare(sessionsMap.get(a.session_id)?.date ?? ''))
                .map((a) => {
                  const info = sessionsMap.get(a.session_id)
                  return (
                    <div key={a.id} className="flex items-center gap-3 p-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-semibold text-ink">
                          {info?.subject ? subjectName.get(info.subject) ?? 'حصة' : 'حصة'}
                        </p>
                        <p className="text-[11.5px] text-muted">{info ? fmtDate(info.date) : '—'}</p>
                      </div>
                      <AttendanceBadge status={a.status} />
                    </div>
                  )
                })}
            </Card>
          )}
        </TabsPrimitive.Content>

        {/* ---------------- الحسابات ---------------- */}
        <TabsPrimitive.Content value="finance" className="space-y-3 outline-none">
          <div className="no-print flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setChargeOpen(true)}><Plus className="size-4" /> بند مالي</Button>
            <Button size="sm" onClick={() => setPayOpen(true)}><Wallet className="size-4" /> دفعة</Button>
          </div>
          {charges.length === 0 ? (
            <Card><EmptyState icon={ReceiptText} title="لا توجد مستحقات" description="تُنشأ المستحقات تلقائيًا مع بداية كل دورة." /></Card>
          ) : (
            <Card className="divide-y divide-[var(--border)]">
              {charges.map((c) => {
                const remaining = Number(c.amount) - Number(c.paid_amount)
                return (
                  <div key={c.id} className="flex items-center gap-3 p-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold text-ink">{c.title}</p>
                      {c.notes && <p className="mt-0.5 text-[12px] leading-relaxed text-ink-2">{c.notes}</p>}
                      <p className="text-[11.5px] text-muted">
                        {fmtDate(c.due_date)} · {c.kind === 'cycle' ? 'رسوم دورة' : 'بند إضافي'}
                      </p>
                    </div>
                    <div className="text-left">
                      <p className="num text-[13.5px] font-bold text-ink"><Money value={Number(c.amount)} /></p>
                      {remaining > 0 && Number(c.paid_amount) > 0 && (
                        <p className="num text-[11px] text-warning">متبقٍ <Money value={remaining} /></p>
                      )}
                    </div>
                    <ChargeBadge status={c.status} />
                    <Button
                      variant="ghost" size="iconSm" className="no-print"
                      aria-label="إلغاء البند"
                      onClick={() =>
                        confirm({
                          title: 'إلغاء البند المالي',
                          message: `سيتم إلغاء «${c.title}» وإلغاء أي مبالغ مخصومة عليه. السجل يبقى محفوظًا للمراجعة.`,
                          confirmText: 'إلغاء البند',
                          onConfirm: () => voidCharge.mutateAsync({ cid: c.id, reason: 'إلغاء يدوي' }),
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

        {/* ---------------- المدفوعات ---------------- */}
        <TabsPrimitive.Content value="payments" className="space-y-3 outline-none">
          <div className="no-print flex justify-end">
            <Button size="sm" onClick={() => setPayOpen(true)}><Plus className="size-4" /> تسجيل دفعة</Button>
          </div>
          {payments.length === 0 ? (
            <Card><EmptyState icon={Wallet} title="لا توجد مدفوعات مسجّلة" description="سجّل أول دفعة من الزر أعلاه." /></Card>
          ) : (
            <Card className="divide-y divide-[var(--border)]">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-3.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-success-bg text-success">
                    <Wallet className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="num text-[14px] font-bold text-ink"><Money value={Number(p.amount)} /></p>
                    <p className="text-[11.5px] text-muted">
                      {fmtDate(p.paid_at)} · {PAYMENT_METHOD_LABEL[p.method] ?? p.method}
                      {p.reference ? ` · ${p.reference}` : ''}
                    </p>
                  </div>
                  <Button
                    variant="ghost" size="iconSm" className="no-print" aria-label="إلغاء الدفعة"
                    onClick={() =>
                      confirm({
                        title: 'إلغاء الدفعة',
                        message: 'سيتم إلغاء الدفعة وإعادة المبالغ إلى المستحقات. السجل المالي يبقى محفوظًا.',
                        confirmText: 'إلغاء الدفعة',
                        onConfirm: () => voidPayment.mutateAsync({ pid: p.id, reason: 'إلغاء يدوي' }),
                      })
                    }
                  >
                    <Trash2 className="size-3.5 text-danger" />
                  </Button>
                </div>
              ))}
            </Card>
          )}
        </TabsPrimitive.Content>

        {/* ---------------- المشروع ---------------- */}
        <TabsPrimitive.Content value="project" className="outline-none">
          {progress.length === 0 ? (
            <Card><EmptyState icon={FolderKanban} title="غير مسجّل في مشروع" description="سجّل الطالب في مشروع من صفحة المشاريع." 
              action={<Button size="sm" asChild><Link to="/projects">المشاريع</Link></Button>} /></Card>
          ) : (
            <Card className="divide-y divide-[var(--border)]">
              {progress.map((p) => {
                const q = allQuestions.find((x) => x.id === p.question_id)
                return (
                  <div key={p.id} className="flex items-center gap-3 p-3.5">
                    <span className="num grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-[12px] font-bold text-ink-2">
                      {q?.idx ?? '?'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold text-ink">{q?.title ?? 'سؤال'}</p>
                      {p.completed_at && <p className="text-[11.5px] text-muted">اكتمل في {fmtDate(p.completed_at)}</p>}
                    </div>
                    <QuestionBadge status={p.status} />
                  </div>
                )
              })}
            </Card>
          )}
        </TabsPrimitive.Content>

        {/* ---------------- الرسائل ---------------- */}
        <TabsPrimitive.Content value="messages" className="outline-none">
          {myMessages.length === 0 ? (
            <Card><EmptyState icon={MessageSquare} title="لم تُرسل له رسائل بعد" description="أرسل رسالة من صفحة الرسائل."
              action={<Button size="sm" asChild><Link to="/messages">الرسائل</Link></Button>} /></Card>
          ) : (
            <Card className="divide-y divide-[var(--border)]">
              {myMessages.map((m) => (
                <div key={m.id} className="p-3.5">
                  <div className="flex items-center gap-2">
                    <p className="flex-1 text-[13.5px] font-bold text-ink">{m.messages?.title}</p>
                    {m.read_at ? <Badge tone="success">مقروءة</Badge> : <Badge tone="warning">غير مقروءة</Badge>}
                  </div>
                  {m.messages?.body && <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{m.messages.body}</p>}
                  <p className="mt-1 text-[11.5px] text-muted">{fmtDate(m.messages?.created_at)}</p>
                </div>
              ))}
            </Card>
          )}
        </TabsPrimitive.Content>
      </TabsPrimitive.Root>

      {/* ============ نوافذ ============ */}
      <StudentForm open={editOpen} onOpenChange={setEditOpen} student={student} />
      <PaymentDialog open={payOpen} onOpenChange={setPayOpen} studentId={student.id} />
      <ChargeDialog open={chargeOpen} onOpenChange={setChargeOpen} studentId={student.id} />

      <AccountDialog
        open={accountOpen}
        onOpenChange={setAccountOpen}
        hasAccount={student.has_account}
        busy={makeAccount.isPending || resetPin.isPending}
        onSubmit={(pin) => (student.has_account ? resetPin.mutate(pin) : makeAccount.mutate(pin))}
      />

      <Modal
        open={!!pinResult}
        onOpenChange={() => setPinResult(null)}
        title="بيانات دخول الطالب"
        description="احفظ هذه البيانات — لن تظهر مرة أخرى"
        size="sm"
        footer={<Button onClick={() => setPinResult(null)} block>تم</Button>}
      >
        <div className="space-y-3">
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="text-[12px] text-ink-2">كود الطالب</p>
            <p className="num mt-1 text-lg font-extrabold text-ink">{pinResult?.code}</p>
          </div>
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="text-[12px] text-ink-2">الرمز السري</p>
            <p className="num mt-1 text-lg font-extrabold text-ink">{pinResult?.pin}</p>
          </div>
          <Button
            variant="secondary" block
            onClick={() =>
              copyText(`كود الطالب: ${pinResult?.code}\nالرمز السري: ${pinResult?.pin}`).then(() => toast.success('تم النسخ'))
            }
          >
            <Copy className="size-4" /> نسخ البيانات
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function AccountDialog({
  open, onOpenChange, hasAccount, busy, onSubmit,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  hasAccount: boolean
  busy: boolean
  onSubmit: (pin?: string) => void
}) {
  const [pin, setPin] = useState('')
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={hasAccount ? 'تغيير الرمز السري' : 'إنشاء حساب دخول للطالب'}
      description="يدخل الطالب بكوده + الرمز السري، ويرى بياناته فقط"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button
            loading={busy}
            disabled={!!pin.trim() && pin.trim().length < 6}
            onClick={() => onSubmit(pin.trim() || undefined)}
          >
            {hasAccount ? 'تغيير' : 'إنشاء'}
          </Button>
        </>
      }
    >
      <Field
        label="رمز سري مخصص"
        hint="اتركه فارغًا لتوليد رمز عشوائي من 6 أرقام — أقل طول مسموح 6 خانات"
        error={pin.trim() && pin.trim().length < 6 ? 'الرمز السري يجب ألا يقل عن 6 خانات' : undefined}
      >
        <Input dir="ltr" inputMode="numeric" className="num text-right" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="••••••" />
      </Field>
    </Modal>
  )
}
