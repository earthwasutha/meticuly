import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import {
  OrderEventType,
  OrderStatus,
  StepLogStatus,
  TransactionType,
} from '../common/enums.js';
import { round3 } from '../common/numeric.transformer.js';
import { OrderEvent } from '../orders/order-event.entity.js';
import { OrderStepLog } from '../orders/order-step-log.entity.js';
import { Order } from '../orders/order.entity.js';
import { ResourceTransaction } from '../resources/resource-transaction.entity.js';
import { Resource } from '../resources/resource.entity.js';
import { StepRequirement } from '../steps/step-requirement.entity.js';
import { Step } from '../steps/step.entity.js';
import {
  evaluateTransition,
  resolveTransition,
  TransitionError,
  type TransitionPlan,
} from './transition.rules.js';

/**
 * Owns every state change of an order on the shop floor.
 *
 * Advancing is atomic: closing the current step, checking capacity and stock,
 * deducting resources, writing the ledger and opening the next step all happen
 * in one transaction. Rows are locked in a fixed order (order -> step ->
 * resources by id) so concurrent advances cannot oversell stock or overfill a
 * step, and cannot deadlock each other.
 */
@Injectable()
export class WorkflowService {
  constructor(private readonly dataSource: DataSource) {}

  /** Dry run: what would happen if the order were advanced right now. */
  async preview(orderId: number): Promise<TransitionPlan> {
    const m = this.dataSource.manager;
    const order = await m.findOneBy(Order, { id: orderId });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);
    return this.plan(m, order, false);
  }

  /**
   * Moves the order one step forward. `expectedStepId` protects against stale
   * screens / double clicks: if the order already moved, nothing happens.
   */
  async advance(orderId: number, expectedStepId?: number | null, now = new Date()) {
    return this.dataSource.transaction(async (m) => {
      const order = await this.lockOrder(m, orderId);
      if (expectedStepId !== undefined && order.currentStepId !== expectedStepId) {
        throw new ConflictException(
          'This order has already moved since you loaded the page. Refresh and try again.',
        );
      }

      const plan = await this.plan(m, order, true);
      if (!plan.canAdvance) {
        throw new ConflictException({
          message: plan.blockers.join(' '),
          blockers: plan.blockers,
          plan,
        });
      }

      if (plan.from) {
        await m.update(
          OrderStepLog,
          { orderId: order.id, stepId: plan.from.id, status: StepLogStatus.IN_PROGRESS },
          { status: StepLogStatus.COMPLETED, exitedAt: now },
        );
        await this.event(m, order.id, OrderEventType.STEP_COMPLETED, plan.from.id, now,
          `Finished ${plan.from.name}`);
      }

      if (plan.to) {
        await this.consume(m, order, plan, now);
        await m.insert(OrderStepLog, {
          orderId: order.id,
          stepId: plan.to.id,
          status: StepLogStatus.IN_PROGRESS,
          enteredAt: now,
        });
        order.status = OrderStatus.IN_PROGRESS;
        order.currentStepId = plan.to.id;
        order.startedAt ??= now;
        const used = plan.consumption.map((c) => `${c.required} ${c.unit} ${c.resourceName}`);
        await this.event(m, order.id, OrderEventType.STEP_STARTED, plan.to.id, now,
          `Started ${plan.to.name}` + (used.length ? ` — consumed ${used.join(', ')}` : ''));
      } else {
        order.status = OrderStatus.COMPLETED;
        order.currentStepId = null;
        order.completedAt = now;
        await this.event(m, order.id, OrderEventType.COMPLETED, null, now, 'Order completed');
      }

      await m.save(order);
      return { order, plan };
    });
  }

  /** Cancels an open order. Resources already consumed are not returned (treated as scrap). */
  async cancel(orderId: number, reason: string, now = new Date()) {
    return this.dataSource.transaction(async (m) => {
      const order = await this.lockOrder(m, orderId);
      if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.CANCELLED) {
        throw new ConflictException(`Order is already ${order.status.toLowerCase()}.`);
      }
      const stepId = order.currentStepId;
      if (stepId !== null) {
        await m.update(
          OrderStepLog,
          { orderId: order.id, stepId, status: StepLogStatus.IN_PROGRESS },
          { status: StepLogStatus.CANCELLED, exitedAt: now },
        );
      }
      order.status = OrderStatus.CANCELLED;
      order.currentStepId = null;
      order.cancelledAt = now;
      order.cancelReason = reason;
      await this.event(m, order.id, OrderEventType.CANCELLED, stepId, now,
        `Cancelled${reason ? `: ${reason}` : ''}`);
      return m.save(order);
    });
  }

  // ---------------------------------------------------------------------------

  private async lockOrder(m: EntityManager, id: number) {
    const order = await m
      .createQueryBuilder(Order, 'o')
      .setLock('pessimistic_write')
      .where('o.id = :id', { id })
      .getOne();
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order;
  }

  private async plan(m: EntityManager, order: Order, lock: boolean): Promise<TransitionPlan> {
    const steps = await m.find(Step, { order: { position: 'ASC' } });
    let transition;
    try {
      transition = resolveTransition(order, steps);
    } catch (e) {
      if (e instanceof TransitionError) throw new ConflictException(e.message);
      throw e;
    }
    const target = transition.to;
    if (!target) return evaluateTransition(transition, order, 0, []);

    if (lock) {
      // Serialises entries into the same step so the capacity count below is reliable.
      await m
        .createQueryBuilder(Step, 's')
        .setLock('pessimistic_write')
        .where('s.id = :id', { id: target.id })
        .getOne();
    }
    const active = await m.countBy(Order, {
      currentStepId: target.id,
      status: OrderStatus.IN_PROGRESS,
    });

    const requirements = await m.find(StepRequirement, {
      where: { stepId: target.id },
      order: { resourceId: 'ASC' },
    });
    const ids = requirements.map((r) => r.resourceId);
    let resources: Resource[] = [];
    if (ids.length) {
      const qb = m
        .createQueryBuilder(Resource, 'r')
        .where('r.id IN (:...ids)', { ids })
        .orderBy('r.id', 'ASC');
      resources = await (lock ? qb.setLock('pessimistic_write') : qb).getMany();
    }
    const byId = new Map(resources.map((r) => [r.id, r]));

    return evaluateTransition(
      transition,
      order,
      active,
      requirements.map((r) => {
        const res = byId.get(r.resourceId)!;
        return {
          resourceId: res.id,
          resourceName: res.name,
          unit: res.unit,
          quantityPerUnit: r.quantityPerUnit,
          stockQuantity: res.stockQuantity,
        };
      }),
    );
  }

  private async consume(m: EntityManager, order: Order, plan: TransitionPlan, now: Date) {
    if (!plan.consumption.length) return;
    const resources = await m.findBy(Resource, {
      id: In(plan.consumption.map((c) => c.resourceId)),
    });
    const byId = new Map(resources.map((r) => [r.id, r]));

    for (const line of plan.consumption) {
      const resource = byId.get(line.resourceId)!;
      if (resource.stockQuantity !== null) {
        resource.stockQuantity = round3(resource.stockQuantity - line.required);
        await m.update(Resource, resource.id, { stockQuantity: resource.stockQuantity });
      }
      await m.insert(ResourceTransaction, {
        resourceId: resource.id,
        type: TransactionType.CONSUME,
        quantity: line.required,
        balanceAfter: resource.stockQuantity,
        orderId: order.id,
        stepId: plan.to!.id,
        note: `${order.code} @ ${plan.to!.name}`,
        createdAt: now,
      });
    }
  }

  private event(
    m: EntityManager,
    orderId: number,
    type: OrderEventType,
    stepId: number | null,
    createdAt: Date,
    message: string,
  ) {
    return m.insert(OrderEvent, { orderId, type, stepId, createdAt, message });
  }
}
