import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import type { StepLogStatus } from '../common/enums.js';
import { Step } from '../steps/step.entity.js';
import { Order } from './order.entity.js';

/** One row per visit of an order to a step: the traceable production history. */
@Entity('order_step_logs')
@Index(['stepId', 'status'])
export class OrderStepLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  orderId: number;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Relation<Order>;

  @Column({ type: 'int' })
  stepId: number;

  @ManyToOne(() => Step, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'stepId' })
  step: Relation<Step>;

  @Column({ type: 'varchar', length: 20 })
  status: StepLogStatus;

  @Column({ type: 'timestamptz' })
  enteredAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  exitedAt: Date | null;
}
