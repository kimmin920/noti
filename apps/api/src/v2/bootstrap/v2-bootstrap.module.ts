import { Module } from '@nestjs/common';
import { DashboardModule } from '../../dashboard/dashboard.module';
import { V2SharedModule } from '../shared/v2-shared.module';
import { V2BootstrapController } from './v2-bootstrap.controller';
import { V2BootstrapService } from './v2-bootstrap.service';

@Module({
  imports: [DashboardModule, V2SharedModule],
  controllers: [V2BootstrapController],
  providers: [V2BootstrapService]
})
export class V2BootstrapModule {}
