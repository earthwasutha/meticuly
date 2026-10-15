import clsx from 'clsx'
import { ArrowRight, CheckCircle2, Clock, Flag, PlayCircle, Plus, Search, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { useBoard } from '../api/hooks'
import type { Order, Step } from '../api/types'
import { OverdueBadge, PriorityBadge } from '../components/badges'
import { Badge, Button, EmptyState, ErrorState, Input, PageHeader, Spinner } from '../components/ui'
import { fmtDate, fmtDuration, isOverdue, minutesBetween, timeAgo } from '../lib/format'
import { targetOf, useUi } from '../store/ui'

export function BoardPage() {
  const { data, isLoading, error } = useBoard()
  const { boardSearch, setBoardSearch, openCreateOrder } = useUi()

  const term = boardSearch.trim().toLowerCase()
  const match = (o: Order) =>
    !term || o.code.toLowerCase().includes(term) || o.productName.toLowerCase().includes(term)

  return (
    <>
      <PageHeader
        title="Production board"
        description="Orders in progress at each step. Advance an order when its work at the current step is done."
        actions={
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <Input className="w-56 pl-9" placeholder="Find order or product" value={boardSearch} onChange={(e) => setBoardSearch(e.target.value)} />
            </div>
            <Button onClick={openCreateOrder}><Plus className="size-4" /> New order</Button>
          </>
        }
      />
      {isLoading && <Spinner />}
      {error && <ErrorState error={errorMessage(error)} />}
      {data && data.stepCount === 0 && (
        <EmptyState title="No process steps yet">
          <Link to="/process" className="text-brand-700 hover:underline">Define the process steps</Link> before starting orders.
        </EmptyState>
      )}
      {data && data.stepCount > 0 && (
        <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex min-w-max gap-4">
            <Lane title="Queue" subtitle="Waiting to start" count={data.queue.length} tone="slate">
              {data.queue.filter(match).map((o) => <OrderCard key={o.id} order={o} action="start" />)}
            </Lane>
            {data.lanes.map(({ step, orders, active }, i) => (
              <Lane
                key={step.id}
                title={`${i + 1}. ${step.name}`}
                subtitle={step.description}
                count={active}
                capacity={step.capacity}
                tone="brand"
              >
                {orders.filter(match).map((o) => (
                  <OrderCard key={o.id} order={o} step={step} action={i === data.lanes.length - 1 ? 'complete' : 'move'} />
                ))}
              </Lane>
            ))}
            <Lane title="Completed" subtitle="Most recent" count={data.completed.length} tone="green">
              {data.completed.filter(match).map((o) => (
                <Link key={o.id} to={`/orders/${o.id}`} className="block rounded-lg bg-white p-3 text-sm ring-1 ring-slate-200 hover:ring-emerald-300">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900">{o.code}</span>
                    <CheckCircle2 className="size-4 text-emerald-500" />
                  </div>
                  <p className="truncate text-slate-600">{o.quantity} × {o.productName}</p>
                  <p className="mt-1 text-xs text-slate-400">Finished {o.completedAt && timeAgo(o.completedAt)}</p>
                </Link>
              ))}
            </Lane>
          </div>
        </div>
      )}
    </>
  )
}

function Lane({
  title,
  subtitle,
  count,
  capacity,
  tone,
  children,
}: {
  title: string
  subtitle?: string
  count: number
  capacity?: number | null
  tone: 'slate' | 'brand' | 'green'
  children: React.ReactNode
}) {
  const full = capacity != null && count >= capacity
  return (
    <section className="flex w-72 shrink-0 flex-col rounded-xl bg-slate-100/70 ring-1 ring-slate-200">
      <header className={clsx('rounded-t-xl border-t-4 px-3 pt-2.5 pb-2', { slate: 'border-slate-400', brand: 'border-brand-500', green: 'border-emerald-500' }[tone])}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="truncate text-sm font-semibold text-slate-900" title={title}>{title}</h2>
          {capacity === undefined ? (
            <Badge>{count}</Badge>
          ) : capacity === null ? (
            <Badge>{count} / ∞</Badge>
          ) : (
            <Badge tone={full ? 'red' : count / capacity >= 0.75 ? 'amber' : 'slate'} >
              {count} / {capacity}{full && ' · full'}
            </Badge>
          )}
        </div>
        {subtitle && <p className="mt-0.5 line-clamp-1 text-xs text-slate-500" title={subtitle}>{subtitle}</p>}
      </header>
      <div className="flex min-h-40 flex-1 flex-col gap-2 p-2">
        {children}
        {(Array.isArray(children) ? children.length === 0 : !children) && (
          <p className="py-6 text-center text-xs text-slate-400">No orders</p>
        )}
      </div>
    </section>
  )
}

function OrderCard({ order, step, action }: { order: Order; step?: Step; action: 'start' | 'move' | 'complete' }) {
  const { openAdvance, openCancel } = useUi()
  const overdue = isOverdue(order)
  const label = { start: 'Start', move: 'Next step', complete: 'Complete' }[action]
  const Icon = { start: PlayCircle, move: ArrowRight, complete: Flag }[action]
  return (
    <article className={clsx('rounded-lg bg-white p-3 shadow-xs ring-1', overdue ? 'ring-rose-300' : 'ring-slate-200')}>
      <div className="flex items-start justify-between gap-2">
        <Link to={`/orders/${order.id}`} className="text-sm font-semibold text-slate-900 hover:text-brand-700">{order.code}</Link>
        <div className="flex gap-1">
          {overdue && <OverdueBadge />}
          <PriorityBadge value={order.priority} hideNormal />
        </div>
      </div>
      <p className="mt-0.5 truncate text-sm text-slate-600" title={order.productName}>
        <span className="font-medium tabular-nums text-slate-800">{order.quantity}</span> × {order.productName}
      </p>
      <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
        {step && order.stepEnteredAt ? (
          <span className="flex items-center gap-1" title="Time at this step">
            <Clock className="size-3" /> {fmtDuration(minutesBetween(order.stepEnteredAt))}
          </span>
        ) : (
          <span>Created {timeAgo(order.createdAt)}</span>
        )}
        {order.dueDate && <span>Due {fmtDate(order.dueDate)}</span>}
      </div>
      <div className="mt-3 flex gap-1.5">
        <Button size="sm" className="flex-1" onClick={() => openAdvance(targetOf(order))}>
          <Icon className="size-3.5" /> {label}
        </Button>
        <Button size="sm" variant="ghost" aria-label="Cancel order" title="Cancel order" onClick={() => openCancel(targetOf(order))}>
          <XCircle className="size-3.5" />
        </Button>
      </div>
    </article>
  )
}
