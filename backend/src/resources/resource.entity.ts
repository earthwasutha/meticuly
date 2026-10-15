import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ResourceType } from '../common/enums.js';
import { numericTransformer } from '../common/numeric.transformer.js';

/** Anything a step consumes: material, machine time or labour. */
@Entity('resources')
export class Resource {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  type: ResourceType;

  @Column({ type: 'varchar', length: 20 })
  unit: string;

  /**
   * Quantity on hand. null = not stock-limited (consumption is still recorded),
   * which is how machine time and labour are modelled by default.
   */
  @Column({
    type: 'numeric',
    precision: 14,
    scale: 3,
    nullable: true,
    transformer: numericTransformer,
  })
  stockQuantity: number | null;

  /** Stock at or below this level is flagged as low. */
  @Column({
    type: 'numeric',
    precision: 14,
    scale: 3,
    nullable: true,
    transformer: numericTransformer,
  })
  reorderLevel: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
