import { Module } from '@nestjs/common';
import { DashboardModule } from '../../dashboard/dashboard.module';
import { SmsQuotaModule } from '../../sms-quota/sms-quota.module';
import { V2SharedModule } from '../shared/v2-shared.module';
import { V2DashboardController } from './v2-dashboard.controller';
import { V2DashboardService } from './v2-dashboard.service';

@Module({
  imports: [DashboardModule, V2SharedModule, SmsQuotaModule],
  controllers: [V2DashboardController],
  providers: [V2DashboardService]
})
export class V2DashboardModule {}
