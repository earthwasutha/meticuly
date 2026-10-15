import type { DataSourceOptions } from 'typeorm';
import { OrderEvent } from '../orders/order-event.entity.js';
import { OrderStepLog } from '../orders/order-step-log.entity.js';
import { Order } from '../orders/order.entity.js';
import { ResourceTransaction } from '../resources/resource-transaction.entity.js';
import { Resource } from '../resources/resource.entity.js';
import { StepRequirement } from '../steps/step-requirement.entity.js';
import { Step } from '../steps/step.entity.js';

export const entities = [
  Step,
  StepRequirement,
  Resource,
  ResourceTransaction,
  Order,
  OrderStepLog,
  OrderEvent,
];

export function databaseOptions(): DataSourceOptions {
  return {
    type: 'postgres',
    url: process.env.DATABASE_URL ?? 'postgres://mfg:mfg@localhost:5433/mfg_tracker',
    entities,
    // Prototype: the schema is derived from the entities. A production build would use migrations.
    synchronize: process.env.DB_SYNCHRONIZE !== 'false',
  };
}
