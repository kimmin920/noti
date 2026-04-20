import { Module } from '@nestjs/common';
import { BulkAlimtalkModule } from '../../bulk-alimtalk/bulk-alimtalk.module';
import { BulkBrandMessageModule } from '../../bulk-brand-message/bulk-brand-message.module';
import { BulkSmsModule } from '../../bulk-sms/bulk-sms.module';
import { ProviderResultsModule } from '../../provider-results/provider-results.module';
import { V2SharedModule } from '../shared/v2-shared.module';
import { V2CampaignsController } from './v2-campaigns.controller';
import { V2CampaignsService } from './v2-campaigns.service';

@Module({
  imports: [BulkSmsModule, BulkAlimtalkModule, BulkBrandMessageModule, ProviderResultsModule, V2SharedModule],
  controllers: [V2CampaignsController],
  providers: [V2CampaignsService]
})
export class V2CampaignsModule {}
