import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Copy, RefreshCw } from 'lucide-react'
import { Button, Field, Input, Modal, Select, Textarea, Switch, Badge } from '@/components/ui'
import { useAction, useLookups, useStudentSubjects } from '@/lib/hooks'
import * as api from '@/lib/api'
import type { Student } from '@/lib/database.types'
import { copyText } from '@/lib/utils'
import { fmtMoney, todayISO } from '@/lib/format'
import { useSettings } from '@/store/settings'

export function StudentForm({
  open,
  onOpenChange,
  student,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  student?: Student | null
}) {
  const { years, groups, subjects } = useLookups()
  const { settings } = useSettings()
  const { data: existing = [] } = useStudentSubjects(student?.id)

  const [form, setForm] = useState({
    full_name: '', code: '', phone: '', guardian_phone: '',
    year_id: '', group_id: '', status: 'active' as 'active' | 'inactive',
    enrolled_at: todayISO(), notes: '',
  })
  const [picked, setPicked] = useState<Record<string, { on: boolean; price: string }>>({})

  useEffect(() => {
    if (!open) return
    if (student) {
      setForm({
        full_name: student.full_name, code: student.code, phone: student.phone ?? '',
        guardian_phone: student.guardian_phone ?? '', year_id: student.year_id ?? '',
        group_id: student.group_id ?? '', status: student.status,
        enrolled_at: student.enrolled_at, notes: student.notes ?? '',
      })
    } else {
      setForm({ full_name: '', code: '', phone: '', guardian_phone: '', year_id: years[0]?.id ?? '', group_id: '', status: 'active', enrolled_at: todayISO(), notes: '' })
      setPicked({})
    }
  }, [open, student, years])

  useEffect(() => {
    if (!open || !student) return
    const m: Record<string, { on: boolean; price: string }> = {}
    for (const ss of existing) m[ss.subject_id] = { on: ss.is_active, price: ss.price_override != null ? String(ss.price_override) : '' }
    setPicked(m)
  }, [open, student, existing])

  const yearGroups = useMemo(() => groups.filter((g) => g.year_id === form.year_id), [groups, form.year_id])
  const yearSubjects = useMemo(() => subjects.filter((s) => s.year_id === form.year_id && s.is_active), [subjects, form.year_id])

  const total = useMemo(
    () =>
      yearSubjects.reduce((acc, s) => {
        const p = picked[s.id]
        if (!p?.on) return acc
        return acc + (p.price !== '' ? Number(p.price) : Number(s.price))
      }, 0),
    [yearSubjects, picked],
  )

  const save = useAction(
    async () => {
      if (!form.full_name.trim()) throw new Error('اسم الطالب مطلوب')
      const saved = await api.saveStudent({
        ...(student ? { id: student.id } : {}),
        full_name: form.full_name.trim(),
        code: form.code.trim() || undefined,
        phone: form.phone.trim() || null,
        guardian_phone: form.guardian_phone.trim() || null,
        year_id: form.year_id || null,
        group_id: form.group_id || null,
        status: form.status,
        enrolled_at: form.enrolled_at,
        notes: form.notes.trim() || null,
      } as Partial<Student>)

      // مزامنة المواد
      const current = new Map(existing.map((e) => [e.subject_id, e]))
      for (const s of yearSubjects) {
        const p = picked[s.id]
        const cur = current.get(s.id)
        if (p?.on) {
          await api.saveStudentSubject({
            ...(cur ? { id: cur.id } : {}),
            student_id: saved.id,
            subject_id: s.id,
            is_active: true,
            price_override: p.price !== '' ? Number(p.price) : null,
          })
        } else if (cur) {
          await api.removeStudentSubject(cur.id)
        }
      }
      return saved
    },
    {
      success: student ? 'تم تحديث بيانات الطالب ✓' : 'تم إضافة الطالب ✓',
      invalidate: [['students'], ['student_subjects'], ['charges'], ['cycles'], ['dashboard']],
      onDone: () => onOpenChange(false),
    },
  )

  const genCode = useAction(async () => api.nextStudentCode(), {
    onDone: (c) => setForm((f) => ({ ...f, code: c })),
  })

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={student ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد'}
      description={student ? student.code : 'يتم توليد كود الطالب تلقائيًا إذا تركته فارغًا'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={() => save.mutate(undefined as never)} loading={save.isPending}>حفظ</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="اسم الطالب" required className="sm:col-span-2">
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="الاسم الكامل" />
          </Field>

          <Field label="كود الطالب" hint={student ? 'الكود ثابت ولا يُنصح بتغييره' : 'اتركه فارغًا للتوليد التلقائي'}>
            <div className="flex gap-2">
              <Input dir="ltr" className="num text-right" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="ST-2026-001" />
              {student ? (
                <Button variant="secondary" size="icon" type="button" onClick={() => copyText(form.code).then(() => toast.success('تم نسخ الكود'))}>
                  <Copy className="size-4" />
                </Button>
              ) : (
                <Button variant="secondary" size="icon" type="button" loading={genCode.isPending} onClick={() => genCode.mutate(undefined as never)}>
                  <RefreshCw className="size-4" />
                </Button>
              )}
            </div>
          </Field>

          <Field label="تاريخ التسجيل">
            <Input type="date" dir="ltr" className="num text-right" value={form.enrolled_at} onChange={(e) => setForm({ ...form, enrolled_at: e.target.value })} />
          </Field>

          <Field label="رقم الهاتف">
            <Input dir="ltr" inputMode="tel" className="num text-right" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="01xxxxxxxxx" />
          </Field>

          <Field label="هاتف ولي الأمر">
            <Input dir="ltr" inputMode="tel" className="num text-right" value={form.guardian_phone} onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })} placeholder="01xxxxxxxxx" />
          </Field>

          <Field label="السنة الدراسية">
            <Select value={form.year_id} onChange={(e) => setForm({ ...form, year_id: e.target.value, group_id: '' })}>
              <option value="">— بدون —</option>
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </Select>
          </Field>

          <Field label="المجموعة">
            <Select value={form.group_id} onChange={(e) => setForm({ ...form, group_id: e.target.value })} disabled={!form.year_id}>
              <option value="">— بدون —</option>
              {yearGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </Field>
        </div>

        {/* ============ المواد المسجّل بها ============ */}
        <div className="rounded-xl border border-line p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[13px] font-bold text-ink">المواد المسجّل بها</p>
            <Badge tone={total > 0 ? 'brand' : 'neutral'}>
              إجمالي الدورة: <span className="num">{fmtMoney(total, settings.currency_symbol)}</span>
            </Badge>
          </div>
          {yearSubjects.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-muted">اختر سنة دراسية بها مواد أولًا</p>
          ) : (
            <div className="space-y-1.5">
              {yearSubjects.map((s) => {
                const p = picked[s.id] ?? { on: false, price: '' }
                return (
                  <div key={s.id} className="flex items-center gap-2.5 rounded-lg bg-surface-2 p-2.5">
                    <Switch checked={p.on} onCheckedChange={(v) => setPicked({ ...picked, [s.id]: { ...p, on: v } })} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-ink">{s.name}</p>
                      <p className="num text-[11px] text-muted">
                        السعر الافتراضي: {fmtMoney(s.price, settings.currency_symbol)} · {s.sessions_per_cycle} حصص/دورة
                      </p>
                    </div>
                    {p.on && (
                      <Input
                        dir="ltr"
                        inputMode="decimal"
                        className="num h-9 w-28 text-right"
                        placeholder={String(s.price)}
                        value={p.price}
                        onChange={(e) => setPicked({ ...picked, [s.id]: { ...p, price: e.target.value } })}
                      />
                    )}
                  </div>
                )
              })}
              <p className="pt-1 text-[11.5px] text-muted">
                اترك خانة السعر فارغة لاستخدام سعر المادة الافتراضي، أو اكتب سعرًا خاصًا لهذا الطالب.
              </p>
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="حالة الطالب">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })}>
              <option value="active">نشط</option>
              <option value="inactive">غير نشط</option>
            </Select>
          </Field>
          <Field label="ملاحظات" className="sm:col-span-2">
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="أي ملاحظات عن الطالب…" />
          </Field>
        </div>
      </div>
    </Modal>
  )
}
