export type OrderStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type OrderPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
export type ResourceType = 'MATERIAL' | 'MACHINE' | 'LABOUR'
export type TransactionType = 'CONSUME' | 'RESTOCK' | 'ADJUST'
export type StepLogStatus = 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type OrderEventType =
  | 'CREATED'
  | 'UPDATED'
  | 'STEP_STARTED'
  | 'STEP_COMPLETED'
  | 'COMPLETED'
  | 'CANCELLED'

export interface Resource {
  id: number
  name: string
  type: ResourceType
  unit: string
  stockQuantity: number | null
  reorderLevel: number | null
  createdAt: string
  updatedAt: string
}

export interface ResourceSummary extends Resource {
  consumedTotal: number
  lowStock: boolean
  usedBySteps: string[]
}

export interface StepRequirement {
  id: number
  stepId: number
  resourceId: number
  quantityPerUnit: number
  resource: Resource
}

export interface Step {
  id: number
  name: string
  description: string
  position: number
  capacity: number | null
  createdAt: string
  requirements?: StepRequirement[]
}

export interface Order {
  id: number
  code: string
  productName: string
  quantity: number
  priority: OrderPriority
  dueDate: string | null
  notes: string
  status: OrderStatus
  currentStepId: number | null
  currentStep?: Step | null
  cancelReason: string | null
  createdAt: string
  updatedAt: string
  startedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  stepEnteredAt?: string | null
}

export interface StepLog {
  id: number
  orderId: number
  stepId: number
  step: Step
  status: StepLogStatus
  enteredAt: string
  exitedAt: string | null
}

export interface ResourceTransaction {
  id: number
  resourceId: number
  resource?: Resource
  type: TransactionType
  quantity: number
  balanceAfter: number | null
  orderId: number | null
  order?: Order | null
  stepId: number | null
  step?: Step | null
  note: string
  createdAt: string
}

export interface OrderEvent {
  id: number
  orderId: number
  type: OrderEventType
  stepId: number | null
  step?: Step | null
  message: string
  createdAt: string
}

export interface OrderDetail extends Order {
  stepLogs: StepLog[]
  consumption: ResourceTransaction[]
  events: OrderEvent[]
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface ConsumptionLine {
  resourceId: number
  resourceName: string
  unit: string
  required: number
  available: number | null
  sufficient: boolean
}

export interface TransitionPlan {
  kind: 'START' | 'MOVE' | 'COMPLETE'
  from: Step | null
  to: Step | null
  consumption: ConsumptionLine[]
  capacity: { limit: number | null; active: number } | null
  blockers: string[]
  canAdvance: boolean
}

export interface Board {
  queue: Order[]
  lanes: { step: Step; orders: Order[]; active: number }[]
  completed: Order[]
  stepCount: number
}

export interface StepLoad {
  stepId: number
  name: string
  position: number
  capacity: number | null
  active: number
  completed: number
  utilization: number | null
  avgMinutes: number | null
  consumption: { resourceId: number; name: string; unit: string; total: number }[]
}

export interface Dashboard {
  counts: Record<OrderStatus, number> & { total: number; overdue: number }
  stepLoad: StepLoad[]
  bottleneckStepId: number | null
  resources: ResourceSummary[]
  lowStock: ResourceSummary[]
  completedByDay: { day: string; count: number }[]
  recentEvents: {
    id: number
    type: OrderEventType
    message: string
    createdAt: string
    orderId: number
    orderCode: string
    stepName: string | null
  }[]
}

export interface OrderInput {
  productName: string
  quantity: number
  priority: OrderPriority
  dueDate: string | null
  notes: string
}

export interface StepInput {
  name: string
  description: string
  capacity: number | null
}

export interface ResourceInput {
  name: string
  type: ResourceType
  unit: string
  stockQuantity?: number | null
  reorderLevel: number | null
}
