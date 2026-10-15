import { OrderStatus } from '../common/enums.js';
import {
  evaluateTransition,
  resolveTransition,
  TransitionError,
  type OrderState,
  type StepRef,
} from './transition.rules.js';

const steps: StepRef[] = [
  { id: 10, name: 'Cutting', position: 1, capacity: 2 },
  { id: 20, name: 'Machining', position: 2, capacity: null },
  { id: 30, name: 'QC', position: 3, capacity: 1 },
];

const order = (patch: Partial<OrderState> = {}): OrderState => ({
  status: OrderStatus.PENDING,
  quantity: 4,
  currentStepId: null,
  ...patch,
});

describe('resolveTransition', () => {
  it('starts a pending order at the first step', () => {
    const t = resolveTransition(order(), steps);
    expect(t.kind).toBe('START');
    expect(t.from).toBeNull();
    expect(t.to?.id).toBe(10);
  });

  it('moves an in-progress order to the next step only (no skipping)', () => {
    const t = resolveTransition(order({ status: OrderStatus.IN_PROGRESS, currentStepId: 10 }), steps);
    expect(t.kind).toBe('MOVE');
    expect(t.from?.id).toBe(10);
    expect(t.to?.id).toBe(20);
  });

  it('completes the order when it leaves the last step', () => {
    const t = resolveTransition(order({ status: OrderStatus.IN_PROGRESS, currentStepId: 30 }), steps);
    expect(t.kind).toBe('COMPLETE');
    expect(t.to).toBeNull();
  });

  it.each([OrderStatus.COMPLETED, OrderStatus.CANCELLED])('rejects %s orders', (status) => {
    expect(() => resolveTransition(order({ status }), steps)).toThrow(TransitionError);
  });

  it('rejects when no steps are configured', () => {
    expect(() => resolveTransition(order(), [])).toThrow('No process steps');
  });
});

describe('evaluateTransition', () => {
  const titanium = {
    resourceId: 1,
    resourceName: 'Titanium',
    unit: 'kg',
    quantityPerUnit: 0.25,
    stockQuantity: 5,
  };
  const labour = {
    resourceId: 2,
    resourceName: 'Labour',
    unit: 'h',
    quantityPerUnit: 1.5,
    stockQuantity: null,
  };

  it('scales consumption by order quantity and allows the move', () => {
    const t = resolveTransition(order(), steps);
    const plan = evaluateTransition(t, order(), 0, [titanium, labour]);
    expect(plan.canAdvance).toBe(true);
    expect(plan.consumption.map((c) => c.required)).toEqual([1, 6]);
    expect(plan.consumption[1].sufficient).toBe(true); // unlimited resource
  });

  it('blocks when stock is insufficient', () => {
    const t = resolveTransition(order(), steps);
    const plan = evaluateTransition(t, order({ quantity: 40 }), 0, [titanium]);
    expect(plan.canAdvance).toBe(false);
    expect(plan.consumption[0]).toMatchObject({ required: 10, available: 5, sufficient: false });
    expect(plan.blockers[0]).toContain('Not enough Titanium');
  });

  it('blocks when the target step is at capacity', () => {
    const t = resolveTransition(order(), steps);
    const plan = evaluateTransition(t, order(), 2, []);
    expect(plan.canAdvance).toBe(false);
    expect(plan.blockers[0]).toContain('full capacity');
  });

  it('ignores capacity for unlimited steps', () => {
    const o = order({ status: OrderStatus.IN_PROGRESS, currentStepId: 10 });
    const plan = evaluateTransition(resolveTransition(o, steps), o, 999, []);
    expect(plan.canAdvance).toBe(true);
  });

  it('always allows completion from the last step', () => {
    const o = order({ status: OrderStatus.IN_PROGRESS, currentStepId: 30 });
    const plan = evaluateTransition(resolveTransition(o, steps), o, 0, []);
    expect(plan).toMatchObject({ kind: 'COMPLETE', canAdvance: true, consumption: [] });
  });
});
