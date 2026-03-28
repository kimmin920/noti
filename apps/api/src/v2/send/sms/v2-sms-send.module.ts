import { Module } from '@nestjs/common';
import { MessageRequestsModule } from '../../../message-requests/message-requests.module';
import { V2SharedModule } from '../../shared/v2-shared.module';
import { V2SmsSendController } from './v2-sms-send.controller';
import { V2SmsSendService } from './v2-sms-send.service';

@Module({
  imports: [MessageRequestsModule, V2SharedModule],
  controllers: [V2SmsSendController],
  providers: [V2SmsSendService]
})
export class V2SmsSendModule {}
