import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Bell, Database, DollarSign, GraduationCap, Image as ImageIcon, Palette, Save,
  Settings as SettingsIcon, Shield, Upload, Download, ClipboardCheck, History, Trash2, Moon, Sun, MonitorSmartphone,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle, Field, Input, Segmented,
  Select, Switch, Textarea, EmptyState, ListSkeleton,
} from '@/components/ui'
import { useAction, useAuditLogs } from '@/lib/hooks'
import * as api from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { useSettings } from '@/store/settings'
import { useUi } from '@/store/ui'
import { useAuth } from '@/store/auth'
import type { AppSettings } from '@/lib/database.types'
import { exportCsv, downloadBlob } from '@/lib/utils'
import { fmtDateTime } from '@/lib/format'

const TABS = [
  { v: 'app', label: 'التطبيق', Icon: SettingsIcon },
  { v: 'branding', label: 'الهوية البصرية', Icon: Palette },
  { v: 'financial', label: 'المالية', Icon: DollarSign },
  { v: 'attendance', label: 'الحضور', Icon: ClipboardCheck },
  { v: 'student', label: 'واجهة الطالب', Icon: GraduationCap },
  { v: 'security', label: 'الأمان', Icon: Shield },
  { v: 'backup', label: 'النسخ الاحتياطي', Icon: Database },
  { v: 'audit', label: 'سجل العمليات', Icon: History },
]

