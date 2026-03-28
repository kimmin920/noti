import { Module } from '@nestjs/common';
import { V2KakaoSendModule } from './kakao/v2-kakao-send.module';
import { V2SmsSendModule } from './sms/v2-sms-send.module';

@Module({
  imports: [V2SmsSendModule, V2KakaoSendModule]
})
export class V2SendModule {}
