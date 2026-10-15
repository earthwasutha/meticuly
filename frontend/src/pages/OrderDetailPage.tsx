import clsx from 'clsx'
import { ArrowLeft, ArrowRight, Check, Circle, Flag, Pencil, PlayCircle, Trash2, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { useDeleteOrder, useOrder, useSteps, useUpdateOrder } from '../api/hooks'
import type { OrderDetail, OrderPriority, Step } from '../api/types'
import { OverdueBadge, PriorityBadge, StatusBadge } from '../components/badges'
import { Button, Card, CardHeader, EmptyState, ErrorState, Field, Input, Modal, Select, Spinner, Textarea } from '../components/ui'
import { fmtDate, fmtDateTime, fmtDuration, fmtNum, isOverdue, minutesBetween } from '../lib/format'
import { targetOf, useUi } from '../store/ui'

export function OrderDetailPage() {
  const id = Number(useParams().id)
  const { data: order, isLoading, error } = useOrder(id)
  const steps = useSteps()

  if (isLoading || steps.isLoading) return <Spinner />
  if (error) return <ErrorState error={errorMessage(error)} />
  if (!order || !steps.data) return null
  return <OrderView order={order} steps={steps.data} />
}

function OrderView({ order, steps }: { order: OrderDetail; steps: Step[] }) {
  const { openAdvance, openCancel } = useUi()
  const navigate = useNavigate()
  const del = useDeleteOrder()
  const [editing, setEditing] = useState(false)
  const open = order.status === 'PENDING' || order.status === 'IN_PROGRESS'
  const lastStepId = steps.at(-1)?.id
  const nextLabel =
    order.status === 'PENDING' ? 'Start production' : order.currentStepId === lastStepId ? 'Complete order' : 'Move to next step'
  const NextIcon = order.status === 'PENDING' ? PlayCircle : order.currentStepId === lastStepId ? Flag : ArrowRight

  const remove = async () => {
    if (!confirm(`Delete ${order.code}? This cannot be undone.`)) return
    try {
      await del.mutateAsync(order.id)
      toast.success(`${order.code} deleted`)
      navigate('/orders')
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <>
      <Link to="/orders" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" /> Orders
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{order.code}</h1>
            <StatusBadge value={order.status} />
            <PriorityBadge value={order.priority} />
            {isOverdue(order) && <OverdueBadge />}
          </div>
          <p className="mt-1 text-slate-600">
            {order.quantity} × {order.productName}
            {order.currentStep && <> · currently at <span className="font-medium text-slate-800">{order.currentStep.name}</span></>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {order.status === 'PENDING' && (
            <>
              <Button variant="ghost" onClick={remove} loading={del.isPending}><Trash2 className="size-4" /> Delete</Button>
              <Button variant="secondary" onClick={() => setEditing(true)}><Pencil className="size-4" /> Edit</Button>
            </>
          )}
          {open && (
            <>
              <Button variant="secondary" onClick={() => openCancel(targetOf(order))}><XCircle className="size-4" /> Cancel</Button>
              <Button onClick={() => openAdvance(targetOf(order))}><NextIcon className="size-4" /> {nextLabel}</Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Production route" subtitle="Each step the order passes through, with how long it spent there." />
            <StepTimeline order={order} steps={steps} />
          </Card>
          <Card>
            <CardHeader title="Resource consumption" subtitle="Deducted from stock when the order entered each step." />
            <ConsumptionTable order={order} />
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <dl className="divide-y divide-slate-100 text-sm">
              {[
                ['Due date', fmtDate(order.dueDate)],
                ['Created', fmtDateTime(order.createdAt)],
                ['Started', fmtDateTime(order.startedAt)],
                ['Completed', fmtDateTime(order.completedAt)],
                ['Lead time', order.startedAt ? fmtDuration(minutesBetween(order.startedAt, order.completedAt ?? order.cancelledAt)) : '—'],
                ...(order.cancelledAt ? [['Cancelled', `${fmtDateTime(order.cancelledAt)}${order.cancelReason ? ` — ${order.cancelReason}` : ''}`]] : []),
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-5 py-2.5">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="text-right text-slate-800">{v}</dd>
                </div>
              ))}
            </dl>
            {order.notes && <p className="border-t border-slate-100 px-5 py-3 text-sm whitespace-pre-wrap text-slate-600">{order.notes}</p>}
          </Card>
          <Card>
            <CardHeader title="Activity log" />
            <ol className="space-y-3 px-5 py-4">
              {[...order.events].reverse().map((e) => (
                <li key={e.id} className="relative pl-5 text-sm">
                  <span className={clsx('absolute top-1.5 left-0 size-2 rounded-full', e.type === 'CANCELLED' ? 'bg-rose-500' : e.type === 'COMPLETED' ? 'bg-emerald-500' : 'bg-brand-500')} />
                  <p className="text-slate-800">{e.message}</p>
                  <p className="text-xs text-slate-400">{fmtDateTime(e.createdAt)}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
      {editing && <EditOrderDialog order={order} onClose={() => setEditing(false)} />}
    </>
  )
}

function StepTimeline({ order, steps }: { order: OrderDetail; steps: Step[] }) {
  // Steps that were deleted/re-ordered after the order passed them still appear via its logs.
  const logsByStep = useMemo(() => new Map(order.stepLogs.map((l) => [l.stepId, l])), [order.stepLogs])
  return (
    <ol className="px-5 py-4">
      {steps.map((s, i) => {
        const log = logsByStep.get(s.id)
        const state = log?.status ?? 'NOT_STARTED'
        return (
          <li key={s.id} className="relative flex gap-4 pb-5 last:pb-0">
            {i < steps.length - 1 && (
              <span className={clsx('absolute top-7 left-3 h-[calc(100%-1.75rem)] w-0.5 -translate-x-1/2', state === 'COMPLETED' ? 'bg-emerald-300' : 'bg-slate-200')} />
            )}
            <span
              className={clsx(
                'relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full',
                state === 'COMPLETED' && 'bg-emerald-500 text-white',
                state === 'IN_PROGRESS' && 'bg-brand-600 text-white ring-4 ring-brand-100',
                state === 'CANCELLED' && 'bg-rose-500 text-white',
                state === 'NOT_STARTED' && 'bg-slate-100 text-slate-400 ring-1 ring-slate-200',
              )}
            >
              {state === 'COMPLETED' ? <Check className="size-3.5" /> : state === 'CANCELLED' ? <XCircle className="size-3.5" /> : state === 'IN_PROGRESS' ? <Circle className="size-2.5 fill-current" /> : <span className="text-xs">{i + 1}</span>}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className={clsx('text-sm font-medium', state === 'NOT_STARTED' ? 'text-slate-400' : 'text-slate-900')}>{s.name}</p>
                {log && (
                  <p className="text-xs text-slate-500">
                    {state === 'IN_PROGRESS' ? 'in progress for ' : state === 'CANCELLED' ? 'stopped after ' : 'took '}
                    <span className="font-medium text-slate-700">{fmtDuration(minutesBetween(log.enteredAt, log.exitedAt))}</span>
                  </p>
                )}
              </div>
              {log ? (
                <p className="text-xs text-slate-500">
                  {fmtDateTime(log.enteredAt)} → {log.exitedAt ? fmtDateTime(log.exitedAt) : 'now'}
                </p>
              ) : (
                <p className="text-xs text-slate-400">Not reached yet</p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function ConsumptionTable({ order }: { order: OrderDetail }) {
  const totals = useMemo(() => {
    const map = new Map<number, { name: string; unit: string; total: number }>()
    for (const c of order.consumption) {
      const t = map.get(c.resourceId) ?? { name: c.resource?.name ?? '?', unit: c.resource?.unit ?? '', total: 0 }
      t.total = Math.round((t.total + c.quantity) * 1000) / 1000
      map.set(c.resourceId, t)
    }
    return [...map.values()]
  }, [order.consumption])

  if (order.consumption.length === 0) {
    return <EmptyState title="Nothing consumed yet">Resources are deducted when the order enters a step.</EmptyState>
  }
  return (
    <>
      <div className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-3">
        {totals.map((t) => (
          <span key={t.name} className="rounded-lg bg-slate-50 px-2.5 py-1 text-xs ring-1 ring-slate-200">
            <span className="text-slate-500">{t.name}</span> <span className="font-semibold tabular-nums text-slate-900">{fmtNum(t.total)} {t.unit}</span>
          </span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-5 py-2 font-medium">Step</th>
              <th className="px-3 py-2 font-medium">Resource</th>
              <th className="px-3 py-2 text-right font-medium">Quantity</th>
              <th className="px-5 py-2 font-medium">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {order.consumption.map((c) => (
              <tr key={c.id}>
                <td className="px-5 py-2">{c.step?.name ?? '—'}</td>
                <td className="px-3 py-2">{c.resource?.name}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtNum(c.quantity)} {c.resource?.unit}</td>
                <td className="px-5 py-2 whitespace-nowrap text-slate-500">{fmtDateTime(c.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function EditOrderDialog({ order, onClose }: { order: OrderDetail; onClose: () => void }) {
  const update = useUpdateOrder(order.id)
  const [form, setForm] = useState({
    productName: order.productName,
    quantity: String(order.quantity),
    priority: order.priority,
    dueDate: order.dueDate ?? '',
    notes: order.notes,
  })
  const qty = Number(form.quantity)
  const invalid = !form.productName.trim() || !Number.isInteger(qty) || qty < 1

  const save = async () => {
    try {
      await update.mutateAsync({ ...form, quantity: qty, dueDate: form.dueDate || null })
      toast.success('Order updated')
      onClose()
    } catch {
      /* shown inline */
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${order.code}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={invalid} loading={update.isPending}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        {update.isError && <ErrorState error={errorMessage(update.error)} />}
        <Field label="Product"><Input value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity"><Input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></Field>
          <Field label="Priority">
            <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as OrderPriority })}>
              <option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="URGENT">Urgent</option>
            </Select>
          </Field>
        </div>
        <Field label="Due date"><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
        <Field label="Notes"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}
