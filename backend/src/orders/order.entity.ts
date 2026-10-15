import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import type { OrderPriority, OrderStatus } from '../common/enums.js';
import { Step } from '../steps/step.entity.js';

@Entity('orders')
@Index(['status', 'currentStepId'])
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  /** Human readable reference, e.g. ORD-00012. */
  @Column({ type: 'varchar', length: 20, unique: true, nullable: true })
  code: string;

  @Column({ type: 'varchar', length: 150 })
  productName: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'varchar', length: 10, default: 'NORMAL' })
  priority: OrderPriority;

  @Column({ type: 'date', nullable: true })
  dueDate: string | null;

  @Column({ type: 'text', default: '' })
  notes: string;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: OrderStatus;

  /** Step the order is currently being worked on; null while pending or once finished. */
  @Column({ type: 'int', nullable: true })
  currentStepId: number | null;

  @ManyToOne(() => Step, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'currentStepId' })
  currentStep: Relation<Step> | null;

  @Column({ type: 'text', nullable: true })
  cancelReason: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;
}
