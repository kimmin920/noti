import { Module } from '@nestjs/common';
import { SenderNumbersModule } from '../../sender-numbers/sender-numbers.module';
import { SenderProfilesModule } from '../../sender-profiles/sender-profiles.module';
import { Sms080Module } from '../../sms-080/sms-080.module';
import { V2SharedModule } from '../shared/v2-shared.module';
import { V2ResourcesController } from './v2-resources.controller';
import { V2ResourcesService } from './v2-resources.service';

@Module({
  imports: [V2SharedModule, SenderNumbersModule, SenderProfilesModule, Sms080Module],
  controllers: [V2ResourcesController],
  providers: [V2ResourcesService]
})
export class V2ResourcesModule {}
