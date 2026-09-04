import { supabase } from './supabase'
import type {
  AcademicYear, Attendance, Charge, ClassSession, Cycle, FileRow, Group, Message,
  Notification, Payment, Project, ProjectQuestion, Student, StudentProjectProgress,
  StudentSubject, Subject, AuditLog, DashboardStats, AppSettings,
} from './database.types'

const ok = <T,>(res: { data: T | null; error: unknown }) => {
  if (res.error) throw res.error
  return res.data as T
}

/**
 * حفظ سجل: إدراج جديد أو تحديث حسب وجود المعرّف.
 * لا نستخدم upsert لأن الإدراج التخميني يفشل مع أعمدة NOT NULL غير المُرسلة.
 */
async function saveRow<T>(table: string, row: Record<string, unknown>): Promise<T> {
  const { id, ...rest } = row as { id?: string }
  if (id) {
    return ok<T>(await supabase.from(table).update(rest).eq('id', id).select().single())
  }
  return ok<T>(await supabase.from(table).insert(rest).select().single())
}

/* ============================ السنوات الدراسية ============================ */
export const listYears = async () =>
  ok<AcademicYear[]>(await supabase.from('academic_years').select('*').order('sort_order'))

export const saveYear = (y: Partial<AcademicYear>) => saveRow<AcademicYear>('academic_years', y)

export const deleteYear = async (id: string) => {
  const { error } = await supabase.from('academic_years').delete().eq('id', id)
  if (error) throw error
}

/* ================================ المجموعات ================================ */
export const listGroups = async () =>
  ok<Group[]>(await supabase.from('groups').select('*').order('name'))

export const saveGroup = (g: Partial<Group>) => saveRow<Group>('groups', g)

export const deleteGroup = async (id: string) => {
  const { error } = await supabase.from('groups').delete().eq('id', id)
  if (error) throw error
}

/* ================================== المواد ==================================*/
export const listSubjects = async () =>
  ok<Subject[]>(await supabase.from('subjects').select('*').order('name'))

export const saveSubject = (s: Partial<Subject>) => saveRow<Subject>('subjects', s)

export const deleteSubject = async (id: string) => {
  const { error } = await supabase.from('subjects').delete().eq('id', id)
  if (error) throw error
}

/* ================================= الطلاب =================================*/
export const listStudents = async () =>
  ok<Student[]>(await supabase.from('students').select('*').order('full_name'))

export const getStudent = async (id: string) =>
  ok<Student>(await supabase.from('students').select('*').eq('id', id).single())

export const saveStudent = (s: Partial<Student>) => saveRow<Student>('students', s)

export const deleteStudent = async (id: string) => {
  const { error } = await supabase.from('students').delete().eq('id', id)
  if (error) throw error
}

export const nextStudentCode = async () => ok<string>(await supabase.rpc('next_student_code'))

/* =========================== ربط الطالب بالمواد ===========================*/
export const listStudentSubjects = async (studentId?: string) => {
  let q = supabase.from('student_subjects').select('*')
  if (studentId) q = q.eq('student_id', studentId)
  return ok<StudentSubject[]>(await q)
}

export const saveStudentSubject = (r: Partial<StudentSubject>) => saveRow<StudentSubject>('student_subjects', r)

export const removeStudentSubject = async (id: string) => {
  const { error } = await supabase.from('student_subjects').delete().eq('id', id)
  if (error) throw error
}

/* ================================== الحصص ================================== */
export const listSessions = async (from?: string, to?: string) => {
  let q = supabase.from('class_sessions').select('*').order('session_date', { ascending: false }).order('start_time')
  if (from) q = q.gte('session_date', from)
  if (to) q = q.lte('session_date', to)
  return ok<ClassSession[]>(await q)
}

export const getSession = async (id: string) =>
  ok<ClassSession>(await supabase.from('class_sessions').select('*').eq('id', id).single())

export const saveSession = (s: Partial<ClassSession>) => saveRow<ClassSession>('class_sessions', s)

export const deleteSession = async (id: string) => {
  const { error } = await supabase.from('class_sessions').delete().eq('id', id)
  if (error) throw error
}

/** توليد حصص متكررة أسبوعيًا */
export const generateSessions = async (rows: Partial<ClassSession>[]) =>
  ok<ClassSession[]>(await supabase.from('class_sessions').insert(rows).select())

/* ================================= الحضور ================================= */
export const listAttendance = async (opts: { sessionId?: string; studentId?: string } = {}) => {
  let q = supabase.from('attendance').select('*')
  if (opts.sessionId) q = q.eq('session_id', opts.sessionId)
  if (opts.studentId) q = q.eq('student_id', opts.studentId)
  return ok<Attendance[]>(await q)
}

export const saveAttendance = async (
  sessionId: string,
  records: { student_id: string; status: string; note?: string | null }[],
  markDone = true,
) => {
  const { error } = await supabase.rpc('save_attendance', {
    p_session: sessionId,
    p_records: records,
    p_mark_done: markDone,
  })
  if (error) throw error
}

