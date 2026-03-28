import { Module } from '@nestjs/common';
import { V2BootstrapModule } from './bootstrap/v2-bootstrap.module';
import { V2CampaignsModule } from './campaigns/v2-campaigns.module';
import { V2DashboardModule } from './dashboard/v2-dashboard.module';
import { V2EventsModule } from './events/v2-events.module';
import { V2LogsModule } from './logs/v2-logs.module';
import { V2OpsModule } from './ops/v2-ops.module';
import { V2ResourcesModule } from './resources/v2-resources.module';
import { V2SendModule } from './send/v2-send.module';
import { V2TemplatesModule } from './templates/v2-templates.module';

@Module({
  imports: [
    V2BootstrapModule,
    V2DashboardModule,
    V2ResourcesModule,
    V2SendModule,
    V2TemplatesModule,
    V2EventsModule,
    V2LogsModule,
    V2CampaignsModule,
    V2OpsModule
  ]
})
export class V2Module {}
