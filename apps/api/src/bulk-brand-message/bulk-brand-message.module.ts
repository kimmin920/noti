import { Module } from '@nestjs/common';
import { BulkBrandMessageService } from './bulk-brand-message.service';

@Module({
  providers: [BulkBrandMessageService],
  exports: [BulkBrandMessageService]
})
export class BulkBrandMessageModule {}
