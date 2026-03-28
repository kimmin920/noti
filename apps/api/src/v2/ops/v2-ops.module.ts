import { Module } from '@nestjs/common';
import { HealthModule } from '../../health/health.module';
import { V2OpsController } from './v2-ops.controller';
import { V2OpsService } from './v2-ops.service';

@Module({
  imports: [HealthModule],
  controllers: [V2OpsController],
  providers: [V2OpsService]
})
export class V2OpsModule {}
