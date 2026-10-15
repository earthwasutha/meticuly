import clsx from 'clsx'
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, Layers, ListTodo, Plus, Timer } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { errorMessage } from '../api/client'
import { useDashboard } from '../api/hooks'
import type { Dashboard } from '../api/types'
import { LowStockBadge, ResourceTypeBadge } from '../components/badges'
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, PageHeader, ProgressBar, Spinner } from '../components/ui'
import { fmtDuration, fmtNum, timeAgo } from '../lib/format'
import { useUi } from '../store/ui'

export function DashboardPage() {
  const { data, isLoading, error } = useDashboard()
  const openCreateOrder = useUi((s) => s.openCreateOrder)

  return (
    <>
      <PageHeader
        title="Overview"
        description="Status of every order, load on each step and resource levels."
        actions={<Button onClick={openCreateOrder}><Plus className="size-4" /> New order</Button>}
      />
      {isLoading && <Spinner />}
      {error && <ErrorState error={errorMessage(error)} />}
      {data && <DashboardBody data={data} />}
    </>
  )
}

function DashboardBody({ data }: { data: Dashboard }) {
  const { counts } = data
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Total orders" value={counts.total} icon={<Layers />} />
        <Stat label="Waiting to start" value={counts.PENDING} icon={<ListTodo />} to="/orders?status=PENDING" />
        <Stat label="In production" value={counts.IN_PROGRESS} icon={<Timer />} tone="brand" to="/board" />
        <Stat label="Completed" value={counts.COMPLETED} icon={<CheckCircle2 />} tone="green" to="/orders?status=COMPLETED" />
        <Stat label="Overdue" value={counts.overdue} icon={<Clock />} tone={counts.overdue ? 'red' : undefined} />
        <Stat label="Low-stock resources" value={data.lowStock.length} icon={<AlertTriangle />} tone={data.lowStock.length ? 'amber' : undefined} to="/resources" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Work in progress by step"
            subtitle="Orders currently at each step vs. its capacity, with the average time an order spends there."
            action={<Link to="/board" className="text-xs font-medium text-brand-700 hover:underline">Open board</Link>}
          />
          <StepLoadList data={data} />
        </Card>

        <Card>
          <CardHeader title="Orders completed" subtitle="Last 7 days" />
          <div className="h-56 px-2 py-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.completedByDay.map((d) => ({ ...d, label: d.day.slice(5) }))} margin={{ left: -24, right: 8 }}>
                <CartesianGrid vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="#64748b" />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} stroke="#64748b" />
                <Tooltip cursor={{ fill: '#f1f5f9' }} formatter={(v) => [v, 'Completed']} labelFormatter={(l) => `Day ${l}`} />
                <Bar dataKey="count" fill="#0891b2" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Resource levels"
            subtitle="Stock on hand and total consumed by production so far."
            action={<Link to="/resources" className="text-xs font-medium text-brand-700 hover:underline">Manage</Link>}
          />
          <ResourceTable data={data} />
        </Card>
        <Card>
          <CardHeader title="Recent activity" />
          <ul className="divide-y divide-slate-100">
            {data.recentEvents.length === 0 && <EmptyState title="No activity yet" />}
            {data.recentEvents.map((e) => (
              <li key={e.id} className="px-5 py-2.5 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <Link to={`/orders/${e.orderId}`} className="font-medium text-slate-900 hover:text-brand-700">{e.orderCode}</Link>
                  <span className="shrink-0 text-xs text-slate-400">{timeAgo(e.createdAt)}</span>
                </div>
                <p className="truncate text-slate-600" title={e.message}>{e.message}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}

function Stat({ label, value, icon, tone, to }: { label: string; value: number; icon: ReactNode; tone?: 'brand' | 'green' | 'red' | 'amber'; to?: string }) {
  const toneCls = {
    brand: 'bg-brand-50 text-brand-700',
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-rose-50 text-rose-700',
    amber: 'bg-amber-50 text-amber-700',
  }
  const body = (
    <Card className={clsx('h-full p-4', to && 'transition hover:ring-brand-500/40')}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <span className={clsx('rounded-md p-1.5 [&>svg]:size-4', tone ? toneCls[tone] : 'bg-slate-100 text-slate-500')}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
    </Card>
  )
  return to ? <Link to={to}>{body}</Link> : body
}

function StepLoadList({ data }: { data: Dashboard }) {
  if (data.stepLoad.length === 0) return <EmptyState title="No steps defined">Set up the process first.</EmptyState>
  return (
    <ol className="divide-y divide-slate-100">
      {data.stepLoad.map((s, i) => {
        const util = s.utilization
        const tone = util === null ? 'brand' : util >= 1 ? 'red' : util >= 0.75 ? 'amber' : 'brand'
        return (
          <li key={s.stepId} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 px-5 py-3 sm:grid-cols-[minmax(0,14rem)_1fr_auto]">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">{i + 1}</span>
              <span className="truncate text-sm font-medium text-slate-800">{s.name}</span>
              {data.bottleneckStepId === s.stepId && <Badge tone="amber">Bottleneck</Badge>}
            </div>
            <div className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
              {util === null ? (
                <p className="text-xs text-slate-500">Unlimited capacity</p>
              ) : (
                <ProgressBar value={util} tone={tone} />
              )}
            </div>
            <div className="text-right text-xs text-slate-500">
              <span className="text-sm font-semibold tabular-nums text-slate-900">{s.active}</span>
              {s.capacity !== null && <span className="tabular-nums"> / {s.capacity}</span>} active
              <span className="mx-1.5 text-slate-300">·</span>
              avg {fmtDuration(s.avgMinutes)}
            </div>
          </li>
        )
      })}
      <li className="flex items-center gap-1 px-5 py-2.5 text-xs text-slate-500">
        Orders flow left to right <ArrowRight className="size-3" /> each step consumes resources when an order enters it.
      </li>
    </ol>
  )
}

function ResourceTable({ data }: { data: Dashboard }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs text-slate-500">
          <tr>
            <th className="px-5 py-2 font-medium">Resource</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 text-right font-medium">In stock</th>
            <th className="px-5 py-2 text-right font-medium">Consumed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.resources.map((r) => (
            <tr key={r.id}>
              <td className="px-5 py-2.5">
                <span className="font-medium text-slate-800">{r.name}</span>
                {r.lowStock && <span className="ml-2"><LowStockBadge /></span>}
              </td>
              <td className="px-3 py-2.5"><ResourceTypeBadge value={r.type} /></td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {r.stockQuantity === null ? <span className="whitespace-nowrap text-slate-400">not limited</span> : `${fmtNum(r.stockQuantity)} ${r.unit}`}
              </td>
              <td className="px-5 py-2.5 text-right tabular-nums text-slate-600">{fmtNum(r.consumedTotal)} {r.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