/* ================================= الدورات ================================= */
export const listCycles = async (studentId?: string) => {
  let q = supabase.from('cycles').select('*').order('cycle_index')
  if (studentId) q = q.eq('student_id', studentId)
  return ok<Cycle[]>(await q)
}

export const recomputeStudent = async (studentId: string) => {
  const { error } = await supabase.rpc('recompute_student', { p_student: studentId })
  if (error) throw error
}

/* =============================== المستحقات =============================== */
export const listCharges = async (studentId?: string) => {
  let q = supabase.from('charges').select('*').is('void_at', null).order('due_date', { ascending: false })
  if (studentId) q = q.eq('student_id', studentId)
  return ok<Charge[]>(await q)
}

export const saveCharge = (c: Partial<Charge>) => saveRow<Charge>('charges', c)

export const voidCharge = async (id: string, reason: string) => {
  const { error } = await supabase.rpc('void_charge', { p_charge: id, p_reason: reason })
  if (error) throw error
}

export const addBulkCharge = async (p: {
  title: string
  amount: number
  due?: string
  notes?: string | null
  studentIds?: string[]
  groupIds?: string[]
  yearIds?: string[]
  all?: boolean
  projectId?: string | null
}) =>
  ok<{ batch_id: string; count: number }>(
    await supabase.rpc('add_bulk_charge', {
      p_title: p.title,
      p_amount: p.amount,
      p_due: p.due ?? null,
      p_notes: p.notes ?? null,
      p_student_ids: p.studentIds ?? [],
      p_group_ids: p.groupIds ?? [],
      p_year_ids: p.yearIds ?? [],
      p_all: p.all ?? false,
      p_project_id: p.projectId ?? null,
    }),
  )

/* =============================== المدفوعات =============================== */
export const listPayments = async (studentId?: string) => {
  let q = supabase.from('payments').select('*').is('void_at', null).order('paid_at', { ascending: false })
  if (studentId) q = q.eq('student_id', studentId)
  return ok<Payment[]>(await q)
}

export const recordPayment = async (p: {
  studentId: string
  amount: number
  method?: string
  paidAt?: string
  notes?: string | null
  chargeId?: string | null
  reference?: string | null
}) => {
  const { error, data } = await supabase.rpc('record_payment', {
    p_student: p.studentId,
    p_amount: p.amount,
    p_method: p.method ?? 'cash',
    p_paid_at: p.paidAt ?? new Date().toISOString().slice(0, 10),
    p_notes: p.notes ?? null,
    p_charge: p.chargeId ?? null,
    p_reference: p.reference ?? null,
  })
  if (error) throw error
  return data as string
}

export const voidPayment = async (id: string, reason: string) => {
  const { error } = await supabase.rpc('void_payment', { p_payment: id, p_reason: reason })
  if (error) throw error
}

export const listAllocations = async (paymentIds: string[]) => {
  if (!paymentIds.length) return []
  return ok<{ id: string; payment_id: string; charge_id: string; amount: number }[]>(
    await supabase.from('payment_allocations').select('*').in('payment_id', paymentIds),
  )
}

/* ================================ المشاريع ================================ */
export const listProjects = async () =>
  ok<Project[]>(await supabase.from('projects').select('*').order('created_at', { ascending: false }))

export const saveProject = (p: Partial<Project>) => saveRow<Project>('projects', p)

export const deleteProject = async (id: string) => {
  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) throw error
}

export const listQuestions = async (projectId?: string) => {
  let q = supabase.from('project_questions').select('*').order('idx')
  if (projectId) q = q.eq('project_id', projectId)
  return ok<ProjectQuestion[]>(await q)
}

export const saveQuestion = (q: Partial<ProjectQuestion>) => saveRow<ProjectQuestion>('project_questions', q)

export const deleteQuestion = async (id: string) => {
  const { error } = await supabase.from('project_questions').delete().eq('id', id)
  if (error) throw error
}

export const listEnrollments = async (projectId?: string) => {
  let q = supabase.from('project_enrollments').select('*')
  if (projectId) q = q.eq('project_id', projectId)
  return ok<{ id: string; project_id: string; student_id: string }[]>(await q)
}

export const setEnrollments = async (projectId: string, studentIds: string[]) => {
  const { error: delErr } = await supabase.from('project_enrollments').delete().eq('project_id', projectId)
  if (delErr) throw delErr
  if (!studentIds.length) return
  const { error } = await supabase
    .from('project_enrollments')
    .insert(studentIds.map((s) => ({ project_id: projectId, student_id: s })))
  if (error) throw error
}

export const listProgress = async (opts: { studentId?: string; questionIds?: string[] } = {}) => {
  let q = supabase.from('student_project_progress').select('*')
  if (opts.studentId) q = q.eq('student_id', opts.studentId)
  if (opts.questionIds?.length) q = q.in('question_id', opts.questionIds)
  return ok<StudentProjectProgress[]>(await q)
}

