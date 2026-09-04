import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, FileText, MessageSquare, Paperclip } from 'lucide-react'
import { Badge, Button, Card, EmptyState, ListSkeleton } from '@/components/ui'
import { useAuth } from '@/store/auth'
import { useSettings } from '@/store/settings'
import * as api from '@/lib/api'
import { fmtRelative, fileSize } from '@/lib/format'

export default function PortalMessages() {
  const { student } = useAuth()
  const { settings } = useSettings()
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['portal-messages', student?.id],
    enabled: !!student?.id,
    queryFn: () => api.listMyMessages(student!.id),
  })

  const ids = useMemo(() => rows.map((r) => r.messages?.id).filter(Boolean) as string[], [rows])
  const { data: files = [] } = useQuery({
    queryKey: ['portal-message-files', ids.join(',')],
    enabled: ids.length > 0 && settings.student_can_view_files,
    queryFn: () => api.listMessageFiles(ids),
  })

  // وضع علامة مقروء عند الفتح
  useEffect(() => {
    const unread = rows.filter((r) => !r.read_at)
    if (!unread.length) return
    ;(async () => {
      for (const r of unread) {
        try { await api.markMessageRead(r.id) } catch { /* تجاهل */ }
      }
      qc.invalidateQueries({ queryKey: ['portal-messages', student?.id] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length])

  async function open(path: string) {
    try {
      setBusy(true)
      const url = await api.fileUrl(path, 3600)
      window.open(url, '_blank', 'noopener')
    } catch {
      toast.error('تعذّر فتح الملف')
    } finally {
      setBusy(false)
    }
  }

  if (isLoading) return <ListSkeleton rows={4} />

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-ink">الرسائل</h1>

      {rows.length === 0 ? (
        <Card><EmptyState icon={MessageSquare} title="لا توجد رسائل" description="ستظهر هنا رسائل وملفات المدرّس الخاصة بك أو بمجموعتك." /></Card>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => {
            const m = r.messages
            if (!m) return null
            const attached = files.filter((f) => f.message_id === m.id)
            return (
              <Card key={r.id} className="animate-fade-up p-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_oklab,var(--brand)_12%,transparent)] text-[var(--brand)]">
                    <MessageSquare className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="flex-1 text-[14.5px] font-bold text-ink">{m.title}</p>
                      {!r.read_at && <Badge tone="brand">جديدة</Badge>}
                    </div>
                    {m.body && <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-ink-2">{m.body}</p>}
                    <p className="mt-1.5 text-[11.5px] text-muted">{fmtRelative(m.created_at)}</p>

                    {settings.student_can_view_files && attached.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {attached.map((f) => (
                          <button
                            key={f.file_id}
                            disabled={busy}
                            onClick={() => f.files && open(f.files.path)}
                            className="tap flex w-full items-center gap-2.5 rounded-xl border border-line p-2.5 text-right transition hover:bg-surface-2"
                          >
                            <FileText className="size-4 shrink-0 text-muted" />
                            <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink">{f.files?.name}</span>
                            <span className="num shrink-0 text-[11px] text-muted">{fileSize(f.files?.size)}</span>
                            <Download className="size-4 shrink-0 text-[var(--brand)]" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
