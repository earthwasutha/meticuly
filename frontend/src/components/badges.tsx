import { AlertTriangle } from 'lucide-react'
import type { OrderPriority, OrderStatus, ResourceType, TransactionType } from '../api/types'
import { Badge, type Tone } from './ui'

const status: Record<OrderStatus, [string, Tone]> = {
  PENDING: ['Pending', 'slate'],
  IN_PROGRESS: ['In progress', 'blue'],
  COMPLETED: ['Completed', 'green'],
  CANCELLED: ['Cancelled', 'red'],
}
export const StatusBadge = ({ value }: { value: OrderStatus }) => (
  <Badge tone={status[value][1]}>{status[value][0]}</Badge>
)

const priority: Record<OrderPriority, Tone> = { LOW: 'slate', NORMAL: 'slate', HIGH: 'amber', URGENT: 'red' }
export const PriorityBadge = ({ value, hideNormal }: { value: OrderPriority; hideNormal?: boolean }) =>
  hideNormal && value === 'NORMAL' ? null : (
    <Badge tone={priority[value]}>{value.charAt(0) + value.slice(1).toLowerCase()}</Badge>
  )

const resourceType: Record<ResourceType, [string, Tone]> = {
  MATERIAL: ['Material', 'brand'],
  MACHINE: ['Machine', 'violet'],
  LABOUR: ['Labour', 'amber'],
}
export const ResourceTypeBadge = ({ value }: { value: ResourceType }) => (
  <Badge tone={resourceType[value][1]}>{resourceType[value][0]}</Badge>
)

const tx: Record<TransactionType, [string, Tone]> = {
  CONSUME: ['Consumed', 'blue'],
  RESTOCK: ['Restock', 'green'],
  ADJUST: ['Adjustment', 'slate'],
}
export const TransactionBadge = ({ value }: { value: TransactionType }) => (
  <Badge tone={tx[value][1]}>{tx[value][0]}</Badge>
)

export const OverdueBadge = () => (
  <Badge tone="red">
    <AlertTriangle className="size-3" /> Overdue
  </Badge>
)

export const LowStockBadge = () => (
  <Badge tone="amber">
    <AlertTriangle className="size-3" /> Low stock
  </Badge>
)
