import { Module } from '@nestjs/common';
import { MessageRequestsModule } from '../../message-requests/message-requests.module';
import { V2LogsController } from './v2-logs.controller';
import { V2LogsService } from './v2-logs.service';

@Module({
  imports: [MessageRequestsModule],
  controllers: [V2LogsController],
  providers: [V2LogsService]
})
export class V2LogsModule {}
