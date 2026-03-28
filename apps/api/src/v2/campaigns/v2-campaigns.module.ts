import { Module } from '@nestjs/common';
import { BulkAlimtalkModule } from '../../bulk-alimtalk/bulk-alimtalk.module';
import { BulkSmsModule } from '../../bulk-sms/bulk-sms.module';
import { V2SharedModule } from '../shared/v2-shared.module';
import { V2CampaignsController } from './v2-campaigns.controller';
import { V2CampaignsService } from './v2-campaigns.service';

@Module({
  imports: [BulkSmsModule, BulkAlimtalkModule, V2SharedModule],
  controllers: [V2CampaignsController],
  providers: [V2CampaignsService]
})
export class V2CampaignsModule {}
