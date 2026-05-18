import { Module } from '@nestjs/common';
import { MessageRequestsController } from './message-requests.controller';
import { MessageLogsController } from './message-logs.controller';
import { PublEventsController } from './publ-events.controller';
import { MessageRequestsService } from './message-requests.service';
import { NhnModule } from '../nhn/nhn.module';
import { SmsQuotaModule } from '../sms-quota/sms-quota.module';

@Module({
  imports: [NhnModule, SmsQuotaModule],
  controllers: [MessageRequestsController, MessageLogsController, PublEventsController],
  providers: [MessageRequestsService],
  exports: [MessageRequestsService]
})
export class MessageRequestsModule {}
