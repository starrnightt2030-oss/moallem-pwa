/**
 * دالة خادم (Vercel Serverless) لإدارة حسابات دخول الطلاب.
 * تستخدم مفتاح الخدمة service_role — لا يصل هذا المفتاح للمتصفح إطلاقًا.
 *
 * الأمان: كل طلب يجب أن يحمل رأس Authorization بتوكن المدير،
 * ويتم التحقق من أن صاحب التوكن دوره admin قبل أي عملية.
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const DOMAIN = process.env.STUDENT_EMAIL_DOMAIN || process.env.VITE_STUDENT_EMAIL_DOMAIN || 'students.moallem.app'

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const studentEmail = (code: string) =>
  `${String(code).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')}@${DOMAIN}`

const randomPin = () => String(Math.floor(100000 + Math.random() * 900000))

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'الطريقة غير مسموحة' })
    return
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    res.status(500).json({ error: 'إعدادات الخادم ناقصة (SUPABASE_SERVICE_ROLE_KEY)' })
    return
  }

  try {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if (!token) return res.status(401).json({ error: 'مطلوب تسجيل الدخول' })

    const { data: userData, error: userErr } = await admin.auth.getUser(token)
    if (userErr || !userData?.user) return res.status(401).json({ error: 'جلسة غير صالحة' })

    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .maybeSingle()

    if (profile?.role !== 'admin') return res.status(403).json({ error: 'هذه العملية للمدير فقط' })

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const { action, studentId } = body as { action?: string; studentId?: string; pin?: string }
    if (!studentId) return res.status(400).json({ error: 'معرّف الطالب مطلوب' })

    const { data: student, error: stErr } = await admin
      .from('students')
      .select('id, code, full_name, auth_user_id')
      .eq('id', studentId)
      .maybeSingle()
    if (stErr || !student) return res.status(404).json({ error: 'الطالب غير موجود' })

    const email = studentEmail(student.code)
    const pin = (body.pin && String(body.pin).trim()) || randomPin()

    if (action === 'create') {
      if (student.auth_user_id) {
        await admin.auth.admin.updateUserById(student.auth_user_id, { password: pin })
        return res.status(200).json({ ok: true, code: student.code, pin, existed: true })
      }

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: pin,
        email_confirm: true,
        user_metadata: { role: 'student', student_id: student.id, full_name: student.full_name },
      })

      if (createErr) {
        // الحساب موجود مسبقًا بنفس البريد — أعد ربطه
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
        const found = list?.users?.find((u: any) => u.email?.toLowerCase() === email)
        if (!found) return res.status(400).json({ error: createErr.message })
        await admin.auth.admin.updateUserById(found.id, {
          password: pin,
          user_metadata: { role: 'student', student_id: student.id, full_name: student.full_name },
        })
        await admin.from('profiles').upsert({ id: found.id, role: 'student', student_id: student.id, full_name: student.full_name })
        await admin.from('students').update({ auth_user_id: found.id, has_account: true }).eq('id', student.id)
        return res.status(200).json({ ok: true, code: student.code, pin, existed: true })
      }

      await admin.from('profiles').upsert({
        id: created.user.id, role: 'student', student_id: student.id, full_name: student.full_name,
      })
      await admin.from('students').update({ auth_user_id: created.user.id, has_account: true }).eq('id', student.id)
      await admin.from('audit_logs').insert({
        actor_id: userData.user.id, action: 'create_student_account', entity: 'students', entity_id: student.id,
      })
      return res.status(200).json({ ok: true, code: student.code, pin })
    }

    if (action === 'reset') {
      if (!student.auth_user_id) return res.status(400).json({ error: 'لا يوجد حساب لهذا الطالب بعد' })
      const { error } = await admin.auth.admin.updateUserById(student.auth_user_id, { password: pin })
      if (error) return res.status(400).json({ error: error.message })
      await admin.from('audit_logs').insert({
        actor_id: userData.user.id, action: 'reset_student_pin', entity: 'students', entity_id: student.id,
      })
      return res.status(200).json({ ok: true, code: student.code, pin })
    }

    if (action === 'disable') {
      if (student.auth_user_id) await admin.auth.admin.deleteUser(student.auth_user_id)
      await admin.from('students').update({ auth_user_id: null, has_account: false }).eq('id', student.id)
      await admin.from('audit_logs').insert({
        actor_id: userData.user.id, action: 'disable_student_account', entity: 'students', entity_id: student.id,
      })
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: 'إجراء غير معروف' })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'خطأ داخلي' })
  }
}
