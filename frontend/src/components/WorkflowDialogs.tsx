import clsx from 'clsx'
import { AlertTriangle, ArrowRight, CheckCircle2, Flag, PlayCircle } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { useAdvanceOrder, useCancelOrder, useCreateOrder, useNextPreview } from '../api/hooks'
import type { OrderPriority, TransitionPlan } from '../api/types'
import { fmtNum } from '../lib/format'
import { useUi } from '../store/ui'
import { Badge, Button, ErrorState, Field, Input, Modal, Select, Spinner, Textarea } from './ui'

/** Dialogs are mounted once in the layout and opened from anywhere via the UI store. */
export function WorkflowDialogs() {
  return (
    <>
      <CreateOrderDialog />
      <AdvanceDialog />
      <CancelDialog />
    </>
  )
}

function CreateOrderDialog() {
  const { createOrderOpen, closeCreateOrder, openAdvance } = useUi()
  const navigate = useNavigate()
  const create = useCreateOrder()
  const empty = { productName: '', quantity: '1', priority: 'NORMAL' as OrderPriority, dueDate: '', notes: '' }
  const [form, setForm] = useState(empty)
  const [startNow, setStartNow] = useState(false)

  const qty = Number(form.quantity)
  const invalid = !form.productName.trim() || !Number.isInteger(qty) || qty < 1

  const close = () => {
    closeCreateOrder()
    setForm(empty)
    setStartNow(false)
    create.reset()
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (invalid) return
    try {
      const order = await create.mutateAsync({
        productName: form.productName.trim(),
        quantity: qty,
        priority: form.priority,
        dueDate: form.dueDate || null,
        notes: form.notes,
      })
      toast.success(`${order.code} created`)
      close()
      if (startNow) openAdvance({ id: order.id, code: order.code, expectedStepId: null })
      else navigate(`/orders/${order.id}`)
    } catch {
      /* shown inline */
    }
  }

  return (
    <Modal
      open={createOrderOpen}
      onClose={close}
      title="New production order"
      footer={
        <>
          <Button variant="secondary" onClick={close}>Cancel</Button>
          <Button type="submit" form="create-order" disabled={invalid} loading={create.isPending}>
            Create order
          </Button>
        </>
      }
    >
      <form id="create-order" onSubmit={submit} className="space-y-4">
        {create.isError && <ErrorState error={errorMessage(create.error)} />}
        <Field label="Product">
          <Input
            autoFocus
            required
            maxLength={150}
            placeholder="e.g. Cranial Plate"
            value={form.productName}
            onChange={(e) => setForm({ ...form, productName: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity" hint="Units to produce; drives resource usage.">
            <Input
              type="number"
              min={1}
              step={1}
              required
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </Field>
          <Field label="Priority">
            <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as OrderPriority })}>
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </Select>
          </Field>
        </div>
        <Field label="Due date" hint="Optional. Open orders past this date are flagged as overdue.">
          <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
        </Field>
        <Field label="Notes">
          <Textarea maxLength={2000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="size-4 rounded border-slate-300 accent-brand-600"
            checked={startNow}
            onChange={(e) => setStartNow(e.target.checked)}
          />
          Start production right away
        </label>
      </form>
    </Modal>
  )
}

const kindCopy = {
  START: { verb: 'Start production', icon: PlayCircle },
  MOVE: { verb: 'Move to next step', icon: ArrowRight },
  COMPLETE: { verb: 'Complete order', icon: Flag },
}

function AdvanceDialog() {
  const { advanceTarget: target, closeAdvance } = useUi()
  const preview = useNextPreview(target?.id ?? null)
  const advance = useAdvanceOrder()
  const plan = preview.data

  const confirm = async () => {
    if (!target) return
    try {
      const { order, plan } = await advance.mutateAsync({ id: target.id, expectedStepId: target.expectedStepId })
      toast.success(
        plan.to ? `${order.code} → ${plan.to.name}` : `${order.code} completed`,
      )
      closeAdvance()
    } catch (e) {
      toast.error(errorMessage(e), { duration: 6000 })
      preview.refetch()
    }
  }

  const copy = plan ? kindCopy[plan.kind] : kindCopy.MOVE
  return (
    <Modal
      open={!!target}
      onClose={closeAdvance}
      title={target ? `${copy.verb} · ${target.code}` : ''}
      footer={
        <>
          <Button variant="secondary" onClick={closeAdvance}>Close</Button>
          <Button onClick={confirm} disabled={!plan?.canAdvance} loading={advance.isPending}>
            <copy.icon className="size-4" /> Confirm
          </Button>
        </>
      }
    >
      {preview.isLoading && <Spinner label="Checking next step…" />}
      {preview.isError && <ErrorState error={errorMessage(preview.error)} />}
      {plan && <PlanView plan={plan} />}
    </Modal>
  )
}

function PlanView({ plan }: { plan: TransitionPlan }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm">
        <StepChip label="From" name={plan.from?.name ?? 'Queue (pending)'} />
        <ArrowRight className="size-4 shrink-0 text-slate-400" />
        <StepChip label="To" name={plan.to?.name ?? 'Completed'} highlight />
      </div>

      {plan.to && plan.capacity && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">Capacity at {plan.to.name}</span>
          {plan.capacity.limit === null ? (
            <Badge tone="slate">{plan.capacity.active} active · unlimited</Badge>
          ) : (
            <Badge tone={plan.capacity.active >= plan.capacity.limit ? 'red' : 'green'}>
              {plan.capacity.active} / {plan.capacity.limit} in use
            </Badge>
          )}
        </div>
      )}

      {plan.to && (
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Resources consumed on entry</p>
          {plan.consumption.length === 0 ? (
            <p className="text-sm text-slate-500">This step does not consume any tracked resources.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="pb-1 font-medium">Resource</th>
                  <th className="pb-1 text-right font-medium">Required</th>
                  <th className="pb-1 text-right font-medium">In stock</th>
                  <th className="pb-1 text-right font-medium">After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {plan.consumption.map((c) => (
                  <tr key={c.resourceId} className={clsx(!c.sufficient && 'text-rose-700')}>
                    <td className="py-1.5">{c.resourceName}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmtNum(c.required)} {c.unit}</td>
                    <td className="py-1.5 text-right tabular-nums">
                      {c.available === null ? <span className="text-slate-400">not limited</span> : `${fmtNum(c.available)} ${c.unit}`}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {c.available === null ? '—' : `${fmtNum(Math.round((c.available - c.required) * 1000) / 1000)} ${c.unit}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {plan.blockers.length > 0 ? (
        <div className="space-y-1 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-200">
          {plan.blockers.map((b) => (
            <p key={b} className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{b}</p>
          ))}
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle2 className="size-4" />
          {plan.to ? 'Ready — resources will be deducted when you confirm.' : 'All steps done — the order will be marked as completed.'}
        </p>
      )}
    </div>
  )
}

function StepChip({ label, name, highlight }: { label: string; name: string; highlight?: boolean }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={clsx('truncate font-medium', highlight ? 'text-brand-700' : 'text-slate-800')}>{name}</p>
    </div>
  )
}

function CancelDialog() {
  const { cancelTarget: target, closeCancel } = useUi()
  const cancel = useCancelOrder()
  const [reason, setReason] = useState('')

  const close = () => {
    closeCancel()
    setReason('')
  }
  const confirm = async () => {
    if (!target) return
    try {
      const order = await cancel.mutateAsync({ id: target.id, reason })
      toast.success(`${order.code} cancelled`)
      close()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <Modal
      open={!!target}
      onClose={close}
      title={`Cancel ${target?.code ?? ''}`}
      footer={
        <>
          <Button variant="secondary" onClick={close}>Keep order</Button>
          <Button variant="danger" onClick={confirm} loading={cancel.isPending}>Cancel order</Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          The order leaves the production line and frees its slot. Resources already consumed are
          not returned to stock (treated as scrap).
        </p>
        <Field label="Reason">
          <Textarea autoFocus maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer changed the design" />
        </Field>
      </div>
    </Modal>
  )
}
