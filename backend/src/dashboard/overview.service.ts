import { Injectable } from '@nestjs/common';
import { DataSource, MoreThanOrEqual } from 'typeorm';
import { OrderStatus, PRIORITY_RANK, StepLogStatus, TransactionType } from '../common/enums.js';
import { OrderEvent } from '../orders/order-event.entity.js';
import { OrderStepLog } from '../orders/order-step-log.entity.js';
import { Order } from '../orders/order.entity.js';
import { OrdersService } from '../orders/orders.service.js';
import { ResourceTransaction } from '../resources/resource-transaction.entity.js';
import { ResourcesService } from '../resources/resources.service.js';
import { Step } from '../steps/step.entity.js';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class OverviewService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly orders: OrdersService,
    private readonly resources: ResourcesService,
  ) {}

  /** Production board: pending queue, one lane per step, recently finished orders. */
  async board() {
    const m = this.dataSource.manager;
    const [steps, open, done] = await Promise.all([
      m.find(Step, { order: { position: 'ASC' } }),
      m.find(Order, {
        where: [{ status: OrderStatus.PENDING }, { status: OrderStatus.IN_PROGRESS }],
      }),
      m.find(Order, {
        where: { status: OrderStatus.COMPLETED },
        order: { completedAt: 'DESC' },
        take: 8,
      }),
    ]);
    const enriched = await this.orders.withStepEntry(open);
    const byPriority = (a: Order, b: Order) =>
      PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] ||
      a.createdAt.getTime() - b.createdAt.getTime();

    return {
      queue: enriched.filter((o) => o.status === OrderStatus.PENDING).sort(byPriority),
      lanes: steps.map((step) => {
        const orders = enriched
          .filter((o) => o.status === OrderStatus.IN_PROGRESS && o.currentStepId === step.id)
          .sort(byPriority);
        return { step, orders, active: orders.length };
      }),
      completed: done,
      stepCount: steps.length,
    };
  }

  async dashboard() {
    const m = this.dataSource.manager;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const since = new Date(Date.now() - 6 * DAY_MS);
    since.setHours(0, 0, 0, 0);

    const [statusRows, overdue, steps, stepStats, resources, completedRows, events, consumptionRows] =
      await Promise.all([
        m.createQueryBuilder(Order, 'o')
          .select('o.status', 'status')
          .addSelect('COUNT(*)', 'count')
          .groupBy('o.status')
          .getRawMany<{ status: OrderStatus; count: string }>(),
        m.createQueryBuilder(Order, 'o')
          .where('o.status IN (:...open)', { open: [OrderStatus.PENDING, OrderStatus.IN_PROGRESS] })
          .andWhere('o.dueDate < :today', { today })
          .getCount(),
        m.find(Step, { order: { position: 'ASC' } }),
        m.createQueryBuilder(OrderStepLog, 'l')
          .select('l.stepId', 'stepId')
          .addSelect(`COUNT(*) FILTER (WHERE l.status = '${StepLogStatus.IN_PROGRESS}')`, 'active')
          .addSelect(`COUNT(*) FILTER (WHERE l.status = '${StepLogStatus.COMPLETED}')`, 'completed')
          .addSelect(
            `AVG(EXTRACT(EPOCH FROM (l.exitedAt - l.enteredAt)) / 60)
               FILTER (WHERE l.status = '${StepLogStatus.COMPLETED}')`,
            'avgMinutes',
          )
          .groupBy('l.stepId')
          .getRawMany<{ stepId: number; active: string; completed: string; avgMinutes: string | null }>(),
        this.resources.findAll(),
        m.find(Order, {
          select: { id: true, completedAt: true },
          where: { completedAt: MoreThanOrEqual(since) },
        }),
        m.find(OrderEvent, {
          relations: { order: true, step: true },
          order: { createdAt: 'DESC', id: 'DESC' },
          take: 12,
        }),
        m.createQueryBuilder(ResourceTransaction, 't')
          .select('t.stepId', 'stepId')
          .addSelect('t.resourceId', 'resourceId')
          .addSelect('SUM(t.quantity)', 'total')
          .where('t.type = :type', { type: TransactionType.CONSUME })
          .groupBy('t.stepId')
          .addGroupBy('t.resourceId')
          .getRawMany<{ stepId: number; resourceId: number; total: string }>(),
      ]);

    const counts = Object.fromEntries(
      Object.values(OrderStatus).map((s) => [s, 0]),
    ) as Record<OrderStatus, number>;
    for (const r of statusRows) counts[r.status] = Number(r.count);

    const stats = new Map(stepStats.map((s) => [Number(s.stepId), s]));
    const resourceById = new Map(resources.map((r) => [r.id, r]));
    const stepLoad = steps.map((step) => {
      const s = stats.get(step.id);
      const active = Number(s?.active ?? 0);
      return {
        stepId: step.id,
        name: step.name,
        position: step.position,
        capacity: step.capacity,
        active,
        completed: Number(s?.completed ?? 0),
        utilization: step.capacity ? active / step.capacity : null,
        avgMinutes: s?.avgMinutes == null ? null : Number(s.avgMinutes),
        consumption: consumptionRows
          .filter((c) => Number(c.stepId) === step.id)
          .map((c) => {
            const r = resourceById.get(Number(c.resourceId));
            return { resourceId: Number(c.resourceId), name: r?.name ?? '?', unit: r?.unit ?? '', total: Number(c.total) };
          }),
      };
    });
    // The bottleneck is the most utilised capacity-limited step (or the busiest unlimited one).
    const bottleneck = [...stepLoad]
      .filter((s) => s.active > 0)
      .sort((a, b) => (b.utilization ?? 0) - (a.utilization ?? 0) || b.active - a.active)[0];

    // Bucketed by the server's local calendar day (not UTC) so "today" matches the shop floor.
    const localDay = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const completedByDay = Array.from({ length: 7 }, (_, i) => {
      const day = localDay(new Date(since.getTime() + i * DAY_MS));
      return {
        day,
        count: completedRows.filter((o) => o.completedAt && localDay(o.completedAt) === day).length,
      };
    });

    return {
      counts: { ...counts, total: Object.values(counts).reduce((a, b) => a + b, 0), overdue },
      stepLoad,
      bottleneckStepId: bottleneck?.stepId ?? null,
      resources,
      lowStock: resources.filter((r) => r.lowStock),
      completedByDay,
      recentEvents: events.map((e) => ({
        id: e.id,
        type: e.type,
        message: e.message,
        createdAt: e.createdAt,
        orderId: e.orderId,
        orderCode: e.order?.code,
        stepName: e.step?.name ?? null,
      })),
    };
  }
}
