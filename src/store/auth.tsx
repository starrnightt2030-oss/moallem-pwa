import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, studentEmail, humanError, withTimeout, purgeStoredSession } from '@/lib/supabase'
import type { Profile, Student } from '@/lib/database.types'

interface AuthValue {
  session: Session | null
  profile: Profile | null
  student: Student | null
  loading: boolean
  isAdmin: boolean
  isStudent: boolean
  signInAdmin: (email: string, password: string) => Promise<void>
  signInStudent: (code: string, pin: string) => Promise<void>
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

const Ctx = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [student, setStudent] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(s: Session | null) {
    if (!s?.user) {
      setProfile(null)
      setStudent(null)
      return
    }
    try {
      const { data: p } = await withTimeout(
        supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle(),
        10_000,
      )
      setProfile((p as Profile) ?? null)
      if (p?.student_id) {
        const { data: st } = await withTimeout(
          supabase.from('students').select('*').eq('id', p.student_id).maybeSingle(),
          10_000,
        )
        setStudent((st as Student) ?? null)
      } else {
        setStudent(null)
      }
    } catch {
      // تعذّر جلب الملف الشخصي — لا نُبقي المستخدم عالقًا على شاشة التحميل
      setProfile(null)
      setStudent(null)
    }
  }

  /** جلسة مخزّنة تالفة أو منتهية: نمسحها محليًا ونعرض شاشة الدخول */
  async function clearStaleSession() {
    // نمسح التخزين أولًا: يعمل حتى لو كانت المكتبة عالقة
    purgeStoredSession()
    try {
      await withTimeout(supabase.auth.signOut({ scope: 'local' }), 4000)
    } catch {
      /* تجاهل — التخزين اتمسح بالفعل */
    }
    setSession(null)
    setProfile(null)
    setStudent(null)
  }

  useEffect(() => {
    let alive = true
    const done = () => { if (alive) setLoading(false) }

    // مهلة أمان: مهما حصل، لا يبقى المستخدم على شاشة التحميل للأبد
    const guard = setTimeout(done, 8000)

    withTimeout(supabase.auth.getSession(), 8000)
      .then(async ({ data, error }) => {
        if (!alive) return
        if (error) {
          // توكن قديم أو منتهي (تجديد الجلسة رجع خطأ) — نبدأ من جديد
          await clearStaleSession()
          return
        }

        let current = data.session

        // جلسة منتهية أو على وشك الانتهاء: نجدّدها قبل استخدامها.
        // لو فشل التجديد فالتوكن المخزّن غير صالح — نمسحه ونعرض شاشة الدخول
        // بدلًا من ترك المستخدم في حالة «داخل لكن بلا بيانات».
        if (current?.expires_at && current.expires_at * 1000 < Date.now() + 10_000) {
          const { data: refreshed, error: refreshError } = await withTimeout(
            supabase.auth.refreshSession(),
            8000,
          ).catch(() => ({ data: { session: null }, error: new Error('refresh timeout') }))
          if (!alive) return
          if (refreshError || !refreshed.session) {
            await clearStaleSession()
            return
          }
          current = refreshed.session
        }

        setSession(current)
        await loadProfile(current)
      })
      .catch(async () => {
        if (!alive) return
        await clearStaleSession()
      })
      .finally(() => {
        clearTimeout(guard)
        done()
      })

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!alive) return

      if (event === 'SIGNED_OUT' || !s) {
        setSession(null)
        setProfile(null)
        setStudent(null)
        done()
        return
      }

      setSession(s)

      /**
       * مهم جدًا: ممنوع مناداة أي دالة من Supabase (مثل from().select())
       * داخل هذا الـ callback مباشرةً — عميل المصادقة يكون ما زال ممسكًا
       * بعمليته الداخلية، وأي استعلام يحتاج الجلسة فينتظرها، فيحدث تعليق
       * متبادل (deadlock) ولا يكتمل تحميل بيانات المستخدم أبدًا.
       * الحل الموصى به رسميًا: تأجيل العمل خارج الـ callback.
       */
      setTimeout(() => {
        if (!alive) return
        loadProfile(s).finally(done)
      }, 0)
    })

    return () => {
      alive = false
      clearTimeout(guard)
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      session,
      profile,
      student,
      loading,
      isAdmin: profile?.role === 'admin',
      isStudent: profile?.role === 'student',
      async signInAdmin(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw new Error(humanError(error))
      },
      async signInStudent(code, pin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: studentEmail(code),
          password: pin.trim(),
        })
        if (error) throw new Error('كود الطالب أو الرمز السري غير صحيح')
      },
      async signOut() {
        await supabase.auth.signOut()
        setProfile(null)
        setStudent(null)
      },
      async refresh() {
        const { data } = await supabase.auth.getSession()
        setSession(data.session)
        await loadProfile(data.session)
      },
    }),
    [session, profile, student, loading],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used inside AuthProvider')
  return v
}
