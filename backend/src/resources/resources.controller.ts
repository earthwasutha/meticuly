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
import {
  AdjustStockDto,
  CreateResourceDto,
  ListTransactionsQuery,
  RestockDto,
  UpdateResourceDto,
} from './dto/resource.dto.js';
import { ResourcesService } from './resources.service.js';

@ApiTags('resources')
@Controller('resources')
export class ResourcesController {
  constructor(private readonly resources: ResourcesService) {}

  @Get()
  findAll() {
    return this.resources.findAll();
  }

  /** Stock ledger: consumption, restocks and adjustments, newest first. */
  @Get('transactions')
  transactions(@Query() query: ListTransactionsQuery) {
    return this.resources.listTransactions(query);
  }

  @Post()
  create(@Body() dto: CreateResourceDto) {
    return this.resources.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateResourceDto) {
    return this.resources.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.resources.remove(id);
  }

  @Post(':id/restock')
  @HttpCode(200)
  restock(@Param('id', ParseIntPipe) id: number, @Body() dto: RestockDto) {
    return this.resources.restock(id, dto);
  }

  @Post(':id/adjust')
  @HttpCode(200)
  adjust(@Param('id', ParseIntPipe) id: number, @Body() dto: AdjustStockDto) {
    return this.resources.adjust(id, dto);
  }
}
