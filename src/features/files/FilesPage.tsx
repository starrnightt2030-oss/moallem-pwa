import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  Download, FileImage, FileText, FolderOpen, Send, Trash2, Upload, File as FileIcon,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { SearchInput } from '@/components/common/SearchInput'
import { Badge, Button, Card, EmptyState, ListSkeleton, useConfirm } from '@/components/ui'
import { useAction, useFiles } from '@/lib/hooks'
import * as api from '@/lib/api'
import { fileSize, fmtDate } from '@/lib/format'
import { matches } from '@/lib/utils'
import type { FileRow } from '@/lib/database.types'

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip'
const MAX_MB = 20

function iconFor(mime: string | null) {
  if (!mime) return FileIcon
  if (mime.startsWith('image/')) return FileImage
  if (mime.includes('pdf')) return FileText
  return FileIcon
}

export default function FilesPage() {
  const { data: files = [], isLoading } = useFiles()
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const confirm = useConfirm()

  const filtered = useMemo(() => files.filter((f) => matches(f.name, q)), [files, q])

  const remove = useAction((f: FileRow) => api.deleteFile(f), { success: 'تم حذف الملف', invalidate: [['files']] })

  const upload = useAction(
    async (list: FileList) => {
      for (const f of Array.from(list)) {
        if (f.size > MAX_MB * 1024 * 1024) throw new Error(`«${f.name}» أكبر من ${MAX_MB} ميجابايت`)
        await api.uploadFile(f)
      }
    },
    { success: 'تم رفع الملفات ✓', invalidate: [['files']] },
  )

  async function openFile(f: FileRow) {
    try {
      setBusy(true)
      const url = await api.fileUrl(f.path, 3600)
      window.open(url, '_blank', 'noopener')
    } catch (e) {
      toast.error('تعذّر فتح الملف')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="الملفات"
        icon={FolderOpen}
        subtitle={`${files.length} ملف · الحد الأقصى ${MAX_MB} ميجابايت للملف`}
        actions={
          <Button size="sm" onClick={() => inputRef.current?.click()} loading={upload.isPending}>
            <Upload className="size-4" /> رفع ملفات
          </Button>
        }
      />

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) upload.mutate(e.target.files)
          e.target.value = ''
        }}
      />

      <div className="mb-4">
        <SearchInput value={q} onChange={setQ} placeholder="ابحث عن ملف…" />
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          if (e.dataTransfer.files?.length) upload.mutate(e.dataTransfer.files)
        }}
      >
        {isLoading ? (
          <ListSkeleton rows={5} />
        ) : filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon={FolderOpen}
              title={files.length === 0 ? 'لسه مفيش ملفات' : 'لا توجد نتائج'}
              description={files.length === 0 ? 'ارفع مذكرات أو صورًا أو ملفات PDF، ثم أرسلها لمجموعة أو طالب من صفحة الرسائل.' : 'جرّب كلمة بحث أخرى.'}
              action={files.length === 0 ? <Button onClick={() => inputRef.current?.click()}><Upload className="size-4" /> رفع ملف</Button> : undefined}
            />
          </Card>
        ) : (
          <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((f) => {
              const Icon = iconFor(f.mime)
              return (
                <Card key={f.id} className="animate-fade-up flex items-center gap-3 p-3.5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-2">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-bold text-ink">{f.name}</p>
                    <p className="num text-[11.5px] text-muted">{fileSize(f.size)} · {fmtDate(f.created_at)}</p>
                  </div>
                  <Button variant="ghost" size="iconSm" onClick={() => openFile(f)} disabled={busy} aria-label="فتح">
                    <Download className="size-4" />
                  </Button>
                  <Button
                    variant="ghost" size="iconSm" aria-label="حذف"
                    onClick={() =>
                      confirm({
                        title: 'حذف الملف',
                        message: `سيتم حذف «${f.name}» نهائيًا ومن كل الرسائل المرتبطة به.`,
                        onConfirm: () => remove.mutateAsync(f),
                      })
                    }
                  >
                    <Trash2 className="size-4 text-danger" />
                  </Button>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <Card className="mt-4 border-dashed p-6 text-center">
        <p className="text-[13px] text-muted">
          اسحب الملفات وأفلتها هنا للرفع · لإرسال ملف لمجموعة أو طالب استخدم
          <Button variant="ghost" size="sm" asChild className="mx-1"><a href="/messages"><Send className="size-3.5" /> الرسائل</a></Button>
        </p>
      </Card>
    </div>
  )
}