export default function SettingsPage() {
  const { tab } = useParams()
  const nav = useNavigate()
  const active = TABS.some((t) => t.v === tab) ? tab! : 'app'
  const { settings, reload } = useSettings()
  const [form, setForm] = useState<AppSettings>(settings)

  useEffect(() => setForm(settings), [settings])

  const save = useAction(async (patch: Partial<AppSettings>) => api.saveSettings(patch), {
    success: 'تم حفظ الإعدادات ✓',
    onDone: () => reload(),
  })

  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => setForm({ ...form, [k]: v })

  return (
    <div>
      <PageHeader title="الإعدادات" icon={SettingsIcon} subtitle="خصّص التطبيق بالكامل ليناسب عملك" />

      <div className="no-scrollbar mb-4 flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.v}
            onClick={() => nav(t.v === 'app' ? '/settings' : `/settings/${t.v}`)}
            className={`tap flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition ${
              active === t.v ? 'bg-[color-mix(in_oklab,var(--brand)_13%,transparent)] text-[var(--brand)]' : 'text-ink-2 hover:bg-surface-2'
            }`}
          >
            <t.Icon className="size-4" /> {t.label}
          </button>
        ))}
      </div>

      {active === 'app' && (
        <SectionCard title="بيانات التطبيق والمدرّس" onSave={() =>
          save.mutate({
            app_name: form.app_name, short_name: form.short_name, tagline: form.tagline,
            teacher_name: form.teacher_name, teacher_phone: form.teacher_phone,
            teacher_email: form.teacher_email, teacher_address: form.teacher_address,
            report_header: form.report_header, report_footer: form.report_footer,
          })
        } busy={save.isPending}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="اسم التطبيق" required>
              <Input value={form.app_name} onChange={(e) => set('app_name', e.target.value)} />
            </Field>
            <Field label="الاسم المختصر" hint="يظهر تحت أيقونة التطبيق على الهاتف">
              <Input value={form.short_name} onChange={(e) => set('short_name', e.target.value)} />
            </Field>
            <Field label="الوصف / الشعار النصي" className="sm:col-span-2">
              <Input value={form.tagline ?? ''} onChange={(e) => set('tagline', e.target.value)} placeholder="إدارة الدروس والطلاب" />
            </Field>
            <Field label="اسم المدرّس">
              <Input value={form.teacher_name ?? ''} onChange={(e) => set('teacher_name', e.target.value)} />
            </Field>
            <Field label="رقم الهاتف">
              <Input dir="ltr" className="num text-right" value={form.teacher_phone ?? ''} onChange={(e) => set('teacher_phone', e.target.value)} />
            </Field>
            <Field label="البريد الإلكتروني">
              <Input dir="ltr" className="text-right" value={form.teacher_email ?? ''} onChange={(e) => set('teacher_email', e.target.value)} />
            </Field>
            <Field label="العنوان">
              <Input value={form.teacher_address ?? ''} onChange={(e) => set('teacher_address', e.target.value)} />
            </Field>
            <Field label="نص أعلى التقارير" className="sm:col-span-2">
              <Textarea value={form.report_header ?? ''} onChange={(e) => set('report_header', e.target.value)} placeholder="يظهر في أعلى كل تقرير مطبوع…" />
            </Field>
            <Field label="نص أسفل التقارير" className="sm:col-span-2">
              <Textarea value={form.report_footer ?? ''} onChange={(e) => set('report_footer', e.target.value)} placeholder="مثال: هذا التقرير صادر آليًا…" />
            </Field>
          </div>
        </SectionCard>
      )}

      {active === 'branding' && <BrandingTab form={form} set={set} save={save} />}

      {active === 'financial' && (
        <SectionCard title="الإعدادات المالية" onSave={() =>
          save.mutate({ currency: form.currency, currency_symbol: form.currency_symbol, charge_on_cycle_start: form.charge_on_cycle_start })
        } busy={save.isPending}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="رمز العملة" hint="يظهر بجوار كل مبلغ">
              <Input value={form.currency_symbol} onChange={(e) => set('currency_symbol', e.target.value)} placeholder="ج.م" />
            </Field>
            <Field label="كود العملة">
              <Select value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                <option value="EGP">EGP — جنيه مصري</option>
                <option value="SAR">SAR — ريال سعودي</option>
                <option value="AED">AED — درهم إماراتي</option>
                <option value="KWD">KWD — دينار كويتي</option>
                <option value="USD">USD — دولار</option>
              </Select>
            </Field>
          </div>
          <Toggle
            label="إنشاء المستحق عند بداية الدورة"
            hint="مفعّل: يُسجَّل المبلغ فور بدء الدورة. مطفأ: يُسجَّل بعد اكتمال الحصص الأربع."
            checked={form.charge_on_cycle_start}
            onChange={(v) => set('charge_on_cycle_start', v)}
          />
        </SectionCard>
      )}

      {active === 'attendance' && (
        <SectionCard title="سياسة الحضور والدورات" onSave={() =>
          save.mutate({ default_sessions_per_cycle: form.default_sessions_per_cycle, absence_counts_in_cycle: form.absence_counts_in_cycle })
        } busy={save.isPending}>
          <Field label="عدد الحصص الافتراضي في الدورة" hint="يُستخدم عند إنشاء مادة جديدة — كل مادة يمكن تغييرها بشكل مستقل">
            <Input
              dir="ltr" inputMode="numeric" className="num w-32 text-right"
              value={String(form.default_sessions_per_cycle)}
              onChange={(e) => set('default_sessions_per_cycle', Math.max(1, Number(e.target.value || 4)))}
            />
          </Field>
          <Toggle
            label="احتساب الغياب ضمن حصص الدورة"
            hint="مفعّل: الطالب الغائب تُحتسب عليه الحصة. مطفأ: لا تُحتسب إلا الحصص التي حضرها فعليًا."
            checked={form.absence_counts_in_cycle}
            onChange={(v) => set('absence_counts_in_cycle', v)}
          />
          <div className="rounded-xl bg-info-bg p-3 text-[12.5px] leading-relaxed text-info">
            في كل الأحوال: الحصة التي تؤجّلها أو تلغيها أنت <b>لا تُحتسب على الطالب إطلاقًا</b> — الدورة تُحسب من الحصص المنفّذة فعليًا فقط.
          </div>
        </SectionCard>
      )}

      {active === 'student' && (
        <SectionCard title="ما يراه الطالب" onSave={() =>
          save.mutate({
            student_can_view_history: form.student_can_view_history,
            student_can_view_attendance: form.student_can_view_attendance,
            student_can_view_files: form.student_can_view_files,
          })
        } busy={save.isPending}>
          <Toggle label="عرض تفاصيل المدفوعات السابقة" hint="مطفأ: يرى الطالب المستحق عليه حاليًا فقط." checked={form.student_can_view_history} onChange={(v) => set('student_can_view_history', v)} />
          <Toggle label="عرض سجل الحضور والغياب" checked={form.student_can_view_attendance} onChange={(v) => set('student_can_view_attendance', v)} />
          <Toggle label="عرض الملفات المرسلة" checked={form.student_can_view_files} onChange={(v) => set('student_can_view_files', v)} />
        </SectionCard>
      )}

      {active === 'security' && <SecurityTab />}
      {active === 'backup' && <BackupTab />}
      {active === 'audit' && <AuditTab />}
    </div>
  )
}

