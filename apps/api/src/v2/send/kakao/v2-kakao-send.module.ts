import { Module } from '@nestjs/common';
import { MessageRequestsModule } from '../../../message-requests/message-requests.module';
import { V2SharedModule } from '../../shared/v2-shared.module';
import { V2KakaoSendController } from './v2-kakao-send.controller';
import { V2KakaoSendService } from './v2-kakao-send.service';

@Module({
  imports: [MessageRequestsModule, V2SharedModule],
  controllers: [V2KakaoSendController],
  providers: [V2KakaoSendService]
})
export class V2KakaoSendModule {}
