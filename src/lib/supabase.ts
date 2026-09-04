import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && anon && url.startsWith('http'))

export const STUDENT_EMAIL_DOMAIN =
  (import.meta.env.VITE_STUDENT_EMAIL_DOMAIN as string | undefined) || 'students.moallem.app'

/** بريد داخلي يُشتق من كود الطالب — لا يُعرض للمستخدم */
export const studentEmail = (code: string) =>
  `${code.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')}@${STUDENT_EMAIL_DOMAIN}`

export const supabase = createClient<Database>(url ?? 'http://localhost', anon ?? 'public-anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'moallem.auth',
  },
  global: { headers: { 'x-application-name': 'moallem-pwa' } },
})

/** رسالة خطأ عربية مفهومة بدل رسائل Supabase الإنجليزية */
export function humanError(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e ?? '')
  const map: Record<string, string> = {
    'Invalid login credentials': 'بيانات الدخول غير صحيحة',
    'Email not confirmed': 'لم يتم تأكيد البريد بعد',
    'User already registered': 'هذا الحساب موجود بالفعل',
    'JWT expired': 'انتهت الجلسة، سجّل الدخول مرة أخرى',
    'Failed to fetch': 'تعذّر الاتصال بالخادم — تحقّق من الإنترنت',
    'duplicate key value violates unique constraint': 'هذا السجل موجود بالفعل',
    'new row violates row-level security policy': 'ليس لديك صلاحية لهذه العملية',
  }
  for (const [k, v] of Object.entries(map)) if (m.includes(k)) return v
  if (m.includes('غير مصرّح')) return 'ليس لديك صلاحية لهذه العملية'
  return m || 'حدث خطأ غير متوقع'
}
