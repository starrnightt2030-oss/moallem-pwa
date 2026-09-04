import { useState } from 'react'
import { GraduationCap, KeyRound, Lock, Mail, School, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/store/auth'
import { useSettings } from '@/store/settings'
import { Button, Card, Field, Input, Segmented } from '@/components/ui'

type Mode = 'teacher' | 'student'

export default function LoginPage() {
  const { signInAdmin, signInStudent } = useAuth()
  const { settings } = useSettings()
  const [mode, setMode] = useState<Mode>('teacher')
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [pin, setPin] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      if (mode === 'teacher') await signInAdmin(email, password)
      else await signInStudent(code, pin)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-bg p-5">
      <div
        className="pointer-events-none absolute -top-40 right-1/2 size-[560px] translate-x-1/2 rounded-full opacity-25 blur-3xl"
        style={{ background: `radial-gradient(circle, ${settings.primary_color}, transparent 65%)` }}
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          {settings.logo_url ? (
            <img src={settings.logo_url} alt="" className="size-16 rounded-2xl object-cover shadow-[var(--shadow-2)]" />
          ) : (
            <span className="grid size-16 place-items-center rounded-2xl bg-[var(--brand)] text-white shadow-[var(--shadow-2)]">
              <School className="size-8" />
            </span>
          )}
          <h1 className="mt-4 text-2xl font-extrabold text-ink">{settings.app_name}</h1>
          <p className="mt-1 text-[13px] text-ink-2">{settings.tagline || 'إدارة الدروس والطلاب'}</p>
        </div>

        <Card className="p-5 shadow-[var(--shadow-2)]">
          <Segmented
            className="mb-5 w-full [&>button]:flex-1"
            value={mode}
            onChange={(v) => setMode(v)}
            options={[
              { value: 'teacher', label: <span className="inline-flex items-center gap-1.5"><UserRound className="size-3.5" /> المدرّس</span> },
              { value: 'student', label: <span className="inline-flex items-center gap-1.5"><GraduationCap className="size-3.5" /> طالب</span> },
            ]}
          />

          <form onSubmit={submit} className="space-y-3.5">
            {mode === 'teacher' ? (
              <>
                <Field label="البريد الإلكتروني" required>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                    <Input
                      dir="ltr"
                      type="email"
                      autoComplete="username"
                      className="pr-10 text-right"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="teacher@example.com"
                    />
                  </div>
                </Field>
                <Field label="كلمة المرور" required>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                    <Input
                      type="password"
                      autoComplete="current-password"
                      className="pr-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                    />
                  </div>
                </Field>
              </>
            ) : (
              <>
                <Field label="كود الطالب" required hint="مثال: ST-2026-001">
                  <div className="relative">
                    <GraduationCap className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                    <Input
                      dir="ltr"
                      className="num pr-10 text-right uppercase"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      required
                      placeholder="ST-2026-001"
                    />
                  </div>
                </Field>
                <Field label="الرمز السري" required hint="الرمز الذي أعطاه لك المدرّس">
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                    <Input
                      type="password"
                      inputMode="numeric"
                      className="num pr-10"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      required
                      placeholder="••••••"
                    />
                  </div>
                </Field>
              </>
            )}

            <Button type="submit" block size="lg" loading={busy}>
              دخول
            </Button>
          </form>
        </Card>

        <p className="mt-5 text-center text-[11.5px] leading-relaxed text-muted">
          {settings.teacher_name ? `${settings.teacher_name} — ` : ''}
          جميع البيانات محفوظة ومحميّة
        </p>
      </div>
    </div>
  )
}
