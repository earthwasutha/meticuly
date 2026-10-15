import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, In, Repository } from 'typeorm';
import { OrderEventType, OrderStatus, StepLogStatus } from '../common/enums.js';
import { ResourceTransaction } from '../resources/resource-transaction.entity.js';
import { OrderEvent } from './order-event.entity.js';
import { OrderStepLog } from './order-step-log.entity.js';
import { Order } from './order.entity.js';
import type { CreateOrderDto, ListOrdersQuery, UpdateOrderDto } from './dto/order.dto.js';

@Injectable()
export class OrdersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderStepLog) private readonly logs: Repository<OrderStepLog>,
  ) {}

  async create(dto: CreateOrderDto, now = new Date()) {
    return this.dataSource.transaction(async (m) => {
      const order = m.create(Order, {
        productName: dto.productName.trim(),
        quantity: dto.quantity,
        priority: dto.priority ?? 'NORMAL',
        dueDate: dto.dueDate ?? null,
        notes: dto.notes ?? '',
        status: OrderStatus.PENDING,
        createdAt: now,
      });
      await m.save(order);
      order.code = `ORD-${String(order.id).padStart(5, '0')}`;
      await m.update(Order, order.id, { code: order.code });
      await m.insert(OrderEvent, {
        orderId: order.id,
        type: OrderEventType.CREATED,
        message: `Created for ${order.quantity} × ${order.productName}`,
        createdAt: now,
      });
      return order;
    });
  }

  async list(q: ListOrdersQuery) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const qb = this.orders
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.currentStep', 'step')
      .orderBy('o.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);
    if (q.status) qb.andWhere('o.status = :status', { status: q.status });
    if (q.stepId) qb.andWhere('o.currentStepId = :stepId', { stepId: q.stepId });
    if (q.search?.trim()) {
      const term = `%${q.search.trim()}%`;
      qb.andWhere(
        new Brackets((w) =>
          w.where('o.code ILIKE :term', { term }).orWhere('o.productName ILIKE :term', { term }),
        ),
      );
    }
    const [items, total] = await qb.getManyAndCount();
    return { items: await this.withStepEntry(items), total, page, pageSize };
  }

  async get(id: number) {
    const order = await this.orders.findOne({ where: { id }, relations: { currentStep: true } });
    if (!order) throw new NotFoundException(`Order ${id} not found`);

    const [stepLogs, consumption, events] = await Promise.all([
      this.logs.find({
        where: { orderId: id },
        relations: { step: true },
        order: { enteredAt: 'ASC', id: 'ASC' },
      }),
      this.dataSource.getRepository(ResourceTransaction).find({
        where: { orderId: id },
        relations: { resource: true, step: true },
        order: { createdAt: 'ASC', id: 'ASC' },
      }),
      this.dataSource.getRepository(OrderEvent).find({
        where: { orderId: id },
        relations: { step: true },
        order: { createdAt: 'ASC', id: 'ASC' },
      }),
    ]);
    const [withEntry] = await this.withStepEntry([order]);
    return { ...withEntry, stepLogs, consumption, events };
  }

  /** Only pending orders can be edited: quantities drive resource consumption once work starts. */
  async update(id: number, dto: UpdateOrderDto) {
    const order = await this.orders.findOneBy({ id });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    if (order.status !== OrderStatus.PENDING) {
      throw new ConflictException('Only pending orders can be edited.');
    }
    Object.assign(order, {
      ...dto,
      productName: dto.productName?.trim() ?? order.productName,
    });
    await this.orders.save(order);
    await this.dataSource.getRepository(OrderEvent).insert({
      orderId: id,
      type: OrderEventType.UPDATED,
      message: 'Order details updated',
      createdAt: new Date(),
    });
    return order;
  }

  async remove(id: number) {
    const order = await this.orders.findOneBy({ id });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    if (order.status !== OrderStatus.PENDING) {
      throw new ConflictException('Only pending orders can be deleted; cancel it instead.');
    }
    await this.orders.delete(id);
  }

  /** Attaches when each in-progress order entered its current step (time-in-step on the UI). */
  async withStepEntry<T extends Order>(orders: T[]) {
    const active = orders.filter((o) => o.status === OrderStatus.IN_PROGRESS);
    const logs = active.length
      ? await this.logs.findBy({
          orderId: In(active.map((o) => o.id)),
          status: StepLogStatus.IN_PROGRESS,
        })
      : [];
    const entered = new Map(logs.map((l) => [l.orderId, l.enteredAt]));
    return orders.map((o) => ({ ...o, stepEnteredAt: entered.get(o.id) ?? null }));
  }
}
