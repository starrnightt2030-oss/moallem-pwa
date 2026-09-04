import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Printer, Download } from 'lucide-react'
import { Button, Card, EmptyState, PageLoader, Badge } from '@/components/ui'
import { Money } from '@/components/common/Money'
import { ATTENDANCE_LABEL, CHARGE_LABEL, PAYMENT_METHOD_LABEL } from '@/components/common/Status'
import {
  useCharges, useCycles, useLookups, usePayments, useStudent, useStudentAttendance, useStudentSubjects,
  computeFinance,
} from '@/lib/hooks'
import { supabase } from '@/lib/supabase'
import { useSettings } from '@/store/settings'
import { fmtDate, fmtMoney } from '@/lib/format'
import { exportCsv } from '@/lib/utils'

export default function StudentReportPage() {
  const { id } = useParams()
  const { settings } = useSettings()
  const { data: student, isLoading } = useStudent(id)
  const { yearName, groupName, subjectById, subjectName } = useLookups()
  const { data: ss = [] } = useStudentSubjects(id)
  const { data: cycles = [] } = useCycles(id)
  const { data: charges = [] } = useCharges(id)
  const { data: payments = [] } = usePayments(id)
  const { data: attendance = [] } = useStudentAttendance(id)

  const { data: sessionsMap } = useQuery({
    queryKey: ['report-sessions', id, attendance.length],
    enabled: attendance.length > 0,
    queryFn: async () => {
      const ids = [...new Set(attendance.map((a) => a.session_id))]
      const { data } = await supabase.from('class_sessions').select('id, session_date, subject_id').in('id', ids)
      return new Map((data ?? []).map((s) => [s.id, s as { id: string; session_date: string; subject_id: string }]))
    },
  })

  const fin = useMemo(() => computeFinance(charges), [charges])
  const att = useMemo(
    () => ({
      present: attendance.filter((a) => a.status === 'present').length,
      absent: attendance.filter((a) => a.status === 'absent').length,
      late: attendance.filter((a) => a.status === 'late').length,
      excused: attendance.filter((a) => a.status === 'excused').length,
    }),
    [attendance],
  )

  if (isLoading) return <PageLoader />
  if (!student) return <EmptyState title="الطالب غير موجود" />

  const completedCycles = cycles.filter((c) => c.status === 'completed').length

  return (
    <div className="print-area mx-auto max-w-4xl space-y-4">
      <div className="no-print flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="-mr-2">
          <Link to={`/students/${student.id}`}><ArrowRight className="size-4" /> ملف الطالب</Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() =>
            exportCsv(
              charges.map((c) => ({
                البند: c.title, التاريخ: c.due_date, المبلغ: Number(c.amount),
                المدفوع: Number(c.paid_amount), المتبقي: Number(c.amount) - Number(c.paid_amount),
                الحالة: CHARGE_LABEL[c.status],
              })),
              `حساب-${student.code}`,
            )
          }>
            <Download className="size-4" /> CSV
          </Button>
          <Button size="sm" onClick={() => window.print()}><Printer className="size-4" /> طباعة / PDF</Button>
        </div>
      </div>

      {/* ============ ترويسة التقرير ============ */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
          <div className="flex items-center gap-3">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="" className="size-14 rounded-xl object-cover" />
            ) : null}
            <div>
              <h1 className="text-lg font-extrabold text-ink">{settings.app_name}</h1>
              {settings.teacher_name && <p className="text-[12.5px] text-ink-2">{settings.teacher_name}</p>}
              {settings.teacher_phone && <p className="num text-[12px] text-muted">{settings.teacher_phone}</p>}
            </div>
          </div>
          <div className="text-left">
            <p className="text-[13px] font-bold text-ink">تقرير الطالب</p>
            <p className="text-[11.5px] text-muted">تاريخ الإصدار: {fmtDate(new Date())}</p>
          </div>
        </div>

        {settings.report_header && (
          <p className="mt-3 whitespace-pre-line text-[12.5px] text-ink-2">{settings.report_header}</p>
        )}

        <div className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <Row label="الاسم" value={student.full_name} />
          <Row label="كود الطالب" value={student.code} num />
          <Row label="الهاتف" value={student.phone ?? '—'} num />
          <Row label="هاتف ولي الأمر" value={student.guardian_phone ?? '—'} num />
          <Row label="السنة الدراسية" value={student.year_id ? yearName.get(student.year_id) ?? '—' : '—'} />
          <Row label="المجموعة" value={student.group_id ? groupName.get(student.group_id) ?? '—' : '—'} />
          <Row label="تاريخ التسجيل" value={fmtDate(student.enrolled_at)} />
          <Row label="الحالة" value={student.status === 'active' ? 'نشط' : 'غير نشط'} />
        </div>
        {student.notes && <p className="mt-3 rounded-lg bg-surface-2 p-3 text-[12.5px] text-ink-2">ملاحظات: {student.notes}</p>}
      </Card>

      {/* ============ الملخص ============ */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Summary label="إجمالي المستحق" value={<Money value={fin.due} />} />
        <Summary label="إجمالي المدفوع" value={<Money value={fin.paid} />} tone="success" />
        <Summary label="المتبقي" value={<Money value={fin.outstanding} />} tone={fin.outstanding > 0 ? 'danger' : 'success'} />
        <Summary label="دورات مكتملة" value={<span className="num">{completedCycles}</span>} />
      </div>

      {/* ============ المواد والدورات ============ */}
      <Section title="المواد والدورات">
        {ss.length === 0 ? <Empty /> : (
          <Table
            head={['المادة', 'السعر', 'الدورة الحالية', 'دورات مكتملة']}
            rows={ss.map((row) => {
              const subj = subjectById.get(row.subject_id)
              const cyc = cycles.filter((c) => c.subject_id === row.subject_id)
              const open = cyc.find((c) => c.status === 'open')
              return [
                subj?.name ?? '—',
                fmtMoney(row.price_override ?? subj?.price ?? 0, settings.currency_symbol),
                open ? `${open.sessions_done} / ${open.sessions_target}` : '—',
                String(cyc.filter((c) => c.status === 'completed').length),
              ]
            })}
          />
        )}
      </Section>

      {/* ============ الحضور ============ */}
      <Section title="الحضور والغياب">
        <div className="mb-3 grid grid-cols-4 gap-2">
          <Mini label="حاضر" value={att.present} tone="success" />
          <Mini label="غائب" value={att.absent} tone="danger" />
          <Mini label="متأخر" value={att.late} tone="warning" />
          <Mini label="بعذر" value={att.excused} tone="info" />
        </div>
        {attendance.length === 0 ? <Empty /> : (
          <Table
            head={['التاريخ', 'المادة', 'الحالة', 'ملاحظة']}
            rows={attendance
              .slice()
              .sort((a, b) => (sessionsMap?.get(b.session_id)?.session_date ?? '').localeCompare(sessionsMap?.get(a.session_id)?.session_date ?? ''))
              .slice(0, 60)
              .map((a) => {
                const s = sessionsMap?.get(a.session_id)
                return [
                  s ? fmtDate(s.session_date) : '—',
                  s ? subjectName.get(s.subject_id) ?? '—' : '—',
                  ATTENDANCE_LABEL[a.status],
                  a.note ?? '—',
                ]
              })}
          />
        )}
      </Section>

      {/* ============ المستحقات ============ */}
      <Section title="المستحقات والمصروفات">
        {charges.length === 0 ? <Empty /> : (
          <Table
            head={['التاريخ', 'البند', 'النوع', 'المبلغ', 'المدفوع', 'المتبقي', 'الحالة']}
            rows={charges.map((c) => [
              fmtDate(c.due_date),
              c.title,
              c.kind === 'cycle' ? 'رسوم دورة' : 'بند إضافي',
              fmtMoney(Number(c.amount), settings.currency_symbol),
              fmtMoney(Number(c.paid_amount), settings.currency_symbol),
              fmtMoney(Number(c.amount) - Number(c.paid_amount), settings.currency_symbol),
              CHARGE_LABEL[c.status],
            ])}
          />
        )}
      </Section>

      {/* ============ المدفوعات ============ */}
      <Section title="سجل المدفوعات">
        {payments.length === 0 ? <Empty /> : (
          <Table
            head={['التاريخ', 'المبلغ', 'الطريقة', 'مرجع', 'ملاحظات']}
            rows={payments.map((p) => [
              fmtDate(p.paid_at),
              fmtMoney(Number(p.amount), settings.currency_symbol),
              PAYMENT_METHOD_LABEL[p.method] ?? p.method,
              p.reference ?? '—',
              p.notes ?? '—',
            ])}
          />
        )}
      </Section>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[13px] font-bold text-ink">الإجمالي المستحق حاليًا</span>
          <span className="text-[18px] font-extrabold text-danger"><Money value={fin.outstanding} /></span>
        </div>
        {settings.report_footer && (
          <p className="mt-3 whitespace-pre-line border-t border-line pt-3 text-[12px] text-muted">{settings.report_footer}</p>
        )}
      </Card>
    </div>
  )
}

