import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { OrderStepLog } from '../orders/order-step-log.entity.js';
import { Resource } from '../resources/resource.entity.js';
import type {
  CreateStepDto,
  ReorderStepsDto,
  SetRequirementsDto,
  UpdateStepDto,
} from './dto/step.dto.js';
import { StepRequirement } from './step-requirement.entity.js';
import { Step } from './step.entity.js';

@Injectable()
export class StepsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Step) private readonly steps: Repository<Step>,
  ) {}

  findAll() {
    return this.steps.find({
      relations: { requirements: { resource: true } },
      order: { position: 'ASC', requirements: { resourceId: 'ASC' } },
    });
  }

  async findOne(id: number) {
    const step = await this.steps.findOne({
      where: { id },
      relations: { requirements: { resource: true } },
    });
    if (!step) throw new NotFoundException(`Step ${id} not found`);
    return step;
  }

  async create(dto: CreateStepDto) {
    await this.assertUniqueName(dto.name);
    const { max } = (await this.steps
      .createQueryBuilder('s')
      .select('COALESCE(MAX(s.position), 0)', 'max')
      .getRawOne<{ max: number }>())!;
    const step = await this.steps.save(
      this.steps.create({
        name: dto.name.trim(),
        description: dto.description ?? '',
        capacity: dto.capacity ?? null,
        position: Number(max) + 1,
      }),
    );
    return this.findOne(step.id);
  }

  async update(id: number, dto: UpdateStepDto) {
    const step = await this.findOne(id);
    if (dto.name !== undefined && dto.name.trim() !== step.name) {
      await this.assertUniqueName(dto.name);
    }
    await this.steps.update(id, {
      name: dto.name?.trim() ?? step.name,
      description: dto.description ?? step.description,
      capacity: dto.capacity === undefined ? step.capacity : dto.capacity,
    });
    return this.findOne(id);
  }

  /** Steps that orders have already passed through are kept for traceability. */
  async remove(id: number) {
    await this.findOne(id);
    const used = await this.dataSource.getRepository(OrderStepLog).existsBy({ stepId: id });
    if (used) {
      throw new ConflictException(
        'This step has production history and cannot be deleted.',
      );
    }
    await this.dataSource.transaction(async (m) => {
      await m.delete(Step, id);
      const rest = await m.find(Step, { order: { position: 'ASC' } });
      for (const [i, s] of rest.entries()) await m.update(Step, s.id, { position: i + 1 });
    });
  }

  async reorder(dto: ReorderStepsDto) {
    const all = await this.steps.find();
    const known = new Set(all.map((s) => s.id));
    if (dto.ids.length !== all.length || !dto.ids.every((id) => known.has(id))) {
      throw new BadRequestException('ids must list every step exactly once.');
    }
    await this.dataSource.transaction(async (m) => {
      for (const [i, id] of dto.ids.entries()) await m.update(Step, id, { position: i + 1 });
    });
    return this.findAll();
  }

  /** Replaces the full list of resources a step consumes. */
  async setRequirements(id: number, dto: SetRequirementsDto) {
    await this.findOne(id);
    const ids = dto.requirements.map((r) => r.resourceId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Each resource can only be listed once per step.');
    }
    if (ids.length) {
      const count = await this.dataSource
        .getRepository(Resource)
        .createQueryBuilder('r')
        .where('r.id IN (:...ids)', { ids })
        .getCount();
      if (count !== ids.length) throw new BadRequestException('Unknown resource in requirements.');
    }
    await this.dataSource.transaction(async (m) => {
      await m.delete(StepRequirement, { stepId: id });
      if (dto.requirements.length) {
        await m.insert(
          StepRequirement,
          dto.requirements.map((r) => ({ stepId: id, ...r })),
        );
      }
    });
    return this.findOne(id);
  }

  private async assertUniqueName(name: string) {
    const exists = await this.steps
      .createQueryBuilder('s')
      .where('LOWER(s.name) = LOWER(:name)', { name: name.trim() })
      .getExists();
    if (exists) throw new ConflictException(`A step named "${name.trim()}" already exists.`);
  }
}