/* ------------------------------ عناصر مشتركة ------------------------------ */
function SectionCard({
  title, children, onSave, busy,
}: { title: string; children: React.ReactNode; onSave?: () => void; busy?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {onSave && <Button size="sm" onClick={onSave} loading={busy}><Save className="size-4" /> حفظ</Button>}
      </CardHeader>
      <CardContent className="space-y-3.5">{children}</CardContent>
    </Card>
  )
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-xl bg-surface-2 p-3.5">
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-2">{hint}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  )
}

/* ------------------------------ الهوية البصرية ------------------------------ */
function BrandingTab({
  form, set, save,
}: {
  form: AppSettings
  set: <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => void
  save: ReturnType<typeof useAction<Partial<AppSettings>, AppSettings>>
}) {
  const { theme, setTheme } = useUi()
  const logoRef = useRef<HTMLInputElement>(null)
  const iconRef = useRef<HTMLInputElement>(null)
  const avatarRef = useRef<HTMLInputElement>(null)

  const upload = useAction(
    async ({ file, kind }: { file: File; kind: 'logo' | 'icon' | 'avatar' }) => {
      const url = await api.uploadBranding(file, kind)
      return { url, kind }
    },
    {
      success: 'تم رفع الصورة ✓',
      onDone: ({ url, kind }) => {
        if (kind === 'logo') set('logo_url', url)
        if (kind === 'icon') set('icon_url', url)
        if (kind === 'avatar') set('avatar_url', url)
      },
    },
  )

  const PRESETS = [
    { p: '#2563eb', a: '#0d9488', n: 'أزرق' },
    { p: '#0d9488', a: '#2563eb', n: 'أخضر' },
    { p: '#7c3aed', a: '#db2777', n: 'بنفسجي' },
    { p: '#c2410c', a: '#b45309', n: 'برتقالي' },
    { p: '#0f172a', a: '#2563eb', n: 'كلاسيكي' },
    { p: '#be123c', a: '#7c3aed', n: 'أحمر' },
  ]

  return (
    <SectionCard
      title="الهوية البصرية"
      busy={save.isPending}
      onSave={() =>
        save.mutate({
          logo_url: form.logo_url, icon_url: form.icon_url, avatar_url: form.avatar_url,
          primary_color: form.primary_color, accent_color: form.accent_color, theme_mode: theme,
        })
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {([
          ['logo', 'شعار التطبيق', form.logo_url, logoRef],
          ['icon', 'أيقونة التطبيق', form.icon_url, iconRef],
          ['avatar', 'صورتك الشخصية', form.avatar_url, avatarRef],
        ] as const).map(([kind, label, url, ref]) => (
          <div key={kind} className="rounded-xl border border-line p-3 text-center">
            <p className="mb-2 text-[12.5px] font-semibold text-ink-2">{label}</p>
            <div className="mx-auto grid size-20 place-items-center overflow-hidden rounded-2xl bg-surface-2">
              {url ? <img src={url} alt="" className="size-full object-cover" /> : <ImageIcon className="size-7 text-muted" />}
            </div>
            <input
              ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) {
                  if (f.size > 2 * 1024 * 1024) return toast.error('الصورة أكبر من 2 ميجابايت')
                  upload.mutate({ file: f, kind })
                }
                e.target.value = ''
              }}
            />
            <div className="mt-2 flex justify-center gap-1.5">
              <Button variant="secondary" size="sm" onClick={() => ref.current?.click()} loading={upload.isPending}>
                <Upload className="size-3.5" /> رفع
              </Button>
              {url && (
                <Button variant="ghost" size="iconSm" aria-label="حذف"
                  onClick={() => set(kind === 'logo' ? 'logo_url' : kind === 'icon' ? 'icon_url' : 'avatar_url', null)}>
                  <Trash2 className="size-3.5 text-danger" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Field label="لوحة الألوان الجاهزة">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {PRESETS.map((c) => (
            <button
              key={c.n}
              type="button"
              onClick={() => { set('primary_color', c.p); set('accent_color', c.a) }}
              className={`tap rounded-xl border p-2 text-[11.5px] font-semibold transition ${
                form.primary_color === c.p ? 'border-[var(--brand)] text-[var(--brand)]' : 'border-line text-ink-2'
              }`}
            >
              <span className="mx-auto mb-1 flex h-5 w-full overflow-hidden rounded">
                <span className="flex-1" style={{ background: c.p }} />
                <span className="w-1/3" style={{ background: c.a }} />
              </span>
              {c.n}
            </button>
          ))}
        </div>
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="اللون الأساسي">
          <div className="flex items-center gap-2">
            <input type="color" value={form.primary_color} onChange={(e) => set('primary_color', e.target.value)} className="h-11 w-14 cursor-pointer rounded-lg border border-line bg-surface p-1" />
            <Input dir="ltr" className="num text-right" value={form.primary_color} onChange={(e) => set('primary_color', e.target.value)} />
          </div>
        </Field>
        <Field label="اللون الثانوي">
          <div className="flex items-center gap-2">
            <input type="color" value={form.accent_color} onChange={(e) => set('accent_color', e.target.value)} className="h-11 w-14 cursor-pointer rounded-lg border border-line bg-surface p-1" />
            <Input dir="ltr" className="num text-right" value={form.accent_color} onChange={(e) => set('accent_color', e.target.value)} />
          </div>
        </Field>
      </div>

      <Field label="وضع العرض">
        <Segmented
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'light', label: <span className="inline-flex items-center gap-1.5"><Sun className="size-3.5" /> فاتح</span> },
            { value: 'dark', label: <span className="inline-flex items-center gap-1.5"><Moon className="size-3.5" /> داكن</span> },
            { value: 'system', label: <span className="inline-flex items-center gap-1.5"><MonitorSmartphone className="size-3.5" /> النظام</span> },
          ]}
        />
      </Field>
    </SectionCard>
  )
}

