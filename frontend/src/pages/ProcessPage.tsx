import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { errorMessage } from '../api/client'
import {
  useCreateStep,
  useDeleteStep,
  useReorderSteps,
  useResources,
  useSetRequirements,
  useSteps,
  useUpdateStep,
} from '../api/hooks'
import type { Step } from '../api/types'
import { ResourceTypeBadge } from '../components/badges'
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Select, Spinner, Textarea } from '../components/ui'
import { fmtNum } from '../lib/format'

export function ProcessPage() {
  const { data: steps, isLoading, error } = useSteps()
  const reorder = useReorderSteps()
  const del = useDeleteStep()
  const [editing, setEditing] = useState<Step | 'new' | null>(null)
  const [recipeFor, setRecipeFor] = useState<Step | null>(null)

  const move = (index: number, dir: -1 | 1) => {
    if (!steps) return
    const ids = steps.map((s) => s.id)
    ;[ids[index], ids[index + dir]] = [ids[index + dir], ids[index]]
    reorder.mutate(ids, { onError: (e) => toast.error(errorMessage(e)) })
  }
  const remove = async (s: Step) => {
    if (!confirm(`Delete step "${s.name}"?`)) return
    try {
      await del.mutateAsync(s.id)
      toast.success('Step deleted')
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <>
      <PageHeader
        title="Process setup"
        description="The ordered sequence of steps every order goes through, how many orders each step can handle at once, and what it consumes per unit."
        actions={<Button onClick={() => setEditing('new')}><Plus className="size-4" /> Add step</Button>}
      />
      {isLoading && <Spinner />}
      {error && <ErrorState error={errorMessage(error)} />}
      {steps?.length === 0 && <Card><EmptyState title="No steps defined">Add the first step of your process.</EmptyState></Card>}
      <ol className="space-y-3">
        {steps?.map((s, i) => (
          <li key={s.id}>
            <Card className="p-4">
              <div className="flex flex-wrap items-start gap-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{s.name}</h3>
                    <Badge tone={s.capacity === null ? 'slate' : 'brand'}>
                      {s.capacity === null ? 'Unlimited capacity' : `Capacity ${s.capacity} order${s.capacity > 1 ? 's' : ''}`}
                    </Badge>
                  </div>
                  {s.description && <p className="mt-0.5 text-sm text-slate-500">{s.description}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {s.requirements?.length ? (
                      s.requirements.map((r) => (
                        <span key={r.id} className="rounded-lg bg-slate-50 px-2.5 py-1 text-xs ring-1 ring-slate-200">
                          <span className="text-slate-600">{r.resource.name}</span>{' '}
                          <span className="font-semibold tabular-nums text-slate-900">{fmtNum(r.quantityPerUnit)} {r.resource.unit}</span>
                          <span className="text-slate-400"> / unit</span>
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400">Consumes no resources</span>
                    )}
                    <button onClick={() => setRecipeFor(s)} className="rounded-lg px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50">
                      Edit resources
                    </button>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" aria-label="Move up" disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)}><ArrowUp className="size-4" /></Button>
                  <Button size="sm" variant="ghost" aria-label="Move down" disabled={i === steps.length - 1 || reorder.isPending} onClick={() => move(i, 1)}><ArrowDown className="size-4" /></Button>
                  <Button size="sm" variant="ghost" aria-label="Edit step" onClick={() => setEditing(s)}><Pencil className="size-4" /></Button>
                  <Button size="sm" variant="ghost" aria-label="Delete step" onClick={() => remove(s)}><Trash2 className="size-4" /></Button>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ol>
      {steps && steps.length > 0 && (
        <p className="mt-4 text-xs text-slate-500">
          Changing the order affects where in-progress orders go next. Steps that orders have already passed through cannot be deleted, to keep their history traceable.
        </p>
      )}
      {editing && <StepDialog step={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {recipeFor && <RequirementsDialog step={recipeFor} onClose={() => setRecipeFor(null)} />}
    </>
  )
}

function StepDialog({ step, onClose }: { step?: Step; onClose: () => void }) {
  const create = useCreateStep()
  const update = useUpdateStep()
  const mutation = step ? update : create
  const [form, setForm] = useState({
    name: step?.name ?? '',
    description: step?.description ?? '',
    capacity: step?.capacity?.toString() ?? '',
  })
  const capacity = form.capacity === '' ? null : Number(form.capacity)
  const invalid = !form.name.trim() || (capacity !== null && (!Number.isInteger(capacity) || capacity < 1))

  const save = async () => {
    const input = { name: form.name.trim(), description: form.description, capacity }
    try {
      if (step) await update.mutateAsync({ id: step.id, ...input })
      else await create.mutateAsync(input)
      toast.success(step ? 'Step updated' : 'Step added at the end of the process')
      onClose()
    } catch {
      /* inline */
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={step ? `Edit ${step.name}` : 'Add step'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={invalid} loading={mutation.isPending}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        {mutation.isError && <ErrorState error={errorMessage(mutation.error)} />}
        <Field label="Name"><Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Description"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <Field label="Capacity" hint="Maximum orders worked on at the same time. Leave empty for unlimited.">
          <Input type="number" min={1} step={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="Unlimited" />
        </Field>
      </div>
    </Modal>
  )
}

function RequirementsDialog({ step, onClose }: { step: Step; onClose: () => void }) {
  const resources = useResources()
  const save = useSetRequirements()
  const [rows, setRows] = useState(
    (step.requirements ?? []).map((r) => ({ resourceId: r.resourceId, quantity: String(r.quantityPerUnit) })),
  )
  const used = new Set(rows.map((r) => r.resourceId))
  const available = resources.data?.filter((r) => !used.has(r.id)) ?? []
  const invalid = rows.some((r) => !(Number(r.quantity) > 0))

  const submit = async () => {
    try {
      await save.mutateAsync({
        id: step.id,
        requirements: rows.map((r) => ({ resourceId: r.resourceId, quantityPerUnit: Number(r.quantity) })),
      })
      toast.success(`Resources for ${step.name} saved`)
      onClose()
    } catch {
      /* inline */
    }
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={`Resources consumed by ${step.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={invalid} loading={save.isPending}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        {save.isError && <ErrorState error={errorMessage(save.error)} />}
        <p className="text-sm text-slate-600">
          Amounts are per unit of the order. An order of 10 units consumes 10× these amounts when it enters this step.
        </p>
        {resources.isLoading && <Spinner />}
        {rows.length === 0 && <p className="text-sm text-slate-400">No resources yet.</p>}
        <ul className="space-y-2">
          {rows.map((row, i) => {
            const res = resources.data?.find((r) => r.id === row.resourceId)
            return (
              <li key={row.resourceId} className="flex items-center gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate text-sm font-medium text-slate-800">{res?.name}</span>
                  {res && <ResourceTypeBadge value={res.type} />}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    className="w-28 text-right"
                    value={row.quantity}
                    onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, quantity: e.target.value } : r)))}
                    aria-label={`${res?.name} per unit`}
                  />
                  <span className="w-16 text-xs text-slate-500">{res?.unit} / unit</span>
                </div>
                <Button size="sm" variant="ghost" aria-label="Remove" onClick={() => setRows(rows.filter((_, j) => j !== i))}><X className="size-4" /></Button>
              </li>
            )
          })}
        </ul>
        {available.length > 0 && (
          <Select
            value=""
            onChange={(e) => e.target.value && setRows([...rows, { resourceId: Number(e.target.value), quantity: '1' }])}
            aria-label="Add resource"
          >
            <option value="">+ Add a resource…</option>
            {available.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.unit})</option>)}
          </Select>
        )}
      </div>
    </Modal>
  )
}
