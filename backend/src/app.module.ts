import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseOptions } from './database/data-source.js';
import { OverviewModule } from './dashboard/overview.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { ResourcesModule } from './resources/resources.module.js';
import { StepsModule } from './steps/steps.module.js';
import { WorkflowModule } from './workflow/workflow.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({ useFactory: () => databaseOptions() }),
    StepsModule,
    ResourcesModule,
    WorkflowModule,
    OrdersModule,
    OverviewModule,
  ],
})
export class AppModule {}
