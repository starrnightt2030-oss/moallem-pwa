import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarCheck, Lock } from 'lucide-react'
import { Card, EmptyState, ListSkeleton, Progress, Badge } from '@/components/ui'
import { AttendanceBadge } from '@/components/common/Status'
import { useAuth } from '@/store/auth'
import { useSettings } from '@/store/settings'
import { useCycles, useLookups, useStudentAttendance, useStudentSubjects } from '@/lib/hooks'
import { supabase } from '@/lib/supabase'
import { fmtDate, fmtDayName } from '@/lib/format'

export default function PortalAttendance() {
  const { student } = useAuth()
  const { settings } = useSettings()
  const { data: attendance = [], isLoading } = useStudentAttendance(student?.id)
  const { data: cycles = [] } = useCycles(student?.id)
  const { data: ss = [] } = useStudentSubjects(student?.id)
  const { subjectById } = useLookups()

  const { data: sessionsMap } = useQuery({
    queryKey: ['portal-sessions', student?.id, attendance.length],
    enabled: attendance.length > 0,
    queryFn: async () => {
      const ids = [...new Set(attendance.map((a) => a.session_id))]
      const { data } = await supabase.from('class_sessions').select('id, session_date, subject_id, start_time').in('id', ids)
      return new Map((data ?? []).map((s) => [s.id, s as { id: string; session_date: string; subject_id: string; start_time: string | null }]))
    },
  })

  const sorted = useMemo(
    () =>
      attendance
        .slice()
        .sort((a, b) => (sessionsMap?.get(b.session_id)?.session_date ?? '').localeCompare(sessionsMap?.get(a.session_id)?.session_date ?? '')),
    [attendance, sessionsMap],
  )

  if (!settings.student_can_view_attendance) {
    return <Card><EmptyState icon={Lock} title="سجل الحضور غير متاح" description="لم يتم تفعيل عرض الحضور من قِبل المدرّس." /></Card>
  }

  if (isLoading) return <ListSkeleton rows={5} />

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-ink">الحصص</h1>

      {ss.length > 0 && (
        <Card className="space-y-3 p-4">
          <p className="text-[14px] font-bold text-ink">الدورة الحالية لكل مادة</p>
          {ss.map((row) => {
            const subj = subjectById.get(row.subject_id)
            const open = cycles.find((c) => c.subject_id === row.subject_id && c.status === 'open')
            if (!open) return null
            return (
              <div key={row.id}>
                <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
                  <span className="font-semibold text-ink">{subj?.name}</span>
                  <span className="num text-ink-2">{open.sessions_done} / {open.sessions_target}</span>
                </div>
                <Progress value={(open.sessions_done / open.sessions_target) * 100} />
              </div>
            )
          })}
        </Card>
      )}

      {sorted.length === 0 ? (
        <Card><EmptyState icon={CalendarCheck} title="لا يوجد سجل حضور بعد" description="سيظهر هنا بعد أول حصة." /></Card>
      ) : (
        <Card className="divide-y divide-[var(--border)]">
          {sorted.map((a) => {
            const s = sessionsMap?.get(a.session_id)
            return (
              <div key={a.id} className="flex items-center gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-ink">
                    {s ? subjectById.get(s.subject_id)?.name ?? 'حصة' : 'حصة'}
                  </p>
                  <p className="text-[11.5px] text-muted">
                    {s ? `${fmtDayName(s.session_date)} · ${fmtDate(s.session_date)}` : '—'}
                  </p>
                </div>
                <AttendanceBadge status={a.status} />
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}
