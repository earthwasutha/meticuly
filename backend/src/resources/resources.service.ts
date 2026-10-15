import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { TransactionType } from '../common/enums.js';
import { round3 } from '../common/numeric.transformer.js';
import { StepRequirement } from '../steps/step-requirement.entity.js';
import type {
  AdjustStockDto,
  CreateResourceDto,
  ListTransactionsQuery,
  RestockDto,
  UpdateResourceDto,
} from './dto/resource.dto.js';
import { ResourceTransaction } from './resource-transaction.entity.js';
import { Resource } from './resource.entity.js';

export interface ResourceSummary extends Resource {
  consumedTotal: number;
  lowStock: boolean;
  usedBySteps: string[];
}

@Injectable()
export class ResourcesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Resource) private readonly resources: Repository<Resource>,
    @InjectRepository(ResourceTransaction)
    private readonly transactions: Repository<ResourceTransaction>,
  ) {}

  async findAll(): Promise<ResourceSummary[]> {
    const [resources, totals, usage] = await Promise.all([
      this.resources.find({ order: { type: 'ASC', name: 'ASC' } }),
      this.transactions
        .createQueryBuilder('t')
        .select('t.resourceId', 'resourceId')
        .addSelect('SUM(t.quantity)', 'total')
        .where('t.type = :type', { type: TransactionType.CONSUME })
        .groupBy('t.resourceId')
        .getRawMany<{ resourceId: number; total: string }>(),
      this.dataSource
        .getRepository(StepRequirement)
        .find({ relations: { step: true }, order: { step: { position: 'ASC' } } }),
    ]);
    const consumed = new Map(totals.map((t) => [Number(t.resourceId), Number(t.total)]));
    return resources.map((r) => ({
      ...r,
      consumedTotal: consumed.get(r.id) ?? 0,
      lowStock: isLowStock(r),
      usedBySteps: usage.filter((u) => u.resourceId === r.id).map((u) => u.step.name),
    }));
  }

  async findOne(id: number) {
    const resource = await this.resources.findOneBy({ id });
    if (!resource) throw new NotFoundException(`Resource ${id} not found`);
    return resource;
  }

  async create(dto: CreateResourceDto) {
    await this.assertUniqueName(dto.name);
    return this.dataSource.transaction(async (m) => {
      const resource = await m.save(
        m.create(Resource, {
          ...dto,
          name: dto.name.trim(),
          stockQuantity: dto.stockQuantity ?? null,
          reorderLevel: dto.reorderLevel ?? null,
        }),
      );
      if (resource.stockQuantity !== null && resource.stockQuantity > 0) {
        await this.record(m, resource, TransactionType.RESTOCK, resource.stockQuantity,
          'Opening stock');
      }
      return resource;
    });
  }

  async update(id: number, dto: UpdateResourceDto) {
    const resource = await this.findOne(id);
    if (dto.name !== undefined && dto.name.trim() !== resource.name) {
      await this.assertUniqueName(dto.name);
    }
    Object.assign(resource, { ...dto, name: dto.name?.trim() ?? resource.name });
    return this.resources.save(resource);
  }

  async remove(id: number) {
    await this.findOne(id);
    const [inRecipe, inLedger] = await Promise.all([
      this.dataSource.getRepository(StepRequirement).existsBy({ resourceId: id }),
      this.transactions.existsBy({ resourceId: id, type: TransactionType.CONSUME }),
    ]);
    if (inRecipe) {
      throw new ConflictException('Resource is used by a step. Remove it from the step first.');
    }
    if (inLedger) {
      throw new ConflictException('Resource has consumption history and cannot be deleted.');
    }
    await this.resources.delete(id);
  }

  async restock(id: number, dto: RestockDto) {
    return this.dataSource.transaction(async (m) => {
      const resource = await this.lock(m, id);
      if (resource.stockQuantity === null) {
        throw new ConflictException(
          `${resource.name} is not stock-limited. Set a stock level with an adjustment first.`,
        );
      }
      resource.stockQuantity = round3(resource.stockQuantity + dto.quantity);
      await m.update(Resource, id, { stockQuantity: resource.stockQuantity });
      await this.record(m, resource, TransactionType.RESTOCK, dto.quantity, dto.note ?? 'Restock');
      return resource;
    });
  }

  /** Sets stock to a counted value (stock-take), recording the difference. */
  async adjust(id: number, dto: AdjustStockDto) {
    return this.dataSource.transaction(async (m) => {
      const resource = await this.lock(m, id);
      const before = resource.stockQuantity;
      resource.stockQuantity = dto.stockQuantity === null ? null : round3(dto.stockQuantity);
      await m.update(Resource, id, { stockQuantity: resource.stockQuantity });
      const delta =
        resource.stockQuantity === null ? 0 : round3(resource.stockQuantity - (before ?? 0));
      const note =
        dto.note ||
        (resource.stockQuantity === null
          ? 'Stock tracking disabled'
          : `Stock count: ${before ?? 'untracked'} → ${resource.stockQuantity}`);
      await this.record(m, resource, TransactionType.ADJUST, delta, note);
      return resource;
    });
  }

  listTransactions(q: ListTransactionsQuery) {
    return this.transactions.find({
      where: q.resourceId ? { resourceId: q.resourceId } : {},
      relations: { resource: true, order: true, step: true },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: q.limit ?? 100,
    });
  }

  private async lock(m: EntityManager, id: number) {
    const resource = await m
      .createQueryBuilder(Resource, 'r')
      .setLock('pessimistic_write')
      .where('r.id = :id', { id })
      .getOne();
    if (!resource) throw new NotFoundException(`Resource ${id} not found`);
    return resource;
  }

  private record(
    m: EntityManager,
    resource: Resource,
    type: TransactionType,
    quantity: number,
    note: string,
  ) {
    return m.insert(ResourceTransaction, {
      resourceId: resource.id,
      type,
      quantity,
      balanceAfter: resource.stockQuantity,
      note,
    });
  }

  private async assertUniqueName(name: string) {
    const exists = await this.resources
      .createQueryBuilder('r')
      .where('LOWER(r.name) = LOWER(:name)', { name: name.trim() })
      .getExists();
    if (exists) throw new ConflictException(`A resource named "${name.trim()}" already exists.`);
  }
}

export function isLowStock(r: Pick<Resource, 'stockQuantity' | 'reorderLevel'>) {
  return r.stockQuantity !== null && r.reorderLevel !== null && r.stockQuantity <= r.reorderLevel;
}
