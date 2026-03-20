import { Module } from '@nestjs/common';
import { BulkSmsController } from './bulk-sms.controller';
import { BulkSmsService } from './bulk-sms.service';

@Module({
  controllers: [BulkSmsController],
  providers: [BulkSmsService]
})
export class BulkSmsModule {}