/* --------------------------------- الأمان --------------------------------- */
function SecurityTab() {
  const { session } = useAuth()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')

  const change = useAction(
    async () => {
      if (pw.length < 8) throw new Error('كلمة المرور يجب أن تكون 8 أحرف على الأقل')
      if (pw !== pw2) throw new Error('كلمتا المرور غير متطابقتين')
      const { error } = await supabase.auth.updateUser({ password: pw })
      if (error) throw error
    },
    { success: 'تم تغيير كلمة المرور ✓', onDone: () => { setPw(''); setPw2('') } },
  )

  return (
    <div className="space-y-4">
      <SectionCard title="حساب المدرّس">
        <Field label="البريد الإلكتروني">
          <Input dir="ltr" className="text-right" value={session?.user.email ?? ''} disabled />
        </Field>
      </SectionCard>

      <SectionCard title="تغيير كلمة المرور" onSave={() => change.mutate(undefined as never)} busy={change.isPending}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="كلمة المرور الجديدة" required hint="8 أحرف على الأقل">
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
          </Field>
          <Field label="تأكيد كلمة المرور" required>
            <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
          </Field>
        </div>
      </SectionCard>

      <Card className="border-info-bg bg-info-bg p-4">
        <p className="text-[13px] font-bold text-info">ملاحظات أمنية مطبَّقة في النظام</p>
        <ul className="mt-2 space-y-1.5 text-[12.5px] leading-relaxed text-info">
          <li>• الصلاحيات مطبّقة على مستوى قاعدة البيانات (Row Level Security) وليس الواجهة فقط.</li>
          <li>• الطالب لا يستطيع رؤية أو تعديل بيانات أي طالب آخر — حتى لو حاول عبر الـ API.</li>
          <li>• كلمات المرور ورموز الطلاب مُشفَّرة داخل Supabase Auth ولا تُخزَّن مكشوفة.</li>
          <li>• مفتاح الخدمة (service_role) موجود على الخادم فقط ولا يصل للمتصفح إطلاقًا.</li>
          <li>• الملفات في حاوية خاصة وتُفتح عبر روابط موقّعة مؤقتة فقط.</li>
          <li>• السجلات المالية لا تُحذف نهائيًا — تُلغى مع بقاء الأثر في سجل العمليات.</li>
        </ul>
      </Card>
    </div>
  )
}

