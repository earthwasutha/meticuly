import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StepRequirement } from './step-requirement.entity.js';
import { Step } from './step.entity.js';
import { StepsController } from './steps.controller.js';
import { StepsService } from './steps.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Step, StepRequirement])],
  controllers: [StepsController],
  providers: [StepsService],
  exports: [StepsService],
})
export class StepsModule {}
