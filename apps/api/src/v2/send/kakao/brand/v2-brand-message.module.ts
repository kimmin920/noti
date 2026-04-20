import { Module } from '@nestjs/common';
import { MessageRequestsModule } from '../../../../message-requests/message-requests.module';
import { NhnModule } from '../../../../nhn/nhn.module';
import { V2SharedModule } from '../../../shared/v2-shared.module';
import { V2BrandMessageController } from './v2-brand-message.controller';
import { V2BrandMessageService } from './v2-brand-message.service';

@Module({
  imports: [MessageRequestsModule, NhnModule, V2SharedModule],
  controllers: [V2BrandMessageController],
  providers: [V2BrandMessageService]
})
export class V2BrandMessageModule {}
