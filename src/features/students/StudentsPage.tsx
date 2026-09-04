import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Download, Filter, GraduationCap, MoreVertical, Pencil, Phone, Plus, Trash2, UserPlus, X,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { SearchInput } from '@/components/common/SearchInput'
import { Money } from '@/components/common/Money'
import { StudentStatusBadge } from '@/components/common/Status'
import {
  Avatar, Badge, Button, Card, Dropdown, DropdownContent, DropdownItem, DropdownSeparator,
  DropdownTrigger, EmptyState, ListSkeleton, Select, useConfirm,
} from '@/components/ui'
import { StudentForm } from './StudentForm'
import { useAction, useBalances, useLookups, useStudents } from '@/lib/hooks'
import * as api from '@/lib/api'
import { exportCsv, matches } from '@/lib/utils'
import { fmtDate, phoneHref, waHref } from '@/lib/format'
import type { Student } from '@/lib/database.types'

type BalanceFilter = 'all' | 'debt' | 'clear'

export default function StudentsPage() {
  const [params, setParams] = useSearchParams()
  const { data: students = [], isLoading } = useStudents()
  const { years, groups, yearName, groupName } = useLookups()
  const { balances } = useBalances()
  const confirm = useConfirm()

  const [q, setQ] = useState('')
  const [year, setYear] = useState('')
  const [group, setGroup] = useState('')
  const [status, setStatus] = useState('')
  const [balance, setBalance] = useState<BalanceFilter>((params.get('balance') as BalanceFilter) || 'all')
  const [showFilters, setShowFilters] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)

  useEffect(() => {
    if (params.get('new')) {
      setEditing(null)
      setFormOpen(true)
      params.delete('new')
      setParams(params, { replace: true })
    }
  }, [params, setParams])

  const remove = useAction(api.deleteStudent, {
    success: 'تم حذف الطالب',
    invalidate: [['students'], ['charges'], ['dashboard']],
  })

  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (year && s.year_id !== year) return false
      if (group && s.group_id !== group) return false
      if (status && s.status !== status) return false
      const out = balances.get(s.id)?.outstanding ?? 0
      if (balance === 'debt' && out <= 0) return false
      if (balance === 'clear' && out > 0) return false
      if (q && !(matches(s.full_name, q) || matches(s.code, q) || matches(s.phone, q) || matches(s.guardian_phone, q))) return false
      return true
    })
  }, [students, year, group, status, balance, q, balances])

  const activeFilters = [year, group, status, balance !== 'all' ? balance : ''].filter(Boolean).length

  function doExport() {
    exportCsv(
      filtered.map((s) => ({
        الكود: s.code,
        الاسم: s.full_name,
        الهاتف: s.phone ?? '',
        'هاتف ولي الأمر': s.guardian_phone ?? '',
        'السنة الدراسية': s.year_id ? yearName.get(s.year_id) ?? '' : '',
        المجموعة: s.group_id ? groupName.get(s.group_id) ?? '' : '',
        الحالة: s.status === 'active' ? 'نشط' : 'غير نشط',
        'تاريخ التسجيل': s.enrolled_at,
        المستحق: balances.get(s.id)?.outstanding ?? 0,
        المدفوع: balances.get(s.id)?.paid ?? 0,
      })),
      `الطلاب-${new Date().toISOString().slice(0, 10)}`,
    )
  }

  return (
    <div>
      <PageHeader
        title="الطلاب"
        icon={GraduationCap}
        subtitle={`${filtered.length} من ${students.length} طالب`}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={doExport} disabled={!filtered.length}>
              <Download className="size-4" /> تصدير
            </Button>
            <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true) }}>
              <Plus className="size-4" /> طالب جديد
            </Button>
          </>
        }
      />

      {/* ============ البحث والفلاتر ============ */}
      <div className="mb-4 space-y-3">
        <div className="flex gap-2">
          <SearchInput value={q} onChange={setQ} className="flex-1" placeholder="ابحث بالاسم أو الكود أو الهاتف…" />
          <Button
            variant={activeFilters ? 'subtle' : 'secondary'}
            size="icon"
            onClick={() => setShowFilters((v) => !v)}
            aria-label="فلاتر"
            className="relative shrink-0"
          >
            <Filter className="size-4" />
            {activeFilters > 0 && (
              <span className="num absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-[var(--brand)] text-[9px] font-bold text-white">
                {activeFilters}
              </span>
            )}
          </Button>
        </div>

        {showFilters && (
          <Card className="animate-fade-up grid gap-2.5 p-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select value={year} onChange={(e) => { setYear(e.target.value); setGroup('') }}>
              <option value="">كل السنوات</option>
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </Select>
            <Select value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="">كل المجموعات</option>
              {groups.filter((g) => !year || g.year_id === year).map((g) => (
                <option key={g.id} value={g.id}>{g.name} — {yearName.get(g.year_id)}</option>
              ))}
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">كل الحالات</option>
              <option value="active">نشط</option>
              <option value="inactive">غير نشط</option>
            </Select>
            <Select value={balance} onChange={(e) => setBalance(e.target.value as BalanceFilter)}>
              <option value="all">كل الحسابات</option>
              <option value="debt">عليه مستحقات</option>
              <option value="clear">خالص الحساب</option>
            </Select>
            {activeFilters > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="sm:col-span-2 lg:col-span-4"
                onClick={() => { setYear(''); setGroup(''); setStatus(''); setBalance('all') }}
              >
                <X className="size-4" /> مسح كل الفلاتر
              </Button>
            )}
          </Card>
        )}
      </div>

      {/* ============ القائمة ============ */}
      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={UserPlus}
            title={students.length === 0 ? 'لسه مفيش طلاب هنا' : 'لا توجد نتائج مطابقة'}
            description={students.length === 0 ? 'ابدأ بإضافة أول طالب لك، وسيظهر هنا مع حسابه وحصصه.' : 'جرّب تغيير الفلاتر أو كلمة البحث.'}
            action={
              students.length === 0 ? (
                <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
                  <Plus className="size-4" /> إضافة طالب
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => {
            const bal = balances.get(s.id)
            const out = bal?.outstanding ?? 0
            return (
              <Card key={s.id} className="animate-fade-up p-3.5 transition hover:shadow-[var(--shadow-2)]">
                <div className="flex items-start gap-3">
                  <Link to={`/students/${s.id}`}><Avatar name={s.full_name} size={44} /></Link>
                  <div className="min-w-0 flex-1">
                    <Link to={`/students/${s.id}`} className="block">
                      <p className="truncate text-[14.5px] font-bold text-ink hover:text-[var(--brand)]">{s.full_name}</p>
                      <p className="num truncate text-[11.5px] text-muted">{s.code}</p>
                    </Link>
                  </div>
                  <Dropdown>
                    <DropdownTrigger asChild>
                      <Button variant="ghost" size="iconSm" aria-label="خيارات"><MoreVertical className="size-4" /></Button>
                    </DropdownTrigger>
                    <DropdownContent>
                      <DropdownItem asChild><Link to={`/students/${s.id}`}>فتح ملف الطالب</Link></DropdownItem>
                      <DropdownItem onSelect={() => { setEditing(s); setFormOpen(true) }}>
                        <Pencil className="size-4" /> تعديل البيانات
                      </DropdownItem>
                      <DropdownItem asChild><Link to={`/reports/student/${s.id}`}>تقرير كامل</Link></DropdownItem>
                      {s.phone && (
                        <>
                          <DropdownSeparator />
                          <DropdownItem asChild><a href={phoneHref(s.phone)}><Phone className="size-4" /> اتصال</a></DropdownItem>
                          <DropdownItem asChild><a href={waHref(s.phone)} target="_blank" rel="noreferrer">واتساب</a></DropdownItem>
                        </>
                      )}
                      <DropdownSeparator />
                      <DropdownItem
                        danger
                        onSelect={() =>
                          confirm({
                            title: 'حذف الطالب',
                            message: `سيتم حذف «${s.full_name}» وكل سجلاته المالية والحضور نهائيًا. لا يمكن التراجع.`,
                            onConfirm: () => remove.mutateAsync(s.id),
                          })
                        }
                      >
                        <Trash2 className="size-4" /> حذف
                      </DropdownItem>
                    </DropdownContent>
                  </Dropdown>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {s.year_id && <Badge tone="neutral">{yearName.get(s.year_id)}</Badge>}
                  {s.group_id && <Badge tone="neutral">{groupName.get(s.group_id)}</Badge>}
                  <StudentStatusBadge status={s.status} />
                  {s.has_account && <Badge tone="info">له حساب دخول</Badge>}
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
                  <span className="text-[11.5px] text-muted">مسجّل منذ {fmtDate(s.enrolled_at)}</span>
                  {out > 0 ? (
                    <span className="text-[13px] font-bold text-danger"><Money value={out} /></span>
                  ) : (
                    <Badge tone="success">خالص</Badge>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <StudentForm open={formOpen} onOpenChange={setFormOpen} student={editing} />
    </div>
  )
}
