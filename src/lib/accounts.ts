import { supabase } from './supabase'

async function call(action: 'create' | 'reset' | 'disable', studentId: string, pin?: string) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('انتهت الجلسة، سجّل الدخول مرة أخرى')

  const res = await fetch('/api/students-account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, studentId, pin }),
  })

  let json: { error?: string; pin?: string; code?: string; ok?: boolean } = {}
  try {
    json = await res.json()
  } catch {
    throw new Error('خدمة الحسابات غير متاحة — تعمل فقط بعد النشر على Vercel')
  }
  if (!res.ok) throw new Error(json.error || 'تعذّر تنفيذ العملية')
  return json
}

/** إنشاء حساب دخول للطالب وإرجاع الرمز السري لعرضه مرة واحدة */
export const createStudentAccount = (studentId: string, pin?: string) => call('create', studentId, pin)
export const resetStudentPin = (studentId: string, pin?: string) => call('reset', studentId, pin)
export const disableStudentAccount = (studentId: string) => call('disable', studentId)
