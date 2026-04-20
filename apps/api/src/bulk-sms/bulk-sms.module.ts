import { Module } from '@nestjs/common';
import { BulkSmsController } from './bulk-sms.controller';
import { BulkSmsService } from './bulk-sms.service';
import { SmsQuotaModule } from '../sms-quota/sms-quota.module';

@Module({
  imports: [SmsQuotaModule],
  controllers: [BulkSmsController],
  providers: [BulkSmsService],
  exports: [BulkSmsService]
})
export class BulkSmsModule {}