/* ----------------------------- النسخ الاحتياطي ----------------------------- */
function BackupTab() {
  const [busy, setBusy] = useState(false)

  async function exportAll() {
    setBusy(true)
    try {
      const tables = [
        'app_settings', 'academic_years', 'groups', 'subjects', 'students', 'student_subjects',
        'class_sessions', 'attendance', 'cycles', 'charges', 'payments', 'payment_allocations',
        'projects', 'project_questions', 'project_enrollments', 'student_project_progress',
        'messages', 'message_recipients', 'message_files', 'files', 'notifications',
      ]
      const dump: Record<string, unknown> = { exported_at: new Date().toISOString(), version: 1 }
      for (const t of tables) {
        const { data } = await supabase.from(t).select('*')
        dump[t] = data ?? []
      }
      downloadBlob(JSON.stringify(dump, null, 2), `نسخة-احتياطية-${new Date().toISOString().slice(0, 10)}.json`, 'application/json')
      toast.success('تم تنزيل النسخة الاحتياطية ✓')
    } catch {
      toast.error('تعذّر إنشاء النسخة الاحتياطية')
    } finally {
      setBusy(false)
    }
  }

  async function exportTable(name: string, label: string) {
    setBusy(true)
    try {
      const { data } = await supabase.from(name).select('*')
      if (!data?.length) return toast.info('لا توجد بيانات للتصدير')
      exportCsv(data as Record<string, unknown>[], `${label}-${new Date().toISOString().slice(0, 10)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <SectionCard title="نسخة احتياطية كاملة">
        <p className="text-[13px] leading-relaxed text-ink-2">
          ينزّل ملف JSON واحد يحتوي على كل بيانات النظام. احتفظ به في مكان آمن —
          يتيح لك استعادة بياناتك أو نقلها إلى منصة أخرى دون الاعتماد على مزوّد واحد.
        </p>
        <Button onClick={exportAll} loading={busy} block>
          <Download className="size-4" /> تنزيل نسخة احتياطية كاملة (JSON)
        </Button>
      </SectionCard>

      <SectionCard title="تصدير جداول محددة (CSV / Excel)">
        <div className="grid gap-2 sm:grid-cols-2">
          {([
            ['students', 'الطلاب'],
            ['charges', 'المستحقات'],
            ['payments', 'المدفوعات'],
            ['attendance', 'الحضور'],
            ['subjects', 'المواد'],
            ['class_sessions', 'الحصص'],
          ] as [string, string][]).map(([t, label]) => (
            <Button key={t} variant="secondary" onClick={() => exportTable(t, label)} disabled={busy}>
              <Download className="size-4" /> {label}
            </Button>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}

/* ----------------------------- سجل العمليات ----------------------------- */
const ACTION_LABEL: Record<string, string> = {
  save_attendance: 'تسجيل حضور',
  record_payment: 'تسجيل دفعة',
  void_payment: 'إلغاء دفعة',
  void_charge: 'إلغاء مستحق',
  add_bulk_charge: 'إضافة بند مالي',
  send_message: 'إرسال رسالة',
  create_student_account: 'إنشاء حساب طالب',
  reset_student_pin: 'تغيير رمز طالب',
  disable_student_account: 'إيقاف حساب طالب',
}

function AuditTab() {
  const { data: logs = [], isLoading } = useAuditLogs()
  if (isLoading) return <ListSkeleton rows={6} />
  if (logs.length === 0) return <Card><EmptyState icon={History} title="لا توجد عمليات مسجّلة بعد" /></Card>

  return (
    <Card className="divide-y divide-[var(--border)]">
      {logs.map((l) => (
        <div key={l.id} className="flex items-center gap-3 p-3.5">
          <Badge tone="neutral">{ACTION_LABEL[l.action] ?? l.action}</Badge>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] text-ink-2">{l.entity}</p>
            {l.meta ? <p className="num truncate text-[11px] text-muted">{JSON.stringify(l.meta)}</p> : null}
          </div>
          <span className="num shrink-0 text-[11.5px] text-muted">{fmtDateTime(l.created_at)}</span>
        </div>
      ))}
    </Card>
  )
}
