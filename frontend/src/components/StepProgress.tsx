import clsx from 'clsx'
import { Check } from 'lucide-react'
import type { Order, Step } from '../api/types'

/** Compact horizontal tracker showing which step an order is at. */
export function StepProgress({ order, steps }: { order: Pick<Order, 'status' | 'currentStepId'>; steps: Step[] }) {
  const index = steps.findIndex((s) => s.id === order.currentStepId)
  const done = order.status === 'COMPLETED'
  return (
    <ol className="flex items-center gap-1" aria-label="Step progress">
      {steps.map((s, i) => {
        const complete = done || (index !== -1 && i < index)
        const current = i === index
        return (
          <li key={s.id} title={s.name} className="flex items-center gap-1">
            <span
              className={clsx(
                'flex size-5 items-center justify-center rounded-full text-[10px] font-semibold',
                complete && 'bg-emerald-500 text-white',
                current && 'bg-brand-600 text-white ring-4 ring-brand-100',
                !complete && !current && 'bg-slate-200 text-slate-500',
                order.status === 'CANCELLED' && 'opacity-50',
              )}
            >
              {complete ? <Check className="size-3" /> : i + 1}
            </span>
            {i < steps.length - 1 && (
              <span className={clsx('h-0.5 w-3 rounded', complete ? 'bg-emerald-400' : 'bg-slate-200')} />
            )}
          </li>
        )
      })}
    </ol>
  )
}
