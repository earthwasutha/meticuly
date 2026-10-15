import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { StepRequirement } from './step-requirement.entity.js';

/** A work station in the manufacturing sequence (e.g. Machining). */
@Entity('steps')
export class Step {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ type: 'text', default: '' })
  description: string;

  /** 1-based order in the process. Orders always move to the next position. */
  @Column({ type: 'int' })
  position: number;

  /** Max number of orders this step can work on at once; null = unlimited. */
  @Column({ type: 'int', nullable: true })
  capacity: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => StepRequirement, (r) => r.step, { cascade: true })
  requirements: Relation<StepRequirement>[];
}
