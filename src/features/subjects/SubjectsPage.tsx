import { useEffect, useMemo, useState } from 'react'
import { BookOpen, MoreVertical, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { SearchInput } from '@/components/common/SearchInput'
import {
  Badge, Button, Card, Dropdown, DropdownContent, DropdownItem, DropdownTrigger,
  EmptyState, Field, Input, ListSkeleton, Modal, Select, Switch, Textarea, useConfirm,
} from '@/components/ui'
import { useAction, useLookups, useStudentSubjects, useSubjects } from '@/lib/hooks'
import * as api from '@/lib/api'
import type { Subject } from '@/lib/database.types'
import { matches } from '@/lib/utils'
import { fmtMoney } from '@/lib/format'
import { useSettings } from '@/store/settings'

export default function SubjectsPage() {
  const { data: subjects = [], isLoading } = useSubjects()
  const { years, yearName } = useLookups()
  const { data: allEnroll = [] } = useStudentSubjects()
  const { settings } = useSettings()
  const confirm = useConfirm()

  const [q, setQ] = useState('')
  const [year, setYear] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Subject | null>(null)

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of allEnroll) if (e.is_active) m.set(e.subject_id, (m.get(e.subject_id) ?? 0) + 1)
    return m
  }, [allEnroll])

  const filtered = useMemo(
    () => subjects.filter((s) => (!year || s.year_id === year) && matches(s.name, q)),
    [subjects, year, q],
  )

  const remove = useAction(api.deleteSubject, {
    success: 'تم حذف المادة',
    invalidate: [['subjects'], ['student_subjects'], ['charges'], ['dashboard']],
  })

  const grouped = useMemo(() => {
    const m = new Map<string, Subject[]>()
    for (const s of filtered) {
      const k = s.year_id
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(s)
    }
    return [...m.entries()]
  }, [filtered])

  return (
    <div>
      <PageHeader
        title="المواد الدراسية"
        icon={BookOpen}
        subtitle={`${subjects.length} مادة — كل مادة لها سعرها وعدد حصص دورتها`}
        actions={
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true) }} disabled={years.length === 0}>
            <Plus className="size-4" /> مادة جديدة
          </Button>
        }
      />

      <div className="mb-4 flex gap-2">
        <SearchInput value={q} onChange={setQ} className="flex-1" placeholder="ابحث عن مادة…" />
        <Select value={year} onChange={(e) => setYear(e.target.value)} className="w-44 shrink-0">
          <option value="">كل السنوات</option>
          {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
        </Select>
      </div>

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : years.length === 0 ? (
        <Card>
          <EmptyState
            icon={BookOpen}
            title="أضف سنة دراسية أولًا"
            description="المواد تُربط بسنة دراسية — ابدأ بإنشاء السنوات من صفحة المجموعات والسنوات."
            action={<Button size="sm" asChild><a href="/groups">السنوات والمجموعات</a></Button>}
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={BookOpen}
            title={subjects.length === 0 ? 'لسه مفيش مواد هنا' : 'لا توجد نتائج'}
            description={subjects.length === 0 ? 'أضف أول مادة مع سعرها وعدد حصص الدورة (الافتراضي 4 حصص).' : 'جرّب كلمة بحث أخرى.'}
            action={subjects.length === 0 ? <Button onClick={() => { setEditing(null); setOpen(true) }}><Plus className="size-4" /> إضافة مادة</Button> : undefined}
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {grouped.map(([yid, list]) => (
            <div key={yid}>
              <h2 className="mb-2 flex items-center gap-2 text-[13px] font-bold text-ink-2">
                {yearName.get(yid) ?? 'بدون سنة'}
                <Badge tone="neutral" className="num">{list.length}</Badge>
              </h2>
              <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                {list.map((s) => (
                  <Card key={s.id} className="animate-fade-up p-4">
                    <div className="flex items-start gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in oklab, ${s.color || '#2563eb'} 14%, transparent)`, color: s.color || '#2563eb' }}>
                        <BookOpen className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14.5px] font-bold text-ink">{s.name}</p>
                        <p className="num text-[12px] text-muted">{s.sessions_per_cycle} حصص لكل دورة</p>
                      </div>
                      <Dropdown>
                        <DropdownTrigger asChild>
                          <Button variant="ghost" size="iconSm" aria-label="خيارات"><MoreVertical className="size-4" /></Button>
                        </DropdownTrigger>
                        <DropdownContent>
                          <DropdownItem onSelect={() => { setEditing(s); setOpen(true) }}>
                            <Pencil className="size-4" /> تعديل
                          </DropdownItem>
                          <DropdownItem
                            danger
                            onSelect={() =>
                              confirm({
                                title: 'حذف المادة',
                                message: `سيتم حذف «${s.name}» وإلغاء تسجيل الطلاب بها وحصصها. لا يمكن التراجع.`,
                                onConfirm: () => remove.mutateAsync(s.id),
                              })
                            }
                          >
                            <Trash2 className="size-4" /> حذف
                          </DropdownItem>
                        </DropdownContent>
                      </Dropdown>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                      <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-2">
                        <Users className="size-3.5" /> <span className="num">{counts.get(s.id) ?? 0}</span> طالب
                      </span>
                      <span className="num text-[14px] font-extrabold text-ink">{fmtMoney(s.price, settings.currency_symbol)}</span>
                    </div>
                    {!s.is_active && <Badge tone="warning" className="mt-2">موقوفة</Badge>}
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <SubjectForm open={open} onOpenChange={setOpen} subject={editing} />
    </div>
  )
}

function SubjectForm({ open, onOpenChange, subject }: { open: boolean; onOpenChange: (v: boolean) => void; subject: Subject | null }) {
  const { years } = useLookups()
  const { settings } = useSettings()
  const [form, setForm] = useState({
    name: '', year_id: '', price: '', sessions_per_cycle: String(settings.default_sessions_per_cycle),
    color: '#2563eb', is_active: true, notes: '',
  })

  const key = `${open}-${subject?.id ?? 'new'}`
  useEffect(() => {
    if (!open) return
    if (subject) {
      setForm({
        name: subject.name, year_id: subject.year_id, price: String(subject.price),
        sessions_per_cycle: String(subject.sessions_per_cycle), color: subject.color ?? '#2563eb',
        is_active: subject.is_active, notes: subject.notes ?? '',
      })
    } else {
      setForm({ name: '', year_id: years[0]?.id ?? '', price: '', sessions_per_cycle: String(settings.default_sessions_per_cycle), color: '#2563eb', is_active: true, notes: '' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const save = useAction(
    async () => {
      if (!form.name.trim()) throw new Error('اسم المادة مطلوب')
      if (!form.year_id) throw new Error('اختر السنة الدراسية')
      return api.saveSubject({
        ...(subject ? { id: subject.id } : {}),
        name: form.name.trim(),
        year_id: form.year_id,
        price: Number(form.price || 0),
        sessions_per_cycle: Math.max(1, Number(form.sessions_per_cycle || 4)),
        color: form.color,
        is_active: form.is_active,
        notes: form.notes.trim() || null,
      })
    },
    {
      success: subject ? 'تم تحديث المادة ✓' : 'تم إضافة المادة ✓',
      invalidate: [['subjects'], ['dashboard']],
      onDone: () => onOpenChange(false),
    },
  )

  const COLORS = ['#2563eb', '#0d9488', '#7c3aed', '#c2410c', '#0369a1', '#b91c1c', '#4d7c0f', '#a21caf']

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={subject ? 'تعديل المادة' : 'مادة جديدة'}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={() => save.mutate(undefined as never)} loading={save.isPending}>حفظ</Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <Field label="اسم المادة" required>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: كهرباء" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="السنة الدراسية" required>
            <Select value={form.year_id} onChange={(e) => setForm({ ...form, year_id: e.target.value })}>
              <option value="">— اختر —</option>
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </Select>
          </Field>
          <Field label={`سعر الدورة (${settings.currency_symbol})`} required>
            <Input dir="ltr" inputMode="decimal" className="num text-right" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="500" />
          </Field>
          <Field label="عدد الحصص في الدورة" hint="الافتراضي 4 حصص منفّذة فعليًا">
            <Input dir="ltr" inputMode="numeric" className="num text-right" value={form.sessions_per_cycle} onChange={(e) => setForm({ ...form, sessions_per_cycle: e.target.value })} />
          </Field>
          <Field label="اللون المميّز">
            <div className="flex flex-wrap gap-1.5 pt-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className={`size-8 rounded-lg transition ${form.color === c ? 'ring-2 ring-offset-2 ring-offset-[var(--surface)]' : ''}`}
                  style={{ background: c, boxShadow: form.color === c ? `0 0 0 2px ${c}` : undefined }}
                  aria-label={c}
                />
              ))}
            </div>
          </Field>
        </div>
        <Field label="ملاحظات">
          <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="اختياري…" />
        </Field>
        <label className="flex items-center justify-between rounded-xl bg-surface-2 p-3">
          <span className="text-[13px] font-semibold text-ink">المادة مفعّلة</span>
          <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
        </label>
      </div>
    </Modal>
  )
}
