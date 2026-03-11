import { Module } from '@nestjs/common';
import { EventRulesController } from './event-rules.controller';
import { EventRulesService } from './event-rules.service';

@Module({
  controllers: [EventRulesController],
  providers: [EventRulesService],
  exports: [EventRulesService]
})
export class EventRulesModule {}
