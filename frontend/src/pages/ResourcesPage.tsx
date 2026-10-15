import { PackagePlus, Pencil, Plus, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { errorMessage } from '../api/client'
import {
  useAdjustStock,
  useCreateResource,
  useDeleteResource,
  useResources,
  useRestock,
  useTransactions,
  useUpdateResource,
} from '../api/hooks'
import type { ResourceSummary, ResourceType } from '../api/types'
import { LowStockBadge, ResourceTypeBadge, TransactionBadge } from '../components/badges'
import { Button, Card, CardHeader, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Select, Spinner } from '../components/ui'
import { fmtDateTime, fmtNum } from '../lib/format'

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit' | 'restock' | 'adjust'; resource: ResourceSummary }
  | null

export function ResourcesPage() {
  const { data, isLoading, error } = useResources()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [ledgerFilter, setLedgerFilter] = useState<number | ''>('')
  const del = useDeleteResource()

  const remove = async (r: ResourceSummary) => {
    if (!confirm(`Delete ${r.name}?`)) return
    try {
      await del.mutateAsync(r.id)
      toast.success(`${r.name} deleted`)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <>
      <PageHeader
        title="Resources"
        description="Materials, machine time and labour consumed by the process. Stock-limited resources block a step when they run out."
        actions={<Button onClick={() => setDialog({ kind: 'create' })}><Plus className="size-4" /> New resource</Button>}
      />
      {isLoading && <Spinner />}
      {error && <ErrorState error={errorMessage(error)} />}
      {data && (
        <Card className="mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-2 font-medium">Resource</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 text-right font-medium">In stock</th>
                  <th className="px-3 py-2 text-right font-medium">Reorder at</th>
                  <th className="px-3 py-2 text-right font-medium">Consumed</th>
                  <th className="px-3 py-2 font-medium">Used by</th>
                  <th className="px-5 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.length === 0 && (
                  <tr><td colSpan={7}><EmptyState title="No resources yet" /></td></tr>
                )}
                {data.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{r.name}</span>
                        {r.lowStock && <LowStockBadge />}
                      </div>
                    </td>
                    <td className="px-3 py-2.5"><ResourceTypeBadge value={r.type} /></td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {r.stockQuantity === null ? <span className="whitespace-nowrap text-slate-400">not limited</span> : <span className="font-medium">{fmtNum(r.stockQuantity)} {r.unit}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{r.reorderLevel === null ? '—' : `${fmtNum(r.reorderLevel)} ${r.unit}`}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmtNum(r.consumedTotal)} {r.unit}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{r.usedBySteps.join(', ') || '—'}</td>
                    <td className="px-5 py-2.5">
                      <div className="flex justify-end gap-1">
                        {r.stockQuantity !== null && (
                          <Button size="sm" variant="secondary" onClick={() => setDialog({ kind: 'restock', resource: r })}>
                            <PackagePlus className="size-3.5" /> Restock
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" title="Stock count / tracking" aria-label="Adjust stock" onClick={() => setDialog({ kind: 'adjust', resource: r })}>
                          <SlidersHorizontal className="size-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" title="Edit" aria-label="Edit" onClick={() => setDialog({ kind: 'edit', resource: r })}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" title="Delete" aria-label="Delete" onClick={() => remove(r)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Stock ledger"
          subtitle="Every consumption, restock and adjustment, newest first."
          action={
            <Select className="w-52" value={ledgerFilter} onChange={(e) => setLedgerFilter(e.target.value ? Number(e.target.value) : '')} aria-label="Filter ledger by resource">
              <option value="">All resources</option>
              {data?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
          }
        />
        <Ledger resourceId={ledgerFilter || undefined} />
      </Card>

      {dialog?.kind === 'create' && <ResourceFormDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === 'edit' && <ResourceFormDialog resource={dialog.resource} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'restock' && <RestockDialog resource={dialog.resource} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'adjust' && <AdjustDialog resource={dialog.resource} onClose={() => setDialog(null)} />}
    </>
  )
}

function Ledger({ resourceId }: { resourceId?: number }) {
  const { data, isLoading } = useTransactions(resourceId, 50)
  if (isLoading) return <Spinner />
  if (!data?.length) return <EmptyState title="No stock movements yet" />
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs text-slate-500">
          <tr>
            <th className="px-5 py-2 font-medium">When</th>
            <th className="px-3 py-2 font-medium">Resource</th>
            <th className="px-3 py-2 font-medium">Movement</th>
            <th className="px-3 py-2 text-right font-medium">Quantity</th>
            <th className="px-3 py-2 text-right font-medium">Balance</th>
            <th className="px-5 py-2 font-medium">Reference</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((t) => {
            const sign = t.type === 'CONSUME' ? '−' : t.type === 'RESTOCK' ? '+' : t.quantity >= 0 ? '+' : '−'
            return (
              <tr key={t.id}>
                <td className="px-5 py-2 whitespace-nowrap text-slate-500">{fmtDateTime(t.createdAt)}</td>
                <td className="px-3 py-2">{t.resource?.name}</td>
                <td className="px-3 py-2"><TransactionBadge value={t.type} /></td>
                <td className="px-3 py-2 text-right tabular-nums">{sign}{fmtNum(Math.abs(t.quantity))} {t.resource?.unit}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-500">{t.balanceAfter === null ? '—' : fmtNum(t.balanceAfter)}</td>
                <td className="px-5 py-2 text-slate-600">
                  {t.order ? (
                    <>
                      <Link to={`/orders/${t.order.id}`} className="font-medium text-brand-700 hover:underline">{t.order.code}</Link>
                      {t.step && <span className="text-slate-500"> @ {t.step.name}</span>}
                    </>
                  ) : (
                    t.note
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ResourceFormDialog({ resource, onClose }: { resource?: ResourceSummary; onClose: () => void }) {
  const create = useCreateResource()
  const update = useUpdateResource()
  const mutation = resource ? update : create
  const [form, setForm] = useState({
    name: resource?.name ?? '',
    type: resource?.type ?? ('MATERIAL' as ResourceType),
    unit: resource?.unit ?? '',
    tracked: resource ? resource.stockQuantity !== null : true,
    stockQuantity: '',
    reorderLevel: resource?.reorderLevel?.toString() ?? '',
  })
  const invalid = !form.name.trim() || !form.unit.trim() || (!resource && form.tracked && form.stockQuantity === '')

  const save = async () => {
    const reorderLevel = form.reorderLevel === '' ? null : Number(form.reorderLevel)
    try {
      if (resource) {
        await update.mutateAsync({ id: resource.id, name: form.name, type: form.type, unit: form.unit, reorderLevel })
      } else {
        await create.mutateAsync({
          name: form.name,
          type: form.type,
          unit: form.unit,
          stockQuantity: form.tracked ? Number(form.stockQuantity) : null,
          reorderLevel: form.tracked ? reorderLevel : null,
        })
      }
      toast.success(resource ? 'Resource updated' : 'Resource created')
      onClose()
    } catch {
      /* inline */
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={resource ? `Edit ${resource.name}` : 'New resource'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={invalid} loading={mutation.isPending}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        {mutation.isError && <ErrorState error={errorMessage(mutation.error)} />}
        <Field label="Name"><Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Titanium powder" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select
              value={form.type}
              onChange={(e) => {
                const type = e.target.value as ResourceType
                setForm({ ...form, type, tracked: resource ? form.tracked : type === 'MATERIAL' })
              }}
            >
              <option value="MATERIAL">Material</option>
              <option value="MACHINE">Machine time</option>
              <option value="LABOUR">Labour</option>
            </Select>
          </Field>
          <Field label="Unit"><Input value={form.unit} maxLength={20} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="kg, pcs, h…" /></Field>
        </div>
        {!resource && (
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" className="mt-0.5 size-4 accent-brand-600" checked={form.tracked} onChange={(e) => setForm({ ...form, tracked: e.target.checked })} />
            <span>
              Limit by stock
              <span className="block text-xs text-slate-500">If off, usage is recorded but never blocks production (typical for machine time and labour).</span>
            </span>
          </label>
        )}
        {(resource ? resource.stockQuantity !== null : form.tracked) && (
          <div className="grid grid-cols-2 gap-3">
            {!resource && (
              <Field label="Opening stock"><Input type="number" min={0} step="any" value={form.stockQuantity} onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })} /></Field>
            )}
            <Field label="Reorder level" hint="Flag as low stock at or below this.">
              <Input type="number" min={0} step="any" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} />
            </Field>
          </div>
        )}
      </div>
    </Modal>
  )
}

function RestockDialog({ resource, onClose }: { resource: ResourceSummary; onClose: () => void }) {
  const restock = useRestock()
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const qty = Number(quantity)
  const save = async () => {
    try {
      await restock.mutateAsync({ id: resource.id, quantity: qty, note })
      toast.success(`Added ${fmtNum(qty)} ${resource.unit} of ${resource.name}`)
      onClose()
    } catch {
      /* inline */
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={`Restock ${resource.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={!(qty > 0)} loading={restock.isPending}>Add stock</Button>
        </>
      }
    >
      <div className="space-y-4">
        {restock.isError && <ErrorState error={errorMessage(restock.error)} />}
        <p className="text-sm text-slate-600">Current stock: <span className="font-medium text-slate-900">{fmtNum(resource.stockQuantity)} {resource.unit}</span></p>
        <Field label={`Quantity received (${resource.unit})`}>
          <Input autoFocus type="number" min={0} step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </Field>
        <Field label="Reference"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. PO number or supplier" /></Field>
      </div>
    </Modal>
  )
}

function AdjustDialog({ resource, onClose }: { resource: ResourceSummary; onClose: () => void }) {
  const adjust = useAdjustStock()
  const [tracked, setTracked] = useState(resource.stockQuantity !== null)
  const [count, setCount] = useState(resource.stockQuantity?.toString() ?? '')
  const [note, setNote] = useState('')
  const invalid = tracked && (count === '' || Number(count) < 0)
  const save = async () => {
    try {
      await adjust.mutateAsync({ id: resource.id, stockQuantity: tracked ? Number(count) : null, note })
      toast.success('Stock updated')
      onClose()
    } catch {
      /* inline */
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={`Stock count · ${resource.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={invalid} loading={adjust.isPending}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        {adjust.isError && <ErrorState error={errorMessage(adjust.error)} />}
        <p className="text-sm text-slate-600">Correct the on-hand quantity after a physical count. The difference is recorded in the ledger.</p>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="size-4 accent-brand-600" checked={tracked} onChange={(e) => setTracked(e.target.checked)} />
          Limit production by stock
        </label>
        {tracked && (
          <Field label={`Counted quantity (${resource.unit})`}>
            <Input autoFocus type="number" min={0} step="any" value={count} onChange={(e) => setCount(e.target.value)} />
          </Field>
        )}
        <Field label="Note"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Monthly stock-take" /></Field>
      </div>
    </Modal>
  )
}
