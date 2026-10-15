/**
 * Resets the database and loads a demo process with a few days of simulated history.
 * Orders are moved through the real WorkflowService, so stock levels, ledger and
 * step logs are exactly what the application itself would have produced.
 *
 *   npm run seed
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module.js';
import type { OrderPriority, ResourceType } from '../common/enums.js';
import { OrdersService } from '../orders/orders.service.js';
import { ResourcesService } from '../resources/resources.service.js';
import { StepsService } from '../steps/steps.service.js';
import { WorkflowService } from '../workflow/workflow.service.js';

const HOUR = 60 * 60 * 1000;

const RESOURCES: Array<{
  key: string;
  name: string;
  type: ResourceType;
  unit: string;
  stock: number | null;
  reorder: number | null;
}> = [
  { key: 'ti', name: 'Ti-6Al-4V Powder', type: 'MATERIAL', unit: 'kg', stock: 30, reorder: 10 },
  { key: 'fluid', name: 'Cutting Fluid', type: 'MATERIAL', unit: 'L', stock: 12, reorder: 5 },
  { key: 'pouch', name: 'Sterile Pouch', type: 'MATERIAL', unit: 'pcs', stock: 400, reorder: 80 },
  { key: 'label', name: 'UDI Label', type: 'MATERIAL', unit: 'pcs', stock: 500, reorder: 100 },
  { key: 'printer', name: 'Metal 3D Printer', type: 'MACHINE', unit: 'h', stock: null, reorder: null },
  { key: 'cnc', name: 'CNC Machine', type: 'MACHINE', unit: 'h', stock: null, reorder: null },
  { key: 'cmm', name: 'CMM Inspection', type: 'MACHINE', unit: 'h', stock: null, reorder: null },
  { key: 'tech', name: 'Technician', type: 'LABOUR', unit: 'h', stock: null, reorder: null },
];

const STEPS: Array<{
  name: string;
  description: string;
  capacity: number | null;
  uses: Record<string, number>;
}> = [
  {
    name: 'Material Preparation',
    description: 'Sieve and load titanium powder, prepare build file.',
    capacity: 4,
    uses: { ti: 0.12, tech: 0.1 },
  },
  {
    name: '3D Printing',
    description: 'Laser powder-bed fusion of the implant geometry.',
    capacity: 2,
    uses: { printer: 0.5, tech: 0.05 },
  },
  {
    name: 'CNC Finishing',
    description: 'Remove supports and machine critical surfaces.',
    capacity: 3,
    uses: { cnc: 0.3, fluid: 0.05, tech: 0.2 },
  },
  {
    name: 'Quality Inspection',
    description: 'Dimensional check against the patient-specific design.',
    capacity: 2,
    uses: { cmm: 0.1, tech: 0.15 },
  },
  {
    name: 'Sterile Packaging',
    description: 'Clean, pouch, label and release.',
    capacity: null,
    uses: { pouch: 1, label: 1, tech: 0.05 },
  },
];

const PRODUCTS = [
  'Cranial Plate',
  'Mandible Implant',
  'Acetabular Cup',
  'Spinal Cage',
  'Tibial Tray',
  'Orbital Floor Mesh',
];

// Number of advances per order, oldest first (6 = finished all 5 steps).
const STAGES = [6, 6, 6, 6, 6, 6, 6, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1, 0, 0, 0];
const PRIORITIES: OrderPriority[] = ['NORMAL', 'HIGH', 'NORMAL', 'LOW', 'URGENT', 'NORMAL'];

// Small deterministic PRNG so every seed produces the same demo.
let state = 42;
const rand = () => ((state = (state * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const ds = app.get(DataSource);
  await ds.synchronize(true); // drop & recreate schema

  const steps = app.get(StepsService);
  const resources = app.get(ResourcesService);
  const orders = app.get(OrdersService);
  const workflow = app.get(WorkflowService);

  const ids: Record<string, number> = {};
  for (const r of RESOURCES) {
    const created = await resources.create({
      name: r.name,
      type: r.type,
      unit: r.unit,
      stockQuantity: r.stock,
      reorderLevel: r.reorder,
    });
    ids[r.key] = created.id;
  }
  for (const s of STEPS) {
    const step = await steps.create({ name: s.name, description: s.description, capacity: s.capacity });
    await steps.setRequirements(step.id, {
      requirements: Object.entries(s.uses).map(([key, q]) => ({
        resourceId: ids[key],
        quantityPerUnit: q,
      })),
    });
  }

  const now = Date.now();
  const start = now - 4.5 * 24 * HOUR;
  // Opening stock was "received" before the simulated history begins.
  await ds.query(`UPDATE resource_transactions SET "createdAt" = $1`, [new Date(start - HOUR)]);
  for (const [i, stages] of STAGES.entries()) {
    let t = start + i * 5 * HOUR;
    const due = new Date(t + (3 + Math.floor(rand() * 5)) * 24 * HOUR);
    const order = await orders.create(
      {
        productName: PRODUCTS[i % PRODUCTS.length],
        quantity: 4 + Math.floor(rand() * 12),
        priority: PRIORITIES[i % PRIORITIES.length],
        dueDate: due.toISOString().slice(0, 10),
        notes: i % 4 === 0 ? 'Patient-specific design; surgeon sign-off attached.' : '',
      },
      new Date(t),
    );
    for (let k = 0; k < stages; k++) {
      t = Math.min(t + (1 + rand() * 6) * HOUR, now - (stages - k) * 10 * 60 * 1000);
      await workflow.advance(order.id, undefined, new Date(t));
    }
    if (i === 14) {
      await workflow.cancel(order.id, 'Design change requested by surgeon', new Date(t + HOUR));
    }
  }

  // Show a restock in the ledger as well.
  await resources.restock(ids.fluid, { quantity: 4, note: 'PO-2291 delivery' });

  console.log('Seed complete:', {
    steps: STEPS.length,
    resources: RESOURCES.length,
    orders: STAGES.length,
  });
  await app.close();
}

await seed();
