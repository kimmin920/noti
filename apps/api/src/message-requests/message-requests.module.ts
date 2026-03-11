import { Module } from '@nestjs/common';
import { MessageRequestsController } from './message-requests.controller';
import { MessageLogsController } from './message-logs.controller';
import { MessageRequestsService } from './message-requests.service';

@Module({
  controllers: [MessageRequestsController, MessageLogsController],
  providers: [MessageRequestsService],
  exports: [MessageRequestsService]
})
export class MessageRequestsModule {}
