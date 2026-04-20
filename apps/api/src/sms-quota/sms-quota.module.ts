import { Module } from '@nestjs/common';
import { SmsQuotaService } from './sms-quota.service';

@Module({
  providers: [SmsQuotaService],
  exports: [SmsQuotaService]
})
export class SmsQuotaModule {}
