import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OverviewService } from './overview.service.js';

@ApiTags('overview')
@Controller()
export class OverviewController {
  constructor(private readonly overview: OverviewService) {}

  @Get('board')
  board() {
    return this.overview.board();
  }

  @Get('dashboard')
  dashboard() {
    return this.overview.dashboard();
  }
}
