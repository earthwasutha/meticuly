import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import type { OrderEventType } from '../common/enums.js';
import { Step } from '../steps/step.entity.js';
import { Order } from './order.entity.js';

/** Audit trail shown on the order timeline and the dashboard activity feed. */
@Entity('order_events')
@Index(['createdAt'])
export class OrderEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  orderId: number;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Relation<Order>;

  @Column({ type: 'varchar', length: 20 })
  type: OrderEventType;

  @Column({ type: 'int', nullable: true })
  stepId: number | null;

  @ManyToOne(() => Step, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'stepId' })
  step: Relation<Step> | null;

  @Column({ type: 'text', default: '' })
  message: string;

  @Column({ type: 'timestamptz' })
  createdAt: Date;
}
