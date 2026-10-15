import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CreateStepDto,
  ReorderStepsDto,
  SetRequirementsDto,
  UpdateStepDto,
} from './dto/step.dto.js';
import { StepsService } from './steps.service.js';

@ApiTags('steps')
@Controller('steps')
export class StepsController {
  constructor(private readonly steps: StepsService) {}

  @Get()
  findAll() {
    return this.steps.findAll();
  }

  @Post()
  create(@Body() dto: CreateStepDto) {
    return this.steps.create(dto);
  }

  @Put('reorder')
  reorder(@Body() dto: ReorderStepsDto) {
    return this.steps.reorder(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStepDto) {
    return this.steps.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.steps.remove(id);
  }

  @Put(':id/requirements')
  setRequirements(@Param('id', ParseIntPipe) id: number, @Body() dto: SetRequirementsDto) {
    return this.steps.setRequirements(id, dto);
  }
}
