const dateTime = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})
const dateOnly = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 })

export const fmtDateTime = (v: string | null | undefined) => (v ? dateTime.format(new Date(v)) : '—')
export const fmtDate = (v: string | null | undefined) => (v ? dateOnly.format(new Date(v)) : '—')
export const fmtNum = (v: number | null | undefined) => (v === null || v === undefined ? '—' : number.format(v))

export function fmtDuration(minutes: number | null | undefined) {
  if (minutes === null || minutes === undefined) return '—'
  if (minutes < 1) return '< 1m'
  const d = Math.floor(minutes / 1440)
  const h = Math.floor((minutes % 1440) / 60)
  const m = Math.round(minutes % 60)
  if (d) return `${d}d ${h}h`
  if (h) return `${h}h ${m}m`
  return `${m}m`
}

export const minutesBetween = (from: string, to?: string | null) =>
  ((to ? new Date(to).getTime() : Date.now()) - new Date(from).getTime()) / 60000

export function timeAgo(v: string) {
  return `${fmtDuration(minutesBetween(v))} ago`
}

/** True when an open order is past its due date. */
export function isOverdue(o: { dueDate: string | null; status: string }) {
  if (!o.dueDate || o.status === 'COMPLETED' || o.status === 'CANCELLED') return false
  const d = new Date()
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return o.dueDate < today
}
