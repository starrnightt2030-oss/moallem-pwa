import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FolderKanban, MoreVertical, Pencil, Plus, Trash2, Users, ListChecks } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import {
  Badge, Button, Card, Dropdown, DropdownContent, DropdownItem, DropdownTrigger, EmptyState,
  Field, Input, ListSkeleton, Modal, Select, Switch, Textarea, useConfirm, Progress,
} from '@/components/ui'
import { useAction, useEnrollments, useLookups, useProjects, useQuestions } from '@/lib/hooks'
import * as api from '@/lib/api'
import type { Project } from '@/lib/database.types'

export default function ProjectsPage() {
  const { data: projects = [], isLoading } = useProjects()
  const { data: questions = [] } = useQuestions()
  const { data: enrollments = [] } = useEnrollments()
  const { years, yearName } = useLookups()
  const confirm = useConfirm()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)

  const stats = useMemo(() => {
    const q = new Map<string, number>()
    const e = new Map<string, number>()
    for (const x of questions) q.set(x.project_id, (q.get(x.project_id) ?? 0) + 1)
    for (const x of enrollments) e.set(x.project_id, (e.get(x.project_id) ?? 0) + 1)
    return { q, e }
  }, [questions, enrollments])

  const remove = useAction(api.deleteProject, { success: 'تم حذف المشروع', invalidate: [['projects'], ['questions'], ['enrollments']] })

  return (
    <div>
      <PageHeader
        title="مشاريع التخرج"
        icon={FolderKanban}
        subtitle="أنشئ مشروعًا، أضف أسئلته ومراحله، وتابع تقدّم كل طالب"
        actions={<Button size="sm" onClick={() => { setEditing(null); setOpen(true) }}><Plus className="size-4" /> مشروع جديد</Button>}
      />

      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={FolderKanban}
            title="لسه مفيش مشاريع"
            description="أنشئ مشروع التخرج، وأضف الأسئلة، ثم سجّل طلاب الصف الثالث فيه."
            action={<Button onClick={() => { setEditing(null); setOpen(true) }}><Plus className="size-4" /> إنشاء مشروع</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <Card key={p.id} className="animate-fade-up p-4">
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] text-[var(--accent)]">
                  <FolderKanban className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link to={`/projects/${p.id}`} className="block truncate text-[15px] font-bold text-ink hover:text-[var(--brand)]">
                    {p.title}
                  </Link>
                  {p.year_id && <p className="text-[11.5px] text-muted">{yearName.get(p.year_id)}</p>}
                </div>
                <Dropdown>
                  <DropdownTrigger asChild>
                    <Button variant="ghost" size="iconSm" aria-label="خيارات"><MoreVertical className="size-4" /></Button>
                  </DropdownTrigger>
                  <DropdownContent>
                    <DropdownItem asChild><Link to={`/projects/${p.id}`}>فتح المشروع</Link></DropdownItem>
                    <DropdownItem onSelect={() => { setEditing(p); setOpen(true) }}><Pencil className="size-4" /> تعديل</DropdownItem>
                    <DropdownItem
                      danger
                      onSelect={() =>
                        confirm({
                          title: 'حذف المشروع',
                          message: `سيتم حذف «${p.title}» وكل أسئلته وسجلات تقدّم الطلاب فيه.`,
                          onConfirm: () => remove.mutateAsync(p.id),
                        })
                      }
                    >
                      <Trash2 className="size-4" /> حذف
                    </DropdownItem>
                  </DropdownContent>
                </Dropdown>
              </div>

              {p.description && <p className="mt-2.5 line-clamp-2 text-[12.5px] leading-relaxed text-ink-2">{p.description}</p>}

              <div className="mt-3 flex items-center gap-3 border-t border-line pt-3 text-[12px] text-ink-2">
                <span className="inline-flex items-center gap-1.5"><ListChecks className="size-3.5" /><span className="num">{stats.q.get(p.id) ?? 0}</span> سؤال</span>
                <span className="inline-flex items-center gap-1.5"><Users className="size-3.5" /><span className="num">{stats.e.get(p.id) ?? 0}</span> طالب</span>
                {!p.is_active && <Badge tone="warning" className="mr-auto">مغلق</Badge>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <ProjectForm open={open} onOpenChange={setOpen} project={editing} />
    </div>
  )
}

function ProjectForm({ open, onOpenChange, project }: { open: boolean; onOpenChange: (v: boolean) => void; project: Project | null }) {
  const { years } = useLookups()
  const [form, setForm] = useState({ title: '', year_id: '', description: '', is_active: true })

  useEffect(() => {
    if (!open) return
    setForm({
      title: project?.title ?? '',
      year_id: project?.year_id ?? years[years.length - 1]?.id ?? '',
      description: project?.description ?? '',
      is_active: project?.is_active ?? true,
    })
  }, [open, project, years])

  const save = useAction(
    async () => {
      if (!form.title.trim()) throw new Error('اسم المشروع مطلوب')
      return api.saveProject({
        ...(project ? { id: project.id } : {}),
        title: form.title.trim(),
        year_id: form.year_id || null,
        description: form.description.trim() || null,
        is_active: form.is_active,
      })
    },
    { success: 'تم الحفظ ✓', invalidate: [['projects']], onDone: () => onOpenChange(false) },
  )

  return (
    <Modal
      open={open} onOpenChange={onOpenChange}
      title={project ? 'تعديل المشروع' : 'مشروع جديد'}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={() => save.mutate(undefined as never)} loading={save.isPending}>حفظ</Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <Field label="اسم المشروع" required>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثال: مشروع التحكم الصناعي" />
        </Field>
        <Field label="السنة الدراسية">
          <Select value={form.year_id} onChange={(e) => setForm({ ...form, year_id: e.target.value })}>
            <option value="">— بدون —</option>
            {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </Select>
        </Field>
        <Field label="وصف المشروع">
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="المتطلبات، المراحل، الملاحظات…" />
        </Field>
        <label className="flex items-center justify-between rounded-xl bg-surface-2 p-3">
          <span className="text-[13px] font-semibold text-ink">المشروع مفتوح</span>
          <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
        </label>
      </div>
    </Modal>
  )
}
