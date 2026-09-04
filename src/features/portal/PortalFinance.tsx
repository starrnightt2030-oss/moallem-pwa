import { useMemo } from 'react'
import { CheckCircle2, ReceiptText, Wallet } from 'lucide-react'
import { Badge, Card, EmptyState, ListSkeleton } from '@/components/ui'
import { useAuth } from '@/store/auth'
import { useSettings } from '@/store/settings'
import { useCharges, usePayments, computeFinance } from '@/lib/hooks'
import { PAYMENT_METHOD_LABEL } from '@/components/common/Status'
import { fmtDate, fmtMoney } from '@/lib/format'

export default function PortalFinance() {
  const { student } = useAuth()
  const { settings } = useSettings()
  const { data: charges = [], isLoading } = useCharges(student?.id)
  const { data: payments = [] } = usePayments(settings.student_can_view_history ? student?.id : undefined)

  const fin = useMemo(() => computeFinance(charges), [charges])

  if (isLoading) return <ListSkeleton rows={4} />

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-ink">المستحقات</h1>

      <Card className="p-5 text-center" style={{ background: fin.outstanding > 0 ? 'color-mix(in oklab, var(--danger) 10%, var(--surface))' : 'color-mix(in oklab, var(--success) 10%, var(--surface))' }}>
        <p className="text-[13px] font-semibold text-ink-2">إجمالي المستحق حاليًا</p>
        <p className={`num mt-1.5 text-[32px] font-extrabold ${fin.outstanding > 0 ? 'text-danger' : 'text-success'}`}>
          {fmtMoney(fin.outstanding, settings.currency_symbol)}
        </p>
      </Card>

      {fin.unpaid.length === 0 ? (
        <Card>
          <EmptyState icon={CheckCircle2} title="لا توجد مستحقات عليك" description="حسابك خالص بالكامل — شكرًا لالتزامك." />
        </Card>
      ) : (
        <Card>
          <div className="border-b border-line p-4">
            <p className="text-[14px] font-bold text-ink">البنود غير المدفوعة</p>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {fin.unpaid.map((c) => {
              const remaining = Number(c.amount) - Number(c.paid_amount)
              return (
                <div key={c.id} className="flex items-center gap-3 p-3.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-danger-bg text-danger">
                    <ReceiptText className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-ink">{c.title}</p>
                    <p className="text-[11.5px] text-muted">
                      {fmtDate(c.due_date)}
                      {Number(c.paid_amount) > 0 ? ` · مدفوع منه ${fmtMoney(Number(c.paid_amount), settings.currency_symbol)}` : ''}
                    </p>
                  </div>
                  <span className="num text-[14px] font-bold text-danger">{fmtMoney(remaining, settings.currency_symbol)}</span>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {settings.student_can_view_history && payments.length > 0 && (
        <Card>
          <div className="border-b border-line p-4">
            <p className="text-[14px] font-bold text-ink">سجل مدفوعاتك</p>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-success-bg text-success">
                  <Wallet className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="num text-[13.5px] font-bold text-ink">{fmtMoney(Number(p.amount), settings.currency_symbol)}</p>
                  <p className="text-[11.5px] text-muted">{fmtDate(p.paid_at)} · {PAYMENT_METHOD_LABEL[p.method] ?? p.method}</p>
                </div>
                <Badge tone="success">تم الاستلام</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
