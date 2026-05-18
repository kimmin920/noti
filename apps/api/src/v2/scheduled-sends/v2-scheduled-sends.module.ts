import { Module } from '@nestjs/common';
import { V2ScheduledSendsController } from './v2-scheduled-sends.controller';
import { V2ScheduledSendsService } from './v2-scheduled-sends.service';

@Module({
  controllers: [V2ScheduledSendsController],
  providers: [V2ScheduledSendsService]
})
export class V2ScheduledSendsModule {}
