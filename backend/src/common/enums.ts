export const ResourceType = {
  MATERIAL: 'MATERIAL',
  MACHINE: 'MACHINE',
  LABOUR: 'LABOUR',
} as const;
export type ResourceType = (typeof ResourceType)[keyof typeof ResourceType];

export const OrderStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const OrderPriority = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;
export type OrderPriority = (typeof OrderPriority)[keyof typeof OrderPriority];

export const PRIORITY_RANK: Record<OrderPriority, number> = {
  LOW: 0,
  NORMAL: 1,
  HIGH: 2,
  URGENT: 3,
};

export const StepLogStatus = {
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type StepLogStatus = (typeof StepLogStatus)[keyof typeof StepLogStatus];

export const TransactionType = {
  CONSUME: 'CONSUME',
  RESTOCK: 'RESTOCK',
  ADJUST: 'ADJUST',
} as const;
export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

export const OrderEventType = {
  CREATED: 'CREATED',
  UPDATED: 'UPDATED',
  STEP_STARTED: 'STEP_STARTED',
  STEP_COMPLETED: 'STEP_COMPLETED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type OrderEventType = (typeof OrderEventType)[keyof typeof OrderEventType];
