import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, studentEmail, humanError } from '@/lib/supabase'
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
    const { data: p } = await supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle()
    setProfile((p as Profile) ?? null)
    if (p?.student_id) {
      const { data: st } = await supabase.from('students').select('*').eq('id', p.student_id).maybeSingle()
      setStudent((st as Student) ?? null)
    } else {
      setStudent(null)
    }
  }

  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      setSession(data.session)
      await loadProfile(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s)
      await loadProfile(s)
      setLoading(false)
    })
    return () => {
      alive = false
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
