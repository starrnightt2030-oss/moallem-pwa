import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as api from './api'
import { humanError } from './supabase'
import type { Charge, Student } from './database.types'

const FIVE_MIN = 5 * 60 * 1000

/* ============================ استعلامات مرجعية ============================ */
export const useYears = () => useQuery({ queryKey: ['years'], queryFn: api.listYears, staleTime: FIVE_MIN })
export const useGroups = () => useQuery({ queryKey: ['groups'], queryFn: api.listGroups, staleTime: FIVE_MIN })
export const useSubjects = () => useQuery({ queryKey: ['subjects'], queryFn: api.listSubjects, staleTime: FIVE_MIN })
export const useStudents = () => useQuery({ queryKey: ['students'], queryFn: api.listStudents, staleTime: 60_000 })
export const useStudent = (id?: string) =>
  useQuery({ queryKey: ['student', id], queryFn: () => api.getStudent(id!), enabled: !!id })

export const useStudentSubjects = (studentId?: string) =>
  useQuery({ queryKey: ['student_subjects', studentId ?? 'all'], queryFn: () => api.listStudentSubjects(studentId) })

export const useSessions = (from?: string, to?: string) =>
  useQuery({ queryKey: ['sessions', from ?? '', to ?? ''], queryFn: () => api.listSessions(from, to) })

export const useSessionAttendance = (sessionId?: string) =>
  useQuery({ queryKey: ['attendance', sessionId], queryFn: () => api.listAttendance({ sessionId }), enabled: !!sessionId })

export const useAttendanceAll = () =>
  useQuery({ queryKey: ['attendance-all'], queryFn: () => api.listAttendance({}), staleTime: 60_000 })

export const useStudentAttendance = (studentId?: string) =>
  useQuery({ queryKey: ['attendance-student', studentId], queryFn: () => api.listAttendance({ studentId }), enabled: !!studentId })

export const useCycles = (studentId?: string) =>
  useQuery({ queryKey: ['cycles', studentId ?? 'all'], queryFn: () => api.listCycles(studentId) })

export const useCharges = (studentId?: string) =>
  useQuery({ queryKey: ['charges', studentId ?? 'all'], queryFn: () => api.listCharges(studentId) })

export const usePayments = (studentId?: string) =>
  useQuery({ queryKey: ['payments', studentId ?? 'all'], queryFn: () => api.listPayments(studentId) })

export const useProjects = () => useQuery({ queryKey: ['projects'], queryFn: api.listProjects })
export const useQuestions = (projectId?: string) =>
  useQuery({ queryKey: ['questions', projectId ?? 'all'], queryFn: () => api.listQuestions(projectId) })
export const useEnrollments = (projectId?: string) =>
  useQuery({ queryKey: ['enrollments', projectId ?? 'all'], queryFn: () => api.listEnrollments(projectId) })
export const useProgress = (opts: { studentId?: string; questionIds?: string[] } = {}) =>
  useQuery({ queryKey: ['progress', opts.studentId ?? 'all', (opts.questionIds ?? []).join(',')], queryFn: () => api.listProgress(opts) })

export const useMessages = () => useQuery({ queryKey: ['messages'], queryFn: api.listMessages })
export const useFiles = () => useQuery({ queryKey: ['files'], queryFn: api.listFiles })
export const useNotifications = (studentId?: string) =>
  useQuery({ queryKey: ['notifications', studentId ?? 'all'], queryFn: () => api.listNotifications(studentId), refetchInterval: 60_000 })
export const useAuditLogs = () => useQuery({ queryKey: ['audit'], queryFn: () => api.listAuditLogs(300) })
export const useDashboard = () => useQuery({ queryKey: ['dashboard'], queryFn: api.dashboardStats, staleTime: 30_000 })

/* ============================ طفرات مع تنبيهات ============================ */
export function useAction<TArgs, TResult>(
  fn: (a: TArgs) => Promise<TResult>,
  opts: { success?: string; invalidate?: QueryKey[]; onDone?: (r: TResult) => void } = {},
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      if (opts.success) toast.success(opts.success)
      for (const k of opts.invalidate ?? []) qc.invalidateQueries({ queryKey: k })
      opts.onDone?.(r)
    },
    onError: (e) => toast.error(humanError(e)),
  })
}

/* ============================ حسابات مشتقة ============================ */
export interface StudentFinance {
  due: number
  paid: number
  outstanding: number
  unpaid: Charge[]
}

export function computeFinance(charges: Charge[]): StudentFinance {
  const live = charges.filter((c) => !c.void_at)
  const due = live.reduce((a, c) => a + Number(c.amount), 0)
  const paid = live.reduce((a, c) => a + Number(c.paid_amount), 0)
  return {
    due,
    paid,
    outstanding: Math.max(0, due - paid),
    unpaid: live.filter((c) => Number(c.amount) - Number(c.paid_amount) > 0.001),
  }
}

/** خريطة الأرصدة لكل الطلاب دفعة واحدة */
export function useBalances() {
  const { data: charges = [], isLoading } = useCharges()
  const map = useMemo(() => {
    const m = new Map<string, { due: number; paid: number; outstanding: number }>()
    for (const c of charges) {
      const cur = m.get(c.student_id) ?? { due: 0, paid: 0, outstanding: 0 }
      cur.due += Number(c.amount)
      cur.paid += Number(c.paid_amount)
      cur.outstanding = Math.max(0, cur.due - cur.paid)
      m.set(c.student_id, cur)
    }
    return m
  }, [charges])
  return { balances: map, isLoading }
}

/** فهارس سريعة للأسماء */
export function useLookups() {
  const years = useYears()
  const groups = useGroups()
  const subjects = useSubjects()
  return useMemo(() => {
    const yearName = new Map((years.data ?? []).map((y) => [y.id, y.name]))
    const groupName = new Map((groups.data ?? []).map((g) => [g.id, g.name]))
    const subjectName = new Map((subjects.data ?? []).map((s) => [s.id, s.name]))
    const subjectById = new Map((subjects.data ?? []).map((s) => [s.id, s]))
    const groupById = new Map((groups.data ?? []).map((g) => [g.id, g]))
    return {
      yearName, groupName, subjectName, subjectById, groupById,
      years: years.data ?? [], groups: groups.data ?? [], subjects: subjects.data ?? [],
      isLoading: years.isLoading || groups.isLoading || subjects.isLoading,
    }
  }, [years.data, groups.data, subjects.data, years.isLoading, groups.isLoading, subjects.isLoading])
}

export function studentLabel(s: Student) {
  return `${s.full_name} — ${s.code}`
}
