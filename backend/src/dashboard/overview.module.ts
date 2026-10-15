import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module.js';
import { ResourcesModule } from '../resources/resources.module.js';
import { OverviewController } from './overview.controller.js';
import { OverviewService } from './overview.service.js';

@Module({
  imports: [OrdersModule, ResourcesModule],
  controllers: [OverviewController],
  providers: [OverviewService],
})
export class OverviewModule {}