export const saveProgress = async (p: Partial<StudentProjectProgress>) =>
  ok<StudentProjectProgress>(
    await supabase.from('student_project_progress').upsert(p, { onConflict: 'student_id,question_id' }).select().single(),
  )

/* ================================ الرسائل ================================ */
export const listMessages = async () =>
  ok<Message[]>(await supabase.from('messages').select('*').order('created_at', { ascending: false }))

export const sendMessage = async (p: {
  title: string
  body?: string | null
  audienceType: 'student' | 'group' | 'year' | 'all'
  studentIds?: string[]
  groupIds?: string[]
  yearIds?: string[]
  fileIds?: string[]
}) => {
  const { data, error } = await supabase.rpc('send_message', {
    p_title: p.title,
    p_body: p.body ?? null,
    p_audience_type: p.audienceType,
    p_student_ids: p.studentIds ?? [],
    p_group_ids: p.groupIds ?? [],
    p_year_ids: p.yearIds ?? [],
    p_file_ids: p.fileIds ?? [],
  })
  if (error) throw error
  return data as string
}

export const deleteMessage = async (id: string) => {
  const { error } = await supabase.from('messages').delete().eq('id', id)
  if (error) throw error
}

export const listMyMessages = async (studentId: string) => {
  const res = await supabase
    .from('message_recipients')
    .select('id, read_at, messages(*)')
    .eq('student_id', studentId)
    .order('id', { ascending: false })
  if (res.error) throw res.error
  return (res.data ?? []) as unknown as { id: string; read_at: string | null; messages: Message }[]
}

export const markMessageRead = async (recipientId: string) => {
  const { error } = await supabase
    .from('message_recipients')
    .update({ read_at: new Date().toISOString() })
    .eq('id', recipientId)
  if (error) throw error
}

/* ================================ الملفات ================================ */
export const listFiles = async () =>
  ok<FileRow[]>(await supabase.from('files').select('*').order('created_at', { ascending: false }))

export const uploadFile = async (file: File) => {
  const safe = file.name.replace(/[^\w.\-؀-ۿ]/g, '_')
  const path = `${new Date().getFullYear()}/${Date.now()}-${safe}`
  const { error: upErr } = await supabase.storage.from('files').upload(path, file, { upsert: false })
  if (upErr) throw upErr
  return ok<FileRow>(
    await supabase
      .from('files')
      .insert({ name: file.name, path, mime: file.type, size: file.size })
      .select()
      .single(),
  )
}

export const fileUrl = async (path: string, seconds = 3600) => {
  const { data, error } = await supabase.storage.from('files').createSignedUrl(path, seconds)
  if (error) throw error
  return data.signedUrl
}

export const deleteFile = async (f: FileRow) => {
  await supabase.storage.from('files').remove([f.path])
  const { error } = await supabase.from('files').delete().eq('id', f.id)
  if (error) throw error
}

export const listMessageFiles = async (messageIds: string[]) => {
  if (!messageIds.length) return [] as { message_id: string; file_id: string; files: FileRow }[]
  const res = await supabase.from('message_files').select('message_id, file_id, files(*)').in('message_id', messageIds)
  if (res.error) throw res.error
  return (res.data ?? []) as unknown as { message_id: string; file_id: string; files: FileRow }[]
}

/** رفع صورة الهوية البصرية إلى حاوية عامة */
export const uploadBranding = async (file: File, kind: 'logo' | 'icon' | 'avatar') => {
  const ext = file.name.split('.').pop() || 'png'
  const path = `${kind}-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('branding').upload(path, file, { upsert: true })
  if (error) throw error
  return supabase.storage.from('branding').getPublicUrl(path).data.publicUrl
}

/* ================================ الإشعارات ================================ */
export const listNotifications = async (studentId?: string) => {
  let q = supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100)
  if (studentId) q = q.eq('student_id', studentId)
  return ok<Notification[]>(await q)
}

export const markNotificationRead = async (id: string) => {
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export const markAllNotificationsRead = async (studentId: string) => {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('student_id', studentId)
    .is('read_at', null)
  if (error) throw error
}

/* ================================ الإعدادات ================================ */
export const getSettings = async () =>
  ok<AppSettings>(await supabase.from('app_settings').select('*').eq('id', 1).single())

export const saveSettings = async (s: Partial<AppSettings>) =>
  ok<AppSettings>(
    await supabase.from('app_settings').update({ ...s, updated_at: new Date().toISOString() }).eq('id', 1).select().single(),
  )

/* =============================== لوحة المعلومات ===============================*/
export const dashboardStats = async () => ok<DashboardStats>(await supabase.rpc('dashboard_stats'))

/* =============================== سجل العمليات =============================== */
export const listAuditLogs = async (limit = 200) =>
  ok<AuditLog[]>(await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(limit))

export const logAction = async (action: string, entity: string, entityId?: string, meta?: Record<string, unknown>) => {
  await supabase.from('audit_logs').insert({ action, entity, entity_id: entityId ?? null, meta: meta ?? null })
}
