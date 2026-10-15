import clsx from 'clsx'
import { Boxes, ClipboardList, Factory, KanbanSquare, LayoutDashboard, Plus, Workflow } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useUi } from '../store/ui'
import { Button } from './ui'
import { WorkflowDialogs } from './WorkflowDialogs'

const nav = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/board', label: 'Production board', icon: KanbanSquare },
  { to: '/orders', label: 'Orders', icon: ClipboardList },
  { to: '/resources', label: 'Resources', icon: Boxes },
  { to: '/process', label: 'Process setup', icon: Workflow },
]

export function Layout() {
  const openCreateOrder = useUi((s) => s.openCreateOrder)
  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-slate-200 bg-white lg:fixed lg:inset-y-0 lg:w-60 lg:border-r lg:border-b-0">
        <div className="flex items-center gap-2 px-5 py-4">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Factory className="size-4" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-slate-900">Production Tracker</p>
            <p className="text-xs text-slate-500">Manufacturing process</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:pb-0">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden px-3 pt-4 lg:block">
          <Button className="w-full" onClick={openCreateOrder}>
            <Plus className="size-4" /> New order
          </Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:ml-60 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>
      <WorkflowDialogs />
    </div>
  )
}
