import clsx from 'clsx'
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { useOrders, useSteps } from '../api/hooks'
import type { OrderStatus } from '../api/types'
import { OverdueBadge, PriorityBadge, StatusBadge } from '../components/badges'
import { StepProgress } from '../components/StepProgress'
import { Button, Card, EmptyState, ErrorState, Input, PageHeader, Select, Spinner } from '../components/ui'
import { fmtDate, fmtDateTime, isOverdue } from '../lib/format'
import { targetOf, useUi } from '../store/ui'

const STATUS_TABS: { value: OrderStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]
const PAGE_SIZE = 15

export function OrdersPage() {
  const { orderFilters: f, setOrderFilters, openCreateOrder, openAdvance } = useUi()
  const [params, setParams] = useSearchParams()
  const steps = useSteps()
  const { data, isLoading, error, isFetching } = useOrders({ ...f, pageSize: PAGE_SIZE })

  // Deep links from the overview (e.g. /orders?status=PENDING) seed the filters once.
  useEffect(() => {
    const status = params.get('status') as OrderStatus | null
    if (status) {
      setOrderFilters({ status })
      setParams({}, { replace: true })
    }
  }, [params, setParams, setOrderFilters])

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <>
      <PageHeader
        title="Orders"
        description="Every production order and where it is in the process."
        actions={<Button onClick={openCreateOrder}><Plus className="size-4" /> New order</Button>}
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-3">
          <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
            {STATUS_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setOrderFilters({ status: t.value })}
                className={clsx(
                  'rounded-md px-3 py-1 text-sm font-medium',
                  f.status === t.value ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Select
            className="w-48"
            value={f.stepId}
            onChange={(e) => setOrderFilters({ stepId: e.target.value ? Number(e.target.value) : '' })}
            aria-label="Filter by step"
          >
            <option value="">Any step</option>
            {steps.data?.map((s) => <option key={s.id} value={s.id}>{s.position}. {s.name}</option>)}
          </Select>
          <div className="relative ml-auto">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="w-64 pl-9"
              placeholder="Search code or product"
              value={f.search}
              onChange={(e) => setOrderFilters({ search: e.target.value })}
            />
          </div>
        </div>

        {isLoading && <Spinner />}
        {error && <div className="p-4"><ErrorState error={errorMessage(error)} /></div>}
        {data && data.items.length === 0 && (
          <EmptyState title="No orders match these filters">
            Try another status, or <button className="text-brand-700 hover:underline" onClick={openCreateOrder}>create an order</button>.
          </EmptyState>
        )}
        {data && data.items.length > 0 && (
          <div className={clsx('overflow-x-auto transition-opacity', isFetching && 'opacity-70')}>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Order</th>
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Progress</th>
                  <th className="px-3 py-2 font-medium">Due</th>
                  <th className="px-3 py-2 font-medium">Created</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((o) => {
                  const open = o.status === 'PENDING' || o.status === 'IN_PROGRESS'
                  return (
                    <tr key={o.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-2.5">
                        <Link to={`/orders/${o.id}`} className="font-medium text-slate-900 hover:text-brand-700">{o.code}</Link>
                      </td>
                      <td className="max-w-56 px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="truncate">{o.productName}</span>
                          <PriorityBadge value={o.priority} hideNormal />
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{o.quantity}</td>
                      <td className="px-3 py-2.5">
                        <StatusBadge value={o.status} />
                        {o.currentStep && <p className="mt-0.5 text-xs text-slate-500">{o.currentStep.name}</p>}
                      </td>
                      <td className="px-3 py-2.5">{steps.data && <StepProgress order={o} steps={steps.data} />}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {isOverdue(o) ? <OverdueBadge /> : <span className="text-slate-600">{fmtDate(o.dueDate)}</span>}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-500">{fmtDateTime(o.createdAt)}</td>
                      <td className="px-4 py-2.5 text-right">
                        {open && (
                          <Button size="sm" variant="secondary" onClick={() => openAdvance(targetOf(o))}>
                            {o.status === 'PENDING' ? 'Start' : 'Advance'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {data && data.total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-sm text-slate-600">
            <span>{data.total} orders · page {f.page} of {pages}</span>
            <div className="flex gap-1">
              <Button size="sm" variant="secondary" disabled={f.page <= 1} onClick={() => setOrderFilters({ page: f.page - 1 })} aria-label="Previous page">
                <ChevronLeft className="size-4" />
              </Button>
              <Button size="sm" variant="secondary" disabled={f.page >= pages} onClick={() => setOrderFilters({ page: f.page + 1 })} aria-label="Next page">
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </>
  )
}
