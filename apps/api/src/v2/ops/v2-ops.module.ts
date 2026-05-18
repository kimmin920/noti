import { Module } from '@nestjs/common';
import { DashboardModule } from '../../dashboard/dashboard.module';
import { HealthModule } from '../../health/health.module';
import { SenderNumbersModule } from '../../sender-numbers/sender-numbers.module';
import { Sms080Module } from '../../sms-080/sms-080.module';
import { SmsQuotaModule } from '../../sms-quota/sms-quota.module';
import { V2OpsController } from './v2-ops.controller';
import { V2OpsService } from './v2-ops.service';

@Module({
  imports: [HealthModule, SenderNumbersModule, Sms080Module, DashboardModule, SmsQuotaModule],
  controllers: [V2OpsController],
  providers: [V2OpsService]
})
export class V2OpsModule {}
