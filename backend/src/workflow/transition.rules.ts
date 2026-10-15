import { OrderStatus } from '../common/enums.js';
import { round3 } from '../common/numeric.transformer.js';

/**
 * Pure business rules for moving an order through the process.
 * Kept free of database access so they can be unit-tested and reused for both
 * the "preview" endpoint and the actual (transactional) advance.
 */

export interface StepRef {
  id: number;
  name: string;
  position: number;
  capacity: number | null;
}

export interface OrderState {
  status: OrderStatus;
  quantity: number;
  currentStepId: number | null;
}

export interface RequirementState {
  resourceId: number;
  resourceName: string;
  unit: string;
  quantityPerUnit: number;
  /** Current stock; null when the resource is not stock-limited. */
  stockQuantity: number | null;
}

export type TransitionKind = 'START' | 'MOVE' | 'COMPLETE';

export interface Transition {
  kind: TransitionKind;
  from: StepRef | null;
  to: StepRef | null;
}

export interface ConsumptionLine {
  resourceId: number;
  resourceName: string;
  unit: string;
  required: number;
  available: number | null;
  sufficient: boolean;
}

export interface TransitionPlan extends Transition {
  consumption: ConsumptionLine[];
  capacity: { limit: number | null; active: number } | null;
  blockers: string[];
  canAdvance: boolean;
}

export class TransitionError extends Error {}

/** Works out where an order goes next. Steps must be sorted by position. */
export function resolveTransition(order: OrderState, steps: StepRef[]): Transition {
  if (order.status === OrderStatus.COMPLETED) {
    throw new TransitionError('Order is already completed.');
  }
  if (order.status === OrderStatus.CANCELLED) {
    throw new TransitionError('Order has been cancelled.');
  }
  if (steps.length === 0) {
    throw new TransitionError('No process steps are defined.');
  }

  if (order.currentStepId === null) {
    return { kind: 'START', from: null, to: steps[0] };
  }

  const index = steps.findIndex((s) => s.id === order.currentStepId);
  if (index === -1) {
    throw new TransitionError('Order is at an unknown step.');
  }
  const next = steps[index + 1] ?? null;
  return next
    ? { kind: 'MOVE', from: steps[index], to: next }
    : { kind: 'COMPLETE', from: steps[index], to: null };
}

/**
 * Checks whether the target step can accept the order: it needs a free slot
 * (capacity) and enough stock of every resource the step consumes.
 */
export function evaluateTransition(
  transition: Transition,
  order: OrderState,
  targetActiveCount: number,
  requirements: RequirementState[],
): TransitionPlan {
  if (!transition.to) {
    return { ...transition, consumption: [], capacity: null, blockers: [], canAdvance: true };
  }

  const blockers: string[] = [];
  const limit = transition.to.capacity;
  if (limit !== null && targetActiveCount >= limit) {
    blockers.push(
      `"${transition.to.name}" is at full capacity (${targetActiveCount}/${limit} orders).`,
    );
  }

  const consumption = requirements.map((r): ConsumptionLine => {
    const required = round3(r.quantityPerUnit * order.quantity);
    const sufficient = r.stockQuantity === null || r.stockQuantity >= required;
    if (!sufficient) {
      blockers.push(
        `Not enough ${r.resourceName}: needs ${required} ${r.unit}, ${r.stockQuantity} ${r.unit} available.`,
      );
    }
    return {
      resourceId: r.resourceId,
      resourceName: r.resourceName,
      unit: r.unit,
      required,
      available: r.stockQuantity,
      sufficient,
    };
  });

  return {
    ...transition,
    consumption,
    capacity: { limit, active: targetActiveCount },
    blockers,
    canAdvance: blockers.length === 0,
  };
}