function Row({ label, value, num }: { label: string; value: string; num?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-1.5 last:border-0">
      <span className="text-[12.5px] text-ink-2">{label}</span>
      <span className={`text-[13px] font-semibold text-ink ${num ? 'num' : ''}`}>{value}</span>
    </div>
  )
}

function Summary({ label, value, tone = 'neutral' }: { label: string; value: React.ReactNode; tone?: 'neutral' | 'success' | 'danger' }) {
  const bg = tone === 'success' ? 'bg-success-bg' : tone === 'danger' ? 'bg-danger-bg' : 'bg-surface-2'
  const fg = tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-ink'
  return (
    <Card className={`print-card p-3.5 text-center ${bg}`}>
      <p className="text-[11.5px] font-semibold text-ink-2">{label}</p>
      <p className={`mt-1 text-[17px] font-extrabold ${fg}`}>{value}</p>
    </Card>
  )
}

function Mini({ label, value, tone }: { label: string; value: number; tone: 'success' | 'danger' | 'warning' | 'info' }) {
  const bg = { success: 'bg-success-bg text-success', danger: 'bg-danger-bg text-danger', warning: 'bg-warning-bg text-warning', info: 'bg-info-bg text-info' }[tone]
  return (
    <div className={`rounded-xl p-2.5 text-center ${bg}`}>
      <p className="num text-lg font-extrabold">{value}</p>
      <p className="text-[11px]">{label}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="print-card p-4">
      <h2 className="mb-3 text-[14px] font-bold text-ink">{title}</h2>
      {children}
    </Card>
  )
}

function Empty() {
  return <p className="py-5 text-center text-[12.5px] text-muted">لا توجد بيانات</p>
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-right text-[12.5px]">
        <thead>
          <tr className="border-b border-line text-[11.5px] text-ink-2">
            {head.map((h) => <th key={h} className="whitespace-nowrap px-2 py-2 font-semibold">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line last:border-0">
              {r.map((c, j) => <td key={j} className="whitespace-nowrap px-2 py-2 text-ink">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
