import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bell, FileText, MessageSquare, Paperclip, Send, Trash2, Users,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import {
  Badge, Button, Card, Checkbox, EmptyState, Field, Input, ListSkeleton, Modal,
  Select, Textarea, useConfirm,
} from '@/components/ui'
import { SearchInput } from '@/components/common/SearchInput'
import { useAction, useFiles, useLookups, useMessages, useStudents } from '@/lib/hooks'
import * as api from '@/lib/api'
import { fmtDate, fmtRelative, fileSize } from '@/lib/format'
import { matches } from '@/lib/utils'
import type { AudienceType } from '@/lib/database.types'

export default function MessagesPage() {
  const { data: messages = [], isLoading } = useMessages()
  const [open, setOpen] = useState(false)
  const confirm = useConfirm()

  const ids = useMemo(() => messages.map((m) => m.id), [messages])
  const { data: recipients = [] } = useQuery({
    queryKey: ['message-recipients', ids.join(',')],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { supabase } = await import('@/lib/supabase')
      const { data } = await supabase.from('message_recipients').select('message_id, read_at').in('message_id', ids)
      return (data ?? []) as { message_id: string; read_at: string | null }[]
    },
  })
  const { data: msgFiles = [] } = useQuery({
    queryKey: ['message-files', ids.join(',')],
    enabled: ids.length > 0,
    queryFn: () => api.listMessageFiles(ids),
  })

  const stats = useMemo(() => {
    const m = new Map<string, { total: number; read: number }>()
    for (const r of recipients) {
      const cur = m.get(r.message_id) ?? { total: 0, read: 0 }
      cur.total++
      if (r.read_at) cur.read++
      m.set(r.message_id, cur)
    }
    return m
  }, [recipients])

  const remove = useAction(api.deleteMessage, { success: 'تم حذف الرسالة', invalidate: [['messages']] })

  return (
    <div>
      <PageHeader
        title="الرسائل والإشعارات"
        icon={MessageSquare}
        subtitle="أرسل رسالة أو ملفًا لطالب أو مجموعة أو سنة كاملة"
        actions={<Button size="sm" onClick={() => setOpen(true)}><Send className="size-4" /> رسالة جديدة</Button>}
      />

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : messages.length === 0 ? (
        <Card>
          <EmptyState
            icon={Bell}
            title="لسه مفيش رسائل"
            description="أرسل تنبيهًا أو ملفًا لطلابك — سيصلهم داخل التطبيق مباشرة."
            action={<Button onClick={() => setOpen(true)}><Send className="size-4" /> إرسال رسالة</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {messages.map((m) => {
            const st = stats.get(m.id)
            const files = msgFiles.filter((f) => f.message_id === m.id)
            return (
              <Card key={m.id} className="animate-fade-up p-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_oklab,var(--brand)_12%,transparent)] text-[var(--brand)]">
                    <MessageSquare className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14.5px] font-bold text-ink">{m.title}</p>
                    {m.body && <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-ink-2">{m.body}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge tone="neutral">
                        <Users className="size-3" />
                        <span className="num">{st?.total ?? 0}</span> مستلم
                      </Badge>
                      {st && st.total > 0 && (
                        <Badge tone={st.read === st.total ? 'success' : 'warning'}>
                          <span className="num">{st.read}</span> قرأها
                        </Badge>
                      )}
                      {files.map((f) => (
                        <Badge key={f.file_id} tone="info">
                          <Paperclip className="size-3" /> {f.files?.name}
                        </Badge>
                      ))}
                      <span className="mr-auto text-[11.5px] text-muted">{fmtRelative(m.created_at)}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost" size="iconSm" aria-label="حذف"
                    onClick={() =>
                      confirm({
                        title: 'حذف الرسالة',
                        message: `سيتم حذف «${m.title}» من عند كل الطلاب.`,
                        onConfirm: () => remove.mutateAsync(m.id),
                      })
                    }
                  >
                    <Trash2 className="size-3.5 text-danger" />
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <ComposeDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}

function ComposeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { years, groups, yearName } = useLookups()
  const { data: students = [] } = useStudents()
  const { data: files = [] } = useFiles()

  const [audience, setAudience] = useState<AudienceType>('group')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [studentIds, setStudentIds] = useState<string[]>([])
  const [groupIds, setGroupIds] = useState<string[]>([])
  const [yearIds, setYearIds] = useState<string[]>([])
  const [fileIds, setFileIds] = useState<string[]>([])
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!open) return
    setAudience('group'); setTitle(''); setBody(''); setQ('')
    setStudentIds([]); setGroupIds([]); setYearIds([]); setFileIds([])
  }, [open])

  const count = useMemo(() => {
    const active = students.filter((s) => s.status === 'active')
    if (audience === 'all') return active.length
    if (audience === 'student') return studentIds.length
    if (audience === 'group') return active.filter((s) => s.group_id && groupIds.includes(s.group_id)).length
    return active.filter((s) => s.year_id && yearIds.includes(s.year_id)).length
  }, [audience, students, studentIds, groupIds, yearIds])

  const send = useAction(
    async () => {
      if (!title.trim()) throw new Error('عنوان الرسالة مطلوب')
      if (count === 0) throw new Error('اختر جهة مستهدفة واحدة على الأقل')
      return api.sendMessage({
        title: title.trim(), body: body.trim() || null, audienceType: audience,
        studentIds: audience === 'student' ? studentIds : [],
        groupIds: audience === 'group' ? groupIds : [],
        yearIds: audience === 'year' ? yearIds : [],
        fileIds,
      })
    },
    { success: 'تم إرسال الرسالة ✓', invalidate: [['messages'], ['notifications']], onDone: () => onOpenChange(false) },
  )

  const toggle = (arr: string[], set: (v: string[]) => void, id: string) =>
    set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id])

  const list = useMemo(
    () => students.filter((s) => s.status === 'active' && matches(`${s.full_name} ${s.code}`, q)),
    [students, q],
  )

  return (
    <Modal
      open={open} onOpenChange={onOpenChange} size="lg"
      title="رسالة جديدة"
      description="تصل داخل التطبيق كإشعار للطلاب المستهدفين فقط"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={() => send.mutate(undefined as never)} loading={send.isPending}>
            <Send className="size-4" /> إرسال إلى {count} طالب
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <Field label="العنوان" required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: موعد الحصة القادمة" />
        </Field>
        <Field label="نص الرسالة">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="اكتب الرسالة هنا…" className="min-h-28" />
        </Field>

        <Field label="الجهة المستهدفة">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {([
              ['student', 'طلاب محددين'],
              ['group', 'مجموعات'],
              ['year', 'سنوات دراسية'],
              ['all', 'كل الطلاب'],
            ] as [AudienceType, string][]).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setAudience(v)}
                className={`tap rounded-xl border p-2.5 text-[13px] font-semibold transition ${
                  audience === v
                    ? 'border-[var(--brand)] bg-[color-mix(in_oklab,var(--brand)_10%,transparent)] text-[var(--brand)]'
                    : 'border-line text-ink-2 hover:bg-surface-2'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>

        {audience === 'group' && (
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
            {groups.map((g) => (
              <label key={g.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg p-2 hover:bg-surface-2">
                <Checkbox checked={groupIds.includes(g.id)} onCheckedChange={() => toggle(groupIds, setGroupIds, g.id)} />
                <span className="text-[13px] font-medium text-ink">{g.name}</span>
                <Badge tone="neutral" className="mr-auto">{yearName.get(g.year_id)}</Badge>
              </label>
            ))}
          </div>
        )}

        {audience === 'year' && (
          <div className="space-y-1 rounded-xl border border-line p-2">
            {years.map((y) => (
              <label key={y.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg p-2 hover:bg-surface-2">
                <Checkbox checked={yearIds.includes(y.id)} onCheckedChange={() => toggle(yearIds, setYearIds, y.id)} />
                <span className="text-[13px] font-medium text-ink">{y.name}</span>
              </label>
            ))}
          </div>
        )}

        {audience === 'student' && (
          <div className="space-y-2">
            <SearchInput value={q} onChange={setQ} placeholder="ابحث عن طالب…" />
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
              {list.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg p-2 hover:bg-surface-2">
                  <Checkbox checked={studentIds.includes(s.id)} onCheckedChange={() => toggle(studentIds, setStudentIds, s.id)} />
                  <span className="text-[13px] font-medium text-ink">{s.full_name}</span>
                  <span className="num mr-auto text-[11px] text-muted">{s.code}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {files.length > 0 && (
          <Field label="إرفاق ملفات" hint="ارفع الملفات أولًا من صفحة الملفات">
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
              {files.map((f) => (
                <label key={f.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg p-2 hover:bg-surface-2">
                  <Checkbox checked={fileIds.includes(f.id)} onCheckedChange={() => toggle(fileIds, setFileIds, f.id)} />
                  <FileText className="size-4 text-muted" />
                  <span className="truncate text-[13px] font-medium text-ink">{f.name}</span>
                  <span className="num mr-auto shrink-0 text-[11px] text-muted">{fileSize(f.size)}</span>
                </label>
              ))}
            </div>
          </Field>
        )}
      </div>
    </Modal>
  )
}
