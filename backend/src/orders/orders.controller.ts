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
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WorkflowService } from '../workflow/workflow.service.js';
import {
  AdvanceOrderDto,
  CancelOrderDto,
  CreateOrderDto,
  ListOrdersQuery,
  UpdateOrderDto,
} from './dto/order.dto.js';
import { OrdersService } from './orders.service.js';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly workflow: WorkflowService,
  ) {}

  @Get()
  list(@Query() query: ListOrdersQuery) {
    return this.orders.list(query);
  }

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.orders.create(dto);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.orders.get(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOrderDto) {
    return this.orders.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.orders.remove(id);
  }

  /** What advancing would do right now (next step, resources needed, blockers). */
  @Get(':id/next')
  preview(@Param('id', ParseIntPipe) id: number) {
    return this.workflow.preview(id);
  }

  @Post(':id/advance')
  @HttpCode(200)
  advance(@Param('id', ParseIntPipe) id: number, @Body() dto: AdvanceOrderDto) {
    return this.workflow.advance(id, dto.expectedStepId);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Param('id', ParseIntPipe) id: number, @Body() dto: CancelOrderDto) {
    return this.workflow.cancel(id, dto.reason?.trim() ?? '');
  }
}
