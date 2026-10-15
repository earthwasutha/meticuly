import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import type { TransactionType } from '../common/enums.js';
import { numericTransformer } from '../common/numeric.transformer.js';
import { Order } from '../orders/order.entity.js';
import { Step } from '../steps/step.entity.js';
import { Resource } from './resource.entity.js';

/** Append-only ledger of every stock movement (consumption, restock, adjustment). */
@Entity('resource_transactions')
@Index(['resourceId', 'createdAt'])
export class ResourceTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  resourceId: number;

  @ManyToOne(() => Resource, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resourceId' })
  resource: Relation<Resource>;

  @Column({ type: 'varchar', length: 20 })
  type: TransactionType;

  /** CONSUME/RESTOCK: positive amount (direction given by `type`). ADJUST: signed delta. */
  @Column({ type: 'numeric', precision: 14, scale: 3, transformer: numericTransformer })
  quantity: number;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 3,
    nullable: true,
    transformer: numericTransformer,
  })
  balanceAfter: number | null;

  @Column({ type: 'int', nullable: true })
  orderId: number | null;

  @ManyToOne(() => Order, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'orderId' })
  order: Relation<Order> | null;

  @Column({ type: 'int', nullable: true })
  stepId: number | null;

  @ManyToOne(() => Step, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'stepId' })
  step: Relation<Step> | null;

  @Column({ type: 'text', default: '' })
  note: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
