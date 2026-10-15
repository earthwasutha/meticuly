import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  type Relation,
} from 'typeorm';
import { numericTransformer } from '../common/numeric.transformer.js';
import { Resource } from '../resources/resource.entity.js';
import { Step } from './step.entity.js';

/** Bill of resources: how much of a resource a step uses per unit of order quantity. */
@Entity('step_requirements')
@Unique(['stepId', 'resourceId'])
export class StepRequirement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  stepId: number;

  @ManyToOne(() => Step, (s) => s.requirements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stepId' })
  step: Relation<Step>;

  @Column({ type: 'int' })
  resourceId: number;

  @ManyToOne(() => Resource, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'resourceId' })
  resource: Relation<Resource>;

  @Column({ type: 'numeric', precision: 14, scale: 3, transformer: numericTransformer })
  quantityPerUnit: number;
}
